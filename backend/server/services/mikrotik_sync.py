"""MikroTik device sync helpers (API + SSH)."""
import threading
from datetime import datetime, timedelta

from flask import current_app

from extensions import db
from models import DeviceStatus, MikrotikDevice
from mikrotik_client import (
    ConnectionType,
    MikroTikAPIError,
    MikroTikClient,
    MikroTikConnectionConfig,
    MikroTikSSHError,
)
from services.encryption import decrypt_value

# Fallback used when there's no Flask app context (e.g. unit tests) to read
# DEVICE_OFFLINE_GRACE_SECONDS from config.
_DEFAULT_OFFLINE_GRACE_SECONDS = 300


def _offline_grace_seconds():
    try:
        return int(current_app.config.get(
            'DEVICE_OFFLINE_GRACE_SECONDS', _DEFAULT_OFFLINE_GRACE_SECONDS))
    except Exception:
        return _DEFAULT_OFFLINE_GRACE_SECONDS


def _mark_online(device):
    """Flip a device ONLINE and stamp the contact time (idempotent)."""
    device.device_status = DeviceStatus.ONLINE
    device.last_synced = datetime.utcnow()


def mark_unreachable(device):
    """Decide a failed device's status with hysteresis instead of a hard OFFLINE.

    A NAT router on the management tunnel proves it's alive continuously —
    WireGuard keepalive every 25s + a netwatch ping to the server every 60s —
    so one failed probe/SSH attempt (the tunnel's first packet after idle, a
    flaky SSH banner, a momentary port block) is NOT evidence it's down. This
    keeps "Online" sticky:

      * Re-probe the tunnel with retries. If the router answers, it's alive at
        the tunnel layer even if the SSH stat pull failed — keep it ONLINE and
        refresh the contact time.
      * Otherwise only flip OFFLINE once there's been no proven contact for the
        grace window (``DEVICE_OFFLINE_GRACE_SECONDS``); within the window keep
        the last-known status so a transient blip can't knock a live router off.

    Must be called with the caller's failed transaction already rolled back.
    Commits the resulting status. Returns the DeviceStatus it settled on.
    """
    use_tunnel = bool(device.management_wg_enabled and device.management_wg_ip)
    if use_tunnel:
        from services.device_config_ops import probe_tunnel
        if probe_tunnel(device, timeout=2, attempts=3)['up']:
            _mark_online(device)
            db.session.commit()
            return DeviceStatus.ONLINE

    grace = timedelta(seconds=_offline_grace_seconds())
    within_grace = bool(device.last_synced and datetime.utcnow() - device.last_synced < grace)
    if within_grace and device.device_status == DeviceStatus.ONLINE:
        # Recently confirmed online and no proof it's gone yet — stay sticky.
        return DeviceStatus.ONLINE

    device.device_status = DeviceStatus.OFFLINE
    db.session.commit()
    return DeviceStatus.OFFLINE


def device_connection_config(device, connection_type=None):
    # NAT routers are only reachable over the management WireGuard tunnel, and
    # only via SSH (the public device_ip is unroutable from the server). Force
    # SSH-over-tunnel for those so sync/stats work once the tunnel is up.
    use_tunnel = bool(device.management_wg_enabled and device.management_wg_ip)
    conn_type = 'ssh' if use_tunnel else (connection_type or device.connection_type or 'api')
    password = decrypt_value(device.password)

    if use_tunnel:
        host = device.management_wg_ip.split('/')[0]
        port = device.ssh_port or 22
    else:
        host = device.device_ip
        port = device.api_port if conn_type == 'api' else (device.ssh_port or 22)

    return MikroTikConnectionConfig(
        host=host,
        port=port,
        username=device.username,
        password=password,
        api_key=device.api_key,
        connection_type=ConnectionType.API if conn_type == 'api' else ConnectionType.SSH,
        timeout=6,
        verify_ssl=device.use_ssl if device.use_ssl is not None else True,
    )


