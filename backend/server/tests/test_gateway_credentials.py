"""Tests for tenant-first gateway credential resolution.

Settings > Email and Settings > Communications write credentials into
``integration_settings``; ``mailer`` and ``notification_dispatch`` read them
back. The rules that are easy to regress silently are all here:

* a tenant's row must beat the platform env config,
* a row that is switched off must be treated as absent, so the toggle in the
  UI really does put delivery back on the platform default,
* a half-filled row must fall back whole rather than blend, because pairing a
  tenant host with a platform password produces an auth error that reads like
  a wrong password,
* and Africa's Talking refusals must surface their own wording, since that is
  the only part an operator can act on.

No database and no network — the row lookup and ``requests`` are both stubbed.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys
import types

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import (  # noqa: E402
    mailer, messaging_providers as mp, notification_dispatch as nd, tenant_integrations,
)


def make_isp(**kw):
    """An ISP stub carrying the provider-selection columns."""
    defaults = {'id': 1, 'name': 'Cosmo', 'company_name': 'Cosmo Ltd',
                'sms_provider': None, 'whatsapp_provider': None}
    return types.SimpleNamespace(**{**defaults, **kw})


ISP = make_isp()

SMTP_ROW = {
    'host': 'smtp.acme.co', 'port': '465', 'username': 'u', 'password': 'p',
    'encryption': 'ssl', 'from_email': 'hi@acme.co',
}
AT_ROW = {
    'username': 'acme', 'api_key': 'k', 'sender_id': 'ACME',
    'environment': 'sandbox',
}


@pytest.fixture
def rows(monkeypatch):
    """Stand in for the integration_settings table."""
    store = {}

    def fake_lookup(isp, key, required=()):
        config = store.get((getattr(isp, 'id', None), key))
        if not config:
            return None
        if [r for r in required if not str(config.get(r) or '').strip()]:
            return None
        return config

    monkeypatch.setattr(tenant_integrations, 'integration_config', fake_lookup)
    return store


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for var in ('MAIL_SERVER', 'MAIL_PORT', 'MAIL_USERNAME', 'MAIL_PASSWORD',
                'SMS_ENABLED', 'SMS_PROVIDER', 'AT_USERNAME', 'AT_API_KEY'):
        monkeypatch.delenv(var, raising=False)


# --- SMTP ------------------------------------------------------------------

def test_no_source_anywhere_resolves_to_nothing(rows):
    assert mailer.resolve_smtp_config(ISP) is None
    assert mailer.is_configured(ISP) is False


def test_tenant_smtp_wins_over_platform(rows, monkeypatch):
    monkeypatch.setenv('MAIL_SERVER', 'smtp.platform.test')
    rows[(1, 'smtp')] = SMTP_ROW
    config = mailer.resolve_smtp_config(ISP)
    assert config['source'] == 'tenant'
    assert config['host'] == 'smtp.acme.co'
    assert config['sender'] == 'hi@acme.co'


def test_ssl_and_starttls_are_mutually_exclusive(rows):
    rows[(1, 'smtp')] = {**SMTP_ROW, 'encryption': 'ssl'}
    config = mailer.resolve_smtp_config(ISP)
    assert (config['use_ssl'], config['use_tls']) == (True, False)

    rows[(1, 'smtp')] = {**SMTP_ROW, 'encryption': 'tls'}
    config = mailer.resolve_smtp_config(ISP)
    assert (config['use_ssl'], config['use_tls']) == (False, True)

    rows[(1, 'smtp')] = {**SMTP_ROW, 'encryption': 'none'}
    config = mailer.resolve_smtp_config(ISP)
    assert (config['use_ssl'], config['use_tls']) == (False, False)


def test_a_half_filled_tenant_row_falls_back_whole(rows, monkeypatch):
    """Never pair a tenant host with a platform password."""
    monkeypatch.setenv('MAIL_SERVER', 'smtp.platform.test')
    monkeypatch.setenv('MAIL_USERNAME', 'platform-user')
    rows[(1, 'smtp')] = {'host': '', 'username': 'tenant-user'}
    config = mailer.resolve_smtp_config(ISP)
    assert config['source'] == 'platform'
    assert config['username'] == 'platform-user'


def test_unparseable_port_does_not_explode(rows):
    rows[(1, 'smtp')] = {**SMTP_ROW, 'port': 'not-a-number'}
    assert mailer.resolve_smtp_config(ISP)['port'] == 587


def test_no_isp_uses_the_platform(rows, monkeypatch):
    monkeypatch.setenv('MAIL_SERVER', 'smtp.platform.test')
    assert mailer.resolve_smtp_config(None)['source'] == 'platform'


# --- SMS gateway selection -------------------------------------------------

def test_tenant_selection_wins_over_platform(rows, monkeypatch):
    monkeypatch.setenv('SMS_ENABLED', 'true')
    monkeypatch.setenv('SMS_PROVIDER', 'africastalking')
    monkeypatch.setenv('AT_USERNAME', 'platform')
    monkeypatch.setenv('AT_API_KEY', 'platform-key')

    isp = make_isp(sms_provider='twilio')
    rows[(1, 'twilio')] = {'account_sid': 'AC1', 'auth_token': 't', 'from': '+1415'}

    gateway = nd.resolve_gateway(isp, mp.SMS)
    assert gateway['source'] == 'tenant'
    assert gateway['provider'] == 'twilio'
    assert gateway['config']['auth_token'] == 't'


def test_selection_without_saved_credentials_falls_back(rows, monkeypatch):
    """Selecting a provider whose credentials are gone must not send nothing."""
    monkeypatch.setenv('SMS_ENABLED', 'true')
    monkeypatch.setenv('SMS_PROVIDER', 'africastalking')
    monkeypatch.setenv('AT_USERNAME', 'platform')
    monkeypatch.setenv('AT_API_KEY', 'platform-key')

    isp = make_isp(sms_provider='twilio')          # selected, but no row saved
    assert nd.resolve_gateway(isp, mp.SMS)['source'] == 'platform'


def test_half_filled_credentials_fall_back(rows, monkeypatch):
    monkeypatch.setenv('SMS_ENABLED', 'true')
    monkeypatch.setenv('SMS_PROVIDER', 'africastalking')
    monkeypatch.setenv('AT_USERNAME', 'platform')
    monkeypatch.setenv('AT_API_KEY', 'platform-key')

    isp = make_isp(sms_provider='twilio')
    rows[(1, 'twilio')] = {'account_sid': 'AC1', 'auth_token': '', 'from': '+1415'}
    assert nd.resolve_gateway(isp, mp.SMS)['source'] == 'platform'


def test_unknown_selection_is_ignored(rows, monkeypatch):
    isp = make_isp(sms_provider='not-a-real-vendor')
    assert nd.resolve_gateway(isp, mp.SMS) is None


def test_a_whatsapp_provider_cannot_be_selected_for_sms(rows):
    isp = make_isp(sms_provider='twilio_whatsapp')
    rows[(1, 'twilio_whatsapp')] = {'account_sid': 'AC1', 'auth_token': 't', 'from': '+1415'}
    assert nd.resolve_gateway(isp, mp.SMS) is None


def test_platform_sms_needs_both_the_flag_and_credentials(rows, monkeypatch):
    monkeypatch.setenv('SMS_PROVIDER', 'africastalking')
    monkeypatch.setenv('AT_USERNAME', 'platform')
    monkeypatch.setenv('AT_API_KEY', 'platform-key')
    assert nd.resolve_gateway(None, mp.SMS) is None       # SMS_ENABLED not set

    monkeypatch.setenv('SMS_ENABLED', 'true')
    assert nd.resolve_gateway(None, mp.SMS)['source'] == 'platform'


def test_whatsapp_has_no_platform_fallback(rows, monkeypatch):
    """A shared number cannot carry another business's branding."""
    monkeypatch.setenv('SMS_ENABLED', 'true')
    monkeypatch.setenv('SMS_PROVIDER', 'africastalking')
    monkeypatch.setenv('AT_USERNAME', 'platform')
    monkeypatch.setenv('AT_API_KEY', 'platform-key')
    assert nd.resolve_gateway(make_isp(), mp.WHATSAPP) is None


