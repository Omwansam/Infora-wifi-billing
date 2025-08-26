from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import SnmpDevice, SnmpPollResult
from extensions import db
import os
from datetime import datetime
import time

# Try to import pysnmp, but make it optional
try:
    from pysnmp.hlapi import *
    PYSNMP_AVAILABLE = True
except ImportError:
    PYSNMP_AVAILABLE = False
    print("Warning: pysnmp module not available. SNMP functionality will be limited.")

snmp_bp = Blueprint('snmp', __name__, url_prefix='/api/snmp')

@snmp_bp.route('/devices', methods=['GET'])
@jwt_required()
def get_snmp_devices():
    """Get all SNMP device configurations"""
    try:
        devices = SnmpDevice.query.filter_by(is_active=True).all()
        return jsonify({
            'ok': True,
            'message': 'SNMP devices retrieved successfully',
            'data': [{
                'id': device.id,
                'name': device.name,
                'host': device.host,
                'port': device.port,
                'snmp_version': device.snmp_version,
                'username': device.username,
                'auth_protocol': device.auth_protocol,
                'priv_protocol': device.priv_protocol,
                'is_active': device.is_active,
                'last_poll': device.last_poll.isoformat() if device.last_poll else None,
                'created_at': device.created_at.isoformat() if device.created_at else None
            } for device in devices]
        }), 200
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving SNMP devices: {str(e)}'
        }), 500

