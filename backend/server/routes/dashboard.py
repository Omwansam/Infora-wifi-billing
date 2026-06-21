from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta

from extensions import db
from models import (
    Customer,
    CustomerDocument,
    CustomerStatus,
    DeviceStatus,
    Invoice,
    InvoiceStatus,
    KycStatus,
    MikrotikDevice,
    Payment,
    PaymentStatus,
    ServicePlan,
    Ticket,
    TicketStatus,
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


@dashboard_bp.route('/stats', methods=['OPTIONS'])
def dashboard_stats_options():
    return '', 200


@dashboard_bp.route('/stats', methods=['GET'])
@jwt_required()
def dashboard_stats():
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

    devices = MikrotikDevice.query.filter_by(is_active=True).order_by(
        MikrotikDevice.device_status.asc()
    ).limit(6).all()

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
        'devices': [
            {
                'id': d.id,
                'name': d.device_name,
                'ip': d.device_ip,
                'status': d.device_status.value if d.device_status else 'offline',
                'clients': d.client_count or 0,
                'location': d.location,
            }
            for d in devices
        ],
        'alerts': alerts,
        # Legacy fields for backward compatibility
        'total_revenue': float(total_revenue),
        'active_customers': active_customers,
        'monthly_payments': float(monthly_payments),
        'active_plans': active_plans,
    }), 200
