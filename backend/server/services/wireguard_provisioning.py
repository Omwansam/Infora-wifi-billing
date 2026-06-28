"""
WireGuard peer provisioning integrated with ISP billing.

Flask writes peer records + config files; Linux WireGuard or MikroTik applies them.
"""
import ipaddress
import os
from datetime import datetime

from extensions import db
from models import (
    Customer,
    CustomerStatus,
    ISP,
    ServicePlan,
    WireGuardPeer,
    WireGuardServer,
)
from services.encryption import decrypt_value, encrypt_value
from services.wireguard_keys import generate_preshared_key, generate_wireguard_keypair
from services.wireguard_utils import (
    WG_INTERFACE,
    peer_comment,
    peer_queue_comment,
    peer_resource_name,
    queue_resource_name,
)


def wireguard_config_dir():
    return os.getenv(
        'WIREGUARD_CONFIG_DIR',
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'wireguard_configs'),
    )


def server_config_path(server):
    base = wireguard_config_dir()
    return os.path.join(base, f'isp_{server.isp_id}', f'server_{server.id}')


def get_server_private_key(server):
    return decrypt_value(server.private_key_encrypted)


def get_peer_private_key(peer):
    return decrypt_value(peer.private_key_encrypted)


def get_peer_preshared_key(peer):
    if not peer.preshared_key_encrypted:
        return None
    return decrypt_value(peer.preshared_key_encrypted)


def resolve_wireguard_server(plan, isp):
    """Pick WireGuard server for a plan/customer."""
    if plan and plan.wireguard_server_id:
        server = WireGuardServer.query.filter_by(
            id=plan.wireguard_server_id,
            isp_id=isp.id,
            is_active=True,
        ).first()
        if server:
            return server

    return WireGuardServer.query.filter_by(
        isp_id=isp.id,
        is_active=True,
    ).order_by(WireGuardServer.id.asc()).first()


def allocate_peer_ip(server):
    """Allocate next free host IP from server subnet (skips network + gateway)."""
    network = ipaddress.ip_network(server.subnet, strict=False)
    used = {
        p.assigned_ip.split('/')[0]
        for p in WireGuardPeer.query.filter_by(server_id=server.id, is_active=True).all()
    }
    gateway = server.server_address.split('/')[0]
    used.add(gateway)

    for host in network.hosts():
        ip = str(host)
        if ip not in used:
            return ip

    raise ValueError(f'No free IPs in subnet {server.subnet} for server {server.id}')


def build_client_config(peer, server, plan=None):
    """Generate wg-quick client .conf for customer download."""
    private_key = get_peer_private_key(peer)
    dns = (plan.wireguard_dns if plan and plan.wireguard_dns else None) or server.dns_servers or '8.8.8.8'
    allowed = peer.allowed_ips or (plan.wireguard_allowed_ips if plan else None) or '0.0.0.0/0'
    psk = get_peer_preshared_key(peer)

    lines = [
        '[Interface]',
        f'PrivateKey = {private_key}',
        f'Address = {peer.assigned_ip}/32',
        f'DNS = {dns}',
        f'MTU = {server.mtu or 1420}',
        '',
        '[Peer]',
        f'PublicKey = {server.public_key}',
    ]
    if psk:
        lines.append(f'PresharedKey = {psk}')
    lines.extend([
        f'Endpoint = {server.endpoint}:{server.port}',
        f'AllowedIPs = {allowed}',
        'PersistentKeepalive = 25',
    ])
    return '\n'.join(lines) + '\n'


def build_server_wg_conf(server):
    """Build full wg-quick server config with all active peers."""
    private_key = get_server_private_key(server)
    lines = [
        '[Interface]',
        f'PrivateKey = {private_key}',
        f'Address = {server.server_address}',
        f'ListenPort = {server.port}',
        'PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE',
        'PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE',
        '',
    ]

    peers = WireGuardPeer.query.filter_by(server_id=server.id, is_active=True).all()
    for peer in peers:
        lines.append('[Peer]')
        lines.append(f'PublicKey = {peer.public_key}')
        psk = get_peer_preshared_key(peer)
        if psk:
            lines.append(f'PresharedKey = {psk}')
        lines.append(f'AllowedIPs = {peer.assigned_ip}/32')
        lines.append('')

    return '\n'.join(lines).rstrip() + '\n'


