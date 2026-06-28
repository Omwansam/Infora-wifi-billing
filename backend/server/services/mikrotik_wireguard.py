"""MikroTik RouterOS WireGuard peer push and simple-queue bandwidth limits."""
import logging
import os
from datetime import datetime

from mikrotik_client import MikroTikAPIError, MikroTikClient, MikroTikSSHError
from models import Customer, CustomerStatus, MikrotikDevice, WireGuardPeer, WireGuardServer
from services.mikrotik_sync import device_connection_config
from services.plan_utils import format_mikrotik_rate_limit, get_plan_limits
from services.wireguard_utils import (
    WG_INTERFACE,
    peer_comment,
    peer_queue_comment,
    peer_resource_name,
    queue_resource_name,
)
from services.wireguard_provisioning import get_peer_preshared_key, get_server_private_key

logger = logging.getLogger(__name__)


def mikrotik_auto_push_enabled():
    return os.getenv('WIREGUARD_MIKROTIK_AUTO_PUSH', 'true').lower() in ('1', 'true', 'yes')


def resolve_mikrotik_device(server):
    """Return MikroTik device for WireGuard push (explicit link or ISP default)."""
    if server.mikrotik_device_id:
        device = MikrotikDevice.query.filter_by(
            id=server.mikrotik_device_id,
            isp_id=server.isp_id,
            is_active=True,
        ).first()
        if device:
            return device

    if server.deployment_mode == 'mikrotik':
        return MikrotikDevice.query.filter_by(
            isp_id=server.isp_id,
            is_active=True,
        ).order_by(MikrotikDevice.id.asc()).first()

    if server.mikrotik_device_id is not None:
        return None

    return MikrotikDevice.query.filter_by(
        isp_id=server.isp_id,
        is_active=True,
    ).order_by(MikrotikDevice.id.asc()).first()


def run_routeros_commands(device, commands, connection_type='ssh'):
    """Execute RouterOS commands on a MikroTik device."""
    config = device_connection_config(device, connection_type)
    executed = []
    errors = []

    with MikroTikClient(config) as client:
        if not client.connect():
            raise MikroTikAPIError('Failed to connect to MikroTik device')

        use_ssh = config.connection_type.value == 'ssh'
        for raw in commands:
            cmd = raw.strip()
            if not cmd or cmd.startswith('#'):
                continue
            try:
                if use_ssh:
                    _out, err = client._ssh_execute_command(cmd)
                    if err and 'expected end of command' not in err.lower():
                        if 'already have' in err.lower() or 'already exists' in err.lower():
                            pass
                        elif err.strip():
                            errors.append(f'{cmd}: {err.strip()}')
                else:
                    api_cmd, params = _routeros_to_api(cmd)
                    response = client._api_send_command(api_cmd, params)
                    if response.get('message'):
                        msg = response['message']
                        if 'already' not in msg.lower():
                            errors.append(f'{cmd}: {msg}')
                executed.append(cmd)
            except (MikroTikAPIError, MikroTikSSHError) as exc:
                errors.append(f'{cmd}: {exc}')

    return {'ok': len(errors) == 0, 'executed': executed, 'errors': errors}


def _routeros_to_api(cmd):
    """Best-effort map a single RouterOS CLI line to API path + params."""
    if cmd.startswith('/'):
        parts = cmd[1:].split()
        path = '/' + '/'.join(parts[0].split('/'))
        action = parts[1] if len(parts) > 1 else 'print'
        api_path = f'{path}/{action}'

        params = {}
        rest = ' '.join(parts[2:]) if len(parts) > 2 else ''
        if rest.startswith('[') and 'find' in rest:
            if 'comment=' in rest:
                import re
                m = re.search(r'comment="([^"]+)"', rest)
                if m:
                    params['?comment'] = m.group(1)
        else:
            tokens = _tokenize_routeros_kv(rest)
            for key, value in tokens:
                key = key.replace('-', '_')
                params[key] = value
        return api_path, params

    raise MikroTikAPIError(f'Unsupported RouterOS command: {cmd}')


def _tokenize_routeros_kv(rest):
    tokens = []
    i = 0
    while i < len(rest):
        while i < len(rest) and rest[i] == ' ':
            i += 1
        if i >= len(rest):
            break
        eq = rest.find('=', i)
        if eq == -1:
            break
        key = rest[i:eq]
        i = eq + 1
        if i < len(rest) and rest[i] == '"':
            end = rest.find('"', i + 1)
            value = rest[i + 1:end] if end != -1 else rest[i + 1:]
            i = end + 1 if end != -1 else len(rest)
        else:
            sp = rest.find(' ', i)
            if sp == -1:
                value = rest[i:]
                i = len(rest)
            else:
                value = rest[i:sp]
                i = sp
        tokens.append((key, value))
    return tokens


