"""Operator API for TR-069 customer premises equipment.

Every write here *queues* a task rather than performing it. A CPE behind CGNAT
cannot be reached on demand — the ACS can only hand work over during a session
the device itself opens — so an endpoint that pretended to apply a change
synchronously would be lying. Responses carry the task so the UI can show
'queued' honestly, and `queued_behind` tells the operator how long the wait is
likely to be.
"""
import json
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from auth_utils import get_current_user
from extensions import db
from models import Customer, CpeDevice, CpeSession, CpeTask, ISP
from services.encryption import encrypt_value
from services.rate_limit import rate_limit
from services.tr069 import profiles
from services.tr069 import session as cwmp_session

cpe_bp = Blueprint('cpe', __name__, url_prefix='/api/cpe')

VALID_STATUSES = {'pending', 'active', 'disabled'}
# Operations the UI may request by name, mapped to the semantic profile fields
# they write. Keeping this allow-list here means the API never accepts a raw
# CWMP path from the browser.
WRITABLE_FIELDS = {'wifi_ssid', 'wifi_password', 'wifi_enabled', 'wifi_channel',
                   'pppoe_username', 'pppoe_password'}

# A device is "online" if it has informed within a few periodic intervals.
_ONLINE_GRACE_MULTIPLIER = 3


def _is_online(device):
    if not device.last_inform_at:
        return False
    interval = device.periodic_inform_interval or 300
    window = timedelta(seconds=interval * _ONLINE_GRACE_MULTIPLIER)
    return (datetime.utcnow() - device.last_inform_at) < window


def _optical_health(rx_power_dbm):
    """Classify an ONT's receive level. The number most support calls turn on."""
    if rx_power_dbm is None:
        return None
    if rx_power_dbm >= -8:
        return 'too_strong'
    if rx_power_dbm >= -25:
        return 'good'
    if rx_power_dbm >= -27:
        return 'marginal'
    return 'critical'


def serialize_cpe(device, detail=False):
    data = {
        'id': device.id,
        'isp_id': device.isp_id,
        'customer_id': device.customer_id,
        'customer_name': device.customer.full_name if device.customer else None,
        'serial_key': device.serial_key,
        'serial_number': device.serial_number,
        'oui': device.oui,
        'product_class': device.product_class,
        'manufacturer': device.manufacturer,
        'data_model_root': device.data_model_root,
        'profile_key': device.profile_key,
        'software_version': device.software_version,
        'hardware_version': device.hardware_version,
        'status': device.status,
        'online': _is_online(device),
        'last_inform_at': device.last_inform_at.isoformat() if device.last_inform_at else None,
        'last_boot_at': device.last_boot_at.isoformat() if device.last_boot_at else None,
        'last_inform_event': device.last_inform_event,
        'inform_count': device.inform_count,
        'peer_ip': device.peer_ip,
        'wan_ip': device.wan_ip,
        'ssid': device.ssid,
        'pppoe_username': device.pppoe_username,
        'uptime_seconds': device.uptime_seconds,
        'connected_clients': device.connected_clients,
        'rx_power_dbm': device.rx_power_dbm,
        'tx_power_dbm': device.tx_power_dbm,
        'optical_health': _optical_health(device.rx_power_dbm),
        'periodic_inform_interval': device.periodic_inform_interval,
        'tags': device.tags,
        'notes': device.notes,
        'created_at': device.created_at.isoformat() if device.created_at else None,
    }
    if detail:
        try:
            data['parameters'] = json.loads(device.parameters) if device.parameters else {}
        except (TypeError, ValueError):
            data['parameters'] = {}
        data['parameters_at'] = device.parameters_at.isoformat() if device.parameters_at else None
        profile = profiles.get_profile(device.profile_key)
        data['profile'] = {
            'key': profile['key'],
            'label': profile['label'],
            'supported_fields': sorted(profile['params'].keys()),
        } if profile else None
    return data


def serialize_task(task):
    payload = result = None
    try:
        payload = json.loads(task.payload) if task.payload else {}
    except (TypeError, ValueError):
        payload = {}
    try:
        result = json.loads(task.result) if task.result else None
    except (TypeError, ValueError):
        result = None
    # A password we pushed must not come back out of the API.
    if isinstance(payload, dict) and 'values' in payload:
        payload = dict(payload)
        payload['values'] = {
            k: ('********' if 'password' in k.lower() or 'passphrase' in k.lower() else v)
            for k, v in (payload.get('values') or {}).items()
        }
    return {
        'id': task.id,
        'device_id': task.device_id,
        'kind': task.kind,
        'payload': payload,
        'result': result,
        'status': task.status,
        'attempts': task.attempts,
        'fault_code': task.fault_code,
        'fault_string': task.fault_string,
        'created_at': task.created_at.isoformat() if task.created_at else None,
        'delivered_at': task.delivered_at.isoformat() if task.delivered_at else None,
        'completed_at': task.completed_at.isoformat() if task.completed_at else None,
    }


