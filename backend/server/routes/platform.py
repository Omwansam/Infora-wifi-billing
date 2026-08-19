"""Tenant-facing endpoints for the ISP's own platform subscription.

These are the *only* authenticated console routes a locked-out tenant can still
reach — see ``app.enforce_platform_subscription``. Keep it that way: anything
added to this blueprint is implicitly exempt from the paywall.
"""
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from auth_utils import get_current_user
from extensions import db
from models import ISP, PlatformInvoice
from services import platform_subscription as sub
from services.mpesa_service import MpesaError, initiate_stk_push

platform_bp = Blueprint('platform', __name__, url_prefix='/api/platform')


def _current_isp():
    user = get_current_user()
    if not user:
        return None, None, (jsonify({'error': 'User not found'}), 404)
    isp = ISP.query.get(user.isp_id) if getattr(user, 'isp_id', None) else None
    if isp is None:
        return user, None, (jsonify({'error': 'No ISP associated with this account'}), 404)
    return user, isp, None


@platform_bp.route('/subscription', methods=['GET'])
@jwt_required()
def get_platform_subscription():
    user, isp, error = _current_isp()
    if error:
        return error

    invoices = (PlatformInvoice.query
                .filter_by(isp_id=isp.id)
                .order_by(PlatformInvoice.issued_at.desc(), PlatformInvoice.id.desc())
                .limit(60).all())

    return jsonify({
        'subscription': sub.subscription_state(isp),
        'invoices': [sub.serialize_invoice(i) for i in invoices],
        'tenant': {
            'name': isp.company_name or isp.name,
            'slug': isp.slug,
            'email': isp.email,
            'phone': isp.phone or isp.support_phone,
        },
        # Only an admin can settle the bill; support staff see a read-only page
        # telling them who to ask rather than a Pay button that would 403.
        'can_pay': user.role == 'admin',
    }), 200


@platform_bp.route('/subscription/invoices/<int:invoice_id>/pay', methods=['POST'])
@jwt_required()
def pay_platform_invoice(invoice_id):
    """Charge one platform invoice by M-Pesa STK push.

    ``isp=None`` on the push is deliberate: this money goes to the platform's
    own paybill from the env Daraja credentials, never to the tenant's till.
    """
    user, isp, error = _current_isp()
    if error:
        return error
    if user.role != 'admin':
        return jsonify({'error': 'Only an admin can pay the platform subscription'}), 403

    invoice = PlatformInvoice.query.filter_by(id=invoice_id, isp_id=isp.id).first()
    if invoice is None:
        return jsonify({'error': 'Invoice not found'}), 404
    if invoice.status == 'paid':
        return jsonify({'error': 'This invoice is already paid'}), 409
    if invoice.status == 'void':
        return jsonify({'error': 'This invoice was cancelled'}), 409

    phone = (request.get_json(silent=True) or {}).get('phone') or isp.phone or isp.support_phone
    if not phone:
        return jsonify({'error': 'A phone number is required to send the M-Pesa prompt'}), 400

    try:
        stk = initiate_stk_push(
            phone,
            float(invoice.amount),
            invoice.number,
            f'{sub.platform_name()} subscription',
            isp=None,
        )
    except MpesaError as exc:
        return jsonify({'error': str(exc)}), 400
    except Exception as exc:  # network/Daraja outage
        current_app.logger.error('Platform STK push failed: %s', exc)
        return jsonify({'error': 'Could not reach M-Pesa. Try again shortly.'}), 502

    invoice.checkout_request_id = stk.get('CheckoutRequestID')
    invoice.merchant_request_id = stk.get('MerchantRequestID')
    invoice.payer_phone = phone
    db.session.commit()

    return jsonify({
        'message': stk.get('ResponseDescription') or 'Payment prompt sent',
        'checkout_request_id': invoice.checkout_request_id,
        # Nothing is paid until Safaricom calls back; the UI polls for that.
        'delivery': {
            'mode': 'stk_prompt',
            'note': 'Enter your M-Pesa PIN on the prompt sent to your phone.',
        },
    }), 202


@platform_bp.route('/subscription/invoices/<int:invoice_id>/status', methods=['GET'])
@jwt_required()
def platform_invoice_status(invoice_id):
    """Poll after an STK push — the callback is what actually settles it."""
    user, isp, error = _current_isp()
    if error:
        return error
    invoice = PlatformInvoice.query.filter_by(id=invoice_id, isp_id=isp.id).first()
    if invoice is None:
        return jsonify({'error': 'Invoice not found'}), 404
    return jsonify({
        'invoice': sub.serialize_invoice(invoice),
        'subscription': sub.subscription_state(isp),
    }), 200


