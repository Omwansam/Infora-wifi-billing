"""SMTP sender.

``notification_dispatch`` has always logged email rather than sending it ("wire
SMTP later"). The onboarding flow needs a real one for the welcome email, so
this is that wiring — plain ``smtplib`` against the ``MAIL_*`` settings already
declared in ``config.py``, with no new dependency.

Falls back to logging when ``MAIL_SERVER`` is unset, so a development box with
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


def is_configured():
    return bool(_config('MAIL_SERVER'))


def default_sender():
    sender = _config('MAIL_DEFAULT_SENDER') or _config('MAIL_USERNAME')
    if sender:
        return sender
    from services.brand_constants import BRAND_SUPPORT_EMAIL

    return BRAND_SUPPORT_EMAIL


def send_email(to, subject, text_body, html_body=None, sender=None, sender_name=None):
    """Send one message. Returns True on success (or on the log fallback)."""
    recipient = (to or '').strip()
    if not recipient:
        logger.warning('send_email called with no recipient')
        return False

    from_address = sender or default_sender()

    if not is_configured():
        logger.info('Email [%s] %s\n%s', recipient, subject, text_body)
        return True

    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = formataddr((sender_name, from_address)) if sender_name else from_address
    message['To'] = recipient
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype='html')

    host = _config('MAIL_SERVER')
    port = int(_config('MAIL_PORT', 587) or 587)
    username = _config('MAIL_USERNAME')
    password = _config('MAIL_PASSWORD')
    use_tls = str(_config('MAIL_USE_TLS', 'true')).lower() in ('1', 'true', 'yes')
    use_ssl = str(_config('MAIL_USE_SSL', 'false')).lower() in ('1', 'true', 'yes')

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
        logger.error('Email to %s failed: %s', recipient, exc)
        return False
