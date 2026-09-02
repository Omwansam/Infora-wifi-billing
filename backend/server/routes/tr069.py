"""Device-facing CWMP (TR-069) endpoint — the ACS.

This is the one route in the system that unauthenticated hardware on the public
internet POSTs to, so it follows the same defensive shape as
routes/provision.py: rate limited, never leaks whether an identity exists, and
answers nothing useful without credentials.

Session flow (see services/tr069/session.py for the full picture):

    POST Inform            -> InformResponse   + session cookie
    POST <empty>           -> next queued RPC, or 204 to end the session
    POST <RpcResponse>     -> next queued RPC, or 204

Auth: the CPE presents HTTP Basic credentials it was configured with. Three ways in,
in descending order of strictness:

  * strict (default)  — credentials must match a known device
  * enrolment window  — while an ISP's window is open, an unknown device may
                        register under it, landing in 'pending'. Time-boxed, named
                        to one ISP, and refused unless the ACS is tunnel-only.
                        See services/tr069/enrollment.py
  * TR069_ALLOW_UNKNOWN — the same relaxation, but permanent and global. Only for
                        a deployment that genuinely wants open registration

A 'pending' device receives no tasks until an operator approves it, so none of
these grant control of anything — they decide who may knock.

Port: served on the normal Flask app. In production give it its own vhost/port
(7547 is the IANA CWMP port) and keep it off the CDN — see TR069.md.
"""
import base64
from datetime import datetime

from flask import Blueprint, Response, current_app, request

from extensions import db
from models import CpeDevice, CpeTask, ISP
from services.encryption import decrypt_value
from services.rate_limit import client_ip as get_client_ip, is_rate_limited
from services.tr069 import enrollment
from services.tr069 import session as cwmp_session
from services.tr069 import soap

tr069_bp = Blueprint('tr069', __name__, url_prefix='/tr069')

# Served on a plain GET, which is not CWMP but is exactly what an operator or a
# health check reaches for. acs_diagnostics asserts on this text to prove a router
# reached OUR ACS rather than merely something answering on that address, so the
# two must not drift — hence a constant rather than a literal in each place.
GET_GREETING = 'Infora ACS (TR-069). CPE must POST a CWMP envelope.\n'

# A CPE in a reboot loop can hammer this. Generous enough for a normal session
# (one Inform + a handful of RPC turns) but caps a runaway device.
_RATE_WINDOW_SECONDS = 60
_RATE_MAX_HITS = 120

_CONTENT_TYPE = 'text/xml; charset=utf-8'


def _xml(body, status=200, session_token=None):
    response = Response(body, status=status, mimetype=_CONTENT_TYPE)
    if session_token:
        # Session continuity is cookie-based and this is the only thread tying
        # the CPE's separate POSTs together. Not HttpOnly/Secure-flagged: these
        # are non-browser clients, many of which mishandle cookie attributes.
        response.set_cookie(cwmp_session.SESSION_COOKIE, session_token, path='/tr069')
    return response


def _end_session(session):
    """204 No Content is how an ACS says 'we're done'."""
    session.end()
    db.session.commit()
    return Response('', status=204)


def _unauthorized():
    response = Response('', status=401, mimetype=_CONTENT_TYPE)
    response.headers['WWW-Authenticate'] = 'Basic realm="Infora ACS"'
    return response


def _basic_credentials():
    header = request.headers.get('Authorization', '')
    if not header.startswith('Basic '):
        return None, None
    try:
        decoded = base64.b64decode(header[6:]).decode('utf-8', 'replace')
    except Exception:
        return None, None
    username, _, password = decoded.partition(':')
    return username, password


def _default_isp_id():
    isp = ISP.query.filter_by(is_active=True).order_by(ISP.id.asc()).first()
    return isp.id if isp else None


def _authenticate(username, password):
    """Match Basic credentials against a known CPE.

    Returns (device, ok). A device with no stored password is treated as
    not-yet-enrolled: it authenticates on username alone so the first contact
    can complete, then credentials are set from the admin API.
    """
    if not username:
        return None, False
    device = CpeDevice.query.filter_by(cwmp_username=username).first()
    if not device:
        return None, False
    if not device.cwmp_password_encrypted:
        return device, True
    try:
        expected = decrypt_value(device.cwmp_password_encrypted)
    except Exception:
        return device, False
    return device, bool(password) and password == expected


@tr069_bp.route('', methods=['GET', 'POST'])
@tr069_bp.route('/', methods=['GET', 'POST'])
def acs_endpoint():
    peer_ip = get_client_ip()

    if is_rate_limited(f'cwmp-ip|{peer_ip}', _RATE_MAX_HITS, _RATE_WINDOW_SECONDS):
        return Response('', status=503)

    # A GET is not part of CWMP; CPE only ever POST. Answer plainly so an
    # operator hitting the URL in a browser gets a useful signal, without
    # revealing anything about enrolled devices.
    if request.method == 'GET':
        return Response(GET_GREETING,
                        status=200, mimetype='text/plain')

    body = request.get_data() or b''
    cwmp_ns = soap.detect_cwmp_namespace(body) if body else soap.DEFAULT_CWMP_NS

    try:
        kind, payload = soap.parse_message(body)
    except ValueError as exc:
        current_app.logger.warning('CWMP parse error from %s: %s', peer_ip, exc)
        return _xml(soap.build_fault('9003', 'Invalid arguments', cwmp_ns), status=400)

    username, password = _basic_credentials()
    request_id = str(int(datetime.utcnow().timestamp()))

    if kind == 'Inform':
        return _handle_inform(payload, peer_ip, cwmp_ns, request_id, username, password)

    # Every non-Inform message must belong to an open session.
    token = request.cookies.get(cwmp_session.SESSION_COOKIE)
    session = cwmp_session.CwmpSession.resume(token, peer_ip=peer_ip, cwmp_ns=cwmp_ns)
    if not session:
        # No session: the CPE is confused (or this is a scanner). Tell it to
        # start over rather than silently accepting orphaned RPCs.
        return _xml(soap.build_fault('8005', 'No active session', cwmp_ns), status=400)

    if kind == 'TransferComplete':
        return _handle_transfer_complete(session, payload, cwmp_ns, request_id)

    return _handle_turn(session, kind, payload, cwmp_ns, request_id)