def _apply_device_info(device, info):
    """Persist a fresh DeviceInfo snapshot onto the device row."""
    device.uptime = info.uptime
    device.client_count = info.client_count
    # Live uplink throughput, stored as Kbps (rx+tx bits/sec -> Kbps) so the
    # card can render exact Mbps. Was previously hardcoded 0.
    device.bandwidth_usage = int((info.bandwidth_rx + info.bandwidth_tx) // 1000)
    device.last_synced = datetime.utcnow()
    device.device_status = DeviceStatus.ONLINE
    # Live resource usage for the device detail page (Resource Usage card)
    device.cpu_load = info.cpu_load
    device.mem_total = getattr(info, 'memory_total', 0) or None
    device.mem_free = getattr(info, 'memory_free', 0) or None
    device.hdd_total = getattr(info, 'hdd_total', 0) or None
    device.hdd_free = getattr(info, 'hdd_free', 0) or None
    # Persist version / board so the Firmware + Status pages show real data.
    if info.version:
        device.os_version = info.version
    if info.board_name and (not device.device_model or device.device_model == 'Auto-detect'):
        device.device_model = info.board_name


def sync_device_stats(device, connection_type=None):
    """Sync a single MikroTik device and persist stats.

    Management-tunnel routers go through the resilient, serialized SSH helper
    (retries the flaky MikroTik banner) so a router that just powered back up
    reliably flips to ONLINE instead of sticking OFFLINE on one failed attempt.
    """
    use_tunnel = bool(device.management_wg_enabled and device.management_wg_ip)
    if use_tunnel:
        from services.device_config_ops import DeviceBusy, mikrotik_ssh, probe_tunnel
        # Offline detection: if the router doesn't answer on the tunnel at all
        # (powered off / tunnel down), fail so the caller can apply hysteresis.
        # Retry the sweep — the first packet after idle wakes the WG handshake,
        # so a lone 2s connect can time out on a router that is perfectly alive.
        if not probe_tunnel(device, timeout=2, attempts=3)['up']:
            raise MikroTikSSHError('Router unreachable on management tunnel (powered off or tunnel down)')
        # The tunnel answered => the router is alive. Mark it ONLINE up front so
        # a flaky SSH banner on the stat pull below can't flip a live router
        # OFFLINE; the stats just stay at their last-known values this round.
        _mark_online(device)
        db.session.commit()
        try:
            with mikrotik_ssh(device, timeout=12, lock_wait=20) as client:
                info = client.get_device_info()
                _apply_device_info(device, info)
                db.session.commit()
        except DeviceBusy:
            raise
        except Exception:
            # Tunnel is proven live but the stat pull failed — keep it ONLINE
            # (re-affirm, the rollback undid the earlier commit's session state)
            # and return last-known stats instead of throwing.
            db.session.rollback()
            _mark_online(device)
            db.session.commit()
            return {
                'uptime': device.uptime,
                'client_count': device.client_count,
                'cpu_load': device.cpu_load,
                'memory_usage': None,
                'version': device.os_version,
                'board_name': device.device_model,
                'stats_stale': True,
            }
    else:
        config = device_connection_config(device, connection_type)
        with MikroTikClient(config) as client:
            if not client.connect():
                raise MikroTikAPIError('Failed to connect to device')
            info = client.get_device_info()
            _apply_device_info(device, info)
            db.session.commit()

    return {
        'uptime': info.uptime,
        'client_count': info.client_count,
        'cpu_load': info.cpu_load,
        'memory_usage': info.memory_usage,
        'version': info.version,
        'board_name': info.board_name,
    }


def test_device_connection(device, connection_type=None):
    config = device_connection_config(device, connection_type)
    with MikroTikClient(config) as client:
        return client.test_connection()


def sync_device_async(app, device_id, connection_type=None):
    """Run device sync in a background thread (non-blocking HTTP)."""

    def _run():
        with app.app_context():
            from services.device_config_ops import DeviceBusy
            device = MikrotikDevice.query.get(device_id)
            if not device:
                return
            try:
                sync_device_stats(device, connection_type)
            except DeviceBusy:
                # Another operation holds the router — it IS reachable, so don't
                # flip it offline; the next sync will refresh its stats.
                db.session.rollback()
            except Exception:
                # A failed attempt is not proof the router is down (flaky tunnel
                # SSH, transient probe miss). Apply hysteresis: keep a live/
                # recently-seen router ONLINE, only flip OFFLINE when it's truly
                # unreachable past the grace window.
                db.session.rollback()
                device = MikrotikDevice.query.get(device_id)
                if device:
                    mark_unreachable(device)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return thread


def bulk_sync_devices(isp_id=None):
    query = MikrotikDevice.query.filter_by(is_active=True)
    if isp_id:
        query = query.filter_by(isp_id=isp_id)
    devices = query.all()

    synced = 0
    failed = 0
    for device in devices:
        try:
            sync_device_stats(device)
            synced += 1
        except Exception:
            # Hysteresis, not a hard OFFLINE: a live router that just missed one
            # probe/SSH stays ONLINE; only genuinely-gone routers flip.
            db.session.rollback()
            mark_unreachable(device)
            failed += 1

    return {'synced': synced, 'failed': failed, 'total': len(devices)}
