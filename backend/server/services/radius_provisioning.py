"""
FreeRADIUS SQL provisioning (primary auth path).

Flask writes radcheck / radreply / radusergroup; MikroTik NAS authenticates via FreeRADIUS.
"""
import secrets

from extensions import db
from models import (
    Customer,
    CustomerStatus,
    RadCheck,
    RadReply,
    RadUserGroup,
    RadGroupCheck,
    RadGroupReply,
)
from services.encryption import decrypt_value, encrypt_value
from services.plan_utils import generate_radius_attributes


def radius_username(customer):
    return customer.email.strip().lower()


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
        exists = RadGroupReply.query.filter_by(
            groupname=groupname,
            attribute=attr['attribute'],
            isp_id=isp.id,
        ).first()
        if not exists:
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

    # Deactivate stale rows first, then upsert active rows
    RadCheck.query.filter_by(username=username, isp_id=isp.id).update({'is_active': False})
    RadReply.query.filter_by(username=username, isp_id=isp.id).update({'is_active': False})
    RadUserGroup.query.filter_by(username=username, isp_id=isp.id).update({'is_active': False})

    db.session.add(RadCheck(
        username=username,
        attribute='Cleartext-Password',
        op=':=',
        value=cleartext_password,
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
    """Disable RADIUS access for a customer."""
    username = radius_username(customer)
    RadCheck.query.filter_by(username=username, isp_id=isp.id).update({'is_active': False})
    RadReply.query.filter_by(username=username, isp_id=isp.id).update({'is_active': False})
    RadUserGroup.query.filter_by(username=username, isp_id=isp.id).update({'is_active': False})
    db.session.flush()


def activate_customer_after_payment(customer, isp, plan=None):
    """Mark customer active and provision RADIUS after successful payment."""
    from datetime import datetime

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

    if plan and isp:
        provision_customer_radius(customer, plan, isp)

    db.session.flush()


def suspend_customer_access(customer, isp):
    """Suspend billing customer and remove RADIUS access."""
    customer.status = CustomerStatus.SUSPENDED
    if isp:
        deprovision_customer_radius(customer, isp)
    db.session.flush()
