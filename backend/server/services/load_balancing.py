"""Dual-WAN load balancing / failover / app-steering — MikroTik .rsc generator.

One **substrate** with a **swappable classifier** (see LOAD_BALANCING_FAILOVER.md §15):

    mode = off          → strip everything, back to single-WAN
    mode = failover     → no classifier; WAN2 is a hot standby
    mode = load_balance → PCC hash on new LAN connections (aggregate bandwidth)
    mode = app_steer    → Meta (AS32934) + a subscriber address-list steered to WAN2

The substrate is identical in every mode: reclaim the WAN2 port, per-WAN masquerade
(never a blanket rule), recursive distance-ordered default routes with
``check-gateway=ping`` through per-WAN ``/32`` probe routes, per-WAN routing tables,
inbound/reply stickiness, WireGuard keepalive, and ``comment="infora-lb"`` idempotency
with a remove-by-comment rollback. Only the classifier changes between modes.

Every command is a single line so the same list drives both the **download** (join into a
``.rsc``) and the **push** (run each over SSH) paths, mirroring
``device_config_ops.build_services_commands`` / ``configure_services``.
"""
import ipaddress
import re

LB_COMMENT = 'infora-lb'
DEFAULT_LAN = 'infora-bridge'
META_LIST = 'infora-meta'          # address-list of Meta/Facebook prefixes (app_steer)
DEFAULT_SUB_LIST = 'ISP2-SUBS'     # subscriber address-list RADIUS can populate (app_steer)
VALID_MODES = ('off', 'failover', 'load_balance', 'app_steer')
# A line's job. Carried in the model from the start even while `mode` still
# derives it, so exposing per-line roles later does not mean a second pass over
# every stored config and every consumer.
#   active  — carries a weighted share of new connections
#   standby — carries nothing until every active line is down
#   steer   — carries only what is explicitly steered to it
VALID_ROLES = ('active', 'standby', 'steer')
# Beyond this the ceiling is the router, not the software: PCC forces FastTrack
# off, so every packet takes the firewall path and CPU becomes the limit.
MAX_LINES = 5
VALID_WAN_TYPES = ('static', 'dhcp', 'pppoe')
DEFAULT_PROBES = ('8.8.8.8', '1.0.0.1')
# Distance the router's pre-existing DHCP default is demoted to. High enough that
# our distance-1/2 recursive defaults always win, low enough to still be a route
# when they do not — so the router is never left with nothing.
FALLBACK_ROUTE_DISTANCE = 200

# Meta/Facebook (AS32934) IPv4 prefixes — starter set for app-steer. Extendable;
# the address-list is comment-tagged so re-running refreshes it.
META_PREFIXES = (
    '31.13.24.0/21', '31.13.64.0/18', '45.64.40.0/22', '66.220.144.0/20',
    '69.63.176.0/20', '69.171.224.0/19', '74.119.76.0/22', '102.132.96.0/20',
    '129.134.0.0/16', '157.240.0.0/16', '173.252.64.0/18', '179.60.192.0/22',
    '185.60.216.0/22', '204.15.20.0/22',
)


def _ros_major(device):
    """RouterOS major version (defaults to 7 — the modern syntax)."""
    raw = (getattr(device, 'os_version', None) or '').strip()
    try:
        return int(raw.split('.')[0])
    except (ValueError, IndexError):
        return 7


def validate_wan_config(config):
    """Validate + normalise a wan_config dict. Returns (clean, error_or_None).

    Accepts two shapes and always returns the newer one:

      legacy  {"wan1": {...}, "wan2": {...}, "probe_hosts": [a, b], "primary_wan": "wan1"}
      current {"lines": [{id, port, type, role, weight, priority, probe, ...}, ...]}

    Every router in the field stores the legacy shape, and nothing rewrites it —
    a device keeps its stored JSON until its next successful apply. So the two
    must stay interchangeable indefinitely, not just across one release.

    The legacy keys are also mirrored back onto the result (`wan1`, `wan2`,
    `probe_hosts`, `primary_wan`) so callers that have not been generalised yet
    keep working unchanged. That mirroring is what lets this land without
    touching the generator in the same commit.
    """
    if not isinstance(config, dict):
        return None, 'wan_config must be an object'

    mode = (config.get('mode') or 'off').strip().lower()
    if mode not in VALID_MODES:
        return None, f'invalid mode {mode!r} (use: {", ".join(VALID_MODES)})'

    clean = {
        'enabled': mode != 'off',
        'mode': mode,
        'lan_interface': (config.get('lan_interface') or DEFAULT_LAN).strip(),
        'primary_wan': (config.get('primary_wan') or 'wan1').strip().lower(),
        'pin_management_to': config.get('pin_management_to') or None,
        'subscriber_list': (config.get('subscriber_list') or DEFAULT_SUB_LIST).strip(),
    }

    if mode == 'off':
        clean['lines'] = []
        clean['probe_hosts'] = []
        return clean, None

    raw_lines, err = _collect_lines(config)
    if err:
        return None, err
    if len(raw_lines) < 2:
        return None, 'at least two lines are required'
    if len(raw_lines) > MAX_LINES:
        return None, f'at most {MAX_LINES} lines are supported'

    lines, err = _clean_lines(raw_lines, clean['mode'], clean['primary_wan'])
    if err:
        return None, err

    ports = [line['port'] for line in lines]
    if len(set(ports)) != len(ports):
        return None, 'each line must use a different port'

    probes = [line['probe'] for line in lines]
    if len(set(probes)) != len(probes):
        # Health is judged per line by whether its own probe answers. Two lines
        # sharing one means a dead line reports healthy and keeps taking traffic,
        # which is worse than having no health check at all.
        return None, 'each line needs its own probe host — two lines share one'

    ids = [line['id'] for line in lines]
    if clean['primary_wan'] not in ids:
        clean['primary_wan'] = min(lines, key=lambda x: x['priority'])['id']
    if clean['pin_management_to'] and clean['pin_management_to'] not in ids:
        return None, f'pin_management_to names an unknown line: {clean["pin_management_to"]}'

    clean['lines'] = lines
    # --- legacy mirror, for callers not yet generalised ---------------------
    for index, line in enumerate(lines[:2], start=1):
        mirror = {'port': line['port'], 'type': line['type'], 'weight': line['weight']}
        if line['type'] == 'static':
            mirror['ip'] = line['ip']
            mirror['gateway'] = line['gateway']
        clean[f'wan{index}'] = mirror
    clean['probe_hosts'] = probes[:2]
    return clean, None


