"""Hotspot username/password generation honouring ISP Settings defaults."""
import re
import secrets
import string


def normalize_phone(phone):
    digits = re.sub(r'\D', '', str(phone or ''))
    if digits.startswith('0'):
        digits = '254' + digits[1:]
    elif digits.startswith('7') or digits.startswith('1'):
        digits = '254' + digits
    elif not digits.startswith('254'):
        digits = '254' + digits
    return digits


def hotspot_portal_email(phone):
    return f'{normalize_phone(phone)}@hotspot.portal'


def hotspot_login_email(isp, phone):
    """Email/RADIUS username for a hotspot guest (stored on Customer.email)."""
    prefix = (getattr(isp, 'hotspot_username_prefix', None) or '').strip().upper()
    phone_norm = normalize_phone(phone)
    if prefix:
        safe = re.sub(r'[^A-Z0-9_-]', '', prefix)[:20] or 'HS'
        return f'{safe.lower()}{phone_norm[-6:]}@hotspot.portal'
    return hotspot_portal_email(phone)


def generate_hotspot_password(isp=None):
    length = 8
    if isp and getattr(isp, 'hotspot_password_length', None):
        try:
            length = max(4, min(32, int(isp.hotspot_password_length)))
        except (TypeError, ValueError):
            pass
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))
