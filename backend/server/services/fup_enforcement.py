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
from datetime import datetime

from extensions import db
from models import Customer, CustomerStatus, ISP
from services.fup_monitoring import get_fup_monitor_rows
from services.plan_utils import normalize_rate_limit
from services.radius_provisioning import provision_customer_radius

logger = logging.getLogger(__name__)

# Override modes, in the order the dialog offers them. `inherit` is the same as
# having no override at all and exists so the operator can say so explicitly.
OVERRIDE_MODES = ('inherit', 'exempt', 'throttle', 'disconnect')


def active_override_mode(customer):
    """The override in force right now, or 'inherit' when there is none.

    An override past its `until` is not an override — enforcement has already
    resumed — so it reads as inherit rather than lingering silently.
    """
    mode = (customer.fup_override_mode or 'inherit').lower()
    if mode not in OVERRIDE_MODES or mode == 'inherit':
        return 'inherit'
    until = customer.fup_override_until
    if until and until <= datetime.utcnow():
        return 'inherit'
    return mode


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

        # An operator override outranks the package policy for as long as it
        # lasts — the point of a support decision is that it sticks. An expired
        # or absent override falls through and normal policy resumes on its own.
        mode = active_override_mode(customer)

        if mode == 'exempt':
            if customer.fup_throttled:
                _restore(customer, plan, isp)
                restored += 1
            continue

        if mode == 'disconnect':
            # Past the cap this account is dropped rather than slowed. Kicking
            # without re-provisioning is the whole behaviour: the session ends,
            # and the next one is refused by the same check.
            if is_over:
                _kick(customer, isp)
                if not customer.fup_throttled:
                    customer.fup_throttled = True
                    throttled += 1
                    logger.info('FUP disconnected %s (override)', customer.email)
            elif customer.fup_throttled:
                _restore(customer, plan, isp)
                restored += 1
            continue

        if mode == 'throttle':
            # Force the throttle even where the plan itself would not, falling
            # back to the plan's own speed when no throttled speed is set.
            forced_speed = throttle_speed or normalize_rate_limit(row.get('fup_throttled_speed'))
            if is_over or row['status'] == 'exceeded':
                if forced_speed and not customer.fup_throttled:
                    provision_customer_radius(customer, plan, isp, throttle=True)
                    customer.fup_throttled = True
                    _kick(customer, isp)
                    throttled += 1
                    logger.info('FUP throttled %s to %s (override)', customer.email, forced_speed)
            elif customer.fup_throttled:
                _restore(customer, plan, isp)
                restored += 1
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
