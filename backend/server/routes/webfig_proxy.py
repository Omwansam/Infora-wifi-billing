"""WebFig reverse proxy + operator WireGuard client config.

Two ways for an operator to reach a provisioned router's web/winbox management,
both riding the management WireGuard tunnel (10.250.0.0/24):

  * ``POST /api/devices/<id>/webfig/session`` mints a short-lived signed token and
    returns a URL on a **per-device hostname** — ``webfig-<id>.<base>``. Opening
    it proxies the whole origin, from ``/`` down, to ``http://<router-vpn-ip>:80``
    through the Flask container (which routes into the tunnel). One click, no VPN
    on the operator's machine.
  * ``GET /api/devices/webfig/vpn-client-config`` returns a WireGuard .conf that
    adds the operator's laptop to the tunnel, after which ``http://<router-vpn-ip>``
    (WebFig) and ``<router-vpn-ip>:8291`` (Winbox) work directly.

**Why a hostname and not a subpath.** RouterOS 7's WebFig cannot be served under
a prefix. Its own HTML is root-absolute::

    <link href="/assets/style-2d2fe181ac93.css" rel="stylesheet">
    <script>if (location.pathname.endsWith("/webfig")) location.href = "/webfig/";</script>

That inline redirect is hardcoded to the origin root, so under ``/api/devices/37/
webfig/`` the browser is thrown straight out of the proxy — and no amount of HTML
rewriting reaches URLs the bundled JS builds at runtime. Proxying the *root of a
dedicated origin* makes every one of those absolute paths land back on us.

Dev needs no DNS: browsers resolve any ``*.localhost`` name to loopback, so
``http://webfig-37.localhost:5000`` works out of the box. In production point a
wildcard record at the server and set ``WEBFIG_PROXY_DOMAIN``; see
``config/deployment/`` for the nginx vhost.

Auth: the JSON endpoints require a JWT; the proxied stream authenticates via the
signed cookie the first request sets (a browser <img>/<script> request can't
carry an Authorization header). The cookie is host-scoped, so it is naturally
confined to one device.
"""
import os

import requests
from flask import Blueprint, request, jsonify, current_app, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from auth_utils import get_current_user
from models import MikrotikDevice
from services.device_config_ops import connection_host

webfig_bp = Blueprint('webfig', __name__, url_prefix='/api/devices')

_COOKIE_MAX_AGE = 3600           # 1h session
_TOKEN_SALT = 'infora-webfig'
# Hop-by-hop headers we must not forward in either direction.
_HOP_BY_HOP = {
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailers', 'transfer-encoding', 'upgrade', 'content-encoding',
    'content-length',
}


def _serializer():
    secret = current_app.config.get('SECRET_KEY') or current_app.config.get('JWT_SECRET_KEY') or 'infora'
    return URLSafeTimedSerializer(secret, salt=_TOKEN_SALT)


# One cookie name: the hostname already scopes the session, and a single
# WebFig host means a single jar. Holds the same signed token, which carries the
# device id, so the cookie alone identifies the target router.
_COOKIE = 'infora_webfig'

_HOST_LABEL = 'webfig'


def webfig_host_for(request_host):
    """Hostname (with port) whose root proxies WebFig.

    Deliberately ONE name for every router rather than webfig-<id>.*: Cloudflare
    only proxies wildcard records on Enterprise plans, and the record must be
    proxied because the origin presents a Cloudflare Origin CA certificate that
    browsers do not trust. Per-device names would therefore mean adding a DNS
    record for every router ever onboarded. The device comes from the signed
    token instead, so one record covers all of them forever.

    ``WEBFIG_PROXY_DOMAIN`` wins when set — production needs a name the TLS
    certificate actually covers, which a sub-sub-domain of the app host is not.
    Otherwise derive from the operator's current host, giving
    ``webfig.localhost:5000`` in development for free.
    """
    configured = (os.getenv('WEBFIG_PROXY_DOMAIN') or '').strip().strip('/')
    if configured:
        return f'{_HOST_LABEL}.{configured}'

    host = (request_host or 'localhost').split('@')[-1]
    name, _, port = host.partition(':')
    # A label cannot be prefixed onto an IP literal — webfig.127.0.0.1 does not
    # resolve. Browsers resolve any *.localhost to loopback, so that is the right
    # dev fallback when the operator is on a bare IP.
    if not name or name.replace('.', '').isdigit() or ':' in name:
        name = 'localhost'
    suffix = f':{port}' if port else ''
    return f'{_HOST_LABEL}.{name}{suffix}'


