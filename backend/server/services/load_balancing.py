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

    # --- 1. Reclaim the WAN2 port from the LAN bridge --------------------------
    add('reclaim-wan2', f':do {{/interface bridge port remove [find interface={w2["port"]}]}} on-error={{}}')

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
    add('nat-reset', ':do {/ip firewall nat remove [find comment="infora-masquerade"]} on-error={}')
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
