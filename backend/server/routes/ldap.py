from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import LDAPServer, User
from extensions import db
import os
from datetime import datetime

# Try to import ldap3, but make it optional
try:
    from ldap3 import Server, Connection, ALL, NTLM, SIMPLE, ANONYMOUS
    LDAP3_AVAILABLE = True
except ImportError:
    LDAP3_AVAILABLE = False
    print("Warning: ldap3 module not available. LDAP functionality will be limited.")

ldap_bp = Blueprint('ldap', __name__, url_prefix='/api/ldap')

@ldap_bp.route('/servers', methods=['GET'])
@jwt_required()
def get_ldap_servers():
    """Get all LDAP server configurations"""
    try:
        servers = LDAPServer.query.filter_by(is_active=True).all()
        return jsonify({
            'ok': True,
            'message': 'LDAP servers retrieved successfully',
            'data': [{
                'id': server.id,
                'name': server.name,
                'host': server.host,
                'port': server.port,
                'use_ssl': server.use_ssl,
                'use_tls': server.use_tls,
                'base_dn': server.base_dn,
                'is_active': server.is_active,
                'created_at': server.created_at.isoformat() if server.created_at else None
            } for server in servers]
        }), 200
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving LDAP servers: {str(e)}'
        }), 500

@ldap_bp.route('/servers', methods=['POST'])
@jwt_required()
def create_ldap_server():
    """Create a new LDAP server configuration"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'host', 'bind_dn', 'bind_password', 'base_dn']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'ok': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Create new LDAP server
        server = LDAPServer(
            name=data['name'],
            host=data['host'],
            port=data.get('port', 389),
            use_ssl=data.get('use_ssl', False),
            use_tls=data.get('use_tls', False),
            bind_dn=data['bind_dn'],
            bind_password=data['bind_password'],
            base_dn=data['base_dn'],
            user_search_base=data.get('user_search_base'),
            user_search_filter=data.get('user_search_filter', '(uid={})'),
            group_search_base=data.get('group_search_base'),
            group_search_filter=data.get('group_search_filter', '(member={})'),
            timeout=data.get('timeout', 10)
        )
        
        db.session.add(server)
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'LDAP server created successfully',
            'data': {
                'id': server.id,
                'name': server.name,
                'host': server.host,
                'port': server.port
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error creating LDAP server: {str(e)}'
        }), 500

@ldap_bp.route('/servers/<int:server_id>', methods=['PUT'])
@jwt_required()
def update_ldap_server(server_id):
    """Update an existing LDAP server configuration"""
    try:
        server = LDAPServer.query.get_or_404(server_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            server.name = data['name']
        if 'host' in data:
            server.host = data['host']
        if 'port' in data:
            server.port = data['port']
        if 'use_ssl' in data:
            server.use_ssl = data['use_ssl']
        if 'use_tls' in data:
            server.use_tls = data['use_tls']
        if 'bind_dn' in data:
            server.bind_dn = data['bind_dn']
        if 'bind_password' in data:
            server.bind_password = data['bind_password']
        if 'base_dn' in data:
            server.base_dn = data['base_dn']
        if 'user_search_base' in data:
            server.user_search_base = data['user_search_base']
        if 'user_search_filter' in data:
            server.user_search_filter = data['user_search_filter']
        if 'group_search_base' in data:
            server.group_search_base = data['group_search_base']
        if 'group_search_filter' in data:
            server.group_search_filter = data['group_search_filter']
        if 'timeout' in data:
            server.timeout = data['timeout']
        if 'is_active' in data:
            server.is_active = data['is_active']
        
        server.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'LDAP server updated successfully',
            'data': {
                'id': server.id,
                'name': server.name,
                'host': server.host,
                'port': server.port
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error updating LDAP server: {str(e)}'
        }), 500

@ldap_bp.route('/servers/<int:server_id>', methods=['DELETE'])
@jwt_required()
def delete_ldap_server(server_id):
    """Delete an LDAP server configuration"""
    try:
        server = LDAPServer.query.get_or_404(server_id)
        server.is_active = False
        server.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'LDAP server deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error deleting LDAP server: {str(e)}'
        }), 500

@ldap_bp.route('/auth/<int:server_id>', methods=['POST'])
def authenticate_ldap(server_id):
    """Authenticate a user against LDAP server"""
    if not LDAP3_AVAILABLE:
        return jsonify({
            'ok': False,
            'message': 'LDAP3 module not available. Please install ldap3 package.'
        }), 503
    
    try:
        server_config = LDAPServer.query.get_or_404(server_id)
        data = request.get_json()
        
        if not data or 'username' not in data or 'password' not in data:
            return jsonify({
                'ok': False,
                'message': 'Username and password are required'
            }), 400
        
        username = data['username']
        password = data['password']
        
        # Configure LDAP server
        ldap_server = Server(
            server_config.host,
            port=server_config.port,
            use_ssl=server_config.use_ssl,
            get_info=ALL
        )
        
        # Try to bind with user credentials
        try:
            # First, try to find the user DN
            bind_conn = Connection(
                ldap_server,
                user=server_config.bind_dn,
                password=server_config.bind_password,
                authentication=SIMPLE,
                auto_bind=True
            )
            
            if not bind_conn.bound:
                return jsonify({
                    'ok': False,
                    'message': 'Failed to bind to LDAP server with admin credentials'
                }), 500
            
            # Search for the user
            search_filter = server_config.user_search_filter.format(username)
            search_base = server_config.user_search_base or server_config.base_dn
            
            bind_conn.search(
                search_base=search_base,
                search_filter=search_filter,
                attributes=['dn', 'cn', 'mail', 'memberOf']
            )
            
            if not bind_conn.entries:
                return jsonify({
                    'ok': False,
                    'message': 'User not found in LDAP'
                }), 404
            
            user_dn = str(bind_conn.entries[0]['dn'])
            bind_conn.unbind()
            
            # Now try to authenticate the user
            user_conn = Connection(
                ldap_server,
                user=user_dn,
                password=password,
                authentication=SIMPLE,
                auto_bind=True
            )
            
            if user_conn.bound:
                # Get user attributes
                user_conn.search(
                    search_base=user_dn,
                    search_filter='(objectClass=*)',
                    attributes=['cn', 'mail', 'memberOf', 'uid']
                )
                
                user_attrs = {}
                if user_conn.entries:
                    entry = user_conn.entries[0]
                    user_attrs = {
                        'dn': str(entry['dn']),
                        'cn': str(entry['cn']) if 'cn' in entry else username,
                        'mail': str(entry['mail']) if 'mail' in entry else None,
                        'uid': str(entry['uid']) if 'uid' in entry else username,
                        'groups': [str(group) for group in entry['memberOf']] if 'memberOf' in entry else []
                    }
                
                user_conn.unbind()
                
                return jsonify({
                    'ok': True,
                    'message': 'LDAP authentication successful',
                    'data': {
                        'authenticated': True,
                        'user': user_attrs,
                        'server': server_config.name
                    }
                }), 200
            else:
                return jsonify({
                    'ok': False,
                    'message': 'Invalid credentials'
                }), 401
                
        except Exception as ldap_error:
            return jsonify({
                'ok': False,
                'message': f'LDAP authentication error: {str(ldap_error)}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error during LDAP authentication: {str(e)}'
        }), 500

@ldap_bp.route('/test/<int:server_id>', methods=['POST'])
@jwt_required()
def test_ldap_connection(server_id):
    """Test LDAP server connection"""
    if not LDAP3_AVAILABLE:
        return jsonify({
            'ok': False,
            'message': 'LDAP3 module not available. Please install ldap3 package.'
        }), 503
    
    try:
        server_config = LDAPServer.query.get_or_404(server_id)
        
        # Configure LDAP server
        ldap_server = Server(
            server_config.host,
            port=server_config.port,
            use_ssl=server_config.use_ssl,
            get_info=ALL
        )
        
        # Test connection
        conn = Connection(
            ldap_server,
            user=server_config.bind_dn,
            password=server_config.bind_password,
            authentication=SIMPLE,
            auto_bind=True
        )
        
        if conn.bound:
            # Test search
            conn.search(
                search_base=server_config.base_dn,
                search_filter='(objectClass=*)',
                attributes=['dn'],
                size_limit=1
            )
            
            conn.unbind()
            
            return jsonify({
                'ok': True,
                'message': 'LDAP connection test successful',
                'data': {
                    'server': server_config.name,
                    'host': server_config.host,
                    'port': server_config.port,
                    'base_dn': server_config.base_dn,
                    'connection_status': 'success'
                }
            }), 200
        else:
            return jsonify({
                'ok': False,
                'message': 'Failed to bind to LDAP server'
            }), 500
            
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'LDAP connection test failed: {str(e)}'
        }), 500
