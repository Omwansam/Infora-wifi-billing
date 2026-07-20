"""Connect to a registered MikroTik and run provisioning/status operations.

Used by the device onboarding wizard:
  - get_provision_status(): staged progress (fetch → tunnel → reachable → self-check).
  - run_self_check(): verify every artifact the provisioning script creates.
  - list_interfaces(): full port map (all interface types + device summary).
  - set_interface_disabled(): enable/disable a port (uplink guarded).
  - configure_services(): push bridge/pool/DHCP/PPPoE/Hotspot config and
    return an ordered log (rendered live on the "Router is live" screen).

For NAT routers the management WireGuard tunnel IP is used as the connect host;
otherwise the registered device_ip is used.
"""
import contextlib
import fcntl
import ipaddress
import os
import re
import socket
import time

from mikrotik_client import (
    ConnectionType,
    MikroTikClient,
    MikroTikConnectionConfig,
    MikroTikSSHError,
)
from services.encryption import decrypt_value


DEFAULT_SUBNET = '172.31.0.0/16'
BRIDGE_NAME = 'infora-bridge'
POOL_NAME = 'infora-pool'
PPPOE_POOL_NAME = 'infora-pppoe-pool'
PPPOE_PROFILE_NAME = 'infora-pppoe'
DHCP_NAME = 'infora-dhcp'
MGMT_ACCESS_COMMENT = 'infora-mgmt-access'
WG_WATCHDOG_COMMENT = 'infora-wg-watchdog'
INTERFACE_NAME_RE = re.compile(r'^[\w.\-/]+$')


def connection_host(device):
    """Host to connect to: management tunnel IP for NAT routers, else device_ip."""
    if device.management_wg_enabled and device.management_wg_ip:
        return device.management_wg_ip.split('/')[0]
    return device.device_ip


def _ssh_config(device, timeout=8):
    return MikroTikConnectionConfig(
        host=connection_host(device),
        port=device.ssh_port or 22,
        username=device.username,
        password=decrypt_value(device.password) or '',
        connection_type=ConnectionType.SSH,
        timeout=timeout,
        verify_ssl=False,
    )


class DeviceBusy(Exception):
    """Raised when the per-device SSH lock can't be acquired in time.

    Pollers catch this and return last-known/empty data instead of opening a
    competing SSH session (which is what caused the router to drop connections
    mid-banner in the first place).
    """


_LOCK_DIR = '/tmp'


@contextlib.contextmanager
def _device_ssh_file_lock(device_id, wait):
    """Cross-process, cross-thread exclusive lock for one device's SSH access.

    Prod runs gunicorn with multiple worker *processes*, so an in-process
    threading.Lock cannot serialize SSH to a router. A flock on a per-device
    file in the shared container filesystem does — and opening a fresh fd per
    acquire makes it serialize the threads within a worker too. The lock frees
    automatically when the fd closes or the worker dies, so no stale locks.
    """
    path = os.path.join(_LOCK_DIR, f'infora-mikrotik-{device_id}.lock')
    fd = os.open(path, os.O_CREAT | os.O_RDWR, 0o644)
    deadline = time.time() + wait
    try:
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except OSError:
                if time.time() >= deadline:
                    raise DeviceBusy(f'device {device_id} SSH is busy')
                time.sleep(0.25)
        yield
    finally:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        except OSError:
            pass
        os.close(fd)


@contextlib.contextmanager
def mikrotik_ssh(device, timeout=12, lock_wait=30, retries=3):
    """Serialized, retrying SSH session to a device.

    Acquires the per-device lock (raising DeviceBusy after ``lock_wait`` s),
    then connects with up to ``retries`` attempts and short backoff — MikroTik
    SSH over the tunnel is flaky and a retry almost always lands. Yields a
    connected MikroTikClient; disconnects and unlocks on exit.
    """
    with _device_ssh_file_lock(device.id, lock_wait):
        last_err = None
        client = None
        for attempt in range(retries):
            client = MikroTikClient(_ssh_config(device, timeout=timeout))
            try:
                if client.connect():
                    break
                last_err = MikroTikSSHError('connect() returned False')
            except Exception as exc:  # noqa: BLE001 — retry any connect failure
                last_err = exc
            client.disconnect()
            client = None
            if attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
        if client is None:
            raise MikroTikSSHError(
                f'SSH to {connection_host(device)} failed after {retries} attempts: {last_err}'
            )
        try:
            yield client
        finally:
            client.disconnect()


