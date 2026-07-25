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


def _cookie_name(device_id):
    return f'infora_webfig_{device_id}'


_HOST_PREFIX = 'webfig-'


def webfig_host_for(device_id, request_host):
    """Hostname (with port) that proxies this device's WebFig at its root.

    ``WEBFIG_PROXY_DOMAIN`` wins when set — production needs a name the wildcard
    TLS certificate actually covers, which a sub-sub-domain of the app host
    usually is not. Otherwise derive from whatever host the operator is already
    on, which gives ``webfig-37.localhost:5000`` in development for free.
    """
    configured = (os.getenv('WEBFIG_PROXY_DOMAIN') or '').strip().strip('/')
    if configured:
        return f'{_HOST_PREFIX}{device_id}.{configured}'

    host = (request_host or 'localhost').split('@')[-1]
    name, _, port = host.partition(':')
    # A label cannot be prefixed onto an IP literal — webfig-37.127.0.0.1 does
    # not resolve. Browsers do resolve any *.localhost to loopback, so that is
    # the right dev fallback when the operator is on a bare IP.
    if not name or name.replace('.', '').isdigit() or ':' in name:
        name = 'localhost'
    suffix = f':{port}' if port else ''
    return f'{_HOST_PREFIX}{device_id}.{name}{suffix}'


def device_id_from_host(host):
    """Device id when ``host`` is one of our WebFig hostnames, else None."""
    name = (host or '').split(':')[0]
    label = name.split('.')[0]
    if not label.startswith(_HOST_PREFIX):
        return None
    raw = label[len(_HOST_PREFIX):]
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
    scheme = 'https' if request.is_secure else 'http'
    host = webfig_host_for(device_id, request.host)
    return jsonify({'url': f'{scheme}://{host}/?t={token}', 'host': host}), 200


def _valid_token(device_id):
    """True when the request carries a valid ?t= token or session cookie."""
    raw = request.args.get('t') or request.cookies.get(_cookie_name(device_id))
    if not raw:
        return False
    try:
        data = _serializer().loads(raw, max_age=_COOKIE_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return False
    return data.get('d') == device_id


def serve_webfig_host(device_id):
    """Proxy this request to the device's WebFig. Serves the whole origin root.

    Called from an app-level ``before_request`` hook whenever the Host header is
    one of our per-device WebFig names, so it sees every path — ``/``,
    ``/assets/...``, ``/webfig/``, and whatever the bundled JS calls at runtime.
    Nothing is rewritten: the origin root *is* the router, so its own absolute
    paths already point back here.
    """
    if not _valid_token(device_id):
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
            _cookie_name(device_id),
            request.args['t'],
            max_age=_COOKIE_MAX_AGE,
            httponly=True,
            samesite='Lax',
            secure=request.is_secure,
            path='/',
        )
    return resp


def webfig_host_dispatch():
    """Flask ``before_request`` hook: serve WebFig when the Host is ours.

    Returning None lets normal routing continue, so the hook is inert for every
    ordinary request to the app.
    """
    device_id = device_id_from_host(request.host)
    if device_id is None:
        return None
    return serve_webfig_host(device_id)


@webfig_bp.route('/<int:device_id>/webfig/', defaults={'subpath': ''},
                 methods=['GET'])
@webfig_bp.route('/<int:device_id>/webfig/<path:subpath>', methods=['GET'])
def webfig_legacy_redirect(device_id, subpath):
    """Old subpath entry point — bounce to the per-device host.

    Kept so existing links/bookmarks still land somewhere useful rather than
    rendering a broken WebFig.
    """
    token = request.args.get('t', '')
    scheme = 'https' if request.is_secure else 'http'
    host = webfig_host_for(device_id, request.host)
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
