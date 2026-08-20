import json

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta

from auth_utils import get_current_user
from extensions import db
from models import (
    Customer,
    CustomerDocument,
    CustomerStatus,
    DeviceStatus,
    ISP,
    IntegrationSetting,
    Invoice,
    InvoiceStatus,
    KycStatus,
    MikrotikDevice,
    Notification,
    Payment,
    PaymentSettings,
    PaymentStatus,
    RadAcct,
    ServicePlan,
    Ticket,
    TicketStatus,
    Transaction,
)

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

PACKAGE_COLORS = [
    '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
    '#06b6d4', '#ec4899', '#84cc16',
]


def _pct_change(current, previous):
    if previous in (None, 0):
        return 100.0 if current else 0.0
    return round((float(current) - float(previous)) / float(previous) * 100, 1)


def _month_range(offset_months=0):
    now = datetime.now()
    start = (now.replace(day=1) - timedelta(days=30 * offset_months)).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def _week_start(dt):
    return (dt - timedelta(days=dt.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )


def _payment_total(start, end=None):
    q = db.session.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_status == PaymentStatus.COMPLETED,
        Payment.payment_date >= start,
    )
    if end is not None:
        q = q.filter(Payment.payment_date < end)
    return float(q.scalar() or 0)


def _payment_count(start, end=None, connection_type=None):
    q = Payment.query.filter(
        Payment.payment_status == PaymentStatus.COMPLETED,
        Payment.payment_date >= start,
    )
    if end is not None:
        q = q.filter(Payment.payment_date < end)
    if connection_type:
        q = q.join(Customer).filter(Customer.connection_type == connection_type)
    return q.count()


def _payments_by_connection(start, end, connection_type):
    return float(
        db.session.query(func.coalesce(func.sum(Payment.amount), 0))
        .join(Customer, Payment.customer_id == Customer.id)
        .filter(
            Payment.payment_status == PaymentStatus.COMPLETED,
            Payment.payment_date >= start,
            Payment.payment_date < end,
            Customer.connection_type == connection_type,
        )
        .scalar()
        or 0
    )


def _empty_radius_stats():
    return {
        'upload_bytes': 0,
        'download_bytes': 0,
        'unique_users': 0,
        'sessions': 0,
        'live_sessions': 0,
    }


def _empty_session_counts():
    return {'all': 0, 'pppoe': 0, 'hotspot': 0}


def _apply_radacct_scope(query, router_id=None, isp_id=None):
    if isp_id:
        query = query.filter(RadAcct.isp_id == isp_id)
    if router_id:
        device = MikrotikDevice.query.get(router_id)
        if device:
            query = query.filter(
                or_(
                    RadAcct.mikrotik_device_id == router_id,
                    RadAcct.nasipaddress == device.device_ip,
                )
            )
    return query


def _radius_period_stats(start, end=None, router_id=None, isp_id=None):
    filters = [RadAcct.acctstarttime >= start]
    if end is not None:
        filters.append(RadAcct.acctstarttime < end)

    q = db.session.query(
        func.coalesce(func.sum(RadAcct.acctinputoctets), 0),
        func.coalesce(func.sum(RadAcct.acctoutputoctets), 0),
        func.count(func.distinct(RadAcct.username)),
        func.count(RadAcct.radacctid),
    )
    q = _apply_radacct_scope(q, router_id, isp_id)
    upload, download, unique_users, sessions = q.filter(*filters).one()

    live_q = RadAcct.query.filter(RadAcct.acctstoptime.is_(None), RadAcct.acctstarttime >= start)
    if end is not None:
        live_q = live_q.filter(RadAcct.acctstarttime < end)
    live_q = _apply_radacct_scope(live_q, router_id, isp_id)
    live_sessions = live_q.count()

    return {
        'upload_bytes': int(upload or 0),
        'download_bytes': int(download or 0),
        'unique_users': int(unique_users or 0),
        'sessions': int(sessions or 0),
        'live_sessions': int(live_sessions),
    }


def _safe_radius_period_stats(start, end=None, router_id=None, isp_id=None):
    try:
        return _radius_period_stats(start, end, router_id, isp_id)
    except Exception:
        db.session.rollback()
        return _empty_radius_stats()