def _parse_kv(output):
    """Parse RouterOS 'name: value' print output into a dict."""
    info = {}
    for line in (output or '').splitlines():
        if ':' in line:
            key, _, value = line.partition(':')
            info[key.strip()] = value.strip()
    return info


def _detect_router_info(client):
    """Best-effort read of board-name + RouterOS version from a connected router."""
    detected = {}
    try:
        out, _err = client.run_cli('/system resource print')
        info = _parse_kv(out)
        if info.get('board-name'):
            detected['model'] = info['board-name']
        if info.get('version'):
            detected['version'] = info['version']
    except Exception:
        pass
    return detected


def probe_tunnel(device, timeout=2):
    """Check two-way connectivity to the router's management tunnel IP.

    A TCP reply through the tunnel proves the WireGuard handshake completed
    (the packet round-trips inside the encrypted tunnel). Tries SSH, Winbox
    and the API port so a firewalled service doesn't cause a false negative.
    """
    if not (device.management_wg_enabled and device.management_wg_ip):
        return {'up': False, 'applicable': False, 'detail': 'Management tunnel not enabled'}

    host = device.management_wg_ip.split('/')[0]
    ports = [device.ssh_port or 22, 8291, device.api_port or 8728]
    for port in ports:
        start = time.time()
        try:
            with socket.create_connection((host, port), timeout=timeout):
                ms = int((time.time() - start) * 1000)
                return {
                    'up': True,
                    'applicable': True,
                    'detail': f'Reply from {host} in {ms} ms (tcp/{port})',
                }
        except OSError:
            continue
    return {'up': False, 'applicable': True, 'detail': f'No reply from {host} yet'}


def _parse_terse_rows(output):
    """Parse 'print terse' output into dicts, keeping RouterOS flag letters.

    Terse lines look like ``0  R name=ether1 type=ether …`` where the letters
    before the first key=value token are flags (R=running, X=disabled, S=slave,
    D=dynamic). Returns rows with a ``_flags`` string alongside the fields.
    """
    rows = []
    for line in (output or '').splitlines():
        line = line.strip()
        if not line or line.startswith(('#', ';;;')):
            continue
        flags = ''
        fields = {}
        seen_kv = False
        for token in line.split():
            if '=' in token:
                seen_kv = True
                key, _, value = token.partition('=')
                fields[key] = value
            elif not seen_kv and not token.isdigit():
                flags += token
        if fields:
            fields['_flags'] = flags
            rows.append(fields)
    return rows


def _row_running(row):
    return 'R' in row.get('_flags', '') or row.get('running') == 'true'


def _row_disabled(row):
    return 'X' in row.get('_flags', '') or row.get('disabled') == 'true'


