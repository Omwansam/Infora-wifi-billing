"""Layer-by-layer connectivity diagnosis for a managed MikroTik device.

When a router shows Offline there are six independent things that could be
broken, and the sync path collapses all of them into one boolean. This walks
each layer in order and reports what it found, so the failing hop is obvious
instead of inferred:

  1. Device record      — active, tunnel enabled, has a tunnel IP
  2. Server WG config   — a [Peer] block for this device exists in wg-mgmt.conf
  3. Server route       — this container has a route to the tunnel subnet
  4. Tunnel reachability— TCP answers on the router's tunnel IP
  5. SSH                — credentials work and RouterOS answers a command
  6. Inbound evidence   — RADIUS accounting / provisioning fetch (router -> us)

Layer 6 is the one that distinguishes "powered off" from "up but unreachable":
it is inbound, so it still works when the server has no learned WireGuard
endpoint for a NAT'd peer.
"""
import ipaddress
import os
import socket
import subprocess
from datetime import datetime

from flask import current_app

from models import DeviceStatus


def _check(check_id, label, ok, detail='', severity='error'):
    return {
        'id': check_id,
        'label': label,
        'ok': bool(ok),
        'detail': detail,
        # 'error'  -> breaks connectivity
        # 'warn'   -> suspicious but not fatal
        'severity': severity,
    }


def _mgmt_subnet():
    return current_app.config.get('WIREGUARD_MGMT_SUBNET', '10.250.0.0/24')


def _server_wg_conf_path():
    # Ask wireguard_management for the directory rather than rebuilding the path
    # here — the config lives in a 'mgmt' subdirectory, and duplicating that
    # detail made this check report a missing file on a perfectly healthy server.
    from services.wireguard_management import _mgmt_config_dir

    return os.path.join(_mgmt_config_dir(), 'wg-mgmt.conf')


def _diagnose_record(device):
    checks = []
    checks.append(_check(
        'device_active', 'Device is active in inventory', device.is_active,
        'Inactive devices are skipped by bulk sync' if not device.is_active else '',
    ))
    tunnel_on = bool(device.management_wg_enabled and device.management_wg_ip)
    checks.append(_check(
        'tunnel_enabled', 'Management tunnel provisioned', tunnel_on,
        f"Tunnel IP {device.management_wg_ip}" if tunnel_on
        else 'No management tunnel — device must be reachable at its public IP',
        severity='warn' if not tunnel_on else 'error',
    ))
    checks.append(_check(
        'has_public_key', 'Device has a WireGuard public key',
        bool(device.management_wg_public_key),
        'Missing key — re-provision the management tunnel' if not device.management_wg_public_key else '',
        severity='error' if tunnel_on else 'warn',
    ))
    return checks


def _diagnose_server_peer(device):
    """Is this device's peer actually in the server's wg-mgmt.conf?"""
    path = _server_wg_conf_path()
    # Every layer always reports a row, pass or fail, so the report has a stable
    # shape — a check that silently disappears reads as "fine" in the UI.
    if not os.path.isfile(path):
        return [
            _check('wg_conf_present', 'Server wg-mgmt.conf exists', False,
                   f'Not found at {path} — the management server was never initialised'),
            _check('wg_peer_listed', 'Device peer present in server config', False,
                   'Cannot check — no server config'),
        ]

    try:
        with open(path, 'r', encoding='utf-8') as fh:
            content = fh.read()
    except OSError as exc:
        return [
            _check('wg_conf_present', 'Server wg-mgmt.conf readable', False, str(exc)),
            _check('wg_peer_listed', 'Device peer present in server config', False,
                   'Cannot check — config unreadable'),
        ]

    checks = [_check('wg_conf_present', 'Server wg-mgmt.conf exists', True, path)]
    key = device.management_wg_public_key
    listed = bool(key and key in content)
    checks.append(_check(
        'wg_peer_listed', 'Device peer present in server config', listed,
        'Peer block found' if listed
        else 'This device has no [Peer] block — the server will drop its handshakes. '
             'Re-provision the tunnel, then restart the wireguard container.',
    ))
    return checks


