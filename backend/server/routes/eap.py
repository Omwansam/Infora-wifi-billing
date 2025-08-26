from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import EapProfile
from extensions import db
import os
from datetime import datetime

eap_bp = Blueprint('eap', __name__, url_prefix='/api/eap')

@eap_bp.route('/profiles', methods=['GET'])
@jwt_required()
def get_eap_profiles():
    """Get all EAP profiles"""
    try:
        profiles = EapProfile.query.filter_by(is_active=True).all()
        return jsonify({
            'ok': True,
            'message': 'EAP profiles retrieved successfully',
            'data': [{
                'id': profile.id,
                'name': profile.name,
                'eap_method': profile.eap_method,
                'phase2_method': profile.phase2_method,
                'inner_identity': profile.inner_identity,
                'outer_identity': profile.outer_identity,
                'ca_cert_path': profile.ca_cert_path,
                'server_cert_path': profile.server_cert_path,
                'server_key_path': profile.server_key_path,
                'client_cert_path': profile.client_cert_path,
                'client_key_path': profile.client_key_path,
                'notes': profile.notes,
                'is_active': profile.is_active,
                'created_at': profile.created_at.isoformat() if profile.created_at else None
            } for profile in profiles]
        }), 200
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving EAP profiles: {str(e)}'
        }), 500

