"""Turn RouterOS profiles and queues into ServicePlan drafts.

The direction convention is the thing to get right here, and it is easy to get
backwards. For ``/ppp profile rate-limit``, ``/queue simple max-limit`` and the
``Mikrotik-Rate-Limit`` RADIUS attribute alike, the value reads
**upload-first, from the client's point of view**::

    rate-limit=5M/20M   ->  client uploads at 5 Mbps, downloads at 20 Mbps

So ``5M/20M`` is a 20 Mbps package, not a 5 Mbps one. Inverting this turns every
imported package into an upload-heavy mutant and nobody notices until customers
complain, which is why :func:`parse_rate_limit` keeps both numbers explicitly
labelled and the wizard shows ``↓20M ↑5M`` rather than the raw string.
"""
import re

# rate-limit=rx-rate[/tx-rate [rx-burst-rate/tx-burst-rate
#            [rx-burst-threshold/tx-burst-threshold
#            [rx-burst-time/tx-burst-time [priority [rx-rate-min/tx-rate-min]]]]]]
# rx = client upload, tx = client download.
_UNIT_MULTIPLIERS = {
    '': 1,
    'b': 1,
    'k': 1_000,
    'ki': 1_024,
    'm': 1_000_000,
    'mi': 1_048_576,
    'g': 1_000_000_000,
    'gi': 1_073_741_824,
}

_RATE_RE = re.compile(r'^\s*(\d+(?:\.\d+)?)\s*([kmgKMG]i?)?\s*$')


def parse_bits(value):
    """``'512k'`` → 512000, ``'2M'`` → 2000000, ``'10000000'`` → 10000000.

    Returns None for anything unparseable — including RouterOS's ``unlimited``
    and an empty string — so callers can distinguish "no limit" from "0".
    """
    if value is None:
        return None
    match = _RATE_RE.match(str(value))
    if not match:
        return None
    number, unit = match.group(1), (match.group(2) or '').lower()
    try:
        return int(float(number) * _UNIT_MULTIPLIERS.get(unit, 1))
    except (ValueError, TypeError):
        return None


def bits_to_mbps(bits):
    """Bits/sec → Mbps as a float, or None."""
    if not bits:
        return None
    return round(bits / 1_000_000, 3)


def _pair(token):
    """Split an ``rx/tx`` pair into (rx_bits, tx_bits); a bare value is both."""
    if not token:
        return None, None
    if '/' in token:
        rx, _, tx = token.partition('/')
        return parse_bits(rx), parse_bits(tx)
    single = parse_bits(token)
    return single, single


def parse_rate_limit(value):
    """Parse a RouterOS rate-limit string into labelled speeds.

    Returns a dict with ``upload_mbps`` / ``download_mbps`` (the two that matter),
    the burst triple where present, and the untouched ``raw`` for audit. An
    unset or ``unlimited`` rate-limit yields all-None rather than zeroes — a
    profile with no limit is a real thing (the stock ``default`` profile) and
    must not be imported as a 0 Mbps package.
    """
    result = {
        'raw': (value or None),
        'upload_mbps': None,
        'download_mbps': None,
        'burst_upload_mbps': None,
        'burst_download_mbps': None,
        'burst_threshold_upload_mbps': None,
        'burst_threshold_download_mbps': None,
        'burst_time_seconds': None,
        'priority': None,
    }
    text = (value or '').strip()
    if not text or text.lower() in ('unlimited', 'none', '0', '0/0'):
        return result

    parts = text.split()
    rx, tx = _pair(parts[0])
    # A bare `rate-limit=2M` limits upload only in RouterOS terms, but operators
    # overwhelmingly mean "2M both ways" when they write it. Mirror it, and note
    # that the wizard lets the operator correct any profile it gets wrong.
    result['upload_mbps'] = bits_to_mbps(rx)
    result['download_mbps'] = bits_to_mbps(tx if tx is not None else rx)

    if len(parts) > 1:
        brx, btx = _pair(parts[1])
        result['burst_upload_mbps'] = bits_to_mbps(brx)
        result['burst_download_mbps'] = bits_to_mbps(btx)
    if len(parts) > 2:
        trx, ttx = _pair(parts[2])
        result['burst_threshold_upload_mbps'] = bits_to_mbps(trx)
        result['burst_threshold_download_mbps'] = bits_to_mbps(ttx)
    if len(parts) > 3:
        times = parts[3].split('/')
        try:
            result['burst_time_seconds'] = int(float(times[0]))
        except (ValueError, TypeError):
            pass
    if len(parts) > 4:
        try:
            result['priority'] = int(parts[4].split('/')[0])
        except (ValueError, TypeError):
            pass
    return result


def _int_mbps(mbps):
    """ServicePlan.bandwidth_limit is an integer Mbps column.

    Sub-megabit packages (``512k``) are real in rural deployments, so floor them
    at 1 Mbps for the column and keep the exact figure in ``features`` — better a
    slightly generous rate-limit than a 0 that reads as "no limit" downstream.
    """
    if not mbps:
        return None
    return max(1, int(round(mbps)))


