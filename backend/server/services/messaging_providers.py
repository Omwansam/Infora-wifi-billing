"""Registry of SMS and WhatsApp gateways, and the engine that sends through them.

Every gateway in Settings > Communications and Settings > WhatsApp is one entry
in :data:`PROVIDERS`. A spec declares where to POST, how to authenticate, what
body to build and how to read the reply, so adding a vendor is data rather than
another branch in a dispatcher.

Three decisions worth knowing about:

**Endpoints are operator-editable.** Every provider carries a ``base_url`` or
``endpoint`` field pre-filled with the documented default. Bulk-SMS vendors
move and re-version their APIs without much warning, and several of the Kenyan
ones are not documented publicly at all. Making the URL a saved field means a
vendor changing a path costs an operator one edit instead of costing us a
release — and it is why ``verified: False`` below is a caution rather than a
blocker.

**Placeholders are resolved from one flat namespace.** ``{api_key}`` and
``{sender_id}`` come from the saved credentials, ``{phone}`` and ``{message}``
from the send. Anything missing renders empty rather than raising, because a
half-filled optional field should not turn into a 500.

**Failures carry the gateway's own words.** ``SendFailed`` always quotes the
response text. "Invalid Sender Id" tells an operator to go fix their sender ID;
"sending failed" tells them to open a support ticket with us.
"""
from __future__ import annotations

import json as jsonlib
import logging

import requests

logger = logging.getLogger(__name__)

SMS = 'sms'
WHATSAPP = 'whatsapp'

TIMEOUT = 20


class ProviderError(RuntimeError):
    """Base for anything that stops a message leaving."""


class ProviderNotConfigured(ProviderError):
    """No credentials, or a required field left blank."""


class SendFailed(ProviderError):
    """The gateway was reached and refused. Carries its wording."""


# --- field helpers ---------------------------------------------------------

def _f(name, label, **kw):
    return {'name': name, 'label': label, 'secret': False, 'required': False, **kw}


def _secret(name, label, **kw):
    return _f(name, label, secret=True, **kw)


def _endpoint(default, label='API endpoint', hint=None):
    return _f(
        'endpoint', label, default=default,
        hint=hint or 'Pre-filled with the vendor default. Change it only if your account uses a different host or path.',
    )


API_KEY = _secret('api_key', 'API key', required=True)
USERNAME = _f('username', 'Username', required=True)
SENDER_ID = _f('sender_id', 'Sender ID', hint='The registered alphanumeric or shortcode your messages come from.')


# --- response readers ------------------------------------------------------

def _json(response):
    try:
        return response.json()
    except ValueError:
        return None


def read_africastalking(response, data):
    recipients = ((data or {}).get('SMSMessageData') or {}).get('Recipients') or []
    if not recipients:
        summary = ((data or {}).get('SMSMessageData') or {}).get('Message') or response.text[:200]
        raise SendFailed(f'Gateway accepted nothing: {summary}')
    bad = [r for r in recipients if int(r.get('statusCode') or 0) not in (100, 101, 102)]
    if bad:
        first = bad[0]
        raise SendFailed(
            f"{first.get('number') or 'recipient'}: {first.get('status') or 'rejected'} "
            f"(code {first.get('statusCode')})"
        )
    return recipients[0].get('messageId') or ''


def read_twilio(response, data):
    status = (data or {}).get('status')
    if status in ('failed', 'undelivered'):
        raise SendFailed((data or {}).get('error_message') or f'Twilio reported {status}')
    return (data or {}).get('sid') or ''


def read_infobip(response, data):
    messages = (data or {}).get('messages') or []
    if not messages:
        raise SendFailed(f'Gateway accepted nothing: {response.text[:200]}')
    status = (messages[0].get('status') or {})
    group = (status.get('groupName') or '').upper()
    if group in ('REJECTED', 'UNDELIVERABLE'):
        raise SendFailed(status.get('description') or group)
    return messages[0].get('messageId') or ''


def read_ok(response, data):
    """Default: a 2xx is a send. Used where the body is not a documented shape."""
    return (data or {}).get('messageId') or (data or {}).get('message_id') or ''


# --- the registry ----------------------------------------------------------

