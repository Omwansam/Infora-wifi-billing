"""Pure logic behind emailed password resets.

The database-backed flow (issue → email → consume, single use, expiry, the
no-enumeration response) is exercised against a real Postgres separately. What
is pinned here is the part that is silent when it breaks: the digest, and the
link the email carries.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import hashlib
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import password_reset as pr  # noqa: E402


# --- token digest ----------------------------------------------------------

def test_digest_is_sha256_of_the_token():
    assert pr._digest('abc') == hashlib.sha256(b'abc').hexdigest()


def test_digest_is_stable_and_64_hex_chars():
    once, twice = pr._digest('a-token'), pr._digest('a-token')
    assert once == twice and len(once) == 64
    assert all(c in '0123456789abcdef' for c in once)


def test_different_tokens_give_different_digests():
    assert pr._digest('token-a') != pr._digest('token-b')


def test_empty_token_does_not_explode():
    """lookup() digests whatever it is handed before touching the database."""
    assert len(pr._digest(None)) == 64
    assert len(pr._digest('')) == 64


# --- where the link points -------------------------------------------------

def test_base_url_prefers_app_base_url(monkeypatch):
    monkeypatch.setenv('APP_BASE_URL', 'https://console.example.com/')
    monkeypatch.setenv('PUBLIC_BASE_URL', 'https://api.example.com')
    assert pr.console_base_url() == 'https://console.example.com'


def test_base_url_falls_back_through_the_existing_variables(monkeypatch):
    monkeypatch.delenv('APP_BASE_URL', raising=False)
    monkeypatch.setenv('PUBLIC_BASE_URL', 'https://billing.example.com')
    assert pr.console_base_url() == 'https://billing.example.com'


def test_base_url_has_a_local_default(monkeypatch):
    for var in ('APP_BASE_URL', 'PUBLIC_BASE_URL', 'PROVISION_BASE_URL'):
        monkeypatch.delenv(var, raising=False)
    assert pr.console_base_url().startswith('http://localhost')


def test_a_blank_variable_is_skipped_not_used(monkeypatch):
    """An env var set to empty must not produce a link pointing at nothing."""
    monkeypatch.setenv('APP_BASE_URL', '   ')
    monkeypatch.setenv('PUBLIC_BASE_URL', 'https://billing.example.com')
    assert pr.console_base_url() == 'https://billing.example.com'


# --- the response the form gets --------------------------------------------

def test_the_generic_response_never_confirms_an_account():
    text = pr.GENERIC_RESPONSE.lower()
    assert 'if that address belongs to an account' in text
    # Anything that only makes sense for a real account would be the tell.
    for leak in ('we have sent', 'your account', 'no account', 'not found'):
        assert leak not in text


def test_requesting_for_a_blank_address_is_a_no_op():
    sent, detail = pr.request_reset('')
    assert sent is False and detail == 'no address supplied'
