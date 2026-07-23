"""M-Pesa payment routes."""
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from auth_utils import get_current_user
from extensions import db
from models import Customer, Invoice, ISP, Payment, PaymentStatus
from services.mpesa_service import MpesaError, initiate_stk_push, parse_callback_payload
from services.payment_processor import complete_successful_payment, create_pending_mpesa_payment

payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')


def _resolve_isp(user, customer):
    if user.role == 'admin':
        return ISP.query.get(customer.isp_id)
    if user.isp_id and user.isp_id == customer.isp_id:
        return ISP.query.get(user.isp_id)
    return None


@payments_bp.route('/mpesa/stk-push', methods=['POST'])
@jwt_required()
def mpesa_stk_push():
    """Initiate M-Pesa STK push for a customer invoice or balance top-up."""
    try:
        user = get_current_user()
        if not user:
            return jsonify({'ok': False, 'message': 'Unauthorized'}), 401

        data = request.get_json() or {}
        customer_id = data.get('customer_id')
        invoice_id = data.get('invoice_id')
        phone = data.get('phone')
        amount = data.get('amount')

        if not customer_id or not phone or not amount:
            return jsonify({'ok': False, 'message': 'customer_id, phone, and amount are required'}), 400

        customer = Customer.query.get_or_404(customer_id)
        isp = _resolve_isp(user, customer)
        if not isp:
            return jsonify({'ok': False, 'message': 'Access denied'}), 403

        invoice = None
        if invoice_id:
            invoice = Invoice.query.get(invoice_id)
            if not invoice or invoice.customer_id != customer.id:
                return jsonify({'ok': False, 'message': 'Invoice not found'}), 404
            amount = float(invoice.amount)

        # Account reference the subscriber sees / reuses on paybill. Prefer the
        # invoice number for an invoice payment, else the stable account number.
        account_ref = (
            invoice.invoice_number if invoice
            else (customer.account_number or f'CUST{customer.id}')
        )
        description = 'WiFi Billing'

        stk = initiate_stk_push(phone, amount, account_ref, description, isp=isp)

        payment = create_pending_mpesa_payment(
            customer=customer,
            invoice=invoice,
            amount=amount,
            phone=phone,
            checkout_request_id=stk.get('CheckoutRequestID'),
            merchant_request_id=stk.get('MerchantRequestID'),
        )
        db.session.commit()

        return jsonify({
            'ok': True,
            'message': stk.get('ResponseDescription', 'STK push sent'),
            'data': {
                'payment_id': payment.id,
                'checkout_request_id': stk.get('CheckoutRequestID'),
                'merchant_request_id': stk.get('MerchantRequestID'),
                'customer_request_id': stk.get('CustomerMessage'),
            },
        }), 200

    except MpesaError as e:
        db.session.rollback()
        return jsonify({'ok': False, 'message': str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'ok': False, 'message': str(e)}), 500


@payments_bp.route('/mpesa/callback', methods=['POST'])
def mpesa_callback():
    """Safaricom STK callback webhook (no JWT — called by Safaricom)."""
    try:
        payload = request.get_json() or {}
        result = parse_callback_payload(payload)

        payment = Payment.query.filter_by(
            mpesa_checkout_request_id=result['checkout_request_id']
        ).first()

        if not payment:
            return jsonify({'ResultCode': 0, 'ResultDesc': 'Accepted'}), 200

        if result['success']:
            complete_successful_payment(
                payment,
                mpesa_receipt=result['mpesa_receipt'],
                amount=result['amount'] or payment.amount,
            )
        else:
            payment.payment_status = PaymentStatus.FAILED
            db.session.commit()

        return jsonify({'ResultCode': 0, 'ResultDesc': 'Accepted'}), 200

    except Exception as e:
        current_app.logger.error('M-Pesa callback error: %s', e)
        return jsonify({'ResultCode': 0, 'ResultDesc': 'Accepted'}), 200


@payments_bp.route('/mpesa/status/<checkout_request_id>', methods=['GET'])
@jwt_required()
def mpesa_payment_status(checkout_request_id):
    payment = Payment.query.filter_by(mpesa_checkout_request_id=checkout_request_id).first_or_404()
    return jsonify({
        'ok': True,
        'data': {
            'payment_id': payment.id,
            'status': payment.payment_status.value,
            'amount': float(payment.amount),
            'receipt': payment.mpesa_receipt_number,
            'customer_id': payment.customer_id,
            'invoice_id': payment.invoice_id,
        },
    }), 200
