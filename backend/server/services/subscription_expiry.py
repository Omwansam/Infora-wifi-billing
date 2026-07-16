"""
Enforce subscription expiry by suspending customers and removing RADIUS access.

Run via cron: flask enforce-expiry
Or set SUBSCRIPTION_ENFORCEMENT_INTERVAL (seconds) in env for in-process polling.
"""
from datetime import datetime

from extensions import db
from models import Customer, CustomerStatus, ISP
from services.radius_provisioning import deprovision_customer_radius, suspend_customer_access


def enforce_expired_subscriptions(grace_hours=0):
    """
    Suspend customers whose subscription_end is in the past.

    grace_hours: optional grace period after subscription_end before cut-off.
    """
    from datetime import timedelta

    cutoff = datetime.utcnow() - timedelta(hours=grace_hours)
    expired = Customer.query.filter(
        Customer.status == CustomerStatus.ACTIVE,
        Customer.subscription_end.isnot(None),
        Customer.subscription_end < cutoff,
    ).all()

    count = 0
    for customer in expired:
        isp = ISP.query.get(customer.isp_id) if customer.isp_id else None
        if isp:
            # Kick live sessions (hotspot AND PPPoE) — otherwise an expired
            # PPPoE subscriber stays online until they re-dial.
            from services.hotspot_disconnect import disconnect_customer_on_devices
            disconnect_customer_on_devices(customer, isp)
        if customer.connection_type == 'hotspot' and isp:
            from services.notification_dispatch import dispatch_hotspot_expired
            try:
                dispatch_hotspot_expired(customer, isp)
            except Exception:
                pass
        suspend_customer_access(customer, isp)
        count += 1

    if count:
        db.session.commit()

    return count


def refresh_expiration_attributes():
    """
    Update Expiration rows in radcheck for active customers (no status change).
    Useful after extending subscription without full reprovision.
    """
    from services.radius_provisioning import (
        format_radius_expiration,
        provision_customer_radius,
        radius_username,
    )
    from models import RadCheck, ServicePlan

    active = Customer.query.filter_by(status=CustomerStatus.ACTIVE).filter(
        Customer.subscription_end.isnot(None),
        Customer.service_plan_id.isnot(None),
    ).all()

    updated = 0
    for customer in active:
        isp = ISP.query.get(customer.isp_id)
        plan = ServicePlan.query.get(customer.service_plan_id)
        if not isp or not plan:
            continue

        username = radius_username(customer)
        expiration = format_radius_expiration(customer.subscription_end)
        if not expiration:
            continue

        RadCheck.query.filter_by(
            username=username,
            isp_id=isp.id,
            attribute='Expiration',
        ).delete(synchronize_session=False)

        db.session.add(RadCheck(
            username=username,
            attribute='Expiration',
            op=':=',
            value=expiration,
            isp_id=isp.id,
            customer_id=customer.id,
            is_active=True,
        ))
        updated += 1

    if updated:
        db.session.commit()

    return updated
