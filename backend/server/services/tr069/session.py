"""CWMP session state machine — drives one CPE conversation from Inform to 204.

A TR-069 session is a chain of HTTP round trips over one connection, and the CPE
drives every one of them:

    CPE  -> POST Inform
    ACS  -> InformResponse
    CPE  -> POST <empty>          "I'm done talking, got anything for me?"
    ACS  -> GetParameterValues    one RPC per turn — never more
    CPE  -> POST GetParameterValuesResponse
    ACS  -> SetParameterValues
    CPE  -> POST SetParameterValuesResponse
    ACS  -> 204 No Content        end of session

The ACS may only have one RPC outstanding at a time, so work is a queue drained
one item per turn. Session continuity is an HTTP cookie: the CPE echoes it back
on every POST, and it is the only thing tying these requests together.

Everything here is request-scoped and stateless beyond the database, so it works
unchanged across multiple gunicorn workers.
"""
import json
import secrets
from datetime import datetime, timedelta

from flask import current_app

from extensions import db
from models import CpeDevice, CpeSession, CpeTask
from services.tr069 import profiles, soap

SESSION_COOKIE = 'infora_cwmp_session'
# A CPE that opens a session and stops mid-conversation would otherwise hold its
# tasks in 'sent' forever. Anything older than this is treated as abandoned.
SESSION_MAX_AGE = timedelta(minutes=10)


class CwmpSession:
    """Per-request view of a CWMP conversation."""

    def __init__(self, token, device=None, cwmp_ns=soap.DEFAULT_CWMP_NS, peer_ip=None):
        self.token = token
        self.device = device
        self.cwmp_ns = cwmp_ns
        self.peer_ip = peer_ip
        self.record = None

    # -- lifecycle ---------------------------------------------------------
    @classmethod
    def start(cls, peer_ip=None, cwmp_ns=soap.DEFAULT_CWMP_NS):
        session = cls(token=secrets.token_hex(16), cwmp_ns=cwmp_ns, peer_ip=peer_ip)
        session.record = CpeSession(session_token=session.token, peer_ip=peer_ip)
        db.session.add(session.record)
        return session

    @classmethod
    def resume(cls, token, peer_ip=None, cwmp_ns=soap.DEFAULT_CWMP_NS):
        if not token:
            return None
        record = CpeSession.query.filter_by(session_token=token, ended_at=None).first()
        if not record:
            return None
        if record.started_at and datetime.utcnow() - record.started_at > SESSION_MAX_AGE:
            return None
        session = cls(token=token, cwmp_ns=cwmp_ns, peer_ip=peer_ip)
        session.record = record
        session.device = CpeDevice.query.get(record.device_id) if record.device_id else None
        return session

    def end(self):
        if self.record and not self.record.ended_at:
            self.record.ended_at = datetime.utcnow()

    def bump_rpc(self):
        if self.record:
            self.record.rpc_count = (self.record.rpc_count or 0) + 1

    def bump_fault(self):
        if self.record:
            self.record.fault_count = (self.record.fault_count or 0) + 1


# --------------------------------------------------------------------------
#  Inform handling
# --------------------------------------------------------------------------

def register_or_update_device(inform, peer_ip, isp_id, auth_username=None):
    """Find or create the CpeDevice an Inform belongs to.

    New devices land in 'pending' — they answer Informs but are issued no tasks
    until an operator approves them. An ACS is reachable from the whole internet
    (it must be, that is the point) so auto-managing anything that shows up is
    not acceptable.
    """
    device_id = inform.get('device_id') or {}
    oui = device_id.get('OUI')
    serial_number = device_id.get('SerialNumber')
    product_class = device_id.get('ProductClass')
    manufacturer = device_id.get('Manufacturer')

    if not serial_number:
        raise ValueError('Inform DeviceId has no SerialNumber')

    serial_key = CpeDevice.build_serial_key(oui, product_class, serial_number)
    device = CpeDevice.query.filter_by(serial_key=serial_key).first()

    parameters = inform.get('parameters') or {}
    root = profiles.detect_data_model_root(parameters.keys())
    profile = profiles.resolve_profile(
        manufacturer=manufacturer, product_class=product_class,
        data_model_root=root, oui=oui,
    )

    created = False
    if not device:
        device = CpeDevice(
            isp_id=isp_id,
            serial_key=serial_key,
            status='pending',
        )
        db.session.add(device)
        created = True

    device.oui = oui or device.oui
    device.serial_number = serial_number or device.serial_number
    device.product_class = product_class or device.product_class
    device.manufacturer = manufacturer or device.manufacturer
    device.data_model_root = root or device.data_model_root
    device.profile_key = profile['key']
    device.peer_ip = peer_ip
    device.last_inform_at = datetime.utcnow()
    device.inform_count = (device.inform_count or 0) + 1
    if auth_username:
        device.cwmp_username = auth_username

    events = inform.get('events') or []
    device.last_inform_event = ','.join(events)[:60] if events else None
    # '0 BOOTSTRAP' is the CPE's first-ever contact (or post-factory-reset);
    # '1 BOOT' is an ordinary power-on. Both mean it just restarted.
    if any(e.startswith(('0 ', '1 ')) for e in events):
        device.last_boot_at = datetime.utcnow()

    apply_parameters(device, parameters, profile)
    return device, created