def _collect_lines(config):
    """The lines from either shape, in order. Returns (list, error_or_None)."""
    if isinstance(config.get('lines'), list):
        return list(config['lines']), None

    lines = []
    probes = config.get('probe_hosts') or list(DEFAULT_PROBES)
    for index, key in enumerate(('wan1', 'wan2')):
        wan = config.get(key)
        if not isinstance(wan, dict):
            return None, f'{key} is required'
        line = dict(wan)
        line.setdefault('id', key)
        # Positional in the legacy shape; belongs to the line in the new one.
        if not line.get('probe'):
            line['probe'] = probes[index] if index < len(probes) else None
        lines.append(line)
    return lines, None


def _clean_lines(raw_lines, mode, primary_wan):
    """Validate and normalise each line. Returns (list, error_or_None)."""
    lines, used_ids = [], set()
    for index, raw in enumerate(raw_lines):
        if not isinstance(raw, dict):
            return None, f'line {index + 1} must be an object'
        position = index + 1

        # The id names RouterOS objects (to_WAN1, WAN1_conn, infora-lb-probe1),
        # so it must survive edits to the list. Removing the second of three
        # lines must not renumber the third, or teardown stops matching what is
        # actually on the router.
        line_id = (raw.get('id') or f'wan{position}').strip().lower()
        if not re.fullmatch(r'wan\d+', line_id):
            return None, f'line {position}: id must look like wan1, wan2, …'
        if line_id in used_ids:
            return None, f'duplicate line id {line_id}'
        used_ids.add(line_id)

        port = (raw.get('port') or '').strip()
        if not port:
            return None, f'{line_id}.port is required'
        wtype = (raw.get('type') or 'dhcp').strip().lower()
        if wtype not in VALID_WAN_TYPES:
            return None, f'{line_id}.type must be one of {", ".join(VALID_WAN_TYPES)}'

        # Default only when the field is absent. `or 1` would turn an explicit
        # weight of 0 into 1 — silently giving a line traffic the operator asked
        # it not to carry, instead of telling them 0 is not a valid weight.
        weight = raw.get('weight')
        weight = 1 if weight in (None, '') else weight
        try:
            weight = int(weight)
        except (TypeError, ValueError):
            return None, f'{line_id}.weight must be a number'
        if weight < 1:
            return None, 'weights must be >= 1'

        priority = raw.get('priority')
        priority = position if priority in (None, '') else priority
        try:
            priority = int(priority)
        except (TypeError, ValueError):
            return None, f'{line_id}.priority must be a number'

        probe = (str(raw.get('probe') or '').strip()
                 or (DEFAULT_PROBES[index] if index < len(DEFAULT_PROBES) else ''))
        try:
            ipaddress.ip_address(probe)
        except ValueError:
            return None, f'{line_id}: probe host {probe!r} is not a valid IP'

        line = {
            'id': line_id,
            'label': (raw.get('label') or '').strip() or None,
            'port': port,
            'type': wtype,
            'weight': weight,
            'priority': priority,
            'probe': probe,
            # Carried from day one even though `mode` still decides it, so that
            # exposing per-line roles later is a UI change rather than another
            # pass over the data model and every consumer of it.
            'role': _role_for(raw, mode, line_id, primary_wan),
            # Nullable, unused today. Present so "total supply" can be reported
            # later without a second migration of every stored config.
            'capacity_mbps': raw.get('capacity_mbps') or None,
        }
        if wtype == 'static':
            ip = (raw.get('ip') or '').strip()
            gateway = (raw.get('gateway') or '').strip()
            try:
                ipaddress.ip_interface(ip)
                ipaddress.ip_address(gateway)
            except ValueError:
                return None, f'{line_id}: static WAN needs a valid ip (CIDR) and gateway'
            line['ip'] = ip
            line['gateway'] = gateway
        lines.append(line)
    return lines, None


def _role_for(raw, mode, line_id, primary_wan):
    """A line's role. Explicit when given, otherwise derived from the mode.

    Deriving keeps the four presets meaning exactly what they mean today:
    failover is one active line plus standbys, load_balance is all active, and
    app_steer is the primary active with the rest as steer targets.
    """
    explicit = (raw.get('role') or '').strip().lower()
    if explicit in VALID_ROLES:
        return explicit
    if mode == 'load_balance':
        return 'active'
    if mode == 'app_steer':
        return 'active' if line_id == primary_wan else 'steer'
    return 'active' if line_id == primary_wan else 'standby'


def _pcc_buckets(lines):
    """Classifier buckets for a weighted N-way PCC split.

    One bucket per unit of weight, walked cumulatively: weights 3/1 give four
    buckets split 3/1, and 4/2/1 give seven split 4/2/1. Each bucket becomes one
    mangle rule, so the rule count is the sum of the weights — worth keeping in
    mind, since PCC also forces FastTrack off and every packet then takes the
    firewall path.
    """
    total = sum(line['weight'] for line in lines)
    buckets, edges, running = [], [], 0
    for line in lines:
        running += line['weight']
        edges.append((running, f'WAN{_line_num(line["id"])}_conn'))
    for i in range(total):
        mark = next(m for edge, m in edges if i < edge)
        buckets.append((mark, total, i))
    return buckets


def _tbl(name, ros7):
    return f'routing-table={name}' if ros7 else f'routing-mark={name}'


def _line_num(line_id):
    """The digits in wan3 -> '3'. Names to_WAN3, WAN3_conn, infora-lb-probe3."""
    return re.sub(r'\D', '', line_id) or '1'


def _line_name(line):
    """How a line is named back to the operator.

    Its label when it has one, because "Safaricom fibre has no upstream address"
    is a message someone can act on and "WAN3 has no upstream address" is a
    lookup. Falls back to the id, which is all a legacy config carries.
    """
    label = (line.get('label') or '').strip()
    return f'{line["id"].upper()} ({label})' if label else line['id'].upper()


def _table_for(line_id):
    return f'to_WAN{_line_num(line_id)}'


def _gw_route_cmds(line_id, own_table, backup_tables, probe, ros7, gw, replace=True):
    """One line's gateway-dependent routes, given an expression for its gateway.

    Three kinds:

      * its own table's primary default (distance 1),
      * a distance-2 backup in each table it covers for, so traffic pinned to a
        dead line still leaves the building,
      * its ``/32`` probe route, which the main-table recursive default resolves
        through.

    ``backup_tables`` is what keeps this O(N) rather than O(N²). Every line backs
    up the primary, and the primary backs up everyone — so at two lines it is the
    mutual arrangement it has always been, and at five it is fourteen routes
    rather than twenty-five, with no lease script longer than the number of
    lines. A full mesh would put N route-adds in every script, and these run as
    one `:if … do={ …; … }` block where a single rejection silently abandons the
    rest.

    Shared by the lease script and the seed step so the two cannot drift.
    """
    n = _line_num(line_id)
    # A bare string here would iterate per character and emit one bogus route per
    # letter — silently, into a router's routing table. Accept it and mean it.
    if isinstance(backup_tables, str):
        backup_tables = [backup_tables]
    cmds = []
    if replace:
        # Only the re-entrant callers need these. A lease script runs again on
        # every bind and must clear what its last run left; the static path is
        # emitted once, after step 0 has already removed every infora-lb route,
        # so removes there would match nothing and just make the plan longer.
        cmds += [
            f'/ip route remove [find comment~"{LB_COMMENT}-gw{n}"]',
            f'/ip route remove [find comment~"{LB_COMMENT}-bk{n}"]',
            f'/ip route remove [find comment~"{LB_COMMENT}-probe{n}"]',
        ]
    cmds += [
        f'/ip route add dst-address=0.0.0.0/0 gateway={gw} {_tbl(own_table, ros7)}'
        f' distance=1 check-gateway=ping comment="{LB_COMMENT}-gw{n}"',
    ]
    for table in backup_tables:
        cmds.append(
            f'/ip route add dst-address=0.0.0.0/0 gateway={gw} {_tbl(table, ros7)}'
            f' distance=2 check-gateway=ping comment="{LB_COMMENT}-bk{n}"'
        )
    cmds.append(
        f'/ip route add dst-address={probe}/32 gateway={gw} scope=10'
        f' comment="{LB_COMMENT}-probe{n}"'
    )
    return cmds


