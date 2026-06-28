from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from auth_utils import get_current_user
from services.fup_monitoring import get_fup_monitor_rows

monitoring_bp = Blueprint('monitoring', __name__, url_prefix='/api/monitoring')


@monitoring_bp.route('/fup', methods=['OPTIONS'])
def fup_monitor_options():
    return '', 200


@monitoring_bp.route('/fup', methods=['GET'])
@jwt_required()
def fup_monitor():
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    connection_type = (request.args.get('connection_type') or 'all').strip().lower()
    status_filter = (request.args.get('status') or 'all').strip().lower()
    search = (request.args.get('search') or '').strip()

    if connection_type not in ('all', 'pppoe', 'hotspot'):
        return jsonify({'error': 'Invalid connection_type'}), 400
    if status_filter not in ('all', 'warning', 'exceeded', 'throttled', 'fup_enabled'):
        return jsonify({'error': 'Invalid status'}), 400

    isp_id = user.isp_id if user.role != 'admin' and user.isp_id else None

    try:
        rows, summary = get_fup_monitor_rows(
            isp_id=isp_id,
            connection_type=connection_type,
            status_filter=status_filter,
            search=search,
        )
    except Exception as exc:
        return jsonify({'error': 'Failed to load FUP monitor data', 'detail': str(exc)}), 500

    return jsonify({
        'ok': True,
        'generated_at': datetime.now().isoformat(),
        'data': {
            'accounts': rows,
            'summary': summary,
        },
    }), 200
