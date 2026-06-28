"""Fair Usage Policy monitoring — aggregate RADIUS usage vs plan thresholds."""
from datetime import datetime, timedelta

from sqlalchemy import func

from extensions import db
from models import Customer, RadAcct, ServicePlan
from services.plan_utils import extract_package_policy, get_plan_data_cap_gb

GB = 1024 ** 3


def fup_period_start(reset_cycle, now=None):
    now = now or datetime.now()
    if reset_cycle == 'daily':
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if reset_cycle == 'weekly':
        return (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def customer_is_fup_monitored(plan):
    if not plan:
        return False
    policy = extract_package_policy(plan)
    if policy.get('fup_enabled'):
        return True
    cap_gb = get_plan_data_cap_gb(plan)
    return cap_gb is not None and cap_gb > 0


def get_fup_threshold_bytes(plan):
    policy = extract_package_policy(plan)
    if policy.get('fup_enabled') and policy.get('fup_threshold_gb'):
        return int(float(policy['fup_threshold_gb']) * GB)
    cap_gb = get_plan_data_cap_gb(plan)
    if cap_gb and cap_gb > 0:
        return int(cap_gb * GB)
    return None


def compute_fup_status(bytes_used, threshold_bytes, fup_enabled):
    if not threshold_bytes or threshold_bytes <= 0:
        return 'unlimited', 0.0
    pct = round((bytes_used / threshold_bytes) * 100, 1)
    if pct >= 100:
        return ('throttled' if fup_enabled else 'exceeded'), pct
    if pct >= 80:
        return 'warning', pct
    return 'normal', pct


def _build_usage_maps(period_start, isp_id=None):
    byte_expr = (
        func.coalesce(RadAcct.acctinputoctets, 0) + func.coalesce(RadAcct.acctoutputoctets, 0)
    )
    q = (
        db.session.query(
            RadAcct.customer_id,
            func.lower(RadAcct.username),
            func.sum(byte_expr),
        )
        .filter(RadAcct.acctstarttime >= period_start)
    )
    if isp_id:
        q = q.filter(RadAcct.isp_id == isp_id)
    q = q.group_by(RadAcct.customer_id, func.lower(RadAcct.username))

    by_id = {}
    by_username = {}
    for customer_id, username, total in q.all():
        total = int(total or 0)
        if customer_id:
            by_id[customer_id] = by_id.get(customer_id, 0) + total
        if username:
            by_username[username] = by_username.get(username, 0) + total
    return by_id, by_username


def _lookup_usage(customer, by_id, by_username):
    email = (customer.email or '').strip().lower()
    return by_id.get(customer.id) or by_username.get(email, 0)


def _online_customer_ids(isp_id=None):
    q = RadAcct.query.filter(
        RadAcct.acctstoptime.is_(None),
        RadAcct.customer_id.isnot(None),
    )
    if isp_id:
        q = q.filter(RadAcct.isp_id == isp_id)
    return {row.customer_id for row in q.with_entities(RadAcct.customer_id).all()}


def _build_row(customer, plan, usage_cache, online_ids, now, isp_id=None):
    policy = extract_package_policy(plan)
    reset_cycle = policy.get('fup_reset_cycle') or 'monthly'
    if reset_cycle not in usage_cache:
        period_start = fup_period_start(reset_cycle, now)
        usage_cache[reset_cycle] = _build_usage_maps(period_start, isp_id)

    by_id, by_username = usage_cache[reset_cycle]
    bytes_used = _lookup_usage(customer, by_id, by_username)
    threshold_bytes = get_fup_threshold_bytes(plan)
    fup_enabled = bool(policy.get('fup_enabled'))
    status, usage_pct = compute_fup_status(bytes_used, threshold_bytes, fup_enabled)

    return {
        'customer_id': customer.id,
        'name': customer.full_name,
        'email': customer.email,
        'connection_type': customer.connection_type or 'pppoe',
        'plan_id': plan.id,
        'plan_name': plan.name,
        'fup_enabled': fup_enabled,
        'fup_threshold_gb': policy.get('fup_threshold_gb'),
        'fup_throttled_speed': policy.get('fup_throttled_speed'),
        'fup_reset_cycle': reset_cycle,
        'bytes_used': bytes_used,
        'threshold_bytes': threshold_bytes,
        'usage_pct': usage_pct,
        'status': status,
        'is_online': customer.id in online_ids,
        'period_start': fup_period_start(reset_cycle, now).isoformat(),
    }


def get_fup_monitor_rows(
    *,
    isp_id=None,
    connection_type='all',
    status_filter='all',
    search='',
):
    now = datetime.now()
    usage_cache = {}
    online_ids = _online_customer_ids(isp_id)

    query = (
        Customer.query.join(ServicePlan, Customer.service_plan_id == ServicePlan.id)
        .filter(ServicePlan.is_active.is_(True))
    )
    if isp_id:
        query = query.filter(Customer.isp_id == isp_id)
    if connection_type in ('pppoe', 'hotspot'):
        query = query.filter(Customer.connection_type == connection_type)

    all_rows = []
    for customer in query.all():
        plan = customer.service_plan
        if not customer_is_fup_monitored(plan):
            continue
        all_rows.append(_build_row(customer, plan, usage_cache, online_ids, now, isp_id))

    plans_query = ServicePlan.query.filter_by(is_active=True)
    if isp_id:
        plans_query = plans_query.filter_by(isp_id=isp_id)
    fup_enabled_plans = sum(
        1 for plan in plans_query.all() if extract_package_policy(plan).get('fup_enabled')
    )

    summary = {
        'total_monitored': len(all_rows),
        'approaching': sum(1 for r in all_rows if r['status'] == 'warning'),
        'exceeded': sum(1 for r in all_rows if r['status'] in ('exceeded', 'throttled')),
        'throttled': sum(1 for r in all_rows if r['status'] == 'throttled'),
        'online': sum(1 for r in all_rows if r['is_online']),
        'fup_enabled_plans': fup_enabled_plans,
    }

    rows = list(all_rows)
    if search:
        term = search.strip().lower()
        rows = [
            r for r in rows
            if term in (r['name'] or '').lower()
            or term in (r['email'] or '').lower()
            or term in (r['plan_name'] or '').lower()
        ]

    if status_filter == 'warning':
        rows = [r for r in rows if r['status'] == 'warning']
    elif status_filter == 'exceeded':
        rows = [r for r in rows if r['status'] in ('exceeded', 'throttled')]
    elif status_filter == 'throttled':
        rows = [r for r in rows if r['status'] == 'throttled']
    elif status_filter == 'fup_enabled':
        rows = [r for r in rows if r['fup_enabled']]

    rows.sort(key=lambda r: (-r['usage_pct'], r['name'] or ''))
    return rows, summary
