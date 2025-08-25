from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required, 
    get_jwt_identity, get_jwt, verify_jwt_in_request
)
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime
from extensions import db
from models import User



auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')





@auth_bp.route('/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('password'):
            return jsonify({"error": "Email and password are required"}), 400

        email = data['email'].strip().lower()
        password = data['password']

        # Debug logging
        print(f"🔍 Login attempt for email: {email}")

        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        if not user:
            print(f"❌ User not found: {email}")
            return jsonify({"error": "Invalid email or password"}), 401
        
        print(f"✅ User found: {user.email} (ID: {user.id}, Role: {user.role}, Active: {user.is_active})")
        
        # Check if user is active
        if not user.is_active:
            print(f"❌ User is inactive: {email}")
            return jsonify({"error": "Account is deactivated. Please contact administrator."}), 401
        
        # Verify password using Werkzeug hashing
        password_matches = check_password_hash(user.password_hash, password)
        
        print(f"🔍 Password verification:")
        print(f"  Input password: {password}")
        print(f"  Stored hash (first 20 chars): {user.password_hash[:20]}...")
        print(f"  Password matches: {password_matches}")
        
        if not password_matches:
            print(f"❌ Password verification failed for: {email}")
            return jsonify({"error": "Invalid email or password"}), 401

        # Update last login
        user.last_login = datetime.now()
        db.session.commit()

        # Create JWT identity payload
        identity_payload = {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_admin": user.role == 'admin'
        }

        # Generate tokens
        access_token = create_access_token(
            identity=identity_payload,
            expires_delta=timedelta(hours=24)
        )
        refresh_token = create_refresh_token(
            identity=identity_payload,
            expires_delta=timedelta(days=30)
        )

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
        
        # Create access token
        identity_payload = {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_admin": user.role == 'admin'
        }
        
        access_token = create_access_token(
            identity=identity_payload,
            expires_delta=timedelta(hours=24)
        )
        
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
        identity = get_jwt_identity()
        user_id = identity.get('id') if isinstance(identity, dict) else identity
        
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
        identity = get_jwt_identity()
        user_id = identity.get('id') if isinstance(identity, dict) else identity
        
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
@jwt_required()
def change_password():
    """Change user password"""
    try:
        identity = get_jwt_identity()
        user_id = identity.get('id') if isinstance(identity, dict) else identity
        
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
        identity = get_jwt_identity()
        user_id = identity.get('id') if isinstance(identity, dict) else identity
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
        identity = get_jwt_identity()
        current_user_id = identity.get('id') if isinstance(identity, dict) else identity
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
        identity = get_jwt_identity()
        current_user_id = identity.get('id') if isinstance(identity, dict) else identity
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
        identity = get_jwt_identity()
        current_user_id = identity.get('id') if isinstance(identity, dict) else identity
        current_user = User.query.get(current_user_id)
        
        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        
        if current_user.id == user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
        
        user = User.query.get_or_404(user_id)
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'User deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete user: {str(e)}'}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    try:
        identity = get_jwt_identity()
        user_id = identity.get('id') if isinstance(identity, dict) else identity
        
        user = User.query.get(user_id)
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or inactive'}), 401
        
        # Create new access token
        new_identity_payload = {
            "id": user.id,
            "email": user.email,
            "role": user.role,
            "is_admin": user.role == 'admin'
        }
        
        access_token = create_access_token(
            identity=new_identity_payload,
            expires_delta=timedelta(hours=24)
        )
        
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
        identity = get_jwt_identity()
        user_id = identity.get('id') if isinstance(identity, dict) else identity
        
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
