"""Mine ``/ppp secret`` comments for the data the router doesn't model.

Small ISPs put everything in the comment because RouterOS gives them nowhere
else to put it::

    John Kabete 0712345678 exp 15/08/2026
    0722000000 | Home 10M | due 2026-08-01
    Mary W. - Kiambu - paid till 30/9

There is no schema here, so this module extracts *candidates* and the wizard
shows a live preview over the operator's own comments before anything is
applied. Nothing here is ever applied silently: a bad date parse across 400
subscribers is a mass disconnection, which is the single worst outcome this
feature can produce.

Phone and date handling deliberately reuse the CSV importer's helpers so a
router import and a file import normalise identically.
"""
import re

from services.customer_import import _parse_date
from services.hotspot_credentials import normalize_phone

# Kenyan mobile shapes plus a generic international fallback: 07xx xxx xxx,
# 01xx xxx xxx, +2547xxxxxxxx, 2547xxxxxxxx.
_PHONE_RE = re.compile(r'(?<!\d)(?:\+?254|0)\s*[17]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?!\d)')
_GENERIC_PHONE_RE = re.compile(r'(?<!\d)\+?\d[\d\s.-]{7,14}\d(?!\d)')

# Dates in the shapes operators actually type. Order matters: the more specific
# ISO form is tried before the ambiguous slash forms.
_DATE_PATTERNS = (
    re.compile(r'\b(\d{4}-\d{2}-\d{2})\b'),
    re.compile(r'\b(\d{1,2}/\d{1,2}/\d{4})\b'),
    re.compile(r'\b(\d{1,2}/\d{1,2}/\d{2})\b'),
    re.compile(r'\b(\d{1,2}-\d{1,2}-\d{4})\b'),
    re.compile(r'\b(\d{1,2}\.\d{1,2}\.\d{4})\b'),
    re.compile(r'\b(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4})\b', re.I),
)

# Words that precede a date and mark it as an expiry rather than a start date.
_EXPIRY_HINTS = ('exp', 'expiry', 'expires', 'due', 'till', 'until', 'end', 'renew', 'paid')

_EMAIL_RE = re.compile(r'\b[\w.+-]+@[\w-]+\.[\w.-]+\b')

# Separators operators use between fields in one comment.
_SPLIT_RE = re.compile(r'\s*[|;,]\s*|\s+-\s+')

# Tokens that are never part of a person's name.
_NAME_STOPWORDS = {
    'exp', 'expiry', 'expires', 'due', 'till', 'until', 'paid', 'renew', 'end',
    'active', 'suspended', 'disabled', 'pppoe', 'hotspot', 'static', 'ok',
}


def extract_phone(text):
    """First plausible phone number in the text, normalised, or None."""
    if not text:
        return None
    for pattern in (_PHONE_RE, _GENERIC_PHONE_RE):
        match = pattern.search(text)
        if not match:
            continue
        try:
            normalised = normalize_phone(match.group(0))
        except Exception:  # noqa: BLE001 — a bad comment must not break a scan
            normalised = None
        if normalised:
            return normalised
    return None


def extract_email(text):
    match = _EMAIL_RE.search(text or '')
    return match.group(0).lower() if match else None


def extract_date(text):
    """(datetime, matched_text, looks_like_expiry) for the first date found.

    ``looks_like_expiry`` is True when an expiry keyword appears within the ~12
    characters before the date — the difference between "joined 15/08" and
    "exp 15/08", which decides whether it may drive ``subscription_end``.
    """
    if not text:
        return None, None, False
    for pattern in _DATE_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        raw = match.group(1)
        parsed, error = _parse_date(raw)
        if error or not parsed:
            continue
        prefix = text[max(0, match.start() - 12):match.start()].lower()
        is_expiry = any(hint in prefix for hint in _EXPIRY_HINTS)
        return parsed, raw, is_expiry
    return None, None, False


def extract_name(text, drop=()):
    """Best-guess human name: the longest alphabetic fragment left over.

    ``drop`` holds substrings already claimed by another field (the phone, the
    date) so they are removed before guessing.
    """
    if not text:
        return None
    residue = text
    for token in drop:
        if token:
            residue = residue.replace(token, ' ')
    best = None
    for fragment in _SPLIT_RE.split(residue):
        words = [
            w for w in re.split(r'\s+', fragment.strip())
            if w and w.lower().strip('.') not in _NAME_STOPWORDS
            and re.search(r'[A-Za-z]', w)
            and not re.search(r'\d', w)
        ]
        if not words:
            continue
        candidate = ' '.join(words).strip(' .-')
        # A name is two-ish words of letters; prefer the longest such fragment.
        if candidate and (best is None or len(candidate) > len(best)):
            best = candidate
    if not best or len(best) < 2:
        return None
    return best


def mine_comment(comment):
    """Extract {name, phone, email, expiry} candidates from one comment.

    Every field is independently optional. Returns None values rather than
    guessing, and includes ``expiry_is_explicit`` so the caller can require a
    keyword before letting a mined date drive a subscription end.
    """
    text = (comment or '').strip()
    result = {
        'raw': text or None,
        'name': None,
        'phone': None,
        'email': None,
        'expiry': None,
        'expiry_raw': None,
        'expiry_is_explicit': False,
    }
    if not text:
        return result

    phone_match = _PHONE_RE.search(text) or _GENERIC_PHONE_RE.search(text)
    result['phone'] = extract_phone(text)
    result['email'] = extract_email(text)
    expiry, expiry_raw, explicit = extract_date(text)
    result['expiry'] = expiry
    result['expiry_raw'] = expiry_raw
    result['expiry_is_explicit'] = explicit
    result['name'] = extract_name(
        text,
        drop=(
            phone_match.group(0) if phone_match else None,
            expiry_raw,
            result['email'],
        ),
    )
    return result


def preview(comments, limit=20):
    """Mine a sample of real comments so the operator can judge the rules.

    Returns ``{'rows': [...], 'stats': {...}}`` — the wizard renders the rows as
    a before/after table and the stats as "phone found in 361 of 412".
    """
    sample = [c for c in (comments or []) if (c or '').strip()][:limit]
    rows = []
    for comment in sample:
        mined = mine_comment(comment)
        rows.append({
            'comment': comment,
            'name': mined['name'],
            'phone': mined['phone'],
            'email': mined['email'],
            'expiry': mined['expiry'].date().isoformat() if mined['expiry'] else None,
            'expiry_is_explicit': mined['expiry_is_explicit'],
        })

    total = sum(1 for c in (comments or []) if (c or '').strip())
    stats = {'total_with_comment': total, 'name': 0, 'phone': 0, 'email': 0, 'expiry': 0}
    for comment in (comments or []):
        if not (comment or '').strip():
            continue
        mined = mine_comment(comment)
        for field in ('name', 'phone', 'email', 'expiry'):
            if mined[field]:
                stats[field] += 1
    return {'rows': rows, 'stats': stats}