def _backup_tables_for(line, ordered, primary):
    """Which tables this line provides the distance-2 fallback in.

    The primary covers every other line; every other line covers the primary.
    At two lines that is mutual, exactly as before.
    """
    if line['id'] == primary['id']:
        return [_table_for(other['id']) for other in ordered if other['id'] != line['id']]
    return [_table_for(primary['id'])]


def _escape_for_script(command):
    """Escape a command for embedding in a RouterOS script="..." argument."""
    return command.replace('"', '\\"').replace('$', '\\$')


def _lease_script(line_id, own_table, backup_tables, probe, ros7):
    """DHCP-client script: rebuild this line's routes on every lease bind.

    Fires on bind only, which is why it cannot be the sole way these routes get
    installed — see `_seed_routes_cmd`.
    """
    body = '; '.join(
        _gw_route_cmds(line_id, own_table, backup_tables, probe, ros7, '$"gateway-address"')
    )
    return f':if (\\$bound=1) do={{ {_escape_for_script(body)} }}'


def _seed_routes_cmd(line_id, own_table, backup_tables, probe, ros7, port):
    """Install this line's routes now, from the lease the client already holds.

    The lease script only runs on *bind*. A client we adopted is usually already
    bound, and `/ip dhcp-client renew` on a bound client renews the lease without
    producing a bind event — so its script never ran and its probe route never
    appeared. The recursive default that resolves through that probe was then
    flagged invalid, which is precisely what Fusion showed: WAN2's client was
    newly created and bound cleanly, WAN1's was adopted and silently installed
    nothing.

    So the routes are seeded here from `gateway` on the current lease, and the
    script keeps them correct across future lease changes. Guarded on a non-empty
    gateway, because a client that has not bound yet has none and the script will
    do the work when it does.
    """
    body = '; '.join(
        _gw_route_cmds(line_id, own_table, backup_tables, probe, ros7, '$gw')
    )
    return (
        f':local gw [/ip dhcp-client get [find interface={port}] gateway]; '
        f':if ([:len $gw] > 0) do={{ {body} }}'
    )


def _addr_route_cmds(line_id, gw, own_table, backup_tables, probe, ros7):
    """The same routes for a static WAN, emitted directly (no lease involved)."""
    return _gw_route_cmds(line_id, own_table, backup_tables, probe, ros7, gw, replace=False)


