from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import (
    User, Customer, CustomerStatus, ServicePlan, ISP, RadCheck, RadReply, RadAcct, 
    RadUserGroup, RadGroupCheck, RadGroupReply, MikrotikDevice
)
from datetime import datetime, timedelta
import secrets

from auth_utils import get_current_user
from services.plan_utils import get_plan_limits
from services.radius_provisioning import (
    provision_customer_radius,
    deprovision_customer_radius,
    set_customer_radius_password,
    suspend_customer_access,
    activate_customer_after_payment,
)

billing_bp = Blueprint('billing', __name__, url_prefix='/api/billing')

def get_current_user_isp():
    """Get current user and their ISP context"""
    current_user = get_current_user()
    if not current_user:
        return None, None
    
    if current_user.role == 'admin':
        return current_user, None  # Admin can access all ISPs
    
    if not current_user.isp_id:
        return current_user, None
    
    isp = ISP.query.get(current_user.isp_id)
    return current_user, isp


@billing_bp.route('/customers', methods=['GET'])
@jwt_required()
def get_customers():
    """Get all customers with pagination and filtering"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Build query based on user role
        if current_user.role == 'admin':
            query = Customer.query
        else:
            if not isp:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            query = Customer.query.filter_by(isp_id=isp.id)
        
        # Apply filters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        search = request.args.get('search')
        
        if status:
            query = query.filter_by(status=status)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    Customer.full_name.ilike(search_term),
                    Customer.email.ilike(search_term),
                    Customer.phone.ilike(search_term)
                )
            )
        
        # Order by created date
        query = query.order_by(Customer.created_at.desc())
        
        customers = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'ok': True,
            'message': 'Customers retrieved successfully',
            'data': {
                'customers': [{
                    'id': customer.id,
                    'full_name': customer.full_name,
                    'email': customer.email,
                    'phone': customer.phone,
                    'address': customer.address,
                    'status': customer.status.value,
                    'plan_name': customer.service_plan.name if customer.service_plan else None,
                    'plan_price': customer.service_plan.price if customer.service_plan else None,
                    'subscription_start': customer.subscription_start.isoformat() if customer.subscription_start else None,
                    'subscription_end': customer.subscription_end.isoformat() if customer.subscription_end else None,
                    'created_at': customer.created_at.isoformat() if customer.created_at else None
                } for customer in customers.items],
                'total': customers.total,
                'pages': customers.pages,
                'current_page': page,
                'per_page': per_page
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving customers: {str(e)}'
        }), 500

@billing_bp.route('/customers', methods=['POST'])
@jwt_required()
def create_customer():
    """Create a new customer with RADIUS provisioning"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin' and not isp:
            return jsonify({'error': 'User not associated with any ISP'}), 403
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['full_name', 'email', 'phone', 'service_plan_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'ok': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Check if email already exists
        existing_customer = Customer.query.filter_by(email=data['email']).first()
        if existing_customer:
            return jsonify({
                'ok': False,
                'message': 'Customer with this email already exists'
            }), 400
        
        # Get service plan
        plan = ServicePlan.query.get(data['service_plan_id'])
        if not plan:
            return jsonify({
                'ok': False,
                'message': 'Service plan not found'
            }), 404
        
        # Resolve ISP (admin may pass isp_id or use plan's ISP)
        target_isp = isp
        if not target_isp:
            target_isp = ISP.query.get(plan.isp_id) if plan.isp_id else None
        if not target_isp and current_user.role != 'admin':
            return jsonify({'ok': False, 'message': 'ISP context required'}), 400

        password = data.get('password') or secrets.token_urlsafe(8)

        customer = Customer(
            full_name=data['full_name'],
            email=data['email'].strip().lower(),
            phone=data['phone'],
            address=data.get('address'),
            package=plan.name,
            status=CustomerStatus.ACTIVE,
            service_plan_id=plan.id,
            isp_id=target_isp.id if target_isp else plan.isp_id,
            subscription_start=datetime.utcnow(),
            subscription_end=datetime.utcnow() + timedelta(days=30),
        )
        set_customer_radius_password(customer, password)

        db.session.add(customer)
        db.session.flush()

        if target_isp:
            provision_customer_radius(customer, plan, target_isp, password=password)

        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'Customer created successfully',
            'data': {
                'id': customer.id,
                'full_name': customer.full_name,
                'email': customer.email,
                'password': password,  # Return generated password
                'plan_name': plan.name,
                'status': customer.status.value
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error creating customer: {str(e)}'
        }), 500

