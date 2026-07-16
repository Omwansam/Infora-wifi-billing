"""RADIUS session visibility + control, backed by FreeRADIUS accounting (radacct).

FreeRADIUS writes accounting straight into radacct (SQL), so that table is the
source of truth for live sessions — the legacy radius_sessions table is only
fed by the HTTP fallback and stays empty on the FreeRADIUS path.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from extensions import db
from auth_utils import get_current_user
from models import ISP, MikrotikDevice, RadAcct
from datetime import datetime

radius_routes_bp = Blueprint('radius_routes', __name__, url_prefix='/api/radius-routes')


def _scoped_query(current_user):
    """radacct rows visible to this user (admin: all, else own ISP)."""
    query = RadAcct.query
    if current_user.role != 'admin':
        if not current_user.isp_id:
            return None
        query = query.filter(RadAcct.isp_id == current_user.isp_id)
    return query


def _device_label(record):
    """NAS name for the UI: linked device name, else the NAS IP itself."""
    if record.mikrotik_device:
        return record.mikrotik_device.device_name
    return record.nasipaddress


def _duration_seconds(record):
    if record.acctsessiontime:
        return int(record.acctsessiontime)
    if record.acctstarttime:
        end = record.acctstoptime or datetime.utcnow()
        return max(0, int((end - record.acctstarttime).total_seconds()))
    return 0


def serialize_radius_session(record):
    """Serialize a radacct row to the session shape the UI renders."""
    is_active = record.acctstoptime is None
    return {
        'id': record.radacctid,
        'session_id': record.acctsessionid,
        'username': record.username,
        'ip_address': record.framedipaddress,
        'mac_address': record.callingstationid,
        'nas_ip': record.nasipaddress,
        'session_start': record.acctstarttime.isoformat() if record.acctstarttime else None,
        'session_end': record.acctstoptime.isoformat() if record.acctstoptime else None,
        'bytes_in': int(record.acctinputoctets or 0),
        'bytes_out': int(record.acctoutputoctets or 0),
        'is_active': is_active,
        'duration': _duration_seconds(record),
        'terminate_cause': record.acctterminatecause,
        'customer_id': record.customer_id,
        'customer_name': record.customer.full_name if record.customer else None,
        'device_id': record.mikrotik_device_id,
        'device_name': _device_label(record),
        'isp_id': record.isp_id,
        'isp_name': record.isp.name if record.isp else None,
    }


@radius_routes_bp.route('/sessions', methods=['GET'])
@jwt_required()
def get_radius_sessions():
    """RADIUS sessions from radacct, with pagination and filtering."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        query = _scoped_query(current_user)
        if query is None:
            return jsonify({'error': 'User not associated with any ISP'}), 403

        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')  # active, inactive
        search = request.args.get('search')

        if status == 'active':
            query = query.filter(RadAcct.acctstoptime.is_(None))
        elif status == 'inactive':
            query = query.filter(RadAcct.acctstoptime.isnot(None))

        if search:
            search_term = f'%{search}%'
            query = query.filter(
                db.or_(
                    RadAcct.username.ilike(search_term),
                    RadAcct.acctsessionid.ilike(search_term),
                    RadAcct.framedipaddress.ilike(search_term),
                    RadAcct.nasipaddress.ilike(search_term),
                )
            )

        # Live sessions first, then most recent starts
        query = query.order_by(
            RadAcct.acctstoptime.isnot(None), RadAcct.acctstarttime.desc()
        )

        sessions = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'ok': True,
            'message': 'RADIUS sessions retrieved successfully',
            'data': {
                'sessions': [serialize_radius_session(s) for s in sessions.items],
                'total': sessions.total,
                'pages': sessions.pages,
                'current_page': page,
                'per_page': per_page,
            },
        }), 200

    except Exception as e:
        return jsonify({'ok': False, 'message': f'Error retrieving RADIUS sessions: {str(e)}'}), 500