def build_lb_steps(device, config):
    """Ordered (label, single-line RouterOS command) steps for a wan_config.

    ``off`` returns the teardown steps. All commands are idempotent and tagged
    ``infora-lb`` (routes use ``infora-lb-*`` sub-tags).
    """
    ros7 = _ros_major(device) >= 7
    # Every production caller validates first, but this is also reachable from the
    # .rsc download and from tests. Normalising here keeps it total: a legacy
    # {wan1, wan2} dict generates the same plan it always did rather than raising
    # KeyError halfway through building router config.
    if 'lines' not in config:
        normalised, err = validate_wan_config(config)
        if err:
            raise ValueError(f'invalid wan_config: {err}')
        config = normalised

    mode = config['mode']
    if mode == 'off':
        return build_lb_remove_steps(config)

    lan = config['lan_interface']
    lines = config['lines']
    # Ordered by failover priority, so "first" means "the line traffic prefers".
    ordered = sorted(lines, key=lambda l: (l['priority'], l['id']))
    primary = next((l for l in ordered if l['role'] == 'active'), ordered[0])
    # Lines that carry a weighted share. Standby and steer lines get everything
    # else — table, probe, masquerade, stickiness — but never a PCC bucket.
    balanced = [l for l in ordered if l['role'] == 'active']
    steps = []

    def add(label, cmd):
        steps.append((label, cmd))

    # --- 0. Clean slate (idempotent) -------------------------------------------
    add('reset-routes', f':do {{/ip route remove [find comment~"{LB_COMMENT}"]}} on-error={{}}')
    add('reset-mangle', f':do {{/ip firewall mangle remove [find comment="{LB_COMMENT}"]}} on-error={{}}')
    add('reset-nat', f':do {{/ip firewall nat remove [find comment="{LB_COMMENT}"]}} on-error={{}}')

    # --- 1. Reclaim BOTH WAN ports from any bridge -----------------------------
    #     This used to reclaim only WAN2, on the assumption that WAN1 was already
    #     a free uplink port. It is not on a factory router: MikroTik's `defconf`
    #     puts ether1 into `bridgeLocal`, and RouterOS then silently refuses
    #     everything WAN1 needs —
    #       DHCP client: "can not run on slave or passthrough interface!"
    #       mangle/NAT:  "in/out-interface matcher not possible when interface
    #                     (ether1) is slave - use master instead"
    #     The rules are still *accepted*, just flagged invalid, so the push looks
    #     clean while the router does nothing. Reclaim both, always.
    for line in lines:
        add(f'reclaim-{line["id"]}',
            f':do {{/interface bridge port remove [find interface={line["port"]}]}} on-error={{}}')

    # --- 1b. Demote the existing uplink, never delete it -----------------------
    #     `defconf` ships a DHCP client with add-default-route=yes, and on most
    #     routers it IS the working uplink and the only default route.
    #
    #     This used to remove it, because a distance-1 default beats the recursive
    #     failover defaults below and the router would keep using a WAN we do not
    #     manage. Removing it also removed the only route the router had — and the
    #     SSH session pushing the rest of this configuration runs over the
    #     management tunnel, which rides that route. The push cut its own
    #     connection, the remaining commands never landed, and the router was left
    #     with no way out. That is how Kifaru and DADA were lost.
    #
    #     Demoting solves the same problem without the cliff: at distance 200 it
    #     always loses to our distance-1/2 defaults, so it never competes — but it
    #     is still there if ours fail to come up, and it disappears on its own when
    #     the lease does. The router is never routeless, not even for an instant.
    add('demote-defconf-dhcp',
        f':do {{/ip dhcp-client set [find comment="defconf"] '
        f'default-route-distance={FALLBACK_ROUTE_DISTANCE}}} on-error={{}}')

    # --- 2. Routing tables, BEFORE anything routes into them ------------------
    #     These have to exist first. The DHCP seed and the lease script both add
    #     routes with routing-table=to_WAN1/to_WAN2, and RouterOS rejects a route
    #     naming a table that does not exist yet. Because the seed is one
    #     `:if ... do={ ...; ...; ... }` block, that rejection aborts the rest of
    #     the block — so the probe /32 at the end never got added, and the
    #     recursive default that resolves through it was left invalid. Creating
    #     the tables afterwards, as this used to, made the failure look like a
    #     DHCP problem on Fusion when it was purely an ordering one.
    if ros7:
        for line in ordered:
            table = _table_for(line['id'])
            add(f'table-{line["id"]}',
                f':do {{/routing table add name={table} fib comment="{LB_COMMENT}"}} on-error={{}}')

    # --- 3. WAN addressing (static address / dhcp client) ---------------------
    add('wan-addr-reset', f':do {{/ip address remove [find comment="{LB_COMMENT}"]}} on-error={{}}')
    for line in ordered:
        key, port, probe = line['id'], line['port'], line['probe']
        own_tbl = _table_for(key)
        backup_tbls = _backup_tables_for(line, ordered, primary)
        if line['type'] == 'static':
            add(f'{key}-addr',
                f'/ip address add interface={port} address={line["ip"]} comment="{LB_COMMENT}"')
        elif line['type'] == 'dhcp':
            script = _lease_script(key, own_tbl, backup_tbls, probe, ros7)
            # Adopt whatever client is already on the port rather than replacing
            # it. RouterOS allows one client per interface, so a remove-then-add
            # leaves the port unaddressed in between — on the WAN carrying the
            # management tunnel that gap is the outage this whole change exists
            # to prevent. Create one only when the port has none.
            add(f'{key}-dhcp-ensure',
                f':if ([:len [/ip dhcp-client find interface={port}]]=0) do={{'
                f'/ip dhcp-client add interface={port} disabled=no}}')
            add(f'{key}-dhcp-configure',
                f'/ip dhcp-client set [find interface={port}] '
                # Keep a default route, but demoted: our recursive defaults at
                # distance 1/2 win, and this is the floor the router falls back to
                # instead of having nothing.
                f'add-default-route=yes default-route-distance={FALLBACK_ROUTE_DISTANCE} '
                f'use-peer-dns=no comment="{LB_COMMENT}" script="{script}"')
            # Install the routes now from the lease the client already holds.
            # `renew` was not enough: on an adopted, already-bound client RouterOS
            # renews without raising a bind event, so the script never ran and the
            # probe route never appeared — leaving the recursive default for this
            # WAN flagged invalid. The script still owns future lease changes.
            add(f'{key}-dhcp-seed',
                _seed_routes_cmd(key, own_tbl, backup_tbls, probe, ros7, port))

    # --- 4. Gateway-dependent routes: static emits directly; dhcp via lease ----
    for line in ordered:
        if line['type'] == 'static':
            key = line['id']
            cmds = _addr_route_cmds(key, line['gateway'], _table_for(key),
                                    _backup_tables_for(line, ordered, primary),
                                    line['probe'], ros7)
            for i, cmd in enumerate(cmds):
                add(f'{key}-route{i}', cmd)

    # --- 5. Probe blackholes (safety net, proven in the field) -----------------
    #     Each probe /32 has a real route via its WAN gateway (distance 1). Pair
    #     it with a high-distance blackhole so that if the WAN drops and the real
    #     route goes inactive, the probe is DROPPED here — it can't leak out the
    #     surviving WAN and falsely report the dead one healthy. distance=250 >> 1
    #     means the real route always wins the instant it returns (no shadowing).
    for probe in [l['probe'] for l in ordered]:
        add(f'blackhole-{probe}',
            f'/ip route add dst-address={probe}/32 type=blackhole distance=250 '
            f'scope=10 comment="{LB_COMMENT}"')

    # --- 6. Recursive, distance-ordered main defaults (failover core) ----------
    #     Reached via the /32 probe routes → detects UPSTREAM outages, not just a
    #     dead local gateway.
    #     Distance follows the line order, so the whole failover chain is just
    #     "first line, then the next, then the next" rather than a special case
    #     for two.
    for position, line in enumerate(ordered, start=1):
        add(f'main-default-{_line_num(line["id"])}',
            f'/ip route add dst-address=0.0.0.0/0 gateway={line["probe"]} distance={position} '
            f'check-gateway=ping target-scope=11 comment="{LB_COMMENT}"')

    # --- 6. Inbound / reply stickiness (all modes) — replies leave the WAN they
    #     arrived on, so port-forwards / hotspot replies stay symmetric.
    for line in ordered:
        n = _line_num(line['id'])
        add(f'mangle-in-{n}', f'/ip firewall mangle add chain=input in-interface={line["port"]} '
            f'action=mark-connection new-connection-mark=WAN{n}_conn passthrough=yes comment="{LB_COMMENT}"')
    for line in ordered:
        n = _line_num(line['id'])
        add(f'mangle-out-{n}', f'/ip firewall mangle add chain=output connection-mark=WAN{n}_conn '
            f'action=mark-routing new-routing-mark={_table_for(line["id"])} comment="{LB_COMMENT}"')

    # --- 7. Classifier (the only per-mode branch) ------------------------------
    if mode == 'load_balance':
        for i, (conn_mark, total, rem) in enumerate(_pcc_buckets(balanced)):
            add(f'pcc-{i}', f'/ip firewall mangle add chain=prerouting in-interface={lan} '
                f'connection-state=new dst-address-type=!local action=mark-connection '
                f'new-connection-mark={conn_mark} per-connection-classifier=both-addresses:{total}/{rem} '
                f'passthrough=yes comment="{LB_COMMENT}"')
        for tbl, mark in [(_table_for(l['id']), f'WAN{_line_num(l["id"])}_conn') for l in balanced]:
            add(f'pcc-route-{tbl}', f'/ip firewall mangle add chain=prerouting in-interface={lan} '
                f'connection-mark={mark} action=mark-routing new-routing-mark={tbl} comment="{LB_COMMENT}"')

    elif mode == 'app_steer':
        # Meta prefixes → an address-list; a subscriber address-list RADIUS fills.
        add('meta-list-reset', f':do {{/ip firewall address-list remove [find list={META_LIST}]}} on-error={{}}')
        for pfx in META_PREFIXES:
            add(f'meta:{pfx}', f'/ip firewall address-list add list={META_LIST} address={pfx} comment="{LB_COMMENT}"')
        sub_list = config['subscriber_list']
        # New LAN connections to Meta, or from a steered subscriber, ride WAN2.
        add('steer-meta', f'/ip firewall mangle add chain=prerouting in-interface={lan} '
            f'connection-state=new dst-address-list={META_LIST} action=mark-connection '
            f'new-connection-mark=WAN2_conn passthrough=yes comment="{LB_COMMENT}"')
        add('steer-subs', f'/ip firewall mangle add chain=prerouting in-interface={lan} '
            f'connection-state=new src-address-list={sub_list} action=mark-connection '
            f'new-connection-mark=WAN2_conn passthrough=yes comment="{LB_COMMENT}"')
        add('steer-route', f'/ip firewall mangle add chain=prerouting in-interface={lan} '
            f'connection-mark=WAN2_conn action=mark-routing new-routing-mark=to_WAN2 comment="{LB_COMMENT}"')
        # Everything else stays unmarked → main-table failover default (primary WAN).

    # --- 8. Optional: pin the management/RADIUS tunnel to one WAN --------------
    pin = config.get('pin_management_to')
    if pin and any(line['id'] == pin for line in ordered):
        tbl = _table_for(pin)
        add('pin-mgmt', f'/ip firewall mangle add chain=output connection-mark=no-mark '
            f'action=mark-routing new-routing-mark={tbl} comment="{LB_COMMENT}" place-before=0')

    # --- 9. Per-WAN NAT (replaces the blanket infora-masquerade) --------------
    #     These are only valid once the ports are free of a bridge (step 1). A
    #     masquerade naming a slave interface is accepted and then flagged
    #     invalid, which is how Kifaru ended up with *no* working masquerade on
    #     the path that carried its traffic: LAN clients left un-NATed and got
    #     no replies, while the router itself still pinged out from its own IP.
    add('nat-reset', ':do {/ip firewall nat remove [find comment="infora-masquerade"]} on-error={}')
    add('nat-defconf-reset', ':do {/ip firewall nat remove [find comment="defconf"]} on-error={}')
    for line in ordered:
        add(f'nat-{_line_num(line["id"])}',
            f'/ip firewall nat add chain=srcnat out-interface={line["port"]} '
            f'action=masquerade comment="{LB_COMMENT}"')

    # --- 10. FastTrack policy — the generator owns this per mode ----------------
    if mode == 'load_balance':
        # PCC needs every packet in the firewall path.
        add('fasttrack', ':do {/ip firewall filter remove [find action=fasttrack-connection]} on-error={}')
    elif mode == 'app_steer':
        # Keep acceleration for the unmarked majority; only steered flows skip it.
        add('fasttrack', ':do {/ip firewall filter set [find action=fasttrack-connection] connection-mark=no-mark} on-error={}')

    # --- 11. Rehandshake the management tunnel fast after a WAN flip -----------
    add('wg-keepalive', f':do {{/interface wireguard peers set [find comment~"infora"] persistent-keepalive=25s}} on-error={{}}')

    # --- 12. MSS clamp (harmless in general; required for any PPPoE WAN) -------
    if any(line['type'] == 'pppoe' for line in ordered):
        add('mss-clamp', f'/ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn '
            f'action=change-mss new-mss=clamp-to-pmtu passthrough=yes comment="{LB_COMMENT}"')

    return steps


