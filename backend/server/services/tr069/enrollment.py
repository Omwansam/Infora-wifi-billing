"""Time-boxed CPE enrolment windows.

There are two ways a CPE becomes known to the ACS:

  * **Pre-enrolment** (`POST /api/cpe/enrollment`) — the standard path. An installer
    enters the serial at the bench, gets CWMP credentials back, and the device
    arrives already claimed. Requires knowing the serial in advance.
  * **An enrolment window** — this module. For the case pre-enrolment cannot cover:
    someone is standing at a site with a CPE whose serial they did not record, or
    bringing up the first device of a new fleet. While a window is open, an unknown
    CPE that informs registers itself as ``pending`` instead of being rejected.

``pending`` devices receive no tasks, so a window never grants control of anything —
it only lets a device into the approval queue, where a human still decides.

**Why a window and not just TR069_ALLOW_UNKNOWN=true.** That flag is permanent and
global. The warning attached to it ("an ACS is exposed to the whole internet")
assumes the public vhost in DEPLOYMENT.md Appendix A. We do not deploy that: 7547 is
unpublished, nginx routes only ``/api/``, and the ACS is reachable solely through the
wireguard container's DNAT from ``10.250.0.1``. A window is bounded by that topology
*and* by a clock *and* by a named ISP, which the flag is not — so ``open_window``
refuses outright if the ACS URL is not tunnel-local.
"""
import ipaddress
from datetime import datetime, timedelta
from urllib.parse import urlparse

from flask import current_app

from models import ISP, db

# Long enough to walk to a cabinet and power a CPE up; short enough that forgetting
# to close one is not a standing invitation.
DEFAULT_WINDOW_MINUTES = 30
MAX_WINDOW_MINUTES = 120


def acs_is_tunnel_only(acs_url=None):
    """True when the configured ACS URL is on the management tunnel.

    The whole safety argument for self-registration is that only our own routers
    can reach the ACS. A public ``acs.<domain>`` URL breaks it, so this gates
    ``open_window``.
    """
    url = acs_url if acs_url is not None else (current_app.config.get('TR069_ACS_URL') or '')
    host = (urlparse(url).hostname or '').strip()
    if not host:
        return False
    subnet = current_app.config.get('WIREGUARD_MGMT_SUBNET', '10.250.0.0/24')
    try:
        return ipaddress.ip_address(host) in ipaddress.ip_network(subnet, strict=False)
    except ValueError:
        # A hostname rather than a literal — cannot prove it is tunnel-local, and
        # guessing in the permissive direction is the wrong way to be wrong.
        return False


def window_state(isp):
    """Serialisable state of one ISP's window."""
    until = getattr(isp, 'cpe_enrollment_until', None)
    remaining = int((until - datetime.utcnow()).total_seconds()) if until else 0
    return {
        'open': bool(until and remaining > 0),
        'until': until.isoformat() if until else None,
        'seconds_remaining': max(0, remaining),
    }


def open_window(isp, minutes=DEFAULT_WINDOW_MINUTES):
    """Open (or extend) an ISP's window. Returns (state, error_message)."""
    if not acs_is_tunnel_only():
        return None, (
            'Enrolment windows are only available while the ACS is tunnel-only. '
            'TR069_ACS_URL points off the management subnet, so an unknown device '
            'informing could be anyone — pre-enrol by serial instead.'
        )
    # Default only when nothing was supplied. `minutes or DEFAULT` would quietly
    # turn an explicit 0 into a 30-minute window, which is the opposite of what
    # the caller asked for.
    if minutes is None or minutes == '':
        minutes = DEFAULT_WINDOW_MINUTES
    try:
        minutes = int(minutes)
    except (TypeError, ValueError):
        return None, 'minutes must be a number'
    if minutes < 1 or minutes > MAX_WINDOW_MINUTES:
        return None, f'minutes must be between 1 and {MAX_WINDOW_MINUTES}'

    isp.cpe_enrollment_until = datetime.utcnow() + timedelta(minutes=minutes)
    db.session.commit()
    current_app.logger.info(
        'CPE enrolment window opened for ISP %s for %s minutes', isp.id, minutes,
    )
    return window_state(isp), None


def close_window(isp):
    isp.cpe_enrollment_until = None
    db.session.commit()
    current_app.logger.info('CPE enrolment window closed for ISP %s', isp.id)
    return window_state(isp)


def open_window_isp_id():
    """ISP that an unknown CPE may register under right now, or None.

    Returns ``(isp_id, reason)``. ``isp_id`` is None when no window is open, when
    the ACS is not tunnel-only, or when **more than one** ISP has a window open —
    the last case is refused rather than guessed, because filing a subscriber's CPE
    under the wrong tenant is worse than making the installer retry.
    """
    if not acs_is_tunnel_only():
        return None, 'ACS is not tunnel-only'

    now = datetime.utcnow()
    open_isps = ISP.query.filter(ISP.cpe_enrollment_until > now).all()
    if not open_isps:
        return None, 'no enrolment window open'
    if len(open_isps) > 1:
        return None, (
            'enrolment windows open for multiple ISPs '
            f'({", ".join(str(i.id) for i in open_isps)}) — refusing to guess'
        )
    return open_isps[0].id, None