def run_self_check(device):
    """Verify, on the router, every artifact the provisioning script creates.

    One SSH session, one row per check: {id, label, ok, detail}. Raises
    RuntimeError when the router cannot be reached at all.
    """
    from datetime import datetime

    checks = []

    def add(check_id, label, ok, detail=''):
        checks.append({'id': check_id, 'label': label, 'ok': bool(ok), 'detail': detail})

    wg_enabled = bool(device.management_wg_enabled and device.management_wg_ip)

    with mikrotik_ssh(device, timeout=12, lock_wait=30) as client:
        def cli(command):
            out, _err = client.run_cli(command)
            return out or ''

        if wg_enabled:
            add('wg_interface', 'wg-mgmt interface exists',
                'wg-mgmt' in cli('/interface wireguard print terse'))
            add('wg_peer', 'Billing server WireGuard peer exists',
                'infora-billing-mgmt' in cli('/interface wireguard peers print terse'))
            add('wg_address', 'Tunnel VPN address exists',
                'infora-mgmt-tunnel' in cli('/ip address print terse'))
            add('wg_route', 'Route to billing server via tunnel exists',
                'infora-radius-via-tunnel' in cli('/ip route print terse'))

        add('radius_client', 'RADIUS client entry exists',
            'infora-billing' in cli('/radius print terse'))
        incoming = _parse_kv(cli('/radius incoming print'))
        add('radius_incoming', 'RADIUS incoming (CoA/disconnect) accepted',
            incoming.get('accept') == 'yes')
        aaa = _parse_kv(cli('/ppp aaa print'))
        add('ppp_aaa', 'PPPoE AAA uses RADIUS',
            aaa.get('use-radius') == 'yes')

        filter_out = cli('/ip firewall filter print terse')
        add('fasttrack_absent', 'FastTrack removed (accounting integrity)',
            'fasttrack-connection' not in filter_out)
        if wg_enabled:
            add('mgmt_firewall', 'Winbox/API/SSH firewall rule exists (tunnel only)',
                MGMT_ACCESS_COMMENT in filter_out)

        add('nat_masquerade', 'NAT masquerade rule exists',
            'infora-masquerade' in cli('/ip firewall nat print terse'))

        snmp = _parse_kv(cli('/snmp print'))
        add('snmp', 'SNMP monitoring enabled',
            snmp.get('enabled') in ('yes', 'true'))

        mgmt_user = (device.username or '').strip()
        if mgmt_user:
            add('mgmt_user', 'Billing management user exists',
                f'name={mgmt_user}' in cli('/user print terse'))

        services = {r.get('name'): r for r in _parse_terse_rows(cli('/ip service print terse'))}
        api_row = services.get('api')
        api_port = str(device.api_port or 8728)
        add('api_service', f'API service enabled on port {api_port}',
            bool(api_row) and not _row_disabled(api_row) and (api_row.get('port') or '8728') == api_port,
            f"port {api_row.get('port')}" if api_row else 'api service not found')
        ssh_row = services.get('ssh')
        add('ssh_service', 'SSH service enabled',
            bool(ssh_row) and not _row_disabled(ssh_row))

        if wg_enabled:
            add('wg_watchdog', 'WireGuard watchdog (netwatch) exists',
                WG_WATCHDOG_COMMENT in cli('/tool netwatch print terse'))

    passed = sum(1 for c in checks if c['ok'])
    return {
        'passed': passed,
        'total': len(checks),
        'ok': passed == len(checks),
        'checks': checks,
        'at': datetime.now().isoformat(),
    }


def get_provision_status(device):
    """Return staged onboarding progress for the wizard's live checklist.

    Stages: command_generated → script_fetched → tunnel_up → reachable →
    self_check (cached summary from the device row). ``online`` is kept for
    backward compatibility: SSH-reachable OR script fetched recently (the WG
    tunnel may be up from the router's side while Docker routing converges).

    When SSH-reachable, also auto-detects the router model/version.
    """
    import json as _json
    from datetime import datetime, timedelta

    fetched = bool(device.provision_fetch_count and device.provision_fetch_count > 0)
    host = connection_host(device)
    reachable = False
    error = None
    detected = {}

    tunnel = probe_tunnel(device)

    if fetched or tunnel['up']:
        try:
            # Poller: don't wait long for the lock and never open a competing
            # SSH session. If another op holds the device (e.g. configure), the
            # router IS reachable — reflect the tunnel probe and skip detection.
            with mikrotik_ssh(device, timeout=10, lock_wait=1, retries=2) as client:
                reachable = True
                detected = _detect_router_info(client)
        except DeviceBusy:
            reachable = tunnel['up']
            error = 'Router busy (another operation in progress)'
        except Exception as exc:
            error = str(exc)

    # Consider the device "online" if script was fetched recently even when
    # SSH isn't reachable (tunnel routing may still be converging).
    recently_fetched = (
        fetched
        and device.provision_last_fetched_at
        and (datetime.now() - device.provision_last_fetched_at) < timedelta(minutes=10)
    )
    online = reachable or recently_fetched

    # Cached self-check summary (run by the route once reachable, or on demand)
    self_check = None
    if getattr(device, 'self_check_result', None):
        try:
            cached = _json.loads(device.self_check_result)
            self_check = {
                'done': True,
                'ok': cached.get('ok', False),
                'passed': cached.get('passed', 0),
                'total': cached.get('total', 0),
                'checks': cached.get('checks', []),
                'at': cached.get('at'),
            }
        except (ValueError, TypeError):
            self_check = None
    if self_check is None:
        self_check = {'done': False, 'ok': False, 'passed': 0, 'total': 0, 'checks': [], 'at': None}

    stages = {
        'command_generated': bool(device.provision_token),
        'script_fetched': {
            'done': fetched,
            'count': device.provision_fetch_count or 0,
            'at': device.provision_last_fetched_at.isoformat() if device.provision_last_fetched_at else None,
        },
        'tunnel_up': {
            'done': tunnel['up'],
            'applicable': tunnel['applicable'],
            'detail': tunnel['detail'],
        },
        'reachable': {
            'done': reachable,
            'detail': f'Connected to {host} via SSH' if reachable else (error or 'Not reachable yet'),
        },
        'self_check': self_check,
    }
    complete = (
        fetched
        and (tunnel['up'] or not tunnel['applicable'])
        and reachable
        and self_check['done'] and self_check['ok']
    )

    return {
        'fetched': fetched,
        'fetch_count': device.provision_fetch_count or 0,
        'last_fetched_at': device.provision_last_fetched_at.isoformat() if device.provision_last_fetched_at else None,
        'reachable': reachable,
        'online': online,
        'host': host,
        'management_wg_ip': device.management_wg_ip,
        'detected': detected,
        'error': error,
        'stages': stages,
        'complete': complete,
    }


