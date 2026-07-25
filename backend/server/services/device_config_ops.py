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

# Local "Management" port — a bare ether an operator can plug a laptop into and
# always reach Winbox/WebFig on, independent of the WireGuard tunnel. Fixed to
# RouterOS's familiar default LAN so it never collides with the service subnet.
# Kept off 192.168.88.x on purpose: that is the RouterOS default LAN (defconf
# bridge), so reusing it collides with the factory config on fresh boards.
MGMT_PORT_SUBNET = '192.168.99.0/24'
MGMT_PORT_GATEWAY = '192.168.99.1'
MGMT_PORT_POOL_RANGE = '192.168.99.10-192.168.99.254'
MGMT_BRIDGE_NAME = 'infora-mgmt-bridge'
MGMT_PORT_POOL_NAME = 'infora-mgmt-pool'
MGMT_PORT_DHCP_NAME = 'infora-mgmt-dhcp'
MGMT_PORT_COMMENT = 'infora-mgmt-port'
WAN_DHCP_COMMENT = 'infora-wan-dhcp'
HOTSPOT_ISOLATE_COMMENT = 'infora-hotspot-isolate'


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


def probe_tunnel(device, timeout=2, attempts=1):
    """Check two-way connectivity to the router's management tunnel IP.

    A TCP reply through the tunnel proves the WireGuard handshake completed
    (the packet round-trips inside the encrypted tunnel). Tries SSH, Winbox
    and the API port so a firewalled service doesn't cause a false negative.

    ``attempts`` re-tries the whole port sweep before giving up. Over a NAT'd
    tunnel the very first packet after a brief idle has to wake the WireGuard
    handshake, so a lone 2s connect can time out on a router that is perfectly
    alive — a second sweep almost always lands. Use attempts>1 wherever a false
    "down" would wrongly flip a live router OFFLINE.
    """
    if not (device.management_wg_enabled and device.management_wg_ip):
        return {'up': False, 'applicable': False, 'detail': 'Management tunnel not enabled'}

    host = device.management_wg_ip.split('/')[0]
    ports = [device.ssh_port or 22, 8291, device.api_port or 8728]
    for attempt in range(max(1, attempts)):
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
        if attempt < max(1, attempts) - 1:
            time.sleep(0.5)
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

        # Service artifacts — verify only what this device is configured for, so
        # a "configured OK" result can no longer hide a missing hotspot/PPPoE
        # server (the gap that let the captive portal / PPPoE dial silently fail).
        import json as _json
        svc_cfg = {}
        if device.service_config:
            try:
                svc_cfg = (_json.loads(device.service_config)
                           if isinstance(device.service_config, str)
                           else (device.service_config or {}))
            except (ValueError, TypeError):
                svc_cfg = {}
        svc_summary = svc_cfg.get('summary') or {}
        svc_services = svc_summary.get('services') or svc_cfg.get('services') or []
        svc_roles = svc_cfg.get('port_roles') or svc_summary.get('port_roles') or {}
        role_vals = list(svc_roles.values())
        want_hotspot = 'Hotspot' in svc_services or any(r in ('hotspot', 'both') for r in role_vals)
        want_pppoe = 'PPPoE' in svc_services or any(r in ('pppoe', 'both') for r in role_vals)
        want_mgmt = 'Management' in svc_services or any(r == 'management' for r in role_vals)

        if want_hotspot:
            add('hotspot_server', 'Hotspot server exists',
                'infora' in cli('/ip hotspot print terse'))
            add('hotspot_dhcp', 'Hotspot DHCP server exists',
                DHCP_NAME in cli('/ip dhcp-server print terse'))
            add('hotspot_login', 'Captive-portal login page present (else portal is blank)',
                'login.html' in cli('/file print terse'))
            # Without a resolver the hotspot cannot answer (and rewrite) client
            # DNS, so no device ever sees the "Sign in to network" prompt.
            dns = _parse_kv(cli('/ip dns print'))
            add('hotspot_dns', 'Router answers client DNS (captive redirect works)',
                dns.get('allow-remote-requests') == 'yes',
                'allow-remote-requests is off — re-run provisioning')
        if want_pppoe:
            add('pppoe_server', 'PPPoE server exists',
                'infora' in cli('/interface pppoe-server server print terse'))
        if want_mgmt:
            add('mgmt_port', 'Management port address exists',
                MGMT_PORT_COMMENT in cli('/ip address print terse'))

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


