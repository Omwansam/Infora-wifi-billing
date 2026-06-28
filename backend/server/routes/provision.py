"""Public, token-authenticated MikroTik self-provisioning endpoint.

A router fetches its config with a single command:

    /tool fetch url="https://<host>/api/provision/<token>/script" dst-path=flash/provision.rsc;
    :delay 3s; /import flash/provision.rsc; :delay 2s;
    :do { /file remove [find name~"provision.rsc"] } on-error={}

No JWT — the opaque 64-hex token in the URL is the credential. Unknown,
expired, inactive, or rate-limited requests all return 404 so the endpoint
does not leak which tokens exist.
"""
from flask import Blueprint, Response, current_app

from extensions import db
from models import MikrotikDevice
from services.provisioning_scripts import build_radius_script
from services.rate_limit import client_ip as get_client_ip, is_rate_limited

provision_bp = Blueprint('provision', __name__, url_prefix='/api/provision')

_RATE_WINDOW_SECONDS = 60
_RATE_MAX_HITS = 10


def _not_found():
    return Response('# not found\n', status=404, mimetype='text/plain')


@provision_bp.route('/<token>/script', methods=['GET'])
def provision_script(token):
    # Token-based public endpoint: rate-limit by IP and by token, but return 404
    # (not 429) so the endpoint never reveals whether a token exists.
    client_ip = get_client_ip()
    if (
        is_rate_limited(f'provision-ip|{client_ip}', _RATE_MAX_HITS, _RATE_WINDOW_SECONDS)
        or is_rate_limited(f'provision-tok|{token}', _RATE_MAX_HITS, _RATE_WINDOW_SECONDS)
    ):
        return _not_found()

    if not token or len(token) < 32:
        return _not_found()

    device = MikrotikDevice.query.filter_by(provision_token=token).first()
    if not device or not device.is_active or not device.provision_token_is_valid():
        return _not_found()

    try:
        script = build_radius_script(device)
    except ValueError:
        return _not_found()

    device.provision_fetch_count = (device.provision_fetch_count or 0) + 1
    from datetime import datetime
    device.provision_last_fetched_at = datetime.now()
    db.session.commit()

    current_app.logger.info(
        'Provision fetch: device=%s ip=%s count=%s',
        device.id, client_ip, device.provision_fetch_count,
    )

    return Response(script, mimetype='text/plain')
