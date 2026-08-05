"""Tests for the self-serve onboarding primitives.

These cover the rules that decide whether a stranger gets an account, and the
ones that are easy to regress silently: a slug that shadows the WebFig host
dispatch, an OTP that survives past its expiry, a resend that ignores its
cooldown. All pure functions — no database, no network, no Flask app.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import email_validation, phone_utils, tenant_slug, whatsapp_otp  # noqa: E402
from services.tenant_provisioning import TASKS, initial_tasks  # noqa: E402


# --- slugs: the account address --------------------------------------------

@pytest.mark.parametrize('name,expected', [
    ('Infora', 'infora'),
    ('Acme Networks Ltd.', 'acmenetworksltd'),
    ('Café  Net & Co.', 'cafenetco'),
    ('Fast-Link', 'fastlink'),          # punctuation stripped, not hyphenated
    ('  Spaced  Out  ', 'spacedout'),
    ('123 Net', '123net'),
    ('', ''),
    (None, ''),
])
def test_slugify_strips_spaces_and_punctuation(name, expected):
    assert tenant_slug.slugify_isp_name(name) == expected


def test_slugify_truncates_to_max_length():
    assert len(tenant_slug.slugify_isp_name('x' * 200)) == tenant_slug.MAX_LENGTH


@pytest.mark.parametrize('slug', [
    'www', 'api', 'admin', 'portal', 'radius', 'acs', 'billing', 'support',
    'login', 'signup', 'status', 'demo',
])
def test_platform_names_are_reserved(slug):
    with pytest.raises(tenant_slug.InvalidSlug):
        tenant_slug.validate_slug(slug)


@pytest.mark.parametrize('slug', ['webfig', 'webfig-3', 'webfig-999', 'webfigtest'])
def test_webfig_prefix_is_reserved(slug):
    """app.py routes webfig-<id>.* straight into a router's WebFig before any
    other dispatch — a tenant holding that prefix would shadow a real device."""
    assert tenant_slug.is_reserved(slug)
    with pytest.raises(tenant_slug.InvalidSlug):
        tenant_slug.validate_slug(slug)


@pytest.mark.parametrize('slug,reason', [
    ('ab', 'too short'),
    ('x' * 41, 'too long'),
    ('-acme', 'leading hyphen'),
    ('acme-', 'trailing hyphen'),
    ('my--net', 'double hyphen'),
    ('12345', 'digits only'),
    ('acme net', 'space'),
    ('acme_net', 'underscore'),
    ('Acme!', 'punctuation'),
    ('', 'empty'),
])
def test_malformed_slugs_are_refused(slug, reason):
    with pytest.raises(tenant_slug.InvalidSlug):
        tenant_slug.validate_slug(slug)


@pytest.mark.parametrize('slug', ['acme', 'acme-net', 'isp1', 'a1b', 'x' * 40])
def test_valid_slugs_pass(slug):
    assert tenant_slug.validate_slug(slug) == slug


def test_validate_slug_normalises_case_and_whitespace():
    assert tenant_slug.validate_slug('  AcMe  ') == 'acme'


def test_account_address_uses_configured_base_domain(monkeypatch):
    monkeypatch.setenv('TENANT_BASE_DOMAIN', 'example.com')
    assert tenant_slug.account_address('acme') == 'acme.example.com'


def test_base_domain_falls_back_to_the_brand_website(monkeypatch):
    """No TENANT_BASE_DOMAIN must still yield a branded address, not a blank one."""
    monkeypatch.delenv('TENANT_BASE_DOMAIN', raising=False)
    from services.brand_constants import BRAND_WEBSITE

    base = tenant_slug.base_domain()
    assert base and '://' not in base and not base.startswith('www.')
    assert base in BRAND_WEBSITE
    assert tenant_slug.account_address('acme') == f'acme.{base}'


def test_account_address_with_no_slug_is_the_bare_domain(monkeypatch):
    monkeypatch.setenv('TENANT_BASE_DOMAIN', 'example.com')
    assert tenant_slug.account_address('') == 'example.com'


# --- phone normalisation ---------------------------------------------------

@pytest.mark.parametrize('raw,country,expected', [
    ('0114080686', 'KE', '+254114080686'),      # national trunk prefix dropped
    ('114080686', 'KE', '+254114080686'),
    ('+254114080686', 'KE', '+254114080686'),   # already E.164
    ('254114080686', 'KE', '+254114080686'),    # country code, no plus
    ('0114 080 686', 'KE', '+254114080686'),    # spaces
    ('0114-080-686', 'KE', '+254114080686'),    # punctuation
    ('07123 45678', 'GB', '+44712345678'),
    ('0700123456', 'UG', '+256700123456'),
])
def test_normalize_phone_accepts_what_people_type(raw, country, expected):
    assert phone_utils.normalize_phone(raw, country) == expected


@pytest.mark.parametrize('raw', ['', None, '   ', 'abc', '0', '00', '123', '+1'])
def test_normalize_phone_refuses_malformed(raw):
    with pytest.raises(phone_utils.InvalidPhone):
        phone_utils.normalize_phone(raw, 'KE')


@pytest.mark.parametrize('raw,expect_blank_copy', [
    ('', True), (None, True), ('   ', True),
    ('abc', False), ('--', False),
])
def test_blank_and_junk_get_different_messages(raw, expect_blank_copy):
    """Telling someone who typed `abc` to "enter your number" reads as though
    the field never received it."""
    with pytest.raises(phone_utils.InvalidPhone) as excinfo:
        phone_utils.normalize_phone(raw, 'KE')
    is_blank_copy = 'Enter your WhatsApp number' == str(excinfo.value)
    assert is_blank_copy is expect_blank_copy


def test_normalize_phone_refuses_overlong_number():
    with pytest.raises(phone_utils.InvalidPhone):
        phone_utils.normalize_phone('9' * 20, 'KE')


def test_mask_phone_hides_the_middle():
    assert phone_utils.mask_phone('+254114080686') == '+254 ***** 0686'


def test_every_country_has_a_usable_default():
    for entry in phone_utils.country_choices():
        assert entry['dial_code'].startswith('+')
        assert '/' in entry['timezone'] or entry['timezone'] == 'UTC'
        assert 3 <= len(entry['currency']) <= 4
        assert len(entry['code']) == 2


def test_country_defaults_falls_back_for_unknown_code():
    assert phone_utils.country_defaults('ZZ') == phone_utils.country_defaults(
        phone_utils.DEFAULT_COUNTRY
    )


# --- email -----------------------------------------------------------------

@pytest.mark.parametrize('email', [
    'user@example.com', 'first.last+tag@sub.example.co.ke', 'a@b.io',
])
def test_valid_emails_pass(email):
    assert email_validation.validate_signup_email(email) == email.lower()


def test_email_is_normalised():
    assert email_validation.validate_signup_email('  Foo@EXAMPLE.com ') == 'foo@example.com'


@pytest.mark.parametrize('email', [
    '', None, 'no-at-sign', 'no@tld', '@example.com', 'user@', 'a b@example.com',
    'user@@example.com',
])
def test_malformed_emails_are_refused(email):
    with pytest.raises(email_validation.InvalidEmail):
        email_validation.validate_signup_email(email)


@pytest.mark.parametrize('email', [
    'x@mailinator.com', 'x@guerrillamail.com', 'x@yopmail.com',
    'x@10minutemail.com', 'x@temp-mail.org',
])
def test_disposable_inboxes_are_refused(email):
    """The signup email is the only recovery channel that survives losing the
    phone — a throwaway inbox produces an unrecoverable account."""
    with pytest.raises(email_validation.InvalidEmail):
        email_validation.validate_signup_email(email)


def test_disposable_subdomains_are_refused():
    assert email_validation.is_disposable('x@inbox.mailinator.com')


def test_lookalike_domain_is_not_blocked():
    """The blocklist must not false-positive on a real customer domain."""
    assert not email_validation.is_disposable('ops@mailinator-isp.co.ke')
    assert email_validation.validate_signup_email('ops@mailinator-isp.co.ke')


# --- OTP -------------------------------------------------------------------

def test_generated_code_is_six_digits():
    for _ in range(50):
        code = whatsapp_otp.generate_code()
        assert len(code) == whatsapp_otp.CODE_LENGTH
        assert code.isdigit()


def test_code_hash_round_trip():
    code = whatsapp_otp.generate_code()
    hashed = whatsapp_otp.hash_code(code)
    assert hashed != code, 'the plain code must never be what is stored'
    assert whatsapp_otp.verify_code_hash(hashed, code)
    assert not whatsapp_otp.verify_code_hash(hashed, '000000')
    assert not whatsapp_otp.verify_code_hash(hashed, '')
    assert not whatsapp_otp.verify_code_hash(None, code)


def test_code_verification_tolerates_surrounding_whitespace():
    hashed = whatsapp_otp.hash_code('123456')
    assert whatsapp_otp.verify_code_hash(hashed, ' 123456 ')


def test_expiry_window_matches_the_ten_minute_countdown():
    now = datetime(2026, 1, 1, 12, 0, 0)
    expires = whatsapp_otp.expiry_from(now)
    assert (expires - now).total_seconds() == whatsapp_otp.OTP_TTL_SECONDS
    assert not whatsapp_otp.is_expired(expires, now=now)
    assert whatsapp_otp.is_expired(expires, now=expires + timedelta(seconds=1))


def test_missing_expiry_counts_as_expired():
    """A spent code has its expiry cleared — it must not read as still valid."""
    assert whatsapp_otp.is_expired(None)


def test_resend_cooldown():
    now = datetime(2026, 1, 1, 12, 0, 0)
    assert whatsapp_otp.resend_cooldown_remaining(now, now=now) == \
        whatsapp_otp.RESEND_COOLDOWN_SECONDS
    mid = now + timedelta(seconds=whatsapp_otp.RESEND_COOLDOWN_SECONDS - 8)
    assert whatsapp_otp.resend_cooldown_remaining(now, now=mid) == 8
    after = now + timedelta(seconds=whatsapp_otp.RESEND_COOLDOWN_SECONDS + 5)
    assert whatsapp_otp.resend_cooldown_remaining(now, now=after) == 0
    assert whatsapp_otp.resend_cooldown_remaining(None) == 0


def test_seconds_until_never_goes_negative():
    past = datetime(2020, 1, 1)
    assert whatsapp_otp.seconds_until(past) == 0


# --- delivery gating -------------------------------------------------------

def test_log_provider_does_not_send(monkeypatch):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'log')
    monkeypatch.setenv('WHATSAPP_ENABLED', 'true')
    assert not whatsapp_otp.is_live()
    assert whatsapp_otp.send_whatsapp('+254700000000', 'hello') is True


def test_provider_stays_inert_until_explicitly_enabled(monkeypatch):
    """Setting a provider is not enough — WHATSAPP_ENABLED is the live switch."""
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'meta')
    monkeypatch.setenv('WHATSAPP_ENABLED', 'false')
    assert not whatsapp_otp.is_live()


def test_live_meta_without_credentials_raises(monkeypatch):
    monkeypatch.setenv('WHATSAPP_PROVIDER', 'meta')
    monkeypatch.setenv('WHATSAPP_ENABLED', 'true')
    monkeypatch.delenv('WHATSAPP_META_TOKEN', raising=False)
    monkeypatch.delenv('WHATSAPP_META_PHONE_NUMBER_ID', raising=False)
    with pytest.raises(whatsapp_otp.WhatsAppError):
        whatsapp_otp.send_whatsapp('+254700000000', 'hello')


def test_send_refuses_empty_number():
    with pytest.raises(whatsapp_otp.WhatsAppError):
        whatsapp_otp.send_whatsapp('', 'hello')


@pytest.mark.parametrize('provider,flask_env,expected', [
    ('log', 'development', True),      # the only combination that may echo
    ('log', 'production', False),
    ('meta', 'development', False),
    ('meta', 'production', False),
])
def test_code_echo_requires_stub_provider_and_dev_mode(
    monkeypatch, provider, flask_env, expected
):
    """The dev affordance that returns the OTP in the response body must be
    impossible to trip in production by flipping a single variable."""
    monkeypatch.setenv('WHATSAPP_PROVIDER', provider)
    monkeypatch.setenv('FLASK_ENV', flask_env)
    assert whatsapp_otp.can_echo_code() is expected


def test_otp_message_contains_the_code_and_expiry():
    message = whatsapp_otp.otp_message('123456', 'Lumen')
    assert '123456' in message
    assert 'Lumen' in message
    assert str(whatsapp_otp.OTP_TTL_SECONDS // 60) in message


# --- provisioning task list ------------------------------------------------

def test_initial_tasks_match_the_declared_steps():
    tasks = initial_tasks()
    assert [t['key'] for t in tasks] == [key for key, _ in TASKS]
    assert all(t['status'] == 'pending' for t in tasks)


def test_task_labels_are_present():
    assert all(t['label'] for t in initial_tasks())
