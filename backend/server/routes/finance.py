from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func, or_

from extensions import db
from models import Customer, CustomerStatus, Invoice, InvoiceStatus, Payment, RevenueData, ServicePlan
from routes.customers import serialize_customer

finance_bp = Blueprint('finance', __name__, url_prefix='/api/finance')


@finance_bp.before_request
def handle_finance_preflight():
    if request.method == 'OPTIONS':
        return '', 200


def serialize_expense(record):
    return {
        'id': record.id,
        'date': record.revenue_date.isoformat() if record.revenue_date else None,
        'amount': float(record.revenue_amount) if record.revenue_amount else 0.0,
        'category': record.revenue_type,
        'customer_id': record.customer_id,
        'invoice_id': record.invoice_id,
        'created_at': record.created_at.isoformat() if record.created_at else None,
    }


def serialize_lead(customer):
    data = serialize_customer(customer)
    data['lead_source'] = 'website' if customer.service_plan_id else 'referral'
    data['estimated_value'] = float(customer.service_plan.price) if customer.service_plan else 0.0
    return data


@finance_bp.route('/leads', methods=['OPTIONS'])
def finance_leads_options():
    return '', 200


@finance_bp.route('/leads', methods=['GET'])
@jwt_required()
def get_leads():
    try:
        search = request.args.get('search', '').strip()
        query = Customer.query.filter_by(status=CustomerStatus.PENDING)

        if search:
            like = f'%{search}%'
            query = query.filter(
                or_(
                    Customer.full_name.ilike(like),
                    Customer.email.ilike(like),
                    Customer.phone.ilike(like),
                )
            )

        leads = query.order_by(Customer.created_at.desc()).all()
        month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        new_this_month = sum(1 for lead in leads if lead.created_at and lead.created_at >= month_start)
        pipeline_value = sum(
            float(lead.service_plan.price) if lead.service_plan else 0.0
            for lead in leads
        )

        return jsonify({
            'leads': [serialize_lead(lead) for lead in leads],
            'stats': {
                'total_leads': len(leads),
                'new_this_month': new_this_month,
                'pipeline_value': pipeline_value,
            },
        }), 200
    except Exception as exc:
        return jsonify({'error': f'Failed to load leads: {str(exc)}'}), 500


@finance_bp.route('/expenses', methods=['OPTIONS'])
def finance_expenses_options():
    return '', 200


@finance_bp.route('/expenses', methods=['GET'])
@jwt_required()
def get_expenses():
    try:
        category = request.args.get('category')
        query = RevenueData.query.filter(RevenueData.revenue_type.ilike('%expense%'))

        if category and category != 'all':
            query = query.filter(RevenueData.revenue_type == category)

        expenses = query.order_by(RevenueData.revenue_date.desc()).all()
        total = sum(float(item.revenue_amount) for item in expenses)
        month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        this_month = sum(
            float(item.revenue_amount)
            for item in expenses
            if item.revenue_date and item.revenue_date >= month_start
        )
        categories = sorted({item.revenue_type for item in expenses})

        return jsonify({
            'expenses': [serialize_expense(item) for item in expenses],
            'stats': {
                'total_expenses': total,
                'this_month': this_month,
                'count': len(expenses),
            },
            'categories': categories,
        }), 200
    except Exception as exc:
        return jsonify({'error': f'Failed to load expenses: {str(exc)}'}), 500


@finance_bp.route('/expenses', methods=['POST'])
@jwt_required()
def create_expense():
    try:
        data = request.get_json() or {}
        amount = data.get('amount')
        category = (data.get('category') or '').strip()
        date_value = data.get('date')

        if not amount or float(amount) <= 0:
            return jsonify({'error': 'Valid amount is required'}), 400
        if not category:
            return jsonify({'error': 'Category is required'}), 400

        expense = RevenueData(
            revenue_amount=float(amount),
            revenue_type=category,
            revenue_date=datetime.fromisoformat(date_value.replace('Z', '+00:00')) if date_value else datetime.now(),
        )
        db.session.add(expense)
        db.session.commit()

        return jsonify({
            'message': 'Expense recorded successfully',
            'expense': serialize_expense(expense),
        }), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': f'Failed to create expense: {str(exc)}'}), 500


@finance_bp.route('/summary', methods=['OPTIONS'])
def finance_summary_options():
    return '', 200


@finance_bp.route('/summary', methods=['GET'])
@jwt_required()
def get_finance_summary():
    try:
        total_revenue = db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
            Invoice.status == InvoiceStatus.PAID
        ).scalar() or 0

        total_expenses = db.session.query(func.coalesce(func.sum(RevenueData.revenue_amount), 0)).filter(
            RevenueData.revenue_type.ilike('%expense%')
        ).scalar() or 0

        monthly_payments = db.session.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
            Payment.payment_date >= datetime.now() - timedelta(days=30)
        ).scalar() or 0

        pending_leads = Customer.query.filter_by(status=CustomerStatus.PENDING).count()
        active_subscribers = Customer.query.filter_by(status=CustomerStatus.ACTIVE).count()
        mrr = db.session.query(func.coalesce(func.sum(ServicePlan.price), 0)).join(
            Customer, Customer.service_plan_id == ServicePlan.id
        ).filter(Customer.status == CustomerStatus.ACTIVE).scalar() or 0

        months = []
        for offset in range(5, -1, -1):
            month_start = (datetime.now().replace(day=1) - timedelta(days=30 * offset)).replace(day=1)
            if month_start.month == 12:
                month_end = month_start.replace(year=month_start.year + 1, month=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1)

            revenue = db.session.query(func.coalesce(func.sum(Invoice.amount), 0)).filter(
                Invoice.status == InvoiceStatus.PAID,
                Invoice.paid_date >= month_start,
                Invoice.paid_date < month_end,
            ).scalar() or 0

            expense = db.session.query(func.coalesce(func.sum(RevenueData.revenue_amount), 0)).filter(
                RevenueData.revenue_type.ilike('%expense%'),
                RevenueData.revenue_date >= month_start,
                RevenueData.revenue_date < month_end,
            ).scalar() or 0

            months.append({
                'month': month_start.strftime('%b'),
                'revenue': float(revenue),
                'expenses': float(expense),
                'profit': float(revenue) - float(expense),
            })

        plans = ServicePlan.query.filter_by(is_active=True).all()
        plan_distribution = [
            {
                'name': plan.name,
                'subscribers': len(plan.customers) if hasattr(plan, 'customers') else 0,
                'mrr': float(plan.price) * len(plan.customers),
            }
            for plan in plans
        ]

        return jsonify({
            'total_revenue': float(total_revenue),
            'total_expenses': float(total_expenses),
            'net_profit': float(total_revenue) - float(total_expenses),
            'monthly_payments': float(monthly_payments),
            'monthly_recurring_revenue': float(mrr),
            'pending_leads': pending_leads,
            'active_subscribers': active_subscribers,
            'monthly_trend': months,
            'plan_distribution': plan_distribution,
        }), 200
    except Exception as exc:
        return jsonify({'error': f'Failed to load finance summary: {str(exc)}'}), 500
