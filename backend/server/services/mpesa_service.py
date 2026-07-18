"""Safaricom M-Pesa Daraja STK Push integration.

Credentials resolve **per-ISP** from Settings > Payments (the ``payment_settings``
row), and fall back to the global ``MPESA_*`` env config when an ISP has not
configured its own Daraja keys. This lets each tenant collect payments into
their own paybill/till while a shared sandbox key still works out of the box.
"""
import base64
from datetime import datetime

import requests
from flask import current_app

from services.encryption import decrypt_value


class MpesaError(Exception):
    pass


SANDBOX_BASE = 'https://sandbox.safaricom.co.ke'
LIVE_BASE = 'https://api.safaricom.co.ke'


def _env(key):
    return current_app.config.get(key) or ''


def _is_live(environment):
    return str(environment or '').lower() in ('live', 'production', 'prod')


def resolve_mpesa_config(isp=None):
    """Resolve the effective Daraja credentials for a request.

    Per-ISP ``payment_settings`` values win; anything the ISP left blank falls
    back to the global env config. Secret fields are decrypted here.
    """
    ps = getattr(isp, 'payment_settings', None) if isp is not None else None

    def isp_val(attr):
        return getattr(ps, attr, None) if ps is not None else None

    consumer_key = isp_val('daraja_consumer_key') or _env('MPESA_CONSUMER_KEY')
    consumer_secret = (
        decrypt_value(ps.daraja_consumer_secret) if ps and ps.daraja_consumer_secret else ''
    ) or _env('MPESA_CONSUMER_SECRET')
    shortcode = isp_val('daraja_shortcode') or _env('MPESA_SHORTCODE')
    passkey = (
        decrypt_value(ps.daraja_passkey) if ps and ps.daraja_passkey else ''
    ) or _env('MPESA_PASSKEY')
    callback_url = isp_val('daraja_callback_url') or _env('MPESA_CALLBACK_URL')

    environment = isp_val('daraja_env') or current_app.config.get('MPESA_ENVIRONMENT') or 'sandbox'
    route = isp_val('collection_route') or 'paybill'

    # Buy Goods (till) STK uses CustomerBuyGoodsOnline; Paybill/Bank use
    # CustomerPayBillOnline (the default). This is the one Daraja field that
    # depends on which collection route the ISP chose.
    if route == 'buygoods':
        transaction_type = 'CustomerBuyGoodsOnline'
    else:
        transaction_type = _env('MPESA_TRANSACTION_TYPE') or 'CustomerPayBillOnline'

    base = LIVE_BASE if _is_live(environment) else SANDBOX_BASE

    return {
        'consumer_key': consumer_key,
        'consumer_secret': consumer_secret,
        'shortcode': shortcode,
        'passkey': passkey,
        'callback_url': callback_url,
        'environment': 'live' if _is_live(environment) else 'sandbox',
        'transaction_type': transaction_type,
        'auth_url': f'{base}/oauth/v1/generate?grant_type=client_credentials',
        'stk_push_url': f'{base}/mpesa/stkpush/v1/processrequest',
    }


def get_access_token(cfg):
    if not cfg['consumer_key'] or not cfg['consumer_secret']:
        raise MpesaError('M-Pesa consumer key/secret not configured')

    auth = base64.b64encode(f"{cfg['consumer_key']}:{cfg['consumer_secret']}".encode()).decode()
    response = requests.get(
        cfg['auth_url'],
        headers={'Authorization': f'Basic {auth}'},
        timeout=30,
    )
    response.raise_for_status()
    token = response.json().get('access_token')
    if not token:
        raise MpesaError('Failed to obtain M-Pesa access token')
    return token


def _generate_password(cfg):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    raw = f"{cfg['shortcode']}{cfg['passkey']}{timestamp}".encode()
    return base64.b64encode(raw).decode(), timestamp


def initiate_stk_push(phone, amount, account_reference, transaction_desc, isp=None):
    """Initiate a Lipa na M-Pesa Online (STK push) using the ISP's Daraja config."""
    cfg = resolve_mpesa_config(isp)
    if not cfg['shortcode'] or not cfg['passkey']:
        raise MpesaError('M-Pesa shortcode or passkey not configured')
    if not cfg['callback_url']:
        raise MpesaError('M-Pesa callback URL not configured')

    phone = _normalize_phone(phone)
    token = get_access_token(cfg)
    password, timestamp = _generate_password(cfg)

    payload = {
        'BusinessShortCode': cfg['shortcode'],
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': cfg['transaction_type'],
        'Amount': int(round(float(amount))),
        'PartyA': phone,
        'PartyB': cfg['shortcode'],
        'PhoneNumber': phone,
        'CallBackURL': cfg['callback_url'],
        'AccountReference': (account_reference or 'Payment')[:12],
        'TransactionDesc': (transaction_desc or 'Payment')[:13],
    }

    response = requests.post(
        cfg['stk_push_url'],
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=30,
    )
    try:
        data = response.json()
    except ValueError:
        raise MpesaError(f'M-Pesa returned a non-JSON response (HTTP {response.status_code})')
    if response.status_code >= 400 or data.get('errorCode'):
        raise MpesaError(data.get('errorMessage') or data.get('ResponseDescription') or 'STK push failed')
    return data


def _normalize_phone(phone):
    digits = ''.join(ch for ch in str(phone) if ch.isdigit())
    if digits.startswith('0'):
        digits = '254' + digits[1:]
    elif digits.startswith('7') or digits.startswith('1'):
        digits = '254' + digits
    elif not digits.startswith('254'):
        digits = '254' + digits
    return digits


def parse_callback_payload(payload):
    """Parse Safaricom STK callback body."""
    body = payload.get('Body', {}).get('stkCallback', payload)
    result = {
        'merchant_request_id': body.get('MerchantRequestID'),
        'checkout_request_id': body.get('CheckoutRequestID'),
        'result_code': body.get('ResultCode'),
        'result_desc': body.get('ResultDesc'),
        'success': body.get('ResultCode') == 0,
        'amount': None,
        'mpesa_receipt': None,
        'phone': None,
        'transaction_date': None,
    }

    metadata = body.get('CallbackMetadata', {}).get('Item', [])
    for item in metadata:
        name = item.get('Name')
        value = item.get('Value')
        if name == 'Amount':
            result['amount'] = value
        elif name == 'MpesaReceiptNumber':
            result['mpesa_receipt'] = value
        elif name == 'PhoneNumber':
            result['phone'] = str(value)
        elif name == 'TransactionDate':
            result['transaction_date'] = str(value)

    return result