def build_lb_remove_steps(config=None):
    """Teardown: strip every infora-lb artifact and restore single-WAN NAT."""
    lan_note = (config or {}).get('lan_interface', DEFAULT_LAN)  # noqa: F841 (kept for symmetry)
    steps = [
        ('remove-mangle', f':do {{/ip firewall mangle remove [find comment~"{LB_COMMENT}"]}} on-error={{}}'),
        ('remove-nat', f':do {{/ip firewall nat remove [find comment~"{LB_COMMENT}"]}} on-error={{}}'),
        ('remove-routes', f':do {{/ip route remove [find comment~"{LB_COMMENT}"]}} on-error={{}}'),
        ('remove-addr', f':do {{/ip address remove [find comment="{LB_COMMENT}"]}} on-error={{}}'),
        # Restore the client, do NOT remove it. The apply adopts whatever client
        # was already on the WAN port rather than replacing it, so by teardown
        # this is very often the router's original uplink wearing our comment.
        # Removing it would strand the router on "Disable dual-WAN" — the exact
        # failure this whole change exists to eliminate, arriving through the
        # back door.
        ('restore-dhcp',
         f':do {{/ip dhcp-client set [find comment="{LB_COMMENT}"] script="" '
         f'add-default-route=yes default-route-distance=1 use-peer-dns=yes '
         f'comment="infora-uplink"}} on-error={{}}'),
        # A client we genuinely created and that never bound leaves nothing
        # useful behind, but it also cannot be told apart from an adopted one, so
        # it is kept too. A spare DHCP client on a WAN port is harmless; a router
        # with no client is not.
        ('undemote-defconf',
         ':do {/ip dhcp-client set [find comment="defconf"] default-route-distance=1} on-error={}'),
        ('remove-addrlist', f':do {{/ip firewall address-list remove [find comment="{LB_COMMENT}"]}} on-error={{}}'),
    ]
    steps.append(('remove-tables', f':do {{/routing table remove [find comment="{LB_COMMENT}"]}} on-error={{}}'))
    # Restore the single-WAN blanket masquerade the base provisioning expects.
    steps.append(('restore-nat',
        ':do {/ip firewall nat remove [find comment="infora-masquerade"]} on-error={}; '
        '/ip firewall nat add chain=srcnat action=masquerade comment="infora-masquerade"'))
    # Turn FastTrack back on (a plain accelerator rule) for single-WAN.
    steps.append(('restore-fasttrack',
        ':if ([:len [/ip firewall filter find action=fasttrack-connection]]=0) do={'
        '/ip firewall filter add chain=forward action=fasttrack-connection '
        'connection-state=established,related comment="infora-fasttrack"}'))
    return steps


# ---------------------------------------------------------------------------
# Rollback guard — the dead-man's switch
# ---------------------------------------------------------------------------

GUARD_NAME = 'infora-lb-guard'
# Long enough for a slow push plus verification on a busy router, short enough
# that an operator who has cut themselves off is not waiting half an hour.
GUARD_MINUTES = 8


