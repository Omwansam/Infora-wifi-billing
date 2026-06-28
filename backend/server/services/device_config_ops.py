"""Connect to a registered MikroTik and run provisioning/status operations.

Used by the device onboarding wizard:
  - get_provision_status(): has the router pulled its script + is it reachable?
  - list_interfaces(): ethernet ports for the bridge picker.
  - configure_services(): push bridge/pool/DHCP/PPPoE/Hotspot config and
    return an ordered log (rendered live on the "Router is live" screen).

For NAT routers the management WireGuard tunnel IP is used as the connect host;
otherwise the registered device_ip is used.
"""
import ipaddress

from mikrotik_client import (
    ConnectionType,
    MikroTikClient,
    MikroTikConnectionConfig,
)
from services.encryption import decrypt_value


DEFAULT_SUBNET = '172.31.0.0/16'
BRIDGE_NAME = 'infora-bridge'
POOL_NAME = 'infora-pool'
DHCP_NAME = 'infora-dhcp'


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


def get_provision_status(device):
    """Return whether the router fetched its script and is reachable.

    When reachable, also auto-detects the router model/version so the operator
    never has to type them in (they are read straight off the device).
    """
    fetched = bool(device.provision_fetch_count and device.provision_fetch_count > 0)
    host = connection_host(device)
    reachable = False
    error = None
    detected = {}
    try:
        with MikroTikClient(_ssh_config(device, timeout=5)) as client:
            reachable = bool(client.connect())
            if reachable:
                detected = _detect_router_info(client)
    except Exception as exc:  # connection refused / timeout / auth — all "not reachable yet"
        error = str(exc)

    return {
        'fetched': fetched,
        'fetch_count': device.provision_fetch_count or 0,
        'last_fetched_at': device.provision_last_fetched_at.isoformat() if device.provision_last_fetched_at else None,
        'reachable': reachable,
        'online': reachable,
        'host': host,
        'management_wg_ip': device.management_wg_ip,
        'detected': detected,
        'error': error,
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


def list_interfaces(device):
    """Return ethernet interfaces with an uplink hint (ether1 by convention)."""
    with MikroTikClient(_ssh_config(device, timeout=8)) as client:
        if not client.connect():
            raise RuntimeError('Could not connect to router')
        out, _err = client.run_cli('/interface ethernet print terse')

    interfaces = []
    for idx, row in enumerate(_parse_terse(out)):
        name = row.get('name')
        if not name:
            continue
        interfaces.append({
            'name': name,
            'running': row.get('running') == 'true',
            'disabled': row.get('disabled') == 'true',
            'is_uplink': idx == 0 or name == 'ether1',
        })
    return interfaces


def _subnet_params(subnet):
    net = ipaddress.ip_network(subnet, strict=False)
    gateway = str(net.network_address + 1)
    pool_start = str(net.network_address + 2)
    pool_end = str(net.broadcast_address - 1)
    return {
        'subnet': str(net),
        'gateway': gateway,
        'gateway_cidr': f'{gateway}/{net.prefixlen}',
        'pool_range': f'{pool_start}-{pool_end}',
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

    # 6. PPPoE server
    if opts.get('pppoe'):
        steps.append((
            'pppoe',
            ':do {/interface pppoe-server server remove [find service-name=infora]} on-error={}; '
            f'/interface pppoe-server server add service-name=infora interface={BRIDGE_NAME} '
            'one-session-per-host=yes disabled=no; '
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
            f'{params["gateway"]} use-radius=yes radius-accounting=yes shared-users={shared}; '
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
    with MikroTikClient(_ssh_config(device, timeout=10)) as client:
        if not client.connect():
            raise RuntimeError('Could not connect to router')
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
    with MikroTikClient(_ssh_config(device, timeout=15)) as client:
        if not client.connect():
            raise RuntimeError('Could not connect to router')
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
        with MikroTikClient(_ssh_config(device, timeout=20)) as client:
            if not client.connect():
                log.append({'step': 'connect', 'status': 'error', 'detail': 'Connection failed'})
                return {'success': False, 'log': log}
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
    with MikroTikClient(_ssh_config(device, timeout=30)) as client:
        if not client.connect():
            raise RuntimeError('Could not connect to router')
        out, err = client.run_cli('/export')
    text = out or ''
    if not text.strip() and err:
        raise RuntimeError(err.strip()[:300])
    return text


def reboot_device(device):
    """Reboot the router over SSH (session drops, which is expected)."""
    try:
        with MikroTikClient(_ssh_config(device, timeout=10)) as client:
            if not client.connect():
                return {'success': False, 'detail': 'Connection failed'}
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
        with MikroTikClient(_ssh_config(device, timeout=12)) as client:
            log.append({'step': 'connect', 'status': 'ok', 'detail': f'Connecting to {connection_host(device)} via SSH...'})
            if not client.connect():
                log.append({'step': 'connect', 'status': 'error', 'detail': 'Connection failed'})
                return {'success': False, 'log': log, 'summary': None}

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
