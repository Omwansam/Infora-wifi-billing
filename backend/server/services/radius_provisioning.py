"""
FreeRADIUS SQL provisioning (primary auth path).

Flask writes radcheck / radreply / radusergroup; MikroTik NAS authenticates via FreeRADIUS.
"""
import secrets
from datetime import datetime

from extensions import db
from models import (
    Customer,
    CustomerStatus,
    RadCheck,
    RadReply,
    RadUserGroup,
    RadGroupCheck,
    RadGroupReply,
    ServicePlan,
    ISP,
)
from services.encryption import decrypt_value, encrypt_value
from services.plan_utils import generate_radius_attributes


def radius_username(customer):
    """RADIUS username = lowercased email (PPPoE login)."""
    return customer.email.strip().lower()


def format_radius_expiration(dt):
    """FreeRADIUS Expiration attribute format: 'DD Mon YYYY HH:MM:SS'."""
    if not dt:
        return None
    return dt.strftime('%d %b %Y %H:%M:%S')


def set_customer_radius_password(customer, password=None):
    """Generate/store WiFi password and return cleartext for one-time display."""
    password = password or secrets.token_urlsafe(8)
    customer.radius_password_encrypted = encrypt_value(password)
    return password


def get_customer_radius_password(customer):
    return decrypt_value(customer.radius_password_encrypted)


def verify_radius_password(customer, password):
    stored = get_customer_radius_password(customer)
    if not stored:
        return False
    return stored == password


def _delete_user_radius_rows(username, isp_id):
    """Hard-delete all RADIUS rows for a user (FreeRADIUS SQL has no is_active filter)."""
    RadCheck.query.filter_by(username=username, isp_id=isp_id).delete(
        synchronize_session=False
    )
    RadReply.query.filter_by(username=username, isp_id=isp_id).delete(
        synchronize_session=False
    )
    RadUserGroup.query.filter_by(username=username, isp_id=isp_id).delete(
        synchronize_session=False
    )


def ensure_plan_group(plan, isp):
    """Ensure RADIUS group + group reply attributes exist for a plan."""
    groupname = f'plan_{plan.id}'

    existing = RadGroupCheck.query.filter_by(
        groupname=groupname,
        isp_id=isp.id,
        attribute='Auth-Type',
    ).first()
    if not existing:
        db.session.add(RadGroupCheck(
            groupname=groupname,
            attribute='Auth-Type',
            op=':=',
            value='Accept',
            isp_id=isp.id,
            is_active=True,
        ))

    for attr in generate_radius_attributes(plan):
        row = RadGroupReply.query.filter_by(
            groupname=groupname,
            attribute=attr['attribute'],
            isp_id=isp.id,
        ).first()
        if row:
            row.op = attr['op']
            row.value = attr['value']
            row.is_active = True
        else:
            db.session.add(RadGroupReply(
                groupname=groupname,
                attribute=attr['attribute'],
                op=attr['op'],
                value=attr['value'],
                isp_id=isp.id,
                is_active=True,
            ))


def provision_customer_radius(customer, plan, isp, password=None):
    """Create/update FreeRADIUS entries for an active customer."""
    username = radius_username(customer)
    cleartext_password = password or get_customer_radius_password(customer)
    if not cleartext_password:
        cleartext_password = set_customer_radius_password(customer)

    ensure_plan_group(plan, isp)

    _delete_user_radius_rows(username, isp.id)

    db.session.add(RadCheck(
        username=username,
        attribute='Cleartext-Password',
        op=':=',
        value=cleartext_password,
        isp_id=isp.id,
        customer_id=customer.id,
        is_active=True,
    ))

    expiration = format_radius_expiration(customer.subscription_end)
    if expiration:
        db.session.add(RadCheck(
            username=username,
            attribute='Expiration',
            op=':=',
            value=expiration,
            isp_id=isp.id,
            customer_id=customer.id,
            is_active=True,
        ))

    for attr in generate_radius_attributes(plan):
        db.session.add(RadReply(
            username=username,
            attribute=attr['attribute'],
            op=attr['op'],
            value=attr['value'],
            isp_id=isp.id,
            customer_id=customer.id,
            is_active=True,
        ))

    db.session.add(RadUserGroup(
        username=username,
        groupname=f'plan_{plan.id}',
        priority=1,
        isp_id=isp.id,
        customer_id=customer.id,
        is_active=True,
    ))

    db.session.flush()
    return cleartext_password