def build_lb_restore_steps(config=None):
    """Teardown PLUS a working uplink. What the router needs to come back.

    `build_lb_remove_steps` strips the dual-WAN artifacts but leaves the router
    with no default route, because the apply deliberately retires the `defconf`
    DHCP client (it installs a competing distance-1 default that would beat our
    recursive ones). Removing the LB routes therefore leaves *nothing*: the
    router keeps serving its LAN, and has no path to the internet or to us.

    That is how a failed dual-WAN push takes a healthy router off the map
    permanently — and why "Disable dual-WAN" could not rescue it either.

    So the restore re-adds a plain DHCP client with a default route on each WAN
    port. It is the same thing `defconf` did, and it is safe when the port
    already has one: RouterOS refuses the duplicate and `on-error` swallows it.
    """
    steps = list(build_lb_remove_steps(config))
    ports = []
    for key in ('wan1', 'wan2'):
        wan = (config or {}).get(key) or {}
        port = wan.get('port')
        if port and port not in ports:
            ports.append(port)

    for port in ports:
        # A static WAN gets its address back from the operator's own config; a
        # DHCP one needs a client. Adding a client to a static port is harmless
        # -- it simply never binds -- and we cannot know which failed, so both
        # get one. Getting the router back online outranks tidiness here.
        steps.append((
            f'restore-uplink-{port}',
            f':do {{/ip dhcp-client add interface={port} add-default-route=yes '
            f'use-peer-dns=yes comment="infora-lb-restore"}} on-error={{}}',
        ))
    return steps


def _ros_quote(script):
    """Escape a RouterOS script for embedding in an on-event="..." argument."""
    return script.replace('\\', '\\\\').replace('"', '\\"')


def build_lb_guard_steps(config, minutes=GUARD_MINUTES):
    """Arm a scheduler that undoes the push if nobody cancels it.

    Standard practice for changing the routing of a router you can only reach
    *through* that routing: schedule the undo first, make the change, and cancel
    the undo only once you have proved you still have contact. If the push cuts
    the tunnel, nothing cancels it and the router repairs itself.

    Without this the only recovery was someone driving to the site with a laptop.
    """
    rollback = '; '.join(cmd for _label, cmd in build_lb_restore_steps(config))
    # Self-removing, so a fired guard leaves nothing behind to fire again.
    rollback += f'; :do {{/system scheduler remove [find name="{GUARD_NAME}"]}} on-error={{}}'
    rollback += ' ; :log warning "Infora: dual-WAN push was not confirmed - configuration rolled back"'

    return [
        ('guard-reset',
         f':do {{/system scheduler remove [find name="{GUARD_NAME}"]}} on-error={{}}'),
        ('guard-arm',
         f'/system scheduler add name="{GUARD_NAME}" interval={minutes}m '
         f'comment="{LB_COMMENT}" on-event="{_ros_quote(rollback)}"'),
    ]


def build_lb_disarm_steps():
    """Cancel the guard. Only ever run after verification has passed."""
    return [
        ('guard-disarm',
         f':do {{/system scheduler remove [find name="{GUARD_NAME}"]}} on-error={{}}'),
    ]

def _header(device, config):
    mode = config.get('mode', 'off')
    return [
        f'# Infora dual-WAN — {mode.replace("_", " ")} for {getattr(device, "device_name", "router")}',
        f'# RouterOS v{_ros_major(device)} syntax. Idempotent — re-runnable. Tagged comment="{LB_COMMENT}".',
        '# Remove with the Disable action (remove-by-comment). See LOAD_BALANCING_FAILOVER.md.',
        '',
    ]


def build_lb_script(device, config):
    """Full one-shot .rsc (header + one command per line) for download/paste."""
    steps = build_lb_steps(device, config)
    lines = _header(device, config) + [cmd for _, cmd in steps]
    lines += ['', ':put "Infora dual-WAN configuration applied."']
    return '\n'.join(lines) + '\n'


# ---------------------------------------------------------------------------
# Live-router inspection
#
# validate_wan_config() checks the shape of a dict. It cannot know that the port
# it was handed is a bridge slave, or is patched into our own LAN rather than an
# ISP. Both of those produce a config the router accepts and then ignores, so
# the two functions below ask the router itself — once before pushing, once
# after.
# ---------------------------------------------------------------------------

def _read_router_state(device, timeout=25, lock_wait=30):
    """Read-only snapshot of the interface/address/route facts LB depends on."""
    from services.device_config_ops import mikrotik_ssh

    probes = {
        'interfaces': '/interface print without-paging',
        'bridge_ports': '/interface bridge port print without-paging',
        'addresses': '/ip address print without-paging',
        'dhcp_clients': '/ip dhcp-client print without-paging',
        'routes': '/ip route print without-paging',
        'mangle': '/ip firewall mangle print without-paging',
        'nat': '/ip firewall nat print without-paging',
        'tables': '/routing table print without-paging',
    }
    state = {}
    with mikrotik_ssh(device, timeout=timeout, lock_wait=lock_wait) as client:
        for key, cmd in probes.items():
            try:
                out, err = client.run_cli(cmd)
                state[key] = out or err or ''
            except Exception as exc:  # noqa: BLE001 — a probe failing is data too
                state[key] = ''
                state.setdefault('_errors', []).append(f'{key}: {exc}')
    return state


def _iface_is_slave(state, port):
    """True when ``port`` is enslaved to a bridge.

    Two independent signals, because either can be absent depending on RouterOS
    version and how the port was added: the ``S`` flag in ``/interface print``,
    and a row in ``/interface bridge port print`` naming the interface.
    """
    for line in state.get('interfaces', '').splitlines():
        parts = line.split()
        if port not in parts:
            continue
        # Everything before the name is the index plus the flag letters, e.g.
        # "0 RS ether1 ..." → flags "RS". S there means slave.
        flags = ''.join(parts[:parts.index(port)])
        if 'S' in flags:
            return True

    for line in state.get('bridge_ports', '').splitlines():
        # Skip the header/legend rows, which name columns rather than ports.
        if line.startswith(('Flags:', 'Columns:', '#')) or ';;;' in line:
            continue
        if port in line.split():
            return True

    return False


def _iface_is_running(state, port):
    """True when ``port`` has carrier (the ``R`` flag in /interface print).

    Tri-state on purpose: None means the interface was not found in the output at
    all, which is a parsing failure rather than a dead port, and must not be
    reported to the operator as "nothing is plugged in".
    """
    for line in state.get('interfaces', '').splitlines():
        parts = line.split()
        if port not in parts:
            continue
        if line.lstrip().startswith(('Flags:', 'Columns:', '#')):
            continue
        # Same shape as _iface_is_slave: "0 RS ether1 ..." → flags "RS".
        flags = ''.join(parts[:parts.index(port)])
        return 'R' in flags
    return None

