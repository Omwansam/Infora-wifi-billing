import secrets
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_, func
from extensions import db
from models import Ticket, TicketMessage, Customer, TicketStatus, TicketPriority
from auth_utils import get_current_user

tickets_bp = Blueprint('tickets', __name__, url_prefix='/api/tickets')

CLOSED_STATUSES = (TicketStatus.RESOLVED, TicketStatus.CLOSED)


def _scoped_query():
    """Tickets visible to the current user (admins see all, else own ISP)."""
    query = Ticket.query.join(Customer)
    user = get_current_user()
    if user and user.role != 'admin' and user.isp_id:
        query = query.filter(Customer.isp_id == user.isp_id)
    return query


def _can_access(ticket):
    user = get_current_user()
    if not user:
        return False
    if user.role == 'admin':
        return True
    return bool(ticket.customer and ticket.customer.isp_id == user.isp_id)


def serialize_message(msg):
    return {
        'id': msg.id,
        'message': msg.message,
        'is_internal': bool(msg.is_internal),
        'createdAt': msg.created_at.isoformat() if msg.created_at else None,
    }


def serialize_ticket(ticket, with_messages=False):
    data = {
        'id': ticket.ticket_number,
        'ticket_id': ticket.id,
        'customerName': ticket.customer.full_name if ticket.customer else 'Unknown',
        'customerId': ticket.customer_id,
        'customerEmail': ticket.customer.email if ticket.customer else None,
        'customerPhone': ticket.customer.phone if ticket.customer else None,
        'subject': ticket.ticket_subject,
        'description': ticket.ticket_description,
        'status': ticket.ticket_status.value if ticket.ticket_status else 'open',
        'priority': ticket.priority.value if ticket.priority else 'medium',
        'category': ticket.category,
        'assignedTo': ticket.resolved_by,
        'resolvedAt': ticket.resolved_at.isoformat() if ticket.resolved_at else None,
        'resolvedNote': ticket.resolved_note,
        'messageCount': len(ticket.messages) if ticket.messages is not None else 0,
        'createdAt': ticket.created_at.isoformat() if ticket.created_at else None,
        'updatedAt': ticket.updated_at.isoformat() if ticket.updated_at else None,
    }
    if with_messages:
        data['messages'] = [
            serialize_message(m)
            for m in sorted(ticket.messages, key=lambda m: m.created_at or datetime.min)
        ]
    return data