def _parse_terse(output):
    """Parse RouterOS '... print terse' output into a list of dicts."""
    rows = []
    for line in (output or '').splitlines():
        line = line.strip()
        if not line or line[0] in ('#',):
            continue
        fields = {}
        for token in line.split():
            if '=' in token:
                key, _, value = token.partition('=')
                fields[key] = value
        if fields:
            rows.append(fields)
    return rows


def _classify_interface(name, itype):
    """Map a RouterOS interface to a UI kind for the port map."""
    t = (itype or '').lower()
    n = (name or '').lower()
    if n.startswith('sfp') or '-sfp' in n:
        return 'sfp'
    if t in ('wlan', 'wifi') or n.startswith(('wlan', 'wifi')):
        return 'wlan'
    if t == 'ether':
        return 'ether'
    if t == 'bridge':
        return 'bridge'
    if t == 'vlan':
        return 'vlan'
    if t == 'wg' or n.startswith('wg'):
        return 'wg'
    if 'ppp' in t:
        return 'ppp'
    return t or 'other'


def list_interfaces(device):
    """Full interface discovery for the wizard's Ports step.

    Returns {'interfaces': [...], 'device': {...}, 'counts': {...}} — every
    interface (ethernet, SFP, wireless, bridge, vlan, wg…) with running/
    disabled state, MAC, speed and an uplink hint, plus a summary of the
    router itself (model, RouterOS version, architecture, port counts).
    """
    with mikrotik_ssh(device, timeout=10, lock_wait=30) as client:
        all_out, _ = client.run_cli('/interface print terse')
        eth_out, _ = client.run_cli('/interface ethernet print terse')
        res_out, _ = client.run_cli('/system resource print')

    eth_rows = {r.get('name'): r for r in _parse_terse_rows(eth_out) if r.get('name')}

    interfaces = []
    ether_seen = 0
    for row in _parse_terse_rows(all_out):
        name = row.get('name')
        if not name:
            continue
        kind = _classify_interface(name, row.get('type'))
        eth = eth_rows.get(name, {})
        is_uplink = kind == 'ether' and (ether_seen == 0 or name == 'ether1')
        if kind == 'ether':
            ether_seen += 1
        interfaces.append({
            'name': name,
            'type': row.get('type') or '',
            'kind': kind,
            'running': _row_running(row),
            'disabled': _row_disabled(row),
            'mac': row.get('mac-address') or eth.get('mac-address'),
            'mtu': row.get('mtu'),
            'speed': eth.get('speed'),
            'comment': (row.get('comment') or '').replace('_', ' ') or None,
            'is_uplink': is_uplink,
        })

    res = _parse_kv(res_out)
    physical = [i for i in interfaces if i['kind'] in ('ether', 'sfp', 'wlan')]
    counts = {
        'total': len(interfaces),
        'physical': len(physical),
        'ethernet': sum(1 for i in interfaces if i['kind'] == 'ether'),
        'sfp': sum(1 for i in interfaces if i['kind'] == 'sfp'),
        'wireless': sum(1 for i in interfaces if i['kind'] == 'wlan'),
        'active': sum(1 for i in physical if i['running'] and not i['disabled']),
    }
    device_summary = {
        'model': res.get('board-name') or device.device_model,
        'version': res.get('version'),
        'architecture': res.get('architecture-name'),
        'uptime': res.get('uptime'),
        'cpu_load': res.get('cpu-load'),
        'ports': counts['physical'],
    }

    return {'interfaces': interfaces, 'device': device_summary, 'counts': counts}


