"""TOTP two-factor authentication helpers.

The user's TOTP secret is stored encrypted (services.encryption); backup codes
are stored as a JSON list of SHA-256 hashes and consumed on use. Verification
allows a +/- 1 step window to tolerate clock drift.
"""
import base64
import hashlib
import io
import json
import secrets

import pyotp
import qrcode

from services.encryption import decrypt_value, encrypt_value

ISSUER = 'Infora Billing'
BACKUP_CODE_COUNT = 10


def generate_secret():
    return pyotp.random_base32()


def store_secret(user, secret):
    user.two_factor_secret = encrypt_value(secret)


def load_secret(user):
    if not user.two_factor_secret:
        return None
    return decrypt_value(user.two_factor_secret)


def provisioning_uri(secret, account_name, issuer=ISSUER):
    return pyotp.TOTP(secret).provisioning_uri(name=account_name, issuer_name=issuer)


def verify_code(secret, code):
    if not secret or not code:
        return False
    code = str(code).strip().replace(' ', '')
    try:
        return pyotp.TOTP(secret).verify(code, valid_window=1)
    except Exception:
        return False


def qr_data_uri(uri):
    """Render an otpauth:// URI to a base64 PNG data URI for an <img> tag."""
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    return f'data:image/png;base64,{b64}'


def _hash_code(code):
    return hashlib.sha256(code.encode('utf-8')).hexdigest()


def generate_backup_codes(count=BACKUP_CODE_COUNT):
    """Return (plaintext_codes, serialized_hashes). Show plaintext once."""
    codes = []
    for _ in range(count):
        raw = secrets.token_hex(4)  # 8 hex chars
        codes.append(f'{raw[:4]}-{raw[4:]}')
    hashes = json.dumps([_hash_code(c) for c in codes])
    return codes, hashes


def consume_backup_code(user, code):
    """If `code` matches an unused backup code, remove it and return True."""
    if not user.two_factor_backup_codes or not code:
        return False
    code = str(code).strip().lower()
    try:
        hashes = json.loads(user.two_factor_backup_codes)
    except (ValueError, TypeError):
        return False
    target = _hash_code(code)
    if target in hashes:
        hashes.remove(target)
        user.two_factor_backup_codes = json.dumps(hashes)
        return True
    return False


def remaining_backup_codes(user):
    if not user.two_factor_backup_codes:
        return 0
    try:
        return len(json.loads(user.two_factor_backup_codes))
    except (ValueError, TypeError):
        return 0