def build_peer_push_commands(server, peer, customer, plan=None):
    """RouterOS commands to ensure WG interface, peer, and bandwidth queue."""
    name = peer_resource_name(customer.id, peer.assigned_ip)
    comment = peer_comment(customer.id)
    qname = queue_resource_name(customer.id)
    qcomment = peer_queue_comment(customer.id)
    psk = get_peer_preshared_key(peer)
    private_key = get_server_private_key(server)

    commands = []

    if server.deployment_mode == 'mikrotik':
        commands.append(
            f':if ([:len [/interface wireguard find name={WG_INTERFACE}]] = 0) do={{ '
            f'/interface wireguard add name={WG_INTERFACE} listen-port={server.port} '
            f'private-key="{private_key}" disabled=no comment="infora-billing" }}'
        )
        commands.append(
            f':if ([:len [/ip address find interface={WG_INTERFACE}]] = 0) do={{ '
            f'/ip address add address={server.server_address} interface={WG_INTERFACE} }}'
        )

    commands.append(f'/interface wireguard peers remove [find comment="{comment}"]')
    peer_add = (
        f'/interface wireguard peers add name="{name}" interface={WG_INTERFACE} '
        f'public-key="{peer.public_key}" allowed-address={peer.assigned_ip}/32 '
        f'comment="{comment}"'
    )
    if psk:
        peer_add += f' preshared-key="{psk}"'
    commands.append(peer_add)

    limits = get_plan_limits(plan) if plan else {}
    mbps = limits.get('bandwidth_limit')
    if mbps:
        rate = format_mikrotik_rate_limit(mbps)
        commands.append(f'/queue simple remove [find comment="{qcomment}"]')
        commands.append(
            f'/queue simple add name="{qname}" target={peer.assigned_ip}/32 '
            f'max-limit={rate} comment="{qcomment}"'
        )

    return commands


def build_peer_remove_commands(customer_id):
    comment = peer_comment(customer_id)
    qcomment = peer_queue_comment(customer_id)
    return [
        f'/interface wireguard peers remove [find comment="{comment}"]',
        f'/queue simple remove [find comment="{qcomment}"]',
    ]


def push_peer_to_mikrotik(peer, plan=None, customer=None):
    """
    Push WireGuard peer + queue to linked MikroTik router.
    Updates peer.mikrotik_synced_at / mikrotik_sync_error.
    """
    if not mikrotik_auto_push_enabled():
        return {'ok': True, 'skipped': True, 'reason': 'auto-push disabled'}

    server = WireGuardServer.query.get(peer.server_id)
    if not server:
        return {'ok': False, 'errors': ['Server not found']}

    device = resolve_mikrotik_device(server)
    if not device:
        return {'ok': True, 'skipped': True, 'reason': 'no MikroTik device linked'}

    customer = customer or Customer.query.get(peer.customer_id)
    if not customer:
        return {'ok': False, 'errors': ['Customer not found']}

    plan = plan or customer.service_plan
    commands = build_peer_push_commands(server, peer, customer, plan)

    try:
        conn = device.connection_type or 'api'
        result = run_routeros_commands(device, commands, connection_type=conn)
        peer.mikrotik_peer_name = peer_resource_name(customer.id, peer.assigned_ip)
        peer.mikrotik_synced_at = datetime.utcnow()
        peer.mikrotik_sync_error = None if result['ok'] else '; '.join(result['errors'])[:500]
        if not result['ok']:
            logger.warning('MikroTik peer push partial failure peer=%s: %s', peer.id, result['errors'])
        return result
    except Exception as exc:
        peer.mikrotik_sync_error = str(exc)[:500]
        logger.exception('MikroTik peer push failed peer=%s', peer.id)
        return {'ok': False, 'errors': [str(exc)]}


def remove_peer_from_mikrotik(peer, customer=None):
    """Remove WireGuard peer and queue from MikroTik."""
    if not mikrotik_auto_push_enabled():
        return {'ok': True, 'skipped': True}

    server = WireGuardServer.query.get(peer.server_id)
    if not server:
        return {'ok': False, 'errors': ['Server not found']}

    device = resolve_mikrotik_device(server)
    if not device:
        return {'ok': True, 'skipped': True, 'reason': 'no MikroTik device'}

    customer = customer or Customer.query.get(peer.customer_id)
    customer_id = customer.id if customer else peer.customer_id
    commands = build_peer_remove_commands(customer_id)

    try:
        conn = device.connection_type or 'api'
        return run_routeros_commands(device, commands, connection_type=conn)
    except Exception as exc:
        logger.warning('MikroTik peer remove failed peer=%s: %s', peer.id, exc)
        return {'ok': False, 'errors': [str(exc)]}


def reprovision_plan_wireguard_peers(plan):
    """Re-push MikroTik peers/queues when plan bandwidth or limits change."""
    if plan.plan_type != 'wireguard':
        return 0

    customers = Customer.query.filter_by(
        service_plan_id=plan.id,
        isp_id=plan.isp_id,
        status=CustomerStatus.ACTIVE,
    ).all()

    count = 0
    for customer in customers:
        peer = WireGuardPeer.query.filter_by(customer_id=customer.id, is_active=True).first()
        if peer:
            push_peer_to_mikrotik(peer, plan=plan, customer=customer)
            count += 1
    return count


def sync_server_peers_to_mikrotik(server_id):
    """Push all active peers for a server to MikroTik."""
    server = WireGuardServer.query.get(server_id)
    if not server:
        return {'ok': False, 'errors': ['Server not found']}

    peers = WireGuardPeer.query.filter_by(server_id=server_id, is_active=True).all()
    results = {'pushed': 0, 'failed': 0, 'errors': []}
    for peer in peers:
        customer = Customer.query.get(peer.customer_id)
        plan = customer.service_plan if customer else None
        r = push_peer_to_mikrotik(peer, plan=plan, customer=customer)
        if r.get('ok') or r.get('skipped'):
            results['pushed'] += 1
        else:
            results['failed'] += 1
            results['errors'].extend(r.get('errors', []))
    results['ok'] = results['failed'] == 0
    return results