def interface_traffic(device):
    """Read rx/tx byte counters for every interface in one SSH call.

    Callers poll this twice and derive per-port throughput from the delta —
    no flow collector needed. Returns {'at': epoch_seconds, 'stats': [...]}.

    Poller: if the device is busy with another SSH op, returns {'busy': True,
    'stats': []} instead of opening a competing session, so the wizard's live
    poll never collides with (or 502s during) discovery/configure.
    """
    try:
        with mikrotik_ssh(device, timeout=8, lock_wait=1, retries=2) as client:
            out, _err = client.run_cli('/interface print stats terse')
    except DeviceBusy:
        return {'at': time.time(), 'stats': [], 'busy': True}

    def _num(value):
        try:
            return int(str(value).replace(',', '').strip() or 0)
        except (TypeError, ValueError):
            return 0

    stats = []
    for row in _parse_terse_rows(out):
        name = row.get('name')
        if not name:
            continue
        stats.append({
            'name': name,
            'rx_bytes': _num(row.get('rx-byte')),
            'tx_bytes': _num(row.get('tx-byte')),
            'rx_packets': _num(row.get('rx-packet')),
            'tx_packets': _num(row.get('tx-packet')),
        })
    return {'at': time.time(), 'stats': stats}


def set_interface_disabled(device, name, disabled):
    """Enable/disable a router interface. Refuses to disable the uplink."""
    if not INTERFACE_NAME_RE.match(name or ''):
        raise ValueError('Invalid interface name')

    discovery = list_interfaces(device)
    target = next((i for i in discovery['interfaces'] if i['name'] == name), None)
    if not target:
        raise ValueError(f'Interface {name} not found on the router')
    if disabled and target['is_uplink']:
        raise ValueError('Refusing to disable the uplink port — it carries the internet feed')

    state = 'yes' if disabled else 'no'
    with mikrotik_ssh(device, timeout=8, lock_wait=30) as client:
        _out, err = client.run_cli(f'/interface set [find name="{name}"] disabled={state}')
        if err and err.strip():
            raise RuntimeError(err.strip()[:200])

    target['disabled'] = disabled
    return target


def _subnet_params(subnet):
    """Deterministic address plan inside the bridge subnet.

    Lower half → hotspot/DHCP pool, upper half → PPPoE pool. Both service
    types can then run on the same bridge without address collisions, and
    PPPoE sessions always have a pool to draw from (RADIUS Framed-IP-Address
    still wins for static-IP plans).
    """
    net = ipaddress.ip_network(subnet, strict=False)
    if net.prefixlen > 29:
        raise ValueError(f'Subnet {net} is too small — use /29 or larger')
    gateway = str(net.network_address + 1)
    lower, upper = net.subnets(prefixlen_diff=1)
    dhcp_start = str(lower.network_address + 2)  # skip network addr + gateway
    dhcp_end = str(lower.broadcast_address)
    pppoe_start = str(upper.network_address)
    pppoe_end = str(upper.broadcast_address - 1)
    return {
        'subnet': str(net),
        'gateway': gateway,
        'gateway_cidr': f'{gateway}/{net.prefixlen}',
        'pool_range': f'{dhcp_start}-{dhcp_end}',
        'pppoe_pool_range': f'{pppoe_start}-{pppoe_end}',
    }


