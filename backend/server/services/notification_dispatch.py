"""Dispatch SMS/email notifications using per-ISP NotificationSetting overrides.

Credentials resolve tenant-first: a gateway configured under Settings >
Communications (SMS) or Settings > Email wins, and the platform's own env
config is the fallback. ``services/tenant_integrations`` explains why that
choice is all-or-nothing rather than per-field.

Africa's Talking is called over plain HTTP rather than through their SDK. The
SDK was never in requirements, so the old ``import africastalking`` branch
could not succeed on any deployment we have; ``requests`` is already a
dependency, and going direct also means the gateway's own response text can be
handed back to the Settings test button, which is the part an operator can
actually act on.
"""
import logging
import os
from datetime import datetime

import requests

from extensions import db
from models import Customer, ISP, Notification, NotificationPriority, NotificationSetting
from services import notification_events as nev
from services.portal_urls import portal_entry_url
from services.mailer import send_email
from services.radius_provisioning import get_customer_radius_password, radius_username

logger = logging.getLogger(__name__)


def _setting(isp_id, event_key, channel):
    return NotificationSetting.query.filter_by(
        isp_id=isp_id, event_key=event_key, channel=channel,
    ).first()


def _enabled(isp_id, event_key, channel, default):
    row = _setting(isp_id, event_key, channel)
    return row.enabled if row is not None else default


def _template(isp_id, event_key, channel, default):
    row = _setting(isp_id, event_key, channel)
    if row and row.template:
        return row.template
    return default


def _render(template, variables):
    text = template or ''
    for key, value in variables.items():
        text = text.replace(f'{{{key}}}', str(value or ''))
    return text


AT_HOSTS = {
    'sandbox': 'https://api.sandbox.africastalking.com',
    'production': 'https://api.africastalking.com',
}

# Africa's Talking per-recipient codes: 100 processed, 101 sent, 102 queued.
# Anything else is a refusal we should surface rather than swallow.
AT_ACCEPTED = (100, 101, 102)


class SmsNotConfigured(RuntimeError):
    """Raised only when a caller asked for errors and no gateway is set up."""


class SmsSendFailed(RuntimeError):
    """Carries the gateway's own words, which is the part worth showing."""


def _platform_sms_config():
    """The deployment's own gateway, from the environment."""
    provider = (os.environ.get('SMS_PROVIDER') or 'log').lower()
    if provider == 'log' or os.environ.get('SMS_ENABLED', 'false').lower() != 'true':
        return None
    if provider != 'africastalking':
        logger.warning('Unknown SMS_PROVIDER=%s — logging only', provider)
        return None
    username = os.environ.get('AT_USERNAME', '').strip()
    api_key = os.environ.get('AT_API_KEY', '').strip()
    if not (username and api_key):
        return None
    return {
        'source': 'platform',
        'provider': 'africastalking',
        'username': username,
        'api_key': api_key,
        'sender_id': os.environ.get('AT_SENDER_ID', '').strip(),
        'environment': os.environ.get('AT_ENVIRONMENT', 'production').strip().lower(),
    }


def _tenant_sms_config(isp):
    """The tenant's own gateway row, or ``None`` to mean "use the platform"."""
    if isp is None:
        return None
    try:
        from services.tenant_integrations import integration_config
    except Exception:  # pragma: no cover - import guard for partial installs
        return None

    config = integration_config(isp, 'africastalking', required=('username', 'api_key'))
    if not config:
        return None
    return {
        'source': 'tenant',
        'provider': 'africastalking',
        'username': (config.get('username') or '').strip(),
        'api_key': (config.get('api_key') or '').strip(),
        'sender_id': (config.get('sender_id') or '').strip(),
        'environment': (config.get('environment') or 'production').strip().lower(),
    }


def resolve_sms_config(isp=None):
    """Effective SMS gateway for this send: tenant first, then platform."""
    return _tenant_sms_config(isp) or _platform_sms_config()


