"""Public captive portal API (no admin JWT required)."""
import io

from flask import Blueprint, jsonify, request, send_file, Response

from models import WireGuardPeer
from services.portal_service import (
    get_portal_config,
    get_portal_payment_status,
    list_portal_plans,
    lookup_hotspot_customer,
    lookup_pppoe_customer,
    lookup_wireguard_customer,
    purchase_hotspot_package,
    redeem_hotspot_voucher,
    renew_pppoe_package,
    serialize_hotspot_status,
    serialize_portal_plan,
    serialize_pppoe_status,
    serialize_wireguard_status,
)
from services.portal_urls import portal_entry_url
from services.wireguard_provisioning import build_client_config
from services.rate_limit import rate_limit

portal_bp = Blueprint('portal', __name__, url_prefix='/api/portal')


@portal_bp.route('/config', methods=['GET'])
def portal_config():
    isp_id = request.args.get('isp_id', type=int)
    router_id = request.args.get('router_id', type=int)
    config = get_portal_config(isp_id, router_id=router_id)
    if not config:
        return jsonify({'ok': False, 'message': 'No active ISP configured'}), 404
    return jsonify({'ok': True, 'data': config}), 200


@portal_bp.route('/captive-redirect', methods=['GET'])
def portal_captive_redirect():
    """Minimal HTML page MikroTik fetches as hotspot/login.html to redirect to our SPA."""
    isp_id = request.args.get('isp_id', type=int)
    router_id = request.args.get('router_id', type=int)
    target = portal_entry_url(isp_id, router_id) or '/portal'
    html = f'''<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0;url={target}">
<title>Redirecting…</title>
<script>window.location.replace("{target}");</script>
</head><body><p><a href="{target}">Continue to WiFi portal</a></p></body></html>'''
    return Response(html, mimetype='text/html')


@portal_bp.route('/plans', methods=['GET'])
def portal_plans():
    isp_id = request.args.get('isp_id', type=int)
    plan_type = request.args.get('type', 'hotspot')
    if plan_type not in ('hotspot', 'pppoe', 'wireguard'):
        return jsonify({'ok': False, 'message': 'Invalid plan type'}), 400

    plans = list_portal_plans(isp_id, plan_type)
    return jsonify({
        'ok': True,
        'data': [serialize_portal_plan(plan) for plan in plans],
    }), 200


@portal_bp.route('/hotspot/purchase', methods=['POST'])
@rate_limit(limit=12, window=60, scope='portal-hotspot-purchase')
def portal_hotspot_purchase():
    data = request.get_json() or {}
    plan_id = data.get('plan_id')
    phone = data.get('phone')
    isp_id = data.get('isp_id')
    router_id = data.get('router_id')
    full_name = data.get('full_name')

    if not plan_id or not phone:
        return jsonify({'ok': False, 'message': 'plan_id and phone are required'}), 400

    result, error = purchase_hotspot_package(isp_id, plan_id, phone, full_name, router_id=router_id)
    if error:
        return jsonify({'ok': False, 'message': error}), 400

    return jsonify({
        'ok': True,
        'message': result.get('customer_message', 'STK push sent to your phone'),
        'data': result,
    }), 200


@portal_bp.route('/hotspot/lookup', methods=['POST'])
@rate_limit(limit=15, window=60, scope='portal-hotspot-lookup')
def portal_hotspot_lookup():
    data = request.get_json() or {}
    phone = data.get('phone')
    username = data.get('username') or data.get('account')
    isp_id = data.get('isp_id')

    if not phone and not username:
        return jsonify({'ok': False, 'message': 'phone or username is required'}), 400

    customer, error = lookup_hotspot_customer(isp_id, phone=phone, username=username)
    if error:
        return jsonify({'ok': False, 'message': error}), 404

    payload = serialize_hotspot_status(customer)
    isp = customer.isp
    if isp:
        payload['after_login_redirect_url'] = getattr(isp, 'after_login_redirect_url', None)
    return jsonify({'ok': True, 'data': payload}), 200


@portal_bp.route('/hotspot/voucher', methods=['POST'])
@rate_limit(limit=20, window=60, scope='portal-hotspot-voucher')
def portal_hotspot_voucher():
    data = request.get_json() or {}
    code = data.get('code') or data.get('voucher')
    phone = data.get('phone')
    isp_id = data.get('isp_id')
    router_id = data.get('router_id')

    if not code:
        return jsonify({'ok': False, 'message': 'Voucher code is required'}), 400

    result, error = redeem_hotspot_voucher(isp_id, code, phone=phone, router_id=router_id)
    if error:
        return jsonify({'ok': False, 'message': error}), 400

    return jsonify({'ok': True, 'message': 'Voucher redeemed', 'data': result}), 200


