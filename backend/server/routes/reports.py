"""Reports & analytics aggregation API.

Admin-only, ISP-scoped. Every endpoint accepts an optional date range via
?from=YYYY-MM-DD&to=YYYY-MM-DD (defaults to the last 30 days). Reads existing
models only — no new tables.
"""
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from extensions import db
from auth_utils import get_current_user
from models import (
    Customer, CustomerStatus, ServicePlan,
    Invoice, InvoiceStatus, Payment, PaymentStatus,
    MikrotikDevice, DeviceStatus, RadAcct,
)

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

GB = 1024 ** 3


def _require_admin():
    user = get_current_user()
    if not user:
        return None, (jsonify({'error': 'User not found'}), 404)
    if user.role != 'admin' and not user.isp_id:
        return None, (jsonify({'error': 'Admin access required'}), 403)
    return user, None


def _isp_id(user):
    return user.isp_id if user.role != 'admin' and user.isp_id else None


def _date_range():
    """Resolve (start, end) from query params; default = last 30 days."""
    now = datetime.utcnow()
    try:
        end = datetime.strptime(request.args['to'], '%Y-%m-%d') if request.args.get('to') else now
    except ValueError:
        end = now
    try:
        start = datetime.strptime(request.args['from'], '%Y-%m-%d') if request.args.get('from') else end - timedelta(days=30)
    except ValueError:
        start = end - timedelta(days=30)
    return start, end


def _scope(query, model, isp_id):
    return query.filter(model.isp_id == isp_id) if isp_id else query


def _month_buckets(start, end):
    """Yield (label, month_start, month_end) covering [start, end], capped at 12."""
    cur = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    buckets = []
    while cur <= end and len(buckets) < 12:
        nxt = cur.replace(year=cur.year + 1, month=1) if cur.month == 12 else cur.replace(month=cur.month + 1)
        buckets.append((cur.strftime('%b %Y'), cur, nxt))
        cur = nxt
    return buckets


@reports_bp.route('/billing', methods=['GET'])
@jwt_required()
def billing_report():
    user, err = _require_admin()
    if err:
        return err
    isp_id = _isp_id(user)
    start, end = _date_range()

    paid = _scope(db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
        Invoice.status == InvoiceStatus.PAID, Invoice.paid_date >= start, Invoice.paid_date < end,
    ), Invoice, isp_id).scalar() or 0
    outstanding = _scope(db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
        Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
    ), Invoice, isp_id).scalar() or 0
    payments_total = _scope(db.session.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_status == PaymentStatus.COMPLETED, Payment.payment_date >= start, Payment.payment_date < end,
    ), Payment, isp_id).scalar() or 0

    # Revenue trend by month
    trend = []
    for label, m0, m1 in _month_buckets(start, end):
        rev = _scope(db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
            Invoice.status == InvoiceStatus.PAID, Invoice.paid_date >= m0, Invoice.paid_date < m1,
        ), Invoice, isp_id).scalar() or 0
        trend.append({'label': label, 'revenue': float(rev)})

    # Payments by method
    method_q = _scope(db.session.query(Payment.payment_method, func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_status == PaymentStatus.COMPLETED, Payment.payment_date >= start, Payment.payment_date < end,
    ), Payment, isp_id).group_by(Payment.payment_method).all()
    by_method = [{'method': m or 'unknown', 'amount': float(a)} for m, a in method_q]

    return jsonify({'ok': True, 'data': {
        'range': {'from': start.isoformat(), 'to': end.isoformat()},
        'kpis': {'paid': float(paid), 'outstanding': float(outstanding), 'payments': float(payments_total)},
        'revenue_trend': trend,
        'by_method': by_method,
    }}), 200


@reports_bp.route('/network', methods=['GET'])
@jwt_required()
def network_report():
    user, err = _require_admin()
    if err:
        return err
    isp_id = _isp_id(user)
    start, end = _date_range()

    byte_expr = func.coalesce(RadAcct.acctinputoctets, 0) + func.coalesce(RadAcct.acctoutputoctets, 0)
    base = RadAcct.query.filter(RadAcct.acctstarttime >= start, RadAcct.acctstarttime < end)
    base = _scope(base, RadAcct, isp_id)

    total_sessions = base.count()
    active_sessions = _scope(RadAcct.query.filter(RadAcct.acctstoptime.is_(None)), RadAcct, isp_id).count()
    total_bytes = _scope(db.session.query(func.coalesce(func.sum(byte_expr), 0)).filter(
        RadAcct.acctstarttime >= start, RadAcct.acctstarttime < end,
    ), RadAcct, isp_id).scalar() or 0

    # Top users by traffic
    top_q = _scope(db.session.query(RadAcct.username, func.sum(byte_expr)).filter(
        RadAcct.acctstarttime >= start, RadAcct.acctstarttime < end,
    ), RadAcct, isp_id).group_by(RadAcct.username).order_by(func.sum(byte_expr).desc()).limit(10).all()
    top_users = [{'username': u, 'bytes': int(b or 0)} for u, b in top_q]

    # Traffic trend by month
    trend = []
    for label, m0, m1 in _month_buckets(start, end):
        b = _scope(db.session.query(func.coalesce(func.sum(byte_expr), 0)).filter(
            RadAcct.acctstarttime >= m0, RadAcct.acctstarttime < m1,
        ), RadAcct, isp_id).scalar() or 0
        trend.append({'label': label, 'gb': round(int(b) / GB, 2)})

    return jsonify({'ok': True, 'data': {
        'range': {'from': start.isoformat(), 'to': end.isoformat()},
        'kpis': {'total_sessions': total_sessions, 'active_sessions': active_sessions,
                 'total_gb': round(int(total_bytes) / GB, 2)},
        'top_users': top_users,
        'traffic_trend': trend,
    }}), 200


