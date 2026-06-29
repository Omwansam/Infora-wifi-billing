"""Shared MikroTik provisioning script builders.

Single source of truth used by both the authenticated download route
(/api/devices/<id>/radius-script) and the public token route
(/api/provision/<token>/script).
"""
import ipaddress
import socket

from flask import current_app

from models import ISP
from services.encryption import decrypt_value
from services.wireguard_management import (
    ensure_management_server,
    get_device_management_private_key,
    resolve_radius_host_for_device,
)


def resolve_provision_base_url():
    """HTTPS base URL the router uses to fetch its provisioning script."""
    base = (
        current_app.config.get('PROVISION_BASE_URL')
        or current_app.config.get('PUBLIC_SERVER_HOST')
        or current_app.config.get('FREERADIUS_HOST', '')
    ).strip()
    if not base:
        return ''
    if not base.startswith('http://') and not base.startswith('https://'):
        base = f'https://{base}'
    return base.rstrip('/')


def _is_ip_address(value):
    try:
        ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


def _resolve_endpoint_ip(endpoint):
    """Return a literal IP for the WireGuard endpoint.

    MikroTik routers frequently have no working DNS resolver, so a hostname
    endpoint (e.g. wg.example.com) never resolves on the router and the tunnel
    never initiates a handshake. We resolve the hostname here on the server and
    embed the literal IP in the script so the router needs no DNS at all.
    """
    endpoint = (endpoint or '').strip()
    if not endpoint or _is_ip_address(endpoint):
        return endpoint
    try:
        return socket.gethostbyname(endpoint)
    except OSError:
        return endpoint


def _build_wireguard_tunnel_lines(device):
    """RouterOS commands to set up the management WireGuard tunnel."""
    if not device.management_wg_enabled or not device.management_wg_ip:
        return []

    private_key = get_device_management_private_key(device)
    if not private_key:
        return []

    state = ensure_management_server()
    network = ipaddress.ip_network(state['subnet'], strict=False)
    prefix = network.prefixlen
    tunnel_ip = device.management_wg_ip.split('/')[0]
    server_ip = state['server_ip'].split('/')[0]
    endpoint = _resolve_endpoint_ip(
        current_app.config.get('WIREGUARD_MGMT_ENDPOINT')
        or current_app.config.get('PUBLIC_SERVER_HOST')
        or current_app.config.get('FREERADIUS_HOST', '')
    )
    port = state['port']

    return [
        '',
        '# --- Management WireGuard tunnel (router → billing server) ---',
        ':do { /interface wireguard remove [find name="wg-mgmt"] } on-error={}',
        '/interface wireguard add name=wg-mgmt listen-port=51822 disabled=no comment="infora-mgmt-tunnel"',
        f'/interface wireguard set wg-mgmt private-key="{private_key}"',
        f':do {{ /ip address remove [find comment="infora-mgmt-tunnel"] }} on-error={{}}',
        f'/ip address add address={tunnel_ip}/{prefix} interface=wg-mgmt comment="infora-mgmt-tunnel"',
        '/interface wireguard peers remove [find interface=wg-mgmt]',
        (
            f'/interface wireguard peers add interface=wg-mgmt '
            f'public-key="{state["public_key"]}" '
            f'endpoint-address={endpoint} endpoint-port={port} '
            f'allowed-address={server_ip}/32 persistent-keepalive=25 '
            f'comment="infora-billing-mgmt"'
        ),
        f':do {{ /ip route remove [find comment="infora-radius-via-tunnel"] }} on-error={{}}',
        f'/ip route add dst-address={server_ip}/32 gateway=wg-mgmt comment="infora-radius-via-tunnel"',
        ':log info "Infora management WireGuard tunnel configured"',
    ]


