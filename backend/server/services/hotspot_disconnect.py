"""Disconnect live hotspot sessions when a subscription expires."""
import logging

from models import Customer, MikrotikDevice
from services.device_config_ops import _ssh_config, connection_host
from mikrotik_client import MikroTikClient
from services.radius_provisioning import radius_username

logger = logging.getLogger(__name__)


def disconnect_customer_on_devices(customer, isp):
    """Best-effort kick of active hotspot sessions for this user on ISP routers."""
    if not customer or not isp:
        return 0
    username = radius_username(customer)
    devices = MikrotikDevice.query.filter_by(isp_id=isp.id, is_active=True).all()
    kicked = 0
    for device in devices:
        try:
            with MikroTikClient(_ssh_config(device, timeout=6)) as client:
                if not client.connect():
                    continue
                for cmd in (
                    f'/ip hotspot active remove [find user="{username}"]',
                    f'/ip hotspot host remove [find user="{username}"]',
                ):
                    try:
                        client.run_cli(cmd)
                    except Exception:
                        pass
                kicked += 1
        except Exception as exc:
            logger.debug('Disconnect skip %s: %s', connection_host(device), exc)
    return kicked