def _send_africastalking(config, phone, message):
    """POST one message. Returns the parsed body; raises SmsSendFailed."""
    env = 'sandbox' if config.get('environment') == 'sandbox' else 'production'
    url = f"{AT_HOSTS[env]}/version1/messaging"
    payload = {'username': config['username'], 'to': phone, 'message': message}
    if config.get('sender_id'):
        payload['from'] = config['sender_id']

    response = requests.post(
        url,
        data=payload,
        headers={'apiKey': config['api_key'], 'Accept': 'application/json'},
        timeout=20,
    )

    try:
        body = response.json()
    except ValueError:
        body = None

    if response.status_code >= 400 or body is None:
        raise SmsSendFailed(
            f'Gateway returned HTTP {response.status_code}: {response.text[:300].strip()}'
        )

    recipients = (body.get('SMSMessageData') or {}).get('Recipients') or []
    if not recipients:
        # AT reports "Sent to 0/1" style refusals in Message rather than per
        # recipient — invalid sender ID and out-of-credit both land here.
        summary = (body.get('SMSMessageData') or {}).get('Message') or str(body)[:300]
        raise SmsSendFailed(f'Gateway accepted nothing: {summary}')

    rejected = [r for r in recipients if int(r.get('statusCode') or 0) not in AT_ACCEPTED]
    if rejected:
        first = rejected[0]
        raise SmsSendFailed(
            f"{first.get('number') or phone}: {first.get('status') or 'rejected'} "
            f"(code {first.get('statusCode')})"
        )
    return body


def send_sms(phone, message, isp=None, raise_errors=False):
    """Send one SMS. Returns True on success, or on the log-only fallback.

    ``isp`` selects that tenant's own gateway when they have one configured.
    ``raise_errors`` is for the Settings test button, which needs the gateway's
    actual refusal; every other caller keeps the best-effort contract.
    """
    phone = (phone or '').strip()
    if not phone:
        return False

    config = resolve_sms_config(isp)
    if config is None:
        if raise_errors:
            raise SmsNotConfigured(
                'No SMS gateway is configured. Add your own under Settings > '
                'Communications, or ask whoever runs this deployment to set '
                'SMS_ENABLED and the provider credentials.'
            )
        logger.info('SMS [%s]: %s', phone, message[:160])
        return True

    try:
        _send_africastalking(config, phone, message)
        return True
    except Exception as exc:
        logger.error('SMS to %s failed (%s gateway): %s', phone, config['source'], exc)
        if raise_errors:
            raise
        return False


def _log_notification(customer, message, title='SMS', channel='sms'):
    db.session.add(Notification(
        customer_id=customer.id,
        notification_type=channel,
        title=title,
        message=message,
        priority=NotificationPriority.MEDIUM,
    ))


def dispatch_event(isp, customer, event_key, channel, variables, default_enabled=True, default_template=''):
    if not _enabled(isp.id, event_key, channel, default_enabled):
        return
    catalogue = nev.event_index().get((event_key, channel), {})
    template = _template(
        isp.id, event_key, channel,
        default_template or catalogue.get('default_template', ''),
    )
    body = _render(template, variables)
    if channel == 'sms':
        phone = customer.phone or variables.get('phone')
        if send_sms(phone, body, isp=isp):
            _log_notification(customer, body, title=event_key)
    elif channel == 'email':
        # This branch used to read `elif channel == 'sms' is False and ...`,
        # which Python evaluates as a chained comparison — `'sms' is False` is
        # always False, so the email channel never ran at all, not even the log
        # line it claimed to write. Every email template in Settings was inert.
        recipient = customer.email or variables.get('email')
        if not recipient:
            return
        subject = catalogue.get('label') or event_key.replace('_', ' ').title()
        if send_email(recipient, subject, body, isp=isp,
                      sender_name=isp.name or isp.company_name):
            _log_notification(customer, body, title=event_key, channel='email')


def dispatch_hotspot_payment_success(payment):
    customer = payment.customer
    if not customer or customer.connection_type != 'hotspot':
        return
    isp = ISP.query.get(customer.isp_id) if customer.isp_id else None
    if not isp:
        return
    plan = customer.service_plan
    portal_url = portal_entry_url(isp.id) or ''
    variables = {
        'customer_name': customer.full_name or 'Guest',
        'isp_name': isp.name or isp.company_name,
        'username': radius_username(customer),
        'password': get_customer_radius_password(customer) or '',
        'portal_url': portal_url,
        'amount': payment.amount,
        'plan': plan.name if plan else customer.package,
        'expiry_date': customer.subscription_end.strftime('%d %b %Y %H:%M') if customer.subscription_end else '',
        'phone': customer.phone,
    }
    dispatch_event(isp, customer, 'payment_received', 'sms', variables, default_enabled=False)
    dispatch_event(isp, customer, 'welcome_sms', 'sms', variables, default_enabled=False)


def dispatch_hotspot_expired(customer, isp):
    portal_url = portal_entry_url(isp.id) if isp else ''
    variables = {
        'customer_name': customer.full_name or 'Guest',
        'isp_name': isp.name if isp else '',
        'plan': customer.package or '',
        'portal_url': portal_url,
    }
    dispatch_event(isp, customer, 'disconnected_expired', 'sms', variables, default_enabled=True)