# --- the send engine -------------------------------------------------------

def _respond(monkeypatch, status, body=None, text=''):
    class Response:
        status_code = status
        def json(self):
            if body is None:
                raise ValueError('no json')
            return body
    Response.text = text
    monkeypatch.setattr(mp, 'requests', types.SimpleNamespace(
        post=lambda *a, **k: Response(), RequestException=Exception))


AT_CONFIG = {'username': 'u', 'api_key': 'k', 'sender_id': 'ACME'}


def test_accepted_recipient_is_a_send(monkeypatch):
    _respond(monkeypatch, 201, {'SMSMessageData': {
        'Message': 'Sent to 1/1',
        'Recipients': [{'statusCode': 101, 'status': 'Success', 'messageId': 'M1'}]}})
    assert mp.send('africastalking', AT_CONFIG, '+254700000000', 'hi') == 'M1'


def test_rejected_recipient_surfaces_the_gateways_wording(monkeypatch):
    _respond(monkeypatch, 201, {'SMSMessageData': {
        'Recipients': [{'statusCode': 403, 'number': '+254700000000',
                        'status': 'Invalid Sender Id'}]}})
    with pytest.raises(mp.SendFailed, match='Invalid Sender Id'):
        mp.send('africastalking', AT_CONFIG, '+254700000000', 'hi')


