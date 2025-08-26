from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import ISP, User, MikrotikDevice, Customer, Invoice, ServicePlan
from datetime import datetime, timedelta

isps_bp = Blueprint('isps', __name__, url_prefix='/api/isps')

def serialize_isp(isp):
    """Serialize ISP object to dictionary"""
    try:
        return {
            'id': isp.id,
            'name': isp.name,
            'company_name': isp.company_name,
            'email': isp.email,
            'phone': isp.phone,
            'address': isp.address,
            'website': isp.website,
            'logo_url': isp.logo_url,
            'is_active': isp.is_active,
            'subscription_plan': isp.subscription_plan,
            'max_devices': isp.max_devices,
            'max_customers': isp.max_customers,
            'api_key': isp.api_key,
            'radius_secret': '***' if isp.radius_secret else None,
            'created_at': isp.created_at.isoformat() if isp.created_at else None,
            'updated_at': isp.updated_at.isoformat() if isp.updated_at else None,
            'stats': {
                'device_count': len(isp.mikrotik_devices),
                'customer_count': len(isp.customers),
                'active_devices': len([d for d in isp.mikrotik_devices if d.is_active]),
                'online_devices': len([d for d in isp.mikrotik_devices if d.device_status.value == 'online']),
                'total_revenue': sum([inv.amount for inv in isp.invoices if inv.status.value == 'paid'])
            }
        }
    except Exception as e:
        print(f"Error serializing ISP {isp.id}: {e}")
        return {
            'id': isp.id,
            'name': isp.name,
            'company_name': isp.company_name,
            'email': isp.email,
            'is_active': isp.is_active
        }

# Add explicit OPTIONS handlers for CORS
@isps_bp.route('/', methods=['OPTIONS'])
def handle_isps_options():
    return '', 200

@isps_bp.route('/<int:isp_id>', methods=['OPTIONS'])
def handle_isp_options(isp_id):
    return '', 200

@isps_bp.route('/stats', methods=['OPTIONS'])
def handle_stats_options():
    return '', 200

@isps_bp.route('/', methods=['GET'])
@jwt_required()
def get_isps():
    """Get all ISPs (admin only)"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search')
        
        query = ISP.query
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    ISP.name.ilike(search_term),
                    ISP.company_name.ilike(search_term),
                    ISP.email.ilike(search_term)
                )
            )
        
        query = query.order_by(ISP.created_at.desc())
        isps = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'isps': [serialize_isp(isp) for isp in isps.items],
            'total': isps.total,
            'pages': isps.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get ISPs: {str(e)}'}), 500

@isps_bp.route('/<int:isp_id>', methods=['GET'])
@jwt_required()
def get_isp(isp_id):
    """Get specific ISP"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        isp = ISP.query.get_or_404(isp_id)
        
        if current_user.role != 'admin' and current_user.isp_id != isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify(serialize_isp(isp)), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get ISP: {str(e)}'}), 500

