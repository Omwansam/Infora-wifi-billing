from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    jwt_required,
    get_jwt,
    verify_jwt_in_request,
)
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
from extensions import db
from models import User
from auth_utils import create_user_tokens, get_user_id_from_jwt, get_current_user
from services.rate_limit import rate_limit
from services.system_log import record_system_log



auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')





@auth_bp.route('/login', methods=['POST'])
@rate_limit(limit=10, window=60, scope='auth-login')
def login():
    """User login endpoint"""
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('password'):
            return jsonify({"error": "Email and password are required"}), 400

        email = data['email'].strip().lower()
        password = data['password']

        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        if not user:
            return jsonify({"error": "Invalid email or password"}), 401
        
        # Check if user is active
        if not user.is_active:
            return jsonify({"error": "Account is deactivated. Please contact administrator."}), 401
        
        # Verify password using Werkzeug hashing
        if not check_password_hash(user.password_hash, password):
            record_system_log('auth', f'Failed login for {email}', 'WARNING',
                              user_id=user.id, commit=True)
            return jsonify({"error": "Invalid email or password"}), 401

        # Two-factor challenge: if enabled, require a valid TOTP or backup code.
        if user.two_factor_enabled:
            from services.two_factor import load_secret, verify_code, consume_backup_code
            otp_code = (data.get('otp_code') or '').strip()
            if not otp_code:
                return jsonify({"requires_2fa": True,
                                "message": "Two-factor verification code required"}), 200
            secret = load_secret(user)
            if not (verify_code(secret, otp_code) or consume_backup_code(user, otp_code)):
                db.session.commit()  # persist a consumed-code attempt cleanly
                record_system_log('auth', f'Failed 2FA for {email}', 'WARNING',
                                  user_id=user.id, commit=True)
                return jsonify({"error": "Invalid verification code", "requires_2fa": True}), 401

        # Update last login
        user.last_login = datetime.now()
        record_system_log('auth', f'{user.email} logged in', 'INFO', user_id=user.id)
        db.session.commit()

        access_token, refresh_token = create_user_tokens(user)

        return jsonify({
            "success": True,
            "message": "Login successful",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_admin": user.role == 'admin',
                "is_active": user.is_active,
                "last_login": user.last_login.isoformat() if user.last_login else None
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Login failed: {str(e)}"}), 500

@auth_bp.route('/register', methods=['POST'])
@rate_limit(limit=5, window=60, scope='auth-register')
def register():
    """User registration endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['first_name', 'last_name', 'email', 'password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        first_name = data['first_name'].strip()
        last_name = data['last_name'].strip()
        email = data['email'].strip().lower()
        password = data['password']
        role = data.get('role', 'support')  # Default to support role

        # Validate email format
        if '@' not in email or '.' not in email:
            return jsonify({"error": "Invalid email format"}), 400

        # Validate password strength
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters long"}), 400

        # Check if email already exists
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409

        # Hash password
        password_hash = generate_password_hash(password)

        # Create new user
        user = User(
            email=email,
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        db.session.add(user)
        db.session.commit()
        
        access_token, _refresh_token = create_user_tokens(user)
        
        return jsonify({
            'success': True,
            'message': 'Registration successful',
            'access_token': access_token,
            'user': {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_admin": user.role == 'admin',
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get current user profile"""
    try:
        user_id = get_user_id_from_jwt()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'user': {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_admin": user.role == 'admin',
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get profile: {str(e)}'}), 500

@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update current user profile"""
    try:
        user_id = get_user_id_from_jwt()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided for update'}), 400
        
        # Update allowed fields
        if 'first_name' in data:
            user.first_name = data['first_name'].strip()
        if 'last_name' in data:
            user.last_name = data['last_name'].strip()
        if 'email' in data:
            email = data['email'].strip().lower()
            # Check if email is already taken by another user
            existing_user = User.query.filter_by(email=email).first()
            if existing_user and existing_user.id != user.id:
                return jsonify({'error': 'Email already taken'}), 409
            user.email = email
        
        user.updated_at = datetime.now()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Profile updated successfully',
            'user': {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_admin": user.role == 'admin',
                "is_active": user.is_active,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update profile: {str(e)}'}), 500

@auth_bp.route('/change-password', methods=['POST'])
@rate_limit(limit=5, window=60, scope='auth-change-password')
@jwt_required()
def change_password():
    """Change user password"""
    try:
        user_id = get_user_id_from_jwt()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        current_password = data.get('current_password')
        new_password = data.get('new_password')
        
        if not current_password or not new_password:
            return jsonify({'error': 'Current password and new password are required'}), 400
        
        # Validate new password strength
        if len(new_password) < 6:
            return jsonify({'error': 'New password must be at least 6 characters long'}), 400
        
        # Verify current password
        if not check_password_hash(user.password_hash, current_password):
            return jsonify({'error': 'Current password is incorrect'}), 401
        
        # Hash and update new password
        user.password_hash = generate_password_hash(new_password, method='sha256')
        user.updated_at = datetime.now()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Password changed successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to change password: {str(e)}'}), 500

@auth_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (admin only)"""
    try:
        user_id = get_user_id_from_jwt()
        current_user = User.query.get(user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        role = request.args.get('role')
        is_active = request.args.get('is_active')
        
        query = User.query
        
        if role:
            query = query.filter_by(role=role)
        if is_active is not None:
            query = query.filter_by(is_active=is_active.lower() == 'true')
        
        users = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'success': True,
            'users': [{
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_admin": user.role == 'admin',
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None
            } for user in users.items],
            'total': users.total,
            'pages': users.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get users: {str(e)}'}), 500

@auth_bp.route('/users/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get specific user by ID (admin only)"""
    try:
        current_user_id = get_user_id_from_jwt()
        current_user = User.query.get(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        user = User.query.get_or_404(user_id)
        return jsonify({
            'success': True,
            'user': {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_admin": user.role == 'admin',
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get user: {str(e)}'}), 500

@auth_bp.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update user (admin only)"""
    try:
        current_user_id = get_user_id_from_jwt()
        current_user = User.query.get(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        user = User.query.get_or_404(user_id)
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided for update'}), 400
        
        # Update allowed fields
        if 'first_name' in data:
            user.first_name = data['first_name'].strip()
        if 'last_name' in data:
            user.last_name = data['last_name'].strip()
        if 'email' in data:
            email = data['email'].strip().lower()
            existing_user = User.query.filter_by(email=email).first()
            if existing_user and existing_user.id != user.id:
                return jsonify({'error': 'Email already taken'}), 409
            user.email = email
        if 'role' in data:
            user.role = data['role']
        if 'is_active' in data:
            user.is_active = bool(data['is_active'])

        user.updated_at = datetime.now()
        record_system_log('user', f'{current_user.email} updated user {user.email}',
                          'INFO', user_id=current_user.id)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'User updated successfully',
            'user': {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_admin": user.role == 'admin',
                "is_active": user.is_active,
                "updated_at": user.updated_at.isoformat() if user.updated_at else None
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update user: {str(e)}'}), 500

@auth_bp.route('/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Delete user (admin only)"""
    try:
        current_user_id = get_user_id_from_jwt()
        current_user = User.query.get(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        if current_user.id == user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        user = User.query.get_or_404(user_id)
        deleted_email = user.email
        db.session.delete(user)
        record_system_log('user', f'{current_user.email} deleted user {deleted_email}',
                          'WARNING', user_id=current_user.id)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'User deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete user: {str(e)}'}), 500

@auth_bp.route('/users', methods=['POST'])
@jwt_required()
def create_user():
    """Create a user (admin only)."""
    try:
        current_user = get_current_user()
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json() or {}
        for field in ('first_name', 'last_name', 'email', 'password'):
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400

        email = data['email'].strip().lower()
        if '@' not in email or '.' not in email:
            return jsonify({'error': 'Invalid email format'}), 400
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 409

        role = data.get('role', 'support')
        if role not in ('admin', 'manager', 'support'):
            return jsonify({'error': 'Invalid role'}), 400

        user = User(
            email=email,
            password_hash=generate_password_hash(data['password']),
            first_name=data['first_name'].strip(),
            last_name=data['last_name'].strip(),
            role=role,
            is_active=bool(data.get('is_active', True)),
            isp_id=data.get('isp_id', current_user.isp_id),
        )
        db.session.add(user)
        db.session.flush()
        record_system_log('user', f'{current_user.email} created user {email} ({role})',
                          'INFO', user_id=current_user.id)
        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'User created successfully',
            'user': {
                'id': user.id, 'email': user.email,
                'first_name': user.first_name, 'last_name': user.last_name,
                'role': user.role, 'is_admin': user.role == 'admin',
                'is_active': user.is_active,
                'created_at': user.created_at.isoformat() if user.created_at else None,
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create user: {str(e)}'}), 500


@auth_bp.route('/2fa/status', methods=['GET'])
@jwt_required()
def two_factor_status():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    from services.two_factor import remaining_backup_codes
    return jsonify({
        'ok': True,
        'enabled': bool(user.two_factor_enabled),
        'backup_codes_remaining': remaining_backup_codes(user) if user.two_factor_enabled else 0,
    }), 200


@auth_bp.route('/2fa/setup', methods=['POST'])
@jwt_required()
def two_factor_setup():
    """Begin enrollment: create a provisional secret, return the QR + otpauth URI."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.two_factor_enabled:
        return jsonify({'error': '2FA is already enabled. Disable it first to re-enroll.'}), 400

    from services.two_factor import generate_secret, store_secret, provisioning_uri, qr_data_uri
    secret = generate_secret()
    store_secret(user, secret)  # provisional — not enabled until verified
    db.session.commit()

    uri = provisioning_uri(secret, user.email)
    return jsonify({
        'ok': True,
        'secret': secret,
        'otpauth_uri': uri,
        'qr_code': qr_data_uri(uri),
    }), 200


@auth_bp.route('/2fa/verify', methods=['POST'])
@jwt_required()
def two_factor_verify():
    """Confirm a code against the provisional secret, enable 2FA, issue backup codes."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    from services.two_factor import load_secret, verify_code, generate_backup_codes
    secret = load_secret(user)
    if not secret:
        return jsonify({'error': 'Start 2FA setup first'}), 400

    code = (request.get_json() or {}).get('code', '')
    if not verify_code(secret, code):
        return jsonify({'error': 'Invalid verification code'}), 400

    codes, hashes = generate_backup_codes()
    user.two_factor_enabled = True
    user.two_factor_backup_codes = hashes
    record_system_log('auth', f'{user.email} enabled two-factor auth', 'INFO', user_id=user.id)
    db.session.commit()

    return jsonify({
        'ok': True,
        'message': 'Two-factor authentication enabled',
        'backup_codes': codes,  # shown once
    }), 200


@auth_bp.route('/2fa/disable', methods=['POST'])
@jwt_required()
def two_factor_disable():
    """Disable 2FA. Requires the account password to confirm."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    password = (request.get_json() or {}).get('password', '')
    if not password or not check_password_hash(user.password_hash, password):
        return jsonify({'error': 'Password confirmation required'}), 401

    user.two_factor_enabled = False
    user.two_factor_secret = None
    user.two_factor_backup_codes = None
    record_system_log('auth', f'{user.email} disabled two-factor auth', 'WARNING', user_id=user.id)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Two-factor authentication disabled'}), 200


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    try:
        user_id = get_user_id_from_jwt()
        user = User.query.get(user_id)
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or inactive'}), 401
        
        access_token, _refresh_token = create_user_tokens(user)
        
        return jsonify({
            'success': True,
            'access_token': access_token,
            'message': 'Token refreshed successfully'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Token refresh failed: {str(e)}'}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user (client should discard tokens)"""
    try:
        # In a real application, you might want to blacklist the token
        # For now, we'll just return a success message
        return jsonify({
            'success': True,
            'message': 'Logout successful'
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Logout failed: {str(e)}'}), 500

@auth_bp.route('/verify', methods=['GET'])
@jwt_required()
def verify_token():
    """Verify if the current token is valid"""
    try:
        user_id = get_user_id_from_jwt()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({
            'success': True,
            'valid': True,
            'user': {
                "id": user.id,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_admin": user.role == 'admin',
                "is_active": user.is_active
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Token verification failed: {str(e)}'}), 500
