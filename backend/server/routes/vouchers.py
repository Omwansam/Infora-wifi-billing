from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Voucher, User, ISP, Customer, VoucherStatus
from datetime import datetime, timedelta
import secrets
import string

vouchers_bp = Blueprint('vouchers', __name__, url_prefix='/api/vouchers')

def serialize_voucher(voucher):
    """Serialize voucher object to dictionary"""
    try:
        return {
            'id': voucher.id,
            'voucher_code': voucher.voucher_code,
            'voucher_type': voucher.voucher_type,
            'voucher_value': float(voucher.voucher_value),
            'voucher_status': voucher.voucher_status.value if voucher.voucher_status else None,
            'used_by': voucher.used_by,
            'used_at': voucher.used_at.isoformat() if voucher.used_at else None,
            'expiry_date': voucher.expiry_date.isoformat() if voucher.expiry_date else None,
            'usage_count': voucher.usage_count,
            'max_usage': voucher.max_usage,
            'is_active': voucher.is_active,
            'created_at': voucher.created_at.isoformat() if voucher.created_at else None,
            'updated_at': voucher.updated_at.isoformat() if voucher.updated_at else None,
            'used_by_customer': {
                'id': voucher.used_by_customer.id,
                'full_name': voucher.used_by_customer.full_name,
                'email': voucher.used_by_customer.email
            } if voucher.used_by_customer else None
        }
    except Exception as e:
        print(f"Error serializing voucher {voucher.id}: {e}")
        return {
            'id': voucher.id,
            'voucher_code': voucher.voucher_code,
            'voucher_type': voucher.voucher_type,
            'voucher_value': float(voucher.voucher_value),
            'voucher_status': voucher.voucher_status.value if voucher.voucher_status else None,
            'is_active': voucher.is_active
        }

def generate_voucher_code(length=8):
    """Generate a unique voucher code"""
    characters = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(secrets.choice(characters) for _ in range(length))
        if not Voucher.query.filter_by(voucher_code=code).first():
            return code

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
            return current_user, None  # Admin can access all vouchers
        
        if not current_user.isp_id:
            return current_user, None
        
        isp = ISP.query.get(current_user.isp_id)
        return current_user, isp
        
    except Exception as e:
        print(f"Error in get_current_user_isp: {e}")
        return None, None

# Add explicit OPTIONS handlers for CORS
@vouchers_bp.route('/', methods=['OPTIONS'])
def handle_vouchers_options():
    return '', 200

@vouchers_bp.route('/<int:voucher_id>', methods=['OPTIONS'])
def handle_voucher_options(voucher_id):
    return '', 200

@vouchers_bp.route('/validate', methods=['OPTIONS'])
def handle_validate_options():
    return '', 200

@vouchers_bp.route('/', methods=['GET'])
@jwt_required()
def get_vouchers():
    """Get all vouchers with pagination and filtering"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Build query based on user role
        if current_user.role == 'admin':
            query = Voucher.query
        else:
            if not isp:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            # For now, vouchers are global, but we can add ISP filtering later
            query = Voucher.query
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        voucher_type = request.args.get('voucher_type')
        search = request.args.get('search')
        
        # Apply filters
        if status:
            try:
                voucher_status = VoucherStatus(status)
                query = query.filter_by(voucher_status=voucher_status)
            except ValueError:
                return jsonify({'error': 'Invalid voucher status'}), 400
        
        if voucher_type:
            query = query.filter_by(voucher_type=voucher_type)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    Voucher.voucher_code.ilike(search_term),
                    Voucher.used_by.ilike(search_term)
                )
            )
        
        # Order by created date
        query = query.order_by(Voucher.created_at.desc())
        
        vouchers = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'vouchers': [serialize_voucher(voucher) for voucher in vouchers.items],
            'total': vouchers.total,
            'pages': vouchers.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get vouchers: {str(e)}'}), 500

@vouchers_bp.route('/<int:voucher_id>', methods=['GET'])
@jwt_required()
def get_voucher(voucher_id):
    """Get specific voucher by ID"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        voucher = Voucher.query.get_or_404(voucher_id)
        
        return jsonify(serialize_voucher(voucher)), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get voucher: {str(e)}'}), 500

