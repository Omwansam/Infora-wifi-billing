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

LB_COMMENT = 'infora-lb'
DEFAULT_LAN = 'infora-bridge'
META_LIST = 'infora-meta'          # address-list of Meta/Facebook prefixes (app_steer)
DEFAULT_SUB_LIST = 'ISP2-SUBS'     # subscriber address-list RADIUS can populate (app_steer)
VALID_MODES = ('off', 'failover', 'load_balance', 'app_steer')
VALID_WAN_TYPES = ('static', 'dhcp', 'pppoe')
DEFAULT_PROBES = ('8.8.8.8', '1.0.0.1')

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
    """Validate + normalise a wan_config dict. Returns (clean, error_or_None)."""
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
        'probe_hosts': [],
        'pin_management_to': config.get('pin_management_to') or None,
        'subscriber_list': (config.get('subscriber_list') or DEFAULT_SUB_LIST).strip(),
    }
    if clean['primary_wan'] not in ('wan1', 'wan2'):
        clean['primary_wan'] = 'wan1'

    if mode == 'off':
        return clean, None

    for key in ('wan1', 'wan2'):
        wan = config.get(key) or {}
        port = (wan.get('port') or '').strip()
        wtype = (wan.get('type') or 'dhcp').strip().lower()
        if not port:
            return None, f'{key}.port is required'
        if wtype not in VALID_WAN_TYPES:
            return None, f'{key}.type must be one of {", ".join(VALID_WAN_TYPES)}'
        cleaned_wan = {'port': port, 'type': wtype, 'weight': int(wan.get('weight') or 1)}
        if wtype == 'static':
            ip = (wan.get('ip') or '').strip()
            gw = (wan.get('gateway') or '').strip()
            try:
                ipaddress.ip_interface(ip)          # e.g. 100.64.0.2/30
                ipaddress.ip_address(gw)
            except ValueError:
                return None, f'{key}: static WAN needs a valid ip (CIDR) and gateway'
            cleaned_wan['ip'] = ip
            cleaned_wan['gateway'] = gw
        clean[key] = cleaned_wan

    if clean['wan1']['port'] == clean['wan2']['port']:
        return None, 'wan1 and wan2 must use different ports'
    if clean['wan1']['weight'] < 1 or clean['wan2']['weight'] < 1:
        return None, 'weights must be >= 1'

    probes = config.get('probe_hosts') or list(DEFAULT_PROBES)
    for host in probes[:2]:
        try:
            ipaddress.ip_address(str(host).strip())
        except ValueError:
            return None, f'probe host {host!r} is not a valid IP'
    clean['probe_hosts'] = [str(h).strip() for h in probes[:2]] or list(DEFAULT_PROBES)
    if len(clean['probe_hosts']) < 2:
        clean['probe_hosts'] = list(DEFAULT_PROBES)

    return clean, None


def _pcc_buckets(w1, w2):
    """Classifier buckets for a weighted 2-way PCC split, e.g. 3:1 → 4 buckets."""
    total = w1 + w2
    return [('WAN1_conn' if i < w1 else 'WAN2_conn', total, i) for i in range(total)]


def _tbl(name, ros7):
    return f'routing-table={name}' if ros7 else f'routing-mark={name}'


def _addr_route_cmds(wan_key, gw, own_table, other_table, probe, ros7):
    """Gateway-dependent routes contributed by one WAN's gateway:

    * its own routing table's **primary** default (distance 1),
    * the **other** table's **backup** default (distance 2) — so PCC/steered
      traffic pinned to the other WAN fails over here when that WAN dies,
    * its ``/32`` probe route (for the main-table recursive default).

    Returned as bare ``/ip route add …`` strings so they're emitted directly
    (static) or wrapped into the DHCP lease script (dhcp)."""
    n = '1' if wan_key == 'wan1' else '2'
    return [
        f'/ip route add dst-address=0.0.0.0/0 gateway={gw} {_tbl(own_table, ros7)} '
        f'distance=1 check-gateway=ping comment="{LB_COMMENT}-gw{n}"',
        f'/ip route add dst-address=0.0.0.0/0 gateway={gw} {_tbl(other_table, ros7)} '
        f'distance=2 check-gateway=ping comment="{LB_COMMENT}-bk{n}"',
        f'/ip route add dst-address={probe}/32 gateway={gw} scope=10 '
        f'comment="{LB_COMMENT}-probe{n}"',
    ]