def _session_counts(router_id=None, isp_id=None):
    """Live sessions, split by service.

    Uses the shared online definition rather than a bare
    ``acctstoptime IS NULL``: a router that dies mid-session never sends an
    Accounting-Stop, and those rows would otherwise be counted as connected
    forever. See services/session_tracking.
    """
    from services.session_tracking import link_unattributed_sessions, online_filter

    link_unattributed_sessions()
    query = RadAcct.query.filter(online_filter())
    query = _apply_radacct_scope(query, router_id, isp_id)
    records = query.all()
    counts = _empty_session_counts()
    for record in records:
        counts['all'] += 1
        customer = record.customer
        # Fall back to the session's own protocol when the row is not linked to a
        # customer — Framed-Protocol is PPP for a PPPoE dial, absent for hotspot.
        if customer is not None:
            is_hotspot = customer.connection_type == 'hotspot'
        else:
            is_hotspot = (record.framedprotocol or '').strip().upper() != 'PPP'
        counts['hotspot' if is_hotspot else 'pppoe'] += 1
    return counts


def _safe_session_counts(router_id=None, isp_id=None):
    try:
        return _session_counts(router_id, isp_id)
    except Exception:
        db.session.rollback()
        return _empty_session_counts()


def _top_data_users(limit=5, start=None, end=None, router_id=None, isp_id=None, active_only=False):
    byte_expr = (
        func.coalesce(RadAcct.acctinputoctets, 0) + func.coalesce(RadAcct.acctoutputoctets, 0)
    )
    q = (
        db.session.query(
            RadAcct.username,
            func.max(Customer.full_name),
            func.max(Customer.connection_type),
            func.sum(byte_expr) if not active_only else func.max(byte_expr),
        )
        .outerjoin(Customer, RadAcct.customer_id == Customer.id)
    )
    q = _apply_radacct_scope(q, router_id, isp_id)
    filters = []
    if active_only:
        filters.append(RadAcct.acctstoptime.is_(None))
    if start is not None:
        filters.append(RadAcct.acctstarttime >= start)
    if end is not None:
        filters.append(RadAcct.acctstarttime < end)
    if filters:
        q = q.filter(*filters)
    rows = (
        q.group_by(RadAcct.username)
        .order_by((func.sum(byte_expr) if not active_only else func.max(byte_expr)).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            'username': row[0],
            'name': row[1] or row[0],
            'connection_type': row[2] or '—',
            'bytes': int(row[3] or 0),
        }
        for row in rows
    ]


def _safe_top_data_users(limit=5, start=None, end=None, router_id=None, isp_id=None, active_only=False):
    try:
        return _top_data_users(limit, start, end, router_id, isp_id, active_only)
    except Exception:
        db.session.rollback()
        return []


def _safe_live_sessions(connection_type, router_id=None, isp_id=None):
    try:
        q = RadAcct.query.filter(RadAcct.acctstoptime.is_(None))
        q = _apply_radacct_scope(q, router_id, isp_id)
        if connection_type == 'hotspot':
            q = q.join(Customer, RadAcct.customer_id == Customer.id).filter(
                Customer.connection_type == 'hotspot'
            )
        else:
            q = q.outerjoin(Customer, RadAcct.customer_id == Customer.id).filter(
                or_(Customer.connection_type != 'hotspot', Customer.connection_type.is_(None))
            )
        return int(q.count())
    except Exception:
        db.session.rollback()
        return 0


def _subscriber_stats(connection_type, now, month_start, router_id=None, isp_id=None):
    base = Customer.query.filter_by(connection_type=connection_type)
    total = base.count()
    active = base.filter(
        Customer.status == CustomerStatus.ACTIVE,
        or_(Customer.subscription_end.is_(None), Customer.subscription_end >= now),
    ).count()
    expired = base.filter(
        Customer.subscription_end.isnot(None),
        Customer.subscription_end < now,
    ).count()
    suspended = base.filter_by(status=CustomerStatus.SUSPENDED).count()
    new_month = base.filter(Customer.created_at >= month_start).count()
    live_sessions = _safe_live_sessions(connection_type, router_id, isp_id)
    return {
        'total': total,
        'active': active,
        'expired': expired,
        'suspended': suspended,
        'new_month': new_month,
        'live_sessions': live_sessions,
    }


# ---------------------------------------------------------------------------
# Account setup checklist  (Overview > "Set up your account")
# ---------------------------------------------------------------------------
#
# Six things a new tenant has to do before the product does anything useful.
# Every one is derived from real state — there is no "I marked it done" flag —
# so the card cannot drift out of sync with the account, and it disappears on
# its own once the last box ticks. Order is cheapest-config-first, hardware
# last, which is also the order the operator meets these screens in.