@vouchers_bp.route('/', methods=['POST'])
@jwt_required()
def create_voucher():
    """Create a new voucher"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['voucher_type', 'voucher_value', 'expiry_date']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate voucher type
        if data['voucher_type'] not in ['percentage', 'fixed']:
            return jsonify({'error': 'Voucher type must be "percentage" or "fixed"'}), 400
        
        # Validate voucher value
        try:
            voucher_value = float(data['voucher_value'])
            if voucher_value <= 0:
                return jsonify({'error': 'Voucher value must be greater than 0'}), 400
            if data['voucher_type'] == 'percentage' and voucher_value > 100:
                return jsonify({'error': 'Percentage voucher value cannot exceed 100%'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid voucher value'}), 400
        
        # Validate expiry date
        try:
            expiry_date = datetime.fromisoformat(data['expiry_date'].replace('Z', '+00:00'))
            if expiry_date <= datetime.utcnow():
                return jsonify({'error': 'Expiry date must be in the future'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid expiry date format'}), 400
        
        # Generate voucher code
        voucher_code = data.get('voucher_code') or generate_voucher_code()
        
        # Check if voucher code already exists
        if Voucher.query.filter_by(voucher_code=voucher_code).first():
            return jsonify({'error': 'Voucher code already exists'}), 400
        
        # Create voucher
        voucher = Voucher(
            voucher_code=voucher_code,
            voucher_type=data['voucher_type'],
            voucher_value=voucher_value,
            voucher_status=VoucherStatus.ACTIVE,
            expiry_date=expiry_date,
            usage_count=0,
            max_usage=data.get('max_usage', 1),
            is_active=data.get('is_active', True)
        )
        
        db.session.add(voucher)
        db.session.commit()
        
        return jsonify({
            'message': 'Voucher created successfully',
            'voucher': serialize_voucher(voucher)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create voucher: {str(e)}'}), 500

@vouchers_bp.route('/<int:voucher_id>', methods=['PUT'])
@jwt_required()
def update_voucher(voucher_id):
    """Update voucher"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        voucher = Voucher.query.get_or_404(voucher_id)
        data = request.get_json()
        
        # Update fields
        if 'voucher_type' in data:
            if data['voucher_type'] not in ['percentage', 'fixed']:
                return jsonify({'error': 'Voucher type must be "percentage" or "fixed"'}), 400
            voucher.voucher_type = data['voucher_type']
        
        if 'voucher_value' in data:
            try:
                voucher_value = float(data['voucher_value'])
                if voucher_value <= 0:
                    return jsonify({'error': 'Voucher value must be greater than 0'}), 400
                if voucher.voucher_type == 'percentage' and voucher_value > 100:
                    return jsonify({'error': 'Percentage voucher value cannot exceed 100%'}), 400
                voucher.voucher_value = voucher_value
            except ValueError:
                return jsonify({'error': 'Invalid voucher value'}), 400
        
        if 'expiry_date' in data:
            try:
                expiry_date = datetime.fromisoformat(data['expiry_date'].replace('Z', '+00:00'))
                if expiry_date <= datetime.utcnow():
                    return jsonify({'error': 'Expiry date must be in the future'}), 400
                voucher.expiry_date = expiry_date
            except ValueError:
                return jsonify({'error': 'Invalid expiry date format'}), 400
        
        if 'max_usage' in data:
            voucher.max_usage = data['max_usage']
        
        if 'is_active' in data:
            voucher.is_active = data['is_active']
        
        if 'voucher_status' in data:
            try:
                voucher.voucher_status = VoucherStatus(data['voucher_status'])
            except ValueError:
                return jsonify({'error': 'Invalid voucher status'}), 400
        
        db.session.commit()
        
        return jsonify({
            'message': 'Voucher updated successfully',
            'voucher': serialize_voucher(voucher)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update voucher: {str(e)}'}), 500

@vouchers_bp.route('/<int:voucher_id>', methods=['DELETE'])
@jwt_required()
def delete_voucher(voucher_id):
    """Delete voucher"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        voucher = Voucher.query.get_or_404(voucher_id)
        
        db.session.delete(voucher)
        db.session.commit()
        
        return jsonify({'message': 'Voucher deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete voucher: {str(e)}'}), 500

@vouchers_bp.route('/validate', methods=['POST'])
def validate_voucher():
    """Validate a voucher code (public endpoint)"""
    try:
        data = request.get_json()
        
        if not data.get('voucher_code'):
            return jsonify({'error': 'Voucher code is required'}), 400
        
        voucher_code = data['voucher_code'].strip().upper()
        voucher = Voucher.query.filter_by(voucher_code=voucher_code).first()
        
        if not voucher:
            return jsonify({
                'valid': False,
                'message': 'Invalid voucher code'
            }), 200
        
        # Check if voucher is active
        if not voucher.is_active:
            return jsonify({
                'valid': False,
                'message': 'Voucher is inactive'
            }), 200
        
        # Check if voucher has expired
        if voucher.expiry_date <= datetime.utcnow():
            return jsonify({
                'valid': False,
                'message': 'Voucher has expired'
            }), 200
        
        # Check if voucher has reached max usage
        if voucher.usage_count >= voucher.max_usage:
            return jsonify({
                'valid': False,
                'message': 'Voucher usage limit reached'
            }), 200
        
        # Check voucher status
        if voucher.voucher_status != VoucherStatus.ACTIVE:
            return jsonify({
                'valid': False,
                'message': f'Voucher is {voucher.voucher_status.value}'
            }), 200
        
        return jsonify({
            'valid': True,
            'message': 'Voucher is valid',
            'voucher': {
                'id': voucher.id,
                'voucher_code': voucher.voucher_code,
                'voucher_type': voucher.voucher_type,
                'voucher_value': float(voucher.voucher_value),
                'expiry_date': voucher.expiry_date.isoformat(),
                'usage_count': voucher.usage_count,
                'max_usage': voucher.max_usage
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to validate voucher: {str(e)}'}), 500

@vouchers_bp.route('/<int:voucher_id>/use', methods=['POST'])
@jwt_required()
def use_voucher(voucher_id):
    """Use a voucher (mark as used)"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        voucher = Voucher.query.get_or_404(voucher_id)
        
        # Check if voucher is active
        if not voucher.is_active:
            return jsonify({'error': 'Voucher is inactive'}), 400
        
        # Check if voucher has expired
        if voucher.expiry_date <= datetime.utcnow():
            return jsonify({'error': 'Voucher has expired'}), 400
        
        # Check if voucher has reached max usage
        if voucher.usage_count >= voucher.max_usage:
            return jsonify({'error': 'Voucher usage limit reached'}), 400
        
        # Check voucher status
        if voucher.voucher_status != VoucherStatus.ACTIVE:
            return jsonify({'error': f'Voucher is {voucher.voucher_status.value}'}), 400
        
        # Get customer data from request
        data = request.get_json()
        customer_email = data.get('customer_email')
        
        if customer_email:
            customer = Customer.query.filter_by(email=customer_email).first()
            if customer:
                voucher.used_by_customer_id = customer.id
        
        # Update voucher usage
        voucher.usage_count += 1
        voucher.used_by = current_user.email
        voucher.used_at = datetime.utcnow()
        
        # If single-use voucher, mark as used
        if voucher.max_usage == 1:
            voucher.voucher_status = VoucherStatus.USED
            voucher.is_active = False
        
        db.session.commit()
        
        return jsonify({
            'message': 'Voucher used successfully',
            'voucher': serialize_voucher(voucher)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to use voucher: {str(e)}'}), 500

@vouchers_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_voucher_stats():
    """Get voucher statistics"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Build query based on user role
        if current_user.role == 'admin':
            total_vouchers = Voucher.query.count()
            active_vouchers = Voucher.query.filter_by(is_active=True).count()
            expired_vouchers = Voucher.query.filter(
                Voucher.expiry_date <= datetime.utcnow()
            ).count()
            used_vouchers = Voucher.query.filter_by(voucher_status=VoucherStatus.USED).count()
        else:
            # For now, vouchers are global
            total_vouchers = Voucher.query.count()
            active_vouchers = Voucher.query.filter_by(is_active=True).count()
            expired_vouchers = Voucher.query.filter(
                Voucher.expiry_date <= datetime.utcnow()
            ).count()
            used_vouchers = Voucher.query.filter_by(voucher_status=VoucherStatus.USED).count()
        
        # Voucher type breakdown
        percentage_vouchers = Voucher.query.filter_by(voucher_type='percentage').count()
        fixed_vouchers = Voucher.query.filter_by(voucher_type='fixed').count()
        
        # Total usage
        total_usage = db.session.query(db.func.sum(Voucher.usage_count)).scalar() or 0
        
        return jsonify({
            'total_vouchers': total_vouchers,
            'active_vouchers': active_vouchers,
            'expired_vouchers': expired_vouchers,
            'used_vouchers': used_vouchers,
            'percentage_vouchers': percentage_vouchers,
            'fixed_vouchers': fixed_vouchers,
            'total_usage': total_usage
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get voucher stats: {str(e)}'}), 500

@vouchers_bp.route('/bulk-generate', methods=['POST'])
@jwt_required()
def bulk_generate_vouchers():
    """Bulk generate vouchers"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['count', 'voucher_type', 'voucher_value', 'expiry_date']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        count = data['count']
        if count <= 0 or count > 100:
            return jsonify({'error': 'Count must be between 1 and 100'}), 400
        
        # Validate voucher type and value
        if data['voucher_type'] not in ['percentage', 'fixed']:
            return jsonify({'error': 'Voucher type must be "percentage" or "fixed"'}), 400
        
        try:
            voucher_value = float(data['voucher_value'])
            if voucher_value <= 0:
                return jsonify({'error': 'Voucher value must be greater than 0'}), 400
            if data['voucher_type'] == 'percentage' and voucher_value > 100:
                return jsonify({'error': 'Percentage voucher value cannot exceed 100%'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid voucher value'}), 400
        
        # Validate expiry date
        try:
            expiry_date = datetime.fromisoformat(data['expiry_date'].replace('Z', '+00:00'))
            if expiry_date <= datetime.utcnow():
                return jsonify({'error': 'Expiry date must be in the future'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid expiry date format'}), 400
        
        generated_vouchers = []
        
        for i in range(count):
            voucher_code = generate_voucher_code()
            
            voucher = Voucher(
                voucher_code=voucher_code,
                voucher_type=data['voucher_type'],
                voucher_value=voucher_value,
                voucher_status=VoucherStatus.ACTIVE,
                expiry_date=expiry_date,
                usage_count=0,
                max_usage=data.get('max_usage', 1),
                is_active=True
            )
            
            db.session.add(voucher)
            generated_vouchers.append(voucher)
        
        db.session.commit()
        
        return jsonify({
            'message': f'{count} vouchers generated successfully',
            'vouchers': [serialize_voucher(v) for v in generated_vouchers]
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to generate vouchers: {str(e)}'}), 500
