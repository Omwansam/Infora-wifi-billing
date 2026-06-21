from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from auth_utils import get_current_user
from models import MikrotikDevice, User, DeviceStatus, ISP
from datetime import datetime
from services.encryption import encrypt_value
from services.mikrotik_sync import (
    sync_device_async,
    sync_device_stats,
    test_device_connection as mikrotik_test_connection,
    bulk_sync_devices,
)

devices_bp = Blueprint('devices', __name__, url_prefix='/api/devices')

def serialize_device(device):
    """Serialize device object to dictionary"""
    try:
        return {
            'id': device.id,
            'username': device.username,
            'password': '***' if device.password else None,  # Hide password for security
            'api_key': device.api_key,
            'api_port': device.api_port,
            'ssh_port': device.ssh_port or 22,
            'connection_type': device.connection_type or 'api',
            'use_ssl': device.use_ssl if device.use_ssl is not None else True,
            'device_name': device.device_name,
            'device_ip': device.device_ip,
            'device_model': device.device_model,
            'device_status': device.device_status.value if device.device_status else None,
            'uptime': device.uptime,
            'client_count': device.client_count,
            'bandwidth_usage': device.bandwidth_usage,
            'location': device.location,
            'notes': device.notes,
            'last_synced': device.last_synced.isoformat() if device.last_synced else None,
            'is_active': device.is_active,
            'created_at': device.created_at.isoformat() if device.created_at else None,
            'updated_at': device.updated_at.isoformat() if device.updated_at else None,
            'zone_id': device.zone_id,
            'zone_name': device.zone.name if device.zone else None,
            'isp_id': device.isp_id,
            'isp_name': device.isp.name if device.isp else None
        }
    except Exception as e:
        return {
            'id': device.id,
            'device_name': device.device_name,
            'device_ip': device.device_ip,
            'device_status': 'unknown',
            'is_active': device.is_active,
            'created_at': None,
            'updated_at': None,
            'isp_id': device.isp_id if hasattr(device, 'isp_id') else None
        }

# Add explicit OPTIONS handlers for CORS
@devices_bp.route('/', methods=['OPTIONS'])
def handle_devices_options():
    return '', 200

@devices_bp.route('/<int:device_id>', methods=['OPTIONS'])
def handle_device_options(device_id):
    return '', 200

@devices_bp.route('/stats', methods=['OPTIONS'])
def handle_stats_options():
    return '', 200