def _scoped_query(current_user):
    query = CpeDevice.query
    if current_user.role != 'admin':
        if not current_user.isp_id:
            return None
        query = query.filter_by(isp_id=current_user.isp_id)
    return query


def _get_owned(device_id, current_user):
    device = CpeDevice.query.get_or_404(device_id)
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return None
    return device


# --------------------------------------------------------------------------
#  Fleet
# --------------------------------------------------------------------------

@cpe_bp.route('', methods=['GET'])
@jwt_required()
def list_cpe():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    query = _scoped_query(current_user)
    if query is None:
        return jsonify({'error': 'User not associated with any ISP'}), 403

    status = request.args.get('status')
    search = request.args.get('search')
    if status and status != 'all':
        query = query.filter_by(status=status)
    if search:
        like = f'%{search}%'
        query = query.filter(db.or_(
            CpeDevice.serial_key.ilike(like),
            CpeDevice.serial_number.ilike(like),
            CpeDevice.ssid.ilike(like),
            CpeDevice.pppoe_username.ilike(like),
        ))

    devices = query.order_by(CpeDevice.last_inform_at.desc().nullslast()).all()
    return jsonify({'cpe': [serialize_cpe(d) for d in devices]}), 200


@cpe_bp.route('/stats', methods=['GET'])
@jwt_required()
def cpe_stats():
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    query = _scoped_query(current_user)
    if query is None:
        return jsonify({'error': 'User not associated with any ISP'}), 403

    devices = query.all()
    degraded = [d for d in devices
                if _optical_health(d.rx_power_dbm) in ('marginal', 'critical')]
    return jsonify({
        'total': len(devices),
        'active': sum(1 for d in devices if d.status == 'active'),
        'pending': sum(1 for d in devices if d.status == 'pending'),
        'online': sum(1 for d in devices if _is_online(d)),
        'optical_degraded': len(degraded),
    }), 200


@cpe_bp.route('/<int:device_id>', methods=['GET'])
@jwt_required()
def get_cpe(device_id):
    current_user = get_current_user()
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    return jsonify(serialize_cpe(device, detail=True)), 200


@cpe_bp.route('/<int:device_id>', methods=['PUT'])
@jwt_required()
def update_cpe(device_id):
    current_user = get_current_user()
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json(silent=True) or {}

    if 'status' in data:
        status = (data.get('status') or '').lower()
        if status not in VALID_STATUSES:
            return jsonify({'error': f'status must be one of {sorted(VALID_STATUSES)}'}), 400
        device.status = status
    if 'customer_id' in data:
        customer_id = data.get('customer_id')
        if customer_id:
            customer = Customer.query.get(customer_id)
            if not customer or (current_user.role != 'admin'
                                and customer.isp_id != current_user.isp_id):
                return jsonify({'error': 'Customer not found'}), 404
            device.customer_id = customer.id
        else:
            device.customer_id = None
    for field in ('tags', 'notes'):
        if field in data:
            setattr(device, field, (data.get(field) or '').strip() or None)
    if 'periodic_inform_interval' in data:
        try:
            interval = int(data['periodic_inform_interval'])
        except (TypeError, ValueError):
            return jsonify({'error': 'periodic_inform_interval must be an integer'}), 400
        if not 60 <= interval <= 86400:
            return jsonify({'error': 'periodic_inform_interval must be 60..86400 seconds'}), 400
        device.periodic_inform_interval = interval
    if 'cwmp_username' in data:
        device.cwmp_username = (data.get('cwmp_username') or '').strip() or None
    if data.get('cwmp_password'):
        device.cwmp_password_encrypted = encrypt_value(data['cwmp_password'])

    db.session.commit()
    return jsonify({'message': 'CPE updated', 'cpe': serialize_cpe(device)}), 200


@cpe_bp.route('/<int:device_id>', methods=['DELETE'])
@jwt_required()
def delete_cpe(device_id):
    current_user = get_current_user()
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    db.session.delete(device)
    db.session.commit()
    return jsonify({'message': 'CPE removed'}), 200


@cpe_bp.route('/<int:device_id>/approve', methods=['POST'])
@jwt_required()
def approve_cpe(device_id):
    """Move a pending device to active so it starts receiving tasks."""
    current_user = get_current_user()
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403

    device.status = 'active'
    cwmp_session.autobind_customer(device)
    cwmp_session.queue_core_parameter_read(
        device, created_by=current_user.id if current_user else None)
    db.session.commit()
    return jsonify({'message': 'CPE approved', 'cpe': serialize_cpe(device)}), 200