def detect_uplink_interfaces(client):
    """Every interface that must never be bridged into a service bridge.

    Returns a set holding the interface carrying the active default route, any
    interface running a DHCP client, and — when either of those is a bridge —
    that bridge's **member ports**.

    Resolving bridge members is the point. RouterOS boards commonly route the
    WAN through a factory bridge (``bridgeLocal``), so ``immediate-gw`` names the
    *bridge*, not the port. Guarding only that name leaves the actual physical
    uplink (e.g. ether1) looking like a free port: the wizard offers it, the
    operator assigns it a service, and the ISP's broadcast domain gets merged
    into the subscriber one — the router loses its own internet and every port
    flaps as two DHCP servers fight.

    Our own bridges are never treated as uplinks, so a stray DHCP client on the
    service bridge can't lock the operator out of assigning any port at all.
    """
    ours = {BRIDGE_NAME, MGMT_BRIDGE_NAME}
    names = set()

    def add_with_members(name):
        name = (name or '').strip()
        if not name or name in ours:
            return
        names.add(name)
        try:
            out, _err = client.run_cli(
                f'/interface bridge port print terse where bridge={name}'
            )
            for row in _parse_terse_rows(out):
                member = row.get('interface')
                if member and member not in ours:
                    names.add(member)
        except Exception:  # noqa: BLE001 — detection is best-effort
            pass

    try:
        out, _err = client.run_cli(
            ':local r [/ip route find where dst-address="0.0.0.0/0" active=yes];'
            ' :if ([:len $r] > 0) do={ :put [/ip route get ([:pick $r 0]) immediate-gw] }'
        )
        value = (out or '').strip()
        if '%' in value:
            add_with_members(value.split('%')[-1].strip().split(',')[0].split()[0])
    except Exception:  # noqa: BLE001
        pass

    try:
        out, _err = client.run_cli('/ip dhcp-client print terse')
        for row in _parse_terse_rows(out):
            add_with_members(row.get('interface'))
    except Exception:  # noqa: BLE001
        pass

    return names


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
        uplink_names = detect_uplink_interfaces(client)

    eth_rows = {r.get('name'): r for r in _parse_terse_rows(eth_out) if r.get('name')}

    interfaces = []
    ether_seen = 0
    for row in _parse_terse_rows(all_out):
        name = row.get('name')
        if not name:
            continue
        kind = _classify_interface(name, row.get('type'))
        eth = eth_rows.get(name, {})
        if uplink_names:
            # What the router itself routes through wins over the ether1
            # convention — including ports hidden behind a WAN bridge.
            is_uplink = name in uplink_names
        else:
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
    # NOTE: '/interface print stats terse' renders a COLUMNAR table with
    # space-separated thousands (e.g. '7 018 235'), which the key=value terse
    # parser can't read (yields 0 rows). Use scripting `get` to emit clean CSV
    # (raw integers, no separators) that parses deterministically.
    cmd = (
        ':foreach i in=[/interface find] do={'
        ':put ([/interface get $i name].","'
        '.[/interface get $i rx-byte].",".[/interface get $i tx-byte].","'
        '.[/interface get $i rx-packet].",".[/interface get $i tx-packet])}'
    )
    try:
        with mikrotik_ssh(device, timeout=8, lock_wait=1, retries=2) as client:
            out, _err = client.run_cli(cmd)
    except DeviceBusy:
        return {'at': time.time(), 'stats': [], 'busy': True}

    def _num(value):
        digits = ''.join(ch for ch in str(value) if ch.isdigit())
        return int(digits) if digits else 0

    stats = []
    for line in (out or '').replace('\r', '').split('\n'):
        parts = line.strip().split(',')
        if len(parts) >= 5 and parts[0]:
            stats.append({
                'name': parts[0],
                'rx_bytes': _num(parts[1]),
                'tx_bytes': _num(parts[2]),
                'rx_packets': _num(parts[3]),
                'tx_packets': _num(parts[4]),
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


# How many /24 blocks each service pool draws from. 8 blocks ≈ 2000 addresses —
# far more than one bridge ever serves, and it keeps the generated `/ip pool add`
# command short enough to read in the log.
_POOL_BLOCKS = 8


def _pool_ranges(first, last, max_blocks=_POOL_BLOCKS):
    """MikroTik pool ranges over [first, last], skipping every ``.0`` and ``.255``.

    A contiguous range inside a subnet wider than /24 contains hosts like
    172.31.3.255 and 172.31.4.0. Those are perfectly legal addresses, but plenty
    of cheap CPE and IoT firmware treats a last octet of 255 as a broadcast and
    DHCPDECLINEs the offer — the client then re-requests immediately, which reads
    as the link dropping and reconnecting every second.

    Returns a comma-separated range list capped at ``max_blocks`` /24s.
    """
    ranges = []
    cursor = first
    while cursor <= last and len(ranges) < max_blocks:
        block_start = ipaddress.ip_address(int(cursor) & ~0xFF)
        low = max(cursor, block_start + 1)          # skip x.x.x.0
        high = min(last, block_start + 254)         # skip x.x.x.255
        if low <= high:
            ranges.append(f'{low}-{high}' if low != high else str(low))
        cursor = block_start + 256
    return ','.join(ranges)


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
    gateway = net.network_address + 1
    lower, upper = net.subnets(prefixlen_diff=1)
    return {
        'subnet': str(net),
        'gateway': str(gateway),
        'gateway_cidr': f'{gateway}/{net.prefixlen}',
        # skip the network address and the gateway itself
        'pool_range': _pool_ranges(lower.network_address + 2, lower.broadcast_address),
        'pppoe_pool_range': _pool_ranges(upper.network_address, upper.broadcast_address - 1),
    }


VALID_PORT_ROLES = ('hotspot', 'pppoe', 'both', 'management')

# RouterOS prints most command failures on STDOUT — paramiko's stderr channel is
# usually empty — so checking stderr alone logs a failed `add` as "ok" and the
# wizard reports a configured router that was never touched. Match the phrases
# RouterOS actually emits.
_ROUTER_ERROR_MARKERS = (
    'expected end of command',
    'syntax error',
    'bad command name',
    'no such command',
    'no such item',
    'no such argument',
    'unknown parameter',
    'input does not match any value',
    'invalid value',
    'ambiguous value',
    'is not valid',
    'argument is required',
    'failure:',
    'action failed',
    'already have',
    'cannot add',
    'could not add',
    'interface not found',
    'not enough permissions',
)


def cli_error_text(out, err):
    """RouterOS error text for one command's output, or '' when it succeeded.

    Checks stderr *and* stdout: RouterOS reports `expected end of command`,
    `input does not match any value` and friends on stdout, and those are exactly
    the failures that used to pass silently.
    """
    for stream in (err, out):
        text = (stream or '').strip()
        if not text:
            continue
        lowered = text.lower()
        if any(marker in lowered for marker in _ROUTER_ERROR_MARKERS):
            return ' '.join(text.split())
    return ''


def _step(label, commands, critical=True):
    """One named configuration step: a list of *independently executed* commands.

    Commands are run one at a time rather than as a single ``a; b; c`` chain
    because RouterOS aborts the whole chain at the first error — which is how a
    rejected hotspot-profile parameter used to leave the router with no hotspot
    at all while the log showed a single unrelated failure.
    """
    if isinstance(commands, str):
        commands = [commands]
    return {'label': label, 'commands': [c for c in commands if c], 'critical': critical}


def _fw_filter_add(rule):
    """Add a firewall filter rule at the top of the chain, else append it.

    ``place-before=0`` errors outright on some RouterOS builds (empty filter
    list, or a dynamic rule sitting at index 0). Falling back to a plain append
    keeps the rule — and the rest of the step — alive.
    """
    return (
        f':do {{/ip firewall filter add {rule} place-before=0}} '
        f'on-error={{/ip firewall filter add {rule}}}'
    )


def _guarded_set(menu, finder, assignments):
    """`set` the given assignments one at a time, ignoring unsupported ones.

    Objects are created with only the parameters every RouterOS version accepts,
    then tuned with these guarded sets — so a parameter a given firmware doesn't
    know costs that one option instead of the whole object.
    """
    return [
        f':do {{{menu} set {finder} {assignment}}} on-error={{}}'
        for assignment in assignments
    ]


def derive_port_roles(opts):
    """Normalise opts into {interface: role} with role in hotspot|pppoe|both.

    Prefers the new ``port_roles`` map; falls back to the legacy
    ``bridge_ports`` + ``pppoe``/``hotspot`` shape (all bridged ports take the
    combined/only role that was selected) so old stored configs and older
    clients keep working.
    """
    roles = opts.get('port_roles')
    if isinstance(roles, dict) and roles:
        out = {}
        for iface, role in roles.items():
            r = (role or '').strip().lower()
            if iface and r in VALID_PORT_ROLES:
                out[iface] = r
        return out

    ports = [p for p in (opts.get('bridge_ports') or []) if p]
    has_pppoe = bool(opts.get('pppoe'))
    has_hotspot = bool(opts.get('hotspot'))
    role = 'both' if (has_pppoe and has_hotspot) else 'pppoe' if has_pppoe else 'hotspot' if has_hotspot else None
    return {p: role for p in ports} if role else {}


def build_services_commands(opts):
    """Build the ordered configuration steps.

    Returns ``(steps, params)`` where each step is
    ``{'label', 'commands': [...], 'critical': bool}``. Commands inside a step
    run *independently* — see :func:`_step`.

    opts keys: ``port_roles`` ({iface: hotspot|pppoe|both|management}; skip =
    omitted), ``anti_sharing``, ``subnet``. Legacy ``pppoe``/``hotspot``/
    ``bridge_ports`` are still accepted (see :func:`derive_port_roles`).

    Shared-bridge topology (robust on switch-chip boards like the hEX, where a
    raw per-port PPPoE server conflicts with a bridge one):
      * Hotspot / PPPoE / Both ports → all members of ``infora-bridge``.
      * One hotspot server on the bridge (DHCP + captive portal) when any
        hotspot/both port exists; one PPPoE server on the bridge when any
        pppoe/both port exists. A downstream CPE picks the service by how it is
        wired (AP mode → hotspot; WAN=PPPoE → PPPoE).
      * Management ports → a separate ``infora-mgmt-bridge`` with a static IP +
        its own DHCP so a plugged-in laptop always reaches Winbox/WebFig,
        independent of the tunnel.
    Optional ``uplink_dhcp_client`` (+ ``uplink_interface``) runs a DHCP client on
    the WAN so the router auto-addresses from upstream. All commands are
    idempotent (remove-by-comment/name, then add).
    """
    params = _subnet_params(opts.get('subnet') or DEFAULT_SUBNET)
    roles = derive_port_roles(opts)

    hotspot_ports = [p for p, r in roles.items() if r in ('hotspot', 'both')]
    pppoe_ports = [p for p, r in roles.items() if r in ('pppoe', 'both')]
    both_ports = [p for p, r in roles.items() if r == 'both']
    management_ports = [p for p, r in roles.items() if r == 'management']
    # Every service port shares one bridge; the role only decides which servers
    # run, not which port they bind to.
    service_ports = [p for p, r in roles.items() if r in ('hotspot', 'pppoe', 'both')]
    run_hotspot = bool(hotspot_ports)
    run_pppoe = bool(pppoe_ports)
    run_bridge = bool(service_ports)
    run_management = bool(management_ports)

    # Expose the derived plan for the summary / persisted service_config.
    params['hotspot_ports'] = hotspot_ports
    params['pppoe_only_ports'] = [p for p, r in roles.items() if r == 'pppoe']
    params['both_ports'] = both_ports
    params['service_ports'] = service_ports
    params['management_ports'] = management_ports
    params['run_hotspot'] = run_hotspot
    params['run_pppoe'] = run_pppoe
    params['run_management'] = run_management
    params['walled_garden_hosts'] = list(opts.get('walled_garden_hosts') or [])

    steps = []

    # 0. Optional DHCP client on the uplink/WAN (plug-and-play addressing).
    #    Only add when the interface has no DHCP client yet — the factory config
    #    usually already has one, and RouterOS refuses a second on the same port.
    uplink = str(opts.get('uplink_interface') or 'ether1').strip()
    if opts.get('uplink_dhcp_client') and INTERFACE_NAME_RE.match(uplink):
        params['uplink_dhcp_client'] = uplink
        steps.append(_step(
            'wan-dhcp',
            f':if ([:len [/ip dhcp-client find interface={uplink}]]=0) do={{'
            f'/ip dhcp-client add interface={uplink} use-peer-dns=yes use-peer-ntp=yes '
            f'add-default-route=yes disabled=no comment="{WAN_DHCP_COMMENT}"}}',
            critical=False,
        ))

    # 1. Bridge — one shared bridge for every hotspot/pppoe/both port.
    if run_bridge:
        steps.append(_step(
            'bridge',
            f':if ([:len [/interface bridge find name={BRIDGE_NAME}]]=0) do={{'
            f'/interface bridge add name={BRIDGE_NAME} comment="infora-billing"}}',
        ))

    # 2. Reset our managed bridge memberships, then add every service port.
    #    Removing by comment first makes role changes (e.g. dropping a port) stick.
    steps.append(_step(
        'bridge-reset',
        ':do {/interface bridge port remove [find comment="infora"]} on-error={}',
    ))
    for port in service_ports:
        steps.append(_step(
            f'bridge-port:{port}',
            [
                # A port can only be in one bridge, and on RouterOS 6 switch-chip
                # boards it may also be enslaved to a master-port. Clear both, or
                # the port stays switched in hardware *and* bridged in software —
                # a loop that shows up as link LEDs blinking and services dropping.
                f':do {{/interface bridge port remove [find interface={port}]}} on-error={{}}',
                f':do {{/interface ethernet set [find name={port}] master-port=none}} on-error={{}}',
                f'/interface bridge port add bridge={BRIDGE_NAME} interface={port} comment="infora"',
            ],
        ))

    # 3. Bridge gateway address — needed whenever the bridge exists, not only for
    #    hotspot. The PPPoE profile's local-address points here, and masquerade
    #    needs a real source: a PPPoE-only bridge with no address dials a session
    #    that immediately drops and redials (the "reconnects every second" bug).
    if run_bridge:
        steps.append(_step(
            'address',
            [
                ':do {/ip address remove [find comment="infora-billing"]} on-error={}',
                f'/ip address add address={params["gateway_cidr"]} interface={BRIDGE_NAME} '
                f'comment="infora-billing"',
            ],
        ))
        # Any *other* DHCP server on our bridge fights ours for the same segment:
        # clients bounce between two offers and renew-loop every few seconds.
        # Disable (never delete) the strays, including the factory `defconf` one.
        steps.append(_step(
            'dhcp-conflicts',
            f':foreach s in=[/ip dhcp-server find where interface="{BRIDGE_NAME}"] do={{'
            f':if ([/ip dhcp-server get $s name] != "{DHCP_NAME}") do={{'
            f'/ip dhcp-server set $s disabled=yes}}}}',
            critical=False,
        ))

    # 4-5. Pool + DHCP server for hotspot clients.
    if run_hotspot:
        steps.append(_step(
            'pool',
            [
                f':do {{/ip pool remove [find name={POOL_NAME}]}} on-error={{}}',
                f'/ip pool add name={POOL_NAME} ranges={params["pool_range"]}',
            ],
        ))
        steps.append(_step(
            'dhcp',
            [
                f':do {{/ip dhcp-server remove [find name={DHCP_NAME}]}} on-error={{}}',
                # Explicit short lease: hotspot clients churn, and after a config
                # change (e.g. moving the DNS server from 8.8.8.8 to the router)
                # devices keep the stale lease until it expires. An hour bounds
                # how long a subscriber can be stuck with the old settings without
                # a "forget network".
                f'/ip dhcp-server add name={DHCP_NAME} interface={BRIDGE_NAME} '
                f'address-pool={POOL_NAME} lease-time=1h disabled=no',
                f':do {{/ip dhcp-server network remove [find address={params["subnet"]}]}} on-error={{}}',
                # DNS = the router itself. The captive portal only fires when the
                # hotspot can answer (and rewrite) client DNS; handing out 8.8.8.8
                # makes phones resolve straight through and never show the
                # "Sign in to network" sheet.
                f'/ip dhcp-server network add address={params["subnet"]} '
                f'gateway={params["gateway"]} dns-server={params["gateway"]}',
            ],
        ))
        # …and the router needs a working resolver to answer them.
        steps.append(_step(
            'dns',
            [
                '/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes',
                ':do {/ip dns cache flush} on-error={}',
            ],
        ))

    # 6. PPPoE — dedicated pool + profile, then ONE server bound to the shared
    #    bridge (a raw per-port server conflicts with the bridge on switch-chip
    #    boards and comes up INVALID).
    if run_pppoe:
        steps.append(_step(
            'pppoe-pool',
            [
                f':do {{/ip pool remove [find name={PPPOE_POOL_NAME}]}} on-error={{}}',
                f'/ip pool add name={PPPOE_POOL_NAME} ranges={params["pppoe_pool_range"]}',
            ],
        ))
        steps.append(_step(
            'pppoe-profile',
            [
                f':do {{/ppp profile remove [find name={PPPOE_PROFILE_NAME}]}} on-error={{}}',
                # Create with only the universally-accepted parameters, then tune.
                f'/ppp profile add name={PPPOE_PROFILE_NAME} local-address={params["gateway"]} '
                f'remote-address={PPPOE_POOL_NAME}',
            ] + _guarded_set('/ppp profile', f'[find name={PPPOE_PROFILE_NAME}]', [
                'dns-server=8.8.8.8,1.1.1.1',
                'use-encryption=no',
                'only-one=yes',
            ]),
        ))
        steps.append(_step(
            'pppoe-reset',
            [
                ':do {/interface pppoe-server server remove [find service-name=infora]} on-error={}',
                '/ppp aaa set use-radius=yes accounting=yes interim-update=5m',
            ],
        ))
        steps.append(_step(
            'pppoe:bridge',
            [
                f'/interface pppoe-server server add service-name=infora interface={BRIDGE_NAME} '
                f'default-profile={PPPOE_PROFILE_NAME} disabled=no',
            ] + _guarded_set('/interface pppoe-server server', '[find service-name=infora]', [
                'one-session-per-host=yes',
                # Offer every method the CPE might pick. FreeRADIUS answers all of
                # them from the stored Cleartext-Password.
                'authentication=pap,chap,mschap1,mschap2',
                'max-mtu=1480 max-mru=1480',
            ]),
        ))

    # 7. Hotspot (profile + server using RADIUS) on the bridge.
    #    Note: shared-users is NOT a /ip hotspot profile parameter (it lives on
    #    the hotspot *user* profile) — putting it here makes the whole profile add
    #    fail, which silently leaves the router with no hotspot.
    if run_hotspot:
        shared_users = '1' if opts.get('anti_sharing') else '3'
        steps.append(_step(
            'hotspot',
            [
                ':do {/ip hotspot remove [find name=infora]} on-error={}',
                ':do {/ip hotspot profile remove [find name=infora]} on-error={}',
                # Minimal add first — every optional attribute is applied below as
                # a guarded set so one unsupported keyword can't cost us the whole
                # hotspot (which is what left the ports open and unauthenticated).
                f'/ip hotspot profile add name=infora hotspot-address={params["gateway"]} '
                f'use-radius=yes',
            ] + _guarded_set('/ip hotspot profile', '[find name=infora]', [
                'radius-accounting=yes',
                'radius-interim-update=5m',
                'login-by=http-chap,http-pap,cookie',
            ]) + [
                f'/ip hotspot add name=infora interface={BRIDGE_NAME} '
                f'address-pool={POOL_NAME} profile=infora disabled=no',
            ] + _guarded_set('/ip hotspot user profile', '[find name=default]', [
                f'shared-users={shared_users}',
            ]),
        ))

        # Walled garden — the portal, the API and the payment gateway must be
        # reachable *before* login. Deliberately NOT the OS captive-probe hosts:
        # allowing those makes the phone conclude it already has internet and skip
        # the sign-in sheet entirely (see services.portal_urls.portal_hostnames).
        for host in opts.get('walled_garden_hosts') or []:
            safe_host = host.replace('"', '').strip()
            if not safe_host:
                continue
            steps.append(_step(
                f'walled-garden:{safe_host}',
                [
                    f':do {{/ip hotspot walled-garden remove [find dst-host="{safe_host}"]}} on-error={{}}',
                    f'/ip hotspot walled-garden add dst-host="{safe_host}" action=allow comment="infora"',
                ],
                critical=False,
            ))

        # External captive portal — fetch the login page that carries MikroTik's
        # own login form *and* the link into our SPA.
        redirect_api = (opts.get('captive_redirect_fetch_url') or '').replace('"', '')
        if redirect_api:
            steps.append(_step(
                'captive-login',
                [
                    ':do {/file remove [find name="hotspot/login.html"]} on-error={}',
                    f'/tool fetch url="{redirect_api}" check-certificate=no '
                    f'dst-path=hotspot/login.html',
                    ':do {/ip hotspot profile set [find name=infora] html-directory=hotspot} on-error={}',
                ],
            ))

        # FastTrack short-circuits the firewall/NAT path, so a fast-tracked
        # connection never reaches the hotspot's dynamic rules — an
        # unauthenticated client browses HTTPS freely and RADIUS accounting sees
        # none of the traffic. Provisioning removes it, but a firmware upgrade or
        # a hand-edit re-adds the defconf rule, so strip it here too.
        steps.append(_step(
            'fasttrack-off',
            ':do {/ip firewall filter remove [find action=fasttrack-connection]} on-error={}',
        ))

        # Self-protection: hotspot clients must not reach the router's own
        # management services. Drop input from the hotspot bridge to winbox/ssh/
        # api — but NOT 80/443, which the captive-portal login page runs on.
        steps.append(_step(
            'hotspot-isolate',
            [
                f':do {{/ip firewall filter remove [find comment="{HOTSPOT_ISOLATE_COMMENT}"]}} on-error={{}}',
                _fw_filter_add(
                    f'chain=input action=drop in-interface={BRIDGE_NAME} '
                    f'protocol=tcp dst-port=22,23,8291,8728,8729 '
                    f'comment="{HOTSPOT_ISOLATE_COMMENT}"'
                ),
            ],
            critical=False,
        ))

    # 7b. Management ports — own bridge with a static IP + local DHCP so a
    #     plugged-in laptop always reaches Winbox/WebFig, independent of the
    #     tunnel. Not bridged into a service; www/winbox/ssh forced on.
    if run_management:
        steps.append(_step(
            'mgmt-bridge',
            f':if ([:len [/interface bridge find name={MGMT_BRIDGE_NAME}]]=0) do={{'
            f'/interface bridge add name={MGMT_BRIDGE_NAME} comment="infora-billing"}}',
        ))
        steps.append(_step(
            'mgmt-bridge-reset',
            f':do {{/interface bridge port remove [find comment="{MGMT_PORT_COMMENT}"]}} on-error={{}}',
        ))
        for port in management_ports:
            steps.append(_step(
                f'mgmt-port:{port}',
                [
                    # Free the port from any prior bridge/switch-group/pppoe use.
                    f':do {{/interface bridge port remove [find interface={port}]}} on-error={{}}',
                    f':do {{/interface ethernet set [find name={port}] master-port=none}} on-error={{}}',
                    f':do {{/interface pppoe-server server remove [find interface={port}]}} on-error={{}}',
                    f'/interface bridge port add bridge={MGMT_BRIDGE_NAME} interface={port} '
                    f'comment="{MGMT_PORT_COMMENT}"',
                ],
            ))
        steps.append(_step(
            'mgmt-address',
            [
                f':do {{/ip address remove [find comment="{MGMT_PORT_COMMENT}"]}} on-error={{}}',
                f'/ip address add address={MGMT_PORT_GATEWAY}/24 interface={MGMT_BRIDGE_NAME} '
                f'comment="{MGMT_PORT_COMMENT}"',
            ],
        ))
        steps.append(_step(
            'mgmt-pool',
            [
                f':do {{/ip pool remove [find name={MGMT_PORT_POOL_NAME}]}} on-error={{}}',
                f'/ip pool add name={MGMT_PORT_POOL_NAME} ranges={MGMT_PORT_POOL_RANGE}',
            ],
        ))
        steps.append(_step(
            'mgmt-dhcp',
            [
                f':do {{/ip dhcp-server remove [find name={MGMT_PORT_DHCP_NAME}]}} on-error={{}}',
                f'/ip dhcp-server add name={MGMT_PORT_DHCP_NAME} interface={MGMT_BRIDGE_NAME} '
                f'address-pool={MGMT_PORT_POOL_NAME} disabled=no',
                f':do {{/ip dhcp-server network remove [find comment="{MGMT_PORT_COMMENT}"]}} on-error={{}}',
                f'/ip dhcp-server network add address={MGMT_PORT_SUBNET} gateway={MGMT_PORT_GATEWAY} '
                f'dns-server=8.8.8.8,1.1.1.1 comment="{MGMT_PORT_COMMENT}"',
                f':foreach s in=[/ip dhcp-server find where interface="{MGMT_BRIDGE_NAME}"] do={{'
                f':if ([/ip dhcp-server get $s name] != "{MGMT_PORT_DHCP_NAME}") do={{'
                f'/ip dhcp-server set $s disabled=yes}}}}',
            ],
        ))
        steps.append(_step(
            'mgmt-services',
            [
                '/ip service set www disabled=no',
                '/ip service set winbox disabled=no',
                '/ip service set ssh disabled=no',
            ],
        ))
        steps.append(_step(
            'mgmt-firewall',
            [
                f':do {{/ip firewall filter remove [find comment="{MGMT_PORT_COMMENT}"]}} on-error={{}}',
                _fw_filter_add(
                    f'chain=input action=accept in-interface={MGMT_BRIDGE_NAME} '
                    f'comment="{MGMT_PORT_COMMENT}"'
                ),
            ],
        ))

    # 8. Hotspot anti-sharing: TTL=1 on traffic handed to hotspot clients, so a
    #    subscriber who re-shares through another router sees it die at that hop.
    #    MUST be scoped to the hotspot bridge — an unscoped postrouting rule sets
    #    TTL=1 on *everything* the router sends, including the WireGuard
    #    management tunnel and all WAN traffic, which kills the whole box.
    if run_hotspot and opts.get('anti_sharing'):
        steps.append(_step(
            'anti-sharing',
            [
                ':do {/ip firewall mangle remove [find comment="infora-anti-sharing"]} on-error={}',
                '/ip firewall mangle add chain=postrouting action=change-ttl '
                f'new-ttl=set:1 out-interface={BRIDGE_NAME} passthrough=yes '
                'comment="infora-anti-sharing"',
            ],
            critical=False,
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
    installed = latest = None
    try:
        with mikrotik_ssh(device, timeout=20, lock_wait=30) as client:
            log.append({'step': 'connect', 'status': 'ok', 'detail': f'Connected to {connection_host(device)}'})

            # 1. Refresh the update channel so the router installs the *latest*
            #    release the system detects (not whatever it last knew about).
            update_available = True
            try:
                client.run_cli('/system package update check-for-updates')
                info = _parse_kv(client.run_cli('/system package update print')[0])
                installed = info.get('installed-version')
                latest = info.get('latest-version')
                status = (info.get('status') or '').lower()
                update_available = (
                    bool(latest and installed and latest != installed)
                    or 'new version is available' in status
                )
                log.append({'step': 'check', 'status': 'ok',
                            'detail': f'Installed {installed or "?"} · latest {latest or "?"}'})
            except Exception as exc:
                # Couldn't read versions — proceed with a best-effort install.
                log.append({'step': 'check', 'status': 'error', 'detail': str(exc)[:200]})

            # 2. Already current — don't reboot for nothing.
            if installed and latest and not update_available:
                log.append({'step': 'done', 'status': 'ok',
                            'detail': f'Already on the latest release ({installed}); no upgrade needed.'})
                return {'success': True, 'log': log, 'up_to_date': True,
                        'installed': installed, 'latest': latest}

            # 3. Upgrade RouterBOOT to match the new RouterOS, then install + reboot.
            try:
                client.run_cli('/system routerboard upgrade')
                log.append({'step': 'routerboard', 'status': 'ok', 'detail': 'RouterBOOT upgrade queued'})
            except Exception as exc:
                log.append({'step': 'routerboard', 'status': 'error', 'detail': str(exc)[:200]})

            try:
                # This downloads + installs and reboots; the session usually drops here.
                out, err = client.run_cli('/system package update install')
                detail = (out or err or f'Installing {latest or "latest"} — device rebooting').strip()[:200]
                log.append({'step': 'install', 'status': 'ok', 'detail': detail or 'Install command sent — device rebooting'})
            except Exception:
                # A dropped connection during reboot is the expected/success path.
                log.append({'step': 'install', 'status': 'ok',
                            'detail': f'Install issued — rebooting to apply {latest or "the upgrade"}'})
    except Exception as exc:
        log.append({'step': 'connect', 'status': 'error', 'detail': str(exc)[:200]})
        return {'success': False, 'log': log}

    log.append({'step': 'done', 'status': 'ok', 'detail': 'Upgrade in progress. Re-sync once the router is back online.'})
    return {'success': True, 'log': log, 'installed': installed, 'latest': latest}


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


def _verify_services(client, params):
    """Read the applied service config back off the router.

    Returns ``[{id, label, ok, detail}]``. Only what this device was asked to
    run is checked, so a PPPoE-only router isn't marked broken for having no
    hotspot. Reuses the open SSH session — one round of prints, no reconnect.
    """
    def cli(command):
        try:
            out, _err = client.run_cli(command)
            return out or ''
        except Exception:  # noqa: BLE001 — a read failure means "can't confirm"
            return ''

    checks = []

    def add(check_id, label, ok, detail):
        checks.append({'id': check_id, 'label': label, 'ok': bool(ok), 'detail': detail})

    if params.get('service_ports'):
        bridge_rows = _parse_terse_rows(cli('/interface bridge port print terse'))
        on_bridge = {
            r.get('interface') for r in bridge_rows if r.get('bridge') == BRIDGE_NAME
        }
        missing = [p for p in params['service_ports'] if p not in on_bridge]
        add('bridge-ports', 'Service ports are on the bridge', not missing,
            'all ports bridged' if not missing else f"not on {BRIDGE_NAME}: {', '.join(missing)}")

        addresses = cli('/ip address print terse')
        add('bridge-address', 'Bridge gateway address exists',
            params['gateway'] in addresses,
            f'{params["gateway_cidr"]} on {BRIDGE_NAME}' if params['gateway'] in addresses
            else f'{params["gateway_cidr"]} missing — PPPoE/NAT return path will not work')

    if params.get('run_hotspot'):
        hotspot_rows = _parse_terse_rows(cli('/ip hotspot print terse'))
        hotspot = next((r for r in hotspot_rows if r.get('name') == 'infora'), None)
        add('hotspot-server', 'Hotspot server running on the bridge',
            bool(hotspot) and not _row_disabled(hotspot),
            f"on {hotspot.get('interface')}" if hotspot
            else 'no hotspot server — the port stays open and nobody is asked to sign in')

        dhcp_rows = _parse_terse_rows(cli('/ip dhcp-server print terse'))
        dhcp = next((r for r in dhcp_rows if r.get('name') == DHCP_NAME), None)
        add('hotspot-dhcp', 'Hotspot DHCP server enabled',
            bool(dhcp) and not _row_disabled(dhcp),
            'leases from ' + params['pool_range'] if dhcp else f'{DHCP_NAME} missing')

        dns = _parse_kv(cli('/ip dns print'))
        add('hotspot-dns', 'Router answers client DNS (captive redirect)',
            dns.get('allow-remote-requests') == 'yes',
            'allow-remote-requests=yes' if dns.get('allow-remote-requests') == 'yes'
            else 'allow-remote-requests is off — phones resolve past the portal and '
                 'never show the sign-in sheet')

        files = cli('/file print terse')
        add('hotspot-login', 'Captive-portal login page present',
            'login.html' in files,
            'hotspot/login.html on flash' if 'login.html' in files
            else "login.html not fetched — subscribers get MikroTik's default page "
                 'with no link into the billing portal')

        # The fetched page only gets served if the profile points at the folder
        # it landed in; a mismatch renders MikroTik's stock page instead of ours.
        profile = _parse_kv(cli('/ip hotspot profile print where name=infora'))
        html_dir = profile.get('html-directory', '')
        add('hotspot-html-dir', 'Hotspot profile serves the fetched login page',
            html_dir.strip('"') in ('hotspot', ''),
            f'html-directory={html_dir or "hotspot (default)"}')

        # FastTrack bypasses the hotspot's dynamic rules entirely: an
        # unauthenticated client gets full HTTPS and RADIUS sees no accounting.
        no_fasttrack = 'fasttrack-connection' not in cli('/ip firewall filter print terse')
        add('fasttrack-absent', 'FastTrack removed (else clients browse unpaid)',
            no_fasttrack,
            'no fasttrack rule' if no_fasttrack
            else 'a fasttrack-connection rule is still present — it short-circuits the '
                 'hotspot, so clients reach HTTPS without logging in and accounting is lost')

        # The portal/payment hosts must be reachable *before* login, or the
        # subscriber can see the sign-in page but never reach the page that sells
        # them a package.
        wanted = [h for h in (params.get('walled_garden_hosts') or []) if h]
        if wanted:
            garden = cli('/ip hotspot walled-garden print terse')
            missing = [h for h in wanted if h not in garden]
            add('walled-garden', 'Portal and payment hosts allowed pre-login',
                not missing,
                f'{len(wanted)} hosts allowed' if not missing
                else f"not allowed: {', '.join(missing)} — subscribers cannot reach "
                     'the payment page before logging in')

    if params.get('run_pppoe'):
        pppoe_rows = _parse_terse_rows(cli('/interface pppoe-server server print terse'))
        pppoe = next((r for r in pppoe_rows if r.get('service-name') == 'infora'), None)
        add('pppoe-server', 'PPPoE server running on the bridge',
            bool(pppoe) and not _row_disabled(pppoe),
            f"on {pppoe.get('interface')}" if pppoe else 'no PPPoE server — CPEs see "no service"')

        aaa = _parse_kv(cli('/ppp aaa print'))
        add('pppoe-radius', 'PPPoE authenticates via RADIUS',
            aaa.get('use-radius') == 'yes',
            'use-radius=yes' if aaa.get('use-radius') == 'yes' else 'use-radius is off')

    if params.get('run_management'):
        add('mgmt-address', 'Management port address exists',
            MGMT_PORT_COMMENT in cli('/ip address print terse'),
            f'{MGMT_PORT_GATEWAY}/24 on {MGMT_BRIDGE_NAME}')

    return checks


def configure_services(device, opts):
    """Connect to the router and push the service configuration.

    Returns a dict with success flag, ordered log, and a summary. Never raises
    on router-side failures — the log captures what happened for the UI.
    """
    from models import ISP
    from services.portal_urls import (
        is_router_reachable_base,
        portal_frontend_base_url,
        portal_hostnames,
        public_base_url,
    )

    isp = ISP.query.get(device.isp_id) if device.isp_id else None
    roles = derive_port_roles(opts)
    wants_hotspot = any(r in ('hotspot', 'both') for r in roles.values())

    # Validate the address plan before touching the router — a bad subnet should
    # read as "fix this field", not as a connection failure.
    try:
        _subnet_params(opts.get('subnet') or DEFAULT_SUBNET)
    except ValueError as exc:
        return {
            'success': False,
            'error': str(exc),
            'log': [{'step': 'subnet', 'status': 'error', 'detail': str(exc)}],
            'summary': None,
        }

    portal_warning = None
    if wants_hotspot:
        if not opts.get('walled_garden_hosts'):
            opts['walled_garden_hosts'] = portal_hostnames(isp)

        # The walled garden is built from the configured portal/API origins. If
        # PORTAL_BASE_URL is unset the portal host silently drops out of the list
        # and the subscriber sees the sign-in page but cannot reach the page that
        # sells them a package — a dead end that looks like a payment bug.
        portal_base = portal_frontend_base_url(isp)
        if not is_router_reachable_base(portal_base):
            portal_warning = (
                'The captive portal origin is not set to an address subscribers can '
                f'reach (resolved: "{portal_base or "<empty>"}"). Set PORTAL_BASE_URL to '
                'your public portal URL and re-run Configure services — without it the '
                'portal host is missing from the walled garden and nobody can pay.'
            )

        base = public_base_url()
        if base and isp and not opts.get('captive_redirect_fetch_url'):
            if is_router_reachable_base(base):
                opts['captive_redirect_fetch_url'] = (
                    f'{base}/api/portal/captive-redirect?isp_id={isp.id}&router_id={device.id}'
                )
            else:
                # A loopback/dev base can't be fetched by the router, so the
                # hotspot login page would come out blank. Don't push a doomed
                # fetch — surface the real fix instead.
                portal_warning = (
                    f'Captive portal base URL "{base}" is not reachable from the router. '
                    'Set PUBLIC_BASE_URL (API) and PORTAL_BASE_URL (captive portal) to your '
                    'public server address, then re-run Configure services — otherwise the '
                    'hotspot sign-in page stays blank.'
                )

    log = [{'step': 'queued', 'status': 'ok', 'detail': 'Starting device configuration...'}]
    if portal_warning:
        log.append({'step': 'captive-portal', 'status': 'error', 'detail': portal_warning})

    critical_failures = []
    verification = []
    steps, params = [], {}
    try:
        # Action: wait for the router even if a poll currently holds it, and let
        # mikrotik_ssh retry the flaky MikroTik SSH banner before giving up.
        with mikrotik_ssh(device, timeout=12, lock_wait=30) as client:
            log.append({'step': 'connect', 'status': 'ok', 'detail': f'Connected to {connection_host(device)} via SSH'})

            # Never bridge the internet feed into a service bridge, whatever the
            # caller asked for. Doing so merges the ISP's broadcast domain with
            # the subscriber one: two DHCP servers answer, traffic loops, and
            # every port drops a second after anything is plugged in. The UI
            # hides the uplink, but it identifies it by convention (ether1) and
            # the WAN is not always there — so enforce it against the router's
            # own routing table, which cannot be wrong.
            uplinks = detect_uplink_interfaces(client)
            blocked = [port for port in roles if port in uplinks]
            if blocked:
                for port in blocked:
                    roles.pop(port)
                opts = dict(opts, port_roles=roles)
                log.append({
                    'step': 'uplink-guard',
                    'status': 'warn',
                    'detail': (
                        f"{', '.join(sorted(blocked))} carries the internet feed "
                        f"(active default route or DHCP client, including via a WAN "
                        f"bridge) — skipped. Bridging the uplink merges the ISP's "
                        f"network into the subscriber one and takes the router offline."
                    ),
                })

            steps, params = build_services_commands(opts)

            for step in steps:
                label = step['label']
                errors = []
                for command in step['commands']:
                    try:
                        out, err = client.run_cli(command)
                        problem = cli_error_text(out, err)
                        if problem:
                            errors.append(problem)
                    except Exception as exc:  # noqa: BLE001 — one command, keep going
                        errors.append(str(exc))
                if errors:
                    # A failed command no longer aborts the rest of the step: each
                    # command runs on its own, so the router still gets everything
                    # that *can* be applied and the log names what didn't.
                    log.append({
                        'step': label,
                        'status': 'error' if step['critical'] else 'warn',
                        'detail': '; '.join(errors)[:300],
                    })
                    if step['critical']:
                        critical_failures.append(label)
                else:
                    log.append({'step': label, 'status': 'ok', 'detail': f'{label} configured'})

            # Read the end state back rather than trusting the command output —
            # this is what turns "applied with no visible error but no hotspot"
            # into an actionable failure.
            verification = _verify_services(client, params)
    except Exception as exc:
        log.append({'step': 'connect', 'status': 'error', 'detail': str(exc)[:300]})
        return {'success': False, 'log': log, 'summary': None}

    for check in verification:
        log.append({
            'step': f'verify:{check["id"]}',
            'status': 'ok' if check['ok'] else 'error',
            'detail': check['detail'],
        })

    verify_failed = [c['id'] for c in verification if not c['ok']]
    success = not critical_failures and not verify_failed and not portal_warning
    if success:
        done_detail = 'Configuration complete and verified on the router.'
    else:
        parts = []
        if critical_failures:
            parts.append(f"failed steps: {', '.join(critical_failures)}")
        if verify_failed:
            parts.append(f"missing on router: {', '.join(verify_failed)}")
        done_detail = 'Configuration incomplete — ' + '; '.join(parts or ['see log'])
    log.append({
        'step': 'done',
        'status': 'ok' if success else 'error',
        'detail': done_detail,
    })

    services = []
    if params.get('run_hotspot'):
        services.append('Hotspot')
    if params.get('run_pppoe'):
        services.append('PPPoE')
    if params.get('run_management'):
        services.append('Management')
    summary = {
        'services': services,
        'ports': sorted(set(
            params.get('hotspot_ports', [])
            + params.get('pppoe_only_ports', [])
            + params.get('management_ports', [])
        )),
        'port_roles': roles,
        'management_ports': params.get('management_ports', []),
        'uplink_dhcp_client': params.get('uplink_dhcp_client'),
        'subnet': params['subnet'],
        'gateway': params['gateway'],
        'anti_sharing': bool(params.get('run_hotspot') and opts.get('anti_sharing')),
        'verification': verification,
    }
    result = {'success': success, 'log': log, 'summary': summary, 'verification': verification}
    if not success:
        result['error'] = done_detail
    return result