def build_services_commands(opts):
    """Build the ordered (label, RouterOS-CLI) steps for service configuration.

    opts: dict with keys pppoe, hotspot, anti_sharing, bridge_ports (list),
    subnet (str). All commands are idempotent (remove-by-comment, then add).
    """
    params = _subnet_params(opts.get('subnet') or DEFAULT_SUBNET)
    ports = [p for p in (opts.get('bridge_ports') or []) if p]
    steps = []

    # 1. Bridge
    steps.append((
        'bridge',
        f':if ([:len [/interface bridge find name={BRIDGE_NAME}]]=0) do={{'
        f'/interface bridge add name={BRIDGE_NAME} comment="infora-billing"}}',
    ))

    # 2. Bridge ports (skip uplink — caller must not include it)
    for port in ports:
        steps.append((
            f'bridge-port:{port}',
            f':do {{/interface bridge port remove [find interface={port}]}} on-error={{}}; '
            f'/interface bridge port add bridge={BRIDGE_NAME} interface={port}',
        ))

    # 3. Bridge IP address
    steps.append((
        'address',
        f':do {{/ip address remove [find comment="infora-billing"]}} on-error={{}}; '
        f'/ip address add address={params["gateway_cidr"]} interface={BRIDGE_NAME} comment="infora-billing"',
    ))

    # 4. IP pool
    steps.append((
        'pool',
        f':do {{/ip pool remove [find name={POOL_NAME}]}} on-error={{}}; '
        f'/ip pool add name={POOL_NAME} ranges={params["pool_range"]}',
    ))

    # 5. DHCP server + network
    steps.append((
        'dhcp',
        f':do {{/ip dhcp-server remove [find name={DHCP_NAME}]}} on-error={{}}; '
        f'/ip dhcp-server add name={DHCP_NAME} interface={BRIDGE_NAME} address-pool={POOL_NAME} disabled=no; '
        f':do {{/ip dhcp-server network remove [find address={params["subnet"]}]}} on-error={{}}; '
        f'/ip dhcp-server network add address={params["subnet"]} gateway={params["gateway"]} dns-server=8.8.8.8,1.1.1.1',
    ))

    # 6. PPPoE server — dedicated pool + profile so every session gets an
    # address even when RADIUS replies carry no Framed-IP-Address.
    if opts.get('pppoe'):
        steps.append((
            'pppoe-pool',
            f':do {{/ip pool remove [find name={PPPOE_POOL_NAME}]}} on-error={{}}; '
            f'/ip pool add name={PPPOE_POOL_NAME} ranges={params["pppoe_pool_range"]}',
        ))
        steps.append((
            'pppoe-profile',
            f':do {{/ppp profile remove [find name={PPPOE_PROFILE_NAME}]}} on-error={{}}; '
            f'/ppp profile add name={PPPOE_PROFILE_NAME} local-address={params["gateway"]} '
            f'remote-address={PPPOE_POOL_NAME} dns-server=8.8.8.8,1.1.1.1 use-encryption=no',
        ))
        steps.append((
            'pppoe',
            ':do {/interface pppoe-server server remove [find service-name=infora]} on-error={}; '
            f'/interface pppoe-server server add service-name=infora interface={BRIDGE_NAME} '
            f'default-profile={PPPOE_PROFILE_NAME} one-session-per-host=yes disabled=no; '
            '/ppp aaa set use-radius=yes accounting=yes interim-update=5m',
        ))

    # 7. Hotspot (profile + server using RADIUS)
    if opts.get('hotspot'):
        shared = '1' if opts.get('anti_sharing') else '3'
        steps.append((
            'hotspot',
            ':do {/ip hotspot remove [find name=infora]} on-error={}; '
            ':do {/ip hotspot profile remove [find name=infora]} on-error={}; '
            '/ip hotspot profile add name=infora hotspot-address='
            f'{params["gateway"]} use-radius=yes radius-accounting=yes '
            f'radius-interim-update=5m login-by=cookie,http-chap,http-pap shared-users={shared}; '
            f'/ip hotspot add name=infora interface={BRIDGE_NAME} address-pool={POOL_NAME} '
            'profile=infora disabled=no',
        ))

        # Walled garden — allow portal, API, payments, captive probes before auth
        for host in opts.get('walled_garden_hosts') or []:
            safe_host = host.replace('"', '').strip()
            if not safe_host:
                continue
            steps.append((
                f'walled-garden:{safe_host}',
                f':do {{/ip hotspot walled-garden ip remove [find dst-host="{safe_host}"]}} on-error={{}}; '
                f'/ip hotspot walled-garden ip add dst-host="{safe_host}" action=allow comment="infora"',
            ))

        # External captive portal — fetch redirect page that sends users to our SPA
        redirect_api = (opts.get('captive_redirect_fetch_url') or '').replace('"', '')
        if redirect_api:
            steps.append((
                'captive-login',
                ':do {/file remove hotspot/login.html} on-error={}; '
                f':do {{/tool fetch url="{redirect_api}" dst-path=hotspot/login.html mode=https}} on-error={{}}; '
                '/ip hotspot profile set [find name=infora] html-directory=hotspot '
                'login-by=http-chap,cookie,http-pap',
            ))

    # 8. Hotspot anti-sharing (fix TTL so devices behind a shared NAT are detectable)
    if opts.get('hotspot') and opts.get('anti_sharing'):
        steps.append((
            'anti-sharing',
            ':do {/ip firewall mangle remove [find comment="infora-anti-sharing"]} on-error={}; '
            '/ip firewall mangle add chain=postrouting action=change-ttl '
            'new-ttl=set:1 passthrough=yes comment="infora-anti-sharing"',
        ))

    return steps, params


