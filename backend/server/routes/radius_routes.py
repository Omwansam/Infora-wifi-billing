from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import User, ISP, RadiusSession
from datetime import datetime, timedelta

radius_routes_bp = Blueprint('radius_routes', __name__, url_prefix='/api/radius-routes')

def serialize_radius_session(session):
    """Serialize radius session object to dictionary"""
    try:
        return {
            'id': session.id,
            'session_id': session.session_id,
            'username': session.username,
            'ip_address': session.ip_address,
            'mac_address': session.mac_address,
            'session_start': session.session_start.isoformat() if session.session_start else None,
            'session_end': session.session_end.isoformat() if session.session_end else None,
            'bytes_in': session.bytes_in,
            'bytes_out': session.bytes_out,
            'packets_in': session.packets_in,
            'packets_out': session.packets_out,
            'is_active': session.is_active,
            'customer_id': session.customer_id,
            'customer_name': session.customer.full_name if session.customer else None,
            'device_id': session.mikrotik_device_id,
            'device_name': session.mikrotik_device.device_name if session.mikrotik_device else None,
            'isp_id': session.isp_id,
            'isp_name': session.isp.name if session.isp else None,
            'created_at': session.created_at.isoformat() if session.created_at else None,
            'updated_at': session.updated_at.isoformat() if session.updated_at else None
        }
    except Exception as e:
        print(f"Error serializing radius session {session.id}: {e}")
        return {
            'id': session.id,
            'session_id': session.session_id,
            'username': session.username,
            'is_active': session.is_active,
            'created_at': None
        }

@radius_routes_bp.route('/sessions', methods=['GET'])
@jwt_required()
def get_radius_sessions():
    """Get RADIUS sessions with pagination and filtering"""
    try:
        # Get JWT identity (which is a dict) and extract email
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            email = identity.get('email')
        else:
            email = identity  # Fallback for string identity
        
        current_user = User.query.filter_by(email=email).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Multi-tenant: Filter by ISP
        if current_user.role == 'admin':
            query = RadiusSession.query
        else:
            if not current_user.isp_id:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            query = RadiusSession.query.filter_by(isp_id=current_user.isp_id)
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')  # active, inactive
        search = request.args.get('search')
        
        # Apply filters
        if status:
            if status == 'active':
                query = query.filter_by(is_active=True)
            elif status == 'inactive':
                query = query.filter_by(is_active=False)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    RadiusSession.username.ilike(search_term),
                    RadiusSession.session_id.ilike(search_term),
                    RadiusSession.ip_address.ilike(search_term)
                )
            )
        
        # Order by created date
        query = query.order_by(RadiusSession.created_at.desc())
        
        sessions = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'ok': True,
            'message': 'RADIUS sessions retrieved successfully',
            'data': {
                'sessions': [serialize_radius_session(session) for session in sessions.items],
                'total': sessions.total,
                'pages': sessions.pages,
                'current_page': page,
                'per_page': per_page
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving RADIUS sessions: {str(e)}'
        }), 500

@radius_routes_bp.route('/sessions/<int:session_id>', methods=['GET'])
@jwt_required()
def get_radius_session(session_id):
    """Get specific RADIUS session"""
    try:
        # Get JWT identity (which is a dict) and extract email
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            email = identity.get('email')
        else:
            email = identity  # Fallback for string identity
        
        current_user = User.query.filter_by(email=email).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        session = RadiusSession.query.get_or_404(session_id)
        
        # Multi-tenant: Check access
        if current_user.role != 'admin' and session.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'ok': True,
            'message': 'RADIUS session retrieved successfully',
            'data': serialize_radius_session(session)
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving RADIUS session: {str(e)}'
        }), 500

@radius_routes_bp.route('/sessions/active', methods=['GET'])
@jwt_required()
def get_active_sessions():
    """Get active RADIUS sessions"""
    try:
        # Get JWT identity (which is a dict) and extract email
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            email = identity.get('email')
        else:
            email = identity  # Fallback for string identity
        
        current_user = User.query.filter_by(email=email).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Multi-tenant: Filter by ISP
        if current_user.role == 'admin':
            sessions = RadiusSession.query.filter_by(is_active=True).all()
        else:
            if not current_user.isp_id:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            sessions = RadiusSession.query.filter_by(isp_id=current_user.isp_id, is_active=True).all()
        
        return jsonify({
            'ok': True,
            'message': 'Active sessions retrieved successfully',
            'data': {
                'sessions': [{
                    'id': session.id,
                    'session_id': session.session_id,
                    'username': session.username,
                    'customer_name': session.customer.full_name if session.customer else None,
                    'device_name': session.mikrotik_device.device_name if session.mikrotik_device else None,
                    'session_start': session.session_start.isoformat() if session.session_start else None,
                    'duration': (datetime.utcnow() - session.session_start).total_seconds() if session.session_start else 0,
                    'bytes_in': session.bytes_in,
                    'bytes_out': session.bytes_out
                } for session in sessions]
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving active sessions: {str(e)}'
        }), 500

@radius_routes_bp.route('/sessions/terminate/<int:session_id>', methods=['POST'])
@jwt_required()
def terminate_session(session_id):
    """Terminate an active RADIUS session"""
    try:
        # Get JWT identity (which is a dict) and extract email
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            email = identity.get('email')
        else:
            email = identity  # Fallback for string identity
        
        current_user = User.query.filter_by(email=email).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        session = RadiusSession.query.get_or_404(session_id)
        
        # Multi-tenant: Check access
        if current_user.role != 'admin' and session.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        if not session.is_active:
            return jsonify({
                'ok': False,
                'message': 'Session is already inactive'
            }), 400
        
        # Terminate session
        session.session_end = datetime.utcnow()
        session.is_active = False
        
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'Session terminated successfully',
            'data': {
                'session_id': session.session_id,
                'duration': (session.session_end - session.session_start).total_seconds() if session.session_end and session.session_start else 0
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error terminating session: {str(e)}'
        }), 500

@radius_routes_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_radius_stats():
    """Get RADIUS statistics"""
    try:
        # Get JWT identity (which is a dict) and extract email
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            email = identity.get('email')
        else:
            email = identity  # Fallback for string identity
        
        current_user = User.query.filter_by(email=email).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Multi-tenant: Filter by ISP
        if current_user.role == 'admin':
            total_sessions = RadiusSession.query.count()
            active_sessions = RadiusSession.query.filter_by(is_active=True).count()
            total_bytes = db.session.query(db.func.sum(RadiusSession.bytes_in + RadiusSession.bytes_out)).scalar() or 0
        else:
            if not current_user.isp_id:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            total_sessions = RadiusSession.query.filter_by(isp_id=current_user.isp_id).count()
            active_sessions = RadiusSession.query.filter_by(isp_id=current_user.isp_id, is_active=True).count()
            total_bytes = db.session.query(
                db.func.sum(RadiusSession.bytes_in + RadiusSession.bytes_out)
            ).filter_by(isp_id=current_user.isp_id).scalar() or 0
        
        return jsonify({
            'ok': True,
            'message': 'RADIUS statistics retrieved successfully',
            'data': {
                'total_sessions': total_sessions,
                'active_sessions': active_sessions,
                'inactive_sessions': total_sessions - active_sessions,
                'total_bytes': total_bytes,
                'total_gb': round(total_bytes / (1024**3), 2)
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving RADIUS statistics: {str(e)}'
        }), 500
