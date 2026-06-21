from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import Invoice, Customer, ServicePlan, User, InvoiceStatus, InvoiceItem
from datetime import datetime, timedelta
import uuid

invoices_bp = Blueprint('invoices', __name__, url_prefix='/api/invoices')

def parse_invoice_status(status_value):
    """Convert API status string to InvoiceStatus enum."""
    if not status_value:
        return None
    try:
        return InvoiceStatus(status_value.lower())
    except ValueError:
        valid = [s.value for s in InvoiceStatus]
        raise ValueError(f'Invalid status. Valid values: {", ".join(valid)}')

def serialize_invoice(invoice):
    """Serialize invoice object to dictionary"""
    try:
        return {
            'id': invoice.invoice_number,  # Use invoice_number as id for frontend compatibility
            'invoice_id': invoice.id,  # Keep actual ID for backend operations
            'customerId': invoice.customer_id,
            'customerName': invoice.customer.full_name if invoice.customer else 'Unknown Customer',
            'customerEmail': invoice.customer.email if invoice.customer else None,
            'customerPhone': invoice.customer.phone if invoice.customer else None,
            'customerAddress': invoice.customer.address if invoice.customer and hasattr(invoice.customer, 'address') else None,
            'amount': float(invoice.amount),
            'status': invoice.status.value if hasattr(invoice.status, 'value') else str(invoice.status),
            'dueDate': invoice.due_date.strftime('%Y-%m-%d') if invoice.due_date else None,
            'issueDate': invoice.created_at.strftime('%Y-%m-%d') if invoice.created_at else None,
            'paidDate': invoice.paid_date.strftime('%Y-%m-%d') if invoice.paid_date else None,
            'notes': invoice.notes,
            'items': [
                {
                    'description': item.description,
                    'quantity': item.quantity,
                    'unit_price': float(item.unit_price),
                    'amount': float(item.total_price)
                }
                for item in invoice.invoice_items
            ] if invoice.invoice_items else [],
            'created_at': invoice.created_at.isoformat() if invoice.created_at else None,
            'updated_at': invoice.updated_at.isoformat() if invoice.updated_at else None
        }
    except Exception as e:
        return {
            'id': invoice.invoice_number,
            'invoice_id': invoice.id,
            'customerId': invoice.customer_id,
            'customerName': 'Error loading customer',
            'amount': float(invoice.amount) if invoice.amount else 0.0,
            'status': 'error',
            'dueDate': None,
            'issueDate': None,
            'items': []
        }

# Add explicit OPTIONS handlers for CORS
@invoices_bp.route('/', methods=['OPTIONS'])
def handle_invoices_options():
    return '', 200

@invoices_bp.route('/<int:invoice_id>', methods=['OPTIONS'])
def handle_invoice_options(invoice_id):
    return '', 200

@invoices_bp.route('/stats', methods=['OPTIONS'])
def handle_invoice_stats_options():
    return '', 200

@invoices_bp.route('/pending', methods=['OPTIONS'])
def handle_pending_options():
    return '', 200

@invoices_bp.route('/overdue', methods=['OPTIONS'])
def handle_overdue_options():
    return '', 200

@invoices_bp.route('/<int:invoice_id>/download', methods=['OPTIONS'])
def handle_download_options(invoice_id):
    return '', 200

@invoices_bp.route('/<int:invoice_id>/pdf', methods=['OPTIONS'])
def handle_pdf_options(invoice_id):
    return '', 200

