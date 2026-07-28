"""Work out what kind of router we are looking at, and which import path applies.

This is the first screen the operator sees after a scan, and it is the answer to
"how do I look at the system before I touch it". It is cheap — everything here is
derived from the sections the scan already collected — but it decides the entire
rest of the flow, because the two worlds behave completely differently:

* **local auth** — secrets live on the router, passwords are readable, a
  zero-touch import is possible;
* **delegated auth** — the router asks a foreign RADIUS server, and **no amount
  of scanning will produce a password**. That is a physical limit, not a missing
  feature, and saying so plainly here saves the operator a day of confusion.
"""

# Substrings in script/scheduler/file names that betray a particular incumbent.
_VENDOR_SIGNS = (
    ('splynx', 'Splynx'),
    ('centipede', 'Centipede'),
    ('ucrm', 'UISP / UCRM'),
    ('unms', 'UISP / UCRM'),
    ('powercode', 'Powercode'),
    ('radiusmanager', 'Radius Manager'),
    ('daloradius', 'daloRADIUS'),
    ('freeside', 'Freeside'),
    ('smartolt', 'SmartOLT'),
    ('ispadmin', 'ISPadmin'),
    ('mikhmon', 'Mikhmon'),
    ('glass', 'GlassBilling'),
)

_TRUE = ('true', 'yes', '1')


def _is_true(value):
    return str(value or '').strip().lower() in _TRUE


def _first(records):
    return records[0] if records else {}


def _count(sections, key):
    return len(sections.get(key) or [])


def _active_radius_servers(sections):
    """Foreign RADIUS entries, excluding any we placed ourselves."""
    servers = []
    for row in sections.get('radius') or []:
        comment = (row.get('comment') or '').lower()
        if 'infora' in comment:
            continue
        if _is_true(row.get('disabled')):
            continue
        servers.append({
            'address': row.get('address'),
            'service': row.get('service'),
            'comment': row.get('comment'),
        })
    return servers


def detect_vendor(sections):
    """Guess the incumbent billing system from scripts, schedulers and comments."""
    haystack = []
    for key in ('scripts', 'schedulers'):
        for row in sections.get(key) or []:
            haystack.append(' '.join(str(v) for v in row.values() if v))
    for row in sections.get('radius') or []:
        haystack.append(str(row.get('comment') or ''))
    blob = ' '.join(haystack).lower()
    for needle, label in _VENDOR_SIGNS:
        if needle in blob:
            return label
    return None


def detect_expiry_automation(sections):
    """Scheduler entries that look like home-grown expiry enforcement.

    A scheduler whose ``on-event`` disables a PPP secret or moves an address-list
    entry *is* the incumbent billing system, and it is usually where the due
    dates live. Worth surfacing: it tells the operator what will keep running
    after cutover if they don't remove it.
    """
    hits = []
    for row in sections.get('schedulers') or []:
        event = (row.get('on-event') or '').lower()
        if not event:
            continue
        if ('secret' in event and 'disable' in event) or 'address-list' in event:
            hits.append({
                'name': row.get('name'),
                'interval': row.get('interval'),
                'start_time': row.get('start-time'),
                'comment': row.get('comment'),
            })
    return hits


def scan_user_can_read_secrets(sections, username=None):
    """Whether the connecting user's group carries the ``sensitive`` policy.

    Returns (verdict, detail) where verdict is True / False / None (unknown —
    the menus weren't readable, which is itself normal on some groups).

    This exists because guessing was wrong in production: the diagnosis blamed a
    missing ``sensitive`` policy on a router whose scan user was in ``full``,
    which already grants it. Reading ``/user`` and ``/user group`` turns a scary
    inference into a checkable fact.
    """
    users = sections.get('router_users') or []
    groups = {(g.get('name') or '').strip(): (g.get('policy') or '')
              for g in sections.get('router_groups') or []}
    if not users or not groups:
        return None, 'Could not read the router user list to confirm.'

    target = (username or '').strip().lower()
    row = None
    if target:
        row = next((u for u in users if (u.get('name') or '').strip().lower() == target), None)
    if row is None:
        return None, 'Could not identify which router user the scan connected as.'

    group_name = (row.get('group') or '').strip()
    policy = groups.get(group_name, '')
    if not policy:
        return None, f'Could not read the policy list for group {group_name!r}.'
    has = 'sensitive' in [p.strip() for p in policy.split(',')]
    if has:
        return True, f'Scan user {row.get("name")!r} is in group {group_name!r}, which grants "sensitive".'
    return False, (
        f'Scan user {row.get("name")!r} is in group {group_name!r}, which does NOT grant the '
        '"sensitive" policy — RouterOS therefore returns every password as empty. '
        f'Fix on the router: /user group set {group_name} policy=({policy},sensitive)'
    )