def build_mikrotik_peer_script(peer, server, plan=None):
    """RouterOS v7+ commands to add/update a WireGuard peer on MikroTik."""
    customer = peer.customer
    name = peer_resource_name(customer.id, peer.assigned_ip)
    psk = get_peer_preshared_key(peer)
    comment = peer_comment(customer.id)

    lines = [
        f'# Infora WireGuard peer: {customer.full_name}',
        f'/interface wireguard add name={WG_INTERFACE} listen-port={server.port} disabled=no comment="infora-billing"',
        f'/ip address add address={server.server_address} interface={WG_INTERFACE}',
        f'/interface wireguard peers remove [find comment="{comment}"]',
        (
            f'/interface wireguard peers add name="{name}" interface={WG_INTERFACE} '
            f'public-key="{peer.public_key}" '
            f'allowed-address={peer.assigned_ip}/32'
            + (f' preshared-key="{psk}"' if psk else '')
            + f' comment="{comment}"'
        ),
    ]
    if plan:
        from services.plan_utils import format_mikrotik_rate_limit, get_plan_limits
        mbps = get_plan_limits(plan).get('bandwidth_limit')
        if mbps:
            rate = format_mikrotik_rate_limit(mbps)
            qcomment = peer_queue_comment(customer.id)
            lines.append(f'/queue simple remove [find comment="{qcomment}"]')
            lines.append(
                f'/queue simple add name="{queue_resource_name(customer.id)}" '
                f'target={peer.assigned_ip}/32 max-limit={rate} comment="{qcomment}"'
            )
    return '\n'.join(lines) + '\n'


def build_mikrotik_server_bootstrap(server):
    """Initial MikroTik WireGuard interface setup (server on router)."""
    private_key = get_server_private_key(server)
    return '\n'.join([
        '/interface wireguard add name=wg-infora listen-port={port} private-key="{key}" disabled=no comment="infora-billing"'.format(
            port=server.port,
            key=private_key,
        ),
        f'/ip address add address={server.server_address} interface={WG_INTERFACE}',
        '# Add customer peers via Flask provision or /api/wireguard/servers/{id}/mikrotik-script',
    ]) + '\n'


def sync_server_config_files(server):
    """Write wg0.conf and MikroTik peer scripts to shared config volume."""
    path = server_config_path(server)
    os.makedirs(path, exist_ok=True)

    wg_path = os.path.join(path, 'wg0.conf')
    with open(wg_path, 'w', encoding='utf-8') as fh:
        fh.write(build_server_wg_conf(server))

    if server.deployment_mode == 'mikrotik':
        peers_script = os.path.join(path, 'mikrotik-peers.rsc')
        peer_blocks = []
        for peer in WireGuardPeer.query.filter_by(server_id=server.id, is_active=True).all():
            peer_blocks.append(build_mikrotik_peer_script(peer, server))
        with open(peers_script, 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(peer_blocks))

        bootstrap = os.path.join(path, 'mikrotik-server.rsc')
        with open(bootstrap, 'w', encoding='utf-8') as fh:
            fh.write(build_mikrotik_server_bootstrap(server))

    return wg_path


def create_wireguard_server(isp, data):
    """Create ISP WireGuard server with generated keys."""
    private_key, public_key = generate_wireguard_keypair()
    subnet = data['subnet']
    network = ipaddress.ip_network(subnet, strict=False)
    server_address = data.get('server_address') or f'{next(network.hosts())}/{network.prefixlen}'

    server = WireGuardServer(
        isp_id=isp.id,
        name=data['name'],
        endpoint=data['endpoint'],
        port=int(data.get('port', 51820)),
        subnet=subnet,
        server_address=server_address,
        public_key=public_key,
        private_key_encrypted=encrypt_value(private_key),
        dns_servers=data.get('dns_servers', '8.8.8.8,8.8.4.4'),
        mtu=int(data.get('mtu', 1420)),
        deployment_mode=data.get('deployment_mode', 'linux'),
        mikrotik_device_id=data.get('mikrotik_device_id'),
        is_active=data.get('is_active', True),
    )
    db.session.add(server)
    db.session.flush()
    sync_server_config_files(server)
    return server


