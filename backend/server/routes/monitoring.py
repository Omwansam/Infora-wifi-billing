from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from auth_utils import get_current_user
from services.fup_monitoring import get_fup_monitor_rows

monitoring_bp = Blueprint('monitoring', __name__, url_prefix='/api/monitoring')


@monitoring_bp.route('/fup', methods=['OPTIONS'])
def fup_monitor_options():
    return '', 200


@monitoring_bp.route('/fup', methods=['GET'])
@jwt_required()
def fup_monitor():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    connection_type = (request.args.get('connection_type') or 'all').strip().lower()
    status_filter = (request.args.get('status') or 'all').strip().lower()
    search = (request.args.get('search') or '').strip()

    if connection_type not in ('all', 'pppoe', 'hotspot'):
        return jsonify({'error': 'Invalid connection_type'}), 400
    if status_filter not in ('all', 'warning', 'exceeded', 'throttled', 'fup_enabled'):
        return jsonify({'error': 'Invalid status'}), 400

    isp_id = user.isp_id if user.role != 'admin' and user.isp_id else None

    try:
        rows, summary = get_fup_monitor_rows(
            isp_id=isp_id,
            connection_type=connection_type,
            status_filter=status_filter,
            search=search,
        )
    except Exception as exc:
        return jsonify({'error': 'Failed to load FUP monitor data', 'detail': str(exc)}), 500

    return jsonify({
        'ok': True,
        'generated_at': datetime.now().isoformat(),
        'data': {
            'accounts': rows,
            'summary': summary,
        },
    }), 200


@monitoring_bp.route('/alerts', methods=['OPTIONS'])
def alerts_options():
    return '', 200


@monitoring_bp.route('/alerts', methods=['GET'])
@jwt_required()
def monitoring_alerts():
    """Computed operational alerts: subscriptions, devices, FUP, tickets."""
    from datetime import timedelta
    from models import (
        Customer, CustomerStatus, MikrotikDevice, DeviceStatus,
        Invoice, InvoiceStatus, SupportRequest,
    )

    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    isp_id = user.isp_id if user.role != 'admin' and user.isp_id else None

    now = datetime.utcnow()
    soon = now + timedelta(days=3)

    def scope(q, model):
        return q.filter(model.isp_id == isp_id) if isp_id else q

    alerts = []

    expired = scope(Customer.query.filter(
        Customer.status == CustomerStatus.ACTIVE,
        Customer.subscription_end.isnot(None),
        Customer.subscription_end < now,
    ), Customer).count()
    if expired:
        alerts.append({'level': 'error', 'category': 'subscription',
                       'title': f'{expired} expired subscription(s)',
                       'message': 'Active customers past their end date — they may be offline.',
                       'link': '/clients'})

    expiring = scope(Customer.query.filter(
        Customer.status == CustomerStatus.ACTIVE,
        Customer.subscription_end.isnot(None),
        Customer.subscription_end >= now,
        Customer.subscription_end < soon,
    ), Customer).count()
    if expiring:
        alerts.append({'level': 'warning', 'category': 'subscription',
                       'title': f'{expiring} subscription(s) expiring soon',
                       'message': 'Renewals due within 3 days.',
                       'link': '/clients'})

    offline = scope(MikrotikDevice.query.filter(
        MikrotikDevice.is_active.is_(True),
        MikrotikDevice.device_status != DeviceStatus.ONLINE,
    ), MikrotikDevice).count()
    if offline:
        alerts.append({'level': 'warning', 'category': 'device',
                       'title': f'{offline} router(s) offline',
                       'message': 'Check MikroTik connectivity and sync status.',
                       'link': '/devices/mikrotik'})

    try:
        _rows, fup_summary = get_fup_monitor_rows(isp_id=isp_id)
        over = fup_summary.get('exceeded', 0)
        if over:
            alerts.append({'level': 'warning', 'category': 'fup',
                           'title': f'{over} account(s) over data limit',
                           'message': 'Subscribers exceeded their fair-use threshold.',
                           'link': '/fup'})
    except Exception:
        pass

    try:
        overdue = scope(Invoice.query.filter(
            Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
            Invoice.due_date < now,
        ), Invoice).count()
        if overdue:
            alerts.append({'level': 'warning', 'category': 'billing',
                           'title': f'{overdue} overdue invoice(s)',
                           'message': 'Payments past their due date.',
                           'link': '/billing/invoices'})
    except Exception:
        pass

    open_reqs = scope(SupportRequest.query.filter(SupportRequest.status == 'open'), SupportRequest).count()
    if open_reqs:
        alerts.append({'level': 'info', 'category': 'support',
                       'title': f'{open_reqs} open support request(s)',
                       'message': 'Operator support submissions awaiting action.',
                       'link': '/settings/contact-support'})

    counts = {'error': 0, 'warning': 0, 'info': 0}
    for a in alerts:
        counts[a['level']] = counts.get(a['level'], 0) + 1

    return jsonify({
        'ok': True,
        'generated_at': now.isoformat(),
        'data': {'alerts': alerts, 'counts': counts, 'total': len(alerts)},
    }), 200