def parse_data_cap_bytes(value):
    """``limit-bytes-total`` → GB (float), or None."""
    raw = parse_bits(value)  # same unit grammar, bytes not bits
    if not raw:
        return None
    return round(raw / (1024 ** 3), 4)


# Stock RouterOS profiles that are configuration, not packages. Importing these
# as 0-price packages with real subscribers attached is exactly the quiet mess
# the pricing step exists to prevent, so they default to skipped.
#
# The names are the fallback for `/export` input (which omits built-ins, so the
# properties never appear); a live scan carries `default=true`, which is
# authoritative and survives RouterOS renaming its stock entries.
STOCK_PROFILE_NAMES = {'default', 'default-encryption', 'default-trial'}
_TRUTHY = ('true', 'yes', '1')


def _is_stock(record):
    name = (record.get('name') or '').strip().lower()
    if str(record.get('default') or '').strip().lower() in _TRUTHY:
        return True
    if str(record.get('dynamic') or '').strip().lower() in _TRUTHY:
        return True
    return name in STOCK_PROFILE_NAMES


def profile_to_draft(record, kind='pppoe'):
    """Turn one parsed profile record into a package draft for the wizard.

    The draft is deliberately *not* a ServicePlan — price and billing cycle are
    not on the router, so the operator supplies them in the pricing step before
    anything is created.
    """
    name = (record.get('name') or '').strip()
    rate = parse_rate_limit(record.get('rate-limit'))
    is_stock = _is_stock(record)
    has_speed = bool(rate['download_mbps'])

    draft = {
        'name': name,
        'kind': kind,
        'rate_limit_raw': rate['raw'],
        'upload_mbps': rate['upload_mbps'],
        'download_mbps': rate['download_mbps'],
        'burst': {
            'upload_mbps': rate['burst_upload_mbps'],
            'download_mbps': rate['burst_download_mbps'],
            'threshold_upload_mbps': rate['burst_threshold_upload_mbps'],
            'threshold_download_mbps': rate['burst_threshold_download_mbps'],
            'time_seconds': rate['burst_time_seconds'],
        },
        'remote_address': record.get('remote-address'),
        'local_address': record.get('local-address'),
        'session_timeout': record.get('session-timeout'),
        'shared_users': record.get('shared-users'),
        'data_cap_gb': parse_data_cap_bytes(record.get('limit-bytes-total')),
        'comment': record.get('comment'),
        # Operator-supplied in the pricing step — never guessed.
        'price': None,
        'billing_cycle_days': 30,
        'subscriber_count': 0,
        'is_stock': is_stock,
        'has_speed': has_speed,
        # Default decision: skip anything that is stock or carries no speed,
        # import everything else.
        'decision': 'skip' if (is_stock or not has_speed) else 'create',
        'warnings': [],
    }
    if is_stock:
        draft['warnings'].append(
            'RouterOS stock profile — usually configuration, not a package'
        )
    if not has_speed:
        draft['warnings'].append('No rate-limit set — speed must be entered manually')
    return draft


def plan_features(draft):
    """Build the ``ServicePlan.features`` JSON for a priced draft.

    Populates the keys ``services.plan_utils`` already reads back
    (``upload_speed_mbps``, ``burst_*``) so an imported package behaves like a
    hand-built one everywhere downstream.
    """
    features = {}
    if draft.get('upload_mbps'):
        features['upload_speed_mbps'] = draft['upload_mbps']
    if draft.get('download_mbps'):
        features['download_speed_mbps'] = draft['download_mbps']
    burst = draft.get('burst') or {}
    if burst.get('download_mbps'):
        features['burst_speed_mbps'] = burst['download_mbps']
    if burst.get('time_seconds'):
        features['burst_time_seconds'] = burst['time_seconds']
    if draft.get('rate_limit_raw'):
        features['imported_rate_limit'] = draft['rate_limit_raw']
    features['imported_from_router'] = True
    return features


def draft_to_plan_kwargs(draft, isp_id):
    """Keyword arguments for constructing a ServicePlan from a priced draft."""
    download = draft.get('download_mbps')
    speed_label = f"{int(download)}M" if download and download == int(download) else (
        f'{download}M' if download else (draft.get('rate_limit_raw') or 'Imported')
    )
    return {
        'name': draft['name'],
        'speed': speed_label,
        'price': draft.get('price') or 0,
        'features': plan_features(draft),
        'plan_type': 'hotspot' if draft.get('kind') == 'hotspot' else 'pppoe',
        'bandwidth_limit': _int_mbps(download),
        'data_limit': int(draft['data_cap_gb']) if draft.get('data_cap_gb') else None,
        'billing_cycle_days': draft.get('billing_cycle_days') or 30,
        'isp_id': isp_id,
        'is_active': True,
        'description': f"Imported from router profile {draft['name']!r}",
    }


def parse_queue_target(record):
    """Best-effort subscriber identity from a ``/queue simple`` row.

    Queue-billed ISPs key on the client IP (``target=10.0.0.14/32``) and put the
    human name in the queue name or comment. Returns (ip, label).
    """
    target = (record.get('target') or '').split(',')[0].strip()
    ip = target.split('/')[0] if target else None
    label = (record.get('name') or '').strip() or (record.get('comment') or '').strip()
    return ip or None, label or None