def _lease_script(wan_key, own_table, other_table, probe, ros7):
    """Single-line DHCP-client script: rebuild this WAN's three gateway-dependent
    routes (own primary, other-table backup, probe) on every lease bind using the
    learned $"gateway-address"."""
    n = '1' if wan_key == 'wan1' else '2'
    gw = '\\$\\"gateway-address\\"'
    return (
        f':if (\\$bound=1) do={{'
        f' /ip route remove [find comment~\\"{LB_COMMENT}-gw{n}\\"];'
        f' /ip route remove [find comment~\\"{LB_COMMENT}-bk{n}\\"];'
        f' /ip route remove [find comment~\\"{LB_COMMENT}-probe{n}\\"];'
        f' /ip route add dst-address=0.0.0.0/0 gateway={gw} {_tbl(own_table, ros7)}'
        f' distance=1 check-gateway=ping comment=\\"{LB_COMMENT}-gw{n}\\";'
        f' /ip route add dst-address=0.0.0.0/0 gateway={gw} {_tbl(other_table, ros7)}'
        f' distance=2 check-gateway=ping comment=\\"{LB_COMMENT}-bk{n}\\";'
        f' /ip route add dst-address={probe}/32 gateway={gw} scope=10'
        f' comment=\\"{LB_COMMENT}-probe{n}\\"'
        f' }}'
    )


