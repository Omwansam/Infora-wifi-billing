"""Registry of payment gateways beyond M-Pesa Daraja.

Same shape as ``messaging_providers``: one declarative spec per vendor, an
engine that builds the checkout request, and a reader that turns the reply into
a redirect URL or a reference.

**What "wired" means here, precisely.** These gateways are *hosted checkout*
integrations: we ask the vendor to create a payment, they hand back a URL, the
subscriber pays there, and the vendor calls our webhook. That first half is
implemented and testable. The second half — reconciling a webhook back to an
invoice — is per-vendor signature verification and is NOT implemented; each
vendor signs differently and getting it wrong means either dropping real
payments or accepting forged ones. ``verify_callback`` is the seam where that
goes, and it currently refuses rather than guessing.

So: a subscriber can be sent to a real checkout page today. Automatic
confirmation still belongs to M-Pesa alone. The panel says so.

M-Pesa itself is deliberately absent — it predates this registry, has its own
STK/callback path in ``mpesa_service``, and folding it in would mean rewriting
working money code for symmetry.
"""
from __future__ import annotations

import logging

import requests

logger = logging.getLogger(__name__)

TIMEOUT = 25


class GatewayError(RuntimeError):
    """Base for anything that stops a checkout being created."""


class GatewayNotConfigured(GatewayError):
    """Missing or incomplete credentials."""


class CheckoutFailed(GatewayError):
    """The vendor was reached and refused. Carries their wording."""


class CallbackUnverified(GatewayError):
    """We cannot prove a webhook came from the vendor, so we will not trust it."""


def _f(name, label, **kw):
    return {'name': name, 'label': label, 'secret': False, 'required': False, **kw}


def _secret(name, label, **kw):
    return _f(name, label, secret=True, **kw)