@billing_bp.route('/customers/<int:customer_id>', methods=['PUT'])
@jwt_required()
def update_customer(customer_id):
    """Update customer information"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        customer = Customer.query.get_or_404(customer_id)
        
        # Check access
        if current_user.role != 'admin' and customer.isp_id != isp.id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Update fields
        if 'full_name' in data:
            customer.full_name = data['full_name']
        if 'phone' in data:
            customer.phone = data['phone']
        if 'address' in data:
            customer.address = data['address']
        if 'service_plan_id' in data:
            # Update service plan
            new_plan = ServicePlan.query.get(data['service_plan_id'])
            if not new_plan:
                return jsonify({
                    'ok': False,
                    'message': 'Service plan not found'
                }), 404
            
            customer.service_plan_id = new_plan.id
            
            # Update RADIUS attributes if ISP exists
            plan_isp = isp or ISP.query.get(customer.isp_id)
            if plan_isp:
                deprovision_customer_radius(customer, plan_isp)
                provision_customer_radius(customer, new_plan, plan_isp)
        
        customer.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'Customer updated successfully',
            'data': {
                'id': customer.id,
                'full_name': customer.full_name,
                'email': customer.email,
                'plan_name': customer.service_plan.name if customer.service_plan else None
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error updating customer: {str(e)}'
        }), 500

@billing_bp.route('/customers/<int:customer_id>/suspend', methods=['POST'])
@jwt_required()
def suspend_customer(customer_id):
    """Suspend customer access"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        customer = Customer.query.get_or_404(customer_id)
        
        # Check access
        if current_user.role != 'admin' and customer.isp_id != isp.id:
            return jsonify({'error': 'Access denied'}), 403
        
        if customer.status == CustomerStatus.SUSPENDED:
            return jsonify({
                'ok': False,
                'message': 'Customer is already suspended'
            }), 400
        
        suspend_customer_access(customer, isp or ISP.query.get(customer.isp_id))
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'Customer suspended successfully',
            'data': {
                'id': customer.id,
                'email': customer.email,
                'status': customer.status.value
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error suspending customer: {str(e)}'
        }), 500

@billing_bp.route('/customers/<int:customer_id>/activate', methods=['POST'])
@jwt_required()
def activate_customer(customer_id):
    """Activate customer access"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        customer = Customer.query.get_or_404(customer_id)
        
        # Check access
        if current_user.role != 'admin' and customer.isp_id != isp.id:
            return jsonify({'error': 'Access denied'}), 403
        
        if customer.status == CustomerStatus.ACTIVE:
            return jsonify({
                'ok': False,
                'message': 'Customer is already active'
            }), 400
        
        plan_isp = isp or ISP.query.get(customer.isp_id)
        if plan_isp and customer.service_plan:
            activate_customer_after_payment(customer, plan_isp)
        else:
            customer.status = CustomerStatus.ACTIVE
            customer.updated_at = datetime.utcnow()

        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'Customer activated successfully',
            'data': {
                'id': customer.id,
                'email': customer.email,
                'status': customer.status.value
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error activating customer: {str(e)}'
        }), 500

@billing_bp.route('/customers/<int:customer_id>', methods=['DELETE'])
@jwt_required()
def delete_customer(customer_id):
    """Delete customer and remove from RADIUS"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        customer = Customer.query.get_or_404(customer_id)
        
        # Check access
        if current_user.role != 'admin' and customer.isp_id != isp.id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Remove from RADIUS if ISP exists
        if isp:
            deprovision_customer_radius(customer, isp)
        elif customer.isp_id:
            deprovision_customer_radius(customer, ISP.query.get(customer.isp_id))
        
        # Delete customer
        db.session.delete(customer)
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'Customer deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error deleting customer: {str(e)}'
        }), 500