def _addresses_on(state, port):
    """Every address currently configured on ``port``.

    Handles both shapes RouterOS prints, because the two callers historically
    disagreed about which one they were reading:

      terse     ``address=192.168.0.100/24 interface=ether1 ...``
      columnar  ``1 D 192.168.0.100/24  192.168.0.0  ether1  main``

    `_read_router_state` uses ``print without-paging``, which is columnar — so
    while this only understood the terse form it returned nothing for every port
    on every router. That silently disabled the blocker below it: a "WAN" patched
    into our own LAN, which is the exact wiring mistake that cost us Kifaru, was
    never once detected.
    """
    found, current = [], None
    for raw in state.get('addresses', '').splitlines():
        line = raw.strip()
        if not line or line.startswith((';;;', 'Flags:', 'Columns:', '#')):
            continue

        # --- terse ---
        if 'address=' in raw:
            current = raw
        if f'interface={port}' in raw or f'actual-interface={port}' in raw:
            source = current or raw
            for token in source.split():
                if token.startswith('address='):
                    found.append(token.split('=', 1)[1])
            current = None
            continue

        # --- columnar: the interface name is its own field, and the address is
        #     the first token carrying a "/" prefix length. Matching on the whole
        #     token avoids "ether1" also matching "ether10".
        parts = raw.split()
        if port not in parts:
            continue
        for token in parts:
            if '/' in token:
                head = token.split('/')[0]
                if head.count('.') == 3 or ':' in head:
                    found.append(token)
                    break
    return found


def _iter_rule_blocks(section_text):
    """Yield one printed object at a time as a list of its lines.

    RouterOS wraps a single object over several lines, with the index and flags
    on the first and the fields indented under it. Objects are separated by a
    blank line, but not always — a new index in column 0 also starts one.
    Grepping the flat text cannot tell you which object a match belongs to, or
    whether that object is flagged invalid, so everything below works on blocks.
    """
    block = []
    for line in section_text.splitlines():
        stripped = line.strip()
        if not stripped:
            if block:
                yield block
                block = []
            continue
        if stripped.startswith(('Flags:', 'Columns:', '#')):
            continue
        # A leading index means the previous object ended.
        if block and stripped.split()[0].rstrip(';').isdigit():
            yield block
            block = []
        block.append(stripped)
    if block:
        yield block


def _block_flags(block):
    """Flag letters sitting between an object's index and its first field.

    ``0 I  ;;; infora-lb`` -> ['I'];  ``1    chain=srcnat ...`` -> [];
    ``0  Is  0.0.0.0/0 ...`` -> ['Is'] (routes use mixed-case flags).
    """
    if not block:
        return []
    flags = []
    for token in block[0].split()[1:]:
        if '=' in token or token.startswith(';') or not token.isalpha():
            break
        flags.append(token)
    return flags


def _block_is_broken(block):
    """True when RouterOS flagged the object invalid, inactive or disabled.

    ``I`` is INVALID on a rule and INACTIVE on a route; ``X`` is disabled. All
    three mean the object exists and does nothing, which is the failure mode
    this module exists to detect.
    """
    return any('I' in flag or 'X' in flag for flag in _block_flags(block))


def _rule_is_active(section_text, needle):
    """True when the object containing ``needle`` exists and is not broken.

    A masquerade naming a bridge slave is *present* in the output and completely
    inert. Grepping for the text alone reports a working NAT rule on a router
    that is NAT'ing nothing — which is exactly what it did for Kifaru.
    """
    for block in _iter_rule_blocks(section_text):
        if any(needle in line for line in block):
            return not _block_is_broken(block)
    return False


def _invalid_lb_objects(state):
    """infora-lb objects RouterOS rejected, quoting its own reason.

    Only broken blocks are reported. An earlier version returned every tagged
    block regardless of its flags, so a healthy rule showed up in the failure
    list beside the genuinely broken one.
    """
    problems = []
    for section in ('mangle', 'nat', 'dhcp_clients', 'routes'):
        for block in _iter_rule_blocks(state.get(section, '')):
            if not any(LB_COMMENT in line for line in block):
                continue
            if not _block_is_broken(block):
                continue
            # RouterOS explains itself in a second ;;; line under the comment.
            reason = next(
                (line.lstrip('; ').strip() for line in block
                 if 'not possible' in line or 'can not run' in line),
                None,
            )
            problems.append((section, reason or block[0][:120]))
    return problems


def preflight_wan_config(device, config):
    """Inspect the router before pushing. Returns ``(blockers, warnings)``.

    Blockers are conditions that guarantee the config cannot work — pushing
    anyway just produces the invalid-rule state this function exists to prevent.
    Warnings are things the operator should know but that the push itself fixes
    or tolerates.
    """
    # Total, like build_lb_steps: a caller handing this a legacy {wan1, wan2}
    # dict must get real checks rather than an empty list that reads as "all
    # clear". Silently passing a config nobody validated is the worst possible
    # answer from a pre-flight.
    if 'lines' not in config:
        normalised, err = validate_wan_config(config)
        if err:
            return [f'wan_config is invalid: {err}'], []
        config = normalised

    blockers, warnings = [], []
    if config.get('mode') == 'off':
        return blockers, warnings

    try:
        state = _read_router_state(device)
    except Exception as exc:  # noqa: BLE001 — unreachable router is a blocker
        return [f'Could not read the router to pre-check: {exc}'], warnings

    lan = config['lan_interface']
    interfaces = state.get('interfaces', '')

    for line in config.get('lines') or []:
        key = _line_name(line)
        port = line['port']

        if port and port not in interfaces:
            blockers.append(f'{key}: interface {port} does not exist on this router')
            continue
        if port == lan:
            blockers.append(f'{key}: {port} is the LAN interface — pick a different port')
            continue

        # The Kifaru failure: a "WAN" patched into our own LAN, leasing from the
        # router's own DHCP pool. Routing a default out of it is a loop.
        for addr in _addresses_on(state, port):
            if _same_subnet(addr, _lan_address(state, lan)):
                blockers.append(
                    f'{key}: {port} holds {addr}, which is inside the LAN subnet — '
                    f'it is patched into this router, not an upstream ISP'
                )
                break

        # Nothing plugged in is a blocker, not a warning.
        #
        # The apply retires the router's working DHCP client before the new WAN
        # can bind, and for a DHCP WAN every route it installs comes from the
        # lease script firing on bind. A port with no carrier never binds, so the
        # router ends up with no default route at all — serving its LAN, invisible
        # to us. That is exactly how Kifaru was lost, and it is cheap to catch
        # here, before anything on the router has been touched.
        running = _iface_is_running(state, port)
        if running is False:
            blockers.append(
                f'{key}: {port} has no link — nothing is plugged into it. A WAN port '
                f'with no carrier can never get a lease, and applying this would drop '
                f"the router's current uplink without a working replacement."
            )
            continue
        if line.get('type') == 'dhcp' and not _addresses_on(state, port):
            warnings.append(
                f'{key}: {port} has link but no address yet. It must be able to get '
                f'DHCP from the ISP — if it cannot, the router will be left without a '
                f'default route until the rollback guard restores it.'
            )

        if _iface_is_slave(state, port):
            warnings.append(
                f'{key}: {port} is currently a bridge slave; it will be removed '
                f'from that bridge so it can act as a WAN'
            )

    # Retiring the defconf client drops the router's current default route. If
    # that is the only uplink, the tunnel goes with it until the new client binds.
    if 'defconf' in state.get('dhcp_clients', ''):
        warnings.append(
            'The existing DHCP client keeps its address and its default route — the '
            f'route is demoted to distance {FALLBACK_ROUTE_DISTANCE} so the dual-WAN '
            'routes win, and stays as the fallback if they do not. The router is not '
            'left without a route at any point.'
        )

    return blockers, warnings


