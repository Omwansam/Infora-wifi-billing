"""Deployment and connectivity health checks for MikroTik + WireGuard."""
import os
import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request

from extensions import db
from models import ISP, Customer, MikrotikDevice, RadCheck, WireGuardPeer, WireGuardServer
from services.radius_provisioning import find_customer_by_login, radius_username
from services.rate_limit import rate_limit

health_bp = Blueprint('health', __name__, url_prefix='/api/health')


def _check_tcp(host, port, timeout=2):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _probe_host_port(device):
    """Pick the reachable host/port for a device: tunnel IP+SSH for NAT routers."""
    if getattr(device, 'management_wg_enabled', False) and getattr(device, 'management_wg_ip', None):
        return device.management_wg_ip.split('/')[0], (device.ssh_port or 22), 'ssh'
    prefer = device.connection_type or 'api'
    port = (device.api_port or 8728) if prefer == 'api' else (device.ssh_port or 22)
    return device.device_ip, port, prefer


def build_deployment_report():
    """Return checklist for production MikroTik RADIUS + WireGuard connectivity."""
    radius_host = current_app.config.get('FREERADIUS_HOST', '')
    radius_secret = current_app.config.get('RADIUS_SECRET', '')
    wg_dir = current_app.config.get('WIREGUARD_CONFIG_DIR', '')
    encryption_key = current_app.config.get('ENCRYPTION_KEY') or current_app.config.get('SECRET_KEY')
    wg_auto_push = current_app.config.get('WIREGUARD_MIKROTIK_AUTO_PUSH', True)

    devices = MikrotikDevice.query.filter_by(is_active=True).all()
    servers = WireGuardServer.query.filter_by(is_active=True).all()
    isps = ISP.query.filter_by(is_active=True).all()

    wg_dir_ok = False
    wg_dir_error = None
    if wg_dir:
        try:
            os.makedirs(wg_dir, exist_ok=True)
            test_file = os.path.join(wg_dir, '.write_test')
            with open(test_file, 'w', encoding='utf-8') as fh:
                fh.write('ok')
            os.remove(test_file)
            wg_dir_ok = True
        except OSError as exc:
            wg_dir_error = str(exc)

    radius_reachable = False
    if radius_host and radius_host not in ('freeradius', 'localhost', '127.0.0.1'):
        radius_reachable = _check_tcp(radius_host, 1812)
    elif radius_host == 'freeradius':
        radius_reachable = _check_tcp('freeradius', 1812)

    # Build the device metadata in the main thread (DB access is not
    # thread-safe), then probe TCP reachability concurrently with a short
    # timeout so the health check stays responsive when routers are down.
    isp_secret_map = {i.id: bool(i.radius_secret) for i in isps}
    grace = timedelta(seconds=int(
        current_app.config.get('DEVICE_OFFLINE_GRACE_SECONDS', 300)))
    now = datetime.utcnow()
    device_meta = []
    for device in devices:
        host, port, prefer = _probe_host_port(device)
        mgmt = bool(getattr(device, 'management_wg_enabled', False))
        last_synced = getattr(device, 'last_synced', None)
        device_meta.append({
            'id': device.id,
            'name': device.device_name,
            'ip': device.device_ip,
            'probe_host': host,
            'management_wg_enabled': mgmt,
            'management_wg_ip': getattr(device, 'management_wg_ip', None),
            'connection_type': prefer,
            'port': port,
            'has_radius_secret': isp_secret_map.get(device.isp_id, False),
            'status': device.device_status.value if device.device_status else 'unknown',
            # Sticky-online signal: a NAT router on the tunnel heartbeats the
            # server continuously, so treat "ONLINE + synced within grace" as
            # reachable even when a one-shot TCP probe misses.
            'recently_online': bool(
                mgmt
                and device.device_status
                and device.device_status.value == 'online'
                and last_synced
                and now - last_synced < grace
            ),
        })

    def _probe_reachable(meta):
        if not meta['probe_host']:
            return meta['id'], False
        # One quick retry for tunnel routers — the first packet after idle wakes
        # the WireGuard handshake, so a lone connect can miss on a live router.
        # Kept short (recently_online is the authoritative sticky signal) so a
        # genuinely-down router can't stall this endpoint.
        attempts = 2 if meta['management_wg_enabled'] else 1
        for attempt in range(attempts):
            if _check_tcp(meta['probe_host'], meta['port'], timeout=1.5):
                return meta['id'], True
            if attempt < attempts - 1:
                time.sleep(0.3)
        return meta['id'], False

    reachable_map = {}
    if device_meta:
        with ThreadPoolExecutor(max_workers=min(8, len(device_meta))) as pool:
            futures = [pool.submit(_probe_reachable, m) for m in device_meta]
            for fut in as_completed(futures):
                dev_id, ok = fut.result()
                reachable_map[dev_id] = ok

    device_checks = []
    for meta in device_meta:
        meta['api_reachable'] = bool(reachable_map.get(meta['id'], False) or meta['recently_online'])
        device_checks.append(meta)

    server_checks = []
    for server in servers:
        endpoint = (server.endpoint or '').strip()
        bad_endpoint = not endpoint or endpoint in ('localhost', '127.0.0.1', '0.0.0.0')
        peer_count = WireGuardPeer.query.filter_by(server_id=server.id, is_active=True).count()
        server_checks.append({
            'id': server.id,
            'name': server.name,
            'endpoint': endpoint,
            'port': server.port,
            'deployment_mode': server.deployment_mode,
            'mikrotik_device_id': server.mikrotik_device_id,
            'endpoint_ok': not bad_endpoint,
            'active_peers': peer_count,
        })

    issues = []
    if not radius_host:
        issues.append('Set FREERADIUS_HOST to the IP/hostname your MikroTik routers use for RADIUS (UDP 1812/1813).')
    elif radius_host in ('10.0.0.10',):
        issues.append('FREERADIUS_HOST still uses the dev placeholder 10.0.0.10 — set PUBLIC_SERVER_HOST to your real server IP.')

    # Captive portal must be reachable by the router (login page) and the phone
    # (redirect target); a loopback/dev base URL yields a blank sign-in page.
    from services.portal_urls import (
        public_base_url,
        portal_frontend_base_url,
        is_router_reachable_base,
    )
    if not is_router_reachable_base(public_base_url()) or not is_router_reachable_base(portal_frontend_base_url()):
        issues.append(
            'Captive portal URLs are not publicly reachable (loopback/dev host). Set '
            'PUBLIC_BASE_URL and PORTAL_BASE_URL to your public server/portal URL, or the '
            'hotspot sign-in page will be blank.'
        )
    if not radius_secret or radius_secret == 'radius_secret_key':
        issues.append('Change RADIUS_SECRET from the default and match it on each MikroTik / ISP record.')
    if not encryption_key:
        issues.append('Set ENCRYPTION_KEY (or SECRET_KEY) — required to store MikroTik and WireGuard credentials.')
    if not wg_dir_ok:
        issues.append(f'WireGuard config directory not writable: {wg_dir_error or wg_dir}')
    if not devices:
        issues.append('No MikroTik devices registered. Add routers under Devices → MikroTik.')
    elif not any(d['api_reachable'] for d in device_checks):
        issues.append('Billing server cannot reach any MikroTik API/SSH port. Open firewall from server → router.')
    mgmt_devices = [d for d in device_checks if d.get('management_wg_enabled')]
    if mgmt_devices and not any(d.get('management_wg_ip') for d in mgmt_devices):
        issues.append('Management WireGuard enabled but tunnel IPs missing — download management-tunnel-script.')
    isps_without_secret = [i for i in isps if not i.radius_secret]
    if isps_without_secret:
        issues.append(
            f'{len(isps_without_secret)} ISP(s) missing radius_secret — regenerate under ISP settings.'
        )
    if servers and not any(s['endpoint_ok'] for s in server_checks):
        issues.append('WireGuard server endpoint must be a public IP/hostname clients and routers can reach.')
    if servers and wg_auto_push and not any(s.get('mikrotik_device_id') for s in server_checks):
        mikrotik_mode = any(s['deployment_mode'] == 'mikrotik' for s in server_checks)
        if mikrotik_mode:
            issues.append('Link each WireGuard server to a MikroTik device for automatic peer push.')

    ready = len(issues) == 0

    return {
        'ready': ready,
        'issues': issues,
        'config': {
            'freeradius_host': radius_host,
            'radius_secret_set': bool(radius_secret),
            'wireguard_config_dir': wg_dir,
            'wireguard_config_writable': wg_dir_ok,
            'wireguard_mikrotik_auto_push': wg_auto_push,
            'radius_tcp_probe': radius_reachable,
        },
        'counts': {
            'mikrotik_devices': len(devices),
            'wireguard_servers': len(servers),
            'active_isps': len(isps),
        },
        'mikrotik_devices': device_checks,
        'wireguard_servers': server_checks,
        'next_steps': [
            'Register each MikroTik in the admin UI (IP, API user, encrypted password).',
            'Per-ISP radius_secret is synced to FreeRADIUS clients.conf when devices are added.',
            'Download RADIUS script: GET /api/devices/<id>/radius-script and import on the router.',
            'For NAT routers: enable management tunnel and import management-tunnel-script first.',
            'Open UDP 1812/1813 from each MikroTik to this server; TCP 8728/22 from server to MikroTik.',
            'WireGuard: set server endpoint to public IP, forward UDP 51820, enable ip_forward + NAT.',
            'For MikroTik-hosted WG: set deployment_mode=mikrotik and link the router on the WG server.',
        ],
    }


