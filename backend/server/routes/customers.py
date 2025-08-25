from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from extensions import db
from models import Customer, User, CustomerStatus
from datetime import datetime

customers_bp = Blueprint('customers', __name__, url_prefix='/api/customers')

def serialize_customer(customer):
    """Serialize customer object to dictionary"""
    try:
        return {
            'id': customer.id,
            'name': customer.full_name,
            'email': customer.email,
            'phone': customer.phone,
            'address': customer.address,
            'status': customer.status.value if customer.status else 'active',
            'join_date': customer.join_date.isoformat() if customer.join_date else None,
            'balance': float(customer.balance) if customer.balance else 0.0,
            'package': customer.package,
            'usage_percentage': customer.usage_percentage,
            'device_count': customer.device_count,
            'last_payment_date': customer.last_payment_date.isoformat() if customer.last_payment_date else None,
            'created_at': customer.created_at.isoformat() if customer.created_at else None,
            'updated_at': customer.updated_at.isoformat() if customer.updated_at else None,
            'service_plan_id': customer.service_plan_id,
            'service_plan': {
                'id': customer.service_plan.id,
                'name': customer.service_plan.name,
                'speed': customer.service_plan.speed,
                'price': float(customer.service_plan.price) if customer.service_plan.price else 0.0
            } if hasattr(customer, 'service_plan') and customer.service_plan else None
        }
    except Exception as e:
        print(f"Error serializing customer {customer.id}: {e}")
        # Return basic customer data without service plan
        return {
            'id': customer.id,
            'name': customer.full_name,
            'email': customer.email,
            'phone': customer.phone,
            'address': customer.address,
            'status': customer.status.value if customer.status else 'active',
            'join_date': customer.join_date.isoformat() if customer.join_date else None,
            'balance': float(customer.balance) if customer.balance else 0.0,
            'package': customer.package,
            'usage_percentage': customer.usage_percentage,
            'device_count': customer.device_count,
            'last_payment_date': customer.last_payment_date.isoformat() if customer.last_payment_date else None,
            'created_at': customer.created_at.isoformat() if customer.created_at else None,
            'updated_at': customer.updated_at.isoformat() if customer.updated_at else None,
            'service_plan_id': customer.service_plan_id,
            'service_plan': None
        }

@customers_bp.route('/', methods=['GET'])
@customers_bp.route('', methods=['GET'])
@jwt_required()
def get_customers():
    """Get all customers with pagination and filtering"""
    try:
        print(f"GET /api/customers - Request received")
        print(f"Request URL: {request.url}")
        print(f"Request method: {request.method}")
        print(f"Request headers: {dict(request.headers)}")
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search = request.args.get('search')
        status = request.args.get('status')
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        
        print(f"Query params: page={page}, per_page={per_page}, search={search}, status={status}")
        
        query = Customer.query
        
        # Search functionality
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Customer.full_name.ilike(search_term),
                    Customer.email.ilike(search_term),
                    Customer.phone.ilike(search_term)
                )
            )
        
        # Status filter
        if status:
            try:
                status_enum = CustomerStatus(status)
                query = query.filter_by(status=status_enum)
            except ValueError:
                return jsonify({'error': 'Invalid status value'}), 400
        
        # Sorting
        if hasattr(Customer, sort_by):
            sort_column = getattr(Customer, sort_by)
            if sort_order == 'desc':
                query = query.order_by(sort_column.desc())
            else:
                query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(Customer.created_at.desc())
        
        customers = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        print(f"Found {customers.total} customers, returning {len(customers.items)} for page {page}")
        
        response_data = {
            'customers': [serialize_customer(customer) for customer in customers.items],
            'total': customers.total,
            'pages': customers.pages,
            'current_page': page,
            'per_page': per_page
        }
        
        print(f"Response data: {response_data}")
        return jsonify(response_data), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customers: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>', methods=['GET'])