@reports_bp.route('/devices', methods=['GET'])
@jwt_required()
def devices_report():
    user, err = _require_admin()
    if err:
        return err
    isp_id = _isp_id(user)

    base = _scope(MikrotikDevice.query, MikrotikDevice, isp_id)
    total = base.count()
    online = base.filter(MikrotikDevice.device_status == DeviceStatus.ONLINE).count()
    by_status = []
    for st in DeviceStatus:
        by_status.append({'status': st.value,
                          'count': _scope(MikrotikDevice.query.filter(MikrotikDevice.device_status == st), MikrotikDevice, isp_id).count()})

    avg_cpu = _scope(db.session.query(func.avg(MikrotikDevice.cpu_load)), MikrotikDevice, isp_id).scalar()
    devices = [{
        'id': d.id, 'name': d.device_name, 'ip': d.device_ip,
        'status': d.device_status.value if d.device_status else 'unknown',
        'cpu_load': d.cpu_load, 'mem_total': d.mem_total, 'mem_free': d.mem_free,
        'last_synced': d.last_synced.isoformat() if d.last_synced else None,
    } for d in base.order_by(MikrotikDevice.device_name).limit(200).all()]

    return jsonify({'ok': True, 'data': {
        'kpis': {'total': total, 'online': online, 'offline': total - online,
                 'avg_cpu': round(float(avg_cpu), 1) if avg_cpu is not None else None},
        'by_status': by_status,
        'devices': devices,
    }}), 200


@reports_bp.route('/clients', methods=['GET'])
@jwt_required()
def clients_report():
    user, err = _require_admin()
    if err:
        return err
    isp_id = _isp_id(user)
    start, end = _date_range()

    base = _scope(Customer.query, Customer, isp_id)
    total = base.count()
    active = base.filter(Customer.status == CustomerStatus.ACTIVE).count()
    suspended = base.filter(Customer.status == CustomerStatus.SUSPENDED).count()
    pending = base.filter(Customer.status == CustomerStatus.PENDING).count()

    by_type = []
    for ct in ('pppoe', 'hotspot', 'wireguard'):
        by_type.append({'type': ct, 'count': _scope(Customer.query.filter(Customer.connection_type == ct), Customer, isp_id).count()})

    # New clients per month (growth)
    growth = []
    for label, m0, m1 in _month_buckets(start, end):
        n = _scope(Customer.query.filter(Customer.created_at >= m0, Customer.created_at < m1), Customer, isp_id).count()
        growth.append({'label': label, 'new_clients': n})

    return jsonify({'ok': True, 'data': {
        'range': {'from': start.isoformat(), 'to': end.isoformat()},
        'kpis': {'total': total, 'active': active, 'suspended': suspended, 'pending': pending},
        'by_type': by_type,
        'growth': growth,
    }}), 200


@reports_bp.route('/analytics', methods=['GET'])
@jwt_required()
def analytics_report():
    user, err = _require_admin()
    if err:
        return err
    isp_id = _isp_id(user)
    start, end = _date_range()

    active = _scope(Customer.query.filter(Customer.status == CustomerStatus.ACTIVE), Customer, isp_id).count()
    mrr = _scope(db.session.query(func.coalesce(func.sum(ServicePlan.price), 0)).join(
        Customer, Customer.service_plan_id == ServicePlan.id,
    ).filter(Customer.status == CustomerStatus.ACTIVE), Customer, isp_id).scalar() or 0
    arpu = float(mrr) / active if active else 0

    byte_expr = func.coalesce(RadAcct.acctinputoctets, 0) + func.coalesce(RadAcct.acctoutputoctets, 0)
    total_bytes = _scope(db.session.query(func.coalesce(func.sum(byte_expr), 0)).filter(
        RadAcct.acctstarttime >= start, RadAcct.acctstarttime < end,
    ), RadAcct, isp_id).scalar() or 0
    devices_online = _scope(MikrotikDevice.query.filter(
        MikrotikDevice.device_status == DeviceStatus.ONLINE), MikrotikDevice, isp_id).count()

    return jsonify({'ok': True, 'data': {
        'range': {'from': start.isoformat(), 'to': end.isoformat()},
        'kpis': {
            'active_subscribers': active,
            'mrr': float(mrr),
            'arpu': round(arpu, 2),
            'total_gb': round(int(total_bytes) / GB, 2),
            'devices_online': devices_online,
        },
    }}), 200
