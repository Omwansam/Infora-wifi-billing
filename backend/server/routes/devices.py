import json
import os
import secrets
from flask import Blueprint, request, jsonify, current_app, Response, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from auth_utils import get_current_user
from models import MikrotikDevice, User, DeviceStatus, ISP, DeviceBackup
from datetime import datetime, timedelta
from services.encryption import encrypt_value
from services.device_config_ops import (
    get_provision_status,
    list_interfaces,
    configure_services,
    check_firmware,
    upgrade_firmware,
    reboot_device,
    run_self_check,
    set_interface_disabled,
    interface_traffic,
    DeviceBusy,
)
from services.device_backups import (
    create_backup,
    list_backups,
    delete_backup,
    serialize_backup,
)
from services.rate_limit import rate_limit
from services.provisioning_scripts import build_radius_script, build_one_liner, resolve_provision_base_url
from services.mikrotik_sync import (
    sync_device_async,
    sync_device_stats,
    test_device_connection as mikrotik_test_connection,
    bulk_sync_devices,
)
from mikrotik_client import MikroTikAPIError, MikroTikSSHError
from services.radius_clients_export import sync_radius_clients_conf
from services.wireguard_management import (
    build_mikrotik_management_tunnel_script,
    deprovision_device_management_tunnel,
    provision_device_management_tunnel,
    resolve_radius_host_for_device,
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
            'os_version': getattr(device, 'os_version', None),
            'firmware_latest': getattr(device, 'firmware_latest', None),
            'last_backup_at': device.last_backup_at.isoformat() if getattr(device, 'last_backup_at', None) else None,
            'uptime': device.uptime,
            'client_count': device.client_count,
            'bandwidth_usage': device.bandwidth_usage,
            'cpu_load': getattr(device, 'cpu_load', None),
            'mem_total': getattr(device, 'mem_total', None),
            'mem_free': getattr(device, 'mem_free', None),
            'hdd_total': getattr(device, 'hdd_total', None),
            'hdd_free': getattr(device, 'hdd_free', None),
            'service_config': json.loads(device.service_config) if getattr(device, 'service_config', None) else None,
            'location': device.location,
            'notes': device.notes,
            'last_synced': device.last_synced.isoformat() if device.last_synced else None,
            'is_active': device.is_active,
            'management_wg_enabled': bool(getattr(device, 'management_wg_enabled', False)),
            'management_wg_ip': getattr(device, 'management_wg_ip', None),
            'monitored_interfaces': json.loads(device.monitored_interfaces) if getattr(device, 'monitored_interfaces', None) else [],
            'self_check_at': device.self_check_at.isoformat() if getattr(device, 'self_check_at', None) else None,
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

        data = request.get_json(silent=True)
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
        
        # Only the identity (device_name) is required in the wizard flow.
        # The NAS IP, model and location are auto-discovered: the NAS IP comes
        # from the management tunnel, and the model/version are read from the
        # router once it checks in (see /provision-status). Callers may still
        # pass them explicitly. username/password are auto-generated when absent.
        if not data.get('device_name'):
            return jsonify({'error': 'device_name is required'}), 400

        username = (data.get('username') or '').strip() or 'infora-mgmt'
        password = data.get('password') or secrets.token_urlsafe(18)
        device_model = (data.get('device_model') or '').strip() or 'Auto-detect'
        location = (data.get('location') or '').strip() or '—'
        explicit_ip = (data.get('device_ip') or '').strip()

        # Check ISP device limits
        isp = ISP.query.get(isp_id)
        if not isp:
            return jsonify({'error': 'ISP not found'}), 404
        current_device_count = MikrotikDevice.query.filter_by(isp_id=isp_id).count()
        if current_device_count >= isp.max_devices:
            return jsonify({'error': f'ISP device limit reached ({isp.max_devices} devices)'}), 400

        # Default to the management tunnel (Centipid-style) so the NAS IP and
        # remote access are assigned automatically without the operator typing them.
        wants_tunnel = bool(data.get('management_wg_enabled', True))

        # Create device
        device = MikrotikDevice(
            username=username,
            password=encrypt_value(password),
            api_key=data.get('api_key'),
            api_port=data.get('api_port', 8728),
            ssh_port=data.get('ssh_port', 22),
            connection_type=data.get('connection_type', 'api'),
            use_ssl=data.get('use_ssl', True),
            device_name=data['device_name'],
            device_ip=explicit_ip or '0.0.0.0',  # placeholder until tunnel/auto-detect
            device_model=device_model,
            device_status=DeviceStatus.OFFLINE,  # flips to ONLINE once the router checks in
            location=location,
            notes=data.get('notes', ''),
            is_active=data.get('is_active', True),
            zone_id=data.get('zone_id'),
            isp_id=isp_id,
            management_wg_enabled=wants_tunnel,
        )

        db.session.add(device)
        db.session.flush()

        if wants_tunnel:
            try:
                provision_device_management_tunnel(device)
                # The tunnel IP is the NAS IP that FreeRADIUS sees for this router.
                if not explicit_ip and device.management_wg_ip:
                    device.device_ip = device.management_wg_ip.split('/')[0]
            except Exception as tunnel_err:  # WG infra unavailable — degrade gracefully
                current_app.logger.warning('Management tunnel provisioning failed: %s', tunnel_err)
                device.management_wg_enabled = False

        db.session.commit()

        try:
            sync_radius_clients_conf()
        except OSError as sync_err:
            current_app.logger.warning('Failed to sync RADIUS clients.conf: %s', sync_err)
        
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

        data = request.get_json(silent=True) or {}

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

        if 'management_wg_enabled' in data:
            want_mgmt = bool(data['management_wg_enabled'])
            if want_mgmt and not device.management_wg_enabled:
                provision_device_management_tunnel(device)
            elif not want_mgmt and device.management_wg_enabled:
                deprovision_device_management_tunnel(device)
            else:
                device.management_wg_enabled = want_mgmt
        
        db.session.commit()

        try:
            sync_radius_clients_conf()
        except OSError as sync_err:
            current_app.logger.warning('Failed to sync RADIUS clients.conf: %s', sync_err)
        
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

        if device.management_wg_enabled:
            deprovision_device_management_tunnel(device)

        # Detach/clean rows that FK to this device without ON DELETE CASCADE, or
        # the delete fails: radius_sessions.mikrotik_device_id is NOT NULL (so the
        # rows must be removed); the rest are nullable history we keep by nulling
        # the reference.
        from models import RadiusSession, RadAcct, HotspotAccessCode, WireGuardServer
        RadiusSession.query.filter_by(mikrotik_device_id=device.id).delete(synchronize_session=False)
        RadAcct.query.filter_by(mikrotik_device_id=device.id).update(
            {'mikrotik_device_id': None}, synchronize_session=False)
        HotspotAccessCode.query.filter_by(device_id=device.id).update(
            {'device_id': None}, synchronize_session=False)
        WireGuardServer.query.filter_by(mikrotik_device_id=device.id).update(
            {'mikrotik_device_id': None}, synchronize_session=False)

        db.session.delete(device)
        db.session.commit()

        try:
            sync_radius_clients_conf()
        except OSError as sync_err:
            current_app.logger.warning('Failed to sync RADIUS clients.conf: %s', sync_err)
        
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
        
        data = request.get_json(silent=True) or {}
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
        
        data = request.get_json(silent=True) or {}
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

    except DeviceBusy:
        # Another operation holds the router — it's reachable, so keep the
        # current status and let the caller retry shortly.
        db.session.rollback()
        device = MikrotikDevice.query.get(device_id)
        return jsonify({
            'message': 'Device is busy with another operation — try again shortly',
            'busy': True,
            'device': serialize_device(device) if device else None,
        }), 200

    except (MikroTikAPIError, MikroTikSSHError) as conn_err:
        # Router unreachable is an expected operational state (e.g. tunnel not
        # up yet) — report it as "offline" with 200 so the UI shows status
        # instead of throwing on a 500.
        db.session.rollback()
        device = MikrotikDevice.query.get(device_id)
        if device:
            device.device_status = DeviceStatus.OFFLINE
            db.session.commit()
        return jsonify({
            'message': 'Device is unreachable',
            'reachable': False,
            'device': serialize_device(device) if device else None,
            'error': str(conn_err),
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
        data = request.get_json(silent=True) or {}

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


def _device_for_user(device_id):
    """Fetch a device + enforce tenant scoping. Returns (device, error_response)."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if not current_user:
        return None, (jsonify({'error': 'User not found'}), 404)
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return None, (jsonify({'error': 'Access denied'}), 403)
    return device, None


@devices_bp.route('/<int:device_id>/backup', methods=['POST'])
@devices_bp.route('/backup/<int:device_id>', methods=['POST'])
@rate_limit(limit=10, window=60, scope='device-backup')
@jwt_required()
def backup_device_route(device_id):
    """Export the RouterOS config over SSH and store it on the server."""
    device, err = _device_for_user(device_id)
    if err:
        return err
    try:
        current_user = get_current_user()
        backup = create_backup(device, user_id=current_user.id if current_user else None)
        db.session.commit()
        return jsonify({
            'message': 'Backup created',
            'backup': serialize_backup(backup),
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Backup failed: {str(e)}'}), 502


@devices_bp.route('/<int:device_id>/backups', methods=['GET'])
@jwt_required()
def list_device_backups(device_id):
    """List stored config backups for a device (newest first)."""
    device, err = _device_for_user(device_id)
    if err:
        return err
    backups = list_backups(device.id)
    return jsonify({'backups': [serialize_backup(b) for b in backups]}), 200


@devices_bp.route('/backups/<int:backup_id>/download', methods=['GET'])
@jwt_required()
def download_device_backup(backup_id):
    """Download a stored backup file."""
    backup = DeviceBackup.query.get_or_404(backup_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and backup.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403
    if not backup.storage_path or not os.path.isfile(backup.storage_path):
        return jsonify({'error': 'Backup file not found on server'}), 404
    return send_file(
        backup.storage_path,
        as_attachment=True,
        download_name=backup.filename,
        mimetype='text/plain',
    )


@devices_bp.route('/backups/<int:backup_id>', methods=['DELETE'])
@jwt_required()
def delete_device_backup(backup_id):
    """Delete a stored backup (file + record)."""
    backup = DeviceBackup.query.get_or_404(backup_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and backup.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403
    delete_backup(backup)
    return jsonify({'message': 'Backup deleted'}), 200


@devices_bp.route('/<int:device_id>/reboot', methods=['POST'])
@devices_bp.route('/reboot/<int:device_id>', methods=['POST'])
@rate_limit(limit=5, window=300, scope='device-reboot')
@jwt_required()
def reboot_device_route(device_id):
    """Reboot the router over SSH."""
    device, err = _device_for_user(device_id)
    if err:
        return err
    result = reboot_device(device)
    if result.get('success'):
        device.device_status = DeviceStatus.MAINTENANCE
        db.session.commit()
    return jsonify(result), (200 if result.get('success') else 502)


@devices_bp.route('/<int:device_id>/firmware/check', methods=['POST'])
@devices_bp.route('/update/<int:device_id>', methods=['POST'])
@rate_limit(limit=10, window=60, scope='firmware-check')
@jwt_required()
def firmware_check_route(device_id):
    """Check whether a newer RouterOS version is available and persist versions."""
    device, err = _device_for_user(device_id)
    if err:
        return err
    try:
        info = check_firmware(device)
    except Exception as e:
        return jsonify({'error': f'Firmware check failed: {str(e)}'}), 502

    if info.get('installed'):
        device.os_version = info['installed']
    if info.get('latest'):
        device.firmware_latest = info['latest']
    db.session.commit()

    return jsonify(info), 200


@devices_bp.route('/<int:device_id>/firmware/upgrade', methods=['POST'])
@rate_limit(limit=5, window=300, scope='firmware-upgrade')
@jwt_required()
def firmware_upgrade_route(device_id):
    """Trigger a full RouterOS upgrade (install + reboot)."""
    device, err = _device_for_user(device_id)
    if err:
        return err
    result = upgrade_firmware(device)
    if result.get('success'):
        device.device_status = DeviceStatus.MAINTENANCE
        db.session.commit()
    return jsonify(result), (200 if result.get('success') else 502)


@devices_bp.route('/<int:device_id>/maintenance', methods=['PUT'])
@jwt_required()
def set_device_maintenance(device_id):
    """Put a device into / out of maintenance mode."""
    device, err = _device_for_user(device_id)
    if err:
        return err
    payload = request.get_json(silent=True) or {}
    enable = bool(payload.get('maintenance', True))
    device.device_status = DeviceStatus.MAINTENANCE if enable else DeviceStatus.OFFLINE
    db.session.commit()
    return jsonify({
        'message': 'Maintenance mode ' + ('enabled' if enable else 'disabled'),
        'device': serialize_device(device),
    }), 200


@devices_bp.route('/<int:device_id>/radius-script', methods=['GET'])
@jwt_required()
def download_radius_script(device_id):
    """Return MikroTik .rsc script with device-specific RADIUS settings."""
    device = MikrotikDevice.query.get_or_404(device_id)

    try:
        script = build_radius_script(device)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    filename = f'infora-radius-{device.device_name.replace(" ", "-")}.rsc'
    return Response(
        script,
        mimetype='text/plain',
        headers={'Content-Disposition': f'attachment; filename={filename}'},
    )


@devices_bp.route('/<int:device_id>/provision-token', methods=['POST'])
@jwt_required()
def mint_provision_token(device_id):
    """Generate or rotate the one-line self-provisioning token for a device."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    isp = ISP.query.get(device.isp_id) if device.isp_id else None
    if not isp or not isp.radius_secret:
        return jsonify({'error': 'ISP has no RADIUS secret configured'}), 400

    payload = request.get_json(silent=True) or {}
    hours = payload.get('expires_in_hours') if isinstance(payload, dict) else None
    if hours is not None:
        try:
            hours = int(hours)
            if hours <= 0:
                hours = None
        except (TypeError, ValueError):
            return jsonify({'error': 'expires_in_hours must be a positive integer'}), 400

    device.provision_token = MikrotikDevice.generate_provision_token()
    device.provision_token_expires_at = (
        datetime.now() + timedelta(hours=hours) if hours else None
    )
    device.provision_fetch_count = 0
    device.provision_last_fetched_at = None
    db.session.commit()

    base_url = resolve_provision_base_url()
    return jsonify({
        'success': True,
        'provision_token': device.provision_token,
        'expires_at': device.provision_token_expires_at.isoformat() if device.provision_token_expires_at else None,
        'one_liner': build_one_liner(device),
        'warning': None if base_url else (
            'PROVISION_BASE_URL / PUBLIC_SERVER_HOST not set — the command host is incomplete. '
            'Set PROVISION_BASE_URL to your HTTPS domain.'
        ),
    }), 200


@devices_bp.route('/<int:device_id>/provision-token', methods=['DELETE'])
@jwt_required()
def revoke_provision_token(device_id):
    """Revoke a device's self-provisioning token."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    device.provision_token = None
    device.provision_token_expires_at = None
    db.session.commit()
    return jsonify({'success': True, 'message': 'Provision token revoked'}), 200


@devices_bp.route('/<int:device_id>/provision-status', methods=['GET'])
@jwt_required()
def device_provision_status(device_id):
    """Has the router pulled its script and is it reachable? (wizard Step 2 polling)"""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    status = get_provision_status(device)
    dirty = False

    # Promote device status to ONLINE once it is reachable.
    if status['online'] and device.device_status != DeviceStatus.ONLINE:
        device.device_status = DeviceStatus.ONLINE
        device.last_seen = datetime.now()
        dirty = True

    # Auto-fill the model from what the router reports (operator never types it).
    detected = status.get('detected') or {}
    if detected.get('model') and (not device.device_model or device.device_model == 'Auto-detect'):
        device.device_model = detected['model'][:50]
        dirty = True

    # First time the router becomes reachable, run the configuration
    # self-check automatically and cache the result on the device.
    if status['reachable'] and not device.self_check_result:
        try:
            result = run_self_check(device)
            device.self_check_result = json.dumps(result)
            device.self_check_at = datetime.now()
            status['stages']['self_check'] = {'done': True, **result}
            status['complete'] = (
                status['stages']['script_fetched']['done']
                and (status['stages']['tunnel_up']['done'] or not status['stages']['tunnel_up']['applicable'])
                and result.get('ok', False)
            )
            dirty = True
        except Exception as exc:
            current_app.logger.warning('Auto self-check failed for device %s: %s', device.id, exc)

    if dirty:
        db.session.commit()

    return jsonify(status), 200


@devices_bp.route('/<int:device_id>/self-check', methods=['POST'])
@jwt_required()
def device_self_check(device_id):
    """Run the on-router configuration self-check ("Re-run self-check")."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    try:
        result = run_self_check(device)
    except Exception as exc:
        return jsonify({'error': f'Self-check failed: {exc}', 'checks': []}), 502

    device.self_check_result = json.dumps(result)
    device.self_check_at = datetime.now()
    db.session.commit()
    return jsonify(result), 200


@devices_bp.route('/<int:device_id>/interfaces', methods=['GET'])
@jwt_required()
def device_interfaces(device_id):
    """Full interface discovery: port map + device summary (wizard Ports step)."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    try:
        discovery = list_interfaces(device)
    except Exception as exc:
        return jsonify({'error': f'Could not read interfaces: {exc}', 'interfaces': []}), 502

    discovery['monitored'] = (
        json.loads(device.monitored_interfaces) if device.monitored_interfaces else []
    )
    return jsonify(discovery), 200


@devices_bp.route('/<int:device_id>/interfaces/traffic', methods=['GET'])
@jwt_required()
def device_interface_traffic(device_id):
    """Interface byte counters — clients poll and derive per-port rates."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    try:
        data = interface_traffic(device)
    except Exception as exc:
        return jsonify({'error': f'Could not read traffic counters: {exc}', 'stats': []}), 502

    return jsonify(data), 200


@devices_bp.route('/<int:device_id>/interfaces/monitor', methods=['PUT'])
@jwt_required()
def device_set_monitored_interfaces(device_id):
    """Persist which ports the operator chose to monitor (wizard Ports step)."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    payload = request.get_json(silent=True) or {}
    names = payload.get('interfaces')
    if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
        return jsonify({'error': 'interfaces must be a list of interface names'}), 400

    device.monitored_interfaces = json.dumps(names)
    db.session.commit()
    return jsonify({'success': True, 'monitored': names}), 200


@devices_bp.route('/<int:device_id>/interfaces/<path:interface_name>/toggle', methods=['POST'])
@jwt_required()
def device_toggle_interface(device_id, interface_name):
    """Enable/disable a router port (uplink is refused server-side)."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    payload = request.get_json(silent=True) or {}
    disabled = bool(payload.get('disabled'))

    try:
        iface = set_interface_disabled(device, interface_name, disabled)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:
        return jsonify({'error': f'Could not update interface: {exc}'}), 502

    return jsonify({'success': True, 'interface': iface}), 200


@devices_bp.route('/<int:device_id>/configure-services', methods=['POST'])
@jwt_required()
def device_configure_services(device_id):
    """Push bridge/pool/DHCP/PPPoE/Hotspot config to the router (wizard Step 3)."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    payload = request.get_json(silent=True) or {}
    opts = {
        'pppoe': bool(payload.get('pppoe')),
        'hotspot': bool(payload.get('hotspot')),
        'anti_sharing': bool(payload.get('anti_sharing')),
        'bridge_ports': payload.get('bridge_ports') or [],
        'subnet': payload.get('subnet') or '172.31.0.0/16',
    }

    result = configure_services(device, opts)

    if result.get('success'):
        device.service_config = json.dumps({**opts, 'summary': result.get('summary')})
        db.session.commit()

    return jsonify(result), (200 if result.get('success') else 502)


@devices_bp.route('/<int:device_id>/management-tunnel-script', methods=['GET'])
@jwt_required()
def download_management_tunnel_script(device_id):
    """Return MikroTik .rsc for management WireGuard tunnel to billing host."""
    device = MikrotikDevice.query.get_or_404(device_id)
    current_user = get_current_user()
    if current_user.role != 'admin' and device.isp_id != current_user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    if not device.management_wg_enabled:
        provision_device_management_tunnel(device)
        try:
            sync_radius_clients_conf()
        except OSError as sync_err:
            current_app.logger.warning('Failed to sync RADIUS clients.conf: %s', sync_err)
        db.session.commit()

    try:
        script = build_mikrotik_management_tunnel_script(device)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    filename = f'infora-mgmt-tunnel-{device.device_name.replace(" ", "-")}.rsc'
    return Response(
        script,
        mimetype='text/plain',
        headers={'Content-Disposition': f'attachment; filename={filename}'},
    )