def build_radius_script(device, snmp_community='infora'):
    """Full RouterOS provisioning script: WG tunnel + RADIUS + management user.

    When management_wg_enabled is set, the script includes the WireGuard tunnel
    commands so the billing server can reach back to the router for service
    configuration (Step 3 of the wizard).
    """
    isp = ISP.query.get(device.isp_id) if device.isp_id else None
    if not isp or not isp.radius_secret:
        raise ValueError('ISP has no RADIUS secret configured')

    radius_host = resolve_radius_host_for_device(device)
    radius_secret = isp.radius_secret
    timezone = current_app.config.get('ROUTER_TIMEZONE', 'Africa/Nairobi')

    lines = [
        f'# Infora billing — provisioning for {device.device_name}',
        f'# ISP: {isp.name if isp else "n/a"}  Generated for RouterOS v6/v7',
        '',
        '# --- 0. Connectivity pre-check (abort if no internet) ---',
        ':if ([:len [/ping 8.8.8.8 count=3]] = 0) do={',
        '    :log error "Infora: no internet connectivity, aborting"',
        '    :error "Infora provisioning aborted: no connectivity"',
        '}',
    ]

    # WireGuard management tunnel (must come before RADIUS so the route exists)
    lines += _build_wireguard_tunnel_lines(device)

    lines += [
        '',
        '# --- 1. RADIUS client (idempotent) ---',
        ':if ([:len [/radius find comment="infora-billing"]] > 0) do={ /radius remove [find comment="infora-billing"] }',
        f'/radius add address="{radius_host}" secret="{radius_secret}" service=ppp,hotspot,dhcp timeout=3s comment="infora-billing"',
        '/radius incoming set accept=yes',
        '',
        '# --- 2. PPPoE AAA via RADIUS ---',
        '/ppp aaa set use-radius=yes accounting=yes interim-update=5m',
        '',
        '# --- 3. Remove FastTrack (CRITICAL: it bypasses queues + RADIUS accounting) ---',
        ':do { /ip firewall filter remove [find action=fasttrack-connection] } on-error={}',
        '',
        '# --- 4. NAT / masquerade (idempotent) ---',
        '/ip firewall nat remove [find comment="infora-masquerade"]',
        '/ip firewall nat add chain=srcnat action=masquerade comment="infora-masquerade"',
        '',
        '# --- 5. SNMP monitoring ---',
        f':do {{ /snmp community remove [find name="{snmp_community}"] }} on-error={{}}',
        f'/snmp community add name="{snmp_community}"',
        '/snmp set enabled=yes contact="Infora Billing"',
        '',
        '# --- 6. Timezone (accurate accounting) ---',
        f':do {{ /system clock set time-zone-name={timezone} }} on-error={{}}',
    ]

    # --- 7. Billing management user + remote access ---
    mgmt_user = (device.username or '').strip()
    mgmt_pass = decrypt_value(device.password) if device.password else None
    if mgmt_user and mgmt_pass:
        lines += [
            '',
            '# --- 7. Billing management user + API/SSH access ---',
            f':do {{ /user remove [find name="{mgmt_user}"] }} on-error={{}}',
            f'/user add name="{mgmt_user}" password="{mgmt_pass}" group=full comment="infora-billing"',
            '/ip service set api disabled=no',
            '/ip service set ssh disabled=no',
        ]

    lines += [
        '',
        ':log info "Infora provisioning applied"',
        ':put "Infora provisioning completed successfully."',
    ]

    return '\n'.join(lines) + '\n'


def build_one_liner(device, base_url=None):
    """The single command an admin pastes into the router terminal."""
    base = (base_url or resolve_provision_base_url()).rstrip('/')
    token = device.provision_token or '<TOKEN>'
    url = f'{base}/api/provision/{token}/script'
    return (
        f'/tool fetch url="{url}" dst-path=flash/provision.rsc;'
        ' :delay 3s;'
        ' /import flash/provision.rsc;'
        ' :delay 2s;'
        ' :do { /file remove [find name~"provision.rsc"] } on-error={}'
    )
