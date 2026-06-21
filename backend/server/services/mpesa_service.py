"""Safaricom M-Pesa Daraja STK Push integration."""
import base64
import json
from datetime import datetime

import requests
from flask import current_app


class MpesaError(Exception):
    pass


def _config(key):
    return current_app.config.get(key) or ''


def get_access_token():
    consumer_key = _config('MPESA_CONSUMER_KEY')
    consumer_secret = _config('MPESA_CONSUMER_SECRET')
    if not consumer_key or not consumer_secret:
        raise MpesaError('M-Pesa consumer key/secret not configured')

    auth = base64.b64encode(f'{consumer_key}:{consumer_secret}'.encode()).decode()
    response = requests.get(
        _config('MPESA_AUTH_URL'),
        headers={'Authorization': f'Basic {auth}'},
        timeout=30,
    )
    response.raise_for_status()
    token = response.json().get('access_token')
    if not token:
        raise MpesaError('Failed to obtain M-Pesa access token')
    return token


def _generate_password():
    shortcode = _config('MPESA_SHORTCODE')
    passkey = _config('MPESA_PASSKEY')
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    raw = f'{shortcode}{passkey}{timestamp}'.encode()
    return base64.b64encode(raw).decode(), timestamp


def initiate_stk_push(phone, amount, account_reference, transaction_desc):
    """Initiate Lipa na M-Pesa STK push."""
    phone = _normalize_phone(phone)
    token = get_access_token()
    password, timestamp = _generate_password()
    shortcode = _config('MPESA_SHORTCODE')
    callback_url = _config('MPESA_CALLBACK_URL')

    if not shortcode or not callback_url:
        raise MpesaError('M-Pesa shortcode or callback URL not configured')

    payload = {
        'BusinessShortCode': shortcode,
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': _config('MPESA_TRANSACTION_TYPE') or 'CustomerPayBillOnline',
        'Amount': int(float(amount)),
        'PartyA': phone,
        'PartyB': shortcode,
        'PhoneNumber': phone,
        'CallBackURL': callback_url,
        'AccountReference': account_reference[:12],
        'TransactionDesc': transaction_desc[:13],
    }

    response = requests.post(
        _config('MPESA_STK_PUSH_URL'),
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=30,
    )
    data = response.json()
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
