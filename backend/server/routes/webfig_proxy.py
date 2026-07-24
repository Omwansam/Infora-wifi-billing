"""WebFig reverse proxy + operator WireGuard client config.

Two ways for an operator to reach a provisioned router's web/winbox management,
both riding the management WireGuard tunnel (10.250.0.0/24):

  * ``POST /api/devices/<id>/webfig/session`` mints a short-lived signed token and
    returns a proxy URL. Opening it puts a scoped cookie in the browser; every
    following request under ``/api/devices/<id>/webfig/...`` is proxied from the
    Flask container (which routes into the tunnel and is masqueraded as the
    billing server) to ``http://<router-vpn-ip>:80``. One click, no VPN on the
    operator's machine. WebFig uses a mix of relative/absolute asset paths, so
    the HTML is rewritten best-effort; if a skin renders oddly, use the client
    config below.
  * ``GET /api/devices/webfig/vpn-client-config`` returns a WireGuard .conf that
    adds the operator's laptop to the tunnel, after which ``http://<router-vpn-ip>``
    (WebFig) and ``<router-vpn-ip>:8291`` (Winbox) work directly.

Auth: the JSON endpoints require a JWT; the raw proxy stream authenticates via
the signed cookie the session endpoint sets (a browser <img>/<script> request
can't carry an Authorization header).
"""
import re

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
    base = request.host_url.rstrip('/')
    url = f'{base}/api/devices/{device_id}/webfig/?t={token}'
    return jsonify({'url': url}), 200


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


def _rewrite_html(body, prefix):
    """Best-effort: make WebFig's asset paths resolve under the proxy prefix."""
    text = body.decode('utf-8', errors='replace')
    # Inject a <base> so relative refs resolve under our prefix.
    if '<head' in text.lower() and '<base' not in text.lower():
        text = re.sub(r'(<head[^>]*>)', r'\1<base href="' + prefix + '/">', text, count=1, flags=re.IGNORECASE)
    # Rewrite root-absolute src/href/action to the prefix (skip //, data:, http).
    text = re.sub(r'((?:src|href|action)\s*=\s*["\'])/(?!/)', r'\1' + prefix + '/', text, flags=re.IGNORECASE)
    return text.encode('utf-8')


@webfig_bp.route('/<int:device_id>/webfig/', defaults={'subpath': ''},
                 methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
@webfig_bp.route('/<int:device_id>/webfig/<path:subpath>',
                 methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'])
def webfig_proxy(device_id, subpath):
    """Stream a request through to the router's WebFig over the tunnel."""
    if not _valid_token(device_id):
        return Response('WebFig session expired — reopen from the dashboard.', status=401)

    device = MikrotikDevice.query.get_or_404(device_id)
    if not (device.management_wg_enabled and device.management_wg_ip):
        return jsonify({'error': 'Device has no management WireGuard tunnel'}), 400

    host = connection_host(device)
    # Drop our own bootstrap token from the forwarded query string.
    args = {k: v for k, v in request.args.items() if k != 't'}
    target = f'http://{host}/{subpath}'

    fwd_headers = {k: v for k, v in request.headers if k.lower() not in _HOP_BY_HOP
                   and k.lower() not in ('host', 'cookie')}
    try:
        upstream = requests.request(
            method=request.method,
            url=target,
            params=args,
            data=request.get_data(),
            headers=fwd_headers,
            cookies=None,
            allow_redirects=False,
            stream=True,
            timeout=(5, 30),
        )
    except requests.RequestException as exc:
        return Response(
            f'Could not reach the router over the tunnel ({exc}). '
            'Confirm the device is Online, then retry.',
            status=502,
        )

    prefix = f'/api/devices/{device_id}/webfig'
    ctype = upstream.headers.get('Content-Type', '')

    body = upstream.content
    if 'text/html' in ctype.lower():
        body = _rewrite_html(body, prefix)

    resp = Response(body, status=upstream.status_code)
    for k, v in upstream.headers.items():
        if k.lower() in _HOP_BY_HOP:
            continue
        if k.lower() == 'location':
            # Keep redirects inside the proxy prefix.
            if v.startswith('/'):
                v = prefix + v
            resp.headers[k] = v
            continue
        resp.headers[k] = v

    if request.args.get('t'):
        resp.set_cookie(
            _cookie_name(device_id),
            request.args['t'],
            max_age=_COOKIE_MAX_AGE,
            httponly=True,
            samesite='Lax',
            secure=request.is_secure,
            path=prefix,
        )
    return resp


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