@billing_bp.route('/plans', methods=['GET'])
@jwt_required()
def get_plans():
    """Get all service plans"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Build query based on user role
        if current_user.role == 'admin':
            query = ServicePlan.query
        else:
            if not isp:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            query = ServicePlan.query.filter_by(isp_id=isp.id)
        
        plans = query.filter_by(is_active=True).all()

        return jsonify({
            'ok': True,
            'message': 'Service plans retrieved successfully',
            'data': [{
                'id': plan.id,
                'name': plan.name,
                'description': plan.description,
                'speed': plan.speed,
                'price': float(plan.price),
                **get_plan_limits(plan),
                'is_active': plan.is_active
            } for plan in plans]
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving service plans: {str(e)}'
        }), 500

@billing_bp.route('/plans', methods=['POST'])
@jwt_required()
def create_plan():
    """Create a new service plan"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin' and not isp:
            return jsonify({'error': 'User not associated with any ISP'}), 403
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'price']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'ok': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        plan = ServicePlan(
            name=data['name'],
            description=data.get('description'),
            speed=data.get('speed', data['name']),
            price=data['price'],
            features=data.get('features') or {},
            bandwidth_limit=data.get('bandwidth_limit'),
            data_limit=data.get('data_limit'),
            static_ip=data.get('static_ip'),
            session_timeout=data.get('session_timeout'),
            idle_timeout=data.get('idle_timeout'),
            isp_id=isp.id if isp else data.get('isp_id'),
            is_active=True
        )
        
        db.session.add(plan)
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'Service plan created successfully',
            'data': {
                'id': plan.id,
                'name': plan.name,
                'price': plan.price
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error creating service plan: {str(e)}'
        }), 500