@platform_bp.route('/subscription/invoices/<int:invoice_id>/pdf', methods=['GET'])
@jwt_required()
def platform_invoice_document(invoice_id):
    """Printable invoice, same approach as the subscriber invoice document."""
    user, isp, error = _current_isp()
    if error:
        return error
    invoice = PlatformInvoice.query.filter_by(id=invoice_id, isp_id=isp.id).first()
    if invoice is None:
        return jsonify({'error': 'Invoice not found'}), 404

    vendor = sub.platform_name()
    currency = invoice.currency or 'KES'
    amount = float(invoice.amount or 0)
    period = '—'
    if invoice.period_start and invoice.period_end:
        period = (f'{invoice.period_start.strftime("%b %d, %Y")}'
                  f' – {invoice.period_end.strftime("%b %d, %Y")}')

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{invoice.number}</title>
<style>
  * {{ box-sizing: border-box; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }}
  .page {{ max-width: 760px; margin: 32px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; }}
  .banner {{ background: linear-gradient(135deg, #0f172a, #7c2d12); color: #fff; padding: 32px 40px; display: flex; justify-content: space-between; gap: 24px; }}
  .brand {{ font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #fdba74; }}
  .title {{ font-size: 30px; font-weight: 700; margin: 8px 0 4px; }}
  .number {{ font-family: monospace; color: #cbd5e1; }}
  .amount {{ text-align: right; }}
  .amount-label {{ color: #cbd5e1; font-size: 13px; }}
  .amount-value {{ font-size: 28px; font-weight: 700; margin-top: 4px; }}
  .status {{ display: inline-block; margin-top: 8px; padding: 6px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; text-transform: uppercase; }}
  .status-paid {{ background: #d1fae5; color: #065f46; }}
  .status-pending {{ background: #fef3c7; color: #92400e; }}
  .status-void {{ background: #e2e8f0; color: #475569; }}
  .content {{ padding: 32px 40px; }}
  .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 28px; }}
  .label {{ font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8; margin-bottom: 6px; }}
  .name {{ font-size: 18px; font-weight: 700; }}
  .meta {{ color: #64748b; font-size: 14px; line-height: 1.6; }}
  .right {{ text-align: right; }}
  table {{ width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }}
  th {{ background: #f8fafc; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }}
  td {{ padding: 14px 16px; border-top: 1px solid #f1f5f9; font-size: 14px; }}
  .num {{ text-align: right; }}
  .total {{ margin-top: 20px; display: flex; justify-content: flex-end; }}
  .total-box {{ width: 260px; border-top: 2px solid #0f172a; padding-top: 12px; display: flex; justify-content: space-between; font-size: 20px; font-weight: 700; color: #c2410c; }}
  .footer {{ text-align: center; padding: 22px; color: #94a3b8; font-size: 12px; border-top: 1px solid #f1f5f9; }}
  @media print {{ body {{ background: #fff; }} .page {{ margin: 0; border: none; border-radius: 0; }} }}
</style>
</head>
<body>
  <div class="page">
    <div class="banner">
      <div>
        <div class="brand">{vendor} platform subscription</div>
        <div class="title">Invoice</div>
        <div class="number">{invoice.number}</div>
      </div>
      <div class="amount">
        <div class="amount-label">Amount</div>
        <div class="amount-value">{currency} {amount:,.2f}</div>
        <span class="status status-{invoice.status}">{invoice.status}</span>
      </div>
    </div>
    <div class="content">
      <div class="grid">
        <div>
          <div class="label">Billed to</div>
          <div class="name">{isp.company_name or isp.name}</div>
          <div class="meta">{isp.email or ''}<br>{isp.slug or ''}</div>
        </div>
        <div class="right">
          <div class="label">Issued</div>
          <div class="meta">{invoice.issued_at.strftime('%b %d, %Y') if invoice.issued_at else '—'}</div>
          <div class="label" style="margin-top:14px">Due</div>
          <div class="meta">{invoice.due_at.strftime('%b %d, %Y') if invoice.due_at else '—'}</div>
          {'<div class="label" style="margin-top:14px">Paid</div><div class="meta">' + invoice.paid_at.strftime('%b %d, %Y') + '</div>' if invoice.paid_at else ''}
        </div>
      </div>
      <table>
        <thead>
          <tr><th>Description</th><th>Period</th><th class="num">Amount</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>{vendor} platform subscription — {(isp.subscription_plan or 'basic').title()} plan</td>
            <td>{period}</td>
            <td class="num">{currency} {amount:,.2f}</td>
          </tr>
        </tbody>
      </table>
      <div class="total"><div class="total-box"><span>Total</span><span>{currency} {amount:,.2f}</span></div></div>
    </div>
    <div class="footer">
      {'Paid ' + (invoice.payment_reference or '') if invoice.status == 'paid' else 'Pay by M-Pesa using ' + invoice.number + ' as the account number.'}
    </div>
  </div>
</body>
</html>"""
    return html, 200, {'Content-Type': 'text/html; charset=utf-8'}