@snmp_bp.route('/devices', methods=['POST'])
@jwt_required()
def create_snmp_device():
    """Create a new SNMP device configuration"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'host']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'ok': False,
                    'message': f'Missing required field: {field}'
                }), 400
        
        # Create new SNMP device
        device = SnmpDevice(
            name=data['name'],
            host=data['host'],
            port=data.get('port', 161),
            snmp_version=data.get('snmp_version', '3'),
            community=data.get('community'),
            username=data.get('username'),
            auth_protocol=data.get('auth_protocol'),
            auth_key=data.get('auth_key'),
            priv_protocol=data.get('priv_protocol'),
            priv_key=data.get('priv_key'),
            context_name=data.get('context_name'),
            timeout=data.get('timeout', 3),
            retries=data.get('retries', 3)
        )
        
        db.session.add(device)
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'SNMP device created successfully',
            'data': {
                'id': device.id,
                'name': device.name,
                'host': device.host,
                'port': device.port,
                'snmp_version': device.snmp_version
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error creating SNMP device: {str(e)}'
        }), 500

@snmp_bp.route('/devices/<int:device_id>', methods=['PUT'])
@jwt_required()
def update_snmp_device(device_id):
    """Update an existing SNMP device configuration"""
    try:
        device = SnmpDevice.query.get_or_404(device_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            device.name = data['name']
        if 'host' in data:
            device.host = data['host']
        if 'port' in data:
            device.port = data['port']
        if 'snmp_version' in data:
            device.snmp_version = data['snmp_version']
        if 'community' in data:
            device.community = data['community']
        if 'username' in data:
            device.username = data['username']
        if 'auth_protocol' in data:
            device.auth_protocol = data['auth_protocol']
        if 'auth_key' in data:
            device.auth_key = data['auth_key']
        if 'priv_protocol' in data:
            device.priv_protocol = data['priv_protocol']
        if 'priv_key' in data:
            device.priv_key = data['priv_key']
        if 'context_name' in data:
            device.context_name = data['context_name']
        if 'timeout' in data:
            device.timeout = data['timeout']
        if 'retries' in data:
            device.retries = data['retries']
        if 'is_active' in data:
            device.is_active = data['is_active']
        
        device.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'SNMP device updated successfully',
            'data': {
                'id': device.id,
                'name': device.name,
                'host': device.host,
                'port': device.port
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error updating SNMP device: {str(e)}'
        }), 500

@snmp_bp.route('/devices/<int:device_id>', methods=['DELETE'])
@jwt_required()
def delete_snmp_device(device_id):
    """Delete an SNMP device configuration"""
    try:
        device = SnmpDevice.query.get_or_404(device_id)
        device.is_active = False
        device.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'ok': True,
            'message': 'SNMP device deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'ok': False,
            'message': f'Error deleting SNMP device: {str(e)}'
        }), 500

@snmp_bp.route('/get/<int:device_id>', methods=['GET'])
@jwt_required()
def get_snmp_value(device_id):
    """Get SNMP value from device by OID"""
    if not PYSNMP_AVAILABLE:
        return jsonify({
            'ok': False,
            'message': 'PySNMP module not available. Please install pysnmp package.'
        }), 503
    
    try:
        device = SnmpDevice.query.get_or_404(device_id)
        oid = request.args.get('oid')
        
        if not oid:
            return jsonify({
                'ok': False,
                'message': 'OID parameter is required'
            }), 400
        
        start_time = time.time()
        
        try:
            # Configure SNMP parameters based on version
            if device.snmp_version == '1':
                # SNMPv1
                iterator = getCmd(
                    SnmpEngine(),
                    CommunityData(device.community or 'public'),
                    UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                    ContextData(),
                    ObjectType(ObjectIdentity(oid))
                )
            elif device.snmp_version == '2c':
                # SNMPv2c
                iterator = getCmd(
                    SnmpEngine(),
                    CommunityData(device.community or 'public'),
                    UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                    ContextData(),
                    ObjectType(ObjectIdentity(oid))
                )
            else:
                # SNMPv3
                if device.auth_protocol and device.priv_protocol:
                    # authPriv
                    auth_protocol_map = {
                        'MD5': usmHMACMD5AuthProtocol,
                        'SHA': usmHMACSHA1AuthProtocol,
                        'SHA224': usmHMAC128SHA224AuthProtocol,
                        'SHA256': usmHMAC192SHA256AuthProtocol,
                        'SHA384': usmHMAC256SHA384AuthProtocol,
                        'SHA512': usmHMAC384SHA512AuthProtocol
                    }
                    
                    priv_protocol_map = {
                        'DES': usmDESPrivProtocol,
                        '3DES': usm3DESEDEPrivProtocol,
                        'AES': usmAesCfb128Protocol,
                        'AES192': usmAesCfb192Protocol,
                        'AES256': usmAesCfb256Protocol
                    }
                    
                    auth_protocol = auth_protocol_map.get(device.auth_protocol, usmHMACMD5AuthProtocol)
                    priv_protocol = priv_protocol_map.get(device.priv_protocol, usmDESPrivProtocol)
                    
                    iterator = getCmd(
                        SnmpEngine(),
                        UsmUserData(
                            device.username,
                            authKey=device.auth_key,
                            privKey=device.priv_key,
                            authProtocol=auth_protocol,
                            privProtocol=priv_protocol
                        ),
                        UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                        ContextData(device.context_name) if device.context_name else ContextData(),
                        ObjectType(ObjectIdentity(oid))
                    )
                elif device.auth_protocol:
                    # authNoPriv
                    auth_protocol_map = {
                        'MD5': usmHMACMD5AuthProtocol,
                        'SHA': usmHMACSHA1AuthProtocol,
                        'SHA224': usmHMAC128SHA224AuthProtocol,
                        'SHA256': usmHMAC192SHA256AuthProtocol,
                        'SHA384': usmHMAC256SHA384AuthProtocol,
                        'SHA512': usmHMAC384SHA512AuthProtocol
                    }
                    
                    auth_protocol = auth_protocol_map.get(device.auth_protocol, usmHMACMD5AuthProtocol)
                    
                    iterator = getCmd(
                        SnmpEngine(),
                        UsmUserData(
                            device.username,
                            authKey=device.auth_key,
                            authProtocol=auth_protocol
                        ),
                        UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                        ContextData(device.context_name) if device.context_name else ContextData(),
                        ObjectType(ObjectIdentity(oid))
                    )
                else:
                    # noAuthNoPriv
                    iterator = getCmd(
                        SnmpEngine(),
                        UsmUserData(device.username),
                        UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                        ContextData(device.context_name) if device.context_name else ContextData(),
                        ObjectType(ObjectIdentity(oid))
                    )
            
            # Execute SNMP request
            errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
            
            response_time = time.time() - start_time
            
            if errorIndication:
                # Store error result
                poll_result = SnmpPollResult(
                    snmp_device_id=device.id,
                    oid=oid,
                    value=None,
                    data_type=None,
                    response_time=response_time,
                    status='error',
                    error_message=str(errorIndication)
                )
                db.session.add(poll_result)
                db.session.commit()
                
                return jsonify({
                    'ok': False,
                    'message': f'SNMP error: {errorIndication}',
                    'data': {
                        'device': device.name,
                        'host': device.host,
                        'oid': oid,
                        'response_time': response_time,
                        'error': str(errorIndication)
                    }
                }), 500
                
            elif errorStatus:
                # Store error result
                poll_result = SnmpPollResult(
                    snmp_device_id=device.id,
                    oid=oid,
                    value=None,
                    data_type=None,
                    response_time=response_time,
                    status='error',
                    error_message=f'{errorStatus.prettyPrint()} at {varBinds[int(errorIndex) - 1][0] if errorIndex else "?"}'
                )
                db.session.add(poll_result)
                db.session.commit()
                
                return jsonify({
                    'ok': False,
                    'message': f'SNMP error: {errorStatus.prettyPrint()}',
                    'data': {
                        'device': device.name,
                        'host': device.host,
                        'oid': oid,
                        'response_time': response_time,
                        'error': str(errorStatus.prettyPrint())
                    }
                }), 500
                
            else:
                # Success - get the value
                for varBind in varBinds:
                    oid_name, oid_value = varBind
                    value = oid_value.prettyPrint()
                    data_type = type(oid_value).__name__
                
                # Store successful result
                poll_result = SnmpPollResult(
                    snmp_device_id=device.id,
                    oid=oid,
                    value=value,
                    data_type=data_type,
                    response_time=response_time,
                    status='success'
                )
                db.session.add(poll_result)
                
                # Update device last_poll
                device.last_poll = datetime.utcnow()
                db.session.commit()
                
                return jsonify({
                    'ok': True,
                    'message': 'SNMP value retrieved successfully',
                    'data': {
                        'device': device.name,
                        'host': device.host,
                        'oid': oid,
                        'value': value,
                        'data_type': data_type,
                        'response_time': response_time
                    }
                }), 200
                
        except Exception as snmp_error:
            response_time = time.time() - start_time
            
            # Store error result
            poll_result = SnmpPollResult(
                snmp_device_id=device.id,
                oid=oid,
                value=None,
                data_type=None,
                response_time=response_time,
                status='error',
                error_message=str(snmp_error)
            )
            db.session.add(poll_result)
            db.session.commit()
            
            return jsonify({
                'ok': False,
                'message': f'SNMP error: {str(snmp_error)}',
                'data': {
                    'device': device.name,
                    'host': device.host,
                    'oid': oid,
                    'response_time': response_time,
                    'error': str(snmp_error)
                }
            }), 500
            
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error during SNMP request: {str(e)}'
        }), 500

@snmp_bp.route('/results/<int:device_id>', methods=['GET'])
@jwt_required()
def get_snmp_results(device_id):
    """Get SNMP poll results for a device"""
    try:
        device = SnmpDevice.query.get_or_404(device_id)
        limit = request.args.get('limit', 100, type=int)
        
        results = SnmpPollResult.query.filter_by(snmp_device_id=device_id)\
            .order_by(SnmpPollResult.poll_time.desc())\
            .limit(limit)\
            .all()
        
        return jsonify({
            'ok': True,
            'message': 'SNMP poll results retrieved successfully',
            'data': [{
                'id': result.id,
                'oid': result.oid,
                'value': result.value,
                'data_type': result.data_type,
                'poll_time': result.poll_time.isoformat() if result.poll_time else None,
                'response_time': result.response_time,
                'status': result.status,
                'error_message': result.error_message
            } for result in results]
        }), 200
        
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error retrieving SNMP results: {str(e)}'
        }), 500

@snmp_bp.route('/test/<int:device_id>', methods=['POST'])
@jwt_required()
def test_snmp_connection(device_id):
    """Test SNMP device connection"""
    if not PYSNMP_AVAILABLE:
        return jsonify({
            'ok': False,
            'message': 'PySNMP module not available. Please install pysnmp package.'
        }), 503
    
    try:
        device = SnmpDevice.query.get_or_404(device_id)
        
        # Test with system description OID
        test_oid = '1.3.6.1.2.1.1.1.0'  # sysDescr
        
        start_time = time.time()
        
        try:
            # Configure SNMP parameters based on version
            if device.snmp_version == '1':
                iterator = getCmd(
                    SnmpEngine(),
                    CommunityData(device.community or 'public'),
                    UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                    ContextData(),
                    ObjectType(ObjectIdentity(test_oid))
                )
            elif device.snmp_version == '2c':
                iterator = getCmd(
                    SnmpEngine(),
                    CommunityData(device.community or 'public'),
                    UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                    ContextData(),
                    ObjectType(ObjectIdentity(test_oid))
                )
            else:
                # SNMPv3
                if device.auth_protocol and device.priv_protocol:
                    auth_protocol_map = {
                        'MD5': usmHMACMD5AuthProtocol,
                        'SHA': usmHMACSHA1AuthProtocol,
                        'SHA224': usmHMAC128SHA224AuthProtocol,
                        'SHA256': usmHMAC192SHA256AuthProtocol,
                        'SHA384': usmHMAC256SHA384AuthProtocol,
                        'SHA512': usmHMAC384SHA512AuthProtocol
                    }
                    
                    priv_protocol_map = {
                        'DES': usmDESPrivProtocol,
                        '3DES': usm3DESEDEPrivProtocol,
                        'AES': usmAesCfb128Protocol,
                        'AES192': usmAesCfb192Protocol,
                        'AES256': usmAesCfb256Protocol
                    }
                    
                    auth_protocol = auth_protocol_map.get(device.auth_protocol, usmHMACMD5AuthProtocol)
                    priv_protocol = priv_protocol_map.get(device.priv_protocol, usmDESPrivProtocol)
                    
                    iterator = getCmd(
                        SnmpEngine(),
                        UsmUserData(
                            device.username,
                            authKey=device.auth_key,
                            privKey=device.priv_key,
                            authProtocol=auth_protocol,
                            privProtocol=priv_protocol
                        ),
                        UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                        ContextData(device.context_name) if device.context_name else ContextData(),
                        ObjectType(ObjectIdentity(test_oid))
                    )
                elif device.auth_protocol:
                    auth_protocol_map = {
                        'MD5': usmHMACMD5AuthProtocol,
                        'SHA': usmHMACSHA1AuthProtocol,
                        'SHA224': usmHMAC128SHA224AuthProtocol,
                        'SHA256': usmHMAC192SHA256AuthProtocol,
                        'SHA384': usmHMAC256SHA384AuthProtocol,
                        'SHA512': usmHMAC384SHA512AuthProtocol
                    }
                    
                    auth_protocol = auth_protocol_map.get(device.auth_protocol, usmHMACMD5AuthProtocol)
                    
                    iterator = getCmd(
                        SnmpEngine(),
                        UsmUserData(
                            device.username,
                            authKey=device.auth_key,
                            authProtocol=auth_protocol
                        ),
                        UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                        ContextData(device.context_name) if device.context_name else ContextData(),
                        ObjectType(ObjectIdentity(test_oid))
                    )
                else:
                    iterator = getCmd(
                        SnmpEngine(),
                        UsmUserData(device.username),
                        UdpTransportTarget((device.host, device.port), timeout=device.timeout, retries=device.retries),
                        ContextData(device.context_name) if device.context_name else ContextData(),
                        ObjectType(ObjectIdentity(test_oid))
                    )
            
            # Execute SNMP request
            errorIndication, errorStatus, errorIndex, varBinds = next(iterator)
            
            response_time = time.time() - start_time
            
            if errorIndication or errorStatus:
                return jsonify({
                    'ok': False,
                    'message': f'SNMP connection test failed: {errorIndication or errorStatus}',
                    'data': {
                        'device': device.name,
                        'host': device.host,
                        'port': device.port,
                        'snmp_version': device.snmp_version,
                        'response_time': response_time,
                        'connection_status': 'failed'
                    }
                }), 500
            else:
                # Get system description
                for varBind in varBinds:
                    oid_name, oid_value = varBind
                    sys_descr = oid_value.prettyPrint()
                
                return jsonify({
                    'ok': True,
                    'message': 'SNMP connection test successful',
                    'data': {
                        'device': device.name,
                        'host': device.host,
                        'port': device.port,
                        'snmp_version': device.snmp_version,
                        'response_time': response_time,
                        'connection_status': 'success',
                        'system_description': sys_descr
                    }
                }), 200
                
        except Exception as snmp_error:
            response_time = time.time() - start_time
            
            return jsonify({
                'ok': False,
                'message': f'SNMP connection test failed: {str(snmp_error)}',
                'data': {
                    'device': device.name,
                    'host': device.host,
                    'port': device.port,
                    'snmp_version': device.snmp_version,
                    'response_time': response_time,
                    'connection_status': 'failed',
                    'error': str(snmp_error)
                }
            }), 500
            
    except Exception as e:
        return jsonify({
            'ok': False,
            'message': f'Error during SNMP connection test: {str(e)}'
        }), 500
