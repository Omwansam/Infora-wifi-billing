from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import or_
from extensions import db
from models import Ticket, Customer, TicketStatus, TicketPriority
from auth_utils import get_current_user

tickets_bp = Blueprint('tickets', __name__, url_prefix='/api/tickets')


def serialize_ticket(ticket):
    return {
        'id': ticket.ticket_number,
        'ticket_id': ticket.id,
        'customerName': ticket.customer.full_name if ticket.customer else 'Unknown',
        'customerId': ticket.customer_id,
        'subject': ticket.ticket_subject,
        'description': ticket.ticket_description,
        'status': ticket.ticket_status.value if ticket.ticket_status else 'open',
        'priority': ticket.priority.value if ticket.priority else 'medium',
        'category': ticket.category,
        'createdAt': ticket.created_at.isoformat() if ticket.created_at else None,
        'updatedAt': ticket.updated_at.isoformat() if ticket.updated_at else None,
    }


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

        query = Ticket.query.join(Customer)

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


@tickets_bp.route('/<int:ticket_id>', methods=['GET'])
@jwt_required()
def get_ticket(ticket_id):
    try:
        ticket = Ticket.query.get_or_404(ticket_id)
        return jsonify(serialize_ticket(ticket)), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get ticket: {str(e)}'}), 500
