#!/usr/bin/env python3
"""
RADIUS Service for Multi-tenant Authentication and Accounting
"""
import socket
import struct
import hashlib
import hmac
import time
import random
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

class RadiusPacketType(Enum):
    ACCESS_REQUEST = 1
    ACCESS_ACCEPT = 2
    ACCESS_REJECT = 3
    ACCOUNTING_REQUEST = 4
    ACCOUNTING_RESPONSE = 5

@dataclass
class RadiusPacket:
    """RADIUS packet structure"""
    code: int
    identifier: int
    length: int
    authenticator: bytes
    attributes: Dict[str, Any]

class RadiusService:
    """RADIUS service for handling authentication and accounting"""
    
    def __init__(self, secret: str):
        self.secret = secret.encode('utf-8')
    
    def create_access_request(self, username: str, password: str, nas_ip: str, 
                            nas_port: int = 0, session_id: str = None) -> RadiusPacket:
        """Create RADIUS Access-Request packet"""
        # Create random authenticator
        authenticator = self._create_request_authenticator()
        
        # Build attributes
        attributes = {
            'User-Name': username,
            'NAS-IP-Address': nas_ip,
            'NAS-Port': nas_port,
            'Message-Authenticator': self._calculate_message_authenticator(authenticator)
        }
        
        if session_id:
            attributes['Acct-Session-Id'] = session_id
        
        # Encode password
        encoded_password = self._encode_password(password, authenticator)
        attributes['User-Password'] = encoded_password
        
        return RadiusPacket(
            code=RadiusPacketType.ACCESS_REQUEST.value,
            identifier=random.randint(0, 255),
            length=0,  # Will be calculated
            authenticator=authenticator,
            attributes=attributes
        )
    
    def create_accounting_request(self, username: str, session_id: str, nas_ip: str,
                                acct_type: str = 'Start', session_time: int = 0,
                                input_octets: int = 0, output_octets: int = 0) -> RadiusPacket:
        """Create RADIUS Accounting-Request packet"""
        authenticator = self._create_request_authenticator()
        
        attributes = {
            'User-Name': username,
            'Acct-Session-Id': session_id,
            'NAS-IP-Address': nas_ip,
            'Acct-Status-Type': acct_type,
            'Acct-Session-Time': session_time,
            'Acct-Input-Octets': input_octets,
            'Acct-Output-Octets': output_octets,
            'Message-Authenticator': self._calculate_message_authenticator(authenticator)
        }
        
        return RadiusPacket(
            code=RadiusPacketType.ACCOUNTING_REQUEST.value,
            identifier=random.randint(0, 255),
            length=0,
            authenticator=authenticator,
            attributes=attributes
        )
    
    def _create_request_authenticator(self) -> bytes:
        """Create random request authenticator"""
        return random.getrandbits(128).to_bytes(16, 'big')
    
    def _encode_password(self, password: str, authenticator: bytes) -> bytes:
        """Encode password using RADIUS method"""
        password_bytes = password.encode('utf-8')
        encoded = b''
        
        for i in range(0, len(password_bytes), 16):
            chunk = password_bytes[i:i+16]
            if len(chunk) < 16:
                chunk = chunk + b'\x00' * (16 - len(chunk))
            
            # XOR with MD5(secret + authenticator)
            md5_input = self.secret + authenticator
            if encoded:
                md5_input += encoded
            hash_result = hashlib.md5(md5_input).digest()
            
            # XOR chunk with hash
            encoded_chunk = bytes(a ^ b for a, b in zip(chunk, hash_result))
            encoded += encoded_chunk
        
        return encoded
    
    def _calculate_message_authenticator(self, authenticator: bytes) -> bytes:
        """Calculate Message-Authenticator attribute"""
        # This is a simplified version - in practice, you'd need to build the packet first
        return hashlib.md5(self.secret + authenticator).digest()
    
    def encode_packet(self, packet: RadiusPacket) -> bytes:
        """Encode RADIUS packet to bytes"""
        # Build attribute bytes
        attr_bytes = b''
        for attr_name, attr_value in packet.attributes.items():
            if attr_name == 'User-Name':
                attr_bytes += struct.pack('BB', 1, len(str(attr_value)) + 2)
                attr_bytes += str(attr_value).encode('utf-8')
            elif attr_name == 'User-Password':
                attr_bytes += struct.pack('BB', 2, len(attr_value) + 2)
                attr_bytes += attr_value
            elif attr_name == 'NAS-IP-Address':
                attr_bytes += struct.pack('BB', 4, 6)
                attr_bytes += socket.inet_aton(attr_value)
            elif attr_name == 'NAS-Port':
                attr_bytes += struct.pack('BB', 5, 6)
                attr_bytes += struct.pack('!I', attr_value)
            elif attr_name == 'Acct-Session-Id':
                attr_bytes += struct.pack('BB', 44, len(str(attr_value)) + 2)
                attr_bytes += str(attr_value).encode('utf-8')
            elif attr_name == 'Acct-Status-Type':
                attr_bytes += struct.pack('BB', 40, 6)
                attr_bytes += struct.pack('!I', self._get_acct_status_type(attr_value))
            elif attr_name == 'Acct-Session-Time':
                attr_bytes += struct.pack('BB', 46, 6)
                attr_bytes += struct.pack('!I', attr_value)
            elif attr_name == 'Acct-Input-Octets':
                attr_bytes += struct.pack('BB', 42, 6)
                attr_bytes += struct.pack('!I', attr_value)
            elif attr_name == 'Acct-Output-Octets':
                attr_bytes += struct.pack('BB', 43, 6)
                attr_bytes += struct.pack('!I', attr_value)
            elif attr_name == 'Message-Authenticator':
                attr_bytes += struct.pack('BB', 80, 18)
                attr_bytes += attr_value
        
        # Calculate length
        packet.length = 20 + len(attr_bytes)  # Header (20) + attributes
        
        # Build packet
        packet_bytes = struct.pack('!BBH', packet.code, packet.identifier, packet.length)
        packet_bytes += packet.authenticator
        packet_bytes += attr_bytes
        
        return packet_bytes
    
    def _get_acct_status_type(self, status: str) -> int:
        """Get accounting status type value"""
        status_map = {
            'Start': 1,
            'Stop': 2,
            'Interim-Update': 3,
            'Accounting-On': 7,
            'Accounting-Off': 8
        }
        return status_map.get(status, 1)
    
    def decode_packet(self, data: bytes) -> RadiusPacket:
        """Decode RADIUS packet from bytes"""
        if len(data) < 20:
            raise ValueError("Packet too short")
        
        code, identifier, length, authenticator = struct.unpack('!BBH16s', data[:20])
        
        # Parse attributes
        attributes = {}
        offset = 20
        
        while offset < length:
            if offset + 2 > length:
                break
            
            attr_type, attr_len = struct.unpack('BB', data[offset:offset+2])
            if offset + attr_len > length:
                break
            
            attr_data = data[offset+2:offset+attr_len]
            
            # Decode attribute based on type
            if attr_type == 1:  # User-Name
                attributes['User-Name'] = attr_data.decode('utf-8')
            elif attr_type == 2:  # User-Password
                attributes['User-Password'] = attr_data
            elif attr_type == 4:  # NAS-IP-Address
                attributes['NAS-IP-Address'] = socket.inet_ntoa(attr_data)
            elif attr_type == 5:  # NAS-Port
                attributes['NAS-Port'] = struct.unpack('!I', attr_data)[0]
            elif attr_type == 44:  # Acct-Session-Id
                attributes['Acct-Session-Id'] = attr_data.decode('utf-8')
            elif attr_type == 40:  # Acct-Status-Type
                attributes['Acct-Status-Type'] = struct.unpack('!I', attr_data)[0]
            elif attr_type == 46:  # Acct-Session-Time
                attributes['Acct-Session-Time'] = struct.unpack('!I', attr_data)[0]
            elif attr_type == 42:  # Acct-Input-Octets
                attributes['Acct-Input-Octets'] = struct.unpack('!I', attr_data)[0]
            elif attr_type == 43:  # Acct-Output-Octets
                attributes['Acct-Output-Octets'] = struct.unpack('!I', attr_data)[0]
            
            offset += attr_len
        
        return RadiusPacket(
            code=code,
            identifier=identifier,
            length=length,
            authenticator=authenticator,
            attributes=attributes
        )