def build_lb_steps(device, config):
    """Ordered (label, single-line RouterOS command) steps for a wan_config.

    ``off`` returns the teardown steps. All commands are idempotent and tagged
    ``infora-lb`` (routes use ``infora-lb-*`` sub-tags).
    """
    ros7 = _ros_major(device) >= 7
    mode = config['mode']
    if mode == 'off':
        return build_lb_remove_steps(config)

    lan = config['lan_interface']
    w1, w2 = config['wan1'], config['wan2']
    p1, p2 = config['probe_hosts'][0], config['probe_hosts'][1]
    primary_is_1 = config['primary_wan'] != 'wan2'
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
    for key, wan in (('wan1', w1), ('wan2', w2)):
        add(f'reclaim-{key}',
            f':do {{/interface bridge port remove [find interface={wan["port"]}]}} on-error={{}}')

    # --- 1b. Retire the defconf uplink -----------------------------------------
    #     `defconf` ships a DHCP client with add-default-route=yes on the bridge
    #     that owns ether1. Left in place it keeps installing a competing
    #     distance-1 default, so the recursive failover defaults below never win
    #     and the WAN the router actually uses is not one we manage. Its dynamic
    #     address disappears with it.
    add('retire-defconf-dhcp',
        ':do {/ip dhcp-client remove [find comment="defconf"]} on-error={}')
    #     Any other client already bound to a WAN port (ours from a previous run,
    #     or one added by hand) is replaced by the one we add below.
    for key, wan in (('wan1', w1), ('wan2', w2)):
        add(f'clear-dhcp-{key}',
            f':do {{/ip dhcp-client remove [find interface={wan["port"]}]}} on-error={{}}')

    # --- 2. WAN addressing (static address / dhcp client) ---------------------
    add('wan-addr-reset', f':do {{/ip address remove [find comment="{LB_COMMENT}"]}} on-error={{}}')
    add('dhcp-reset', f':do {{/ip dhcp-client remove [find comment="{LB_COMMENT}"]}} on-error={{}}')
    # (own_table, other_table) so each WAN also seeds the other table's backup.
    wan_plan = (
        ('wan1', w1, 'to_WAN1', 'to_WAN2', p1),
        ('wan2', w2, 'to_WAN2', 'to_WAN1', p2),
    )
    for key, wan, own_tbl, other_tbl, probe in wan_plan:
        if wan['type'] == 'static':
            add(f'{key}-addr',
                f'/ip address add interface={wan["port"]} address={wan["ip"]} comment="{LB_COMMENT}"')
        elif wan['type'] == 'dhcp':
            script = _lease_script(key, own_tbl, other_tbl, probe, ros7)
            add(f'{key}-dhcp',
                f'/ip dhcp-client add interface={wan["port"]} add-default-route=no '
                f'use-peer-dns=no comment="{LB_COMMENT}" script="{script}"')

    # --- 3. Routing tables (v7 only; v6 uses routing-mark on the route) --------
    if ros7:
        add('table-wan1', f':do {{/routing table add name=to_WAN1 fib comment="{LB_COMMENT}"}} on-error={{}}')
        add('table-wan2', f':do {{/routing table add name=to_WAN2 fib comment="{LB_COMMENT}"}} on-error={{}}')

    # --- 4. Gateway-dependent routes: static emits directly; dhcp via lease ----
    for key, wan, own_tbl, other_tbl, probe in wan_plan:
        if wan['type'] == 'static':
            for i, cmd in enumerate(_addr_route_cmds(key, wan['gateway'], own_tbl, other_tbl, probe, ros7)):
                add(f'{key}-route{i}', cmd)

    # --- 5. Probe blackholes (safety net, proven in the field) -----------------
    #     Each probe /32 has a real route via its WAN gateway (distance 1). Pair
    #     it with a high-distance blackhole so that if the WAN drops and the real
    #     route goes inactive, the probe is DROPPED here — it can't leak out the
    #     surviving WAN and falsely report the dead one healthy. distance=250 >> 1
    #     means the real route always wins the instant it returns (no shadowing).
    for probe in (p1, p2):
        add(f'blackhole-{probe}',
            f'/ip route add dst-address={probe}/32 type=blackhole distance=250 '
            f'scope=10 comment="{LB_COMMENT}"')

    # --- 6. Recursive, distance-ordered main defaults (failover core) ----------
    #     Reached via the /32 probe routes → detects UPSTREAM outages, not just a
    #     dead local gateway.
    d1, d2 = (1, 2) if primary_is_1 else (2, 1)
    add('main-default-1',
        f'/ip route add dst-address=0.0.0.0/0 gateway={p1} distance={d1} '
        f'check-gateway=ping target-scope=11 comment="{LB_COMMENT}"')
    add('main-default-2',
        f'/ip route add dst-address=0.0.0.0/0 gateway={p2} distance={d2} '
        f'check-gateway=ping target-scope=11 comment="{LB_COMMENT}"')

    # --- 6. Inbound / reply stickiness (all modes) — replies leave the WAN they
    #     arrived on, so port-forwards / hotspot replies stay symmetric.
    add('mangle-in-1', f'/ip firewall mangle add chain=input in-interface={w1["port"]} '
        f'action=mark-connection new-connection-mark=WAN1_conn passthrough=yes comment="{LB_COMMENT}"')
    add('mangle-in-2', f'/ip firewall mangle add chain=input in-interface={w2["port"]} '
        f'action=mark-connection new-connection-mark=WAN2_conn passthrough=yes comment="{LB_COMMENT}"')
    add('mangle-out-1', f'/ip firewall mangle add chain=output connection-mark=WAN1_conn '
        f'action=mark-routing new-routing-mark=to_WAN1 comment="{LB_COMMENT}"')
    add('mangle-out-2', f'/ip firewall mangle add chain=output connection-mark=WAN2_conn '
        f'action=mark-routing new-routing-mark=to_WAN2 comment="{LB_COMMENT}"')

    # --- 7. Classifier (the only per-mode branch) ------------------------------
    if mode == 'load_balance':
        for i, (conn_mark, total, rem) in enumerate(_pcc_buckets(w1['weight'], w2['weight'])):
            add(f'pcc-{i}', f'/ip firewall mangle add chain=prerouting in-interface={lan} '
                f'connection-state=new dst-address-type=!local action=mark-connection '
                f'new-connection-mark={conn_mark} per-connection-classifier=both-addresses:{total}/{rem} '
                f'passthrough=yes comment="{LB_COMMENT}"')
        for tbl, mark in (('to_WAN1', 'WAN1_conn'), ('to_WAN2', 'WAN2_conn')):
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
    if pin in ('wan1', 'wan2'):
        tbl = 'to_WAN1' if pin == 'wan1' else 'to_WAN2'
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
    add('nat-1', f'/ip firewall nat add chain=srcnat out-interface={w1["port"]} action=masquerade comment="{LB_COMMENT}"')
    add('nat-2', f'/ip firewall nat add chain=srcnat out-interface={w2["port"]} action=masquerade comment="{LB_COMMENT}"')

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
    if any(w['type'] == 'pppoe' for w in (w1, w2)):
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
        ('remove-dhcp', f':do {{/ip dhcp-client remove [find comment="{LB_COMMENT}"]}} on-error={{}}'),
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