def read_device_info(device):
    """Read live version/board/uptime over SSH. Returns a dict (best-effort)."""
    with mikrotik_ssh(device, timeout=10, lock_wait=30) as client:
        resource, _ = client.run_cli('/system resource print')
        routerboard, _ = client.run_cli('/system routerboard print')
    res = _parse_kv(resource)
    rb = _parse_kv(routerboard)
    return {
        'version': res.get('version'),
        'board_name': res.get('board-name'),
        'uptime': res.get('uptime'),
        'cpu_load': res.get('cpu-load'),
        'free_memory': res.get('free-memory'),
        'architecture': res.get('architecture-name'),
        'current_firmware': rb.get('current-firmware'),
        'upgrade_firmware': rb.get('upgrade-firmware'),
    }


def check_firmware(device):
    """Ask RouterOS whether a newer channel release is available.

    Returns {installed, latest, update_available, channel}. Never raises on
    parse issues — connection failures propagate to the caller.
    """
    with mikrotik_ssh(device, timeout=15, lock_wait=30) as client:
        # check-for-updates contacts MikroTik's upgrade servers, then print shows the result.
        client.run_cli('/system package update check-for-updates')
        out, _ = client.run_cli('/system package update print')
    info = _parse_kv(out)
    installed = info.get('installed-version')
    latest = info.get('latest-version')
    status = (info.get('status') or '').lower()
    update_available = bool(latest and installed and latest != installed) or 'new version is available' in status
    return {
        'installed': installed,
        'latest': latest,
        'channel': info.get('channel'),
        'status': info.get('status'),
        'update_available': update_available,
    }


def upgrade_firmware(device):
    """Trigger a full RouterOS upgrade (downloads, installs, reboots).

    Returns an ordered log. The device will reboot, so the SSH session is
    expected to drop after the install command is issued.
    """
    log = [{'step': 'queued', 'status': 'ok', 'detail': 'Starting firmware upgrade...'}]
    try:
        with mikrotik_ssh(device, timeout=20, lock_wait=30) as client:
            log.append({'step': 'connect', 'status': 'ok', 'detail': f'Connected to {connection_host(device)}'})

            # Upgrade RouterBOOT firmware to match the new RouterOS, then install + reboot.
            try:
                client.run_cli('/system routerboard upgrade')
                log.append({'step': 'routerboard', 'status': 'ok', 'detail': 'RouterBOOT upgrade queued'})
            except Exception as exc:
                log.append({'step': 'routerboard', 'status': 'error', 'detail': str(exc)[:200]})

            try:
                # This downloads + installs and reboots; the session usually drops here.
                out, err = client.run_cli('/system package update install')
                detail = (out or err or 'Install command sent — device rebooting').strip()[:200]
                log.append({'step': 'install', 'status': 'ok', 'detail': detail or 'Install command sent — device rebooting'})
            except Exception:
                # A dropped connection during reboot is the expected/success path.
                log.append({'step': 'install', 'status': 'ok', 'detail': 'Install issued — device is rebooting to apply the upgrade'})
    except Exception as exc:
        log.append({'step': 'connect', 'status': 'error', 'detail': str(exc)[:200]})
        return {'success': False, 'log': log}

    log.append({'step': 'done', 'status': 'ok', 'detail': 'Upgrade in progress. Re-sync once the router is back online.'})
    return {'success': True, 'log': log}


