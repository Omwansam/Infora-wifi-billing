"""Emailed password reset.

The rules this follows, and why each one is here:

**The response never depends on whether the account exists.** Same body, same
status, same timing-insensitive path for a known and an unknown address. A
forgot-password form is otherwise the cheapest way to enumerate who has an
account, and that is worth more to an attacker than it looks — it turns a
password-spray from guesswork into a targeted list.

**Only a digest is stored.** The token is 32 random bytes; a SHA-256 of it is
what goes in the table, so a read-only leak yields nothing usable and the
lookup stays an indexed equality check.

**One token at a time.** Requesting a new link invalidates the outstanding
ones, and using a link invalidates the rest. A reset link that stays live in an
old email after you have already used a newer one is a spare key nobody
remembers cutting.

**Reset reuses the account's own password policy.** ``services.password_policy``
is the single definition, so a rule tightened for the change-password form
cannot silently stay loose here.

The one thing this deliberately does not do is revoke existing sessions.
Access tokens are stateless JWTs with no server-side registry, so there is
nothing to revoke — someone who reset because they think they were compromised
keeps any attacker session alive until it expires. Fixing that means a token
denylist or a per-user token version, which is a bigger change than this; the
gap is named here rather than papered over.
"""
from __future__ import annotations

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta

from extensions import db
from models import PasswordResetToken, User

logger = logging.getLogger(__name__)

TOKEN_BYTES = 32
TTL_MINUTES = 45
# What every caller of :func:`request_reset` is told, whether or not the
# address belongs to anyone.
GENERIC_RESPONSE = (
    'If that address belongs to an account, a reset link is on its way. '
    'Check your inbox, and your spam folder.'
)


def _digest(token):
    return hashlib.sha256((token or '').encode()).hexdigest()


def console_base_url():
    """Where the reset link should point.

    Falls back through the same variables the rest of the deployment already
    sets, so a correctly configured server needs no new one.
    """
    for var in ('APP_BASE_URL', 'PUBLIC_BASE_URL', 'PROVISION_BASE_URL'):
        value = (os.environ.get(var) or '').strip().rstrip('/')
        if value:
            return value
    return 'http://localhost:5173'


def _invalidate_outstanding(user_id, now=None):
    """Burn every live token for this user. Returns how many were burnt."""
    now = now or datetime.utcnow()
    rows = (PasswordResetToken.query
            .filter(PasswordResetToken.user_id == user_id,
                    PasswordResetToken.used_at.is_(None),
                    PasswordResetToken.expires_at > now)
            .all())
    for row in rows:
        row.used_at = now
    return len(rows)


def request_reset(email, ip=None):
    """Issue and email a reset link. Always succeeds from the caller's view.

    Returns ``(sent, detail)`` for logging only — the route must not vary its
    response on it.
    """
    address = (email or '').strip().lower()
    if not address:
        return False, 'no address supplied'

    user = User.query.filter(db.func.lower(User.email) == address).first()
    if user is None:
        # Deliberately silent. Logged so a spike is visible to us, never to
        # the person on the form.
        logger.info('Password reset requested for unknown address')
        return False, 'no such account'
    if user.is_active is False:
        logger.info('Password reset requested for a disabled account: user=%s', user.id)
        return False, 'account disabled'

    _invalidate_outstanding(user.id)

    token = secrets.token_urlsafe(TOKEN_BYTES)
    row = PasswordResetToken(
        user_id=user.id,
        token_hash=_digest(token),
        expires_at=datetime.utcnow() + timedelta(minutes=TTL_MINUTES),
        requested_ip=(ip or '')[:45] or None,
    )
    db.session.add(row)
    db.session.commit()

    link = f'{console_base_url()}/reset-password?token={token}'
    isp = getattr(user, 'isp', None)
    brand = (getattr(isp, 'name', None) or getattr(isp, 'company_name', None)
             or 'your operator console')
    name = (user.first_name or '').strip() or 'there'

    body = (
        f'Hi {name},\n\n'
        f'Someone asked to reset the password for your {brand} account. '
        f'Open the link below within {TTL_MINUTES} minutes to choose a new one:\n\n'
        f'{link}\n\n'
        'The link works once. If you did not ask for this you can ignore this '
        'email — your password has not changed, and nobody can use the link '
        'without opening it from your inbox.\n'
    )

    from services.mailer import send_email

    delivered = send_email(user.email, f'Reset your {brand} password', body,
                           isp=isp, sender_name=brand)
    if not delivered:
        logger.error('Password reset email could not be sent to user=%s', user.id)
    return delivered, 'sent' if delivered else 'send failed'


def lookup(token, now=None):
    """The usable token row for this string, or ``None``."""
    if not token:
        return None
    row = PasswordResetToken.query.filter_by(token_hash=_digest(token)).first()
    if row is None or not row.is_usable(now):
        return None
    return row


class ResetError(ValueError):
    """The link could not be used, in words worth showing to the person."""


def consume(token, password, confirm=None, now=None):
    """Set the new password and burn the link. Returns the user."""
    from services.password_policy import WeakPassword, hash_password, validate_password

    row = lookup(token, now)
    if row is None:
        raise ResetError(
            'That reset link is no longer valid. It may have expired, or already '
            'been used. Request a new one.'
        )

    try:
        validate_password(password, confirm)
    except WeakPassword as exc:
        # The link stays usable — a rejected password is the person getting it
        # wrong, not the link being spent.
        raise ResetError(str(exc)) from exc

    user = row.user
    if user is None:
        raise ResetError('That account no longer exists.')

    user.password_hash = hash_password(password)
    user.updated_at = datetime.utcnow()
    stamp = now or datetime.utcnow()
    row.used_at = stamp
    _invalidate_outstanding(user.id, stamp)
    db.session.commit()
    logger.info('Password reset completed for user=%s', user.id)
    return user


def purge_expired(older_than_days=7):
    """Housekeeping: drop spent and long-expired rows."""
    cutoff = datetime.utcnow() - timedelta(days=older_than_days)
    rows = PasswordResetToken.query.filter(PasswordResetToken.created_at < cutoff).all()
    for row in rows:
        db.session.delete(row)
    if rows:
        db.session.commit()
    return len(rows)
