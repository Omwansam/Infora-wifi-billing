"""SMTP sender.

``notification_dispatch`` has always logged email rather than sending it ("wire
SMTP later"). The onboarding flow needs a real one for the welcome email, so
this is that wiring — plain ``smtplib`` against the ``MAIL_*`` settings already
declared in ``config.py``, with no new dependency.

Two sources of credentials, in order: the tenant's own SMTP row (Settings >
Email, stored in ``integration_settings``) when one is configured and switched
on, otherwise the platform's ``MAIL_*`` config. :func:`resolve_smtp_config`
owns that choice — see ``services/tenant_integrations`` for why it is
all-or-nothing rather than field-by-field.

Falls back to logging when neither source has a host, so a development box with
no mail relay still completes provisioning instead of failing a step.

Sending is best-effort by design: :func:`send_email` returns a bool and does not
raise. A tenant whose welcome email bounced still has a working account, and
failing provisioning over it would be the worse outcome.
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

logger = logging.getLogger(__name__)


class MailerNotConfigured(RuntimeError):
    """Raised only when a caller asked for errors and nothing is configured."""


def _config(key, default=None):
    """Read from Flask config when in an app context, else the environment."""
    try:
        from flask import current_app

        if current_app:
            value = current_app.config.get(key)
            if value not in (None, ''):
                return value
    except Exception:
        pass
    value = os.environ.get(key)
    return value if value not in (None, '') else default


def _platform_config():
    """The deployment's own relay, from Flask config or the environment."""
    host = _config('MAIL_SERVER')
    if not host:
        return None
    return {
        'source': 'platform',
        'host': host,
        'port': int(_config('MAIL_PORT', 587) or 587),
        'username': _config('MAIL_USERNAME') or '',
        'password': _config('MAIL_PASSWORD') or '',
        'use_tls': str(_config('MAIL_USE_TLS', 'true')).lower() in ('1', 'true', 'yes'),
        'use_ssl': str(_config('MAIL_USE_SSL', 'false')).lower() in ('1', 'true', 'yes'),
        'sender': _config('MAIL_DEFAULT_SENDER') or _config('MAIL_USERNAME') or '',
    }


def _tenant_config(isp):
    """The tenant's own SMTP row, or ``None`` to mean "use the platform"."""
    if isp is None:
        return None
    try:
        from services.tenant_integrations import integration_config
    except Exception:  # pragma: no cover - import guard for partial installs
        return None

    config = integration_config(isp, 'smtp', required=('host',))
    if not config:
        return None

    try:
        port = int(str(config.get('port') or '').strip() or 587)
    except (TypeError, ValueError):
        port = 587

    encryption = (config.get('encryption') or 'tls').strip().lower()
    return {
        'source': 'tenant',
        'host': (config.get('host') or '').strip(),
        'port': port,
        'username': (config.get('username') or '').strip(),
        'password': config.get('password') or '',
        'use_tls': encryption == 'tls',
        'use_ssl': encryption == 'ssl',
        'sender': (config.get('from_email') or config.get('username') or '').strip(),
    }


def resolve_smtp_config(isp=None):
    """Effective SMTP settings for this send: tenant first, then platform.

    ``None`` means nothing is configured anywhere and the caller should log
    rather than send.
    """
    return _tenant_config(isp) or _platform_config()


def is_configured(isp=None):
    return resolve_smtp_config(isp) is not None


def default_sender(isp=None):
    config = resolve_smtp_config(isp)
    if config and config.get('sender'):
        return config['sender']
    from services.brand_constants import BRAND_SUPPORT_EMAIL

    return BRAND_SUPPORT_EMAIL


def send_email(to, subject, text_body, html_body=None, sender=None, sender_name=None,
               isp=None, raise_errors=False):
    """Send one message. Returns True on success (or on the log fallback).

    ``isp`` selects that tenant's own SMTP credentials when they have any.
    ``raise_errors`` is for the Settings > Email test button, which needs the
    server's actual refusal text; every other caller keeps the best-effort
    contract this module has always had.
    """
    recipient = (to or '').strip()
    if not recipient:
        logger.warning('send_email called with no recipient')
        return False

    config = resolve_smtp_config(isp)
    from_address = sender or (config or {}).get('sender') or default_sender(isp)

    if config is None:
        if raise_errors:
            raise MailerNotConfigured(
                'No SMTP server is configured. Add your own under Settings > Email, '
                'or ask whoever runs this deployment to set MAIL_SERVER.'
            )
        logger.info('Email [%s] %s\n%s', recipient, subject, text_body)
        return True

    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = formataddr((sender_name, from_address)) if sender_name else from_address
    message['To'] = recipient
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype='html')

    host = config['host']
    port = config['port']
    username = config['username']
    password = config['password']
    use_tls = config['use_tls']
    use_ssl = config['use_ssl']

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(host, port, timeout=20) as smtp:
                if username:
                    smtp.login(username, password or '')
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=20) as smtp:
                smtp.ehlo()
                if use_tls:
                    smtp.starttls()
                    smtp.ehlo()
                if username:
                    smtp.login(username, password or '')
                smtp.send_message(message)
        return True
    except Exception as exc:
        logger.error('Email to %s failed (%s smtp): %s', recipient, config['source'], exc)
        if raise_errors:
            raise
        return False