def password_readability(sections, scan_username=None):
    """Can we actually read subscriber passwords, and if not, why not?

    The failure this exists to catch: a scan user without the RouterOS
    ``sensitive`` policy gets names back but every password empty. Imported
    blind, that generates new passwords for everyone and breaks every CPE on the
    network. So an all-blank roster is reported as a **blocking** condition.

    Built-ins are excluded from the roster first. RouterOS's ``default-trial``
    hotspot entry has no ``password`` property at all, so counting it made a
    router with *zero* subscribers report its whole roster as unreadable — a
    blocking, wrong, alarming message. An empty roster is "no subscribers", never
    "passwords are hidden".
    """
    from .inventory import is_builtin

    secrets = [r for r in (sections.get('ppp_secrets') or []) if not is_builtin(r)]
    hotspot = [r for r in (sections.get('hotspot_users') or []) if not is_builtin(r)]
    roster = secrets + hotspot
    if not roster:
        return {'state': 'no-roster', 'with_password': 0, 'total': 0, 'blocking': False,
                'detail': 'No subscribers are configured on this router.'}

    with_password = sum(1 for r in roster if (r.get('password') or '').strip())
    total = len(roster)
    if with_password == 0:
        can_read, why = scan_user_can_read_secrets(sections, scan_username)
        if can_read is False:
            cause = why
        elif can_read is True:
            # The policy is present, so the blank passwords have another cause —
            # most often a v7 /export taken without show-sensitive.
            cause = (
                f'{why} So the blanks are not a permissions problem — if this came from an '
                'uploaded export, re-run it as "/export show-sensitive".'
            )
        else:
            cause = (
                'The likely cause is a scan user without the RouterOS "sensitive" policy, '
                'or a RouterOS v7 /export taken without show-sensitive.'
            )
        return {
            'state': 'hidden',
            'with_password': 0,
            'total': total,
            'blocking': True,
            'detail': (
                f'{total} subscribers found but every password came back empty. {cause} '
                'Importing now would generate new passwords and break every CPE.'
            ),
        }
    if with_password < total:
        return {
            'state': 'partial',
            'with_password': with_password,
            'total': total,
            'blocking': False,
            'detail': (
                f'{with_password} of {total} subscribers have a readable password; '
                f'the remaining {total - with_password} will need new credentials.'
            ),
        }
    return {
        'state': 'readable',
        'with_password': with_password,
        'total': total,
        'blocking': False,
        'detail': f'All {total} subscriber passwords are readable — a zero-touch import is possible.',
    }


def _real_count(sections, key):
    """Count entries in a section, excluding RouterOS built-ins/placeholders."""
    from .inventory import is_builtin
    return sum(1 for r in (sections.get(key) or []) if not is_builtin(r))