@billing_bp.route('/reports/usage/<username>', methods=['GET'])
@jwt_required()
def get_usage_report(username):
    """Get usage report for a customer"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Find customer
        customer = Customer.query.filter_by(email=username).first()
        if not customer:
            return jsonify({
                'ok': False,
                'message': 'Customer not found'
            }), 404
        
        # Check access
        if current_user.role != 'admin' and customer.isp_id != isp.id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get date range
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        # Build query for radacct
        query = RadAcct.query.filter_by(username=username)
        
        if start_date:
            query = query.filter(RadAcct.acctstarttime >= start_date)
        if end_date:
            query = query.filter(RadAcct.acctstarttime <= end_date)
        
        # Get accounting records
        records = query.order_by(RadAcct.acctstarttime.desc()).limit(100).all()
        
        # Calculate totals
        total_sessions = len(records)
        total_time = sum(record.acctsessiontime or 0 for record in records)
        total_bytes_in = sum(record.acctinputoctets or 0 for record in records)
        total_bytes_out = sum(record.acctoutputoctets or 0 for record in records)
        
        return jsonify({
            'ok': True,
            'message': 'Usage report retrieved successfully',
            'data': {
                'customer': {
                    'id': customer.id,
                    'full_name': customer.full_name,
                    'email': customer.email,
                    'plan_name': customer.service_plan.name if customer.service_plan else None
                },
                'usage_summary': {
                    'total_sessions': total_sessions,
                    'total_time_hours': round(total_time / 3600, 2),
                    'total_data_gb': round((total_bytes_in + total_bytes_out) / (1024**3), 2),
                    'total_bytes_in': total_bytes_in,
                    'total_bytes_out': total_bytes_out
                },
                'sessions': [{
                    'session_id': record.acctsessionid,
                    'start_time': record.acctstarttime.isoformat() if record.acctstarttime else None,
                    'stop_time': record.acctstoptime.isoformat() if record.acctstoptime else None,
                    'duration_seconds': record.acctsessiontime or 0,
                    'bytes_in': record.acctinputoctets or 0,
                    'bytes_out': record.acctoutputoctets or 0,
                    'ip_address': record.framedipaddress,
                    'nas_ip': record.nasipaddress
                } for record in records]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving usage report: {str(e)}'
        }), 500

@billing_bp.route('/radius/status', methods=['GET'])
@jwt_required()
def get_radius_status():
    """Get RADIUS status and configuration"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin' and not isp:
            return jsonify({'error': 'User not associated with any ISP'}), 403
        
        # Get RADIUS statistics
        if current_user.role == 'admin':
            total_users = RadCheck.query.filter_by(is_active=True).count()
            total_sessions = RadAcct.query.count()
            active_sessions = RadAcct.query.filter(
                RadAcct.acctstoptime.is_(None)
            ).count()
        else:
            total_users = RadCheck.query.filter_by(
                isp_id=isp.id, 
                is_active=True
            ).count()
            total_sessions = RadAcct.query.filter_by(isp_id=isp.id).count()
            active_sessions = RadAcct.query.filter(
                RadAcct.isp_id == isp.id,
                RadAcct.acctstoptime.is_(None)
            ).count()
        
        return jsonify({
            'ok': True,
            'message': 'RADIUS status retrieved successfully',
            'data': {
                'auth_mode': 'freeradius_postgresql',
                'fallback_api': '/api/radius-api/auth',
                'total_users': total_users,
                'total_sessions': total_sessions,
                'active_sessions': active_sessions,
                'isp_name': isp.name if isp else 'All ISPs',
                'radius_secret_configured': bool(isp.radius_secret if isp else False)
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving RADIUS status: {str(e)}'
        }), 500


def _format_payment_method(method):
    labels = {
        'credit_card': 'Credit Card',
        'bank_transfer': 'Bank Transfer',
        'paypal': 'PayPal',
        'mpesa': 'M-Pesa',
        'cash': 'Cash',
        'mobile_money': 'Mobile Money',
    }
    if not method:
        return 'Unknown'
    return labels.get(str(method).lower(), str(method).replace('_', ' ').title())


def _serialize_payment(payment):
    return {
        'id': payment.id,
        'customerName': payment.customer.full_name if payment.customer else 'Unknown',
        'customerId': payment.customer_id,
        'reference': payment.transaction_id or f'PAY-{payment.id:05d}',
        'amount': float(payment.amount),
        'method': payment.payment_method,
        'methodLabel': _format_payment_method(payment.payment_method),
        'status': payment.payment_status.value if payment.payment_status else 'pending',
        'date': payment.payment_date.isoformat() if payment.payment_date else None,
        'invoiceId': payment.invoice_id,
        'invoiceNumber': payment.invoice.invoice_number if payment.invoice else None,
    }


def _serialize_voucher(voucher):
    return {
        'id': voucher.id,
        'code': voucher.voucher_code,
        'type': voucher.voucher_type,
        'value': float(voucher.voucher_value),
        'status': voucher.voucher_status.value if voucher.voucher_status else 'active',
        'usedBy': voucher.used_by,
        'usedAt': voucher.used_at.isoformat() if voucher.used_at else None,
        'expiresAt': voucher.expiry_date.isoformat() if voucher.expiry_date else None,
        'maxUses': voucher.max_usage,
        'usedCount': voucher.usage_count,
        'isActive': voucher.is_active,
    }


def _serialize_transaction(transaction):
    payment = transaction.payment
    status = payment.payment_status.value if payment and payment.payment_status else 'completed'
    method = payment.payment_method if payment else transaction.transaction_type
    return {
        'id': transaction.id,
        'reference': transaction.transaction_number,
        'type': transaction.transaction_type,
        'typeLabel': transaction.transaction_type.replace('_', ' ').title(),
        'amount': float(transaction.transaction_amount),
        'customerName': transaction.customer.full_name if transaction.customer else 'Unknown',
        'customerId': transaction.customer_id,
        'method': method,
        'methodLabel': _format_payment_method(method),
        'status': status,
        'date': transaction.created_at.isoformat() if transaction.created_at else None,
        'paymentId': transaction.payment_id,
    }


def _serialize_subscription(customer):
    plan = customer.service_plan
    monthly = float(plan.price) if plan and plan.price else 0.0
    return {
        'id': customer.id,
        'customerName': customer.full_name,
        'customerEmail': customer.email,
        'customerPhone': customer.phone,
        'planName': plan.name if plan else customer.package,
        'planSpeed': plan.speed if plan else None,
        'monthlyAmount': monthly,
        'status': customer.status.value if customer.status else 'active',
        'startDate': customer.join_date.isoformat() if customer.join_date else None,
        'lastPaymentDate': customer.last_payment_date.isoformat() if customer.last_payment_date else None,
        'usagePercentage': customer.usage_percentage or 0,
        'balance': float(customer.balance) if customer.balance else 0.0,
    }


@billing_bp.route('/subscriptions', methods=['GET'])
@jwt_required()
def list_subscriptions():
    try:
        from models import Customer, CustomerStatus
        current_user, _ = get_current_user_isp()
        if not current_user:
            return jsonify({'ok': False, 'message': 'Unauthorized'}), 401
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        search = request.args.get('search')

        query = Customer.query.filter(Customer.service_plan_id.isnot(None))
        if current_user.role != 'admin':
            _, isp = get_current_user_isp()
            if not isp:
                return jsonify({'ok': False, 'message': 'User not associated with any ISP'}), 403
            query = query.filter_by(isp_id=isp.id)

        if status and status != 'all':
            try:
                query = query.filter(Customer.status == CustomerStatus(status.lower()))
            except ValueError:
                return jsonify({'ok': False, 'message': 'Invalid status'}), 400

        if search:
            term = f'%{search}%'
            query = query.filter(
                db.or_(
                    Customer.full_name.ilike(term),
                    Customer.email.ilike(term),
                    Customer.package.ilike(term),
                )
            )

        results = query.order_by(Customer.full_name.asc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        subscriptions = [_serialize_subscription(c) for c in results.items]
        active = sum(1 for s in subscriptions if s['status'] == 'active')
        mrr = sum(s['monthlyAmount'] for s in subscriptions if s['status'] == 'active')

        return jsonify({
            'ok': True,
            'subscriptions': subscriptions,
            'total': results.total,
            'pages': results.pages,
            'current_page': page,
            'stats': {
                'active_subscriptions': active,
                'monthly_recurring_revenue': mrr,
                'total_subscriptions': results.total,
            },
        }), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 500


@billing_bp.route('/payments', methods=['GET'])
@jwt_required()
def list_payments():
    try:
        from models import Payment, PaymentStatus, Customer
        current_user, _ = get_current_user_isp()
        if not current_user:
            return jsonify({'ok': False, 'message': 'Unauthorized'}), 401
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')

        query = Payment.query.join(Customer)
        if current_user.role != 'admin':
            _, isp = get_current_user_isp()
            if not isp:
                return jsonify({'ok': False, 'message': 'User not associated with any ISP'}), 403
            query = query.filter(Customer.isp_id == isp.id)

        if status and status != 'all':
            try:
                query = query.filter(Payment.payment_status == PaymentStatus(status))
            except ValueError:
                return jsonify({'ok': False, 'message': 'Invalid status'}), 400

        payments = query.order_by(Payment.payment_date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return jsonify({
            'ok': True,
            'payments': [_serialize_payment(p) for p in payments.items],
            'total': payments.total,
            'pages': payments.pages,
            'current_page': page,
        }), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 500


@billing_bp.route('/payments/<int:payment_id>', methods=['GET'])
@jwt_required()
def get_payment(payment_id):
    try:
        from models import Payment
        payment = Payment.query.get_or_404(payment_id)
        return jsonify({'ok': True, 'data': _serialize_payment(payment)}), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 500


@billing_bp.route('/transactions', methods=['GET'])
@jwt_required()
def list_transactions():
    try:
        from models import Transaction
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        query = Transaction.query.order_by(Transaction.created_at.desc())
        transactions = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'ok': True,
            'transactions': [_serialize_transaction(t) for t in transactions.items],
            'total': transactions.total,
            'pages': transactions.pages,
            'current_page': page,
        }), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 500


@billing_bp.route('/transactions/<int:transaction_id>', methods=['GET'])
@jwt_required()
def get_transaction(transaction_id):
    try:
        from models import Transaction
        transaction = Transaction.query.get_or_404(transaction_id)
        return jsonify({'ok': True, 'data': _serialize_transaction(transaction)}), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 500


@billing_bp.route('/vouchers', methods=['GET'])
@jwt_required()
def list_vouchers():
    try:
        from models import Voucher, VoucherStatus
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')

        query = Voucher.query

        if status and status != 'all':
            try:
                query = query.filter(Voucher.voucher_status == VoucherStatus(status))
            except ValueError:
                return jsonify({'ok': False, 'message': 'Invalid status'}), 400

        vouchers = query.order_by(Voucher.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return jsonify({
            'ok': True,
            'vouchers': [_serialize_voucher(v) for v in vouchers.items],
            'total': vouchers.total,
            'pages': vouchers.pages,
            'current_page': page,
        }), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 500


@billing_bp.route('/vouchers/<int:voucher_id>', methods=['GET'])
@jwt_required()
def get_voucher(voucher_id):
    try:
        from models import Voucher
        voucher = Voucher.query.get_or_404(voucher_id)
        return jsonify({'ok': True, 'data': _serialize_voucher(voucher)}), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 500
