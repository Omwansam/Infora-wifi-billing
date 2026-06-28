"""Deployment and connectivity health checks for MikroTik + WireGuard."""
import os
import socket

from flask import Blueprint, current_app, jsonify, request

from extensions import db
from models import ISP, Customer, MikrotikDevice, RadCheck, WireGuardPeer, WireGuardServer
from services.radius_provisioning import radius_username

health_bp = Blueprint('health', __name__, url_prefix='/api/health')


def _check_tcp(host, port, timeout=3):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


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

    device_checks = []
    for device in devices:
        api_port = device.api_port or 8728
        ssh_port = device.ssh_port or 22
        prefer = device.connection_type or 'api'
        port = api_port if prefer == 'api' else ssh_port
        reachable = _check_tcp(device.device_ip, port) if device.device_ip else False
        isp = ISP.query.get(device.isp_id) if device.isp_id else None
        device_checks.append({
            'id': device.id,
            'name': device.device_name,
            'ip': device.device_ip,
            'management_wg_enabled': bool(getattr(device, 'management_wg_enabled', False)),
            'management_wg_ip': getattr(device, 'management_wg_ip', None),
            'connection_type': prefer,
            'port': port,
            'api_reachable': reachable,
            'has_radius_secret': bool(isp and isp.radius_secret),
            'status': device.device_status.value if device.device_status else 'unknown',
        })

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
def deployment_health():
    try:
        report = build_deployment_report()
        status = 200 if report['ready'] else 503
        return jsonify({'ok': report['ready'], 'data': report}), status
    except Exception as exc:
        db.session.rollback()
        return jsonify({'ok': False, 'error': str(exc)}), 500


@health_bp.route('/radius-user', methods=['GET'])
def radius_user_health():
    """Verify radcheck row exists for a customer email (RADIUS username)."""
    email = (request.args.get('email') or '').strip().lower()
    if not email:
        return jsonify({'ok': False, 'error': 'email query parameter is required'}), 400

    customer = Customer.query.filter_by(email=email).first()
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
