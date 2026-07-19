"""MikroTik device sync helpers (API + SSH)."""
import threading
from datetime import datetime

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


def sync_device_stats(device, connection_type=None):
    """Sync a single MikroTik device and persist stats."""
    config = device_connection_config(device, connection_type)
    with MikroTikClient(config) as client:
        if not client.connect():
            raise MikroTikAPIError('Failed to connect to device')

        info = client.get_device_info()
        device.uptime = info.uptime
        device.client_count = info.client_count
        device.bandwidth_usage = info.bandwidth_rx + info.bandwidth_tx
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
            device = MikrotikDevice.query.get(device_id)
            if not device:
                return
            try:
                sync_device_stats(device, connection_type)
            except (MikroTikAPIError, MikroTikSSHError):
                device.device_status = DeviceStatus.OFFLINE
                db.session.commit()

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
            device.device_status = DeviceStatus.OFFLINE
            db.session.commit()
            failed += 1

    return {'synced': synced, 'failed': failed, 'total': len(devices)}