PROVIDERS = {
    # ---------------- SMS -------------------------------------------------
    'africastalking': {
        'name': "Africa's Talking", 'channel': SMS, 'region': 'Pan-African',
        'verified': True, 'mark': 'AT',
        'fields': [
            USERNAME, API_KEY, SENDER_ID,
            _f('environment', 'Environment', choices=[('production', 'Production'), ('sandbox', 'Sandbox')],
               default='production',
               hint='Sandbox only delivers to numbers registered in your AT simulator.'),
            _endpoint('https://api.africastalking.com/version1/messaging'),
        ],
        'encoding': 'form',
        'auth': {'type': 'header', 'name': 'apiKey', 'template': '{api_key}'},
        'payload': {'username': '{username}', 'to': '{phone}', 'message': '{message}', 'from': '{sender_id}'},
        'read': read_africastalking,
        # Sandbox lives on a different host; swap it when the account says so.
        'endpoint_by': ('environment', {'sandbox': 'https://api.sandbox.africastalking.com/version1/messaging'}),
    },
    'twilio': {
        'name': 'Twilio', 'channel': SMS, 'region': 'Global', 'verified': True, 'mark': 'T',
        'fields': [
            _f('account_sid', 'Account SID', required=True),
            _secret('auth_token', 'Auth token', required=True),
            _f('from', 'From number', required=True, hint='e.g. +14155551234'),
            _endpoint('https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json'),
        ],
        'encoding': 'form',
        'auth': {'type': 'basic', 'user': '{account_sid}', 'password': '{auth_token}'},
        'payload': {'To': '{phone}', 'From': '{from}', 'Body': '{message}'},
        'read': read_twilio,
    },
    'infobip': {
        'name': 'Infobip', 'channel': SMS, 'region': 'Global', 'verified': True, 'mark': 'I',
        'fields': [
            API_KEY,
            _f('base_url', 'Base URL', required=True, hint='e.g. https://xxxxx.api.infobip.com'),
            SENDER_ID,
            _endpoint('{base_url}/sms/2/text/advanced'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'Authorization', 'template': 'App {api_key}'},
        'payload_template': lambda v: {
            'messages': [{
                'destinations': [{'to': v['phone']}],
                'from': v.get('sender_id') or 'InfoSMS',
                'text': v['message'],
            }],
        },
        'read': read_infobip,
    },
    'textbee': {
        'name': 'TextBee', 'channel': SMS, 'region': 'Global · via Android device',
        'verified': True, 'mark': 'TB',
        'fields': [
            API_KEY,
            _f('device_id', 'Device ID', required=True, hint='The Android handset that relays the messages.'),
            _endpoint('https://api.textbee.dev/api/v1/gateway/devices/{device_id}/send-sms'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'x-api-key', 'template': '{api_key}'},
        'payload_template': lambda v: {'recipients': [v['phone']], 'message': v['message']},
        'read': read_ok,
    },
    'beem': {
        'name': 'Beem Africa', 'channel': SMS, 'region': 'East Africa', 'verified': True, 'mark': 'B',
        'fields': [
            _f('api_key_id', 'API key', required=True),
            _secret('secret_key', 'Secret key', required=True),
            _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://apisms.beem.africa/v1/send'),
        ],
        'encoding': 'json',
        'auth': {'type': 'basic', 'user': '{api_key_id}', 'password': '{secret_key}'},
        'payload_template': lambda v: {
            'source_addr': v.get('sender_id') or '',
            'encoding': 0,
            'message': v['message'],
            'recipients': [{'recipient_id': 1, 'dest_addr': v['phone']}],
        },
        'read': read_ok,
    },
    'mobilesasa': {
        'name': 'MobileSasa', 'channel': SMS, 'region': 'Kenya', 'verified': False, 'mark': 'MS',
        'fields': [
            _secret('api_token', 'API token', required=True),
            _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://api.mobilesasa.com/v1/send/message'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'Authorization', 'template': 'Bearer {api_token}'},
        'payload': {'senderID': '{sender_id}', 'phone': '{phone}', 'message': '{message}'},
        'read': read_ok,
    },
    'talksasa': {
        'name': 'TalkSasa', 'channel': SMS, 'region': 'East Africa', 'verified': False, 'mark': 'TS',
        'fields': [
            _secret('api_token', 'API token', required=True),
            _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://bulksms.talksasa.com/api/v3/sms/send'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'Authorization', 'template': 'Bearer {api_token}'},
        'payload': {'recipient': '{phone}', 'sender_id': '{sender_id}', 'type': 'plain', 'message': '{message}'},
        'read': read_ok,
    },
    'hostpinnacle': {
        'name': 'BulkSMS (Host Pinnacle)', 'channel': SMS, 'region': 'Kenya',
        'verified': False, 'mark': 'HP',
        'fields': [
            USERNAME, API_KEY,
            _f('client_id', 'API client ID', required=True),
            _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://api.hostpinnacle.co.ke/SMSApi/send'),
        ],
        'encoding': 'form',
        'auth': {'type': 'headers', 'values': {'apikey': '{api_key}', 'apiclientid': '{client_id}'}},
        'payload': {
            'userid': '{username}', 'mobile': '{phone}', 'msg': '{message}',
            'senderid': '{sender_id}', 'msgType': 'text', 'duplicatecheck': 'true',
            'output': 'json', 'sendMethod': 'quick',
        },
        'read': read_ok,
    },
    'onfon': {
        'name': 'Onfon Media', 'channel': SMS, 'region': 'Kenya', 'verified': False, 'mark': 'OM',
        'fields': [
            _f('client_id', 'Client ID', required=True), API_KEY,
            _f('access_key', 'Access key'), _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'AccessKey', 'template': '{access_key}'},
        'payload_template': lambda v: {
            'SenderId': v.get('sender_id') or '', 'MessageParameters': [
                {'Number': v['phone'], 'Text': v['message']}],
            'ApiKey': v.get('api_key') or '', 'ClientId': v.get('client_id') or '',
        },
        'read': read_ok,
    },
    'advanta': {
        'name': 'Advanta SMS', 'channel': SMS, 'region': 'Kenya', 'verified': False, 'mark': 'AS',
        'fields': [
            API_KEY, _f('partner_id', 'Partner ID', required=True),
            _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://quicksms.advantasms.com/api/services/sendsms/'),
        ],
        'encoding': 'json',
        'auth': {'type': 'none'},
        'payload': {'apikey': '{api_key}', 'partnerID': '{partner_id}',
                    'shortcode': '{sender_id}', 'mobile': '{phone}', 'message': '{message}'},
        'read': read_ok,
    },
    'bongasms': {
        'name': 'Bonga SMS', 'channel': SMS, 'region': 'Kenya', 'verified': False, 'mark': 'BS',
        'fields': [
            _f('client_id', 'Client ID', required=True), API_KEY,
            _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://app.bongasms.co.ke/api/send-sms-v1'),
        ],
        'encoding': 'json',
        'auth': {'type': 'none'},
        'payload': {'apiClientID': '{client_id}', 'key': '{api_key}',
                    'secret': '{api_key}', 'txtMessage': '{message}',
                    'MSISDN': '{phone}', 'serviceID': '{sender_id}'},
        'read': read_ok,
    },
    'blessedtexts': {
        'name': 'BlessedTexts', 'channel': SMS, 'region': 'Kenya', 'verified': False, 'mark': 'BT',
        'fields': [
            API_KEY, _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://api.blessedtexts.com/api/sms/v1/sendsms'),
        ],
        'encoding': 'json',
        'auth': {'type': 'none'},
        'payload': {'api_key': '{api_key}', 'sender_id': '{sender_id}',
                    'message': '{message}', 'phone': '{phone}'},
        'read': read_ok,
    },
    'bytewave': {
        'name': 'Bytewave SMS', 'channel': SMS, 'region': 'Kenya', 'verified': False, 'mark': 'BW',
        'fields': [
            API_KEY, _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://api.bytewave.co.ke/v1/sms/send'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'Authorization', 'template': 'Bearer {api_key}'},
        'payload': {'to': '{phone}', 'message': '{message}', 'sender': '{sender_id}'},
        'read': read_ok,
    },
    'texin': {
        'name': 'Texin Bulk SMS', 'channel': SMS, 'region': 'Kenya', 'verified': False, 'mark': 'TX',
        'fields': [
            API_KEY, _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://sms.texin.co.ke/api/v1/send'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'Authorization', 'template': 'Bearer {api_key}'},
        'payload': {'to': '{phone}', 'message': '{message}', 'from': '{sender_id}'},
        'read': read_ok,
    },
    'pandora': {
        'name': 'Pandora SMS', 'channel': SMS, 'region': 'East Africa', 'verified': False, 'mark': 'PS',
        'fields': [
            API_KEY, _f('sender_id', 'Sender ID', required=True),
            _endpoint('https://api.pandorasms.com/v1/messages'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'Authorization', 'template': 'Bearer {api_key}'},
        'payload': {'to': '{phone}', 'message': '{message}', 'sender_id': '{sender_id}'},
        'read': read_ok,
    },
    'custom_sms': {
        'name': 'Custom HTTP gateway', 'channel': SMS, 'region': 'Any vendor',
        'verified': True, 'mark': 'HT',
        'fields': [
            _f('endpoint', 'Endpoint URL', required=True, hint='Where the POST goes.'),
            _f('auth_header', 'Auth header name', hint='e.g. Authorization or x-api-key. Leave blank for none.'),
            _secret('auth_value', 'Auth header value', hint='e.g. Bearer abc123'),
            _f('body_template', 'Request body', required=True,
               default='{"to": "{phone}", "message": "{message}"}',
               multiline=True,
               hint='JSON sent to the vendor. Use {phone} and {message}; any other credential field you add above can be used too.'),
        ],
        'encoding': 'json',
        'auth': {'type': 'custom'},
        'payload_template': 'body_template',
        'read': read_ok,
    },

    # ---------------- WhatsApp -------------------------------------------
    'twilio_whatsapp': {
        'name': 'Twilio', 'channel': WHATSAPP, 'region': 'Global', 'verified': True, 'mark': 'T',
        'fields': [
            _f('account_sid', 'Account SID', required=True),
            _secret('auth_token', 'Auth token', required=True),
            _f('from', 'WhatsApp from', required=True, hint='e.g. +14155551234'),
            _endpoint('https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json'),
        ],
        'encoding': 'form',
        'auth': {'type': 'basic', 'user': '{account_sid}', 'password': '{auth_token}'},
        'payload': {'To': 'whatsapp:{phone}', 'From': 'whatsapp:{from}', 'Body': '{message}'},
        'read': read_twilio,
    },
    'infobip_whatsapp': {
        'name': 'Infobip', 'channel': WHATSAPP, 'region': 'Global', 'verified': True, 'mark': 'I',
        'fields': [
            API_KEY,
            _f('base_url', 'Base URL', required=True, hint='e.g. https://xxxxx.api.infobip.com'),
            _f('from', 'Sender number', required=True, hint='The number registered with Infobip.'),
            _endpoint('{base_url}/whatsapp/1/message/text'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'Authorization', 'template': 'App {api_key}'},
        'payload_template': lambda v: {
            'from': v.get('from') or '', 'to': v['phone'],
            'content': {'text': v['message']},
        },
        'read': read_infobip,
    },
    'meta_whatsapp': {
        'name': 'Meta WhatsApp Cloud API', 'channel': WHATSAPP, 'region': 'Global',
        'verified': True, 'mark': 'M',
        'fields': [
            _f('phone_number_id', 'Phone number ID', required=True),
            _secret('access_token', 'Access token', required=True),
            _endpoint('https://graph.facebook.com/v21.0/{phone_number_id}/messages'),
        ],
        'encoding': 'json',
        'auth': {'type': 'header', 'name': 'Authorization', 'template': 'Bearer {access_token}'},
        'payload_template': lambda v: {
            'messaging_product': 'whatsapp', 'to': v['phone'].lstrip('+'),
            'type': 'text', 'text': {'body': v['message']},
        },
        'read': read_ok,
    },
    'custom_whatsapp': {
        'name': 'Custom HTTP gateway', 'channel': WHATSAPP, 'region': 'Any vendor',
        'verified': True, 'mark': 'HT',
        'fields': [
            _f('endpoint', 'Endpoint URL', required=True),
            _f('auth_header', 'Auth header name', hint='e.g. Authorization. Leave blank for none.'),
            _secret('auth_value', 'Auth header value'),
            _f('body_template', 'Request body', required=True, multiline=True,
               default='{"to": "{phone}", "message": "{message}"}',
               hint='JSON sent to the vendor. Use {phone} and {message}.'),
        ],
        'encoding': 'json',
        'auth': {'type': 'custom'},
        'payload_template': 'body_template',
        'read': read_ok,
    },
}


def for_channel(channel):
    """Providers for one channel, in registry order."""
    return [{'id': pid, **spec} for pid, spec in PROVIDERS.items() if spec['channel'] == channel]


def get(provider_id):
    return PROVIDERS.get((provider_id or '').strip().lower())


def public_spec(provider_id):
    """The parts of a spec the browser needs — never the send internals."""
    spec = get(provider_id)
    if not spec:
        return None
    return {
        'id': provider_id,
        'name': spec['name'],
        'channel': spec['channel'],
        'region': spec['region'],
        'verified': spec['verified'],
        'mark': spec['mark'],
        'fields': [
            {k: v for k, v in field.items() if k != 'template'}
            for field in spec['fields']
        ],
    }


# --- the engine ------------------------------------------------------------

def _render(template, values):
    """Fill ``{placeholders}`` from ``values``; unknown keys render empty."""
    if not isinstance(template, str):
        return template
    out = template
    for key, value in values.items():
        out = out.replace('{' + key + '}', '' if value is None else str(value))
    return out


def missing_fields(provider_id, config):
    spec = get(provider_id)
    if not spec:
        return ['provider']
    return [
        field['name'] for field in spec['fields']
        if field.get('required') and not str((config or {}).get(field['name']) or '').strip()
    ]


def _resolve_endpoint(spec, values):
    endpoint = (values.get('endpoint') or '').strip()
    if not endpoint:
        endpoint = next(
            (f.get('default') for f in spec['fields'] if f['name'] == 'endpoint'), '')
    switch = spec.get('endpoint_by')
    if switch:
        field, mapping = switch
        override = mapping.get((values.get(field) or '').strip().lower())
        # Only swap when the operator has not typed their own endpoint.
        if override and not (values.get('endpoint') or '').strip():
            endpoint = override
    return _render(endpoint, values)


def _build_body(spec, values):
    template = spec.get('payload_template')
    if callable(template):
        return template(values)
    if isinstance(template, str):
        # Operator-authored JSON, e.g. the Custom HTTP gateway.
        raw = _render(values.get(template) or '', values)
        try:
            return jsonlib.loads(raw)
        except ValueError as exc:
            raise ProviderNotConfigured(f'Request body is not valid JSON: {exc}') from exc
    return {k: _render(v, values) for k, v in (spec.get('payload') or {}).items()}


def send(provider_id, config, phone, message):
    """POST one message. Returns a provider message id (possibly ''); raises on failure."""
    spec = get(provider_id)
    if not spec:
        raise ProviderNotConfigured(f'Unknown provider "{provider_id}"')

    missing = missing_fields(provider_id, config)
    if missing:
        raise ProviderNotConfigured(
            f"{spec['name']} is missing: {', '.join(missing)}")

    values = {**(config or {}), 'phone': phone, 'message': message}
    url = _resolve_endpoint(spec, values)
    if not url:
        raise ProviderNotConfigured(f"{spec['name']} has no endpoint configured")

    body = _build_body(spec, values)
    headers = {'Accept': 'application/json'}
    auth = spec.get('auth') or {'type': 'none'}
    basic = None

    if auth['type'] == 'header':
        headers[auth['name']] = _render(auth['template'], values)
    elif auth['type'] == 'headers':
        for name, template in auth['values'].items():
            headers[name] = _render(template, values)
    elif auth['type'] == 'basic':
        basic = (_render(auth['user'], values), _render(auth['password'], values))
    elif auth['type'] == 'custom':
        name = (values.get('auth_header') or '').strip()
        if name:
            headers[name] = _render(values.get('auth_value') or '', values)

    kwargs = {'headers': headers, 'timeout': TIMEOUT}
    if basic:
        kwargs['auth'] = basic
    if spec.get('encoding') == 'json':
        kwargs['json'] = body
    else:
        # Drop blanks: several gateways reject an empty `from` outright rather
        # than treating it as "use the account default".
        kwargs['data'] = {k: v for k, v in body.items() if v not in (None, '')}

    try:
        response = requests.post(url, **kwargs)
    except requests.RequestException as exc:
        raise SendFailed(f'Could not reach {url}: {exc}') from exc

    data = _json(response)
    if response.status_code >= 400:
        detail = response.text[:300].strip() or f'HTTP {response.status_code}'
        raise SendFailed(f'Gateway returned HTTP {response.status_code}: {detail}')

    return spec['read'](response, data)
