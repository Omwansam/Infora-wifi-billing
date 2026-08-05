"""Signup email validation — format, plus a disposable-inbox block.

The signup email is not a contact field, it is the sign-in identity and the only
account-recovery channel that survives losing the phone. A throwaway inbox
therefore produces an account nobody can recover, which is what the "no
temporary inboxes" hint under the field is warning about.

The blocklist is intentionally small and hand-picked: the popular services, not
an exhaustive mirror of someone's GitHub list. A short list that never
false-positives on a real customer beats a long one that occasionally rejects a
paying ISP, because the failure is silent — they just leave.
"""
from __future__ import annotations

import os
import re

# Deliberately stricter than RFC 5322 (which permits quoted local parts nobody
# types): one @, a dot in the domain, no whitespace, no consecutive dots.
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$")

DISPOSABLE_DOMAINS = {
    '10minutemail.com', '20minutemail.com', 'guerrillamail.com',
    'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com',
    'grr.la', 'mailinator.com', 'mailinator.net', 'maildrop.cc',
    'tempmail.com', 'temp-mail.org', 'tempmailo.com', 'throwawaymail.com',
    'yopmail.com', 'yopmail.fr', 'trashmail.com', 'trashmail.de',
    'getnada.com', 'nada.email', 'dispostable.com', 'fakeinbox.com',
    'mytemp.email', 'emailondeck.com', 'moakt.com', 'mohmal.com',
    'spamgourmet.com', 'mailnesia.com', 'inboxkitten.com', 'tempr.email',
    'discard.email', 'byom.de', 'anonbox.net', 'burnermail.io',
    'harakirimail.com', 'mailcatch.com', 'spam4.me', 'tmail.ws',
}


class InvalidEmail(ValueError):
    """The supplied address cannot be used as a sign-in identity."""


def normalize_email(raw):
    return str(raw or '').strip().lower()


def email_domain(email):
    return normalize_email(email).rsplit('@', 1)[-1] if '@' in str(email or '') else ''


def is_valid_format(email):
    value = normalize_email(email)
    return bool(value) and len(value) <= 120 and bool(_EMAIL_RE.match(value))


def is_disposable(email):
    domain = email_domain(email)
    if not domain:
        return False
    if domain in DISPOSABLE_DOMAINS:
        return True
    # Catch the subdomain form some services hand out (foo.mailinator.com).
    return any(domain.endswith(f'.{blocked}') for blocked in DISPOSABLE_DOMAINS)


def has_mx_record(domain):
    """True if the domain publishes an MX record.

    Off by default: a DNS lookup in the request path adds latency the signup
    form feels, and a transient resolver failure would reject a perfectly good
    address. Enable with ``SIGNUP_EMAIL_MX_CHECK=true`` where the resolver is
    known-good. Fails *open* — an unavailable resolver must not block signups.
    """
    try:
        import dns.resolver  # optional dependency

        answers = dns.resolver.resolve(domain, 'MX', lifetime=3.0)
        return bool(answers)
    except ImportError:
        return True
    except Exception:
        return True


def validate_signup_email(raw):
    """Return the normalised address, or raise :class:`InvalidEmail`."""
    value = normalize_email(raw)
    if not value:
        raise InvalidEmail('Enter your email address')
    if not is_valid_format(value):
        raise InvalidEmail('Enter a valid email address')
    if is_disposable(value):
        raise InvalidEmail(
            'Temporary inboxes are not accepted — use an address you keep access to'
        )
    if os.environ.get('SIGNUP_EMAIL_MX_CHECK', 'false').lower() in ('1', 'true', 'yes'):
        if not has_mx_record(email_domain(value)):
            raise InvalidEmail('That email domain cannot receive mail')
    return value
