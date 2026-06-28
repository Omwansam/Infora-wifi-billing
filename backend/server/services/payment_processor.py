"""Post-payment business flow: invoice, payment record, RADIUS activation."""
from datetime import datetime

from extensions import db
from models import (
    CustomerStatus,
    Invoice,
    InvoiceStatus,
    Payment,
    PaymentStatus,
    Transaction,
)
from services.radius_provisioning import activate_customer_after_payment


def complete_successful_payment(payment, mpesa_receipt=None, amount=None):
    """Mark payment complete, update invoice, activate customer RADIUS access."""
    if payment.payment_status == PaymentStatus.COMPLETED:
        return payment

    payment.payment_status = PaymentStatus.COMPLETED
    payment.payment_date = datetime.utcnow()
    if mpesa_receipt:
        payment.mpesa_receipt_number = mpesa_receipt
        payment.transaction_id = mpesa_receipt
    if amount is not None:
        payment.amount = amount

    customer = payment.customer
    invoice = payment.invoice
    isp = customer.isp if customer else None

    if invoice:
        if amount is not None and abs(float(amount) - float(invoice.amount)) > 1.0:
            pass  # log mismatch in production; still honour successful M-Pesa callback
        invoice.status = InvoiceStatus.PAID
        invoice.paid_date = datetime.utcnow()

    if customer and isp:
        plan = customer.service_plan
        if payment.invoice and payment.invoice.customer:
            plan = payment.invoice.customer.service_plan or plan
        activate_customer_after_payment(customer, isp, plan=plan, stack_time=True)

    txn = Transaction(
        transaction_number=payment.transaction_id or f'TXN-{payment.id}',
        transaction_type='payment',
        transaction_amount=payment.amount,
        reference_id=str(payment.id),
        reference_type='payment',
        customer_id=payment.customer_id,
        payment_id=payment.id,
    )
    db.session.add(txn)
    db.session.commit()

    try:
        from services.notification_dispatch import dispatch_hotspot_payment_success
        dispatch_hotspot_payment_success(payment)
        db.session.commit()
    except Exception:
        db.session.rollback()

    return payment


def create_pending_mpesa_payment(customer, invoice, amount, phone, checkout_request_id, merchant_request_id):
    payment = Payment(
        amount=amount,
        payment_method='mpesa',
        payment_status=PaymentStatus.PENDING,
        payment_date=datetime.utcnow(),
        customer_id=customer.id,
        invoice_id=invoice.id if invoice else None,
        phone_number=phone,
        mpesa_checkout_request_id=checkout_request_id,
        mpesa_merchant_request_id=merchant_request_id,
        transaction_id=checkout_request_id,
    )
    db.session.add(payment)
    db.session.flush()
    return payment
