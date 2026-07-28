"""Normalise scanned sections into subscriber candidates and package drafts.

Input is whatever the transports produced (``{section_key: [record, ...]}``);
output is the reviewable middle layer the operator edits before anything is
written: a list of candidates and a list of package drafts, joined by profile
name.

Nothing here touches the database. That keeps the whole "what did this router
tell us" question testable from fixtures, and it means a scan can be re-parsed
from its stored raw blob without going back to the router.
"""
from .comments import mine_comment
from .profiles import parse_queue_target, parse_rate_limit, profile_to_draft

_TRUE = ('true', 'yes', '1')

# RouterOS ships placeholder entries in the same menus real subscribers live in.
# The clearest case is `default-trial` in /ip hotspot user: flagged `default=true`,
# it holds trial counters and has no `password` property at all. Imported blind it
# became a phantom client — and then made the password check report the entire
# roster as unreadable, which produced a blocking "add the sensitive policy"
# warning on a router whose scan user already had it. Filter on the properties
# rather than on names: `default`/`dynamic` are authoritative and version-stable.
BUILTIN_NAMES = {'default', 'default-encryption', 'default-trial'}


def _is_true(value):
    return str(value or '').strip().lower() in _TRUE


def is_builtin(record):
    """True for a RouterOS-supplied placeholder rather than a real entry.

    `dynamic=true` covers runtime-generated rows (a dynamic hotspot user, a queue
    RouterOS made for a PPP session) which are equally not subscribers. The name
    set is a fallback for `/export` input, where built-ins are omitted entirely
    and these properties therefore never appear.
    """
    if _is_true(record.get('default')) or _is_true(record.get('dynamic')):
        return True
    return (record.get('name') or '').strip().lower() in BUILTIN_NAMES


def _norm_login(value):
    return (value or '').strip().lower() or None


def _looks_like_ip(value):
    """True for a bare IPv4 — distinguishes a static address from a pool name."""
    parts = (value or '').split('.')
    if len(parts) != 4:
        return False
    try:
        return all(0 <= int(p) <= 255 for p in parts)
    except ValueError:
        return False


def _active_index(sections):
    """login -> live session record, for the `online` flag and live addresses."""
    index = {}
    for row in sections.get('ppp_active') or []:
        login = _norm_login(row.get('name'))
        if login:
            index[login] = row
    return index


def build_pppoe_candidates(sections, mine_comments=True):
    """One candidate per ``/ppp secret``.

    ``remote-address`` is only carried through as a static IP when it is an
    actual address — on most routers it names a pool, and writing a pool name
    into ``Framed-IP-Address`` would break every session it touched.
    """
    active = _active_index(sections)
    candidates = []
    for row in sections.get('ppp_secrets') or []:
        login = _norm_login(row.get('name'))
        if not login or is_builtin(row):
            continue
        remote = (row.get('remote-address') or '').strip()
        static_ip = remote if _looks_like_ip(remote) else None
        session = active.get(login)
        mined = mine_comment(row.get('comment')) if mine_comments else {}

        candidates.append({
            'kind': 'pppoe',
            'login': login,
            'password': (row.get('password') or '').strip() or None,
            'name': mined.get('name') or login,
            'phone': mined.get('phone'),
            'email': mined.get('email'),
            'profile_name': (row.get('profile') or '').strip() or None,
            'service': (row.get('service') or '').strip() or None,
            'static_ip': static_ip,
            'pool_name': None if static_ip else (remote or None),
            'mac': (row.get('caller-id') or '').strip().upper() or None,
            'disabled': _is_true(row.get('disabled')),
            'comment': row.get('comment'),
            'online': bool(session),
            'online_address': (session or {}).get('address'),
            'last_seen': row.get('last-logged-out'),
            'mined_expiry': mined.get('expiry'),
            'mined_expiry_explicit': bool(mined.get('expiry_is_explicit')),
            'raw': row,
        })
    return candidates


def build_hotspot_candidates(sections, mine_comments=True):
    """One candidate per ``/ip hotspot user``.

    MAC-only users are legitimate: hotspot identity can be the MAC rather than a
    login/password pair, and those import as a ``Calling-Station-Id`` check.
    """
    candidates = []
    for row in sections.get('hotspot_users') or []:
        login = _norm_login(row.get('name'))
        mac = (row.get('mac-address') or '').strip().upper() or None
        if (not login and not mac) or is_builtin(row):
            continue
        mined = mine_comment(row.get('comment')) if mine_comments else {}
        candidates.append({
            'kind': 'hotspot',
            'login': login or mac,
            'password': (row.get('password') or '').strip() or None,
            'name': mined.get('name') or login or mac,
            'phone': mined.get('phone'),
            'email': mined.get('email'),
            'profile_name': (row.get('profile') or '').strip() or None,
            'service': 'hotspot',
            'static_ip': (row.get('address') or '').strip() or None,
            'pool_name': None,
            'mac': mac,
            'disabled': _is_true(row.get('disabled')),
            'comment': row.get('comment'),
            'online': False,
            'online_address': None,
            'last_seen': None,
            'mined_expiry': mined.get('expiry'),
            'mined_expiry_explicit': bool(mined.get('expiry_is_explicit')),
            'raw': row,
        })
    return candidates