def _lan_address(state, lan):
    for addr in _addresses_on(state, lan):
        return addr
    return None


def _same_subnet(addr_a, addr_b):
    if not addr_a or not addr_b:
        return False
    try:
        net_a = ipaddress.ip_interface(addr_a).network
        net_b = ipaddress.ip_interface(addr_b).network
    except ValueError:
        return False
    return net_a.overlaps(net_b)


def verify_lb(device, config):
    """Read the router back and report whether the LB config is actually live.

    Mirrors the service-config verification block. This is the check that was
    missing: RouterOS accepts commands that create invalid rules, so "every
    command ran" is not evidence the router is doing anything.

    Returns a list of ``{id, label, ok, detail}``.
    """
    checks = []

    def check(cid, label, ok, detail):
        checks.append({'id': cid, 'label': label, 'ok': bool(ok), 'detail': detail})

    try:
        state = _read_router_state(device)
    except Exception as exc:  # noqa: BLE001
        return [{'id': 'reachable', 'label': 'Router reachable for verification',
                 'ok': False, 'detail': str(exc)[:200]}]

    if config.get('mode') == 'off':
        leftover = LB_COMMENT in state.get('mangle', '') or LB_COMMENT in state.get('routes', '')
        check('torn-down', 'Load-balancing artifacts removed', not leftover,
              'no infora-lb objects remain' if not leftover else 'infora-lb objects still present')
        return checks

    if 'lines' not in config:
        normalised, err = validate_wan_config(config)
        if err:
            return [{'id': 'config', 'label': 'Stored wan_config is valid',
                     'ok': False, 'detail': err}]
        config = normalised
    lines = config.get('lines') or []

    # 1. Both WAN ports must be free of a bridge, or everything else is invalid.
    for line in lines:
        key, wan = line['id'], line
        slave = _iface_is_slave(state, wan['port'])
        check(f'{key}-free', f'{_line_name(line)} port is not a bridge slave', not slave,
              f'{wan["port"]} is standalone' if not slave
              else f'{wan["port"]} is still enslaved — its rules will be invalid')

    # 2. RouterOS's own verdict on our objects.
    invalid = _invalid_lb_objects(state)
    check('no-invalid', 'No infora-lb rule rejected by RouterOS', not invalid,
          'all rules accepted' if not invalid
          else '; '.join(f'{sec}: {why}' for sec, why in invalid[:3])[:300])

    # 3. Each WAN needs an address, and not one from our own LAN.
    lan_addr = _lan_address(state, config['lan_interface'])
    for line in lines:
        key, wan = line['id'], line
        addrs = _addresses_on(state, wan['port'])
        in_lan = any(_same_subnet(a, lan_addr) for a in addrs)
        check(f'{key}-address', f'{_line_name(line)} has an upstream address',
              bool(addrs) and not in_lan,
              (f'{wan["port"]}: {", ".join(addrs)}' if addrs else f'{wan["port"]}: no address')
              + (' — inside the LAN subnet' if in_lan else ''))

    # 4. Routing tables present and the defaults actually installed.
    tables = state.get('tables', '')
    wanted = [_table_for(line['id']) for line in lines]
    missing = [name for name in wanted if name not in tables]
    check('tables', 'Per-WAN routing tables exist', not missing,
          f'{", ".join(wanted)} present' if not missing
          else f'missing: {", ".join(missing)}')

    routes = state.get('routes', '')
    active_defaults = sum(
        1 for line in routes.splitlines()
        if '0.0.0.0/0' in line and 'A' in line.split('0.0.0.0/0')[0]
    )
    check('default-active', 'At least one default route is active', active_defaults > 0,
          f'{active_defaults} active default route(s)')

    # 5. A *working* masquerade per WAN, else LAN clients leave un-NATed and get
    #    no replies. Presence is not enough: the rule Kifaru had named a bridge
    #    slave, so RouterOS flagged it invalid while the text still matched a grep.
    nat = state.get('nat', '')
    for line in lines:
        key, wan = line['id'], line
        needle = f'out-interface={wan["port"]}'
        present = needle in nat
        active = _rule_is_active(nat, needle)
        check(f'{key}-nat', f'{_line_name(line)} masquerade is active', active,
              f'srcnat masquerade out {wan["port"]}' if active
              else (f'present but rejected by RouterOS (invalid/disabled) — '
                    f'traffic out {wan["port"]} is not NAT\'d' if present
                    else f'no masquerade for {wan["port"]}'))

    return checks


def push_lb_steps(device, steps):
    """Run the (label, command) steps over SSH — the 'Apply now' path.

    Mirrors device_config_ops.configure_services: never raises on router-side
    failures; the ordered log captures what happened for the UI.
    """
    from services.device_config_ops import mikrotik_ssh, connection_host

    log = [{'step': 'queued', 'status': 'ok', 'detail': 'Applying dual-WAN configuration...'}]
    try:
        with mikrotik_ssh(device, timeout=12, lock_wait=30) as client:
            log.append({'step': 'connect', 'status': 'ok', 'detail': f'Connected to {connection_host(device)} via SSH'})
            for label, command in steps:
                try:
                    _out, err = client.run_cli(command)
                    if err and err.strip():
                        log.append({'step': label, 'status': 'error', 'detail': err.strip()[:300]})
                    else:
                        log.append({'step': label, 'status': 'ok', 'detail': f'{label} applied'})
                except Exception as exc:
                    log.append({'step': label, 'status': 'error', 'detail': str(exc)[:300]})
    except Exception as exc:
        log.append({'step': 'connect', 'status': 'error', 'detail': str(exc)[:300]})
        return {'success': False, 'log': log}

    failed = [e for e in log if e['status'] == 'error']
    log.append({
        'step': 'done', 'status': 'ok' if not failed else 'error',
        'detail': 'Dual-WAN configuration applied.' if not failed else 'Completed with errors — see log.',
    })
    return {'success': not failed, 'log': log}


def build_lb_remove_script(device, config=None):
    """Full teardown .rsc for the Disable action."""
    steps = build_lb_remove_steps(config)
    header = [
        f'# Infora dual-WAN — DISABLE / rollback for {getattr(device, "device_name", "router")}',
        f'# Removes every comment="{LB_COMMENT}" artifact and restores single-WAN NAT.',
        '',
    ]
    lines = header + [cmd for _, cmd in steps] + ['', ':put "Infora dual-WAN removed."']
    return '\n'.join(lines) + '\n'