def apply_parameters(device, values, profile=None):
    """Merge a {path: value} map into the device's snapshot + hot columns."""
    if not values:
        return
    profile = profile or profiles.get_profile(device.profile_key) or \
        profiles.resolve_profile(data_model_root=device.data_model_root)

    try:
        snapshot = json.loads(device.parameters) if device.parameters else {}
    except (TypeError, ValueError):
        snapshot = {}
    snapshot.update(values)
    device.parameters = json.dumps(snapshot)
    device.parameters_at = datetime.utcnow()

    # Fold known paths into the indexed columns the fleet list reads.
    for path, value in values.items():
        field = profiles.field_for_path(profile, path)
        if not field:
            continue
        if field == 'wan_ip':
            device.wan_ip = (value or None)
        elif field == 'wifi_ssid':
            device.ssid = (value or None)
        elif field == 'pppoe_username':
            device.pppoe_username = (value or None)
        elif field == 'software_version':
            device.software_version = (value or None)
        elif field == 'hardware_version':
            device.hardware_version = (value or None)
        elif field == 'uptime':
            device.uptime_seconds = _as_int(value)
        elif field == 'connected_clients':
            device.connected_clients = _as_int(value)
        elif field == 'rx_power':
            device.rx_power_dbm = profiles.scale_optical(profile, value)
        elif field == 'tx_power':
            device.tx_power_dbm = profiles.scale_optical(profile, value)


def _as_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def autobind_customer(device):
    """Link a CPE to its subscriber using the PPPoE username it reports.

    The ONT dials with the same credential FreeRADIUS authenticates, so the WAN
    config is an authoritative join key — no operator input, no MAC lists.
    """
    if device.customer_id or not device.pppoe_username:
        return False
    from services.radius_provisioning import find_customer_by_login

    try:
        customer = find_customer_by_login(device.pppoe_username, isp_id=device.isp_id)
    except Exception as exc:
        current_app.logger.warning('CPE autobind lookup failed for %s: %s', device.serial_key, exc)
        return False
    if not customer:
        return False
    device.customer_id = customer.id
    current_app.logger.info(
        'CPE %s auto-bound to customer %s via PPPoE login', device.serial_key, customer.id,
    )
    return True


# --------------------------------------------------------------------------
#  Task queue draining
# --------------------------------------------------------------------------

def queue_core_parameter_read(device, created_by=None):
    """Queue the standard 'what are you' read for a device."""
    profile = profiles.get_profile(device.profile_key) or \
        profiles.resolve_profile(data_model_root=device.data_model_root)
    paths = profiles.core_parameter_paths(profile)
    if not paths:
        return None
    return queue_task(device, 'get_parameter_values', {'names': paths}, created_by=created_by)


def queue_task(device, kind, payload=None, created_by=None, ttl_hours=24):
    task = CpeTask(
        device_id=device.id,
        isp_id=device.isp_id,
        kind=kind,
        payload=json.dumps(payload or {}),
        status='queued',
        created_by=created_by,
        expires_at=datetime.utcnow() + timedelta(hours=ttl_hours),
    )
    db.session.add(task)
    return task


def next_task(device):
    """Oldest deliverable task, expiring any that have timed out.

    A 'sent' task from an abandoned session is retried rather than stranded —
    the CPE never answered, so it never ran.
    """
    now = datetime.utcnow()
    CpeTask.query.filter(
        CpeTask.device_id == device.id,
        CpeTask.status.in_(('queued', 'sent')),
        CpeTask.expires_at.isnot(None),
        CpeTask.expires_at < now,
    ).update({'status': 'expired'}, synchronize_session=False)

    return (
        CpeTask.query
        .filter(CpeTask.device_id == device.id, CpeTask.status.in_(('queued', 'sent')))
        .order_by(CpeTask.created_at.asc())
        .first()
    )


def build_rpc_for_task(task, cwmp_ns, request_id):
    """Render a queued task as its CWMP request envelope."""
    try:
        payload = json.loads(task.payload) if task.payload else {}
    except (TypeError, ValueError):
        payload = {}

    kind = task.kind
    if kind == 'get_parameter_values':
        return soap.build_get_parameter_values(payload.get('names') or [], cwmp_ns, request_id)
    if kind == 'set_parameter_values':
        return soap.build_set_parameter_values(
            payload.get('values') or {}, cwmp_ns, request_id,
            command_key=payload.get('command_key', f'task-{task.id}'),
        )
    if kind == 'get_parameter_names':
        return soap.build_get_parameter_names(
            payload.get('path', ''), payload.get('next_level', False), cwmp_ns, request_id,
        )
    if kind == 'reboot':
        return soap.build_reboot(payload.get('command_key', f'task-{task.id}'), cwmp_ns, request_id)
    if kind == 'factory_reset':
        return soap.build_factory_reset(cwmp_ns, request_id)
    if kind == 'add_object':
        return soap.build_add_object(payload.get('object_name', ''), cwmp_ns, request_id)
    if kind == 'delete_object':
        return soap.build_delete_object(payload.get('object_name', ''), cwmp_ns, request_id)
    if kind == 'download':
        return soap.build_download(
            payload.get('url', ''),
            file_type=payload.get('file_type', '1 Firmware Upgrade Image'),
            cwmp_ns=cwmp_ns, request_id=request_id,
            command_key=payload.get('command_key', f'task-{task.id}'),
            file_size=payload.get('file_size', 0),
        )
    return None


def complete_task(task, kind, payload, device=None):
    """Record a CPE response against the task that caused it."""
    task.completed_at = datetime.utcnow()
    task.result = json.dumps(payload or {})

    if kind == 'Fault':
        task.status = 'failed'
        task.fault_code = payload.get('cwmp_fault_code') or payload.get('faultcode')
        task.fault_string = payload.get('cwmp_fault_string') or payload.get('faultstring')
        return

    task.status = 'done'
    # A values read is the one response that carries state worth keeping.
    if kind == 'GetParameterValuesResponse' and device is not None:
        apply_parameters(device, payload.get('parameters') or {})
