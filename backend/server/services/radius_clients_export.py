"""
Generate FreeRADIUS clients.conf from radius_clients + mikrotik_devices + ISPs.
"""
import ipaddress
import os
import socket
from datetime import datetime

from flask import current_app

from models import ISP, MikrotikDevice, RadiusClient, RadiusNasClient
from services.encryption import decrypt_value


def usable_client_host(host):
    """Return ``host`` if FreeRADIUS can parse it as a client address, else None.

    FreeRADIUS resolves every non-literal ``ipaddr`` at startup and **aborts the
    whole server** if one fails::

        clients.conf[26]: Failed resolving "radius.company.com" to IPv4 address
        clients.conf[26]: Error parsing client section

    One stale or seeded NAS row must never be able to take RADIUS down for every
    subscriber, so anything that isn't a literal IP/CIDR is resolved here first
    and dropped (with a comment in the file) when it doesn't resolve.
    """
    host = (host or '').strip()
    if not host:
        return None
    try:
        ipaddress.ip_network(host, strict=False)
        return host
    except ValueError:
        pass
    try:
        socket.getaddrinfo(host, None, socket.AF_INET)
        return host
    except OSError:
        return None


def radius_clients_conf_path():
    """Resolve path for clients.conf (env, Flask config, or repo default)."""
    env_path = os.getenv('RADIUS_CLIENTS_CONF_PATH')
    if env_path:
        return env_path
    try:
        cfg = current_app.config.get('RADIUS_CLIENTS_CONF_PATH')
        if cfg:
            return cfg
    except RuntimeError:
        pass
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
    return os.path.join(repo_root, 'config', 'freeradius', 'clients.conf')


def _nas_host_for_device(device):
    """NAS IP FreeRADIUS should expect for RADIUS packets from this router.

    Strips any CIDR suffix: ``management_wg_ip`` is stored as an interface
    address (10.250.0.3/24), and writing that into clients.conf would define the
    whole tunnel subnet as one client, so every router would share the first
    device's secret and the rest would be rejected as unknown.
    """
    if getattr(device, 'management_wg_enabled', False) and getattr(device, 'management_wg_ip', None):
        return device.management_wg_ip.strip().split('/')[0]
    return device.device_ip.strip().split('/')[0]


def generate_clients_conf(default_secret=None):
    """Build clients.conf content from database NAS records."""
    from services.radius_provisioning import resolve_isp_radius_secret
    default_secret = default_secret or os.getenv('RADIUS_SECRET', 'radius_secret_key')
    lines = [
        '# Auto-generated FreeRADIUS clients.conf',
        f'# Generated: {datetime.utcnow().isoformat()}Z',
        '# Run: flask generate-radius-clients',
        '',
        'client localhost {',
        f'    ipaddr = 127.0.0.1',
        f'    secret = {default_secret}',
        '    shortname = localhost',
        '    nas_type = other',
        '}',
        '',
    ]

    seen_hosts = {'127.0.0.1'}
    skipped = []

    for client in RadiusClient.query.filter_by(is_active=True).all():
        host = usable_client_host(client.host)
        if not host:
            skipped.append(f'{client.name or client.id} ({client.host})')
            continue
        if host in seen_hosts:
            continue
        seen_hosts.add(host)
        secret = client.secret or default_secret
        nas_type = client.nas_type or 'mikrotik'
        shortname = client.shortname or client.name.replace(' ', '_')[:32]
        lines.extend([
            f'client {shortname} {{',
            f'    ipaddr = {host}',
            f'    secret = {secret}',
            f'    shortname = {shortname}',
            f'    nas_type = {nas_type}',
            '}',
            '',
        ])

    for device in MikrotikDevice.query.filter_by(is_active=True).all():
        host = usable_client_host(_nas_host_for_device(device))
        if not host:
            skipped.append(f'device {device.device_name}')
            continue
        if host in seen_hosts:
            continue
        seen_hosts.add(host)
        isp = ISP.query.get(device.isp_id) if device.isp_id else None
        secret = resolve_isp_radius_secret(isp, default_secret)
        shortname = device.device_name.replace(' ', '_')[:32]
        lines.extend([
            f'client {shortname} {{',
            f'    ipaddr = {host}',
            f'    secret = {secret}',
            f'    shortname = {shortname}',
            '    nas_type = mikrotik',
            '}',
            '',
        ])

    # NAS clients registered manually in Settings > RADIUS
    for nas in RadiusNasClient.query.all():
        host = usable_client_host(nas.ip_address)
        if not host:
            skipped.append(f'NAS {nas.name or nas.id} ({nas.ip_address})')
            continue
        if host in seen_hosts:
            continue
        seen_hosts.add(host)
        isp = ISP.query.get(nas.isp_id) if nas.isp_id else None
        secret = (decrypt_value(nas.shared_secret) if nas.shared_secret else None) \
            or resolve_isp_radius_secret(isp, default_secret)
        shortname = (nas.name or 'nas').replace(' ', '_')[:32]
        lines.extend([
            f'client {shortname} {{',
            f'    ipaddr = {host}',
            f'    secret = {secret}',
            f'    shortname = {shortname}',
            '    nas_type = mikrotik',
            '}',
            '',
        ])

    # Docker bridge network — development fallback
    lines.extend([
        'client docker_bridge {',
        '    ipaddr = 172.16.0.0/12',
        f'    secret = {default_secret}',
        '    shortname = docker',
        '    nas_type = other',
        '}',
        '',
    ])

    # Record what was dropped. Silently omitting a NAS would be its own outage
    # (that router's requests get ignored as an unknown client), so make it
    # visible right where an operator is already looking.
    if skipped:
        lines.append('# Skipped — address is not an IP/CIDR and does not resolve,')
        lines.append('# which would abort FreeRADIUS startup for every subscriber:')
        lines.extend(f'#   - {entry}' for entry in skipped)
        lines.append('')

    return '\n'.join(lines)


def sync_radius_clients_conf(default_secret=None):
    """Regenerate clients.conf and write to disk for FreeRADIUS volume mount."""
    content = generate_clients_conf(default_secret=default_secret)
    output = radius_clients_conf_path()
    os.makedirs(os.path.dirname(output), exist_ok=True)
    with open(output, 'w', encoding='utf-8') as fh:
        fh.write(content)
    return output