# --------------------------------------------------------------------------
#  Tasks
# --------------------------------------------------------------------------

def _queue_and_respond(device, kind, payload, current_user, message):
    task = cwmp_session.queue_task(
        device, kind, payload, created_by=current_user.id if current_user else None)
    db.session.flush()
    pending = CpeTask.query.filter(
        CpeTask.device_id == device.id,
        CpeTask.status.in_(('queued', 'sent')),
        CpeTask.id != task.id,
    ).count()
    db.session.commit()

    interval = device.periodic_inform_interval or 300
    return jsonify({
        'message': message,
        'task': serialize_task(task),
        'queued_behind': pending,
        # The honest part: nothing happens until the CPE next opens a session.
        'delivery': {
            'mode': 'next_inform',
            'expected_within_seconds': interval,
            'note': f'Applies when the device next checks in (every {interval}s).',
        },
    }), 202


@cpe_bp.route('/<int:device_id>/tasks', methods=['GET'])
@jwt_required()
def list_tasks(device_id):
    current_user = get_current_user()
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    tasks = (CpeTask.query.filter_by(device_id=device.id)
             .order_by(CpeTask.created_at.desc()).limit(100).all())
    return jsonify({'tasks': [serialize_task(t) for t in tasks]}), 200


@cpe_bp.route('/<int:device_id>/refresh', methods=['POST'])
@rate_limit(limit=30, window=60, scope='cpe-refresh')
@jwt_required()
def refresh_cpe(device_id):
    """Queue a read of the core parameter set."""
    current_user = get_current_user()
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    if device.status != 'active':
        return jsonify({'error': 'Approve the device before issuing tasks'}), 409

    profile = profiles.get_profile(device.profile_key) or \
        profiles.resolve_profile(data_model_root=device.data_model_root)
    paths = profiles.core_parameter_paths(profile)
    if not paths:
        return jsonify({'error': 'No parameters known for this device profile'}), 400
    return _queue_and_respond(device, 'get_parameter_values', {'names': paths},
                              current_user, 'Parameter refresh queued')


@cpe_bp.route('/<int:device_id>/settings', methods=['POST'])
@rate_limit(limit=20, window=60, scope='cpe-settings')
@jwt_required()
def set_cpe_settings(device_id):
    """Queue a SetParameterValues built from semantic field names.

    The browser sends {'wifi_ssid': 'Foo'}; the vendor profile turns that into
    whatever path this model actually uses.
    """
    current_user = get_current_user()
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    if device.status != 'active':
        return jsonify({'error': 'Approve the device before issuing tasks'}), 409

    data = request.get_json(silent=True) or {}
    fields = data.get('fields') or {}
    if not isinstance(fields, dict) or not fields:
        return jsonify({'error': 'fields is required'}), 400

    unknown = set(fields) - WRITABLE_FIELDS
    if unknown:
        return jsonify({'error': f'Unsupported fields: {sorted(unknown)}'}), 400

    profile = profiles.get_profile(device.profile_key) or \
        profiles.resolve_profile(data_model_root=device.data_model_root)

    values = {}
    unsupported = []
    for field, value in fields.items():
        path = profiles.param_path(profile, field)
        if not path:
            unsupported.append(field)
            continue
        values[path] = (value, profiles.param_type(profile, field))
    if unsupported:
        return jsonify({
            'error': f"This device's profile ({profile['label']}) cannot set: {sorted(unsupported)}",
        }), 400

    return _queue_and_respond(device, 'set_parameter_values', {'values': values},
                              current_user, 'Settings change queued')


@cpe_bp.route('/<int:device_id>/reboot', methods=['POST'])
@rate_limit(limit=10, window=60, scope='cpe-reboot')
@jwt_required()
def reboot_cpe(device_id):
    current_user = get_current_user()
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    if device.status != 'active':
        return jsonify({'error': 'Approve the device before issuing tasks'}), 409
    return _queue_and_respond(device, 'reboot', {}, current_user, 'Reboot queued')


