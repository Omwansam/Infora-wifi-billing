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


def resolve_isp_radius_secret(isp, default=None):
    """Effective RADIUS shared secret for an ISP.

    Precedence: Settings > RADIUS override (``radius_config.shared_secret``,
    encrypted) → legacy ``isp.radius_secret`` → the supplied ``default``.
    Both the router provisioning script and the FreeRADIUS clients.conf resolve
    through here so the two sides always agree.
    """
    if isp is not None:
        rc = getattr(isp, 'radius_config', None)
        if rc is not None and rc.shared_secret:
            decrypted = decrypt_value(rc.shared_secret)
            if decrypted:
                return decrypted
        if getattr(isp, 'radius_secret', None):
            return isp.radius_secret
    return default


def resolve_isp_radius_host(isp, default=''):
    """Effective RADIUS server address an ISP's routers should talk to.

    Prefers the host the ISP typed in Settings > RADIUS; otherwise falls back
    to the supplied ``default`` (typically the management-tunnel host).
    """
    if isp is not None:
        rc = getattr(isp, 'radius_config', None)
        if rc is not None and rc.host:
            return rc.host.strip()
    return default


def radius_username(customer):
    """RADIUS/portal username: the operator-set login, else the email.

    Decoupling the login from the email is what lets imported clients keep their
    original PPPoE username so the CPE keeps dialing unchanged (see
    MIGRATION_FROM_OTHER_BILLING.md §4).
    """
    login = customer.radius_login or customer.email or ''
    return login.strip().lower()


def find_customer_by_login(username, isp_id=None):
    """Resolve a login string back to a Customer — the inverse of radius_username.

    Matches an explicit ``radius_login`` first; falls back to ``email`` only for
    customers that have no ``radius_login`` (so an email can't shadow someone
    else's login). Scoped to an ISP when given.
    """
    from sqlalchemy import and_, func, or_
    if not username:
        return None
    username = username.strip().lower()
    query = Customer.query.filter(
        or_(
            func.lower(Customer.radius_login) == username,
            and_(Customer.radius_login.is_(None), func.lower(Customer.email) == username),
        )
    )
    if isp_id is not None:
        query = query.filter(Customer.isp_id == isp_id)
    return query.first()


def _derive_account_prefix(isp):
    """Fallback account-number prefix from the ISP name (e.g. 'Infora' -> 'INF')."""
    import re
    source = (getattr(isp, 'name', None) or getattr(isp, 'company_name', None) or 'ACC')
    letters = re.sub(r'[^A-Za-z]', '', source).upper()
    return (letters[:3] or 'ACC')


def generate_account_number(isp):
    """Issue the next unique account number for an ISP (e.g. 'INF-100001').

    Atomically bumps the per-ISP counter under a row lock so concurrent creates
    (and bulk imports) never collide.
    """
    prefix = (isp.account_number_prefix or _derive_account_prefix(isp)).strip().upper()
    locked = ISP.query.filter_by(id=isp.id).with_for_update().first() or isp
    current = locked.account_number_seq or 100000
    locked.account_number_seq = current + 1
    db.session.flush()
    return f'{prefix}-{locked.account_number_seq}'


def ensure_account_number(customer, isp, preferred=None):
    """Assign an account number to a customer if it doesn't have one.

    ``preferred`` (e.g. carried over from an import) is used verbatim when it's
    free; otherwise a fresh number is generated. Returns the number.
    """
    if customer.account_number:
        return customer.account_number
    preferred = (preferred or '').strip()
    if preferred:
        clash = Customer.query.filter_by(
            account_number=preferred, isp_id=isp.id
        ).first()
        if not clash:
            customer.account_number = preferred
            return preferred
    customer.account_number = generate_account_number(isp)
    return customer.account_number


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


def _plan_throttle_rate_limit(plan):
    """MikroTik rate-limit string for a plan's FUP throttled speed, or None."""
    from services.plan_utils import extract_package_policy, normalize_rate_limit
    policy = extract_package_policy(plan)
    return normalize_rate_limit(policy.get('fup_throttled_speed'))


def provision_customer_radius(customer, plan, isp, password=None, throttle=False):
    """Create/update FreeRADIUS entries for an active customer.

    When ``throttle`` is set and the plan defines a FUP throttled speed, the
    per-user reply rows carry the throttled Mikrotik-Rate-Limit (which wins over
    the plan group's full speed). Used by services.fup_enforcement.
    """
    username = radius_username(customer)
    cleartext_password = password or get_customer_radius_password(customer)
    if not cleartext_password:
        cleartext_password = set_customer_radius_password(customer)

    rate_limit_override = _plan_throttle_rate_limit(plan) if throttle else None

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

    for attr in generate_radius_attributes(plan, rate_limit_override=rate_limit_override):
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


def delete_radius_rows_for_username(username, isp_id):
    """Hard-delete RADIUS rows for an explicit username (e.g. an old login that
    a customer just renamed away from). Use when the username no longer matches
    ``radius_username(customer)`` so ``deprovision_customer_radius`` can't reach it."""
    if not username:
        return
    _delete_user_radius_rows(username.strip().lower(), isp_id)
    db.session.flush()


def activate_customer_after_payment(customer, isp, plan=None, stack_time=True):
    """Mark customer active and provision RADIUS after successful payment."""
    plan = plan or customer.service_plan
    now = datetime.utcnow()
    customer.status = CustomerStatus.ACTIVE
    customer.last_payment_date = now
    customer.balance = 0

    if plan:
        from services.plan_utils import plan_subscription_end
        stack_from = customer.subscription_end if stack_time else None
        customer.subscription_end = plan_subscription_end(plan, from_time=now, stack_from=stack_from)
        if not customer.subscription_start or (stack_from and stack_from.replace(tzinfo=None) <= now):
            customer.subscription_start = now
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
    """Suspend billing customer and remove RADIUS / WireGuard access.

    Also kicks any live sessions on the ISP's routers so the subscriber is
    dropped immediately — deleting the radcheck rows alone only blocks the
    *next* auth, leaving an existing PPPoE tunnel up until it re-dials.
    """
    from services.wireguard_provisioning import deprovision_customer_wireguard

    customer.status = CustomerStatus.SUSPENDED
    if isp:
        deprovision_customer_radius(customer, isp)
        from services.hotspot_disconnect import disconnect_customer_on_devices
        try:
            disconnect_customer_on_devices(customer, isp)
        except Exception:
            pass
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