def fingerprint(sections, scan_username=None):
    """Build the Router profile card from a scanned inventory.

    Returns the counts, the detected auth mode, the recommended import path and
    a list of plain-sentence findings the UI renders verbatim.

    Every subscriber count here excludes built-ins. Counting RouterOS's stock
    ``default-trial`` entry once made a router with no subscribers at all
    classify as ``local`` and report a phantom client.
    """
    resource = _first(sections.get('system_resource') or [])
    identity = _first(sections.get('system_identity') or [])
    aaa = _first(sections.get('ppp_aaa') or [])

    secret_count = _real_count(sections, 'ppp_secrets')
    hotspot_user_count = _real_count(sections, 'hotspot_users')
    queue_count = _real_count(sections, 'queues')
    active_count = _count(sections, 'ppp_active')   # live sessions are never built-in
    um_count = _real_count(sections, 'user_manager')

    foreign_radius = _active_radius_servers(sections)
    use_radius = _is_true(aaa.get('use-radius'))
    has_local = bool(secret_count or hotspot_user_count or um_count)

    if foreign_radius and use_radius and not has_local:
        auth_mode = 'delegated'
    elif foreign_radius and has_local:
        auth_mode = 'hybrid'
    elif has_local:
        auth_mode = 'local'
    elif queue_count:
        auth_mode = 'queue-billed'
    else:
        auth_mode = 'unknown'

    passwords = password_readability(sections, scan_username)
    vendor = detect_vendor(sections)
    automation = detect_expiry_automation(sections)

    fasttrack = any(
        (row.get('action') or '') == 'fasttrack-connection' and not _is_true(row.get('disabled'))
        for row in sections.get('firewall_filter') or []
    )

    # Describe what is actually there, per kind. The old wording hardcoded
    # "PPPoE" off the secret count while the roster also held hotspot users, so
    # a hotspot-only router read "authenticates 0 PPPoE subscribers" directly
    # above "1 subscribers found".
    parts = []
    if secret_count:
        parts.append(f'{secret_count} PPPoE subscriber{"s" if secret_count != 1 else ""}')
    if hotspot_user_count:
        parts.append(f'{hotspot_user_count} hotspot user{"s" if hotspot_user_count != 1 else ""}')
    if um_count:
        parts.append(f'{um_count} User-Manager account{"s" if um_count != 1 else ""}')
    roster_phrase = ', '.join(parts) if parts else 'no subscribers'

    findings = []
    if auth_mode == 'local':
        findings.append(
            f'This router authenticates {roster_phrase} from its own database. '
            'Nothing here talks to an external billing system.'
        )
    elif auth_mode == 'delegated':
        where = ', '.join(s['address'] for s in foreign_radius if s.get('address')) or 'an external server'
        findings.append(
            f'Authentication is delegated to RADIUS at {where}'
            + (f' ({vendor})' if vendor else '')
            + '. The subscriber roster can be recovered from live sessions, but '
              'passwords are not stored on this router and cannot be scanned.'
        )
    elif auth_mode == 'hybrid':
        findings.append(
            f'Mixed setup: {secret_count} local secrets plus an external RADIUS server. '
            'Local subscribers import cleanly; the rest need credentials from the old system.'
        )
    elif auth_mode == 'queue-billed':
        findings.append(
            f'No PPPoE or hotspot users — {queue_count} simple queues instead. This is a '
            'static/queue-billed network: subscribers can be imported for billing, but '
            'Infora enforces via RADIUS and will not be able to disconnect them.'
        )
    else:
        findings.append(
            'No subscribers, external RADIUS server or billing queues found on this router — '
            'there is nothing here to import.'
        )

    if passwords['blocking']:
        findings.append(passwords['detail'])
    if automation:
        findings.append(
            f'{len(automation)} scheduled script(s) look like home-grown expiry enforcement — '
            'they will keep running after cutover unless removed.'
        )
    if fasttrack:
        findings.append(
            'A FastTrack rule is active. It bypasses the accounting path, so usage and FUP '
            'will be wrong until cutover removes it.'
        )
    if active_count:
        findings.append(f'{active_count} subscribers are online right now.')

    recommended = {
        'local': 'router-scan',
        'hybrid': 'router-scan-plus-csv',
        'delegated': 'csv-merge',
        'queue-billed': 'router-scan-billing-only',
        'unknown': 'csv',
    }[auth_mode]

    return {
        'device': {
            'identity': identity.get('name'),
            'model': resource.get('board-name'),
            'version': resource.get('version'),
            'architecture': resource.get('architecture-name'),
            'uptime': resource.get('uptime'),
        },
        'auth_mode': auth_mode,
        'use_radius': use_radius,
        'foreign_radius': foreign_radius,
        'vendor': vendor,
        'passwords': passwords,
        'expiry_automation': automation,
        'fasttrack_present': fasttrack,
        'counts': {
            'ppp_secrets': secret_count,
            'ppp_active': active_count,
            'hotspot_users': hotspot_user_count,
            'user_manager': um_count,
            'queues': queue_count,
            'ppp_profiles': _count(sections, 'ppp_profiles'),
            'hotspot_profiles': _count(sections, 'hotspot_profiles'),
            'dhcp_leases': _count(sections, 'dhcp_leases'),
            'pools': _count(sections, 'pools'),
        },
        'recommended_path': recommended,
        'findings': findings,
        'blocking': passwords['blocking'],
    }
