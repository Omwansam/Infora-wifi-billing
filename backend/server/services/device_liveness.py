"""Multi-source proof-of-life for MikroTik devices.

``probe_tunnel`` (server -> router TCP over the management tunnel) used to be the
*only* evidence the sync path considered, and it is the one signal that can fail
while the router is perfectly alive:

WireGuard peers behind NAT are configured server-side with no ``Endpoint =`` line
(see ``wireguard_management._write_server_wg_conf``) because the router's public
address is unknown and roams. The server therefore cannot *initiate* anything —
it can only reply to an address it learned from an inbound handshake. After a
long outage (router powered off for days, or the wireguard container restarted)
that learned endpoint is gone, so every server-originated packet is dropped until
the router's own ``persistent-keepalive`` re-handshakes. A TCP probe in that
window times out against a router that is up and passing customer traffic.

Meanwhile the database already holds independent, router-originated evidence:

  * RADIUS accounting — the router is a NAS. If it forwarded an Access-Request or
    an Interim-Update recently, it is running and has a working path to us.
  * Provisioning fetch — the router pulled its ``.rsc`` over HTTPS recently.

Both are *inbound*, so they are immune to the stale-endpoint problem. This module
gathers every source and returns a single verdict, so a router that is provably
alive by any of them is never reported OFFLINE.
"""
from datetime import datetime, timedelta

from flask import current_app

from extensions import db
from models import RadAcct

# How recent an inbound signal must be to count as "the router is up now".
# RADIUS interim updates default to 5 min (see device_config_ops.radius_interim_interval)
# so 15 min tolerates a couple of missed updates without going stale.
_DEFAULT_RADIUS_EVIDENCE_SECONDS = 900
# The provisioning fetch is a one-shot at adoption time, not a heartbeat, so it
# only proves life for a short window after it happens.
_DEFAULT_PROVISION_EVIDENCE_SECONDS = 600


def _seconds(key, fallback):
    try:
        return int(current_app.config.get(key, fallback))
    except Exception:
        return fallback


def _nas_addresses(device):
    """Every address this router can legitimately appear as in radacct.

    A NAS on the management tunnel sources RADIUS from its tunnel IP; a
    publicly-routed one uses its WAN address. Accept either.
    """
    addresses = set()
    if device.management_wg_ip:
        addresses.add(device.management_wg_ip.split('/')[0])
    if device.device_ip:
        addresses.add(device.device_ip.split('/')[0])
    return {a for a in addresses if a}


def radius_last_seen(device):
    """Newest RADIUS accounting timestamp attributable to this router.

    Matches on ``mikrotik_device_id`` when FreeRADIUS populated it, and falls
    back to ``nasipaddress`` (which it always sets) so this still works for rows
    written before the device was linked.

    The IP fallback deliberately only considers *unattributed* rows. Several
    routers can legitimately share a source address — most obviously when they
    sit behind one NAT public IP — so counting a row that is already tagged to a
    different device would let one live router vouch for a dead one.
    """
    addresses = _nas_addresses(device)
    conditions = []
    if device.id:
        conditions.append(RadAcct.mikrotik_device_id == device.id)
    if addresses:
        conditions.append(db.and_(
            RadAcct.mikrotik_device_id.is_(None),
            RadAcct.nasipaddress.in_(addresses),
        ))
    if not conditions:
        return None

    # An open session's freshness is acctupdatetime; a closed one's is
    # acctstoptime. Take whichever is newest across both columns.
    newest = None
    for column in (RadAcct.acctupdatetime, RadAcct.acctstoptime, RadAcct.acctstarttime):
        value = (
            db.session.query(db.func.max(column))
            .filter(db.or_(*conditions))
            .scalar()
        )
        if value and (newest is None or value > newest):
            newest = value
    return newest


def gather_evidence(device, probe=True, probe_timeout=2, probe_attempts=3):
    """Collect every liveness signal for ``device``.

    ``probe=False`` skips the (slow) network probe and reports only what the
    database already knows — used by callers that have just probed and do not
    want to pay for it twice.

    Returns a dict with ``alive`` (bool), ``source`` (which signal proved it, or
    None) and a ``signals`` list describing each source for the UI/diagnostic.
    """
    now = datetime.utcnow()
    signals = []
    alive_source = None

    # --- 1. Direct network probe (server -> router) --------------------------
    use_tunnel = bool(device.management_wg_enabled and device.management_wg_ip)
    if probe and use_tunnel:
        from services.device_config_ops import probe_tunnel

        result = probe_tunnel(device, timeout=probe_timeout, attempts=probe_attempts)
        signals.append({
            'source': 'tunnel_probe',
            'label': 'TCP probe over management tunnel',
            'ok': bool(result['up']),
            'detail': result['detail'],
        })
        if result['up']:
            alive_source = alive_source or 'tunnel_probe'
    elif use_tunnel:
        signals.append({
            'source': 'tunnel_probe',
            'label': 'TCP probe over management tunnel',
            'ok': False,
            'detail': 'Skipped (already probed by caller)',
        })

    # --- 2. RADIUS accounting (router -> server) -----------------------------
    # Inbound, so it works even when the server has no WireGuard endpoint for
    # the peer. A router forwarding subscriber sessions is by definition up.
    window = _seconds('DEVICE_RADIUS_EVIDENCE_SECONDS', _DEFAULT_RADIUS_EVIDENCE_SECONDS)
    try:
        last_radius = radius_last_seen(device)
    except Exception as exc:
        last_radius = None
        current_app.logger.warning('RADIUS liveness lookup failed for device %s: %s', device.id, exc)
    radius_fresh = bool(last_radius and (now - last_radius) < timedelta(seconds=window))
    signals.append({
        'source': 'radius_accounting',
        'label': 'RADIUS accounting from this NAS',
        'ok': radius_fresh,
        'detail': (
            f'Last accounting {int((now - last_radius).total_seconds())}s ago'
            if last_radius else 'No accounting records for this NAS'
        ),
        'at': last_radius.isoformat() if last_radius else None,
    })
    if radius_fresh:
        alive_source = alive_source or 'radius_accounting'

    # --- 3. Provisioning script fetch (router -> server) ---------------------
    window = _seconds('DEVICE_PROVISION_EVIDENCE_SECONDS', _DEFAULT_PROVISION_EVIDENCE_SECONDS)
    fetched_at = device.provision_last_fetched_at
    provision_fresh = bool(fetched_at and (now - fetched_at) < timedelta(seconds=window))
    signals.append({
        'source': 'provision_fetch',
        'label': 'Provisioning script fetched',
        'ok': provision_fresh,
        'detail': (
            f'Last fetch {int((now - fetched_at).total_seconds())}s ago'
            if fetched_at else 'Never fetched'
        ),
        'at': fetched_at.isoformat() if fetched_at else None,
    })
    if provision_fresh:
        alive_source = alive_source or 'provision_fetch'

    return {
        'alive': alive_source is not None,
        'source': alive_source,
        'signals': signals,
    }
