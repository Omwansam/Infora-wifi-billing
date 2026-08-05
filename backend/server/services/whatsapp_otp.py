"""WhatsApp delivery + the OTP primitives behind signup step 2.

Delivery is a provider switch in the same shape as ``notification_dispatch.send_sms``:
``WHATSAPP_PROVIDER`` selects ``log`` (default), ``meta`` or ``twilio``, and
``WHATSAPP_ENABLED`` must be true before anything leaves the process. On ``log``
the code is written to the server log and the signup flow works end to end
without any vendor account, which is what makes this testable locally.

Codes are stored hashed. A signup OTP is short-lived and low-value, but it is
also a live credential for as long as it exists, and the table it lives in
(``onboarding_signups``) holds email addresses and phone numbers — exactly the
row an attacker with read access would want. Hashing costs nothing here.

Promoting to a real provider
----------------------------
Meta requires a pre-approved AUTHENTICATION template; business-initiated
messages outside the 24-hour customer service window are rejected otherwise, so
``WHATSAPP_META_TEMPLATE`` is a template *name*, not free text. Twilio's sandbox
requires each recipient to first message a join code, which is unusable for
signup — use it only with a provisioned sender.
"""
from __future__ import annotations

import logging
import os
import secrets
from datetime import datetime, timedelta

from werkzeug.security import check_password_hash, generate_password_hash

logger = logging.getLogger(__name__)
# app.py pins root logging to WARNING so the terminal stays readable. The stub
# provider's whole purpose is that a developer can read the code off that
# terminal, so this one logger opts back in — same targeted override app.py
# already makes for werkzeug.
logger.setLevel(logging.INFO)

CODE_LENGTH = 6
# Matches the "9m 51s" countdown the verification screen renders.
OTP_TTL_SECONDS = 600
# Matches "Resend in 52s".
RESEND_COOLDOWN_SECONDS = 60
# Wrong guesses before the attempt is burnt and a new code is required.
MAX_VERIFY_ATTEMPTS = 5
# Total sends (initial + resends) allowed per signup attempt.
MAX_SENDS = 5


class WhatsAppError(RuntimeError):
    """Delivery failed — the caller should surface a retry, not a success."""


# ---------------------------------------------------------------------------
# Code generation / verification
# ---------------------------------------------------------------------------

def generate_code():
    """A uniformly-random numeric code. ``secrets``, never ``random``."""
    upper = 10 ** CODE_LENGTH
    return str(secrets.randbelow(upper)).zfill(CODE_LENGTH)


def hash_code(code):
    return generate_password_hash(str(code))


def verify_code_hash(code_hash, code):
    """Constant-time-ish comparison via the password hasher."""
    if not code_hash or not code:
        return False
    try:
        return check_password_hash(code_hash, str(code).strip())
    except Exception:
        return False


def is_expired(expires_at, now=None):
    if not expires_at:
        return True
    return (now or datetime.now()) > expires_at


def expiry_from(now=None):
    return (now or datetime.now()) + timedelta(seconds=OTP_TTL_SECONDS)


def seconds_until(moment, now=None):
    """Whole seconds remaining until ``moment``, floored at 0."""
    if not moment:
        return 0
    delta = (moment - (now or datetime.now())).total_seconds()
    return max(0, int(delta))


def resend_available_at(last_sent_at):
    if not last_sent_at:
        return None
    return last_sent_at + timedelta(seconds=RESEND_COOLDOWN_SECONDS)


def resend_cooldown_remaining(last_sent_at, now=None):
    return seconds_until(resend_available_at(last_sent_at), now=now)


# ---------------------------------------------------------------------------
# Delivery
# ---------------------------------------------------------------------------

def provider_name():
    return (os.environ.get('WHATSAPP_PROVIDER') or 'log').strip().lower()


def is_live():
    """True when messages actually leave the process."""
    return (
        provider_name() != 'log'
        and os.environ.get('WHATSAPP_ENABLED', 'false').lower() in ('1', 'true', 'yes')
    )


def can_echo_code():
    """Whether an endpoint may return the code in its response body.

    Both conditions are required, and both are environment-level: a stub
    provider *and* development mode. This is the affordance that lets someone
    run the wizard locally with no vendor account; it must be impossible to
    trip in production by flipping one variable.
    """
    return (
        provider_name() == 'log'
        and os.environ.get('FLASK_ENV', 'development').lower() in ('development', 'dev')
    )


def otp_message(code, brand_name):
    return (
        f'{code} is your {brand_name} verification code. '
        f'It expires in {OTP_TTL_SECONDS // 60} minutes. '
        'If you did not request it, ignore this message.'
    )