GATEWAYS = {
    'paystack': {
        'name': 'Paystack', 'region': 'Paystack · 14 markets', 'mark': 'PS',
        'caps': ['Cards', 'MoMo', 'Bank'], 'settlement': 'T+1 to bank',
        'currency': 'KES', 'verified': True,
        'fields': [
            _secret('secret_key', 'Secret key', required=True, hint='Starts with sk_'),
            _f('public_key', 'Public key', hint='Starts with pk_ — used by the checkout widget.'),
            _f('endpoint', 'API endpoint', default='https://api.paystack.co/transaction/initialize'),
        ],
        'auth': ('bearer', 'secret_key'),
        # Paystack takes the smallest currency unit.
        'build': lambda v: {
            'email': v['email'], 'amount': int(round(float(v['amount']) * 100)),
            'reference': v['reference'], 'currency': v.get('currency') or 'KES',
            'callback_url': v.get('return_url') or '',
        },
        'read': lambda d: ((d.get('data') or {}).get('authorization_url'),
                           (d.get('data') or {}).get('reference')),
        'ok': lambda d: bool(d.get('status')),
    },
    'pesapal': {
        'name': 'PesaPal', 'region': 'Pesapal · East Africa', 'mark': 'PL',
        'caps': ['Cards', 'Mobile Money', 'Airtel'], 'settlement': 'To bank',
        'currency': 'KES', 'verified': False,
        'fields': [
            _f('consumer_key', 'Consumer key', required=True),
            _secret('consumer_secret', 'Consumer secret', required=True),
            _f('ipn_id', 'IPN ID', hint='Registered notification id from your Pesapal dashboard.'),
            _f('endpoint', 'API endpoint',
               default='https://pay.pesapal.com/v3/api/Transactions/SubmitOrderRequest'),
        ],
        'auth': ('bearer', 'access_token'),
        'build': lambda v: {
            'id': v['reference'], 'currency': v.get('currency') or 'KES',
            'amount': float(v['amount']), 'description': v.get('description') or 'Subscription',
            'callback_url': v.get('return_url') or '',
            'notification_id': v.get('ipn_id') or '',
            'billing_address': {'email_address': v['email']},
        },
        'read': lambda d: (d.get('redirect_url'), d.get('order_tracking_id')),
        'ok': lambda d: not d.get('error'),
    },
    'dpo': {
        'name': 'DPO Pay', 'region': 'DPO Pay · multi-country', 'mark': 'D',
        'caps': ['Cards', 'Mobile money'], 'settlement': 'To bank',
        'currency': 'KES', 'verified': False,
        'fields': [
            _secret('company_token', 'Company token', required=True),
            _f('service_type', 'Service type', required=True, hint='The DPO service id for your account.'),
            _f('endpoint', 'API endpoint', default='https://secure.3gdirectpay.com/API/v6/'),
        ],
        'auth': ('none', None),
        'build': lambda v: {
            'CompanyToken': v['company_token'], 'Request': 'createToken',
            'Transaction': {
                'PaymentAmount': float(v['amount']),
                'PaymentCurrency': v.get('currency') or 'KES',
                'CompanyRef': v['reference'],
                'RedirectURL': v.get('return_url') or '',
                'customerEmail': v['email'],
            },
            'Services': {'Service': {'ServiceType': v['service_type'],
                                     'ServiceDescription': v.get('description') or 'Subscription'}},
        },
        'read': lambda d: (d.get('redirect_url'), d.get('TransToken')),
        'ok': lambda d: str(d.get('Result') or '000') == '000',
    },
    'kopokopo': {
        'name': 'Kopo Kopo', 'region': 'Kopo Kopo · Kenya', 'mark': 'K',
        'caps': ['Mobile money till'], 'settlement': 'T+1 to bank',
        'currency': 'KES', 'verified': False,
        'fields': [
            _f('client_id', 'Client ID', required=True),
            _secret('client_secret', 'Client secret', required=True),
            _f('till_number', 'Till number', required=True),
            _f('endpoint', 'API endpoint',
               default='https://api.kopokopo.com/api/v1/incoming_payments'),
        ],
        'auth': ('bearer', 'access_token'),
        'build': lambda v: {
            'payment_channel': 'M-PESA STK Push', 'till_number': v.get('till_number') or '',
            'subscriber': {'email': v['email'], 'phone_number': v.get('phone') or ''},
            'amount': {'currency': v.get('currency') or 'KES', 'value': float(v['amount'])},
            'metadata': {'reference': v['reference']},
            '_links': {'callback_url': v.get('callback_url') or ''},
        },
        'read': lambda d: (None, ((d.get('data') or {}).get('id'))),
        'ok': lambda d: bool(d.get('data')),
    },
    'paypal': {
        'name': 'PayPal', 'region': 'PayPal · global', 'mark': 'PP',
        'caps': ['Cards', 'PayPal'], 'settlement': 'To PayPal balance',
        'currency': 'USD', 'verified': True,
        'fields': [
            _f('client_id', 'Client ID', required=True),
            _secret('client_secret', 'Client secret', required=True),
            _f('endpoint', 'API endpoint',
               default='https://api-m.paypal.com/v2/checkout/orders',
               hint='Use api-m.sandbox.paypal.com while testing.'),
        ],
        'auth': ('bearer', 'access_token'),
        'build': lambda v: {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'reference_id': v['reference'],
                'amount': {'currency_code': v.get('currency') or 'USD',
                           'value': f"{float(v['amount']):.2f}"},
            }],
            'application_context': {'return_url': v.get('return_url') or ''},
        },
        'read': lambda d: (next((l['href'] for l in (d.get('links') or [])
                                 if l.get('rel') in ('approve', 'payer-action')), None),
                           d.get('id')),
        'ok': lambda d: bool(d.get('id')),
    },
    'relworx': {
        'name': 'Relworx', 'region': 'Relworx · Uganda', 'mark': 'R',
        'caps': ['Mobile money'], 'settlement': 'To bank',
        'currency': 'UGX', 'verified': False,
        'fields': [
            _secret('api_key', 'API key', required=True),
            _f('account_no', 'Account number', required=True),
            _f('endpoint', 'API endpoint',
               default='https://payments.relworx.com/api/mobile-money/request-payment'),
        ],
        'auth': ('bearer', 'api_key'),
        'build': lambda v: {
            'account_no': v.get('account_no') or '', 'reference': v['reference'],
            'msisdn': v.get('phone') or '', 'currency': v.get('currency') or 'UGX',
            'amount': float(v['amount']),
            'description': v.get('description') or 'Subscription',
        },
        'read': lambda d: (None, d.get('internal_reference')),
        'ok': lambda d: bool(d.get('success', True)),
    },
}


