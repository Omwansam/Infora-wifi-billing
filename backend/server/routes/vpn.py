from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import VPNConfig, VPNClient
from extensions import db
import subprocess
import os
from datetime import datetime
import secrets
import base64

# Try to import cryptography, but make it optional
try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import x25519
    from cryptography.hazmat.backends import default_backend
    CRYPTOGRAPHY_AVAILABLE = True
except ImportError:
    CRYPTOGRAPHY_AVAILABLE = False
    print("Warning: cryptography module not available. VPN functionality will be limited.")

vpn_bp = Blueprint('vpn', __name__, url_prefix='/api/vpn')

def generate_wireguard_keys():
    """Generate WireGuard private and public keys"""
    if not CRYPTOGRAPHY_AVAILABLE:
        raise Exception("Cryptography module not available. Please install cryptography package.")
    
    try:
        # Generate private key
        private_key = x25519.X25519PrivateKey.generate()
        private_key_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        private_key_b64 = base64.b64encode(private_key_bytes).decode('utf-8')
        
        # Generate public key
        public_key = private_key.public_key()
        public_key_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        public_key_b64 = base64.b64encode(public_key_bytes).decode('utf-8')
        
        return private_key_b64, public_key_b64
    except Exception as e:
        raise Exception(f"Failed to generate WireGuard keys: {str(e)}")

def generate_wireguard_config(server_config, client_name, client_public_key, client_ip):
    """Generate WireGuard client configuration"""
    try:
        config = f"""[Interface]
PrivateKey = {server_config.server_private_key}
Address = {server_config.allowed_ips}
ListenPort = {server_config.server_port}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = {client_public_key}
AllowedIPs = {client_ip}/32
"""
        return config
    except Exception as e:
        raise Exception(f"Failed to generate WireGuard config: {str(e)}")

@vpn_bp.route('/configs', methods=['GET'])
@jwt_required()
def get_vpn_configs():
    """Get all VPN configurations"""
    try:
        configs = VPNConfig.query.filter_by(is_active=True).all()
        return jsonify({
            'ok': True,
            'message': 'VPN configurations retrieved successfully',
            'data': [{
                'id': config.id,
                'name': config.name,
                'vpn_type': config.vpn_type,
                'server_endpoint': config.server_endpoint,
                'server_port': config.server_port,
                'allowed_ips': config.allowed_ips,
                'dns_servers': config.dns_servers,
                'mtu': config.mtu,
                'is_active': config.is_active,
                'created_at': config.created_at.isoformat() if config.created_at else None
            } for config in configs]
        }), 200
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving VPN configurations: {str(e)}'
        }), 500

@vpn_bp.route('/configs', methods=['POST'])
@jwt_required()
def create_vpn_config():
    """Create a new VPN configuration"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'vpn_type']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'ok': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Generate keys for WireGuard
        if data['vpn_type'] == 'wireguard':
            if not CRYPTOGRAPHY_AVAILABLE:
                return jsonify({
                    'ok': False,
                    'message': 'Cryptography module not available. Please install cryptography package.'
                }), 503
            server_private_key, server_public_key = generate_wireguard_keys()
            
            # Generate server configuration
            server_config_blob = f"""[Interface]
