"""The WebFig proxy, against the request that broke it.

WebFig's transport is ``/jsproxy``, and it carries its session key as raw bytes in
the query string. The proxy used to rebuild that query from ``request.args`` and
hand it back to requests as ``params=``, which appended one ``=`` byte:

    browser: /jsproxy/?%00%00%00%05%00%00%01%C2%BE...%C2%85%00
    we sent: /jsproxy/?%00%00%00%05%00%00%01%C2%BE...%C2%85%00=

RouterOS answered 404 to every jsproxy GET, then 500 to the POSTs that referenced
the session it had already discarded, and WebFig hung on "connecting".

The fixtures are the real URLs off the failing browser console.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

import pytest
import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from routes.webfig_proxy import (  # noqa: E402
    _upstream_url,
    bootstrap_token,
    strip_bootstrap_token,
)

ROUTER = '10.250.0.3'

# Straight off the console log. Between them these cover the bytes that defeat a
# query parser: %00 (NUL), %C2%BE (UTF-8 multibyte), %2B ('+'), %26 ('&'), %3D ('=').
JSPROXY_QUERIES = [
    b'%00%00%00%05%00%00%01%C2%BE%C3%81%C3%940%C2%A0%C3%B4%C2%B3%C2%97%C3%BD'
    b'%C3%95O%C3%82%19%C2%AF.pc%C3%92%C2%98H%C2%80%C3%B9%C2%A2%11%0B%C3%95'
    b'%C3%8F%C2%99%1D%C2%96u%C2%B1t%C2%85%00',
    b'%00%00%00%04%00%00%01%C2%BE%C2%88%004%C2%9EQ%C2%A9n%C2%B9Z%13i%C3%AEy%0B'
    b'%C2%B3%C3%9D%C2%A9%12%C3%A4%C3%B0%266%C2%97C%2B%12D%29%C2%9D%7F%1A%C2%85'
    b'%3A%C3%9A',
]

# itsdangerous' URL-safe base64 with dot separators, as `webfig_session` mints it.
TOKEN = 'eyJkIjozNywidSI6MX0.aBcDeF.9xKq-mZ0_Ab1CdEfGhIjKlMnOpQ'


# --- The bug: the session key must arrive byte-for-byte --------------------

@pytest.mark.parametrize('query', JSPROXY_QUERIES)
def test_binary_jsproxy_query_reaches_the_router_unchanged(query):
    """The regression guard. One extra byte here is a dead WebFig session."""
    url = _upstream_url(ROUTER, '/jsproxy/?' + query.decode('latin-1'), query)

    assert url == f'http://{ROUTER}/jsproxy/?' + query.decode('latin-1')
    assert not url.endswith('=')


@pytest.mark.parametrize('query', JSPROXY_QUERIES)
def test_requests_does_not_requote_the_session_key(query):
    """requests prepares the URL too, and must not touch the escapes either.

    It re-quotes only unreserved characters, so every escape above survives — but
    that is a property of requests, not of us, so pin it.
    """
    url = _upstream_url(ROUTER, '/jsproxy/?' + query.decode('latin-1'), query)
    prepared = requests.Request('GET', url).prepare().url

    assert prepared.split('?', 1)[1].encode('latin-1') == query


# --- Our own bootstrap token is ours, and stops here ----------------------

def test_bootstrap_token_is_read_and_stripped():
    query = f't={TOKEN}'.encode()

    assert bootstrap_token(query) == TOKEN
    assert strip_bootstrap_token(query) == b''
    assert _upstream_url(ROUTER, '/', query) == f'http://{ROUTER}/'


def test_bootstrap_token_stripped_from_a_multi_pair_query():
    query = f't={TOKEN}&keep=1'.encode()

    assert strip_bootstrap_token(query) == b'keep=1'
    assert TOKEN not in _upstream_url(ROUTER, '/webfig/', query)


@pytest.mark.parametrize('query', JSPROXY_QUERIES)
def test_binary_query_is_never_mistaken_for_a_token(query):
    """A jsproxy blob must not trip the token regex and lose leading bytes."""
    assert bootstrap_token(query) is None
    assert strip_bootstrap_token(query) == query


# --- Paths are forwarded raw as well --------------------------------------

def test_path_comes_from_the_raw_uri_not_the_decoded_one():
    """Percent-escapes in the path survive; request.path would have decoded them."""
    url = _upstream_url(ROUTER, '/assets/a%20b.css', b'')

    assert url == f'http://{ROUTER}/assets/a%20b.css'


def test_empty_query_adds_no_question_mark():
    assert _upstream_url(ROUTER, '/webfig/', b'') == f'http://{ROUTER}/webfig/'