def _diagnose_route(device):
    """Can this container route to the tunnel subnet at all?"""
    subnet = _mgmt_subnet()
    try:
        output = subprocess.run(
            ['ip', 'route', 'show', subnet],
            capture_output=True, text=True, timeout=5,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError) as exc:
        return [_check('route_present', f'Route to {subnet}', False, f'Could not read routes: {exc}')]

    present = bool(output)
    return [_check(
        'route_present', f'Route to {subnet} installed', present,
        output if present
        else f'No route to {subnet}. The entrypoint installs it via the wireguard '
             'container; check that container is up and NET_ADMIN is granted.',
    )]


def _diagnose_tunnel(device):
    from services.device_config_ops import probe_tunnel

    if not (device.management_wg_enabled and device.management_wg_ip):
        return [], None

    result = probe_tunnel(device, timeout=2, attempts=3)
    checks = [_check(
        'tunnel_reachable', 'Router answers TCP on the tunnel', result['up'],
        result['detail'] if result['up']
        else f"{result['detail']}. Server-originated packets need a WireGuard endpoint "
             'learned from the router; after a long outage that only returns once the '
             "router's own persistent-keepalive re-handshakes.",
    )]
    return checks, result['up']


def _diagnose_ssh(device, tunnel_up):
    from services.device_config_ops import DeviceBusy, mikrotik_ssh

    if tunnel_up is False:
        return [_check(
            'ssh_ok', 'SSH command succeeds', False,
            'Skipped — the tunnel is not answering', severity='warn',
        )]
    try:
        with mikrotik_ssh(device, timeout=10, lock_wait=5, retries=2) as client:
            identity, _err = client.run_cli('/system identity print')
        return [_check('ssh_ok', 'SSH command succeeds', True, (identity or '').strip()[:200])]
    except DeviceBusy:
        return [_check(
            'ssh_ok', 'SSH command succeeds', True,
            'Router busy with another operation — it is reachable', severity='warn',
        )]
    except Exception as exc:
        return [_check(
            'ssh_ok', 'SSH command succeeds', False,
            f'{exc}. Check the stored credentials and that the tunnel firewall rule '
            '(infora-mgmt-access) still allows tcp/22 from the tunnel subnet.',
        )]


def diagnose_device(device):
    """Run every layer and return a structured report."""
    from services.device_liveness import gather_evidence

    checks = []
    checks += _diagnose_record(device)
    checks += _diagnose_server_peer(device)
    checks += _diagnose_route(device)

    tunnel_checks, tunnel_up = _diagnose_tunnel(device)
    checks += tunnel_checks
    checks += _diagnose_ssh(device, tunnel_up)

    # Inbound evidence — skip the probe, we just ran it above.
    evidence = gather_evidence(device, probe=False)
    for signal in evidence['signals']:
        checks.append(_check(
            signal['source'], signal['label'], signal['ok'], signal['detail'],
            severity='warn',
        ))

    failed = [c for c in checks if not c['ok'] and c['severity'] == 'error']
    reachable = bool(tunnel_up)

    if reachable:
        verdict = 'Router is reachable over the management tunnel.'
    elif evidence['alive']:
        verdict = (
            'Router is UP but the server cannot reach it. '
            f"Proven alive by: {evidence['source']}. This is the stale-WireGuard-endpoint "
            'state — the router must re-handshake before server-initiated traffic works.'
        )
    elif failed:
        verdict = f"Blocked at: {failed[0]['label']}."
    else:
        verdict = 'No evidence the router is up — most likely powered off or off-network.'

    return {
        'device_id': device.id,
        'device_name': device.device_name,
        'device_status': device.device_status.value if isinstance(device.device_status, DeviceStatus)
                         else str(device.device_status),
        'last_synced': device.last_synced.isoformat() if device.last_synced else None,
        'checked_at': datetime.utcnow().isoformat(),
        'reachable': reachable,
        'alive': reachable or evidence['alive'],
        'liveness_source': 'tunnel_probe' if reachable else evidence['source'],
        'verdict': verdict,
        'checks': checks,
        'passed': sum(1 for c in checks if c['ok']),
        'total': len(checks),
    }