@jwt_required()
def get_customer(customer_id):
    """Get specific customer by ID"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        return jsonify(serialize_customer(customer)), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer: {str(e)}'}), 500

@customers_bp.route('/', methods=['POST'])
@customers_bp.route('', methods=['POST'])
@jwt_required()
def create_customer():
    """Create a new customer"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'email', 'phone']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Check if email already exists
        if Customer.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already registered'}), 409
        
        # Create customer
        status = CustomerStatus(data.get('status', 'active')) if data.get('status') else CustomerStatus.ACTIVE
        customer = Customer(
            full_name=data['name'],
            email=data['email'],
            phone=data['phone'],
            address=data.get('address'),
            status=status,
            balance=data.get('balance', 0.00),
            package=data.get('package', 'Basic WiFi'),
            usage_percentage=data.get('usage_percentage', 0),
            device_count=data.get('device_count', 0)
        )
        
        db.session.add(customer)
        db.session.commit()
        
        return jsonify({
            'message': 'Customer created successfully',
            'customer': serialize_customer(customer)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create customer: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>', methods=['PUT'])
@jwt_required()
def update_customer(customer_id):
    """Update customer information"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            customer.full_name = data['name']
        if 'email' in data:
            # Check if email is already taken by another customer
            existing_customer = Customer.query.filter_by(email=data['email']).first()
            if existing_customer and existing_customer.id != customer.id:
                return jsonify({'error': 'Email already taken'}), 409
            customer.email = data['email']
        if 'phone' in data:
            customer.phone = data['phone']
        if 'address' in data:
            customer.address = data['address']
        if 'status' in data:
            customer.status = CustomerStatus(data['status'])
        if 'balance' in data:
            customer.balance = data['balance']
        if 'usage_percentage' in data:
            customer.usage_percentage = data['usage_percentage']
        if 'device_count' in data:
            customer.device_count = data['device_count']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Customer updated successfully',
            'customer': serialize_customer(customer)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update customer: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>', methods=['DELETE'])
@jwt_required()
def delete_customer(customer_id):
    """Delete customer"""
    try:
        print(f"DELETE /api/customers/{customer_id} - Request received")
        customer = Customer.query.get_or_404(customer_id)
        
        print(f"Found customer: {customer.full_name} (ID: {customer.id})")
        
        # Check if customer has related data that would prevent deletion
        invoice_count = customer.invoices.count()
        payment_count = customer.payments.count()
        ticket_count = customer.tickets.count()
        transaction_count = customer.transactions.count()
        revenue_count = customer.revenue_data.count()
        
        print(f"Related data counts - Invoices: {invoice_count}, Payments: {payment_count}, Tickets: {ticket_count}, Transactions: {transaction_count}, Revenue: {revenue_count}")
        
        # For now, allow deletion even with related data (cascade will handle it)
        # You can uncomment these checks if you want to prevent deletion with related data
        
        # if invoice_count > 0:
        #     return jsonify({'error': f'Cannot delete customer with {invoice_count} existing invoices'}), 400
        
        # if payment_count > 0:
        #     return jsonify({'error': f'Cannot delete customer with {payment_count} existing payments'}), 400
        
        # if ticket_count > 0:
        #     return jsonify({'error': f'Cannot delete customer with {ticket_count} existing tickets'}), 400
        
        # if transaction_count > 0:
        #     return jsonify({'error': f'Cannot delete customer with {transaction_count} existing transactions'}), 400
        
        # if revenue_count > 0:
        #     return jsonify({'error': f'Cannot delete customer with {revenue_count} existing revenue records'}), 400
        
        # Delete the customer (cascade will handle related data)
        try:
            db.session.delete(customer)
            db.session.commit()
        except Exception as delete_error:
            db.session.rollback()
            print(f"Database error during deletion: {str(delete_error)}")
            
            # If there are foreign key constraint violations, try to handle them
            if "foreign key constraint" in str(delete_error).lower():
                return jsonify({'error': 'Cannot delete customer due to existing related data. Please remove all related records first.'}), 400
            
            raise delete_error
        
        print(f"Customer {customer.full_name} (ID: {customer.id}) deleted successfully")
        return jsonify({'message': 'Customer deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting customer {customer_id}: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        print(f"Error details: {e}")
        
        # Provide more specific error messages
        if "foreign key constraint" in str(e).lower():
            return jsonify({'error': 'Cannot delete customer due to existing related data. Please remove all related records first.'}), 400
        elif "not found" in str(e).lower():
            return jsonify({'error': 'Customer not found'}), 404
        else:
            return jsonify({'error': f'Failed to delete customer: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/status', methods=['PUT'])
@jwt_required()
def update_customer_status(customer_id):
    """Update customer status"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()
        
        new_status = data.get('status')
        if not new_status:
            return jsonify({'error': 'Status is required'}), 400
        
        try:
            customer.status = CustomerStatus(new_status)
        except ValueError:
            return jsonify({'error': 'Invalid status'}), 400
        db.session.commit()
        
        return jsonify({
            'message': 'Customer status updated successfully',
            'customer': serialize_customer(customer)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update customer status: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/balance', methods=['PUT'])
@jwt_required()
def update_customer_balance(customer_id):
    """Update customer balance"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()
        
        new_balance = data.get('balance')
        if new_balance is None:
            return jsonify({'error': 'Balance is required'}), 400
        
        try:
            new_balance = float(new_balance)
        except ValueError:
            return jsonify({'error': 'Invalid balance amount'}), 400
        
        customer.balance = new_balance
        db.session.commit()
        
        return jsonify({
            'message': 'Customer balance updated successfully',
            'customer': serialize_customer(customer)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update customer balance: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/usage', methods=['PUT'])
@jwt_required()
def update_customer_usage(customer_id):
    """Update customer usage statistics"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        data = request.get_json()
        
        if 'usage_percentage' in data:
            usage = data['usage_percentage']
            if not isinstance(usage, int) or usage < 0 or usage > 100:
                return jsonify({'error': 'Usage percentage must be between 0 and 100'}), 400
            customer.usage_percentage = usage
        
        if 'device_count' in data:
            device_count = data['device_count']
            if not isinstance(device_count, int) or device_count < 0:
                return jsonify({'error': 'Device count must be a positive integer'}), 400
            customer.device_count = device_count
        
        db.session.commit()
        
        return jsonify({
            'message': 'Customer usage updated successfully',
            'customer': serialize_customer(customer)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update customer usage: {str(e)}'}), 500

@customers_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_customer_stats():
    """Get customer statistics"""
    try:
        print(f"GET /api/customers/stats - Request received")
        total_customers = Customer.query.count()
        active_customers = Customer.query.filter_by(status=CustomerStatus.ACTIVE).count()
        suspended_customers = Customer.query.filter_by(status=CustomerStatus.SUSPENDED).count()
        pending_customers = Customer.query.filter_by(status=CustomerStatus.PENDING).count()
        
        # Average balance
        avg_balance = db.session.query(db.func.avg(Customer.balance)).scalar() or 0
        
        # Total balance across all customers
        total_balance = db.session.query(db.func.sum(Customer.balance)).scalar() or 0
        
        # Customers with outstanding balance
        customers_with_balance = Customer.query.filter(Customer.balance > 0).count()
        
        # Average usage percentage
        avg_usage = db.session.query(db.func.avg(Customer.usage_percentage)).scalar() or 0
        
        # Top customers by balance
        top_customers = Customer.query.order_by(Customer.balance.desc()).limit(5).all()
        
        print(f"Stats calculated: total={total_customers}, active={active_customers}, suspended={suspended_customers}, pending={pending_customers}")
        
        response_data = {
            'total_customers': total_customers,
            'active_customers': active_customers,
            'suspended_customers': suspended_customers,
            'pending_customers': pending_customers,
            'average_balance': float(avg_balance),
            'total_balance': float(total_balance),
            'customers_with_balance': customers_with_balance,
            'average_usage': float(avg_usage),
            'top_customers_by_balance': [
                {
                    'id': customer.id,
                    'name': customer.full_name,
                    'balance': float(customer.balance)
                }
                for customer in top_customers
            ]
        }
        
        print(f"Stats response: {response_data}")
        return jsonify(response_data), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer stats: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/invoices', methods=['GET'])
@jwt_required()
def get_customer_invoices(customer_id):
    """Get all invoices for a specific customer"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = customer.invoices
        
        if status:
            query = query.filter_by(status=status)
        
        invoices = query.order_by(customer.invoices.any().created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'customer': serialize_customer(customer),
            'invoices': [invoice.to_dict() for invoice in invoices.items],
            'total': invoices.total,
            'pages': invoices.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer invoices: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/payments', methods=['GET'])
@jwt_required()
def get_customer_payments(customer_id):
    """Get all payments for a specific customer"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = customer.payments
        
        if status:
            query = query.filter_by(status=status)
        
        payments = query.order_by(customer.payments.any().created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'customer': serialize_customer(customer),
            'payments': [payment.to_dict() for payment in payments.items],
            'total': payments.total,
            'pages': payments.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer payments: {str(e)}'}), 500

@customers_bp.route('/<int:customer_id>/tickets', methods=['GET'])
@jwt_required()
def get_customer_tickets(customer_id):
    """Get all tickets for a specific customer"""
    try:
        customer = Customer.query.get_or_404(customer_id)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        
        query = customer.tickets
        
        if status:
            query = query.filter_by(status=status)
        
        tickets = query.order_by(customer.tickets.any().created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'customer': serialize_customer(customer),
            'tickets': [ticket.to_dict() for ticket in tickets.items],
            'total': tickets.total,
            'pages': tickets.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get customer tickets: {str(e)}'}), 500