PrivateKey = {server_private_key}
Address = {data.get('allowed_ips', '10.0.0.1/24')}
ListenPort = {data.get('server_port', 51820)}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
"""
        else:
            server_private_key = None
            server_public_key = None
            server_config_blob = data.get('config_blob', '')
        
        # Create new VPN config
        config = VPNConfig(
            name=data['name'],
            vpn_type=data['vpn_type'],
            config_blob=server_config_blob,
            server_public_key=server_public_key,
            server_private_key=server_private_key,
            server_endpoint=data.get('server_endpoint'),
            server_port=data.get('server_port', 51820 if data['vpn_type'] == 'wireguard' else None),
            allowed_ips=data.get('allowed_ips', '10.0.0.1/24' if data['vpn_type'] == 'wireguard' else None),
            dns_servers=data.get('dns_servers', '8.8.8.8,8.8.4.4'),
            mtu=data.get('mtu', 1420)
        )
        
        db.session.add(config)
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'VPN configuration created successfully',
            'data': {
                'id': config.id,
                'name': config.name,
                'vpn_type': config.vpn_type,
                'server_public_key': config.server_public_key,
                'server_endpoint': config.server_endpoint,
                'server_port': config.server_port
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error creating VPN configuration: {str(e)}'
        }), 500

@vpn_bp.route('/configs/<int:config_id>', methods=['PUT'])
@jwt_required()
def update_vpn_config(config_id):
    """Update an existing VPN configuration"""
    try:
        config = VPNConfig.query.get_or_404(config_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            config.name = data['name']
        if 'config_blob' in data:
            config.config_blob = data['config_blob']
        if 'server_endpoint' in data:
            config.server_endpoint = data['server_endpoint']
        if 'server_port' in data:
            config.server_port = data['server_port']
        if 'allowed_ips' in data:
            config.allowed_ips = data['allowed_ips']
        if 'dns_servers' in data:
            config.dns_servers = data['dns_servers']
        if 'mtu' in data:
            config.mtu = data['mtu']
        if 'is_active' in data:
            config.is_active = data['is_active']
        
        config.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'VPN configuration updated successfully',
            'data': {
                'id': config.id,
                'name': config.name,
                'vpn_type': config.vpn_type
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error updating VPN configuration: {str(e)}'
        }), 500

@vpn_bp.route('/configs/<int:config_id>', methods=['DELETE'])
@jwt_required()
def delete_vpn_config(config_id):
    """Delete a VPN configuration"""
    try:
        config = VPNConfig.query.get_or_404(config_id)
        config.is_active = False
        config.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'VPN configuration deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error deleting VPN configuration: {str(e)}'
        }), 500

@vpn_bp.route('/clients', methods=['GET'])
@jwt_required()
def get_vpn_clients():
    """Get all VPN clients"""
    try:
        clients = VPNClient.query.filter_by(is_active=True).all()
        return jsonify({
            'ok': True,
            'message': 'VPN clients retrieved successfully',
            'data': [{
                'id': client.id,
                'name': client.name,
                'vpn_config_id': client.vpn_config_id,
                'client_ip': client.client_ip,
                'is_active': client.is_active,
                'last_connected': client.last_connected.isoformat() if client.last_connected else None,
                'created_at': client.created_at.isoformat() if client.created_at else None
            } for client in clients]
        }), 200
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving VPN clients: {str(e)}'
        }), 500

@vpn_bp.route('/clients', methods=['POST'])
@jwt_required()
def create_vpn_client():
    """Create a new VPN client"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'vpn_config_id']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'ok': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Get VPN config
        vpn_config = VPNConfig.query.get_or_404(data['vpn_config_id'])
        
        # Generate client keys for WireGuard
        if vpn_config.vpn_type == 'wireguard':
            if not CRYPTOGRAPHY_AVAILABLE:
                return jsonify({
                    'ok': False,
                    'message': 'Cryptography module not available. Please install cryptography package.'
                }), 503
            client_private_key, client_public_key = generate_wireguard_keys()
            
            # Generate client IP (simple allocation)
            client_ip = data.get('client_ip', f"10.0.0.{VPNClient.query.filter_by(vpn_config_id=vpn_config.id).count() + 2}")
            
            # Generate client configuration
            client_config_blob = f"""[Interface]
PrivateKey = {client_private_key}
Address = {client_ip}/32
DNS = {vpn_config.dns_servers or '8.8.8.8,8.8.4.4'}
MTU = {vpn_config.mtu or 1420}

[Peer]
PublicKey = {vpn_config.server_public_key}
Endpoint = {vpn_config.server_endpoint}:{vpn_config.server_port}
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
"""
        else:
            client_private_key = None
            client_public_key = None
            client_ip = None
            client_config_blob = data.get('config_blob', '')
        
        # Create new VPN client
        client = VPNClient(
            name=data['name'],
            vpn_config_id=vpn_config.id,
            client_public_key=client_public_key,
            client_private_key=client_private_key,
            client_ip=client_ip,
            config_blob=client_config_blob
        )
        
        db.session.add(client)
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'VPN client created successfully',
            'data': {
                'id': client.id,
                'name': client.name,
                'vpn_config_id': client.vpn_config_id,
                'client_ip': client.client_ip,
                'config_blob': client.config_blob
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error creating VPN client: {str(e)}'
        }), 500