def test_empty_recipients_is_a_failure_not_a_success(monkeypatch):
    """Out of credit answers 200 with nobody accepted — not a send."""
    _respond(monkeypatch, 201, {'SMSMessageData': {
        'Message': 'Sent to 0/1 Total Cost: 0', 'Recipients': []}})
    with pytest.raises(mp.SendFailed, match='accepted nothing'):
        mp.send('africastalking', AT_CONFIG, '+254700000000', 'hi')


def test_http_error_carries_the_body(monkeypatch):
    _respond(monkeypatch, 401, None, 'Unauthorized: invalid apiKey')
    with pytest.raises(mp.SendFailed, match='invalid apiKey'):
        mp.send('africastalking', AT_CONFIG, '+254700000000', 'hi')


def test_missing_required_field_is_refused_before_the_network(monkeypatch):
    _respond(monkeypatch, 200, {})
    with pytest.raises(mp.ProviderNotConfigured, match='api_key'):
        mp.send('africastalking', {'username': 'u'}, '+254700000000', 'hi')


def test_twilio_rejection_is_read_from_its_own_field(monkeypatch):
    _respond(monkeypatch, 201, {'status': 'failed', 'error_message': 'Unverified number'})
    with pytest.raises(mp.SendFailed, match='Unverified number'):
        mp.send('twilio', {'account_sid': 'AC1', 'auth_token': 't', 'from': '+1415'},
                '+254700000000', 'hi')


def test_infobip_rejection_is_read_from_its_own_field(monkeypatch):
    _respond(monkeypatch, 200, {'messages': [
        {'status': {'groupName': 'REJECTED', 'description': 'Invalid sender'}}]})
    with pytest.raises(mp.SendFailed, match='Invalid sender'):
        mp.send('infobip', {'api_key': 'k', 'base_url': 'https://x.test'},
                '+254700000000', 'hi')


def test_custom_gateway_rejects_unparseable_body(monkeypatch):
    _respond(monkeypatch, 200, {})
    with pytest.raises(mp.ProviderNotConfigured, match='not valid JSON'):
        mp.send('custom_sms', {'endpoint': 'https://v.test', 'body_template': '{oops'},
                '+254700000000', 'hi')


def test_every_registry_entry_has_the_parts_the_engine_needs():
    for pid, spec in mp.PROVIDERS.items():
        assert spec['channel'] in (mp.SMS, mp.WHATSAPP), pid
        assert callable(spec['read']), pid
        assert spec.get('payload') or spec.get('payload_template'), pid
        names = [f['name'] for f in spec['fields']]
        assert len(names) == len(set(names)), f'{pid} has duplicate field names'
        assert mp.public_spec(pid)['name'] == spec['name'], pid


# --- the best-effort contract ---------------------------------------------

def test_normal_callers_never_see_an_exception(rows, monkeypatch):
    isp = make_isp(sms_provider='africastalking')
    rows[(1, 'africastalking')] = AT_CONFIG
    _respond(monkeypatch, 401, None, 'nope')
    assert nd.send_sms('+254700000000', 'hi', isp=isp) is False


def test_the_test_button_does_see_one(rows, monkeypatch):
    isp = make_isp(sms_provider='africastalking')
    rows[(1, 'africastalking')] = AT_CONFIG
    _respond(monkeypatch, 401, None, 'nope')
    with pytest.raises(mp.SendFailed):
        nd.send_sms('+254700000000', 'hi', isp=isp, raise_errors=True)


def test_unconfigured_sms_logs_for_callers_and_raises_for_the_button(rows):
    assert nd.send_sms('+254700000000', 'hi', isp=ISP) is True   # log fallback
    with pytest.raises(nd.SmsNotConfigured):
        nd.send_sms('+254700000000', 'hi', isp=ISP, raise_errors=True)