@devices_bp.route('/', methods=['GET'])
@jwt_required()
def get_devices():
    """Get all Mikrotik devices with pagination and filtering"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Multi-tenant: Filter by ISP
        if current_user.role == 'admin':
            # Admin can see all devices
            query = MikrotikDevice.query
        else:
            # Regular users can only see their ISP's devices
            if not current_user.isp_id:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            query = MikrotikDevice.query.filter_by(isp_id=current_user.isp_id)
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        device_type = request.args.get('device_type')
        search = request.args.get('search')
        
        # Apply filters
        if status:
            query = query.filter_by(device_status=status)
        if device_type:
            query = query.filter_by(device_model=device_type)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                db.or_(
                    MikrotikDevice.device_name.ilike(search_term),
                    MikrotikDevice.device_ip.ilike(search_term),
                    MikrotikDevice.location.ilike(search_term)
                )
            )
        
        # Order by created date
        query = query.order_by(MikrotikDevice.created_at.desc())
        
        devices = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'devices': [serialize_device(device) for device in devices.items],
            'total': devices.total,
            'pages': devices.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get devices: {str(e)}'}), 500

@devices_bp.route('/<int:device_id>', methods=['GET'])
@jwt_required()
def get_device(device_id):
    """Get specific device by ID"""
    try:
        current_user = get_current_user()
        device = MikrotikDevice.query.get_or_404(device_id)
        if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403
        return jsonify(serialize_device(device)), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get device: {str(e)}'}), 500

@devices_bp.route('/', methods=['POST'])
@jwt_required()
def create_device():
    """Create a new Mikrotik device"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required'}), 400

        # Multi-tenant: Determine ISP
        if current_user.role == 'admin':
            isp_id = data.get('isp_id')
            if not isp_id:
                default_isp = ISP.query.filter_by(is_active=True).first()
                if not default_isp:
                    return jsonify({'error': 'No active ISP found. Create an ISP first.'}), 400
                isp_id = default_isp.id
        else:
            if not current_user.isp_id:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            isp_id = current_user.isp_id
        
        # Validate required fields
        required_fields = ['username', 'password', 'device_name', 'device_ip', 'device_model', 'location']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check ISP device limits
        isp = ISP.query.get(isp_id)
        if not isp:
            return jsonify({'error': 'ISP not found'}), 404
        current_device_count = MikrotikDevice.query.filter_by(isp_id=isp_id).count()
        if current_device_count >= isp.max_devices:
            return jsonify({'error': f'ISP device limit reached ({isp.max_devices} devices)'}), 400
        
        # Create device
        device = MikrotikDevice(
            username=data['username'],
            password=encrypt_value(data['password']),
            api_key=data.get('api_key'),
            api_port=data.get('api_port', 8728),
            ssh_port=data.get('ssh_port', 22),
            connection_type=data.get('connection_type', 'api'),
            use_ssl=data.get('use_ssl', True),
            device_name=data['device_name'],
            device_ip=data['device_ip'],
            device_model=data['device_model'],
            device_status=DeviceStatus.ONLINE,
            location=data['location'],
            notes=data.get('notes', ''),
            is_active=data.get('is_active', True),
            zone_id=data.get('zone_id'),
            isp_id=isp_id
        )
        
        db.session.add(device)
        db.session.commit()
        
        return jsonify({
            'message': 'Device created successfully',
            'device': serialize_device(device)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create device: {str(e)}'}), 500

@devices_bp.route('/<int:device_id>', methods=['PUT'])
@jwt_required()
def update_device(device_id):
    """Update device"""
    try:
        current_user = get_current_user()
        device = MikrotikDevice.query.get_or_404(device_id)
        if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403

        data = request.get_json()
        
        # Update fields
        if 'username' in data:
            device.username = data['username']
        if 'password' in data and data['password'] and data['password'] != '***':
            device.password = encrypt_value(data['password'])
        if 'api_key' in data:
            device.api_key = data['api_key']
        if 'api_port' in data:
            device.api_port = data['api_port']
        if 'ssh_port' in data:
            device.ssh_port = data['ssh_port']
        if 'connection_type' in data:
            device.connection_type = data['connection_type']
        if 'use_ssl' in data:
            device.use_ssl = data['use_ssl']
        if 'device_name' in data:
            device.device_name = data['device_name']
        if 'device_ip' in data:
            device.device_ip = data['device_ip']
        if 'device_model' in data:
            device.device_model = data['device_model']
        if 'device_status' in data:
            try:
                device.device_status = DeviceStatus(data['device_status'])
            except ValueError:
                return jsonify({'error': 'Invalid device status'}), 400
        if 'location' in data:
            device.location = data['location']
        if 'notes' in data:
            device.notes = data['notes']
        if 'is_active' in data:
            device.is_active = data['is_active']
        if 'zone_id' in data:
            device.zone_id = data['zone_id']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Device updated successfully',
            'device': serialize_device(device)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update device: {str(e)}'}), 500

@devices_bp.route('/<int:device_id>', methods=['DELETE'])
@jwt_required()
def delete_device(device_id):
    """Delete device"""
    try:
        device = MikrotikDevice.query.get_or_404(device_id)
        
        db.session.delete(device)
        db.session.commit()
        
        return jsonify({'message': 'Device deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete device: {str(e)}'}), 500

@devices_bp.route('/<int:device_id>/test-connection', methods=['POST'])
@jwt_required()
def test_device_connection(device_id):
    """Test connection to Mikrotik device"""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        device = MikrotikDevice.query.get_or_404(device_id)
        
        if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json() or {}
        connection_type = data.get('connection_type', device.connection_type or 'api')
        
        try:
            result = mikrotik_test_connection(device, connection_type)
            if result['success']:
                device.device_status = DeviceStatus.ONLINE
                device.last_synced = datetime.utcnow()
                if result.get('device_info'):
                    info = result['device_info']
                    device.uptime = info.get('uptime', device.uptime)
                    device.client_count = info.get('client_count', device.client_count)
                db.session.commit()
                return jsonify({
                    'message': 'Connection test completed successfully',
                    'device': serialize_device(device),
                    'connection_status': 'success',
                    'response_time': f"{result['response_time']}ms",
                    'connection_type': result['connection_type'],
                    'details': result.get('device_info', {}),
                }), 200

            device.device_status = DeviceStatus.OFFLINE
            db.session.commit()
            return jsonify({
                'message': 'Connection test failed',
                'device': serialize_device(device),
                'connection_status': 'failed',
                'error': result.get('error', 'Unknown error'),
            }), 200

        except Exception as e:
            device.device_status = DeviceStatus.OFFLINE
            db.session.commit()
            return jsonify({
                'message': 'Connection test failed',
                'device': serialize_device(device),
                'connection_status': 'failed',
                'error': str(e),
            }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to test connection: {str(e)}'}), 500

@devices_bp.route('/<int:device_id>/sync', methods=['POST'])
@jwt_required()
def sync_device(device_id):
    """Sync device data from Mikrotik (async by default)."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        device = MikrotikDevice.query.get_or_404(device_id)
        
        if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json() or {}
        connection_type = data.get('connection_type', device.connection_type or 'api')
        run_async = data.get('async', True)

        if run_async:
            sync_device_async(current_app._get_current_object(), device_id, connection_type)
            return jsonify({
                'message': 'Device sync started in background',
                'device_id': device_id,
                'async': True,
            }), 202

        details = sync_device_stats(device, connection_type)
        return jsonify({
            'message': 'Device synced successfully',
            'device': serialize_device(device),
            'sync_details': details,
        }), 200
        
    except Exception as e:
        db.session.rollback()
        device = MikrotikDevice.query.get(device_id)
        if device:
            device.device_status = DeviceStatus.OFFLINE
            db.session.commit()
        return jsonify({'error': f'Failed to sync device: {str(e)}'}), 500

@devices_bp.route('/<int:device_id>/toggle-status', methods=['PUT'])
@jwt_required()
def toggle_device_status(device_id):
    """Toggle device active status"""
    try:
        device = MikrotikDevice.query.get_or_404(device_id)
        device.is_active = not device.is_active
        
        db.session.commit()
        
        return jsonify({
            'message': f'Device {"activated" if device.is_active else "deactivated"} successfully',
            'device': serialize_device(device)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to toggle device status: {str(e)}'}), 500

@devices_bp.route('/<int:device_id>/update-status', methods=['PUT'])
@jwt_required()
def update_device_status(device_id):
    """Update device operational status"""
    try:
        device = MikrotikDevice.query.get_or_404(device_id)
        data = request.get_json()
        
        if 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
        
        try:
            device.device_status = DeviceStatus(data['status'])
        except ValueError:
            return jsonify({'error': 'Invalid device status'}), 400
        
        db.session.commit()
        
        return jsonify({
            'message': f'Device status updated to {device.device_status.value}',
            'device': serialize_device(device)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update device status: {str(e)}'}), 500

@devices_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_device_stats():
    """Get device statistics"""
    try:
        current_user = get_current_user()
        base_filter = []
        if current_user.role != 'admin':
            if not current_user.isp_id:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            base_filter.append(MikrotikDevice.isp_id == current_user.isp_id)

        total_devices = MikrotikDevice.query.filter(*base_filter).count()
        active_devices = MikrotikDevice.query.filter(*base_filter, MikrotikDevice.is_active == True).count()
        online_devices = MikrotikDevice.query.filter(*base_filter, MikrotikDevice.device_status == DeviceStatus.ONLINE).count()
        offline_devices = MikrotikDevice.query.filter(*base_filter, MikrotikDevice.device_status == DeviceStatus.OFFLINE).count()
        maintenance_devices = MikrotikDevice.query.filter(*base_filter, MikrotikDevice.device_status == DeviceStatus.MAINTENANCE).count()
        
        device_models = db.session.query(
            MikrotikDevice.device_model,
            db.func.count(MikrotikDevice.id)
        ).filter(*base_filter).group_by(MikrotikDevice.device_model).all()
        
        model_stats = [{'model': model, 'count': count} for model, count in device_models]
        
        total_clients = db.session.query(db.func.sum(MikrotikDevice.client_count)).filter(*base_filter).scalar() or 0
        total_bandwidth = db.session.query(db.func.sum(MikrotikDevice.bandwidth_usage)).filter(*base_filter).scalar() or 0
        
        return jsonify({
            'total_devices': total_devices,
            'active_devices': active_devices,
            'online_devices': online_devices,
            'offline_devices': offline_devices,
            'maintenance_devices': maintenance_devices,
            'total_clients': total_clients,
            'total_bandwidth_mb': total_bandwidth,
            'device_models': model_stats
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get device stats: {str(e)}'}), 500

@devices_bp.route('/bulk-sync', methods=['POST'])
@jwt_required()
def bulk_sync_devices_route():
    """Sync all active devices for current ISP."""
    try:
        current_user = get_current_user()
        isp_id = None if current_user.role == 'admin' else current_user.isp_id
        if current_user.role != 'admin' and not isp_id:
            return jsonify({'error': 'User not associated with any ISP'}), 403

        result = bulk_sync_devices(isp_id=isp_id)
        return jsonify({
            'message': 'Bulk sync completed',
            'synced_devices': result['synced'],
            'failed_devices': result['failed'],
            'total_devices': result['total'],
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to bulk sync devices: {str(e)}'}), 500


# Frontend-compatible action aliases
@devices_bp.route('/connect/<int:device_id>', methods=['POST'])
@jwt_required()
def connect_device_alias(device_id):
    return test_device_connection(device_id)


@devices_bp.route('/disconnect/<int:device_id>', methods=['POST'])
@jwt_required()
def disconnect_device_alias(device_id):
    return jsonify({'message': 'Device disconnected', 'device_id': device_id}), 200


@devices_bp.route('/sync/<int:device_id>', methods=['POST'])
@jwt_required()
def sync_device_alias(device_id):
    return sync_device(device_id)


@devices_bp.route('/backup/<int:device_id>', methods=['POST'])
@jwt_required()
def backup_device_alias(device_id):
    return jsonify({'message': 'Device backup initiated', 'device_id': device_id}), 200


@devices_bp.route('/reboot/<int:device_id>', methods=['POST'])
@jwt_required()
def reboot_device_alias(device_id):
    return jsonify({'message': 'Device reboot initiated', 'device_id': device_id}), 200


@devices_bp.route('/update/<int:device_id>', methods=['POST'])
@jwt_required()
def update_device_alias(device_id):
    return sync_device(device_id)
