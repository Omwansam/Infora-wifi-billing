"""Dispatch SMS/email notifications using per-ISP NotificationSetting overrides."""
import logging
import os
from datetime import datetime

from extensions import db
from models import Customer, ISP, Notification, NotificationPriority, NotificationSetting
from services import notification_events as nev
from services.portal_urls import portal_entry_url
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


def send_sms(phone, message):
    """Send SMS via configured provider. Logs-only when SMS is disabled."""
    phone = (phone or '').strip()
    if not phone:
        return False
    provider = (os.environ.get('SMS_PROVIDER') or 'log').lower()
    if provider == 'log' or os.environ.get('SMS_ENABLED', 'false').lower() != 'true':
        logger.info('SMS [%s]: %s', phone, message[:160])
        return True
    # Africa's Talking (common in Kenya)
    if provider == 'africastalking':
        try:
            import africastalking
            africastalking.initialize(
                os.environ.get('AT_USERNAME', ''),
                os.environ.get('AT_API_KEY', ''),
            )
            africastalking.SMS.send(message, [phone])
            return True
        except Exception as exc:
            logger.error('SMS send failed: %s', exc)
            return False
    logger.warning('Unknown SMS_PROVIDER=%s — logging only', provider)
    logger.info('SMS [%s]: %s', phone, message[:160])
    return True


def _log_notification(customer, message, title='SMS'):
    db.session.add(Notification(
        customer_id=customer.id,
        notification_type='sms',
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
        if send_sms(phone, body):
            _log_notification(customer, body, title=event_key)
    # Email channel: log for now; wire SMTP later
    elif channel == 'sms' is False and channel == 'email':
        logger.info('Email [%s] %s: %s', customer.email, event_key, body[:200])


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