@tickets_bp.route('/', methods=['GET'])
@tickets_bp.route('', methods=['GET'])
@jwt_required()
def get_tickets():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        priority = request.args.get('priority')
        search = request.args.get('search')

        query = _scoped_query()

        if status and status != 'all':
            try:
                query = query.filter(Ticket.ticket_status == TicketStatus(status))
            except ValueError:
                return jsonify({'error': 'Invalid status value'}), 400

        if priority and priority != 'all':
            try:
                query = query.filter(Ticket.priority == TicketPriority(priority))
            except ValueError:
                return jsonify({'error': 'Invalid priority value'}), 400

        if search:
            term = f'%{search}%'
            query = query.filter(
                or_(
                    Ticket.ticket_number.ilike(term),
                    Ticket.ticket_subject.ilike(term),
                    Customer.full_name.ilike(term),
                )
            )

        tickets = query.order_by(Ticket.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        return jsonify({
            'tickets': [serialize_ticket(t) for t in tickets.items],
            'total': tickets.total,
            'pages': tickets.pages,
            'current_page': page,
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get tickets: {str(e)}'}), 500


@tickets_bp.route('/stats', methods=['GET'])
@jwt_required()
def ticket_stats():
    """Live counts for the tickets dashboard header."""
    try:
        base = _scoped_query()

        def count_status(s):
            return base.filter(Ticket.ticket_status == s).count()

        total = base.count()
        open_count = count_status(TicketStatus.OPEN)
        pending = count_status(TicketStatus.PENDING) + count_status(TicketStatus.IN_PROGRESS) + count_status(TicketStatus.ON_HOLD)
        resolved = count_status(TicketStatus.RESOLVED) + count_status(TicketStatus.CLOSED)
        high = base.filter(Ticket.priority.in_([TicketPriority.HIGH, TicketPriority.CRITICAL])).count()
        resolution_rate = round((resolved / total) * 100, 1) if total else 0.0

        return jsonify({
            'total': total,
            'open': open_count,
            'pending': pending,
            'resolved': resolved,
            'high_priority': high,
            'resolution_rate': resolution_rate,
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get stats: {str(e)}'}), 500


@tickets_bp.route('/<int:ticket_id>', methods=['GET'])
@jwt_required()
def get_ticket(ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)
        if not _can_access(ticket):
            return jsonify({'error': 'Access denied'}), 403
        return jsonify(serialize_ticket(ticket, with_messages=True)), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get ticket: {str(e)}'}), 500


def _gen_ticket_number():
    return f"TKT-{datetime.utcnow():%y%m%d}-{secrets.token_hex(2).upper()}"


@tickets_bp.route('/', methods=['POST'])
@tickets_bp.route('', methods=['POST'])
@jwt_required()
def create_ticket():
    try:
        data = request.get_json(silent=True) or {}
        customer_id = data.get('customer_id')
        subject = (data.get('subject') or '').strip()
        description = (data.get('description') or '').strip()
        if not customer_id or not subject or not description:
            return jsonify({'error': 'customer_id, subject and description are required'}), 400

        customer = Customer.query.get(customer_id)
        if not customer:
            return jsonify({'error': 'Customer not found'}), 404
        user = get_current_user()
        if user and user.role != 'admin' and user.isp_id and customer.isp_id != user.isp_id:
            return jsonify({'error': 'Access denied'}), 403

        try:
            priority = TicketPriority(data.get('priority', 'medium'))
        except ValueError:
            return jsonify({'error': 'Invalid priority'}), 400

        # Unique ticket number (retry once on the rare collision).
        number = _gen_ticket_number()
        if Ticket.query.filter_by(ticket_number=number).first():
            number = _gen_ticket_number()

        ticket = Ticket(
            ticket_number=number,
            ticket_subject=subject,
            ticket_description=description,
            ticket_status=TicketStatus.OPEN,
            priority=priority,
            category=(data.get('category') or 'general').strip(),
            customer_id=customer.id,
        )
        db.session.add(ticket)
        db.session.flush()

        # The opening description also becomes the first message in the thread.
        db.session.add(TicketMessage(ticket_id=ticket.id, message=description, is_internal=False))
        db.session.commit()
        return jsonify(serialize_ticket(ticket, with_messages=True)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create ticket: {str(e)}'}), 500


@tickets_bp.route('/<int:ticket_id>/messages', methods=['POST'])
@jwt_required()
def add_message(ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)
        if not _can_access(ticket):
            return jsonify({'error': 'Access denied'}), 403
        data = request.get_json(silent=True) or {}
        message = (data.get('message') or '').strip()
        if not message:
            return jsonify({'error': 'message is required'}), 400

        msg = TicketMessage(ticket_id=ticket.id, message=message, is_internal=bool(data.get('is_internal')))
        db.session.add(msg)
        # A reply reopens a resolved/closed ticket into pending unless told not to.
        if ticket.ticket_status in CLOSED_STATUSES and not data.get('keep_status'):
            ticket.ticket_status = TicketStatus.PENDING
            ticket.resolved_at = None
        db.session.commit()
        return jsonify(serialize_ticket(ticket, with_messages=True)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to add message: {str(e)}'}), 500


@tickets_bp.route('/<int:ticket_id>', methods=['PUT', 'PATCH'])
@jwt_required()
def update_ticket(ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)
        if not _can_access(ticket):
            return jsonify({'error': 'Access denied'}), 403
        data = request.get_json(silent=True) or {}
        user = get_current_user()

        if 'status' in data:
            try:
                new_status = TicketStatus(data['status'])
            except ValueError:
                return jsonify({'error': 'Invalid status'}), 400
            ticket.ticket_status = new_status
            if new_status in CLOSED_STATUSES:
                ticket.resolved_at = datetime.utcnow()
                ticket.resolved_by = getattr(user, 'name', None) or getattr(user, 'email', None) or 'staff'
                if data.get('resolved_note'):
                    ticket.resolved_note = data['resolved_note'].strip()
            else:
                ticket.resolved_at = None

        if 'priority' in data:
            try:
                ticket.priority = TicketPriority(data['priority'])
            except ValueError:
                return jsonify({'error': 'Invalid priority'}), 400

        if 'category' in data:
            ticket.category = (data['category'] or 'general').strip()
        if 'subject' in data and data['subject'].strip():
            ticket.ticket_subject = data['subject'].strip()

        db.session.commit()
        return jsonify(serialize_ticket(ticket, with_messages=True)), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update ticket: {str(e)}'}), 500


@tickets_bp.route('/<int:ticket_id>', methods=['DELETE'])
@jwt_required()
def delete_ticket(ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)
        if not _can_access(ticket):
            return jsonify({'error': 'Access denied'}), 403
        db.session.delete(ticket)
        db.session.commit()
        return jsonify({'ok': True, 'message': 'Ticket deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete ticket: {str(e)}'}), 500