@vpn_bp.route('/clients/<int:client_id>', methods=['PUT'])
@jwt_required()
def update_vpn_client(client_id):
    """Update an existing VPN client"""
    try:
        client = VPNClient.query.get_or_404(client_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            client.name = data['name']
        if 'client_ip' in data:
            client.client_ip = data['client_ip']
        if 'config_blob' in data:
            client.config_blob = data['config_blob']
        if 'is_active' in data:
            client.is_active = data['is_active']
        
        client.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'VPN client updated successfully',
            'data': {
                'id': client.id,
                'name': client.name,
                'vpn_config_id': client.vpn_config_id
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error updating VPN client: {str(e)}'
        }), 500

@vpn_bp.route('/clients/<int:client_id>', methods=['DELETE'])
@jwt_required()
def delete_vpn_client(client_id):
    """Delete a VPN client"""
    try:
        client = VPNClient.query.get_or_404(client_id)
        client.is_active = False
        client.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'VPN client deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error deleting VPN client: {str(e)}'
        }), 500

@vpn_bp.route('/generate-keys', methods=['POST'])
@jwt_required()
def generate_keys():
    """Generate WireGuard keypair"""
    try:
        data = request.get_json()
        key_type = data.get('type', 'wireguard')
        
        if key_type == 'wireguard':
            if not CRYPTOGRAPHY_AVAILABLE:
                return jsonify({
                    'ok': False,
                    'message': 'Cryptography module not available. Please install cryptography package.'
                }), 503
            private_key, public_key = generate_wireguard_keys()
            
            return jsonify({
                'ok': True,
                'message': 'WireGuard keys generated successfully',
                'data': {
                    'private_key': private_key,
                    'public_key': public_key,
                    'type': 'wireguard'
                }
            }), 200
        else:
            return jsonify({
                'ok': False,
                'message': f'Unsupported key type: {key_type}'
            }), 400
            
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error generating keys: {str(e)}'
        }), 500

@vpn_bp.route('/configs/<int:config_id>/server-config', methods=['GET'])
@jwt_required()
def get_server_config(config_id):
    """Get server configuration for a VPN config"""
    try:
        config = VPNConfig.query.get_or_404(config_id)
        
        return jsonify({
            'ok': True,
            'message': 'Server configuration retrieved successfully',
            'data': {
                'id': config.id,
                'name': config.name,
                'vpn_type': config.vpn_type,
                'config_blob': config.config_blob,
                'server_public_key': config.server_public_key,
                'server_endpoint': config.server_endpoint,
                'server_port': config.server_port,
                'allowed_ips': config.allowed_ips,
                'dns_servers': config.dns_servers,
                'mtu': config.mtu
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving server configuration: {str(e)}'
        }), 500

@vpn_bp.route('/clients/<int:client_id>/config', methods=['GET'])
@jwt_required()
def get_client_config(client_id):
    """Get client configuration"""
    try:
        client = VPNClient.query.get_or_404(client_id)
        
        return jsonify({
            'ok': True,
            'message': 'Client configuration retrieved successfully',
            'data': {
                'id': client.id,
                'name': client.name,
                'vpn_config_id': client.vpn_config_id,
                'client_ip': client.client_ip,
                'config_blob': client.config_blob
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving client configuration: {str(e)}'
        }), 500