def export_config(device):
    """Return the full RouterOS configuration as text (from /export over SSH)."""
    with mikrotik_ssh(device, timeout=30, lock_wait=30) as client:
        out, err = client.run_cli('/export')
    text = out or ''
    if not text.strip() and err:
        raise RuntimeError(err.strip()[:300])
    return text


def reboot_device(device):
    """Reboot the router over SSH (session drops, which is expected)."""
    try:
        with mikrotik_ssh(device, timeout=10, lock_wait=30) as client:
            try:
                client.run_cli('/system reboot')
            except Exception:
                pass  # connection drop on reboot is expected
    except Exception as exc:
        # A drop right after issuing reboot is success; only report hard pre-connect errors.
        return {'success': True, 'detail': f'Reboot issued ({str(exc)[:120]})'}
    return {'success': True, 'detail': 'Reboot issued'}


def configure_services(device, opts):
    """Connect to the router and push the service configuration.

    Returns a dict with success flag, ordered log, and a summary. Never raises
    on router-side failures — the log captures what happened for the UI.
    """
    from models import ISP
    from services.portal_urls import portal_hostnames, public_base_url

    isp = ISP.query.get(device.isp_id) if device.isp_id else None
    if opts.get('hotspot'):
        if not opts.get('walled_garden_hosts'):
            opts['walled_garden_hosts'] = portal_hostnames(isp)
        base = public_base_url()
        if base and isp and not opts.get('captive_redirect_fetch_url'):
            opts['captive_redirect_fetch_url'] = (
                f'{base}/api/portal/captive-redirect?isp_id={isp.id}&router_id={device.id}'
            )

    log = [{'step': 'queued', 'status': 'ok', 'detail': 'Starting device configuration...'}]
    steps, params = build_services_commands(opts)

    try:
        # Action: wait for the router even if a poll currently holds it, and let
        # mikrotik_ssh retry the flaky MikroTik SSH banner before giving up.
        with mikrotik_ssh(device, timeout=12, lock_wait=30) as client:
            log.append({'step': 'connect', 'status': 'ok', 'detail': f'Connected to {connection_host(device)} via SSH'})

            for label, command in steps:
                try:
                    _out, err = client.run_cli(command)
                    if err and err.strip():
                        log.append({'step': label, 'status': 'error', 'detail': err.strip()[:300]})
                    else:
                        log.append({'step': label, 'status': 'ok', 'detail': f'{label} configured'})
                except Exception as exc:
                    log.append({'step': label, 'status': 'error', 'detail': str(exc)[:300]})
    except Exception as exc:
        log.append({'step': 'connect', 'status': 'error', 'detail': str(exc)[:300]})
        return {'success': False, 'log': log, 'summary': None}

    failed = [entry for entry in log if entry['status'] == 'error']
    success = not failed
    log.append({
        'step': 'done',
        'status': 'ok' if success else 'error',
        'detail': 'Configuration complete.' if success else 'Configuration completed with errors.',
    })

    summary = {
        'services': [s for s in ('PPPoE' if opts.get('pppoe') else None,
                                 'Hotspot' if opts.get('hotspot') else None) if s],
        'ports': [p for p in (opts.get('bridge_ports') or []) if p],
        'subnet': params['subnet'],
        'gateway': params['gateway'],
        'anti_sharing': bool(opts.get('hotspot') and opts.get('anti_sharing')),
    }
    return {'success': success, 'log': log, 'summary': summary}
