from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import (
    User, Customer, ServicePlan, ISP, RadCheck, RadReply, RadAcct, 
    RadUserGroup, RadGroupCheck, RadGroupReply, MikrotikDevice
)
from datetime import datetime, timedelta
import hashlib
import secrets

billing_bp = Blueprint('billing', __name__, url_prefix='/api/billing')

def get_current_user_isp():
    """Get current user and their ISP context"""
    try:
        # Get JWT identity (which is a dict) and extract email
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            email = identity.get('email')
        else:
            email = identity  # Fallback for string identity
        
        current_user = User.query.filter_by(email=email).first()
        if not current_user:
            return None, None
        
        if current_user.role == 'admin':
            return current_user, None  # Admin can access all ISPs
        
        if not current_user.isp_id:
            return current_user, None
        
        isp = ISP.query.get(current_user.isp_id)
        return current_user, isp
        
    except Exception as e:
        print(f"Error in get_current_user_isp: {e}")
        return None, None

def hash_password(password):
    """Hash password for RADIUS storage"""
    return hashlib.md5(password.encode()).hexdigest()

def generate_radius_attributes(plan):
    """Generate RADIUS attributes from service plan"""
    attributes = []
    
    if plan.bandwidth_limit:
        # MikroTik rate limit (bytes per second)
        rate_limit = plan.bandwidth_limit * 1024 * 1024  # Convert MB to bytes
        attributes.append({
            'attribute': 'Mikrotik-Rate-Limit',
            'op': '=',
            'value': f'{rate_limit}/{rate_limit}'
        })
    
    if plan.data_limit:
        # Data usage limit
        data_limit_bytes = plan.data_limit * 1024 * 1024 * 1024  # Convert GB to bytes
        attributes.append({
            'attribute': 'Mikrotik-Data-Limit',
            'op': '=',
            'value': str(data_limit_bytes)
        })
    
    if plan.static_ip:
        attributes.append({
            'attribute': 'Framed-IP-Address',
            'op': '=',
            'value': plan.static_ip
        })
    
    # Session timeout
    if plan.session_timeout:
        attributes.append({
            'attribute': 'Session-Timeout',
            'op': '=',
            'value': str(plan.session_timeout * 60)  # Convert minutes to seconds
        })
    
    # Idle timeout
    if plan.idle_timeout:
        attributes.append({
            'attribute': 'Idle-Timeout',
            'op': '=',
            'value': str(plan.idle_timeout * 60)  # Convert minutes to seconds
        })
    
    return attributes

def provision_customer_radius(customer, plan, isp):
    """Provision customer in FreeRADIUS tables"""
    try:
        # Create radcheck entry for authentication
        radcheck = RadCheck(
            username=customer.email,
            attribute='Cleartext-Password',
            op='==',
            value=customer.password_hash,
            isp_id=isp.id,
            customer_id=customer.id,
            is_active=True
        )
        db.session.add(radcheck)
        
        # Create radreply entries for plan attributes
        radius_attributes = generate_radius_attributes(plan)
        for attr in radius_attributes:
            radreply = RadReply(
                username=customer.email,
                attribute=attr['attribute'],
                op=attr['op'],
                value=attr['value'],
                isp_id=isp.id,
                customer_id=customer.id,
                is_active=True
            )
            db.session.add(radreply)
        
        # Create radusergroup entry
        radusergroup = RadUserGroup(
            username=customer.email,
            groupname=f'plan_{plan.id}',
            priority=1,
            isp_id=isp.id,
            customer_id=customer.id,
            is_active=True
        )
        db.session.add(radusergroup)
        
        db.session.commit()
        return True
        
    except Exception as e:
        db.session.rollback()
        raise e

def deprovision_customer_radius(customer, isp):
    """Remove customer from FreeRADIUS tables"""
    try:
        # Deactivate all RADIUS entries for this customer
        RadCheck.query.filter_by(
            username=customer.email,
            isp_id=isp.id
        ).update({'is_active': False})
        
        RadReply.query.filter_by(
            username=customer.email,
            isp_id=isp.id
        ).update({'is_active': False})
        
        RadUserGroup.query.filter_by(
            username=customer.email,
            isp_id=isp.id
        ).update({'is_active': False})
        
        db.session.commit()
        return True
        
    except Exception as e:
        db.session.rollback()
        raise e

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
        
        # Generate password if not provided
        password = data.get('password') or secrets.token_urlsafe(8)
        password_hash = hash_password(password)
        
        # Create customer
        customer = Customer(
            full_name=data['full_name'],
            email=data['email'],
            phone=data['phone'],
            address=data.get('address'),
            password_hash=password_hash,
            status='active',
            service_plan_id=plan.id,
            isp_id=isp.id if isp else None,
            subscription_start=datetime.utcnow(),
            subscription_end=datetime.utcnow() + timedelta(days=30)  # Default 30 days
        )
        
        db.session.add(customer)
        db.session.flush()  # Get the customer ID
        
        # Provision in RADIUS
        if isp:
            provision_customer_radius(customer, plan, isp)
        
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
            if isp:
                # Remove old RADIUS entries
                deprovision_customer_radius(customer, isp)
                # Add new RADIUS entries
                provision_customer_radius(customer, new_plan, isp)
        
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
        
        if customer.status.value == 'suspended':
            return jsonify({
                'ok': False,
                'message': 'Customer is already suspended'
            }), 400
        
        # Suspend customer
        customer.status = 'suspended'
        customer.updated_at = datetime.utcnow()
        
        # Remove from RADIUS if ISP exists
        if isp:
            deprovision_customer_radius(customer, isp)
        
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
        
        if customer.status.value == 'active':
            return jsonify({
                'ok': False,
                'message': 'Customer is already active'
            }), 400
        
        # Activate customer
        customer.status = 'active'
        customer.updated_at = datetime.utcnow()
        
        # Provision in RADIUS if ISP exists
        if isp and customer.service_plan:
            provision_customer_radius(customer, customer.service_plan, isp)
        
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
                'price': plan.price,
                'bandwidth_limit': plan.bandwidth_limit,
                'data_limit': plan.data_limit,
                'static_ip': plan.static_ip,
                'session_timeout': plan.session_timeout,
                'idle_timeout': plan.idle_timeout,
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
        
        # Create plan
        plan = ServicePlan(
            name=data['name'],
            description=data.get('description'),
            price=data['price'],
            bandwidth_limit=data.get('bandwidth_limit'),
            data_limit=data.get('data_limit'),
            static_ip=data.get('static_ip'),
            session_timeout=data.get('session_timeout'),
            idle_timeout=data.get('idle_timeout'),
            isp_id=isp.id if isp else None,
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
