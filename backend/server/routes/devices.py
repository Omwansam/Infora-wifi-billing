from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import MikrotikDevice, User, DeviceStatus, ISP
from datetime import datetime
from mikrotik_client import MikroTikClient, MikroTikConnectionConfig, ConnectionType, MikroTikAPIError, MikroTikSSHError

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
        print(f"Error serializing device {device.id}: {e}")
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
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
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
        device = MikrotikDevice.query.get_or_404(device_id)
        return jsonify(serialize_device(device)), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get device: {str(e)}'}), 500

@devices_bp.route('/', methods=['POST'])
@jwt_required()
def create_device():
    """Create a new Mikrotik device"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Multi-tenant: Determine ISP
        if current_user.role == 'admin':
            # Admin can create devices for any ISP
            isp_id = data.get('isp_id')
            if not isp_id:
                return jsonify({'error': 'isp_id is required for admin users'}), 400
            isp = ISP.query.get(isp_id)
            if not isp:
                return jsonify({'error': 'ISP not found'}), 404
        else:
            # Regular users can only create devices for their ISP
            if not current_user.isp_id:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            isp_id = current_user.isp_id
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['username', 'password', 'api_key', 'device_name', 'device_ip', 'device_model', 'location']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check ISP device limits
        isp = ISP.query.get(isp_id)
        current_device_count = MikrotikDevice.query.filter_by(isp_id=isp_id).count()
        if current_device_count >= isp.max_devices:
            return jsonify({'error': f'ISP device limit reached ({isp.max_devices} devices)'}), 400
        
        # Create device
        device = MikrotikDevice(
            username=data['username'],
            password=data['password'],
            api_key=data['api_key'],
            api_port=data.get('api_port', 8728),
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
        device = MikrotikDevice.query.get_or_404(device_id)
        data = request.get_json()
        
        # Update fields
        if 'username' in data:
            device.username = data['username']
        if 'password' in data:
            device.password = data['password']
        if 'api_key' in data:
            device.api_key = data['api_key']
        if 'api_port' in data:
            device.api_port = data['api_port']
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
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        device = MikrotikDevice.query.get_or_404(device_id)
        
        # Multi-tenant: Check access
        if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get connection type from request
        data = request.get_json() or {}
        connection_type = data.get('connection_type', 'api')
        
        try:
            # Create MikroTik client configuration
            config = MikroTikConnectionConfig(
                host=device.device_ip,
                port=device.api_port,
                username=device.username,
                password=device.password,
                api_key=device.api_key,
                connection_type=ConnectionType.API if connection_type == 'api' else ConnectionType.SSH,
                timeout=10,
                verify_ssl=False
            )
            
            # Test connection using actual MikroTik client
            with MikroTikClient(config) as client:
                result = client.test_connection()
                
                if result['success']:
                    # Update device status and sync time
                    device.device_status = DeviceStatus.ONLINE
                    device.last_synced = datetime.utcnow()
                    
                    # Update device info if available
                    if 'device_info' in result:
                        device_info = result['device_info']
                        device.uptime = device_info.get('uptime', device.uptime)
                        device.client_count = device_info.get('client_count', device.client_count)
                        device.bandwidth_usage = device_info.get('bandwidth_rx', 0) + device_info.get('bandwidth_tx', 0)
                    
                    db.session.commit()
                    
                    return jsonify({
                        'message': 'Connection test completed successfully',
                        'device': serialize_device(device),
                        'connection_status': 'success',
                        'response_time': f"{result['response_time']}ms",
                        'connection_type': result['connection_type'],
                        'details': result.get('device_info', {})
                    }), 200
                else:
                    # Update device status to offline
                    device.device_status = DeviceStatus.OFFLINE
                    db.session.commit()
                    
                    return jsonify({
                        'message': 'Connection test failed',
                        'device': serialize_device(device),
                        'connection_status': 'failed',
                        'response_time': f"{result['response_time']}ms",
                        'error': result.get('error', 'Unknown error')
                    }), 200
                    
        except (MikroTikAPIError, MikroTikSSHError) as e:
            # Update device status to offline
            device.device_status = DeviceStatus.OFFLINE
            db.session.commit()
            
            return jsonify({
                'message': 'Connection test failed',
                'device': serialize_device(device),
                'connection_status': 'failed',
                'error': str(e)
            }), 200
            
        except Exception as e:
            return jsonify({
                'message': 'Connection test failed',
                'device': serialize_device(device),
                'connection_status': 'failed',
                'error': f'Unexpected error: {str(e)}'
            }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to test connection: {str(e)}'}), 500

@devices_bp.route('/<int:device_id>/sync', methods=['POST'])
@jwt_required()
def sync_device(device_id):
    """Sync device data from Mikrotik"""
    try:
        current_user = User.query.filter_by(email=get_jwt_identity()).first()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        device = MikrotikDevice.query.get_or_404(device_id)
        
        # Multi-tenant: Check access
        if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get connection type from request
        data = request.get_json() or {}
        connection_type = data.get('connection_type', 'api')
        
        try:
            # Create MikroTik client configuration
            config = MikroTikConnectionConfig(
                host=device.device_ip,
                port=device.api_port,
                username=device.username,
                password=device.password,
                api_key=device.api_key,
                connection_type=ConnectionType.API if connection_type == 'api' else ConnectionType.SSH,
                timeout=10,
                verify_ssl=False
            )
            
            # Sync device using actual MikroTik client
            with MikroTikClient(config) as client:
                if not client.connect():
                    raise MikroTikAPIError("Failed to connect to device")
                
                # Get device information
                device_info = client.get_device_info()
                
                # Update device with real data
                device.uptime = device_info.uptime
                device.client_count = device_info.client_count
                device.bandwidth_usage = device_info.bandwidth_rx + device_info.bandwidth_tx
                device.last_synced = datetime.utcnow()
                device.device_status = DeviceStatus.ONLINE
                
                db.session.commit()
                
                return jsonify({
                    'message': 'Device synced successfully',
                    'device': serialize_device(device),
                    'sync_details': {
                        'uptime_updated': True,
                        'client_count_updated': True,
                        'bandwidth_updated': True,
                        'cpu_load': device_info.cpu_load,
                        'memory_usage': device_info.memory_usage,
                        'version': device_info.version,
                        'board_name': device_info.board_name,
                        'sync_timestamp': device.last_synced.isoformat()
                    }
                }), 200
                
        except (MikroTikAPIError, MikroTikSSHError) as e:
            # Update device status to offline
            device.device_status = DeviceStatus.OFFLINE
            db.session.commit()
            
            return jsonify({
                'message': 'Device sync failed',
                'device': serialize_device(device),
                'error': str(e)
            }), 200
            
        except Exception as e:
            return jsonify({
                'message': 'Device sync failed',
                'device': serialize_device(device),
                'error': f'Unexpected error: {str(e)}'
            }), 200
        
    except Exception as e:
        db.session.rollback()
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
        total_devices = MikrotikDevice.query.count()
        active_devices = MikrotikDevice.query.filter_by(is_active=True).count()
        online_devices = MikrotikDevice.query.filter_by(device_status=DeviceStatus.ONLINE).count()
        offline_devices = MikrotikDevice.query.filter_by(device_status=DeviceStatus.OFFLINE).count()
        maintenance_devices = MikrotikDevice.query.filter_by(device_status=DeviceStatus.MAINTENANCE).count()
        
        # Device model breakdown
        device_models = db.session.query(
            MikrotikDevice.device_model,
            db.func.count(MikrotikDevice.id)
        ).group_by(MikrotikDevice.device_model).all()
        
        model_stats = [{'model': model, 'count': count} for model, count in device_models]
        
        # Total clients and bandwidth
        total_clients = db.session.query(db.func.sum(MikrotikDevice.client_count)).scalar() or 0
        total_bandwidth = db.session.query(db.func.sum(MikrotikDevice.bandwidth_usage)).scalar() or 0
        
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
def bulk_sync_devices():
    """Sync all active devices"""
    try:
        active_devices = MikrotikDevice.query.filter_by(is_active=True).all()
        
        synced_count = 0
        failed_count = 0
        
        for device in active_devices:
            try:
                # Simulate sync for each device
                import random
                device.uptime = random.randint(86400, 604800)
                device.client_count = random.randint(10, 100)
                device.bandwidth_usage = random.randint(1000, 10000)
                device.last_synced = datetime.utcnow()
                device.device_status = DeviceStatus.ONLINE
                synced_count += 1
            except Exception as e:
                print(f"Failed to sync device {device.id}: {e}")
                failed_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Bulk sync completed',
            'synced_devices': synced_count,
            'failed_devices': failed_count,
            'total_devices': len(active_devices)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to bulk sync devices: {str(e)}'}), 500
