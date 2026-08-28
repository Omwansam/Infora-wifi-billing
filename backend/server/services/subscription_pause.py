"""Pausing a subscription, and bringing it back.

A pause is not a suspension. The subscriber asked for it (travel, a closed shop,
a month away), so the days they had already paid for are **banked** at the pause
and handed back on resume — charging someone for a suspension they requested is
theft by clock. Blocking is the other thing: access stops and the clock keeps
running.

The banked balance lives on the pause's ``CustomerEvent`` rather than in a
column, because it is a fact about *that* pause. ``customers.pause_until`` is
only the alarm clock for an automatic resume.

Run via cron: ``flask resume-paused``
Or let the expiry scheduler call it (SUBSCRIPTION_ENFORCEMENT_INTERVAL).
"""

import logging
from datetime import datetime, timedelta

from extensions import db
from models import Customer, CustomerEvent, CustomerStatus, ISP
from services import customer_events as events
from services.radius_provisioning import (
    provision_customer_radius, suspend_customer_access,
)

logger = logging.getLogger(__name__)


def banked_days(customer, now=None):
    """Days still owed at this instant, or None when there is nothing to bank."""
    now = now or datetime.utcnow()
    end = customer.subscription_end
    if not end or end <= now:
        return None
    return round((end - now).total_seconds() / 86400, 3)


def open_pause_event(customer):
    """The pause this account is currently under, if it has not been answered.

    A pause already followed by an activation has been spent; handing its days
    back twice would mint free subscription out of the log.
    """
    pause = (
        CustomerEvent.query
        .filter_by(customer_id=customer.id, event_type='suspended', to_value='paused')
        .order_by(CustomerEvent.created_at.desc(), CustomerEvent.id.desc())
        .first()
    )
    if pause is None:
        return None
    resumed = (
        CustomerEvent.query
        .filter_by(customer_id=customer.id, event_type='activated')
        .order_by(CustomerEvent.created_at.desc(), CustomerEvent.id.desc())
        .first()
    )
    if resumed and resumed.created_at >= pause.created_at:
        return None
    return pause


def pause(customer, isp=None, until=None, actor=None, now=None):
    """Bank the remaining days, cut access, and optionally set an auto-resume."""
    now = now or datetime.utcnow()
    isp = isp or (ISP.query.get(customer.isp_id) if customer.isp_id else None)

    remaining = banked_days(customer, now)
    if isp:
        suspend_customer_access(customer, isp)
    customer.status = CustomerStatus.SUSPENDED
    customer.pause_until = until

    detail = f'{remaining:g} days banked' if remaining else 'No remaining days to bank'
    if until:
        detail += f", auto-resumes {until.strftime('%d %b %Y, %H:%M')}"

    events.record(
        customer, 'suspended', 'Subscription paused', detail=detail,
        # `to_value` is how resume tells a pause apart from a block, and
        # `from_value` carries the balance it hands back.
        from_value=remaining, to_value='paused', actor=actor,
    )
    return remaining


def resume(customer, isp=None, actor=None, now=None, automatic=False):
    """Give back the banked days and restore access. Returns days restored."""
    now = now or datetime.utcnow()
    isp = isp or (ISP.query.get(customer.isp_id) if customer.isp_id else None)

    pause_event = open_pause_event(customer)
    restored = None
    if pause_event and pause_event.from_value:
        try:
            restored = float(pause_event.from_value)
        except (TypeError, ValueError):
            restored = None
    if restored and restored > 0:
        customer.subscription_end = now + timedelta(days=restored)

    customer.status = CustomerStatus.ACTIVE
    customer.pause_until = None
    customer.fup_throttled = False

    if isp:
        provision_customer_radius(customer, customer.service_plan, isp)

    events.record(
        customer, 'activated',
        'Subscription resumed automatically' if automatic else 'Subscription resumed',
        detail=(f'{restored:g} banked days restored' if restored else 'Access restored'),
        to_value=customer.subscription_end.isoformat() if customer.subscription_end else None,
        actor=actor,
    )
    return restored


def resume_due_pauses(now=None):
    """Resume every paused account whose auto-resume time has arrived.

    Returns the number resumed. Each account is committed on its own so one
    router refusing a re-provision cannot hold the rest of the batch paused.
    """
    now = now or datetime.utcnow()
    due = Customer.query.filter(
        Customer.status == CustomerStatus.SUSPENDED,
        Customer.pause_until.isnot(None),
        Customer.pause_until <= now,
    ).all()

    resumed = 0
    for customer in due:
        try:
            resume(customer, actor=None, now=now, automatic=True)
            db.session.commit()
            resumed += 1
            logger.info('Auto-resumed paused subscription for %s', customer.email or customer.id)
        except Exception as exc:
            db.session.rollback()
            logger.warning('Auto-resume failed for customer %s: %s', customer.id, exc)
    return resumed