@isps_bp.route('/', methods=['POST'])
@jwt_required()
def create_isp():
    """Create a new ISP (admin only)"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        required_fields = ['name', 'company_name', 'email']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        if ISP.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'ISP with this email already exists'}), 400
        
        isp = ISP(
            name=data['name'],
            company_name=data['company_name'],
            email=data['email'],
            phone=data.get('phone'),
            address=data.get('address'),
            website=data.get('website'),
            logo_url=data.get('logo_url'),
            subscription_plan=data.get('subscription_plan', 'basic'),
            max_devices=data.get('max_devices', 10),
            max_customers=data.get('max_customers', 100),
            is_active=data.get('is_active', True)
        )
        
        isp.generate_api_key()
        isp.generate_radius_secret()
        
        db.session.add(isp)
        db.session.commit()
        
        return jsonify({
            'message': 'ISP created successfully',
            'isp': serialize_isp(isp)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create ISP: {str(e)}'}), 500

@isps_bp.route('/<int:isp_id>', methods=['PUT'])
@jwt_required()
def update_isp(isp_id):
    """Update ISP"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        isp = ISP.query.get_or_404(isp_id)
        
        # Check access: admin or ISP user
        if current_user.role != 'admin' and current_user.isp_id != isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            isp.name = data['name']
        if 'company_name' in data:
            isp.company_name = data['company_name']
        if 'email' in data:
            # Check if email is already taken by another ISP
            existing_isp = ISP.query.filter_by(email=data['email']).first()
            if existing_isp and existing_isp.id != isp_id:
                return jsonify({'error': 'Email already in use by another ISP'}), 400
            isp.email = data['email']
        if 'phone' in data:
            isp.phone = data['phone']
        if 'address' in data:
            isp.address = data['address']
        if 'website' in data:
            isp.website = data['website']
        if 'logo_url' in data:
            isp.logo_url = data['logo_url']
        if 'subscription_plan' in data:
            isp.subscription_plan = data['subscription_plan']
        if 'max_devices' in data:
            isp.max_devices = data['max_devices']
        if 'max_customers' in data:
            isp.max_customers = data['max_customers']
        if 'is_active' in data:
            isp.is_active = data['is_active']
        
        db.session.commit()
        
        return jsonify({
            'message': 'ISP updated successfully',
            'isp': serialize_isp(isp)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update ISP: {str(e)}'}), 500

@isps_bp.route('/<int:isp_id>', methods=['DELETE'])
@jwt_required()
def delete_isp(isp_id):
    """Delete ISP (admin only)"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Only admins can delete ISPs
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        isp = ISP.query.get_or_404(isp_id)
        
        # Check if ISP has any data
        device_count = len(isp.mikrotik_devices)
        customer_count = len(isp.customers)
        
        if device_count > 0 or customer_count > 0:
            return jsonify({
                'error': f'Cannot delete ISP with existing data ({device_count} devices, {customer_count} customers)'
            }), 400
        
        db.session.delete(isp)
        db.session.commit()
        
        return jsonify({'message': 'ISP deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete ISP: {str(e)}'}), 500

@isps_bp.route('/<int:isp_id>/regenerate-api-key', methods=['POST'])
@jwt_required()
def regenerate_api_key(isp_id):
    """Regenerate ISP API key"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        isp = ISP.query.get_or_404(isp_id)
        
        # Check access: admin or ISP user
        if current_user.role != 'admin' and current_user.isp_id != isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Regenerate API key
        isp.generate_api_key()
        db.session.commit()
        
        return jsonify({
            'message': 'API key regenerated successfully',
            'api_key': isp.api_key
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to regenerate API key: {str(e)}'}), 500

@isps_bp.route('/<int:isp_id>/regenerate-radius-secret', methods=['POST'])
@jwt_required()
def regenerate_radius_secret(isp_id):
    """Regenerate ISP RADIUS secret"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        isp = ISP.query.get_or_404(isp_id)
        
        # Check access: admin or ISP user
        if current_user.role != 'admin' and current_user.isp_id != isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Regenerate RADIUS secret
        isp.generate_radius_secret()
        db.session.commit()
        
        return jsonify({
            'message': 'RADIUS secret regenerated successfully',
            'radius_secret': isp.radius_secret
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to regenerate RADIUS secret: {str(e)}'}), 500

@isps_bp.route('/<int:isp_id>/stats', methods=['GET'])
@jwt_required()
def get_isp_stats(isp_id):
    """Get ISP statistics"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        isp = ISP.query.get_or_404(isp_id)
        
        # Check access: admin or ISP user
        if current_user.role != 'admin' and current_user.isp_id != isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        total_devices = len(isp.mikrotik_devices)
        active_devices = len([d for d in isp.mikrotik_devices if d.is_active])
        online_devices = len([d for d in isp.mikrotik_devices if d.device_status.value == 'online'])
        total_customers = len(isp.customers)
        active_customers = len([c for c in isp.customers if c.status.value == 'active'])
        total_revenue = sum([i.amount for i in isp.invoices if i.status.value == 'paid'])
        
        return jsonify({
            'isp': {
                'id': isp.id,
                'name': isp.name,
                'company_name': isp.company_name,
                'subscription_plan': isp.subscription_plan,
                'max_devices': isp.max_devices,
                'max_customers': isp.max_customers
            },
            'stats': {
                'total_devices': total_devices,
                'active_devices': active_devices,
                'online_devices': online_devices,
                'device_utilization': (total_devices / isp.max_devices * 100) if isp.max_devices > 0 else 0,
                'total_customers': total_customers,
                'active_customers': active_customers,
                'customer_utilization': (total_customers / isp.max_customers * 100) if isp.max_customers > 0 else 0,
                'total_revenue': total_revenue
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get ISP stats: {str(e)}'}), 500

@isps_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_all_isp_stats():
    """Get overall ISP statistics (admin only)"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Only admins can see overall stats
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        # Calculate overall statistics
        total_isps = ISP.query.count()
        active_isps = ISP.query.filter_by(is_active=True).count()
        total_devices = MikrotikDevice.query.count()
        total_customers = Customer.query.count()
        total_revenue = db.session.query(db.func.sum(Invoice.amount)).filter_by(status='paid').scalar() or 0
        
        # Subscription plan breakdown
        subscription_plans = db.session.query(
            ISP.subscription_plan,
            db.func.count(ISP.id)
        ).group_by(ISP.subscription_plan).all()
        
        plan_stats = [{'plan': plan, 'count': count} for plan, count in subscription_plans]
        
        return jsonify({
            'total_isps': total_isps,
            'active_isps': active_isps,
            'total_devices': total_devices,
            'total_customers': total_customers,
            'total_revenue': total_revenue,
            'subscription_plans': plan_stats
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get ISP stats: {str(e)}'}), 500