def is_webfig_host(host):
    """True when this request arrived on the WebFig proxy hostname.

    Accepts the per-device form (``webfig-37.…``) too, so an operator who does
    want DNS-level isolation between routers can add those records and it keeps
    working.
    """
    label = (host or '').split(':')[0].split('.')[0]
    return label == _HOST_LABEL or label.startswith(_HOST_LABEL + '-')


def device_id_from_host(host):
    """Device id pinned by the hostname, or None when the token decides."""
    label = (host or '').split(':')[0].split('.')[0]
    if not label.startswith(_HOST_LABEL + '-'):
        return None
    raw = label[len(_HOST_LABEL) + 1:]
    return int(raw) if raw.isdigit() else None


def _authz_device(device_id):
    """Return (device, error_response). Enforces JWT-user ISP scoping."""
    device = MikrotikDevice.query.get_or_404(device_id)
    user = get_current_user()
    if user is None:
        return None, (jsonify({'error': 'Unauthorized'}), 401)
    if user.role != 'admin' and device.isp_id != user.isp_id:
        return None, (jsonify({'error': 'Access denied'}), 403)
    return device, None


def _client_is_secure():
    """True when the ORIGINAL browser request was HTTPS.

    ``request.is_secure`` describes the proxy->app hop, not the browser->edge
    one. TLS terminates at the edge proxy here, so it is always False and the
    one-click URL was minted as ``http://`` — putting the signed session token
    in a plaintext URL — while the session cookie was set without ``Secure``.
    The edge sets X-Forwarded-Proto (see config/nginx/snippets/
    billing-locations.conf); trust it, and fall back to the direct check when
    the header is absent, as in local development.
    """
    proto = (request.headers.get('X-Forwarded-Proto') or '').split(',')[0].strip().lower()
    if proto:
        return proto == 'https'
    return request.is_secure


@webfig_bp.route('/<int:device_id>/webfig/session', methods=['POST'])
@jwt_required()
def webfig_session(device_id):
    """Mint a signed token and hand back the one-click proxy URL to open."""
    device, denied = _authz_device(device_id)
    if denied:
        return denied
    if not (device.management_wg_enabled and device.management_wg_ip):
        return jsonify({'error': 'Device has no management WireGuard tunnel'}), 400

    token = _serializer().dumps({'d': device_id, 'u': get_jwt_identity()})
    scheme = 'https' if _client_is_secure() else 'http'
    host = webfig_host_for(request.host)
    return jsonify({'url': f'{scheme}://{host}/?t={token}', 'host': host}), 200