@invoices_bp.route('/', methods=['GET'])
@jwt_required()
def get_invoices():
    """Get all invoices with pagination and filtering"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        customer_id = request.args.get('customer_id', type=int)
        plan_id = request.args.get('plan_id', type=int)
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        search = request.args.get('search')
        
        query = Invoice.query
        
        # Filter by status
        if status:
            try:
                query = query.filter_by(status=parse_invoice_status(status))
            except ValueError as e:
                return jsonify({'error': str(e)}), 400
        
        # Filter by customer
        if customer_id:
            query = query.filter_by(customer_id=customer_id)
        
        # Filter by plan
        if plan_id:
            query = query.filter_by(service_plan_id=plan_id)
        
        # Filter by date range
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, '%Y-%m-%d')
                query = query.filter(Invoice.created_at >= start_dt)
            except ValueError:
                return jsonify({'error': 'Invalid start_date format. Use YYYY-MM-DD'}), 400
        
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
                query = query.filter(Invoice.created_at < end_dt)
            except ValueError:
                return jsonify({'error': 'Invalid end_date format. Use YYYY-MM-DD'}), 400
        
        # Search functionality
        if search:
            search_term = f"%{search}%"
            query = query.join(Customer).filter(
                db.or_(
                    Invoice.invoice_number.ilike(search_term),
                    Customer.full_name.ilike(search_term),
                    Customer.email.ilike(search_term)
                )
            )
        
        # Order by created date
        query = query.order_by(Invoice.created_at.desc())
        
        invoices = query.paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'invoices': [serialize_invoice(invoice) for invoice in invoices.items],
            'total': invoices.total,
            'pages': invoices.pages,
            'current_page': page,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get invoices: {str(e)}'}), 500

@invoices_bp.route('/<int:invoice_id>', methods=['GET'])
@jwt_required()
def get_invoice(invoice_id):
    """Get specific invoice by ID"""
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        return jsonify(serialize_invoice(invoice)), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get invoice: {str(e)}'}), 500

@invoices_bp.route('/', methods=['POST'])
@jwt_required()
def create_invoice():
    """Create a new invoice"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['customer_id', 'amount']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate customer exists
        customer = Customer.query.get(data['customer_id'])
        if not customer:
            return jsonify({'error': 'Customer not found'}), 404
        
        service_plan_id = data.get('service_plan_id') or customer.service_plan_id
        if service_plan_id:
            plan = ServicePlan.query.get(service_plan_id)
            if not plan:
                return jsonify({'error': 'Service plan not found'}), 404
        
        # Validate amount
        try:
            amount = float(data['amount'])
            if amount < 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount format'}), 400
        
        # Generate invoice number
        invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        # Calculate due date (30 days from now by default)
        due_date = datetime.now() + timedelta(days=data.get('due_days', 30))
        
        # Create invoice
        invoice = Invoice(
            invoice_number=invoice_number,
            customer_id=data['customer_id'],
            isp_id=customer.isp_id,
            amount=amount,
            status=InvoiceStatus.PENDING,
            due_date=due_date,
            notes=data.get('notes', '')
        )
        
        db.session.add(invoice)
        db.session.flush()

        for item in data.get('items', []):
            quantity = int(item.get('quantity', 1))
            unit_price = float(item.get('unit_price', 0))
            total_price = float(item.get('total_price', quantity * unit_price))
            description = item.get('description', 'Invoice item')
            db.session.add(InvoiceItem(
                description=description,
                quantity=quantity,
                unit_price=unit_price,
                total_price=total_price,
                invoice_id=invoice.id
            ))
        
        db.session.commit()
        
        return jsonify({
            'message': 'Invoice created successfully',
            'invoice': serialize_invoice(invoice)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create invoice: {str(e)}'}), 500

@invoices_bp.route('/<int:invoice_id>', methods=['PUT'])
@jwt_required()
def update_invoice(invoice_id):
    """Update invoice"""
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        data = request.get_json()
        
        # Update fields
        if 'amount' in data:
            try:
                amount = float(data['amount'])
                if amount < 0:
                    return jsonify({'error': 'Amount must be positive'}), 400
                invoice.amount = amount
            except ValueError:
                return jsonify({'error': 'Invalid amount format'}), 400
        
        if 'status' in data:
            try:
                invoice.status = InvoiceStatus(data['status'])
            except ValueError:
                return jsonify({'error': 'Invalid status value'}), 400
        
        if 'due_date' in data:
            try:
                due_date = datetime.strptime(data['due_date'], '%Y-%m-%d')
                invoice.due_date = due_date
            except ValueError:
                return jsonify({'error': 'Invalid due_date format. Use YYYY-MM-DD'}), 400
        
        if 'notes' in data:
            invoice.notes = data['notes']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Invoice updated successfully',
            'invoice': serialize_invoice(invoice)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update invoice: {str(e)}'}), 500

@invoices_bp.route('/<int:invoice_id>', methods=['DELETE'])
@jwt_required()
def delete_invoice(invoice_id):
    """Delete invoice"""
    try:
        
        invoice = Invoice.query.get_or_404(invoice_id)
        
        # Check if invoice has payments (but don't block deletion for now)
        try:
            payment_count = len(invoice.payments) if hasattr(invoice, 'payments') else 0
        except:
            payment_count = 0
        
        # For now, allow deletion even with payments (can be made stricter later)
        # if payment_count > 0:
        #     return jsonify({'error': 'Cannot delete invoice with existing payments'}), 400
        
        try:
            db.session.delete(invoice)
            db.session.commit()
            
            return jsonify({'message': 'Invoice deleted successfully'}), 200
            
        except Exception as delete_error:
            db.session.rollback()
            
            if "foreign key constraint" in str(delete_error).lower():
                return jsonify({'error': 'Cannot delete invoice with related data (payments, etc.)'}), 400
            else:
                raise delete_error
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete invoice: {str(e)}'}), 500

@invoices_bp.route('/<int:invoice_id>/status', methods=['PUT'])
@jwt_required()
def update_invoice_status(invoice_id):
    """Update invoice status"""
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        data = request.get_json()
        
        if 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
        
        try:
            invoice.status = InvoiceStatus(data['status'])
        except ValueError:
            valid_statuses = [status.value for status in InvoiceStatus]
            return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
        
        # If marking as paid, update paid_date
        if data['status'] == 'paid' and not invoice.paid_date:
            invoice.paid_date = datetime.now()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Invoice status updated successfully',
            'invoice': serialize_invoice(invoice)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update invoice status: {str(e)}'}), 500

@invoices_bp.route('/<int:invoice_id>/payments', methods=['GET'])
@jwt_required()
def get_invoice_payments(invoice_id):
    """Get all payments for a specific invoice"""
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # For now, return empty payments list since the relationship might not be properly set up
        # TODO: Fix this when Payment model and relationship are properly configured
        payments = {
            'items': [],
            'total': 0,
            'pages': 0
        }
        
        return jsonify({
            'invoice': serialize_invoice(invoice),
            'payments': [],  # TODO: Create payment serialization when Payment model is ready
            'total': payments['total'],
            'pages': payments['pages'],
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get invoice payments: {str(e)}'}), 500

@invoices_bp.route('/pending', methods=['GET'])
@jwt_required()
def get_pending_invoices():
    """Get all pending invoices"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        invoices = Invoice.query.filter_by(status=InvoiceStatus.PENDING).order_by(Invoice.due_date.asc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'invoices': [serialize_invoice(invoice) for invoice in invoices.items],
            'total': invoices.total,
            'pages': invoices.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get pending invoices: {str(e)}'}), 500

@invoices_bp.route('/overdue', methods=['GET'])
@jwt_required()
def get_overdue_invoices():
    """Get all overdue invoices"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        invoices = Invoice.query.filter(
            db.and_(
                Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
                Invoice.due_date < datetime.now()
            )
        ).order_by(Invoice.due_date.asc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'invoices': [serialize_invoice(invoice) for invoice in invoices.items],
            'total': invoices.total,
            'pages': invoices.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get overdue invoices: {str(e)}'}), 500

@invoices_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_invoice_stats():
    """Get invoice statistics"""
    try:
        total_invoices = Invoice.query.count()
        pending_invoices = Invoice.query.filter_by(status=InvoiceStatus.PENDING).count()
        paid_invoices = Invoice.query.filter_by(status=InvoiceStatus.PAID).count()
        overdue_invoices = Invoice.query.filter(
            db.and_(
                Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
                Invoice.due_date < datetime.now()
            )
        ).count()
        
        # Total amounts
        total_amount = db.session.query(db.func.sum(Invoice.amount)).scalar() or 0
        pending_amount = db.session.query(db.func.sum(Invoice.amount)).filter_by(status=InvoiceStatus.PENDING).scalar() or 0
        paid_amount = db.session.query(db.func.sum(Invoice.amount)).filter_by(status=InvoiceStatus.PAID).scalar() or 0
        overdue_amount = db.session.query(db.func.sum(Invoice.amount)).filter(
            db.and_(
                Invoice.status.in_([InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]),
                Invoice.due_date < datetime.now()
            )
        ).scalar() or 0
        
        # Monthly stats for current year
        current_year = datetime.now().year
        monthly_stats = []
        
        for month in range(1, 13):
            month_start = datetime(current_year, month, 1)
            if month == 12:
                month_end = datetime(current_year + 1, 1, 1)
            else:
                month_end = datetime(current_year, month + 1, 1)
            
            month_invoices = Invoice.query.filter(
                db.and_(
                    Invoice.created_at >= month_start,
                    Invoice.created_at < month_end
                )
            ).count()
            
            month_amount = db.session.query(db.func.sum(Invoice.amount)).filter(
                db.and_(
                    Invoice.created_at >= month_start,
                    Invoice.created_at < month_end
                )
            ).scalar() or 0
            
            monthly_stats.append({
                'month': month,
                'month_name': month_start.strftime('%B'),
                'invoices_count': month_invoices,
                'total_amount': float(month_amount)
            })
        
        return jsonify({
            'total_invoices': total_invoices,
            'pending_invoices': pending_invoices,
            'paid_invoices': paid_invoices,
            'overdue_invoices': overdue_invoices,
            'total_amount': float(total_amount),
            'pending_amount': float(pending_amount),
            'paid_amount': float(paid_amount),
            'overdue_amount': float(overdue_amount),
            'monthly_stats': monthly_stats
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get invoice stats: {str(e)}'}), 500

@invoices_bp.route('/generate-bulk', methods=['POST'])
@jwt_required()
def generate_bulk_invoices():
    """Generate invoices for multiple customers"""
    try:
        data = request.get_json()
        customer_ids = data.get('customer_ids', [])
        service_plan_id = data.get('service_plan_id')
        amount = data.get('amount')
        billing_cycle = data.get('billing_cycle', 'monthly')
        due_days = data.get('due_days', 30)
        
        if not customer_ids:
            return jsonify({'error': 'No customer IDs provided'}), 400
        
        if not service_plan_id:
            return jsonify({'error': 'Service plan ID is required'}), 400
        
        if not amount:
            return jsonify({'error': 'Amount is required'}), 400
        
        # Validate service plan
        plan = ServicePlan.query.get(service_plan_id)
        if not plan:
            return jsonify({'error': 'Service plan not found'}), 404
        
        # Validate amount
        try:
            amount = float(amount)
            if amount < 0:
                return jsonify({'error': 'Amount must be positive'}), 400
        except ValueError:
            return jsonify({'error': 'Invalid amount format'}), 400
        
        created_invoices = []
        due_date = datetime.now() + timedelta(days=due_days)
        
        for customer_id in customer_ids:
            # Validate customer exists
            customer = Customer.query.get(customer_id)
            if not customer:
                continue
            
            # Generate invoice number
            invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
            
            # Create invoice
            invoice = Invoice(
                invoice_number=invoice_number,
                customer_id=customer_id,
                amount=amount,
                status=InvoiceStatus.PENDING,
                due_date=due_date
            )
            
            db.session.add(invoice)
            created_invoices.append(invoice)
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully created {len(created_invoices)} invoices',
            'created_count': len(created_invoices),
            'invoices': [serialize_invoice(invoice) for invoice in created_invoices]
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to generate bulk invoices: {str(e)}'}), 500

@invoices_bp.route('/<int:invoice_id>/send-reminder', methods=['POST'])
@jwt_required()
def send_invoice_reminder(invoice_id):
    """Send reminder for an invoice"""
    try:
        
        invoice = Invoice.query.get_or_404(invoice_id)
        
        # Check if invoice is pending or overdue (allow all statuses for now)
        # if invoice.status not in [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE]:
        #     return jsonify({'error': 'Can only send reminders for pending or overdue invoices'}), 400
        
        # TODO: Add last_reminder_sent field to Invoice model if needed
        # invoice.last_reminder_sent = datetime.now()
        db.session.commit()
        
        # TODO: Implement actual email/SMS sending logic here
        # For now, just simulate sending
        
        return jsonify({
            'message': 'Invoice reminder sent successfully',
            'invoice': serialize_invoice(invoice)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to send invoice reminder: {str(e)}'}), 500

@invoices_bp.route('/<int:invoice_id>/download', methods=['GET'])
@jwt_required()
def download_invoice(invoice_id):
    """Download invoice as PDF"""
    try:
        
        invoice = Invoice.query.get_or_404(invoice_id)
        
        # For now, return a JSON response with invoice data
        # In a real implementation, you would generate a PDF here
        invoice_data = serialize_invoice(invoice)
        
        # Add download-specific information
        download_data = {
            'invoice': invoice_data,
            'download_url': f'/api/invoices/{invoice_id}/pdf',  # Future PDF endpoint
            'message': 'Invoice data prepared for download'
        }
        
        
        return jsonify(download_data), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to download invoice: {str(e)}'}), 500

@invoices_bp.route('/<int:invoice_id>/pdf', methods=['GET'])
@jwt_required()
def generate_invoice_pdf(invoice_id):
    """Generate PDF for invoice"""
    try:
        invoice = Invoice.query.get_or_404(invoice_id)
        status = invoice.status.value if hasattr(invoice.status, 'value') else str(invoice.status)
        customer = invoice.customer
        items = invoice.invoice_items or []

        item_rows = ''
        subtotal = 0
        for item in items:
            subtotal += float(item.total_price or 0)
            item_rows += f'''
                <tr>
                    <td>{item.description}</td>
                    <td class="num">{item.quantity}</td>
                    <td class="num">KES {float(item.unit_price):,.2f}</td>
                    <td class="num">KES {float(item.total_price):,.2f}</td>
                </tr>'''

        if not item_rows:
            item_rows = f'''
                <tr>
                    <td>Service charge</td>
                    <td class="num">1</td>
                    <td class="num">KES {float(invoice.amount):,.2f}</td>
                    <td class="num">KES {float(invoice.amount):,.2f}</td>
                </tr>'''
            subtotal = float(invoice.amount)

        notes_block = ''
        if invoice.notes:
            notes_block = f'''
            <div class="notes">
                <div class="label">Notes</div>
                <p>{invoice.notes}</p>
            </div>'''

        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice {invoice.invoice_number}</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }}
        .page {{ max-width: 800px; margin: 32px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }}
        .banner {{ background: linear-gradient(135deg, #0f172a, #312e81); color: #fff; padding: 32px 40px; }}
        .brand {{ font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #a5b4fc; }}
        .title {{ font-size: 32px; font-weight: 700; margin: 8px 0 4px; }}
        .number {{ font-family: monospace; color: #cbd5e1; }}
        .banner-row {{ display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }}
        .amount-box {{ text-align: right; }}
        .amount-label {{ color: #cbd5e1; font-size: 13px; }}
        .amount-value {{ font-size: 28px; font-weight: 700; margin-top: 4px; }}
        .status {{ display: inline-block; margin-top: 8px; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }}
        .status-paid {{ background: #d1fae5; color: #065f46; }}
        .status-pending {{ background: #fef3c7; color: #92400e; }}
        .status-overdue {{ background: #ffe4e6; color: #9f1239; }}
        .content {{ padding: 32px 40px; }}
        .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }}
        .label {{ font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; }}
        .name {{ font-size: 18px; font-weight: 700; }}
        .meta {{ color: #64748b; font-size: 14px; line-height: 1.6; }}
        .dates {{ text-align: right; }}
        table {{ width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }}
        th {{ background: #f8fafc; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }}
        td {{ padding: 14px 16px; border-top: 1px solid #f1f5f9; font-size: 14px; }}
        .num {{ text-align: right; }}
        .totals {{ margin-top: 24px; display: flex; justify-content: flex-end; }}
        .totals-box {{ width: 260px; }}
        .total-row {{ display: flex; justify-content: space-between; padding: 8px 0; color: #64748b; font-size: 14px; }}
        .grand {{ border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 12px; font-size: 20px; font-weight: 700; color: #4338ca; }}
        .notes {{ margin-top: 24px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }}
        .notes p {{ margin: 0; color: #475569; font-size: 14px; white-space: pre-wrap; }}
        .footer {{ text-align: center; padding: 24px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }}
        @media print {{ body {{ background: #fff; }} .page {{ margin: 0; border: none; border-radius: 0; }} }}
    </style>
</head>
<body>
    <div class="page">
        <div class="banner">
            <div class="banner-row">
                <div>
                    <div class="brand">Lumen WiFi Billing</div>
                    <div class="title">Invoice</div>
                    <div class="number">{invoice.invoice_number}</div>
                </div>
                <div class="amount-box">
                    <div class="amount-label">Amount due</div>
                    <div class="amount-value">KES {float(invoice.amount):,.2f}</div>
                    <span class="status status-{status}">{status}</span>
                </div>
            </div>
        </div>
        <div class="content">
            <div class="grid">
                <div>
                    <div class="label">Bill to</div>
                    <div class="name">{customer.full_name if customer else 'Unknown Customer'}</div>
                    <div class="meta">
                        {customer.email if customer else ''}<br>
                        {customer.phone if customer else ''}
                    </div>
                </div>
                <div class="dates">
                    <div class="label">Issue date</div>
                    <div class="meta">{invoice.created_at.strftime('%b %d, %Y') if invoice.created_at else '—'}</div>
                    <div class="label" style="margin-top:16px">Due date</div>
                    <div class="meta">{invoice.due_date.strftime('%b %d, %Y') if invoice.due_date else '—'}</div>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="num">Qty</th>
                        <th class="num">Unit price</th>
                        <th class="num">Amount</th>
                    </tr>
                </thead>
                <tbody>{item_rows}</tbody>
            </table>
            <div class="totals">
                <div class="totals-box">
                    <div class="total-row"><span>Subtotal</span><span>KES {subtotal:,.2f}</span></div>
                    <div class="total-row grand"><span>Total</span><span>KES {float(invoice.amount):,.2f}</span></div>
                </div>
            </div>
            {notes_block}
        </div>
        <div class="footer">
            Generated {datetime.now().strftime('%b %d, %Y')} · Thank you for your business
        </div>
    </div>
</body>
</html>"""

        return html_content, 200, {
            'Content-Type': 'text/html',
            'Content-Disposition': f'attachment; filename="invoice_{invoice.invoice_number}.html"'
        }

    except Exception as e:
        return jsonify({'error': f'Failed to generate PDF: {str(e)}'}), 500