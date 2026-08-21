"""Dispatch SMS/email notifications using per-ISP NotificationSetting overrides.

Credentials resolve tenant-first: a gateway configured under Settings >
Communications (SMS) or Settings > Email wins, and the platform's own env
config is the fallback. ``services/tenant_integrations`` explains why that
choice is all-or-nothing rather than per-field.

Which gateway a message leaves on is resolved per send by
:func:`resolve_gateway`; the vendors themselves live in
``services/messaging_providers``, one declarative spec each, so adding a
gateway is data rather than another branch here.
"""
import logging
import os
from datetime import datetime

from services import messaging_providers as mp

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


def _tenant_gateway(isp, channel):
    """The tenant's selected provider plus its saved credentials, or ``None``.

    Selection and credentials are separate on purpose: the provider id lives on
    the ISP row, the secrets live in ``integration_settings`` under that same
    id. Switching provider therefore leaves every other provider's credentials
    intact, which is what makes "try Twilio for a week" a reversible decision.
    """
    if isp is None:
        return None
    provider_id = getattr(isp, 'sms_provider' if channel == mp.SMS else 'whatsapp_provider', None)
    if not provider_id:
        return None
    spec = mp.get(provider_id)
    if not spec or spec['channel'] != channel:
        logger.warning('isp=%s selected unknown %s provider %r', isp.id, channel, provider_id)
        return None

    from services.tenant_integrations import integration_config
    config = integration_config(isp, provider_id, required=())
    if config is None:
        logger.warning(
            'isp=%s selected %s but has no enabled credentials for it', isp.id, provider_id)
        return None

    missing = mp.missing_fields(provider_id, config)
    if missing:
        logger.warning('isp=%s %s is missing %s — using the platform default',
                       isp.id, provider_id, ', '.join(missing))
        return None
    return {'source': 'tenant', 'provider': provider_id, 'config': config}


def _platform_sms_gateway():
    """The deployment's own gateway, from the environment."""
    if os.environ.get('SMS_ENABLED', 'false').lower() != 'true':
        return None
    provider_id = (os.environ.get('SMS_PROVIDER') or '').lower().strip()
    spec = mp.get(provider_id)
    if not spec or spec['channel'] != mp.SMS:
        if provider_id:
            logger.warning('Unknown SMS_PROVIDER=%s — logging only', provider_id)
        return None

    # Env names follow the provider's own field names, upper-cased and prefixed,
    # e.g. AT_USERNAME / TWILIO_ACCOUNT_SID. AT_* is kept as a special case
    # because it predates the registry and is set on live deployments.
    prefix = 'AT' if provider_id == 'africastalking' else provider_id.upper()
    config = {}
    for field in spec['fields']:
        value = os.environ.get(f"{prefix}_{field['name'].upper()}", '')
        if value:
            config[field['name']] = value
    if mp.missing_fields(provider_id, config):
        return None
    return {'source': 'platform', 'provider': provider_id, 'config': config}


def resolve_gateway(isp=None, channel=mp.SMS):
    """Effective gateway for this send: tenant first, then the platform."""
    tenant = _tenant_gateway(isp, channel)
    if tenant:
        return tenant
    # Only SMS has a platform fallback; WhatsApp is tenant-only by design,
    # since a shared WhatsApp number cannot carry another business's branding.
    return _platform_sms_gateway() if channel == mp.SMS else None


def resolve_sms_config(isp=None):
    """Back-compat shim: flat config dict for the SMS gateway, or ``None``."""
    gateway = resolve_gateway(isp, mp.SMS)
    if not gateway:
        return None
    return {'source': gateway['source'], 'provider': gateway['provider'], **gateway['config']}


class SmsNotConfigured(mp.ProviderNotConfigured):
    """Raised only when a caller asked for errors and no gateway is set up."""


SmsSendFailed = mp.SendFailed


def _send(channel, phone, message, isp=None, raise_errors=False, label='SMS'):
    phone = (phone or '').strip()
    if not phone:
        return False

    gateway = resolve_gateway(isp, channel)
    if gateway is None:
        if raise_errors:
            raise SmsNotConfigured(
                f'No {label} gateway is configured. Pick a provider and save its '
                f'credentials under Settings, or ask whoever runs this deployment '
                f'to configure the platform gateway.'
            )
        logger.info('%s [%s]: %s', label, phone, message[:160])
        return True

    try:
        mp.send(gateway['provider'], gateway['config'], phone, message)
        return True
    except Exception as exc:
        logger.error('%s to %s failed (%s via %s): %s',
                     label, phone, gateway['source'], gateway['provider'], exc)
        if raise_errors:
            raise
        return False


def send_sms(phone, message, isp=None, raise_errors=False):
    """Send one SMS on the tenant's gateway, else the platform's, else log."""
    return _send(mp.SMS, phone, message, isp=isp, raise_errors=raise_errors, label='SMS')


def send_whatsapp(phone, message, isp=None, raise_errors=False):
    """Send one WhatsApp message. Tenant-only — there is no shared fallback."""
    return _send(mp.WHATSAPP, phone, message, isp=isp, raise_errors=raise_errors,
                 label='WhatsApp')


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