def _token_device_id():
    """Device id carried by a valid ?t= token or session cookie, else None.

    The token is the only authority on which router this session may reach, so a
    hostname that pins a device still has to agree with it.
    """
    raw = request.args.get('t') or request.cookies.get(_COOKIE)
    if not raw:
        return None
    try:
        data = _serializer().loads(raw, max_age=_COOKIE_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    value = data.get('d')
    return value if isinstance(value, int) else None


def serve_webfig_host(pinned_device_id=None):
    """Proxy this request to a device's WebFig. Serves the whole origin root.

    Called from an app-level ``before_request`` hook whenever the Host header is
    the WebFig proxy name, so it sees every path — ``/``, ``/assets/...``,
    ``/webfig/``, and whatever the bundled JS calls at runtime. Nothing is
    rewritten: the origin root *is* the router, so its own absolute paths already
    point back here.

    ``pinned_device_id`` comes from a per-device hostname when one is used; the
    signed token still has to name the same router.
    """
    device_id = _token_device_id()
    if device_id is None or (pinned_device_id is not None and device_id != pinned_device_id):
        return Response(
            'WebFig session expired — reopen it from the device page.',
            status=401, mimetype='text/plain',
        )

    device = MikrotikDevice.query.get(device_id)
    if device is None:
        return Response('Unknown device.', status=404, mimetype='text/plain')
    if not (device.management_wg_enabled and device.management_wg_ip):
        return Response('Device has no management WireGuard tunnel.',
                        status=400, mimetype='text/plain')

    host = connection_host(device)
    # Drop our own bootstrap token so it never reaches the router.
    args = {k: v for k, v in request.args.items() if k != 't'}
    target = f'http://{host}{request.path}'

    fwd_headers = {
        k: v for k, v in request.headers
        if k.lower() not in _HOP_BY_HOP and k.lower() not in ('host', 'cookie')
    }
    # Forward only the router's own cookies (its session), never ours.
    router_cookies = {
        k: v for k, v in request.cookies.items() if not k.startswith('infora_webfig')
    }

    try:
        upstream = requests.request(
            method=request.method,
            url=target,
            params=args,
            data=request.get_data(),
            headers=fwd_headers,
            cookies=router_cookies,
            allow_redirects=False,
            timeout=(5, 30),
        )
    except requests.RequestException as exc:
        return Response(
            f'Could not reach the router over the tunnel ({exc}).\n'
            'Confirm the device is Online, then reopen WebFig.',
            status=502, mimetype='text/plain',
        )

    resp = Response(upstream.content, status=upstream.status_code)
    for key, value in upstream.headers.items():
        if key.lower() in _HOP_BY_HOP:
            continue
        resp.headers[key] = value

    if request.args.get('t'):
        # Host-scoped, so it only ever unlocks this one device.
        resp.set_cookie(
            _COOKIE,
            request.args['t'],
            max_age=_COOKIE_MAX_AGE,
            httponly=True,
            samesite='Lax',
            secure=_client_is_secure(),
            path='/',
        )
    return resp


def webfig_host_dispatch():
    """Flask ``before_request`` hook: serve WebFig when the Host is ours.

    Returning None lets normal routing continue, so the hook is inert for every
    ordinary request to the app.
    """
    if not is_webfig_host(request.host):
        return None
    return serve_webfig_host(device_id_from_host(request.host))


@webfig_bp.route('/<int:device_id>/webfig/', defaults={'subpath': ''},
                 methods=['GET'])
@webfig_bp.route('/<int:device_id>/webfig/<path:subpath>', methods=['GET'])
def webfig_legacy_redirect(device_id, subpath):
    """Old subpath entry point — bounce to the per-device host.

    Kept so existing links/bookmarks still land somewhere useful rather than
    rendering a broken WebFig.
    """
    token = request.args.get('t', '')
    scheme = 'https' if _client_is_secure() else 'http'
    host = webfig_host_for(request.host)
    suffix = f'/?t={token}' if token else '/'
    return Response(
        status=302,
        headers={'Location': f'{scheme}://{host}{suffix}'},
    )


@webfig_bp.route('/webfig/vpn-client-config', methods=['GET'])
@jwt_required()
def webfig_vpn_client_config():
    """Download a WireGuard client .conf that puts this operator on the tunnel."""
    user = get_current_user()
    if user is None:
        return jsonify({'error': 'Unauthorized'}), 401
    from services.wireguard_management import provision_operator_peer, build_operator_client_config

    owner = f'user-{user.id}'
    name = getattr(user, 'username', None) or getattr(user, 'email', None) or owner
    try:
        peer, private_key = provision_operator_peer(owner, name=name)
        config = build_operator_client_config(peer, private_key)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    filename = 'infora-mgmt-vpn.conf'
    return Response(
        config,
        mimetype='text/plain',
        headers={'Content-Disposition': f'attachment; filename={filename}'},
    )
