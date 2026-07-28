"""The cutover script for a router that is already carrying live subscribers.

**Deliberately separate from services.provisioning_scripts.** That module builds
the greenfield "link a MikroTik" script and is not touched by this feature —
running it against a live third-party deployment would be destructive:

* ``build_radius_script()`` adds a blanket ``srcnat masquerade`` (breaks an
  existing policy-routing or NAT layout), forces ``/ip dns
  allow-remote-requests=yes`` (turns the router into an open resolver), rewrites
  the SNMP community, sets the timezone, and removes-and-recreates the
  management user — while the operator is very likely connected as that user;
* ``build_services_commands()`` is worse for this purpose: it rebuilds bridges,
  pools and DHCP servers, which **renumbers every subscriber on the network**.

What a takeover actually needs is four lines. The incumbent's ``/radius`` entry
is left in place, the address plan is left alone, and the discovered pools and
profiles keep their names. Standardising the topology onto Infora's conventions
is a separate, deliberate act for later — not a side effect of starting to bill.
"""
from services.radius_provisioning import (
    resolve_isp_radius_host,
    resolve_isp_radius_secret,
)

ADOPTION_COMMENT = 'infora-billing'

# Default accounting resolution. Every usage figure in the product moves in
# steps of this interval, so a shorter one during the cutover window means the
# operator sees traffic while they are still watching the screen.
DEFAULT_INTERIM = '5m'
CUTOVER_INTERIM = '1m'


def _radius_host(device, isp):
    """Where the router should send RADIUS.

    Prefers the ISP's configured RADIUS host; falls back to the management
    tunnel resolution used elsewhere. Imported read-only from
    services.wireguard_management so this module owns no tunnel logic of its own.
    """
    from services.wireguard_management import resolve_radius_host_for_device
    return resolve_isp_radius_host(isp, default=resolve_radius_host_for_device(device))


def build_adoption_script(device, isp, interim_update=DEFAULT_INTERIM,
                          remove_fasttrack=True, include_hotspot=True):
    """Additive-only RouterOS script that points a live router at Infora.

    Adds a RADIUS client, enables AAA and (optionally) drops FastTrack. Adds
    nothing else, removes nothing else. Idempotent: our own entry is replaced by
    comment on re-run, and no other entry is matched.

    ``remove_fasttrack`` is separated out because it is a genuine forwarding
    change — FastTrack bypasses the path RADIUS accounting depends on, so it must
    go for usage and FUP to be correct, but on a weak CPU it raises load. The
    caller surfaces it as its own decision.
    """
    secret = resolve_isp_radius_secret(isp)
    if not secret:
        raise ValueError('ISP has no RADIUS secret configured')
    host = _radius_host(device, isp)
    if not host:
        raise ValueError('Could not resolve a RADIUS host for this device')

    services = 'ppp,hotspot' if include_hotspot else 'ppp'

    # Pin the source address when the management tunnel is up: FreeRADIUS matches
    # a NAS to its clients.conf entry (and therefore to the per-ISP secret) by
    # source address, so it has to be deterministic rather than whatever the
    # routing table picks.
    src = ''
    if device.management_wg_enabled and device.management_wg_ip:
        src = f' src-address={device.management_wg_ip.split("/")[0]}'

    lines = [
        '# ============================================================',
        f'# Infora billing — ADOPTION of {device.device_name}',
        '#',
        '# Additive only. This script does NOT touch bridges, pools, DHCP,',
        '# addresses, NAT, DNS, SNMP, users or the existing RADIUS server.',
        '# Your subscribers keep their IPs and keep authenticating exactly as',
        '# they do now until you retire the old system.',
        '# ============================================================',
        '',
        '# --- 1. Add Infora as a RADIUS server -----------------------',
        '#     The incumbent entry is left untouched and stays ahead of ours in',
        '#     the list, so nothing changes for existing subscribers today.',
        f':do {{/radius remove [find comment="{ADOPTION_COMMENT}"]}} on-error={{}}',
        f'/radius add address="{host}" secret="{secret}" service={services} '
        f'timeout=3s{src} comment="{ADOPTION_COMMENT}"',
        '',
        '# --- 2. Accept CoA / disconnect from Infora -----------------',
        '/radius incoming set accept=yes',
        '',
        '# --- 3. Enable RADIUS AAA for PPP ---------------------------',
        '#     RouterOS checks its own /ppp secret database FIRST and only asks',
        '#     RADIUS for users it does not know locally. Existing subscribers',
        '#     are therefore unaffected by this line; it only opens the door.',
        f'/ppp aaa set use-radius=yes accounting=yes interim-update={interim_update}',
    ]

    if remove_fasttrack:
        lines += [
            '',
            '# --- 4. Remove FastTrack ------------------------------------',
            '#     FastTrack short-circuits the forwarding path that RADIUS',
            '#     accounting observes: leave it in and usage/FUP read as zero.',
            '#     This raises CPU on a busy low-end board.',
            ':do {/ip firewall filter remove [find action=fasttrack-connection]} on-error={}',
        ]

    lines += [
        '',
        ':log info "Infora adoption applied — no subscriber-facing config was changed"',
        ':put "Infora adoption complete. Existing sessions are untouched."',
    ]
    return '\n'.join(lines) + '\n'


