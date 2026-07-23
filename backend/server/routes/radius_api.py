"""
Fallback HTTP RADIUS auth for integrations.

Primary auth path: MikroTik -> FreeRADIUS -> PostgreSQL (radcheck/radreply).
Use these endpoints only when FreeRADIUS REST module delegates here.
"""
from flask import Blueprint, jsonify, request
from datetime import datetime
import random
import time

from extensions import db
from models import Customer, CustomerStatus, ISP, MikrotikDevice, RadCheck, RadiusSession
from services.radius_provisioning import (
    find_customer_by_login,
    radius_username,
    verify_radius_password,
)

radius_api_bp = Blueprint('radius_api', __name__, url_prefix='/api/radius-api')


def _verify_via_radcheck(username, password, isp_id):
    """Check active radcheck Cleartext-Password row (FreeRADIUS SQL mirror)."""
    entry = RadCheck.query.filter_by(
        username=username,
        isp_id=isp_id,
        attribute='Cleartext-Password',
        is_active=True,
    ).first()
    if entry and entry.value == password:
        return True
    return False


@radius_api_bp.route('/auth', methods=['POST'])
def authenticate_user():
    """Fallback RADIUS authentication (FreeRADIUS + Postgres is primary)."""
    try:
        data = request.get_json() or {}

        required_fields = ['username', 'password', 'nas_ip']
        for field in required_fields:
            if not data.get(field):
                return jsonify({
                    'ok': False,
                    'message': f'Missing required field: {field}',
                }), 400

        username = data['username'].strip().lower()
        password = data['password']
        nas_ip = data['nas_ip']

        customer = find_customer_by_login(username)
        if not customer:
            return jsonify({'ok': False, 'message': 'User not found', 'code': 'USER_NOT_FOUND'}), 401

        if not customer.isp_id:
            return jsonify({'ok': False, 'message': 'Customer not associated with any ISP', 'code': 'NO_ISP_ASSOCIATION'}), 401

        isp = ISP.query.get(customer.isp_id)
        if not isp or not isp.is_active:
            return jsonify({'ok': False, 'message': 'ISP not active', 'code': 'ISP_INACTIVE'}), 401

        if customer.status != CustomerStatus.ACTIVE:
            return jsonify({'ok': False, 'message': 'Customer account not active', 'code': 'CUSTOMER_INACTIVE'}), 401

        password_ok = (
            verify_radius_password(customer, password)
            or _verify_via_radcheck(username, password, isp.id)
        )
        if not password_ok:
            return jsonify({'ok': False, 'message': 'Invalid credentials', 'code': 'INVALID_PASSWORD'}), 401

        device = MikrotikDevice.query.filter_by(device_ip=nas_ip, isp_id=isp.id, is_active=True).first()
        if not device:
            return jsonify({'ok': False, 'message': 'Device not found or not authorized', 'code': 'DEVICE_NOT_FOUND'}), 401

        session_id = f"{customer.id}_{int(time.time())}_{random.randint(1000, 9999)}"
        session = RadiusSession(
            isp_id=isp.id,
            customer_id=customer.id,
            mikrotik_device_id=device.id,
            session_id=session_id,
            username=username,
            ip_address=data.get('framed_ip', '0.0.0.0'),
            mac_address=data.get('mac_address', '00:00:00:00:00:00'),
            session_start=datetime.utcnow(),
            is_active=True,
        )
        db.session.add(session)
        db.session.commit()

        return jsonify({
            'ok': True,
            'message': 'Authentication successful',
            'data': {
                'customer_id': customer.id,
                'customer_name': customer.full_name,
                'isp_id': isp.id,
                'isp_name': isp.name,
                'device_id': device.id,
                'device_name': device.device_name,
                'session_id': session_id,
            },
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'message': f'Authentication failed: {str(e)}', 'code': 'AUTH_ERROR'}), 500


@radius_api_bp.route('/accounting', methods=['POST'])
def handle_accounting():
    """Fallback RADIUS accounting updates."""
    try:
        data = request.get_json() or {}

        required_fields = ['session_id', 'acct_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'ok': False, 'message': f'Missing required field: {field}'}), 400

        session_id = data['session_id']
        acct_type = data['acct_type']

        session = RadiusSession.query.filter_by(session_id=session_id).first()
        if not session:
            return jsonify({'ok': False, 'message': 'Session not found', 'code': 'SESSION_NOT_FOUND'}), 404

        if acct_type in ('Stop', 'stop'):
            session.session_end = datetime.utcnow()
            session.is_active = False

        session.bytes_in = data.get('input_octets', session.bytes_in)
        session.bytes_out = data.get('output_octets', session.bytes_out)
        session.packets_in = data.get('input_packets', session.packets_in)
        session.packets_out = data.get('output_packets', session.packets_out)

        db.session.commit()

        return jsonify({
            'ok': True,
            'message': 'Accounting update successful',
            'data': {
                'session_id': session_id,
                'acct_type': acct_type,
                'total_bytes': (session.bytes_in or 0) + (session.bytes_out or 0),
            },
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'message': f'Accounting failed: {str(e)}', 'code': 'ACCT_ERROR'}), 500