def all_gateways():
    return [{'id': gid, **spec} for gid, spec in GATEWAYS.items()]


def get(gateway_id):
    return GATEWAYS.get((gateway_id or '').strip().lower())


def public_spec(gateway_id):
    spec = get(gateway_id)
    if not spec:
        return None
    return {
        'id': gateway_id, 'name': spec['name'], 'region': spec['region'],
        'mark': spec['mark'], 'caps': spec['caps'], 'settlement': spec['settlement'],
        'currency': spec['currency'], 'verified': spec['verified'],
        'fields': spec['fields'],
        # Every gateway here can start a checkout; none can confirm one yet.
        'can_checkout': True, 'can_confirm': False,
    }


def missing_fields(gateway_id, config):
    spec = get(gateway_id)
    if not spec:
        return ['gateway']
    return [f['name'] for f in spec['fields']
            if f.get('required') and not str((config or {}).get(f['name']) or '').strip()]


def _endpoint(spec, config):
    return (config.get('endpoint') or '').strip() or next(
        (f.get('default') for f in spec['fields'] if f['name'] == 'endpoint'), '')


def create_checkout(gateway_id, config, *, amount, reference, email,
                    phone=None, currency=None, description=None,
                    return_url=None, callback_url=None):
    """Ask the vendor to create a payment. Returns ``{'url', 'reference', 'raw'}``.

    ``url`` is where to send the subscriber; it is ``None`` for gateways that
    push to a handset instead of redirecting (Kopo Kopo, Relworx).
    """
    spec = get(gateway_id)
    if not spec:
        raise GatewayNotConfigured(f'Unknown gateway "{gateway_id}"')

    missing = missing_fields(gateway_id, config)
    if missing:
        raise GatewayNotConfigured(f"{spec['name']} is missing: {', '.join(missing)}")

    values = {
        **(config or {}), 'amount': amount, 'reference': reference, 'email': email,
        'phone': phone, 'currency': currency or spec['currency'],
        'description': description, 'return_url': return_url,
        'callback_url': callback_url,
    }
    url = _endpoint(spec, config)
    if not url:
        raise GatewayNotConfigured(f"{spec['name']} has no endpoint configured")

    headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
    auth_type, auth_field = spec['auth']
    if auth_type == 'bearer':
        token = (config or {}).get(auth_field) or ''
        if not token:
            # PayPal, Pesapal and Kopo Kopo mint a short-lived token from their
            # client credentials. That exchange is not implemented, so say which
            # step is missing rather than sending an empty Authorization header
            # and reporting the vendor's opaque 401.
            raise GatewayNotConfigured(
                f"{spec['name']} needs an OAuth access token exchanged from your "
                f"client credentials first — that step is not implemented yet.")
        headers['Authorization'] = f'Bearer {token}'

    try:
        response = requests.post(url, json=spec['build'](values), headers=headers,
                                 timeout=TIMEOUT)
    except requests.RequestException as exc:
        raise CheckoutFailed(f'Could not reach {url}: {exc}') from exc

    try:
        data = response.json()
    except ValueError:
        raise CheckoutFailed(
            f'Gateway returned HTTP {response.status_code}: {response.text[:250]}')

    if response.status_code >= 400 or not spec['ok'](data):
        detail = data.get('message') or data.get('error') or str(data)[:250]
        raise CheckoutFailed(f'{spec["name"]} refused it: {detail}')

    redirect, ref = spec['read'](data)
    return {'url': redirect, 'reference': ref or reference, 'raw': data}


def verify_callback(gateway_id, headers, body, config):
    """Where per-vendor webhook verification will live.

    Refuses deliberately. Every vendor signs differently, and a handler that
    accepts unverified webhooks is a way to be paid in forgeries; one that
    verifies wrongly silently drops real payments. Neither belongs in a commit
    that cannot be tested against a live merchant account.
    """
    spec = get(gateway_id)
    name = spec['name'] if spec else gateway_id
    raise CallbackUnverified(
        f'Webhook verification for {name} is not implemented. Confirm these '
        f'payments manually, or use M-Pesa Daraja, which does confirm itself.')
