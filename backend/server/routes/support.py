"""Operator support requests: contact-support messages, bug reports, feature requests.

Backs Settings → Contact Support and Features & Bug Report. Distinct from customer
`Ticket`s (which require a customer). Any authenticated staff user can submit and
see their own submissions; admins see and manage all.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required

from extensions import db
from auth_utils import get_current_user
from models import SupportRequest

support_bp = Blueprint('support', __name__, url_prefix='/api/support')

VALID_TYPES = ('support', 'bug', 'feature')
VALID_PRIORITIES = ('low', 'medium', 'high', 'urgent')
VALID_STATUSES = ('open', 'in_progress', 'resolved', 'closed')


@support_bp.route('/requests', methods=['GET'])
@jwt_required()
def list_requests():
    """List support requests — own submissions, or all for admins."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    req_type = request.args.get('type')
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    query = SupportRequest.query
    if user.role != 'admin':
        query = query.filter(SupportRequest.user_id == user.id)
    if req_type in VALID_TYPES:
        query = query.filter(SupportRequest.request_type == req_type)
    if status in VALID_STATUSES:
        query = query.filter(SupportRequest.status == status)

    paginated = query.order_by(SupportRequest.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return jsonify({
        'ok': True,
        'requests': [r.to_dict() for r in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page,
    }), 200


@support_bp.route('/requests', methods=['POST'])
@jwt_required()
def create_request():
    """Submit a support message, bug report, or feature request."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json() or {}
    subject = (data.get('subject') or '').strip()
    message = (data.get('message') or '').strip()
    if not subject or not message:
        return jsonify({'error': 'Subject and message are required'}), 400

    req_type = (data.get('type') or 'support').strip().lower()
    if req_type not in VALID_TYPES:
        return jsonify({'error': 'Invalid type'}), 400
    priority = (data.get('priority') or 'medium').strip().lower()
    if priority not in VALID_PRIORITIES:
        priority = 'medium'

    entry = SupportRequest(
        request_type=req_type,
        subject=subject[:255],
        message=message,
        priority=priority,
        status='open',
        user_id=user.id,
        isp_id=user.isp_id,
    )
    db.session.add(entry)
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Request submitted', 'request': entry.to_dict()}), 201


@support_bp.route('/requests/<int:request_id>', methods=['PUT'])
@jwt_required()
def update_request(request_id):
    """Update a request's status (admin only)."""
    user = get_current_user()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    entry = SupportRequest.query.get_or_404(request_id)
    data = request.get_json() or {}
    if 'status' in data:
        status = (data['status'] or '').strip().lower()
        if status not in VALID_STATUSES:
            return jsonify({'error': 'Invalid status'}), 400
        entry.status = status
    if 'priority' in data:
        priority = (data['priority'] or '').strip().lower()
        if priority in VALID_PRIORITIES:
            entry.priority = priority
    db.session.commit()
    return jsonify({'ok': True, 'message': 'Request updated', 'request': entry.to_dict()}), 200