def deprovision_customer_radius(customer, isp):
    """Remove RADIUS access for a customer (hard delete)."""
    username = radius_username(customer)
    _delete_user_radius_rows(username, isp.id)
    db.session.flush()


def activate_customer_after_payment(customer, isp, plan=None):
    """Mark customer active and provision RADIUS after successful payment."""
    plan = plan or customer.service_plan
    customer.status = CustomerStatus.ACTIVE
    customer.last_payment_date = datetime.utcnow()
    customer.subscription_start = datetime.utcnow()
    customer.balance = 0

    if plan:
        from services.portal_service import plan_subscription_end
        customer.subscription_end = plan_subscription_end(plan)
        customer.service_plan_id = plan.id
        customer.package = plan.name
        if plan.plan_type == 'hotspot':
            customer.connection_type = 'hotspot'
        elif plan.plan_type == 'pppoe':
            customer.connection_type = 'pppoe'
        elif plan.plan_type == 'wireguard':
            customer.connection_type = 'wireguard'

    if plan and isp:
        if plan.plan_type == 'wireguard':
            from services.wireguard_provisioning import provision_customer_wireguard
            provision_customer_wireguard(customer, plan, isp)
        else:
            provision_customer_radius(customer, plan, isp)

    db.session.flush()


def suspend_customer_access(customer, isp):
    """Suspend billing customer and remove RADIUS / WireGuard access."""
    from services.wireguard_provisioning import deprovision_customer_wireguard

    customer.status = CustomerStatus.SUSPENDED
    if isp:
        deprovision_customer_radius(customer, isp)
    deprovision_customer_wireguard(customer)
    db.session.flush()


def reprovision_plan_customers(plan):
    """Re-provision all active customers on a plan after limit changes."""
    isp = ISP.query.get(plan.isp_id)
    if not isp:
        return 0

    ensure_plan_group(plan, isp)

    customers = Customer.query.filter_by(
        service_plan_id=plan.id,
        isp_id=isp.id,
        status=CustomerStatus.ACTIVE,
    ).all()

    count = 0
    for customer in customers:
        provision_customer_radius(customer, plan, isp)
        count += 1

    db.session.flush()
    return count


def sync_customer_radius_status(customer, old_status=None):
    """
    Apply RADIUS changes when customer status changes via legacy /api/customers.
    Returns generated password when provisioning a new active customer without one.
    """
    isp = ISP.query.get(customer.isp_id) if customer.isp_id else None
    if not isp:
        return None

    plan = customer.service_plan
    if not plan and customer.service_plan_id:
        plan = ServicePlan.query.get(customer.service_plan_id)

    if customer.status == CustomerStatus.SUSPENDED:
        deprovision_customer_radius(customer, isp)
        from services.wireguard_provisioning import deprovision_customer_wireguard
        deprovision_customer_wireguard(customer)
        return None

    if customer.status == CustomerStatus.ACTIVE and plan:
        if plan.plan_type == 'wireguard':
            from services.wireguard_provisioning import provision_customer_wireguard
            provision_customer_wireguard(customer, plan, isp)
            return None
        return provision_customer_radius(customer, plan, isp)

    if customer.status == CustomerStatus.PENDING:
        deprovision_customer_radius(customer, isp)
        from services.wireguard_provisioning import deprovision_customer_wireguard
        deprovision_customer_wireguard(customer)

    return None