@eap_bp.route('/profiles', methods=['POST'])
@jwt_required()
def create_eap_profile():
    """Create a new EAP profile"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'eap_method']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'ok': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Validate EAP method
        valid_eap_methods = ['EAP-TLS', 'PEAP', 'EAP-TTLS', 'EAP-FAST', 'EAP-MD5', 'EAP-MSCHAPv2']
        if data['eap_method'] not in valid_eap_methods:
            return jsonify({
                'ok': False,
                'message': f'Invalid EAP method. Valid methods are: {", ".join(valid_eap_methods)}'
            }), 400
        
        # Create new EAP profile
        profile = EapProfile(
            name=data['name'],
            eap_method=data['eap_method'],
            ca_cert_path=data.get('ca_cert_path'),
            server_cert_path=data.get('server_cert_path'),
            server_key_path=data.get('server_key_path'),
            client_cert_path=data.get('client_cert_path'),
            client_key_path=data.get('client_key_path'),
            phase2_method=data.get('phase2_method'),
            inner_identity=data.get('inner_identity'),
            outer_identity=data.get('outer_identity'),
            config_blob=data.get('config_blob'),
            notes=data.get('notes')
        )
        
        db.session.add(profile)
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'EAP profile created successfully',
            'data': {
                'id': profile.id,
                'name': profile.name,
                'eap_method': profile.eap_method
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error creating EAP profile: {str(e)}'
        }), 500

@eap_bp.route('/profiles/<int:profile_id>', methods=['PUT'])
@jwt_required()
def update_eap_profile(profile_id):
    """Update an existing EAP profile"""
    try:
        profile = EapProfile.query.get_or_404(profile_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            profile.name = data['name']
        if 'eap_method' in data:
            # Validate EAP method
            valid_eap_methods = ['EAP-TLS', 'PEAP', 'EAP-TTLS', 'EAP-FAST', 'EAP-MD5', 'EAP-MSCHAPv2']
            if data['eap_method'] not in valid_eap_methods:
                return jsonify({
                    'ok': False,
                    'message': f'Invalid EAP method. Valid methods are: {", ".join(valid_eap_methods)}'
                }), 400
            profile.eap_method = data['eap_method']
        if 'ca_cert_path' in data:
            profile.ca_cert_path = data['ca_cert_path']
        if 'server_cert_path' in data:
            profile.server_cert_path = data['server_cert_path']
        if 'server_key_path' in data:
            profile.server_key_path = data['server_key_path']
        if 'client_cert_path' in data:
            profile.client_cert_path = data['client_cert_path']
        if 'client_key_path' in data:
            profile.client_key_path = data['client_key_path']
        if 'phase2_method' in data:
            profile.phase2_method = data['phase2_method']
        if 'inner_identity' in data:
            profile.inner_identity = data['inner_identity']
        if 'outer_identity' in data:
            profile.outer_identity = data['outer_identity']
        if 'config_blob' in data:
            profile.config_blob = data['config_blob']
        if 'notes' in data:
            profile.notes = data['notes']
        if 'is_active' in data:
            profile.is_active = data['is_active']
        
        profile.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'EAP profile updated successfully',
            'data': {
                'id': profile.id,
                'name': profile.name,
                'eap_method': profile.eap_method
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error updating EAP profile: {str(e)}'
        }), 500

@eap_bp.route('/profiles/<int:profile_id>', methods=['DELETE'])
@jwt_required()
def delete_eap_profile(profile_id):
    """Delete an EAP profile"""
    try:
        profile = EapProfile.query.get_or_404(profile_id)
        profile.is_active = False
        profile.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'EAP profile deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error deleting EAP profile: {str(e)}'
        }), 500

@eap_bp.route('/profiles/<int:profile_id>', methods=['GET'])
@jwt_required()
def get_eap_profile(profile_id):
    """Get a specific EAP profile"""
    try:
        profile = EapProfile.query.get_or_404(profile_id)
        
        return jsonify({
            'ok': True,
            'message': 'EAP profile retrieved successfully',
            'data': {
                'id': profile.id,
                'name': profile.name,
                'eap_method': profile.eap_method,
                'phase2_method': profile.phase2_method,
                'inner_identity': profile.inner_identity,
                'outer_identity': profile.outer_identity,
                'ca_cert_path': profile.ca_cert_path,
                'server_cert_path': profile.server_cert_path,
                'server_key_path': profile.server_key_path,
                'client_cert_path': profile.client_cert_path,
                'client_key_path': profile.client_key_path,
                'config_blob': profile.config_blob,
                'notes': profile.notes,
                'is_active': profile.is_active,
                'created_at': profile.created_at.isoformat() if profile.created_at else None,
                'updated_at': profile.updated_at.isoformat() if profile.updated_at else None
            }
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving EAP profile: {str(e)}'
        }), 500

@eap_bp.route('/methods', methods=['GET'])
@jwt_required()
def get_eap_methods():
    """Get available EAP methods"""
    try:
        methods = [
            {
                'name': 'EAP-TLS',
                'description': 'Transport Layer Security - Certificate-based authentication',
                'phase2_support': False,
                'certificate_required': True
            },
            {
                'name': 'PEAP',
                'description': 'Protected EAP - Microsoft implementation with TLS tunnel',
                'phase2_support': True,
                'certificate_required': True
            },
            {
                'name': 'EAP-TTLS',
                'description': 'Tunneled Transport Layer Security - Flexible inner authentication',
                'phase2_support': True,
                'certificate_required': True
            },
            {
                'name': 'EAP-FAST',
                'description': 'Flexible Authentication via Secure Tunneling - Cisco implementation',
                'phase2_support': True,
                'certificate_required': False
            },
            {
                'name': 'EAP-MD5',
                'description': 'Message Digest 5 - Simple password authentication',
                'phase2_support': False,
                'certificate_required': False
            },
            {
                'name': 'EAP-MSCHAPv2',
                'description': 'Microsoft Challenge Handshake Authentication Protocol v2',
                'phase2_support': False,
                'certificate_required': False
            }
        ]
        
        return jsonify({
            'ok': True,
            'message': 'EAP methods retrieved successfully',
            'data': methods
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving EAP methods: {str(e)}'
        }), 500

@eap_bp.route('/phase2-methods', methods=['GET'])
@jwt_required()
def get_phase2_methods():
    """Get available Phase 2 authentication methods"""
    try:
        methods = [
            {
                'name': 'MSCHAPv2',
                'description': 'Microsoft Challenge Handshake Authentication Protocol v2',
                'eap_methods': ['PEAP', 'EAP-TTLS']
            },
            {
                'name': 'PAP',
                'description': 'Password Authentication Protocol',
                'eap_methods': ['EAP-TTLS']
            },
            {
                'name': 'CHAP',
                'description': 'Challenge Handshake Authentication Protocol',
                'eap_methods': ['EAP-TTLS']
            },
            {
                'name': 'MSCHAP',
                'description': 'Microsoft Challenge Handshake Authentication Protocol',
                'eap_methods': ['EAP-TTLS']
            },
            {
                'name': 'GTC',
                'description': 'Generic Token Card',
                'eap_methods': ['EAP-TTLS']
            }
        ]
        
        return jsonify({
            'ok': True,
            'message': 'Phase 2 methods retrieved successfully',
            'data': methods
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving Phase 2 methods: {str(e)}'
        }), 500

@eap_bp.route('/profiles/<int:profile_id>/config', methods=['GET'])
@jwt_required()
def get_eap_config(profile_id):
    """Get EAP configuration for a profile"""
    try:
        profile = EapProfile.query.get_or_404(profile_id)
        
        # Generate configuration based on EAP method
        config = {
            'profile_name': profile.name,
            'eap_method': profile.eap_method,
            'phase2_method': profile.phase2_method,
            'inner_identity': profile.inner_identity,
            'outer_identity': profile.outer_identity,
            'certificates': {
                'ca_cert': profile.ca_cert_path,
                'server_cert': profile.server_cert_path,
                'server_key': profile.server_key_path,
                'client_cert': profile.client_cert_path,
                'client_key': profile.client_key_path
            }
        }
        
        # Add method-specific configuration
        if profile.eap_method == 'EAP-TLS':
            config['tls_config'] = {
                'ca_certificate': profile.ca_cert_path,
                'client_certificate': profile.client_cert_path,
                'client_private_key': profile.client_key_path,
                'private_key_passwd': None  # Would be set separately for security
            }
        elif profile.eap_method in ['PEAP', 'EAP-TTLS']:
            config['tunnel_config'] = {
                'ca_certificate': profile.ca_cert_path,
                'server_certificate': profile.server_cert_path,
                'server_private_key': profile.server_key_path,
                'private_key_passwd': None
            }
            if profile.phase2_method:
                config['phase2_config'] = {
                    'method': profile.phase2_method,
                    'identity': profile.inner_identity
                }
        
        return jsonify({
            'ok': True,
            'message': 'EAP configuration retrieved successfully',
            'data': config
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving EAP configuration: {str(e)}'
        }), 500
