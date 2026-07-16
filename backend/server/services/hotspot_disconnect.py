"""Disconnect live subscriber sessions (hotspot + PPPoE) when a subscription expires."""
import logging

from models import Customer, MikrotikDevice
from services.device_config_ops import _ssh_config, connection_host
from mikrotik_client import MikroTikClient
from services.radius_provisioning import radius_username

logger = logging.getLogger(__name__)


def disconnect_username_on_device(username, device):
    """Kick a single user's live sessions (PPPoE + hotspot) on one router.

    Returns True when the router was reached and the kick commands ran.
    Used by the RADIUS session terminate endpoint for a targeted disconnect.
    """
    if not username or not device:
        return False
    try:
        with MikroTikClient(_ssh_config(device, timeout=6)) as client:
            if not client.connect():
                return False
            for cmd in (
                f'/ppp active remove [find name="{username}"]',
                f'/ip hotspot active remove [find user="{username}"]',
                f'/ip hotspot host remove [find user="{username}"]',
                f'/ip hotspot cookie remove [find user="{username}"]',
            ):
                try:
                    client.run_cli(cmd)
                except Exception:
                    pass
            return True
    except Exception as exc:
        logger.debug('Targeted disconnect skip %s: %s', connection_host(device), exc)
        return False


def disconnect_customer_on_devices(customer, isp):
    """Best-effort kick of active sessions for this user on all ISP routers.

    Removing the active entry makes RouterOS send the RADIUS Accounting-Stop
    and forces re-authentication — which fails once radcheck rows are gone.
    Covers both connection types (a customer may have switched plans).
    """
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
                    # Hotspot: session, host binding, and login cookie
                    f'/ip hotspot active remove [find user="{username}"]',
                    f'/ip hotspot host remove [find user="{username}"]',
                    f'/ip hotspot cookie remove [find user="{username}"]',
                    # PPPoE: drop the live tunnel session
                    f'/ppp active remove [find name="{username}"]',
                ):
                    try:
                        client.run_cli(cmd)
                    except Exception:
                        pass
                kicked += 1
        except Exception as exc:
            logger.debug('Disconnect skip %s: %s', connection_host(device), exc)
    return kicked
