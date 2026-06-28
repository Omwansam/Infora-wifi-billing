"""
Generate FreeRADIUS clients.conf from radius_clients + mikrotik_devices + ISPs.
"""
import os
from datetime import datetime

from flask import current_app

from models import ISP, MikrotikDevice, RadiusClient


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
    """NAS IP FreeRADIUS should expect for RADIUS packets from this router."""
    if getattr(device, 'management_wg_enabled', False) and getattr(device, 'management_wg_ip', None):
        return device.management_wg_ip.strip()
    return device.device_ip.strip()


def generate_clients_conf(default_secret=None):
    """Build clients.conf content from database NAS records."""
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

    for client in RadiusClient.query.filter_by(is_active=True).all():
        host = client.host.strip()
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
        host = _nas_host_for_device(device)
        if host in seen_hosts:
            continue
        seen_hosts.add(host)
        isp = ISP.query.get(device.isp_id) if device.isp_id else None
        secret = (isp.radius_secret if isp and isp.radius_secret else default_secret)
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

    return '\n'.join(lines)


def sync_radius_clients_conf(default_secret=None):
    """Regenerate clients.conf and write to disk for FreeRADIUS volume mount."""
    content = generate_clients_conf(default_secret=default_secret)
    output = radius_clients_conf_path()
    os.makedirs(os.path.dirname(output), exist_ok=True)
    with open(output, 'w', encoding='utf-8') as fh:
        fh.write(content)
    return output