class MultiTenantRadiusService:
    """Multi-tenant RADIUS service for ISP management"""
    
    def __init__(self, db_session):
        self.db_session = db_session
    
    def authenticate_user(self, username: str, password: str, nas_ip: str, 
                         nas_port: int = 0) -> Tuple[bool, Dict[str, Any]]:
        """Authenticate user and return ISP context"""
        try:
            # Find customer by username
            from models import Customer, ISP, MikrotikDevice
            
            customer = Customer.query.filter_by(email=username).first()
            if not customer:
                return False, {'error': 'User not found'}
            
            # Check if customer belongs to an ISP
            if not customer.isp_id:
                return False, {'error': 'Customer not associated with any ISP'}
            
            isp = ISP.query.get(customer.isp_id)
            if not isp or not isp.is_active:
                return False, {'error': 'ISP not active'}
            
            # Check if customer is active
            if customer.status.value != 'active':
                return False, {'error': 'Customer account not active'}
            
            # Find the MikroTik device that sent the request
            device = MikrotikDevice.query.filter_by(
                device_ip=nas_ip,
                isp_id=isp.id
            ).first()
            
            if not device:
                return False, {'error': 'Device not found or not authorized'}
            
            # Generate session ID
            session_id = f"{customer.id}_{int(time.time())}_{random.randint(1000, 9999)}"
            
            # Create RADIUS response
            radius_service = RadiusService(isp.radius_secret)
            access_request = radius_service.create_access_request(
                username=username,
                password=password,
                nas_ip=nas_ip,
                nas_port=nas_port,
                session_id=session_id
            )
            
            # Store session information
            from models import RadiusSession
            session = RadiusSession(
                isp_id=isp.id,
                customer_id=customer.id,
                mikrotik_device_id=device.id,
                session_id=session_id,
                username=username,
                ip_address=customer.address or '0.0.0.0',
                mac_address='00:00:00:00:00:00',
                session_start=datetime.utcnow()
            )
            
            self.db_session.add(session)
            self.db_session.commit()
            
            return True, {
                'customer_id': customer.id,
                'isp_id': isp.id,
                'device_id': device.id,
                'session_id': session_id,
                'radius_packet': radius_service.encode_packet(access_request)
            }
            
        except Exception as e:
            self.db_session.rollback()
            return False, {'error': f'Authentication failed: {str(e)}'}
    
    def handle_accounting(self, session_id: str, acct_type: str, 
                         session_time: int = 0, input_octets: int = 0, 
                         output_octets: int = 0) -> bool:
        """Handle RADIUS accounting updates"""
        try:
            from models import RadiusSession, ISP
            
            # Find session
            session = RadiusSession.query.filter_by(session_id=session_id).first()
            if not session:
                return False
            
            # Get ISP
            isp = ISP.query.get(session.isp_id)
            if not isp:
                return False
            
            # Update session
            if acct_type == 'Stop':
                session.session_end = datetime.utcnow()
                session.is_active = False
            
            session.bytes_in = input_octets
            session.bytes_out = output_octets
            
            self.db_session.commit()
            return True
            
        except Exception as e:
            self.db_session.rollback()
            return False
    
    def get_isp_radius_config(self, isp_id: int) -> Dict[str, Any]:
        """Get RADIUS configuration for an ISP"""
        try:
            from models import ISP
            
            isp = ISP.query.get(isp_id)
            if not isp:
                return {}
            
            return {
                'isp_id': isp.id,
                'isp_name': isp.name,
                'radius_secret': isp.radius_secret,
                'api_key': isp.api_key,
                'devices': [
                    {
                        'id': device.id,
                        'name': device.device_name,
                        'ip': device.device_ip,
                        'location': device.location
                    }
                    for device in isp.mikrotik_devices if device.is_active
                ]
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def handle_accounting(self, session_id: str, acct_type: str, 
                         session_time: int = 0, input_octets: int = 0, 
                         output_octets: int = 0) -> bool:
        """Handle RADIUS accounting updates"""
        try:
            from models import RadiusSession, ISP
            
            # Find session
            session = RadiusSession.query.filter_by(session_id=session_id).first()
            if not session:
                return False
            
            # Get ISP
            isp = ISP.query.get(session.isp_id)
            if not isp:
                return False
            
            # Update session
            if acct_type == 'Stop':
                session.session_end = datetime.utcnow()
                session.is_active = False
            
            session.bytes_in = input_octets
            session.bytes_out = output_octets
            
            self.db_session.commit()
            return True
            
        except Exception as e:
            self.db_session.rollback()
            return False
    
    def get_isp_radius_config(self, isp_id: int) -> Dict[str, Any]:
        """Get RADIUS configuration for an ISP"""
        try:
            from models import ISP
            
            isp = ISP.query.get(isp_id)
            if not isp:
                return {}
            
            return {
                'isp_id': isp.id,
                'isp_name': isp.name,
                'radius_secret': isp.radius_secret,
                'api_key': isp.api_key,
                'devices': [
                    {
                        'id': device.id,
                        'name': device.device_name,
                        'ip': device.device_ip,
                        'location': device.location
                    }
                    for device in isp.mikrotik_devices if device.is_active
                ]
            }
            
        except Exception as e:
            return {'error': str(e)}