SETUP_STEP_META = (
    {
        'key': 'branding',
        'title': 'Set network name & logo',
        'description': 'Your name and logo brand the captive portal, invoices and SMS.',
        'cta': 'Open branding',
        'path': '/settings?tab=general',
    },
    {
        'key': 'payments',
        'title': 'Choose payment gateway',
        'description': 'Point collections at a paybill, till or bank account so subscribers can pay.',
        'cta': 'Set up payments',
        'path': '/settings?tab=payments',
    },
    {
        'key': 'sms',
        'title': 'Configure SMS provider',
        'description': 'Connect a sender so expiry reminders and receipts actually leave the building.',
        'cta': 'Connect provider',
        'path': '/settings?tab=integrations',
    },
    {
        'key': 'plan',
        'title': 'Create your first plan',
        'description': 'A speed, a price and a validity period — everything else bills off this.',
        'cta': 'Create a plan',
        'path': '/plans/new',
    },
    {
        'key': 'subscriber',
        'title': 'Add a subscriber',
        'description': 'Add one by hand, or import an existing customer list in bulk.',
        'cta': 'Add subscriber',
        'path': '/clients/new',
    },
    {
        'key': 'router',
        'title': 'Register a router',
        'description': 'Register a MikroTik so sessions, usage and disconnects flow in live.',
        'cta': 'Register router',
        'path': '/devices/mikrotik',
    },
)

# Names the seeders and older installs leave behind — present, but not a choice
# anybody made, so they must not tick the branding box.
_PLACEHOLDER_NAMES = {'', 'default company', 'lumen', 'infora', 'isp', 'my isp', 'test'}

# Integration keys that can send an SMS. Only Africa's Talking ships today; the
# set keeps the check from needing an edit when a second provider lands.
_SMS_INTEGRATION_KEYS = ('africastalking',)


def _setup_isp(user):
    """The tenant whose setup we are reporting on.

    Prefers the caller's own ISP and falls back to the default active one for
    platform admins with no tenant of their own — same resolution the Settings
    API uses, so the checklist and the pages it links to agree.
    """
    isp = None
    if getattr(user, 'isp_id', None):
        isp = ISP.query.get(user.isp_id)
    if isp is None:
        isp = ISP.query.filter_by(is_active=True).order_by(ISP.id.asc()).first()
    return isp


def _scoped_count(model, isp):
    q = model.query
    if isp is not None:
        q = q.filter(model.isp_id == isp.id)
    return q.count()


def _branding_done(isp):
    if isp is None:
        return False
    name = (isp.company_name or '').strip().lower()
    return bool(isp.logo_url) and name not in _PLACEHOLDER_NAMES


def _payment_gateway_done(isp):
    """A gateway counts as chosen only when money has somewhere to land."""
    if isp is None:
        return False
    ps = PaymentSettings.query.filter_by(isp_id=isp.id).first()
    if ps is None:
        return False
    route = (ps.collection_route or 'paybill').strip().lower()
    if route == 'buygoods':
        return bool(ps.buygoods_till)
    if route == 'bank':
        return bool(ps.bank_paybill or ps.bank_account)
    return bool(ps.paybill_shortcode)


def _sms_provider_done(isp):
    """Enabled *and* carrying credentials — an empty toggle sends nothing.

    Secret fields are stored as ciphertext, so truthiness is enough here and
    nothing has to be decrypted to answer the question.
    """
    if isp is None:
        return False
    rows = IntegrationSetting.query.filter(
        IntegrationSetting.isp_id == isp.id,
        IntegrationSetting.key.in_(_SMS_INTEGRATION_KEYS),
    ).all()
    for row in rows:
        if not row.enabled:
            continue
        try:
            cfg = json.loads(row.config) if row.config else {}
        except (TypeError, ValueError):
            cfg = {}
        if cfg.get('api_key') and cfg.get('username'):
            return True
    return False


def _setup_state(user):
    isp = _setup_isp(user)
    done_map = {
        'branding': _branding_done(isp),
        'payments': _payment_gateway_done(isp),
        'sms': _sms_provider_done(isp),
        'plan': _scoped_count(ServicePlan, isp) > 0,
        'subscriber': _scoped_count(Customer, isp) > 0,
        'router': _scoped_count(MikrotikDevice, isp) > 0,
    }
    steps = [dict(meta, done=bool(done_map.get(meta['key']))) for meta in SETUP_STEP_META]
    done = sum(1 for s in steps if s['done'])
    total = len(steps)
    remaining = [s for s in steps if not s['done']]
    return {
        'steps': steps,
        'done': done,
        'total': total,
        'percent': int(round(done * 100 / total)) if total else 100,
        'complete': done == total,
        'next': remaining[0] if remaining else None,
    }


def _safe_setup_state(user):
    try:
        return _setup_state(user)
    except Exception:
        db.session.rollback()
        return None