@health_bp.route('/deployment', methods=['GET'])
@rate_limit(limit=12, window=60, scope='health-deployment')
def deployment_health():
    try:
        report = build_deployment_report()
        status = 200 if report['ready'] else 503
        return jsonify({'ok': report['ready'], 'data': report}), status
    except Exception as exc:
        db.session.rollback()
        return jsonify({'ok': False, 'error': str(exc)}), 500


@health_bp.route('/radius-user', methods=['GET'])
@rate_limit(limit=20, window=60, scope='health-radius-user')
def radius_user_health():
    """Verify radcheck row exists for a customer email (RADIUS username)."""
    email = (request.args.get('email') or '').strip().lower()
    if not email:
        return jsonify({'ok': False, 'error': 'email query parameter is required'}), 400

    customer = find_customer_by_login(email)
    if not customer:
        return jsonify({
            'ok': False,
            'email': email,
            'found': False,
            'error': 'Customer not found',
        }), 404

    username = radius_username(customer)
    radcheck = RadCheck.query.filter_by(
        username=username,
        isp_id=customer.isp_id,
        is_active=True,
    ).first()

    return jsonify({
        'ok': bool(radcheck),
        'email': email,
        'customer_id': customer.id,
        'username': username,
        'radcheck_found': bool(radcheck),
        'customer_status': customer.status.value if customer.status else None,
        'connection_type': customer.connection_type,
        'message': 'RADIUS user provisioned' if radcheck else 'No active radcheck row for this customer',
    }), 200 if radcheck else 404