def build_canary_script(login):
    """Move a single subscriber onto Infora by disabling their local secret.

    This is the whole low-risk cutover in one command. Because RouterOS resolves
    local secrets before RADIUS, disabling one secret is exactly "route this one
    person through Infora" — and re-enabling it is a complete rollback for that
    person, with no other subscriber affected either way.

    Disable, never remove: a removed secret takes the password with it, and the
    password is the thing that makes rollback free.
    """
    safe = (login or '').replace('"', '').strip()
    if not safe:
        raise ValueError('login is required')
    return (
        f'# Move {safe} onto Infora (reversible: set disabled=no to undo)\n'
        f'/ppp secret set [find name="{safe}"] disabled=yes\n'
        f'# Then disconnect the live session so they redial via RADIUS:\n'
        f':do {{/ppp active remove [find name="{safe}"]}} on-error={{}}\n'
    )


def build_rollback_script(logins=None):
    """Undo an adoption: re-enable local secrets and drop our RADIUS entry.

    Leaves ``use-radius`` alone — with the local database restored it is inert,
    and turning it off is the one step that could surprise a subscriber who has
    already been migrated.
    """
    lines = [
        '# Infora adoption rollback',
    ]
    for login in (logins or []):
        safe = (login or '').replace('"', '').strip()
        if safe:
            lines.append(f':do {{/ppp secret set [find name="{safe}"] disabled=no}} on-error={{}}')
    lines += [
        f':do {{/radius remove [find comment="{ADOPTION_COMMENT}"]}} on-error={{}}',
        ':put "Infora adoption rolled back."',
    ]
    return '\n'.join(lines) + '\n'


def build_retire_secrets_script(logins):
    """Disable a batch of local secrets once Infora is proven for them.

    Batch form of :func:`build_canary_script` — the operator moves a profile or
    fifty subscribers at a time, watching Online Users fill up between batches.
    """
    safe_logins = [(l or '').replace('"', '').strip() for l in (logins or [])]
    safe_logins = [l for l in safe_logins if l]
    if not safe_logins:
        raise ValueError('no logins supplied')
    lines = [
        f'# Infora cutover — move {len(safe_logins)} subscriber(s) onto RADIUS.',
        '# Reversible: /ppp secret set [find name="<login>"] disabled=no',
    ]
    for login in safe_logins:
        lines.append(f':do {{/ppp secret set [find name="{login}"] disabled=yes}} on-error={{}}')
    for login in safe_logins:
        lines.append(f':do {{/ppp active remove [find name="{login}"]}} on-error={{}}')
    lines.append(f':put "Moved {len(safe_logins)} subscribers to Infora RADIUS."')
    return '\n'.join(lines) + '\n'