def build_static_candidates(sections, mine_comments=True):
    """Candidates for queue-billed / static-IP subscribers.

    These have no login and never authenticate, so they can be *billed* but not
    *enforced* — Infora's enforcement is entirely RADIUS. They are built here so
    the operator can still get their invoicing and M-Pesa account references, and
    every one carries ``enforceable=False`` so the UI can say so out loud rather
    than letting it be discovered when a non-payer isn't cut off.
    """
    leases = {}
    for row in sections.get('dhcp_leases') or []:
        address = (row.get('address') or '').strip()
        if address and not _is_true(row.get('dynamic')):
            leases[address] = row

    candidates = []
    for row in sections.get('queues') or []:
        ip, label = parse_queue_target(row)
        if not ip or is_builtin(row):
            continue
        lease = leases.get(ip, {})
        comment = row.get('comment') or lease.get('comment')
        mined = mine_comment(comment) if mine_comments else {}
        rate = parse_rate_limit(row.get('max-limit'))
        candidates.append({
            'kind': 'static',
            'login': None,
            'password': None,
            'name': mined.get('name') or label or lease.get('host-name') or ip,
            'phone': mined.get('phone'),
            'email': mined.get('email'),
            'profile_name': None,
            'service': 'static',
            'static_ip': ip,
            'pool_name': None,
            'mac': (lease.get('mac-address') or '').strip().upper() or None,
            'disabled': _is_true(row.get('disabled')),
            'comment': comment,
            'online': False,
            'online_address': ip,
            'last_seen': None,
            'mined_expiry': mined.get('expiry'),
            'mined_expiry_explicit': bool(mined.get('expiry_is_explicit')),
            'enforceable': False,
            'rate_limit': rate,
            'raw': row,
        })
    return candidates


def build_orphan_candidates(sections):
    """Live sessions with no matching secret — the delegated-auth roster.

    On a router whose auth is delegated to a foreign RADIUS, ``/ppp secret`` is
    empty and this is the only roster available: who is connected, on what
    address, from what MAC. No password, by definition.
    """
    known = {_norm_login(r.get('name')) for r in sections.get('ppp_secrets') or []}
    candidates = []
    for row in sections.get('ppp_active') or []:
        login = _norm_login(row.get('name'))
        if not login or login in known:
            continue
        candidates.append({
            'kind': 'pppoe',
            'login': login,
            'password': None,
            'name': login,
            'phone': None,
            'email': None,
            'profile_name': None,
            'service': (row.get('service') or 'pppoe'),
            'static_ip': None,
            'pool_name': None,
            'mac': (row.get('caller-id') or '').strip().upper() or None,
            'disabled': False,
            'comment': None,
            'online': True,
            'online_address': row.get('address'),
            'last_seen': None,
            'mined_expiry': None,
            'mined_expiry_explicit': False,
            'from_live_session': True,
            'raw': row,
        })
    return candidates


def build_package_drafts(sections, candidates):
    """Package drafts from the profiles, with subscriber counts attached.

    Counting matters more than it looks: the pricing step is sorted by it, and a
    profile with 187 subscribers deserves the operator's attention before one
    with 2.
    """
    drafts = {}
    for row in sections.get('ppp_profiles') or []:
        name = (row.get('name') or '').strip()
        if name:
            drafts[name.lower()] = profile_to_draft(row, kind='pppoe')
    for row in sections.get('hotspot_profiles') or []:
        name = (row.get('name') or '').strip()
        if name and name.lower() not in drafts:
            drafts[name.lower()] = profile_to_draft(row, kind='hotspot')

    for candidate in candidates:
        profile = (candidate.get('profile_name') or '').strip().lower()
        if profile and profile in drafts:
            drafts[profile]['subscriber_count'] += 1

    # A profile referenced by subscribers but absent from the profile list — it
    # happens on exports taken with a filter. Synthesise it so those rows are
    # importable rather than silently dropped.
    for candidate in candidates:
        profile = (candidate.get('profile_name') or '').strip()
        if profile and profile.lower() not in drafts:
            draft = profile_to_draft({'name': profile}, kind=candidate.get('kind', 'pppoe'))
            draft['warnings'].append('Referenced by subscribers but not found in the profile list')
            draft['subscriber_count'] = 1
            drafts[profile.lower()] = draft

    ordered = sorted(drafts.values(), key=lambda d: (-d['subscriber_count'], d['name'].lower()))
    # Anything with real subscribers should default to being created even if it
    # carries no rate-limit — skipping it would drop those people.
    for draft in ordered:
        if draft['subscriber_count'] and draft['decision'] == 'skip' and not draft['is_stock']:
            draft['decision'] = 'create'
    return ordered


def build_inventory(sections, mine_comments=True, include_static=True,
                    include_orphans=True):
    """Full normalisation pass: candidates + package drafts + address plan."""
    candidates = build_pppoe_candidates(sections, mine_comments)
    candidates += build_hotspot_candidates(sections, mine_comments)
    if include_orphans:
        candidates += build_orphan_candidates(sections)
    if include_static:
        candidates += build_static_candidates(sections, mine_comments)

    drafts = build_package_drafts(sections, candidates)

    pools = [
        {'name': r.get('name'), 'ranges': r.get('ranges'), 'next_pool': r.get('next-pool')}
        for r in sections.get('pools') or [] if r.get('name')
    ]
    return {
        'candidates': candidates,
        'packages': drafts,
        'pools': pools,
        'counts': {
            'total': len(candidates),
            'pppoe': sum(1 for c in candidates if c['kind'] == 'pppoe'),
            'hotspot': sum(1 for c in candidates if c['kind'] == 'hotspot'),
            'static': sum(1 for c in candidates if c['kind'] == 'static'),
            'with_password': sum(1 for c in candidates if c.get('password')),
            'online': sum(1 for c in candidates if c.get('online')),
            'disabled': sum(1 for c in candidates if c.get('disabled')),
            'packages': len(drafts),
        },
    }
