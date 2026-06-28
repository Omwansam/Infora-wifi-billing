"""Management WireGuard tunnels: MikroTik router → billing host (not customer VPN)."""
import ipaddress
import json
import os

from flask import current_app

from extensions import db
from models import MikrotikDevice
from services.encryption import decrypt_value, encrypt_value
from services.wireguard_keys import generate_wireguard_keypair
from services.wireguard_provisioning import wireguard_config_dir


def _mgmt_config_dir():
    return os.path.join(wireguard_config_dir(), 'mgmt')


def _mgmt_state_path():
    return os.path.join(_mgmt_config_dir(), 'server.json')


def _mgmt_subnet():
    return current_app.config.get('WIREGUARD_MGMT_SUBNET', '10.250.0.0/24')


def _mgmt_server_ip():
    return current_app.config.get('WIREGUARD_MGMT_SERVER_IP', '10.250.0.1')


def _mgmt_port():
    return int(current_app.config.get('WIREGUARD_MGMT_PORT', 51821))


def ensure_management_server():
    """Create or load billing-host management WG server keys."""
    base = _mgmt_config_dir()
    os.makedirs(base, exist_ok=True)
    state_path = _mgmt_state_path()

    if os.path.isfile(state_path):
        with open(state_path, 'r', encoding='utf-8') as fh:
            return json.load(fh)

    private_key, public_key = generate_wireguard_keypair()
    state = {
        'private_key': private_key,
        'public_key': public_key,
        'subnet': _mgmt_subnet(),
        'server_ip': _mgmt_server_ip(),
        'port': _mgmt_port(),
    }
    with open(state_path, 'w', encoding='utf-8') as fh:
        json.dump(state, fh, indent=2)

    _write_server_wg_conf(state)
    return state


def _write_server_wg_conf(state):
    """Write wg-mgmt server config with all active device peers."""
    network = ipaddress.ip_network(state['subnet'], strict=False)
    server_ip = state['server_ip']
    if '/' not in server_ip:
        server_ip = f"{server_ip}/{network.prefixlen}"

    lines = [
        '[Interface]',
        f"PrivateKey = {state['private_key']}",
        f"Address = {server_ip}",
        f"ListenPort = {state['port']}",
        '',
    ]

    devices = MikrotikDevice.query.filter_by(
        is_active=True,
        management_wg_enabled=True,
    ).all()
    for device in devices:
        if not device.management_wg_public_key or not device.management_wg_ip:
            continue
        peer_ip = device.management_wg_ip.split('/')[0]
        lines.extend([
            f"# {device.device_name}",
            '[Peer]',
            f"PublicKey = {device.management_wg_public_key}",
            f"AllowedIPs = {peer_ip}/32",
            '',
        ])

    conf_path = os.path.join(_mgmt_config_dir(), 'wg-mgmt.conf')
    with open(conf_path, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))


def _allocate_device_tunnel_ip():
    """Pick next free host in management subnet (server is .1)."""
    network = ipaddress.ip_network(_mgmt_subnet(), strict=False)
    server_host = _mgmt_server_ip().split('/')[0]
    used = {server_host}
    for device in MikrotikDevice.query.filter(
        MikrotikDevice.management_wg_ip.isnot(None),
    ).all():
        if device.management_wg_ip:
            used.add(device.management_wg_ip.split('/')[0])

    for host in network.hosts():
        ip = str(host)
        if ip not in used:
            return ip
    raise ValueError(f'No free management tunnel IPs in {_mgmt_subnet()}')


def provision_device_management_tunnel(device):
    """Generate keys + tunnel IP for a MikroTik management peer."""
    state = ensure_management_server()
    private_key, public_key = generate_wireguard_keypair()
    tunnel_ip = _allocate_device_tunnel_ip()

    device.management_wg_enabled = True
    device.management_wg_ip = tunnel_ip
    device.management_wg_public_key = public_key
    device.management_wg_private_key_encrypted = encrypt_value(private_key)
    db.session.flush()

    _write_server_wg_conf(state)
    return state


def deprovision_device_management_tunnel(device):
    """Remove management tunnel from device and server config."""
    device.management_wg_enabled = False
    device.management_wg_ip = None
    device.management_wg_public_key = None
    device.management_wg_private_key_encrypted = None
    db.session.flush()

    state_path = _mgmt_state_path()
    if os.path.isfile(state_path):
        with open(state_path, 'r', encoding='utf-8') as fh:
            state = json.load(fh)
        _write_server_wg_conf(state)


def get_device_management_private_key(device):
    if not device.management_wg_private_key_encrypted:
        return None
    return decrypt_value(device.management_wg_private_key_encrypted)


def resolve_radius_host_for_device(device):
    """RADIUS server IP to embed in MikroTik scripts."""
    if device.management_wg_enabled:
        return _mgmt_server_ip().split('/')[0]
    return (
        current_app.config.get('PUBLIC_SERVER_HOST')
        or current_app.config.get('FREERADIUS_HOST', 'freeradius')
    )


def build_mikrotik_management_tunnel_script(device):
    """RouterOS script for wg-mgmt interface to billing host."""
    if not device.management_wg_enabled or not device.management_wg_ip:
        raise ValueError('Management tunnel not provisioned for this device')

    state = ensure_management_server()
    private_key = get_device_management_private_key(device)
    if not private_key:
        raise ValueError('Management tunnel private key missing')

    network = ipaddress.ip_network(state['subnet'], strict=False)
    prefix = network.prefixlen
    tunnel_ip = device.management_wg_ip.split('/')[0]
    server_ip = state['server_ip'].split('/')[0]
    endpoint = (
        current_app.config.get('WIREGUARD_MGMT_ENDPOINT')
        or current_app.config.get('PUBLIC_SERVER_HOST')
        or current_app.config.get('FREERADIUS_HOST', '')
    )
    port = state['port']

    lines = [
        '# Infora billing — management WireGuard tunnel (router → billing server)',
        f'# Device: {device.device_name}',
        '',
        '/interface wireguard remove [find name="wg-mgmt"]',
        '/interface wireguard add name=wg-mgmt listen-port=51822 disabled=no comment="infora-mgmt-tunnel"',
        f'/interface wireguard set wg-mgmt private-key="{private_key}"',
        f'/ip address add address={tunnel_ip}/{prefix} interface=wg-mgmt comment="infora-mgmt-tunnel"',
        '/interface wireguard peers remove [find interface=wg-mgmt]',
        (
            f'/interface wireguard peers add interface=wg-mgmt name=infora-billing-server '
            f'public-key="{state["public_key"]}" '
            f'endpoint-address={endpoint} endpoint-port={port} '
            f'allowed-address={server_ip}/32 persistent-keepalive=25 '
            f'comment="infora-billing-mgmt"'
        ),
        f'/ip route add dst-address={server_ip}/32 gateway=wg-mgmt comment="infora-radius-via-tunnel"',
        ':log info "Infora management WireGuard tunnel configured"',
    ]
    return '\n'.join(lines)