def _addresses_on(state, port):
    """Every address string currently configured on ``port``."""
    found, current = [], None
    for line in state.get('addresses', '').splitlines():
        if 'address=' in line:
            current = line
        if f'interface={port}' in line or f'actual-interface={port}' in line:
            source = current or line
            for token in source.split():
                if token.startswith('address='):
                    found.append(token.split('=', 1)[1])
            current = None
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
    blockers, warnings = [], []
    if config.get('mode') == 'off':
        return blockers, warnings

    try:
        state = _read_router_state(device)
    except Exception as exc:  # noqa: BLE001 — unreachable router is a blocker
        return [f'Could not read the router to pre-check: {exc}'], warnings

    lan = config['lan_interface']
    interfaces = state.get('interfaces', '')

    for key in ('wan1', 'wan2'):
        port = config[key]['port']

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

        if _iface_is_slave(state, port):
            warnings.append(
                f'{key}: {port} is currently a bridge slave; it will be removed '
                f'from that bridge so it can act as a WAN'
            )

    # Retiring the defconf client drops the router's current default route. If
    # that is the only uplink, the tunnel goes with it until the new client binds.
    if 'defconf' in state.get('dhcp_clients', ''):
        warnings.append(
            'The defconf DHCP client will be removed. It currently provides this '
            "router's default route, so management access drops until the new WAN "
            'client binds — take a backup and be ready for a site visit.'
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

    w1, w2 = config['wan1'], config['wan2']

    # 1. Both WAN ports must be free of a bridge, or everything else is invalid.
    for key, wan in (('wan1', w1), ('wan2', w2)):
        slave = _iface_is_slave(state, wan['port'])
        check(f'{key}-free', f'{key.upper()} port is not a bridge slave', not slave,
              f'{wan["port"]} is standalone' if not slave
              else f'{wan["port"]} is still enslaved — its rules will be invalid')

    # 2. RouterOS's own verdict on our objects.
    invalid = _invalid_lb_objects(state)
    check('no-invalid', 'No infora-lb rule rejected by RouterOS', not invalid,
          'all rules accepted' if not invalid
          else '; '.join(f'{sec}: {why}' for sec, why in invalid[:3])[:300])

    # 3. Each WAN needs an address, and not one from our own LAN.
    lan_addr = _lan_address(state, config['lan_interface'])
    for key, wan in (('wan1', w1), ('wan2', w2)):
        addrs = _addresses_on(state, wan['port'])
        in_lan = any(_same_subnet(a, lan_addr) for a in addrs)
        check(f'{key}-address', f'{key.upper()} has an upstream address',
              bool(addrs) and not in_lan,
              (f'{wan["port"]}: {", ".join(addrs)}' if addrs else f'{wan["port"]}: no address')
              + (' — inside the LAN subnet' if in_lan else ''))

    # 4. Routing tables present and the defaults actually installed.
    tables = state.get('tables', '')
    have_tables = 'to_WAN1' in tables and 'to_WAN2' in tables
    check('tables', 'Per-WAN routing tables exist', have_tables,
          'to_WAN1 and to_WAN2 present' if have_tables else 'routing tables missing')

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
    for key, wan in (('wan1', w1), ('wan2', w2)):
        needle = f'out-interface={wan["port"]}'
        present = needle in nat
        active = _rule_is_active(nat, needle)
        check(f'{key}-nat', f'{key.upper()} masquerade is active', active,
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
