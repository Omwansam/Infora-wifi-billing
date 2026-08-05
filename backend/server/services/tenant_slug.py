"""Account-address slugs — the permanent ``<slug>.<app domain>`` label.

The slug is the tenant's public identity and is issued once, at signup, then
never changed: it appears in welcome emails, support tickets and (once wildcard
DNS lands) the console URL itself. That permanence is why this module is
conservative about what it will hand out.

Two classes of name are refused:

* **Reserved** — names that already mean something on the apex domain, or that
  would let a tenant impersonate the platform (``admin``, ``billing``,
  ``support``). ``webfig*`` is load-bearing rather than cosmetic: ``app.py``
  dispatches ``webfig-<id>.*`` hostnames straight into a router's WebFig
  before any other routing runs, so a tenant holding that prefix would shadow
  a real device proxy.
* **Malformed** — anything that is not a valid DNS label, because the whole
  point is that it can become one.
"""
from __future__ import annotations

import re
import unicodedata

MIN_LENGTH = 3
MAX_LENGTH = 40  # DNS labels allow 63; 40 keeps the address readable

# Valid DNS label: alphanumeric ends, hyphens allowed inside, no doubles.
_SLUG_RE = re.compile(r'^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$')

# Exact names nobody may hold.
RESERVED_SLUGS = {
    # infrastructure hostnames
    'www', 'api', 'app', 'admin', 'administrator', 'root', 'mail', 'smtp',
    'imap', 'pop', 'ftp', 'ns', 'ns1', 'ns2', 'dns', 'mx', 'cdn', 'static',
    'assets', 'media', 'files', 'download', 'downloads', 'proxy', 'gateway',
    'vpn', 'wg', 'wireguard', 'radius', 'freeradius', 'acs', 'tr069', 'cwmp',
    'webfig', 'portal', 'hotspot', 'pppoe', 'snmp', 'ldap',
    # product surfaces
    'billing', 'pay', 'payments', 'checkout', 'invoice', 'invoices', 'account',
    'accounts', 'signup', 'signin', 'login', 'logout', 'register', 'onboarding',
    'dashboard', 'console', 'settings', 'profile', 'support', 'help', 'docs',
    'documentation', 'status', 'blog', 'news', 'about', 'contact', 'legal',
    'terms', 'privacy', 'security', 'demo', 'test', 'staging', 'dev', 'sandbox',
    'internal', 'system', 'null', 'undefined',
}

# Prefixes that must not be claimable, because a *pattern* of hostnames is
# already routed. See app.py: serve_webfig_when_host_matches().
RESERVED_PREFIXES = ('webfig-', 'webfig')


class InvalidSlug(ValueError):
    """The requested account address is not usable."""


def slugify_isp_name(name):
    """Turn an ISP name into a candidate slug.

    Literally what the field promises — "we'll strip spaces and punctuation" —
    so ``Acme Networks Ltd.`` becomes ``acmenetworksltd``, not ``acme-networks-ltd``.
    Accents are folded first, so ``Café Net`` yields ``cafenet`` rather than
    something that cannot be a DNS label.

    Hyphens remain *valid* in a slug (:func:`validate_slug` accepts them) — they
    are simply never introduced on the user's behalf.
    """
    text = unicodedata.normalize('NFKD', str(name or ''))
    text = text.encode('ascii', 'ignore').decode('ascii').lower()
    text = re.sub(r'[^a-z0-9]', '', text)
    return text[:MAX_LENGTH]


def is_reserved(slug):
    value = (slug or '').lower()
    if value in RESERVED_SLUGS:
        return True
    return any(value.startswith(prefix) for prefix in RESERVED_PREFIXES)


def validate_slug(slug):
    """Raise :class:`InvalidSlug` unless ``slug`` is a well-formed, free-to-use label.

    Shape only — this does not touch the database. Callers pair it with
    :func:`is_slug_taken`.
    """
    value = (slug or '').strip().lower()
    if not value:
        raise InvalidSlug('Enter your ISP or company name')
    if len(value) < MIN_LENGTH:
        raise InvalidSlug(f'Account address must be at least {MIN_LENGTH} characters')
    if len(value) > MAX_LENGTH:
        raise InvalidSlug(f'Account address must be {MAX_LENGTH} characters or fewer')
    if not _SLUG_RE.match(value):
        raise InvalidSlug('Use letters and numbers only — hyphens allowed inside')
    if '--' in value:
        raise InvalidSlug('Account address cannot contain two hyphens in a row')
    if value.isdigit():
        raise InvalidSlug('Account address must contain at least one letter')
    if is_reserved(value):
        raise InvalidSlug('That account address is reserved — try another')
    return value


def is_slug_taken(slug, exclude_isp_id=None):
    """True if an ISP already holds this address."""
    from sqlalchemy import func

    from models import ISP

    query = ISP.query.filter(func.lower(ISP.slug) == (slug or '').lower())
    if exclude_isp_id:
        query = query.filter(ISP.id != exclude_isp_id)
    return query.first() is not None


def check_slug(slug):
    """Availability for the live check behind the step-3 field.

    Returns ``(available, normalised_or_None, message)``. Never raises — the UI
    calls this on every keystroke and wants a reason string, not an exception.
    """
    try:
        normalised = validate_slug(slug)
    except InvalidSlug as exc:
        return False, None, str(exc)

    if is_slug_taken(normalised):
        return False, normalised, 'That account address is taken — try another'
    return True, normalised, 'Available — this will be your account address.'


def suggest_slug(base, limit=25):
    """First free slug at or after ``base`` (``acme``, ``acme2``, ``acme3``…).

    Used when a name is taken and, more importantly, to settle the race at
    provisioning time: two people can pass the step-3 check with the same name
    seconds apart, and only the unique index decides who actually gets it.
    """
    root = slugify_isp_name(base) or 'isp'
    if len(root) < MIN_LENGTH:
        root = f'{root}isp'[:MAX_LENGTH]

    candidate = root
    for suffix in range(1, limit + 1):
        if suffix > 1:
            trimmed = root[:MAX_LENGTH - len(str(suffix))]
            candidate = f'{trimmed}{suffix}'
        try:
            validate_slug(candidate)
        except InvalidSlug:
            continue
        if not is_slug_taken(candidate):
            return candidate

    # Every readable variant is gone — fall back to something guaranteed free.
    import secrets
    return f'{root[:MAX_LENGTH - 7]}-{secrets.token_hex(3)}'


def base_domain():
    """Domain account addresses hang off, e.g. ``lumen.app``.

    ``TENANT_BASE_DOMAIN`` wins when set. Otherwise it is derived from the
    product's own website so the address shown at signup is branded rather than
    blank — the brand constants are the single source of naming truth, and
    hardcoding a domain here would fork it.
    """
    import os
    from urllib.parse import urlparse

    explicit = os.environ.get('TENANT_BASE_DOMAIN', '').strip().strip('.')
    if explicit:
        return explicit

    from services.brand_constants import BRAND_WEBSITE

    parsed = urlparse(BRAND_WEBSITE if '://' in BRAND_WEBSITE else f'https://{BRAND_WEBSITE}')
    host = (parsed.hostname or '').lower()
    # Addresses hang off the apex, not off www.
    return host[4:] if host.startswith('www.') else host


def account_address(slug, domain=None):
    """Full display address, e.g. ``acme.lumen.app``."""
    base = (domain or base_domain()).strip('.')
    if not base:
        return slug or ''
    if not slug:
        return base
    return f'{slug}.{base}'