def _handle_inform(payload, peer_ip, cwmp_ns, request_id, username, password):
    allow_unknown = bool(current_app.config.get('TR069_ALLOW_UNKNOWN', False))

    device, authenticated = _authenticate(username, password)
    if device and not authenticated:
        # Known username, wrong password — always reject, regardless of mode.
        current_app.logger.warning('CWMP auth failed for %s from %s', username, peer_ip)
        return _unauthorized()

    # An unknown device is normally rejected outright. An open enrolment window is
    # the deliberate exception: it lets an installer bring up a CPE whose serial
    # they never recorded. The device still lands in `pending` and still needs
    # approving, so this widens who may knock, not what they may do.
    window_isp_id = None
    if not device and not allow_unknown:
        window_isp_id, reason = enrollment.open_window_isp_id()
        if window_isp_id is None:
            current_app.logger.info(
                'CWMP Inform from unknown CPE at %s rejected: %s', peer_ip, reason,
            )
            return _unauthorized()
        current_app.logger.info(
            'CWMP Inform from unknown CPE at %s accepted under the enrolment '
            'window for ISP %s', peer_ip, window_isp_id,
        )

    isp_id = device.isp_id if device else (window_isp_id or _default_isp_id())
    if not isp_id:
        current_app.logger.error('CWMP Inform rejected: no active ISP to attribute it to')
        return _xml(soap.build_fault('9002', 'Server not configured', cwmp_ns), status=500)

    try:
        device, created = cwmp_session.register_or_update_device(
            payload, peer_ip, isp_id, auth_username=username,
        )
    except ValueError as exc:
        current_app.logger.warning('CWMP Inform rejected from %s: %s', peer_ip, exc)
        return _xml(soap.build_fault('9003', str(exc), cwmp_ns), status=400)

    db.session.flush()
    cwmp_session.autobind_customer(device)

    session = cwmp_session.CwmpSession.start(peer_ip=peer_ip, cwmp_ns=cwmp_ns)
    session.device = device
    session.record.device_id = device.id
    session.record.events = ','.join(payload.get('events') or [])[:255]

    if created:
        current_app.logger.info(
            'New CPE %s (%s) from %s — pending approval',
            device.serial_key, device.manufacturer or 'unknown', peer_ip,
        )
        # Learn what it is straight away; the read is harmless on a pending
        # device and makes the approval screen show real data.
        cwmp_session.queue_core_parameter_read(device)

    db.session.commit()
    return _xml(
        soap.build_inform_response(cwmp_ns, request_id),
        session_token=session.token,
    )


def _handle_transfer_complete(session, payload, cwmp_ns, request_id):
    """A Download finished (or failed) — close out the task that started it."""
    command_key = payload.get('command_key') or ''
    task = None
    if command_key.startswith('task-'):
        try:
            task = CpeTask.query.get(int(command_key.split('-', 1)[1]))
        except (ValueError, IndexError):
            task = None

    if task:
        fault_code = payload.get('fault_code')
        if fault_code and fault_code != '0':
            task.status = 'failed'
            task.fault_code = fault_code
            task.fault_string = payload.get('fault_string')
        else:
            task.status = 'done'
        task.completed_at = datetime.utcnow()

    db.session.commit()
    return _xml(soap.build_transfer_complete_response(cwmp_ns, request_id))


def _handle_turn(session, kind, payload, cwmp_ns, request_id):
    """One conversational turn: close out any outstanding RPC, then issue the next."""
    device = session.device
    if not device:
        return _end_session(session)

    # An RPC response (or Fault) closes whichever task we last sent.
    if kind not in ('Empty',):
        outstanding = (
            CpeTask.query
            .filter_by(device_id=device.id, status='sent')
            .order_by(CpeTask.delivered_at.asc())
            .first()
        )
        if outstanding:
            cwmp_session.complete_task(outstanding, kind, payload, device=device)
            if kind == 'Fault':
                session.bump_fault()
                current_app.logger.info(
                    'CPE %s faulted on task %s: %s',
                    device.serial_key, outstanding.id, outstanding.fault_string,
                )

    # Never issue work to a device an operator has not approved.
    if device.status != 'active':
        return _end_session(session)

    task = cwmp_session.next_task(device)
    if not task:
        return _end_session(session)

    envelope = cwmp_session.build_rpc_for_task(task, cwmp_ns, request_id)
    if envelope is None:
        task.status = 'failed'
        task.fault_string = f'Unsupported task kind: {task.kind}'
        task.completed_at = datetime.utcnow()
        db.session.commit()
        return _end_session(session)

    task.status = 'sent'
    task.attempts = (task.attempts or 0) + 1
    task.delivered_at = datetime.utcnow()
    if task.attempts > (task.max_attempts or 3):
        task.status = 'failed'
        task.fault_string = 'Exceeded maximum delivery attempts'
        task.completed_at = datetime.utcnow()
        db.session.commit()
        return _end_session(session)

    session.bump_rpc()
    db.session.commit()
    return _xml(envelope)