@radius_routes_bp.route('/sessions/<int:session_id>', methods=['GET'])
@jwt_required()
def get_radius_session(session_id):
    """Get a specific radacct session."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        record = RadAcct.query.get_or_404(session_id)
        if current_user.role != 'admin' and record.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403

        return jsonify({
            'ok': True,
            'message': 'RADIUS session retrieved successfully',
            'data': serialize_radius_session(record),
        }), 200

    except Exception as e:
        return jsonify({'ok': False, 'message': f'Error retrieving RADIUS session: {str(e)}'}), 500


@radius_routes_bp.route('/sessions/active', methods=['GET'])
@jwt_required()
def get_active_sessions():
    """Live sessions only (acctstoptime IS NULL)."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        query = _scoped_query(current_user)
        if query is None:
            return jsonify({'error': 'User not associated with any ISP'}), 403

        records = (
            query.filter(RadAcct.acctstoptime.is_(None))
            .order_by(RadAcct.acctstarttime.desc())
            .limit(500)
            .all()
        )

        return jsonify({
            'ok': True,
            'message': 'Active sessions retrieved successfully',
            'data': {'sessions': [serialize_radius_session(r) for r in records]},
        }), 200

    except Exception as e:
        return jsonify({'ok': False, 'message': f'Error retrieving active sessions: {str(e)}'}), 500


def _resolve_session_device(record):
    """NAS router for a radacct row: linked device, else match by NAS IP."""
    if record.mikrotik_device:
        return record.mikrotik_device
    if not record.nasipaddress:
        return None
    query = MikrotikDevice.query.filter_by(is_active=True)
    if record.isp_id:
        query = query.filter_by(isp_id=record.isp_id)
    for device in query.all():
        mgmt_ip = (device.management_wg_ip or '').split('/')[0]
        if record.nasipaddress in (device.device_ip, mgmt_ip):
            return device
    return None


@radius_routes_bp.route('/sessions/terminate/<int:session_id>', methods=['POST'])
@jwt_required()
def terminate_session(session_id):
    """Terminate a live session: kick it on the router, then close the row."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        record = RadAcct.query.get_or_404(session_id)
        if current_user.role != 'admin' and record.isp_id != current_user.isp_id:
            return jsonify({'error': 'Access denied'}), 403

        if record.acctstoptime is not None:
            return jsonify({'ok': False, 'message': 'Session is already closed'}), 400

        # Kick the live session on the NAS (best-effort: the row is closed
        # either way; RouterOS also sends its own Accounting-Stop on kick).
        from services.hotspot_disconnect import disconnect_username_on_device, disconnect_customer_on_devices

        kicked = False
        detail = 'Router not reachable — session closed in accounting only'
        device = _resolve_session_device(record)
        if device:
            kicked = disconnect_username_on_device(record.username, device)
            detail = (
                f'Session kicked on {device.device_name}' if kicked
                else f'Could not reach {device.device_name} — session closed in accounting only'
            )
        elif record.customer and record.isp_id:
            isp = ISP.query.get(record.isp_id)
            count = disconnect_customer_on_devices(record.customer, isp)
            kicked = count > 0
            detail = f'Kick attempted on {count} router(s)' if kicked else detail

        now = datetime.utcnow()
        record.acctstoptime = now
        record.acctterminatecause = 'Admin-Reset'
        if record.acctstarttime and not record.acctsessiontime:
            record.acctsessiontime = max(0, int((now - record.acctstarttime).total_seconds()))
        db.session.commit()

        return jsonify({
            'ok': True,
            'message': f'Session terminated. {detail}',
            'data': {
                'session_id': record.acctsessionid,
                'kicked_on_router': kicked,
                'duration': _duration_seconds(record),
            },
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'message': f'Error terminating session: {str(e)}'}), 500


@radius_routes_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_radius_stats():
    """Accounting statistics from radacct."""
    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        query = _scoped_query(current_user)
        if query is None:
            return jsonify({'error': 'User not associated with any ISP'}), 403

        total_sessions = query.count()
        active_sessions = query.filter(RadAcct.acctstoptime.is_(None)).count()

        bytes_query = db.session.query(
            db.func.coalesce(
                db.func.sum(
                    db.func.coalesce(RadAcct.acctinputoctets, 0)
                    + db.func.coalesce(RadAcct.acctoutputoctets, 0)
                ),
                0,
            )
        )
        if current_user.role != 'admin':
            bytes_query = bytes_query.filter(RadAcct.isp_id == current_user.isp_id)
        total_bytes = int(bytes_query.scalar() or 0)

        return jsonify({
            'ok': True,
            'message': 'RADIUS statistics retrieved successfully',
            'data': {
                'total_sessions': total_sessions,
                'active_sessions': active_sessions,
                'inactive_sessions': total_sessions - active_sessions,
                'total_bytes': total_bytes,
                'total_gb': round(total_bytes / (1024 ** 3), 2),
            },
        }), 200

    except Exception as e:
        return jsonify({'ok': False, 'message': f'Error retrieving RADIUS statistics: {str(e)}'}), 500