@portal_bp.route('/pppoe/lookup', methods=['POST'])
@rate_limit(limit=15, window=60, scope='portal-pppoe-lookup')
def portal_pppoe_lookup():
    data = request.get_json() or {}
    account = data.get('account') or data.get('username')
    isp_id = data.get('isp_id')

    customer, error = lookup_pppoe_customer(isp_id, account)
    if error:
        return jsonify({'ok': False, 'message': error}), 404

    return jsonify({'ok': True, 'data': serialize_pppoe_status(customer)}), 200


@portal_bp.route('/pppoe/pay', methods=['POST'])
@rate_limit(limit=12, window=60, scope='portal-pppoe-pay')
def portal_pppoe_pay():
    data = request.get_json() or {}
    account = data.get('account') or data.get('username')
    phone = data.get('phone')
    isp_id = data.get('isp_id')
    plan_id = data.get('plan_id')

    if not account or not phone:
        return jsonify({'ok': False, 'message': 'account and phone are required'}), 400

    result, error = renew_pppoe_package(isp_id, account, phone, plan_id)
    if error:
        return jsonify({'ok': False, 'message': error}), 400

    return jsonify({
        'ok': True,
        'message': result.get('customer_message', 'STK push sent to your phone'),
        'data': result,
    }), 200


@portal_bp.route('/payment/status/<checkout_request_id>', methods=['GET'])
def portal_payment_status(checkout_request_id):
    payload, error = get_portal_payment_status(checkout_request_id)
    if error:
        return jsonify({'ok': False, 'message': error}), 404
    return jsonify({'ok': True, 'data': payload}), 200


@portal_bp.route('/wireguard/lookup', methods=['POST'])
@rate_limit(limit=15, window=60, scope='portal-wg-lookup')
def portal_wireguard_lookup():
    data = request.get_json() or {}
    account = data.get('account') or data.get('email')
    isp_id = data.get('isp_id')

    customer, error = lookup_wireguard_customer(isp_id, account)
    if error:
        return jsonify({'ok': False, 'message': error}), 404

    return jsonify({'ok': True, 'data': serialize_wireguard_status(customer)}), 200


@portal_bp.route('/wireguard/config', methods=['POST'])
@rate_limit(limit=15, window=60, scope='portal-wg-config')
def portal_wireguard_config():
    """Download .conf for customer self-service (email + isp_id verification)."""
    data = request.get_json() or {}
    account = data.get('account') or data.get('email')
    isp_id = data.get('isp_id')

    customer, error = lookup_wireguard_customer(isp_id, account)
    if error:
        return jsonify({'ok': False, 'message': error}), 404

    peer = WireGuardPeer.query.filter_by(customer_id=customer.id, is_active=True).first()
    if not peer:
        return jsonify({'ok': False, 'message': 'WireGuard not provisioned'}), 404

    content = build_client_config(peer, peer.server, customer.service_plan)
    filename = f'infora-wg-{customer.id}.conf'
    return send_file(
        io.BytesIO(content.encode('utf-8')),
        mimetype='text/plain',
        as_attachment=True,
        download_name=filename,
    )


@portal_bp.route('/wireguard/qrcode', methods=['POST'])
@rate_limit(limit=15, window=60, scope='portal-wg-qrcode')
def portal_wireguard_qrcode():
    data = request.get_json() or {}
    account = data.get('account') or data.get('email')
    isp_id = data.get('isp_id')

    customer, error = lookup_wireguard_customer(isp_id, account)
    if error:
        return jsonify({'ok': False, 'message': error}), 404

    peer = WireGuardPeer.query.filter_by(customer_id=customer.id, is_active=True).first()
    if not peer:
        return jsonify({'ok': False, 'message': 'WireGuard not provisioned'}), 404

    try:
        import qrcode
    except ImportError:
        return jsonify({'ok': False, 'message': 'QR code unavailable'}), 503

    config_text = build_client_config(peer, peer.server, customer.service_plan)
    img = qrcode.make(config_text)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)
    return send_file(buf, mimetype='image/png', download_name=f'wg-qr-{customer.id}.png')

