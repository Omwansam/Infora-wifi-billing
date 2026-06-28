"""Collect WireGuard peer usage stats from `wg show` output."""
import subprocess
from datetime import datetime, timezone

from extensions import db
from models import WireGuardPeer
from services.wireguard_provisioning import get_server_private_key


def _parse_wg_dump(output):
    """
    Parse `wg show all dump` tab-separated output.

    Returns dict: public_key -> {latest_handshake, rx_bytes, tx_bytes}
    """
    stats = {}
    for line in output.strip().splitlines():
        parts = line.split('\t')
        if len(parts) < 8:
            continue
        # peer lines: interface, public_key, psk, endpoint, allowed_ips, handshake, rx, tx, keepalive
        if parts[0].startswith('wg') and len(parts) >= 9:
            public_key = parts[1]
            try:
                handshake = int(parts[5])
                rx = int(parts[6])
                tx = int(parts[7])
            except ValueError:
                continue
            stats[public_key] = {
                'latest_handshake': handshake,
                'rx_bytes': rx,
                'tx_bytes': tx,
            }
    return stats


def collect_wireguard_stats(interface=None):
    """
    Run wg show and update wireguard_peers rx/tx/last_handshake.

    interface: optional wg interface name (e.g. wg0). None = all interfaces.
    """
    cmd = ['wg', 'show', 'all', 'dump'] if not interface else ['wg', 'show', interface, 'dump']
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=False)
    except FileNotFoundError:
        return {'updated': 0, 'error': 'wg command not found'}

    if result.returncode != 0:
        return {'updated': 0, 'error': (result.stderr or result.stdout or 'wg failed').strip()}

    stats = _parse_wg_dump(result.stdout)
    if not stats:
        return {'updated': 0}

    updated = 0
    for peer in WireGuardPeer.query.filter_by(is_active=True).all():
        row = stats.get(peer.public_key)
        if not row:
            continue
        peer.rx_bytes = row['rx_bytes']
        peer.tx_bytes = row['tx_bytes']
        if row['latest_handshake']:
            peer.last_handshake = datetime.fromtimestamp(row['latest_handshake'], tz=timezone.utc).replace(tzinfo=None)
        updated += 1

    if updated:
        db.session.commit()

    return {'updated': updated}


def server_peer_summary(server_id):
    """Aggregate stats for a WireGuard server."""
    peers = WireGuardPeer.query.filter_by(server_id=server_id, is_active=True).all()
    active_recent = sum(
        1 for p in peers
        if p.last_handshake and (datetime.utcnow() - p.last_handshake).total_seconds() < 180
    )
    return {
        'peer_count': len(peers),
        'active_peers': active_recent,
        'total_rx_bytes': sum(p.rx_bytes or 0 for p in peers),
        'total_tx_bytes': sum(p.tx_bytes or 0 for p in peers),
    }
