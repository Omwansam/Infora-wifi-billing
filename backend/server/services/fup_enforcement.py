"""Fair Usage Policy enforcement — throttle over-limit subscribers, restore on reset.

The FUP monitor (services.fup_monitoring) computes each subscriber's usage vs the
plan threshold. This module acts on that: an over-limit customer on a FUP-enabled
plan with a configured throttled speed is re-provisioned at the throttled
Mikrotik-Rate-Limit and kicked so the live session re-authenticates slow; when the
usage window resets (usage drops back under the threshold) they are restored to
full speed.

State is tracked on ``Customer.fup_throttled`` so we only re-provision/kick on the
transition, not every run.

Run via cron: ``flask enforce-fup``
Or set FUP_ENFORCEMENT_INTERVAL (seconds) for in-process polling.
"""
import logging

from extensions import db
from models import Customer, CustomerStatus, ISP
from services.fup_monitoring import get_fup_monitor_rows
from services.plan_utils import normalize_rate_limit
from services.radius_provisioning import provision_customer_radius

logger = logging.getLogger(__name__)


def _kick(customer, isp):
    """Best-effort kick of live sessions so the new rate-limit takes effect."""
    try:
        from services.hotspot_disconnect import disconnect_customer_on_devices
        disconnect_customer_on_devices(customer, isp)
    except Exception as exc:
        logger.debug('FUP kick skipped for %s: %s', customer.email, exc)


def apply_fup_enforcement(isp_id=None):
    """Throttle over-limit subscribers and restore those back under threshold.

    Returns a summary dict: {'throttled': n, 'restored': m}.
    """
    rows, _summary = get_fup_monitor_rows(isp_id=isp_id, status_filter='all')

    throttled = 0
    restored = 0
    seen_ids = set()

    def _restore(customer, plan, isp):
        provision_customer_radius(customer, plan, isp, throttle=False)
        customer.fup_throttled = False
        _kick(customer, isp)
        logger.info('FUP restored %s to full speed', customer.email)

    for row in rows:
        customer = Customer.query.get(row['customer_id'])
        if not customer:
            continue
        seen_ids.add(customer.id)

        # 'throttled' is only emitted for FUP-enabled plans over threshold.
        is_over = row['status'] == 'throttled'
        throttle_speed = normalize_rate_limit(row.get('fup_throttled_speed'))

        # Non-active subscribers have no RADIUS rows — never (re)provision them;
        # just clear any stale throttle flag so a later activation starts clean.
        if customer.status != CustomerStatus.ACTIVE:
            if customer.fup_throttled:
                customer.fup_throttled = False
            continue

        plan = customer.service_plan
        isp = ISP.query.get(customer.isp_id) if customer.isp_id else None
        if not plan or not isp:
            continue

        if is_over and throttle_speed and not customer.fup_throttled:
            provision_customer_radius(customer, plan, isp, throttle=True)
            customer.fup_throttled = True
            _kick(customer, isp)
            throttled += 1
            logger.info('FUP throttled %s to %s', customer.email, throttle_speed)
        elif customer.fup_throttled and not is_over:
            _restore(customer, plan, isp)
            restored += 1

    # Reconcile throttled subscribers that dropped out of monitoring entirely
    # (plan switched to unlimited, FUP disabled, plan deactivated). They won't
    # appear in `rows`, so restore them here or they'd stay throttled forever.
    stale_q = Customer.query.filter(Customer.fup_throttled.is_(True))
    if isp_id:
        stale_q = stale_q.filter(Customer.isp_id == isp_id)
    for customer in stale_q.all():
        if customer.id in seen_ids:
            continue
        if customer.status != CustomerStatus.ACTIVE:
            customer.fup_throttled = False
            continue
        plan = customer.service_plan
        isp = ISP.query.get(customer.isp_id) if customer.isp_id else None
        if not plan or not isp:
            customer.fup_throttled = False
            continue
        _restore(customer, plan, isp)
        restored += 1

    if throttled or restored:
        db.session.commit()

    return {'throttled': throttled, 'restored': restored}