# ---------------------------------------------------------------------------
# Pulse  (Overview hero — live strip + connection sparkline)
# ---------------------------------------------------------------------------

def _activity_series(now, hours=12, router_id=None, isp_id=None):
    """Sessions started per hour over the trailing window.

    Session *starts* rather than bytes: RADIUS counters are cumulative per
    session, so bucketing them by hour would attribute a whole evening's
    traffic to the minute the dial came up. Starts are exact.
    """
    start = (now - timedelta(hours=hours - 1)).replace(minute=0, second=0, microsecond=0)
    q = db.session.query(RadAcct.acctstarttime)
    q = _apply_radacct_scope(q, router_id, isp_id)
    rows = q.filter(RadAcct.acctstarttime >= start).all()

    buckets = [0] * hours
    for (started,) in rows:
        if not started:
            continue
        index = int((started - start).total_seconds() // 3600)
        if 0 <= index < hours:
            buckets[index] += 1

    return [
        {
            'label': (start + timedelta(hours=i)).strftime('%H:%M'),
            'sessions': buckets[i],
        }
        for i in range(hours)
    ]


def _safe_activity_series(now, hours=12, router_id=None, isp_id=None):
    try:
        return _activity_series(now, hours, router_id, isp_id)
    except Exception:
        db.session.rollback()
        return []


def _pulse_events(recent_customers, recent_payments, offline_device_list, limit=6):
    """Newest few things worth a one-line mention on the hero."""
    events = []
    for c in recent_customers[:4]:
        events.append({
            'type': 'subscriber',
            'title': 'New subscriber',
            'subject': c.full_name or c.radius_login or c.account_number or 'Subscriber',
            'detail': 'joined',
            'path': f'/clients/{c.id}',
            'timestamp': c.created_at.isoformat() if c.created_at else None,
        })
    for p in recent_payments[:4]:
        events.append({
            'type': 'payment',
            'title': 'Payment received',
            'subject': p.customer.full_name if p.customer else 'Subscriber',
            'detail': 'paid',
            'amount': float(p.amount or 0),
            'path': '/billing/payments',
            'timestamp': p.payment_date.isoformat() if p.payment_date else None,
        })
    for d in offline_device_list[:2]:
        events.append({
            'type': 'router',
            'title': 'Router offline',
            'subject': d.device_name,
            'detail': 'stopped responding',
            'path': f'/devices/mikrotik/{d.id}',
            'timestamp': d.last_synced.isoformat() if d.last_synced else None,
        })
    events = [e for e in events if e['timestamp']]
    events.sort(key=lambda e: e['timestamp'], reverse=True)
    return events[:limit]


@dashboard_bp.route('/stats', methods=['OPTIONS'])
def dashboard_stats_options():
    return '', 200


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def dashboard_stats():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    router_id = request.args.get('router_id', type=int)
    isp_id = user.isp_id if user.role != 'admin' and user.isp_id else None

    now = datetime.now()
    month_start, month_end = _month_range(0)
    prev_start, prev_end = _month_range(1)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Revenue & payments
    total_revenue = db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
        Invoice.status == InvoiceStatus.PAID
    ).scalar() or 0

    monthly_revenue = db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
        Invoice.status == InvoiceStatus.PAID,
        Invoice.paid_date >= month_start,
        Invoice.paid_date < month_end,
    ).scalar() or 0

    prev_monthly_revenue = db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
        Invoice.status == InvoiceStatus.PAID,
        Invoice.paid_date >= prev_start,
        Invoice.paid_date < prev_end,
    ).scalar() or 0

    monthly_payments = db.session.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_status == PaymentStatus.COMPLETED,
        Payment.payment_date >= now - timedelta(days=30),
    ).scalar() or 0

    today_payments = db.session.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_status == PaymentStatus.COMPLETED,
        Payment.payment_date >= today_start,
    ).scalar() or 0

    mpesa_month_count = Payment.query.filter(
        Payment.payment_status == PaymentStatus.COMPLETED,
        Payment.payment_method.ilike('%mpesa%'),
        Payment.payment_date >= now - timedelta(days=30),
    ).count()

    # Customers
    total_customers = Customer.query.count()
    active_customers = Customer.query.filter_by(status=CustomerStatus.ACTIVE).count()
    suspended_customers = Customer.query.filter_by(status=CustomerStatus.SUSPENDED).count()
    pending_customers = Customer.query.filter_by(status=CustomerStatus.PENDING).count()
    hotspot_customers = Customer.query.filter_by(connection_type='hotspot').count()
    pppoe_customers = Customer.query.filter_by(connection_type='pppoe').count()

    expired_subscriptions = Customer.query.filter(
        Customer.subscription_end.isnot(None),
        Customer.subscription_end < now,
    ).count()

    new_customers_month = Customer.query.filter(
        Customer.created_at >= month_start,
    ).count()

    prev_new_customers = Customer.query.filter(
        Customer.created_at >= prev_start,
        Customer.created_at < prev_end,
    ).count()

    mrr = db.session.query(func.coalesce(func.sum(ServicePlan.price), 0)).join(
        Customer, Customer.service_plan_id == ServicePlan.id
    ).filter(Customer.status == CustomerStatus.ACTIVE).scalar() or 0

    # Invoices
    pending_invoices = Invoice.query.filter_by(status=InvoiceStatus.PENDING).count()
    overdue_invoices = Invoice.query.filter(
        Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
        Invoice.due_date < now,
    ).count()
    pending_invoice_amount = db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
        Invoice.status == InvoiceStatus.PENDING
    ).scalar() or 0
    overdue_invoice_amount = db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
        Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
        Invoice.due_date < now,
    ).scalar() or 0

    # Plans
    active_plans = ServicePlan.query.filter_by(is_active=True).count()
    hotspot_plans = ServicePlan.query.filter_by(is_active=True, plan_type='hotspot').count()
    pppoe_plans = ServicePlan.query.filter_by(is_active=True, plan_type='pppoe').count()

    # Network
    total_devices = MikrotikDevice.query.count()
    online_devices = MikrotikDevice.query.filter_by(device_status=DeviceStatus.ONLINE).count()
    offline_devices = MikrotikDevice.query.filter_by(device_status=DeviceStatus.OFFLINE).count()
    total_router_clients = db.session.query(func.coalesce(func.sum(MikrotikDevice.client_count), 0)).scalar() or 0

    # KYC
    kyc_pending = Customer.query.filter_by(kyc_status=KycStatus.PENDING).count()
    kyc_under_review = Customer.query.filter_by(kyc_status=KycStatus.UNDER_REVIEW).count()
    kyc_verified = Customer.query.filter_by(kyc_status=KycStatus.VERIFIED).count()
    kyc_docs_pending = CustomerDocument.query.filter_by(verification_status='pending').count()

    # Tickets
    open_tickets = Ticket.query.filter(
        Ticket.ticket_status.in_([
            TicketStatus.OPEN,
            TicketStatus.PENDING,
            TicketStatus.IN_PROGRESS,
            TicketStatus.ON_HOLD,
        ])
    ).count()

    # Charts — 6 months revenue & payments
    revenue_data = []
    for i in range(5, -1, -1):
        start, end = _month_range(i)
        revenue = db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
            Invoice.status == InvoiceStatus.PAID,
            Invoice.paid_date >= start,
            Invoice.paid_date < end,
        ).scalar() or 0
        payments = db.session.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.payment_status == PaymentStatus.COMPLETED,
            Payment.payment_date >= start,
            Payment.payment_date < end,
        ).scalar() or 0
        revenue_data.append({
            'month': start.strftime('%b'),
            'revenue': float(revenue),
            'payments': float(payments),
        })

    # Package distribution
    plans = ServicePlan.query.filter_by(is_active=True).order_by(ServicePlan.price.asc()).all()
    package_distribution = []
    for idx, plan in enumerate(plans):
        count = len(plan.customers) if hasattr(plan, 'customers') else 0
        package_distribution.append({
            'name': plan.name,
            'value': count,
            'plan_type': plan.plan_type or 'pppoe',
            'price': float(plan.price),
            'color': PACKAGE_COLORS[idx % len(PACKAGE_COLORS)],
        })

    connection_distribution = [
        {'name': 'Hotspot', 'value': hotspot_customers, 'color': '#10b981'},
        {'name': 'PPPoE', 'value': pppoe_customers, 'color': '#3b82f6'},
    ]

    # Recent activity
    recent_payments = Payment.query.filter(
        Payment.payment_status == PaymentStatus.COMPLETED
    ).order_by(Payment.payment_date.desc()).limit(6).all()

    recent_customers = Customer.query.order_by(Customer.created_at.desc()).limit(5).all()

    recent_invoices = Invoice.query.order_by(Invoice.created_at.desc()).limit(5).all()

    recent_activity = []
    for payment in recent_payments:
        recent_activity.append({
            'type': 'payment',
            'message': f"Payment from {payment.customer.full_name if payment.customer else 'Customer'}",
            'amount': float(payment.amount),
            'status': payment.payment_method,
            'timestamp': payment.payment_date.isoformat() if payment.payment_date else None,
        })
    for inv in recent_invoices:
        if inv.status != InvoiceStatus.PAID:
            recent_activity.append({
                'type': 'invoice',
                'message': f"Invoice {inv.invoice_number} — {inv.customer.full_name if inv.customer else 'Customer'}",
                'amount': float(inv.amount),
                'status': inv.status.value if inv.status else 'pending',
                'timestamp': inv.created_at.isoformat() if inv.created_at else None,
            })
    recent_activity.sort(key=lambda x: x.get('timestamp') or '', reverse=True)
    recent_activity = recent_activity[:10]

    # Alerts
    alerts = []
    if overdue_invoices > 0:
        alerts.append({
            'level': 'warning',
            'title': f'{overdue_invoices} overdue invoice(s)',
            'message': f'{float(overdue_invoice_amount):,.0f} KES outstanding past due date.',
            'link': '/billing/invoices',
        })
    if expired_subscriptions > 0:
        alerts.append({
            'level': 'error',
            'title': f'{expired_subscriptions} expired subscription(s)',
            'message': 'Customers may be offline until they renew via the captive portal.',
            'link': '/customers',
        })
    if offline_devices > 0:
        alerts.append({
            'level': 'warning',
            'title': f'{offline_devices} router(s) offline',
            'message': 'Check MikroTik devices and sync status.',
            'link': '/devices/mikrotik',
        })
    if kyc_pending + kyc_under_review > 0:
        alerts.append({
            'level': 'info',
            'title': f'{kyc_pending + kyc_under_review} KYC review(s) pending',
            'message': 'Verify customer documents to stay compliant.',
            'link': '/customers/kyc',
        })
    if open_tickets > 0:
        alerts.append({
            'level': 'info',
            'title': f'{open_tickets} open support ticket(s)',
            'message': 'Respond to customer issues promptly.',
            'link': '/tickets',
        })

    overdue_list = Invoice.query.filter(
        Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
        Invoice.due_date < now,
    ).order_by(Invoice.due_date.asc()).limit(5).all()

    expiring_soon = Customer.query.filter(
        Customer.subscription_end.isnot(None),
        Customer.subscription_end >= now,
        Customer.subscription_end < now + timedelta(days=7),
        Customer.status == CustomerStatus.ACTIVE,
    ).order_by(Customer.subscription_end.asc()).limit(5).all()

    devices_query = MikrotikDevice.query.filter_by(is_active=True)
    if isp_id:
        devices_query = devices_query.filter_by(isp_id=isp_id)
    all_routers = devices_query.order_by(MikrotikDevice.device_name.asc()).all()
    if router_id:
        devices = [d for d in all_routers if d.id == router_id]
    else:
        devices = sorted(all_routers, key=lambda d: (d.device_status.value if d.device_status else 'offline'))[:6]

    yesterday_start = today_start - timedelta(days=1)
    week_start = _week_start(now)
    year_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)

    revenue_periods = {
        'today': _payment_total(today_start),
        'yesterday': _payment_total(yesterday_start, today_start),
        'this_week': _payment_total(week_start),
        'this_month': _payment_total(month_start),
        'last_month': _payment_total(prev_start, prev_end),
        'this_year': _payment_total(year_start),
    }

    revenue_by_type = {
        'pppoe': _payments_by_connection(month_start, month_end, 'pppoe'),
        'hotspot': _payments_by_connection(month_start, month_end, 'hotspot'),
    }

    subscribers = {
        'pppoe': _subscriber_stats('pppoe', now, month_start, router_id, isp_id),
        'hotspot': _subscriber_stats('hotspot', now, month_start, router_id, isp_id),
    }

    hotspot_activity = {
        'today': _payments_by_connection(today_start, tomorrow_start, 'hotspot'),
        'yesterday': _payments_by_connection(yesterday_start, today_start, 'hotspot'),
        'this_week': _payments_by_connection(week_start, tomorrow_start, 'hotspot'),
        'this_month': _payments_by_connection(month_start, month_end, 'hotspot'),
        'sales_today': _payment_count(today_start, tomorrow_start, 'hotspot'),
    }

    radius_periods = {
        'today': _safe_radius_period_stats(today_start, None, router_id, isp_id),
        'week': _safe_radius_period_stats(week_start, None, router_id, isp_id),
        'month': _safe_radius_period_stats(month_start, None, router_id, isp_id),
        'last_month': _safe_radius_period_stats(prev_start, prev_end, router_id, isp_id),
        'all': _safe_radius_period_stats(datetime(2000, 1, 1), None, router_id, isp_id),
    }

    top_data_users_by_period = {
        'today': _safe_top_data_users(5, today_start, tomorrow_start, router_id, isp_id),
        'week': _safe_top_data_users(5, week_start, tomorrow_start, router_id, isp_id),
        'month': _safe_top_data_users(5, month_start, month_end, router_id, isp_id),
        'last_month': _safe_top_data_users(5, prev_start, prev_end, router_id, isp_id),
        'all': _safe_top_data_users(5, datetime(2000, 1, 1), None, router_id, isp_id),
    }
    top_data_users = top_data_users_by_period['today']

    session_counts = _safe_session_counts(router_id, isp_id)

    sms_sent_month = Notification.query.filter(
        Notification.notification_type.ilike('sms'),
        Notification.created_at >= month_start,
    ).count()
    sms_failed_month = 0

    isp = ISP.query.filter_by(is_active=True).order_by(ISP.id.asc()).first()
    organization = {
        'name': isp.company_name if isp else 'Lumen',
        'tagline': 'Internet Service Provider',
        'country': 'KE',
        'currency': 'KES',
        'routers': total_devices,
        'packages': active_plans,
        'modules': ['PPPoE', 'Hotspot', 'WireGuard'],
    }

    active_sessions = session_counts['all']

    setup_state = _safe_setup_state(user)

    today_radius = radius_periods.get('today') or {}
    offline_routers = [d for d in all_routers if d.device_status == DeviceStatus.OFFLINE]
    activity_series = _safe_activity_series(now, 12, router_id, isp_id)
    pulse = {
        'online_now': active_sessions,
        'events': _pulse_events(recent_customers, recent_payments, offline_routers),
        'activity': {
            'window_hours': 12,
            'series': activity_series,
            'sessions': sum(point['sessions'] for point in activity_series),
            'bytes_today': int(today_radius.get('download_bytes') or 0)
            + int(today_radius.get('upload_bytes') or 0),
        },
    }

    month_expenses = float(
        db.session.query(func.coalesce(func.sum(Transaction.transaction_amount), 0))
        .filter(
            Transaction.transaction_type != 'payment',
            Transaction.created_at >= month_start,
            Transaction.created_at < month_end,
        )
        .scalar()
        or 0
    )

    hotspot_hourly = []
    for hour in range(24):
        hour_start = today_start.replace(hour=hour)
        hour_end = hour_start + timedelta(hours=1)
        if hour_start > now:
            amount, sales = 0, 0
        else:
            end = min(hour_end, now + timedelta(seconds=1))
            amount = _payments_by_connection(hour_start, end, 'hotspot')
            sales = _payment_count(hour_start, end, 'hotspot')
        hotspot_hourly.append({
            'hour': f'{hour:02d}',
            'label': f'{hour:02d}:00',
            'amount': amount,
            'sales': sales,
        })

    sms_daily = []
    for day_offset in range(6, -1, -1):
        day_start = (today_start - timedelta(days=day_offset))
        day_end = day_start + timedelta(days=1)
        sent = Notification.query.filter(
            Notification.notification_type.ilike('sms'),
            Notification.created_at >= day_start,
            Notification.created_at < day_end,
        ).count()
        sms_daily.append({
            'day': day_start.strftime('%a'),
            'sent': sent,
        })

    roadmap = [
        {'title': 'WireGuard VPN billing', 'status': 'shipped'},
        {'title': 'Online users dashboard', 'status': 'shipped'},
        {'title': 'Dark mode', 'status': 'shipped'},
        {'title': 'M-Pesa STK integration', 'status': 'shipped'},
        {'title': 'SMS campaigns', 'status': 'planned'},
        {'title': 'Reseller portal', 'status': 'planned'},
    ]

    def _device_metrics(device):
        clients = device.client_count or 0
        bw = device.bandwidth_usage or 0
        cpu = min(95, max(8, (bw % 70) + 12 + clients * 2))
        memory = min(95, max(15, 28 + clients * 4 + (bw % 30)))
        downtime = None
        if device.device_status == DeviceStatus.OFFLINE and device.last_synced:
            delta = now - device.last_synced
            hours = int(delta.total_seconds() // 3600)
            minutes = int((delta.total_seconds() % 3600) // 60)
            downtime = f'{hours}h {minutes}m'
        return cpu, memory, downtime

    device_list = []
    for d in devices:
        cpu, mem, down = _device_metrics(d)
        device_list.append({
            'id': d.id,
            'name': d.device_name,
            'ip': d.device_ip,
            'status': d.device_status.value if d.device_status else 'offline',
            'clients': d.client_count or 0,
            'location': d.location,
            'model': d.device_model,
            'uptime': d.uptime or 0,
            'bandwidth_usage': d.bandwidth_usage or 0,
            'last_synced': d.last_synced.isoformat() if d.last_synced else None,
            'cpu_percent': cpu,
            'memory_percent': mem,
            'downtime': down,
        })

    router_list = [
        {'id': d.id, 'name': d.device_name, 'ip': d.device_ip}
        for d in all_routers
    ]

    return jsonify({
        'generated_at': now.isoformat(),
        'summary': {
            'total_revenue': float(total_revenue),
            'monthly_revenue': float(monthly_revenue),
            'revenue_change_pct': _pct_change(monthly_revenue, prev_monthly_revenue),
            'monthly_payments': float(monthly_payments),
            'today_payments': float(today_payments),
            'mpesa_month_count': mpesa_month_count,
            'mrr': float(mrr),
            'active_customers': active_customers,
            'total_customers': total_customers,
            'customer_change_pct': _pct_change(new_customers_month, prev_new_customers),
            'suspended_customers': suspended_customers,
            'pending_customers': pending_customers,
            'hotspot_customers': hotspot_customers,
            'pppoe_customers': pppoe_customers,
            'expired_subscriptions': expired_subscriptions,
            'new_customers_month': new_customers_month,
            'pending_invoices': pending_invoices,
            'overdue_invoices': overdue_invoices,
            'pending_invoice_amount': float(pending_invoice_amount),
            'overdue_invoice_amount': float(overdue_invoice_amount),
            'active_plans': active_plans,
            'hotspot_plans': hotspot_plans,
            'pppoe_plans': pppoe_plans,
            'total_devices': total_devices,
            'online_devices': online_devices,
            'offline_devices': offline_devices,
            'total_router_clients': int(total_router_clients),
            'kyc_pending': kyc_pending,
            'kyc_under_review': kyc_under_review,
            'kyc_verified': kyc_verified,
            'kyc_docs_pending': kyc_docs_pending,
            'open_tickets': open_tickets,
        },
        'revenue_data': revenue_data,
        'package_distribution': package_distribution,
        'connection_distribution': connection_distribution,
        'recent_activity': recent_activity,
        'recent_payments': [
            {
                'id': p.id,
                'customer': p.customer.full_name if p.customer else '—',
                'amount': float(p.amount),
                'method': p.payment_method,
                'receipt': p.mpesa_receipt_number,
                'date': p.payment_date.isoformat() if p.payment_date else None,
            }
            for p in recent_payments
        ],
        'recent_customers': [
            {
                'id': c.id,
                'name': c.full_name,
                'package': c.package,
                'connection_type': c.connection_type,
                'status': c.status.value if c.status else 'active',
                'joined': c.created_at.isoformat() if c.created_at else None,
            }
            for c in recent_customers
        ],
        'overdue_invoices': [
            {
                'id': inv.id,
                'invoice_number': inv.invoice_number,
                'customer': inv.customer.full_name if inv.customer else '—',
                'amount': float(inv.amount),
                'due_date': inv.due_date.isoformat() if inv.due_date else None,
            }
            for inv in overdue_list
        ],
        'expiring_subscriptions': [
            {
                'id': c.id,
                'name': c.full_name,
                'package': c.package,
                'expires': c.subscription_end.isoformat() if c.subscription_end else None,
            }
            for c in expiring_soon
        ],
        'devices': device_list,
        'routers': router_list,
        'alerts': alerts,
        'revenue_periods': revenue_periods,
        'revenue_by_type': revenue_by_type,
        'subscribers': subscribers,
        'hotspot_activity': hotspot_activity,
        'radius_periods': radius_periods,
        'top_data_users': top_data_users,
        'top_data_users_by_period': top_data_users_by_period,
        'session_counts': session_counts,
        'filter_router_id': router_id,
        'sms_usage': {
            'sent': sms_sent_month,
            'failed': sms_failed_month,
            'balance': max(0, 100 - sms_sent_month),
        },
        'organization': organization,
        'setup': setup_state,
        'pulse': pulse,
        'active_sessions': active_sessions,
        'operations': {
            'expenses': month_expenses,
            'payouts': float(monthly_payments),
            'invoices_due': pending_invoices,
            'invoices_due_amount': float(pending_invoice_amount),
            'sms_sent': sms_sent_month,
            'sms_failed': sms_failed_month,
            'campaigns': 0,
            'open_tickets': open_tickets,
        },
        'hotspot_hourly': hotspot_hourly,
        'sms_daily': sms_daily,
        'roadmap': roadmap,
        # Legacy fields for backward compatibility
        'total_revenue': float(total_revenue),
        'active_customers': active_customers,
        'monthly_payments': float(monthly_payments),
        'active_plans': active_plans,
    }), 200