def send_whatsapp(phone, message, template_params=None):
    """Deliver ``message`` to ``phone`` (E.164). Raises :class:`WhatsAppError`.

    ``template_params`` carries the ordered substitutions for providers that
    require a pre-approved template rather than free text (Meta).
    """
    phone = (phone or '').strip()
    if not phone:
        raise WhatsAppError('No WhatsApp number supplied')

    provider = provider_name()

    if not is_live():
        # The stub path. Logged at INFO so it shows up in the dev terminal.
        logger.info('WhatsApp [%s]: %s', phone, message)
        return True

    if provider == 'meta':
        return _send_meta(phone, message, template_params)
    if provider == 'twilio':
        return _send_twilio(phone, message)

    logger.warning('Unknown WHATSAPP_PROVIDER=%s — falling back to log', provider)
    logger.info('WhatsApp [%s]: %s', phone, message)
    return True


def _send_meta(phone, message, template_params=None):
    """Meta WhatsApp Cloud API (Graph)."""
    import requests

    token = os.environ.get('WHATSAPP_META_TOKEN', '').strip()
    phone_number_id = os.environ.get('WHATSAPP_META_PHONE_NUMBER_ID', '').strip()
    if not token or not phone_number_id:
        raise WhatsAppError('WhatsApp is not configured (missing Meta credentials)')

    version = os.environ.get('WHATSAPP_META_API_VERSION', 'v21.0')
    url = f'https://graph.facebook.com/{version}/{phone_number_id}/messages'
    template = os.environ.get('WHATSAPP_META_TEMPLATE', '').strip()

    if template:
        # Business-initiated messages must use an approved template. An
        # AUTHENTICATION template takes the code as its body parameter and, for
        # the copy-code button, the same value again as a button parameter.
        params = template_params or []
        payload = {
            'messaging_product': 'whatsapp',
            'to': phone,
            'type': 'template',
            'template': {
                'name': template,
                'language': {
                    'code': os.environ.get('WHATSAPP_META_TEMPLATE_LANG', 'en_US'),
                },
                'components': [
                    {
                        'type': 'body',
                        'parameters': [{'type': 'text', 'text': str(p)} for p in params],
                    },
                ],
            },
        }
        if params and os.environ.get('WHATSAPP_META_TEMPLATE_HAS_BUTTON', 'true').lower() in ('1', 'true', 'yes'):
            payload['template']['components'].append({
                'type': 'button',
                'sub_type': 'url',
                'index': '0',
                'parameters': [{'type': 'text', 'text': str(params[0])}],
            })
    else:
        # Free-text only reaches a user inside the 24h service window.
        payload = {
            'messaging_product': 'whatsapp',
            'to': phone,
            'type': 'text',
            'text': {'body': message},
        }

    try:
        response = requests.post(
            url,
            json=payload,
            headers={'Authorization': f'Bearer {token}'},
            timeout=15,
        )
    except Exception as exc:
        raise WhatsAppError(f'WhatsApp delivery failed: {exc}') from exc

    if response.status_code >= 400:
        # Never log the payload — it carries the code.
        logger.error('Meta WhatsApp send failed (%s): %s',
                     response.status_code, response.text[:300])
        raise WhatsAppError('Could not send the WhatsApp code. Please try again.')
    return True


def _send_twilio(phone, message):
    """Twilio WhatsApp sender."""
    import requests

    sid = os.environ.get('TWILIO_ACCOUNT_SID', '').strip()
    auth = os.environ.get('TWILIO_AUTH_TOKEN', '').strip()
    sender = os.environ.get('TWILIO_WHATSAPP_FROM', '').strip()
    if not (sid and auth and sender):
        raise WhatsAppError('WhatsApp is not configured (missing Twilio credentials)')

    if not sender.startswith('whatsapp:'):
        sender = f'whatsapp:{sender}'

    try:
        response = requests.post(
            f'https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json',
            data={'From': sender, 'To': f'whatsapp:{phone}', 'Body': message},
            auth=(sid, auth),
            timeout=15,
        )
    except Exception as exc:
        raise WhatsAppError(f'WhatsApp delivery failed: {exc}') from exc

    if response.status_code >= 400:
        logger.error('Twilio WhatsApp send failed (%s): %s',
                     response.status_code, response.text[:300])
        raise WhatsAppError('Could not send the WhatsApp code. Please try again.')
    return True


def send_otp(phone, code, brand_name):
    """Send a verification code. Returns True, or raises :class:`WhatsAppError`."""
    return send_whatsapp(phone, otp_message(code, brand_name), template_params=[code])