@cpe_bp.route('/<int:device_id>/factory-reset', methods=['POST'])
@rate_limit(limit=5, window=300, scope='cpe-factory-reset')
@jwt_required()
def factory_reset_cpe(device_id):
    """Wipe the CPE back to defaults. Destructive: admin only, and confirmed.

    A factory reset drops the subscriber's WiFi config *and* the ACS URL on many
    models, which can strand the device until someone visits the premises. The
    explicit confirmation is deliberate friction.
    """
    current_user = get_current_user()
    if not current_user or current_user.role != 'admin':
        return jsonify({'error': 'Only an admin can factory reset a device'}), 403
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    if device.status != 'active':
        return jsonify({'error': 'Approve the device before issuing tasks'}), 409

    data = request.get_json(silent=True) or {}
    if data.get('confirm') != device.serial_number:
        return jsonify({
            'error': 'Confirmation required: send {"confirm": "<serial number>"}',
        }), 400

    current_app.logger.warning(
        'Factory reset queued for CPE %s by user %s', device.serial_key, current_user.id)
    return _queue_and_respond(device, 'factory_reset', {}, current_user,
                              'Factory reset queued')


@cpe_bp.route('/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def cancel_task(task_id):
    current_user = get_current_user()
    task = CpeTask.query.get_or_404(task_id)
    device = _get_owned(task.device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    if task.status not in ('queued', 'sent'):
        return jsonify({'error': f'Task is already {task.status}'}), 409
    task.status = 'expired'
    task.completed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'message': 'Task cancelled'}), 200


# --------------------------------------------------------------------------
#  Sessions + enrolment
# --------------------------------------------------------------------------

@cpe_bp.route('/<int:device_id>/sessions', methods=['GET'])
@jwt_required()
def list_sessions(device_id):
    current_user = get_current_user()
    device = _get_owned(device_id, current_user)
    if device is None:
        return jsonify({'error': 'Access denied'}), 403
    sessions = (CpeSession.query.filter_by(device_id=device.id)
                .order_by(CpeSession.started_at.desc()).limit(50).all())
    return jsonify({'sessions': [{
        'id': s.id,
        'peer_ip': s.peer_ip,
        'events': s.events,
        'rpc_count': s.rpc_count,
        'fault_count': s.fault_count,
        'started_at': s.started_at.isoformat() if s.started_at else None,
        'ended_at': s.ended_at.isoformat() if s.ended_at else None,
    } for s in sessions]}), 200


@cpe_bp.route('/enrollment', methods=['POST'])
@jwt_required()
def create_enrollment():
    """Pre-register a CPE with credentials before it is installed.

    Lets an installer configure the ONT's ACS username/password at the bench and
    have it arrive already claimed, instead of landing in the pending queue.
    """
    current_user = get_current_user()
    if not current_user:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json(silent=True) or {}

    serial_number = (data.get('serial_number') or '').strip()
    if not serial_number:
        return jsonify({'error': 'serial_number is required'}), 400

    if current_user.role == 'admin':
        isp_id = data.get('isp_id')
        if not isp_id:
            isp = ISP.query.filter_by(is_active=True).first()
            if not isp:
                return jsonify({'error': 'No active ISP found'}), 400
            isp_id = isp.id
    else:
        if not current_user.isp_id:
            return jsonify({'error': 'User not associated with any ISP'}), 403
        isp_id = current_user.isp_id

    oui = (data.get('oui') or '').strip() or None
    product_class = (data.get('product_class') or '').strip() or None
    serial_key = CpeDevice.build_serial_key(oui, product_class, serial_number)
    if CpeDevice.query.filter_by(serial_key=serial_key).first():
        return jsonify({'error': 'A CPE with that identity already exists'}), 409

    username = (data.get('cwmp_username') or '').strip() or f'cpe-{serial_number.lower()}'
    password = data.get('cwmp_password') or secrets.token_urlsafe(18)

    device = CpeDevice(
        isp_id=isp_id,
        serial_key=serial_key,
        oui=oui,
        serial_number=serial_number,
        product_class=product_class,
        manufacturer=(data.get('manufacturer') or '').strip() or None,
        status='active',
        cwmp_username=username,
        cwmp_password_encrypted=encrypt_value(password),
    )
    db.session.add(device)
    db.session.commit()

    # The password is returned exactly once — it is never readable again.
    return jsonify({
        'message': 'CPE enrolled',
        'cpe': serialize_cpe(device),
        'credentials': {
            'acs_url': current_app.config.get('TR069_ACS_URL') or '(set TR069_ACS_URL)',
            'username': username,
            'password': password,
            'periodic_inform_interval': device.periodic_inform_interval,
        },
    }), 201


@cpe_bp.route('/profiles', methods=['GET'])
@jwt_required()
def list_profiles():
    """Vendor profiles the ACS knows, for the UI to explain what it can control."""
    return jsonify({'profiles': [{
        'key': p['key'],
        'label': p['label'],
        'root': p['root'],
        'supported_fields': sorted(p['params'].keys()),
    } for p in profiles.all_profiles()]}), 200
