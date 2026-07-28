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


def password_readability(sections):
    """Can we actually read subscriber passwords, and if not, why not?

    The failure this exists to catch: a scan user without the RouterOS
    ``sensitive`` policy gets names back but every password empty. Imported
    blind, that generates 400 new passwords and breaks every CPE on the network.
    So an all-blank roster is reported as a **blocking** condition, not a
    footnote.
    """
    secrets = sections.get('ppp_secrets') or []
    hotspot = sections.get('hotspot_users') or []
    roster = secrets + hotspot
    if not roster:
        return {'state': 'no-roster', 'with_password': 0, 'total': 0, 'blocking': False,
                'detail': 'No local subscriber database on this router.'}

    with_password = sum(1 for r in roster if (r.get('password') or '').strip())
    total = len(roster)
    if with_password == 0:
        return {
            'state': 'hidden',
            'with_password': 0,
            'total': total,
            'blocking': True,
            'detail': (
                f'{total} subscribers found but every password came back empty. '
                'The scan user is almost certainly missing the RouterOS "sensitive" '
                'policy — or this is a RouterOS v7 /export taken without '
                'show-sensitive. Importing now would generate new passwords and '
                'break every CPE.'
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


def fingerprint(sections):
    """Build the Router profile card from a scanned inventory.

    Returns the counts, the detected auth mode, the recommended import path and
    a list of plain-sentence findings the UI renders verbatim.
    """
    resource = _first(sections.get('system_resource') or [])
    identity = _first(sections.get('system_identity') or [])
    aaa = _first(sections.get('ppp_aaa') or [])

    secret_count = _count(sections, 'ppp_secrets')
    hotspot_user_count = _count(sections, 'hotspot_users')
    queue_count = _count(sections, 'queues')
    active_count = _count(sections, 'ppp_active')
    um_count = _count(sections, 'user_manager')

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

    passwords = password_readability(sections)
    vendor = detect_vendor(sections)
    automation = detect_expiry_automation(sections)

    fasttrack = any(
        (row.get('action') or '') == 'fasttrack-connection' and not _is_true(row.get('disabled'))
        for row in sections.get('firewall_filter') or []
    )

    findings = []
    if auth_mode == 'local':
        findings.append(
            f'This router authenticates {secret_count} PPPoE subscribers from its own '
            'database. Nothing here talks to an external billing system.'
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
        findings.append('No subscriber database, RADIUS server or queues found on this router.')

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