def provision_customer_wireguard(customer, plan, isp, server=None):
    """Create or refresh WireGuard peer for an active WireGuard customer."""
    server = server or resolve_wireguard_server(plan, isp)
    if not server:
        raise ValueError('No active WireGuard server configured for this ISP')

    existing = WireGuardPeer.query.filter_by(customer_id=customer.id).first()
    if existing and not existing.is_active:
        db.session.delete(existing)
        db.session.flush()
        existing = None

    if existing:
        existing.is_active = True
        existing.server_id = server.id
        peer = existing
    else:
        private_key, public_key = generate_wireguard_keypair()
        psk = generate_preshared_key()
        assigned_ip = allocate_peer_ip(server)
        allowed = plan.wireguard_allowed_ips if plan and plan.wireguard_allowed_ips else '0.0.0.0/0'

        peer = WireGuardPeer(
            customer_id=customer.id,
            server_id=server.id,
            isp_id=isp.id,
            assigned_ip=assigned_ip,
            public_key=public_key,
            private_key_encrypted=encrypt_value(private_key),
            preshared_key_encrypted=encrypt_value(psk),
            allowed_ips=allowed,
            is_active=True,
        )
        db.session.add(peer)

    customer.connection_type = 'wireguard'
    db.session.flush()
    sync_server_config_files(server)

    from services.mikrotik_wireguard import push_peer_to_mikrotik
    push_peer_to_mikrotik(peer, plan=plan, customer=customer)

    return peer


def deprovision_customer_wireguard(customer):
    """Remove peer from server config (hard deactivate)."""
    peer = WireGuardPeer.query.filter_by(customer_id=customer.id).first()
    if not peer:
        return False

    server = WireGuardServer.query.get(peer.server_id)
    customer = Customer.query.get(peer.customer_id)

    from services.mikrotik_wireguard import remove_peer_from_mikrotik
    remove_peer_from_mikrotik(peer, customer=customer)

    db.session.delete(peer)
    db.session.flush()

    if server:
        sync_server_config_files(server)
    return True


def suspend_customer_wireguard(customer):
    """Alias for deprovision on suspend."""
    return deprovision_customer_wireguard(customer)


def serialize_peer(peer, include_config=False, plan=None):
    """Serialize peer for API responses."""
    from services.plan_utils import get_plan_limits

    server = peer.server
    data = {
        'id': peer.id,
        'customer_id': peer.customer_id,
        'server_id': peer.server_id,
        'isp_id': peer.isp_id,
        'assigned_ip': peer.assigned_ip,
        'public_key': peer.public_key,
        'allowed_ips': peer.allowed_ips,
        'last_handshake': peer.last_handshake.isoformat() if peer.last_handshake else None,
        'rx_bytes': peer.rx_bytes or 0,
        'tx_bytes': peer.tx_bytes or 0,
        'is_active': peer.is_active,
        'mikrotik_peer_name': getattr(peer, 'mikrotik_peer_name', None),
        'mikrotik_synced_at': peer.mikrotik_synced_at.isoformat() if getattr(peer, 'mikrotik_synced_at', None) else None,
        'mikrotik_sync_error': getattr(peer, 'mikrotik_sync_error', None),
        'bandwidth_limit_mbps': (
            get_plan_limits(plan).get('bandwidth_limit') if plan else None
        ),
        'server': {
            'id': server.id,
            'name': server.name,
            'endpoint': server.endpoint,
            'port': server.port,
        } if server else None,
    }
    if include_config and server:
        data['config'] = build_client_config(peer, server, plan)
    return data
