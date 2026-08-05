"""One definition of what counts as an acceptable password.

Signup and "change password" used to disagree — signup demanded 10 characters
while Settings accepted 6, so an account could be weakened below the bar it was
created under. Both now call :func:`validate_password`.

Hashing goes through :func:`hash_password` rather than calling Werkzeug directly
so no caller can pin a `method=` again. Werkzeug 3 removed the old named methods
(`sha256` among them) and raises `ValueError: Invalid hash method` — which is
exactly how the change-password endpoint broke. The default is scrypt and is
what every other call site already used.
"""
from __future__ import annotations

from werkzeug.security import check_password_hash, generate_password_hash

MIN_PASSWORD_LENGTH = 10
MAX_PASSWORD_LENGTH = 200  # bcrypt-style truncation footguns + absurd payloads


class WeakPassword(ValueError):
    """The supplied password does not meet policy."""


def validate_password(password, confirm=None):
    """Return the password, or raise :class:`WeakPassword`.

    Length is the only *enforced* rule. Character-class requirements are shown
    in the UI as coaching, not gates: they push people toward `Passw0rd!` while
    rejecting the long random strings a password manager produces, which is the
    wrong trade.
    """
    value = password or ''
    if not value:
        raise WeakPassword('Enter a new password')
    if len(value) < MIN_PASSWORD_LENGTH:
        raise WeakPassword(
            f'Password must be at least {MIN_PASSWORD_LENGTH} characters'
        )
    if len(value) > MAX_PASSWORD_LENGTH:
        raise WeakPassword(
            f'Password must be {MAX_PASSWORD_LENGTH} characters or fewer'
        )
    if confirm is not None and value != confirm:
        raise WeakPassword('Passwords do not match')
    return value


def hash_password(password):
    """Hash using Werkzeug's current default (scrypt). Never pass `method=`."""
    return generate_password_hash(password)


def verify_password(password_hash, password):
    """Check a password against a stored hash. False on any malformed hash.

    Hashes written by older Werkzeug versions may use a method this build no
    longer understands; that must read as "wrong password", not a 500.
    """
    if not password_hash or not password:
        return False
    try:
        return check_password_hash(password_hash, password)
    except (ValueError, TypeError):
        return False
