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


# --- The body actually has to arrive ---------------------------------------
#
# The helpers above are pure, so they cannot see a proxy that builds a perfect
# URL and then relays an empty body. That is exactly what happened once the
# response started streaming: `requests.request()` closes its session on return,
# tearing down the connection pool before the generator reads, so the router's
# Content-Length went out with no bytes behind it and every client reported a
# truncated response. These drive the real thing against a stub router.

@pytest.fixture
def router():
    """A stub RouterOS that records request lines and answers like the real one."""
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    seen = []

    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def do_GET(self):
            seen.append(self.requestline)
            if self.path.startswith('/graphs'):
                # RouterOS really does send a body with its 303.
                body = b'<!doctype html>\n<title>Error 303 : See Other</title>\n'
                self.send_response(303)
                self.send_header('Location', '/graphs/')
            else:
                body = b'ROUTER-BODY-BYTES'
                self.send_response(200)
                self.send_header('Set-Cookie', 'a=1; Domain=10.250.0.3; Path=/')
                self.send_header('Set-Cookie', 'b=2; Path=/')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        do_POST = do_GET

        def log_message(self, *args):
            pass

    server = HTTPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield server.server_address[1], seen
    server.shutdown()


@pytest.fixture
def proxy(router, monkeypatch):
    """`serve_webfig_host` wired to the stub router, with no database."""
    from flask import Flask

    import routes.webfig_proxy as wp

    port, seen = router
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'test-secret'

    class Device:
        management_wg_enabled = True
        management_wg_ip = '10.250.0.3'

    monkeypatch.setattr(wp, 'connection_host', lambda device: f'127.0.0.1:{port}')
    monkeypatch.setattr(
        wp, 'MikrotikDevice',
        type('M', (), {'query': type('Q', (), {'get': staticmethod(lambda _: Device())})}),
    )
    with app.test_request_context('/'):
        token = wp._serializer().dumps({'d': 6, 'u': 1})
    return app, wp, token, seen


def _fetch(proxy, path, query=b''):
    app, wp, token, seen = proxy
    raw = path + ('?' + query.decode('latin-1') if query else '')
    with app.test_request_context(
        raw,
        environ_overrides={'RAW_URI': raw, 'HTTP_COOKIE': f'infora_webfig={token}'},
    ):
        response = wp.serve_webfig_host()
        return response, b''.join(response.response)


def test_body_survives_the_streamed_relay(proxy):
    """The regression guard for the empty-body relay."""
    response, body = _fetch(proxy, '/webfig/')

    assert response.status_code == 200
    assert body == b'ROUTER-BODY-BYTES'
    assert int(response.headers['Content-Length']) == len(body)


def test_redirect_body_is_relayed_too(proxy):
    """RouterOS sends a body with its 303, and Content-Length must match it."""
    response, body = _fetch(proxy, '/graphs')

    assert response.status_code == 303
    assert response.headers['Location'] == '/graphs/'
    assert len(body) == int(response.headers['Content-Length'])


@pytest.mark.parametrize('query', JSPROXY_QUERIES)
def test_jsproxy_query_reaches_the_stub_router_verbatim(proxy, query):
    """The whole point, end to end: what the router receives is what WebFig sent."""
    _, _, _, seen = proxy
    _fetch(proxy, '/jsproxy/', query)

    assert seen[-1] == f'GET /jsproxy/?{query.decode("latin-1")} HTTP/1.1'


def test_repeated_set_cookie_is_not_collapsed(proxy):
    """Two cookies must stay two headers, and the router's Domain must go."""
    response, _ = _fetch(proxy, '/webfig/')
    cookies = [c for c in response.headers.getlist('Set-Cookie') if 'infora_webfig' not in c]

    assert sorted(cookies) == ['a=1; Path=/', 'b=2; Path=/']
