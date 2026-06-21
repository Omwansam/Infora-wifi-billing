"""Public captive portal API (no admin JWT required)."""
from flask import Blueprint, jsonify, request

from services.portal_service import (
    get_portal_config,
    get_portal_payment_status,
    list_portal_plans,
    lookup_pppoe_customer,
    purchase_hotspot_package,
    renew_pppoe_package,
    serialize_portal_plan,
    serialize_pppoe_status,
)

portal_bp = Blueprint('portal', __name__, url_prefix='/api/portal')


@portal_bp.route('/config', methods=['GET'])
def portal_config():
    isp_id = request.args.get('isp_id', type=int)
    config = get_portal_config(isp_id)
    if not config:
        return jsonify({'ok': False, 'message': 'No active ISP configured'}), 404
    return jsonify({'ok': True, 'data': config}), 200


@portal_bp.route('/plans', methods=['GET'])
def portal_plans():
    isp_id = request.args.get('isp_id', type=int)
    plan_type = request.args.get('type', 'hotspot')
    if plan_type not in ('hotspot', 'pppoe'):
        return jsonify({'ok': False, 'message': 'Invalid plan type'}), 400

    plans = list_portal_plans(isp_id, plan_type)
    return jsonify({
        'ok': True,
        'data': [serialize_portal_plan(plan) for plan in plans],
    }), 200


@portal_bp.route('/hotspot/purchase', methods=['POST'])
def portal_hotspot_purchase():
    data = request.get_json() or {}
    plan_id = data.get('plan_id')
    phone = data.get('phone')
    isp_id = data.get('isp_id')
    full_name = data.get('full_name')

    if not plan_id or not phone:
        return jsonify({'ok': False, 'message': 'plan_id and phone are required'}), 400

    result, error = purchase_hotspot_package(isp_id, plan_id, phone, full_name)
    if error:
        return jsonify({'ok': False, 'message': error}), 400

    return jsonify({
        'ok': True,
        'message': result.get('customer_message', 'STK push sent to your phone'),
        'data': result,
    }), 200


@portal_bp.route('/pppoe/lookup', methods=['POST'])
def portal_pppoe_lookup():
    data = request.get_json() or {}
    account = data.get('account') or data.get('username')
    isp_id = data.get('isp_id')

    customer, error = lookup_pppoe_customer(isp_id, account)
    if error:
        return jsonify({'ok': False, 'message': error}), 404

    return jsonify({'ok': True, 'data': serialize_pppoe_status(customer)}), 200


@portal_bp.route('/pppoe/pay', methods=['POST'])
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
