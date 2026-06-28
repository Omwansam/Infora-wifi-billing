"""Shared MikroTik provisioning script builders.

Single source of truth used by both the authenticated download route
(/api/devices/<id>/radius-script) and the public token route
(/api/provision/<token>/script).
"""
from flask import current_app

from models import ISP
from services.wireguard_management import resolve_radius_host_for_device


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


def build_radius_script(device, snmp_community='infora'):
    """Hardened, idempotent RouterOS RADIUS/PPPoE provisioning script.

    Adds the lessons learned from commercial systems:
      - connectivity pre-check (abort if no internet)
      - FastTrack removal (otherwise queues + RADIUS accounting are bypassed)
      - idempotent NAT/masquerade and RADIUS client (safe to re-run)
      - SNMP enable + timezone for accurate monitoring/accounting
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
        '',
        '# --- 1. RADIUS client (idempotent) ---',
        ':if ([:len [/radius find comment="infora-billing"]] > 0) do={ /radius remove [find comment="infora-billing"] }',
        f'/radius add address="{radius_host}" secret="{radius_secret}" service=ppp,hotspot,dhcp timeout=3000 comment="infora-billing"',
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
        '',
        ':log info "Infora provisioning applied"',
        ':put "Infora provisioning completed successfully."',
    ]

    if device.management_wg_enabled:
        lines.insert(
            2,
            f'# Import management tunnel first: /api/devices/{device.id}/management-tunnel-script',
        )

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
