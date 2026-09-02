"""Subscriber detail page — reads and account actions.

Everything the `/clients/<id>` page needs beyond the plain customer record. It
is a second blueprint on the same `/api/customers` prefix rather than 500 more
lines in `routes/customers.py`, which is already the largest route module in the
tree and is about CRUD; this one is about a single account's history.

Two rules hold throughout:

* **Scope before serve.** Every handler resolves the customer through
  `_load()`, which refuses an account belonging to another ISP. A detail page
  is the easiest place in an app to leak a whole tenant's data.
* **Actions write history.** Anything that changes the account records a
  `CustomerEvent`, because the lifecycle tab is only as true as the events in
  it. The record is written in the same transaction as the change.
"""

from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from auth_utils import get_current_user
from extensions import db
from models import (
    Customer, CustomerNote, CustomerNoteType, CustomerStatus, Invoice,
    InvoiceStatus, ISP, Notification, NotificationPriority, Payment,
    PaymentStatus, RadAcct, ServicePlan, Ticket,
)
from services import customer_events as events
from services import notification_events
from services import subscriber_insights as insights
from services import subscriber_messages as messages
from services import subscription_pause as pause_service
from services.fup_enforcement import OVERRIDE_MODES
from services.plan_utils import (
    format_plan_data_cap_display, get_plan_speed_mbps, plan_subscription_end,
)
from services.radius_provisioning import (
    get_customer_radius_password, provision_customer_radius, radius_username,
    suspend_customer_access,
)
from services.system_log import record_system_log

subscriber_bp = Blueprint('subscriber_detail', __name__, url_prefix='/api/customers')

# Spelled, not shouted — .upper() renders these as PPPOE and WIREGUARD.
_CONNECTION_LABEL = {'pppoe': 'PPPoE', 'hotspot': 'Hotspot', 'wireguard': 'WireGuard'}


# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------

def _load(customer_id):
    """(customer, user, error_response). Error is None when the caller may proceed."""
    user = get_current_user()
    if not user:
        return None, None, (jsonify({'error': 'User not found'}), 404)
    customer = Customer.query.get(customer_id)
    if not customer:
        return None, None, (jsonify({'error': 'Subscriber not found'}), 404)
    if user.role != 'admin' and user.isp_id and customer.isp_id != user.isp_id:
        return None, None, (jsonify({'error': 'Access denied'}), 403)
    return customer, user, None


def _isp_of(customer):
    return ISP.query.get(customer.isp_id) if customer.isp_id else None


def _plan_summary(plan):
    if not plan:
        return None
    speeds = get_plan_speed_mbps(plan)
    return {
        'id': plan.id,
        'name': plan.name,
        'speed': plan.speed,
        'price': float(plan.price) if plan.price is not None else 0.0,
        'download_mbps': speeds.get('download_mbps'),
        'upload_mbps': speeds.get('upload_mbps'),
        'data_cap': format_plan_data_cap_display(plan),
        'billing_cycle_days': plan.billing_cycle_days,
        'duration_hours': plan.duration_hours,
        'plan_type': plan.plan_type,
    }


def _parse_dt(value):
    """ISO 8601 from the browser -> naive UTC, matching the column's convention.

    The browser sends an offset; `subscription_end` is naive UTC. Storing the
    wall-clock time as written would fire a +03:00 operator's expiry three hours
    late, which is the bug routes/customers.py._parse_datetime already fixed.
    """
    if not value:
        return None
    text = str(value).strip()
    if text.endswith('Z'):
        text = text[:-1] + '+00:00'
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _fmt_dt(value):
    return value.strftime('%d %b %Y, %H:%M') if value else '—'


def _send_sms(customer, body):
    """(True, None) on success, or (False, error_response).

    `raise_errors=True` throughout: an operator who clicked Send must be told
    when nothing went out. The automated templates keep the quiet behaviour.
    """
    from services import notification_dispatch as nd
    try:
        sent = nd.send_sms(customer.phone, body, isp=_isp_of(customer), raise_errors=True)
    except Exception as exc:
        return False, _fail(str(exc) or 'SMS gateway rejected the message', 502)
    if not sent:
        return False, _fail('SMS gateway did not accept the message', 502)
    return True, None


def _ok(payload, status=200):
    return jsonify({'ok': True, 'data': payload}), status


def _fail(message, status=400):
    return jsonify({'ok': False, 'error': message}), status


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------

@subscriber_bp.route('/<int:customer_id>/overview', methods=['GET'])
@jwt_required()
def get_overview(customer_id):
    """One call for the whole Overview tab and the header above it."""
    customer, _user, error = _load(customer_id)
    if error:
        return error

    now = datetime.now()  # radacct clock — see subscriber_insights module docstring
    plan = customer.service_plan
    lifetime, last_payment = insights._payment_totals(customer)

    return _ok({
        # No `now` — expiry runs on the UTC clock, not radacct's local one.
        'subscription': insights.subscription_state(customer),
        'last_session': insights.last_session(customer, now),
        'lifetime_value': lifetime,
        'month_to_date': insights.month_to_date_revenue(customer, now),
        'last_payment': last_payment,
        'wallet': insights.wallet(customer),
        'counts': insights.tab_counts(customer),
        'timeline': events.timeline(customer, limit=40),
        'activity': insights.activity_calendar(customer, days=365, now=now),
        'fup': insights.fup_snapshot(customer, now),
        'plan': _plan_summary(plan),
        'network': _network_card(customer),
        # The answer to "why is this subscriber offline", assembled from the
        # subscription, FUP, account status and the last disconnect reason -- all
        # of which were already computed and none of which reached the screen.
        'diagnosis': insights.diagnose_connection(customer, now),
        # Which automatic messages are armed for this tenant. An empty message log
        # usually means an event was never switched on, not that nothing happened.
        'lifecycle_messages': notification_events.subscriber_lifecycle_status(customer.isp_id),
        'reference': {
            'account_id': customer.id,
            'account_number': customer.account_number,
            'phone': customer.phone,
            'email': customer.email,
            'address': customer.address,
            'id_number': customer.id_number,
            'kyc_status': customer.kyc_status.value if customer.kyc_status else 'pending',
            'acquired_via': f'{_CONNECTION_LABEL.get(customer.connection_type, "PPPoE")} setup',
            'joined_at': customer.join_date.isoformat() if customer.join_date else None,
        },
        'messages': _recent_messages(customer, limit=4),
    })


def _resolve_router(nas_ip):
    """Turn a NAS address into a router card, managed or not."""
    if not nas_ip:
        return None
    from models import MikrotikDevice
    device = MikrotikDevice.query.filter_by(device_ip=nas_ip).first()
    if device:
        return {'id': device.id, 'name': device.device_name, 'ip': device.device_ip,
                'model': device.device_model, 'location': device.location}
    # The NAS answered but is not a router we manage -- show the address rather
    # than nothing, so the operator can still see where they are.
    return {'id': None, 'name': nas_ip, 'ip': nas_ip, 'model': None, 'location': None}


def _network_card(customer):
    """Router, connection type and login for the Device & network panel."""
    live = insights.live_snapshot(customer)
    last = insights.last_session(customer)

    # Resolve from the live session when there is one, and fall back to the last
    # closed session otherwise. Reading only the live snapshot left this blank for
    # every offline subscriber -- which is exactly who is being looked up, because
    # nobody calls support while their internet is working.
    router = _resolve_router(live.get('nas_ip'))
    router_is_live = router is not None
    if router is None and last:
        router = _resolve_router(last.get('nas_ip'))

    return {
        'router': router,
        'router_is_live': router_is_live,
        # Where the subscriber last actually appeared, for the "last seen on" line.
        'last_seen_at': (last or {}).get('ended_at') or (last or {}).get('started_at'),
        'connection_type': customer.connection_type or 'pppoe',
        'username': radius_username(customer),
        'has_password': bool(customer.radius_password_encrypted),
        'ip_address': live.get('ip_address') or (last or {}).get('ip_address'),
        'mac_address': live.get('mac_address') or (last or {}).get('mac_address'),
        'online': live.get('online'),
        'static_ip': customer.service_plan.static_ip if customer.service_plan else None,
    }


def _recent_messages(customer, limit=5):
    rows = (
        Notification.query.filter_by(customer_id=customer.id)
        .order_by(Notification.created_at.desc())
        .limit(limit).all()
    )
    return [_serialize_message(row) for row in rows]


def _serialize_message(row):
    return {
        'id': row.id,
        'channel': row.notification_type,
        'title': row.title,
        'message': row.message,
        'priority': row.priority.value if row.priority else 'low',
        'read': bool(row.is_read),
        'created_at': row.created_at.isoformat() if row.created_at else None,
    }


@subscriber_bp.route('/<int:customer_id>/reports', methods=['GET'])
@jwt_required()
def get_reports(customer_id):
    """One call for the Reports tab: live, 24h, trend, usage, peak hours."""
    customer, _user, error = _load(customer_id)
    if error:
        return error

    now = datetime.now()
    return _ok({
        'live': insights.live_snapshot(customer, now),
        'traffic_24h': insights.traffic_24h(customer, now),
        'payment_trend': insights.payment_trend(customer, months=12, now=now),
        'daily_usage': insights.daily_usage(customer, now),
        'peak_hours': insights.peak_hours(customer, days=30, now=now),
        'plan': _plan_summary(customer.service_plan),
        'generated_at': now.isoformat(),
    })


@subscriber_bp.route('/<int:customer_id>/sessions', methods=['GET'])
@jwt_required()
def get_sessions(customer_id):
    """Accounting rows for this subscriber, newest first, live ones on top."""
    customer, _user, error = _load(customer_id)
    if error:
        return error

    page = request.args.get('page', 1, type=int)
    per_page = min(100, request.args.get('per_page', 20, type=int))

    query = insights.acct_query(customer).order_by(
        RadAcct.acctstoptime.isnot(None), RadAcct.acctstarttime.desc().nullslast()
    )
    paged = query.paginate(page=page, per_page=per_page, error_out=False)

    return _ok({
        'sessions': [{
            'id': row.radacctid,
            'session_id': row.acctsessionid,
            'started_at': row.acctstarttime.isoformat() if row.acctstarttime else None,
            'ended_at': row.acctstoptime.isoformat() if row.acctstoptime else None,
            'duration_seconds': int(row.acctsessiontime or 0),
            'down_bytes': int(row.acctoutputoctets or 0),
            'up_bytes': int(row.acctinputoctets or 0),
            'ip_address': row.framedipaddress,
            'mac_address': row.callingstationid,
            'nas_ip': row.nasipaddress,
            'terminate_cause': row.acctterminatecause,
            # Translated here rather than in the browser so the CLI, the
            # diagnosis panel and this table all agree on what a cause means.
            'cause': insights.explain_terminate_cause(row.acctterminatecause),
            'live': row.acctstoptime is None,
        } for row in paged.items],
        'total': paged.total,
        'pages': paged.pages,
        'current_page': page,
        'per_page': per_page,
    })


@subscriber_bp.route('/<int:customer_id>/devices', methods=['GET'])
@jwt_required()
def get_devices(customer_id):
    customer, _user, error = _load(customer_id)
    if error:
        return error
    return _ok({'devices': insights.devices(customer)})


@subscriber_bp.route('/<int:customer_id>/package-history', methods=['GET'])
@jwt_required()
def get_package_history(customer_id):
    customer, _user, error = _load(customer_id)
    if error:
        return error
    return _ok({'events': events.package_history(customer, limit=100)})


@subscriber_bp.route('/<int:customer_id>/timeline', methods=['GET'])
@jwt_required()
def get_timeline(customer_id):
    customer, _user, error = _load(customer_id)
    if error:
        return error
    limit = min(200, request.args.get('limit', 60, type=int))
    return _ok({'events': events.timeline(customer, limit=limit)})


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

def _serialize_note(note):
    return {
        'id': note.id,
        'type': note.note_type.value if note.note_type else 'general',
        'title': note.note_title,
        'content': note.note_content,
        'private': bool(note.is_private),
        'created_at': note.created_at.isoformat() if note.created_at else None,
    }


@subscriber_bp.route('/<int:customer_id>/notes', methods=['GET'])
@jwt_required()
def list_notes(customer_id):
    customer, _user, error = _load(customer_id)
    if error:
        return error
    rows = (
        CustomerNote.query.filter_by(customer_id=customer.id)
        .order_by(CustomerNote.created_at.desc()).all()
    )
    return _ok({'notes': [_serialize_note(row) for row in rows]})


@subscriber_bp.route('/<int:customer_id>/notes', methods=['POST'])
@jwt_required()
def create_note(customer_id):
    customer, user, error = _load(customer_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    content = (data.get('content') or '').strip()
    if not content:
        return _fail('A note needs some text')

    raw_type = (data.get('type') or 'general').lower()
    try:
        note_type = CustomerNoteType(raw_type)
    except ValueError:
        note_type = CustomerNoteType.GENERAL

    note = CustomerNote(
        customer_id=customer.id,
        note_type=note_type,
        note_title=(data.get('title') or None),
        note_content=content,
        # Notes on this page are the operator's internal thread. Anything the
        # subscriber should see goes out as a message, not as a note.
        is_private=True,
    )
    db.session.add(note)
    events.record(customer, 'note', 'Note added',
                  detail=content[:200], actor=user)
    db.session.commit()
    return _ok({'note': _serialize_note(note)}, 201)


@subscriber_bp.route('/<int:customer_id>/notes/<int:note_id>', methods=['DELETE'])
@jwt_required()
def delete_note(customer_id, note_id):
    customer, _user, error = _load(customer_id)
    if error:
        return error
    note = CustomerNote.query.filter_by(id=note_id, customer_id=customer.id).first()
    if not note:
        return _fail('Note not found', 404)
    db.session.delete(note)
    db.session.commit()
    return _ok({'deleted': note_id})


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

@subscriber_bp.route('/<int:customer_id>/messages', methods=['GET'])
@jwt_required()
def list_messages(customer_id):
    customer, _user, error = _load(customer_id)
    if error:
        return error
    rows = (
        Notification.query.filter_by(customer_id=customer.id)
        .order_by(Notification.created_at.desc()).limit(200).all()
    )
    return _ok({'messages': [_serialize_message(row) for row in rows]})


@subscriber_bp.route('/<int:customer_id>/message-preview', methods=['GET'])
@jwt_required()
def message_preview(customer_id):
    """Exactly what a canned SMS will say, before the operator commits to it.

    The dialogs show this verbatim and let it be edited; the send endpoints
    accept the edited body back. Same builder both ways, so the preview can
    never drift from what is actually delivered.
    """
    customer, _user, error = _load(customer_id)
    if error:
        return error

    kind = (request.args.get('kind') or '').strip()
    body, extras = messages.preview(customer, kind)
    if body is None:
        return _fail(extras.get('error', 'No preview available'), 400)

    return _ok({
        'kind': kind,
        'body': body,
        'phone': customer.phone,
        'can_send': bool(customer.phone),
        **extras,
    })


@subscriber_bp.route('/<int:customer_id>/messages', methods=['POST'])
@jwt_required()
def send_message(customer_id):
    """Send one SMS to this subscriber and file it on their record."""
    customer, user, error = _load(customer_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    body = (data.get('message') or '').strip()
    if not body:
        return _fail('Nothing to send')
    if not customer.phone:
        return _fail('This subscriber has no phone number on file')

    from services import notification_dispatch as nd
    isp = _isp_of(customer)
    try:
        sent = nd.send_sms(customer.phone, body, isp=isp, raise_errors=True)
    except Exception as exc:
        return _fail(str(exc) or 'SMS gateway rejected the message', 502)
    if not sent:
        return _fail('SMS gateway did not accept the message', 502)

    row = Notification(
        customer_id=customer.id,
        notification_type='sms',
        title=data.get('title') or 'Message from operator',
        message=body,
        priority=NotificationPriority.MEDIUM,
    )
    db.session.add(row)
    events.record(customer, 'sms', 'SMS sent', detail=body[:200], actor=user)
    db.session.commit()
    return _ok({'message': _serialize_message(row)}, 201)


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------

@subscriber_bp.route('/<int:customer_id>/expiry', methods=['POST'])
@jwt_required()
def change_expiry(customer_id):
    """Set when the subscription ends, optionally switching package and grace.

    Accepts either an absolute `expiry` or an `extend` shorthand ("1h", "1d",
    "7d", "1mo"). An extension *stacks* onto a future expiry and *counts from
    now* once it has lapsed — anything else either robs a subscriber of the days
    they already paid for, or backdates the new period into the past.
    """
    customer, user, error = _load(customer_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    now = datetime.utcnow()  # subscription_end is naive UTC — see _parse_dt
    before = customer.subscription_end
    new_end = None

    extend = (data.get('extend') or '').strip().lower()
    if extend:
        deltas = {
            '1h': timedelta(hours=1), '1d': timedelta(days=1),
            '7d': timedelta(days=7), '1mo': timedelta(days=30),
        }
        if extend not in deltas:
            return _fail(f'Unknown extension "{extend}"')
        base = before if (before and before > now) else now
        new_end = base + deltas[extend]
    elif 'expiry' in data:
        new_end = _parse_dt(data.get('expiry'))
        if data.get('expiry') and not new_end:
            return _fail('Invalid expiry — expected an ISO 8601 datetime')

    plan_changed_from = None
    plan_id = data.get('plan_id')
    if plan_id:
        plan = ServicePlan.query.get(plan_id)
        if not plan:
            return _fail('Package not found', 404)
        if customer.isp_id and plan.isp_id != customer.isp_id:
            return _fail('That package belongs to another ISP', 403)
        if plan.id != customer.service_plan_id:
            plan_changed_from = customer.service_plan.name if customer.service_plan else customer.package
            customer.service_plan_id = plan.id
            customer.package = plan.name
            # No explicit expiry given with a package switch means "start this
            # package's period", which is what the operator almost always means.
            if new_end is None:
                new_end = plan_subscription_end(plan, stack_from=before)

    if 'grace_days' in data:
        try:
            grace = max(0, int(data.get('grace_days') or 0))
        except (TypeError, ValueError):
            return _fail('Grace period must be a whole number of days')
        customer.grace_period_days = grace

    if new_end is not None:
        customer.subscription_end = new_end
        if not customer.subscription_start:
            customer.subscription_start = now

    isp = _isp_of(customer)

    # An account that was expired and now is not must get its access back, and
    # one that has just been expired must lose it. Changing the date without
    # re-provisioning leaves the router disagreeing with the billing record.
    if customer.subscription_end and isp and customer.status == CustomerStatus.ACTIVE:
        try:
            if customer.subscription_end > now:
                provision_customer_radius(
                    customer, customer.service_plan, isp,
                    throttle=bool(customer.fup_throttled),
                )
            else:
                suspend_customer_access(customer, isp)
        except Exception as exc:
            record_system_log('radius', f'Expiry re-provision failed for {customer.id}: {exc}',
                              level='WARNING')

    if plan_changed_from:
        events.record(
            customer, 'plan_changed', 'Package changed',
            detail=f'{plan_changed_from} → {customer.package}',
            from_value=plan_changed_from, to_value=customer.package, actor=user,
        )
    if new_end is not None and new_end != before:
        events.record(
            customer, 'expiry_changed', 'Expiry changed',
            detail=f'{_fmt_dt(before)} → {_fmt_dt(new_end)}',
            from_value=before.isoformat() if before else None,
            to_value=new_end.isoformat(), actor=user,
        )

    db.session.commit()

    if data.get('notify', True):
        _dispatch(customer, 'expiry_date_changed')

    return _ok({
        'subscription': insights.subscription_state(customer),
        'plan': _plan_summary(customer.service_plan),
    })


def _dispatch(customer, event_key, channel='sms', extra=None):
    """Fire a configured notification template. Never fatal to the action."""
    try:
        from services import notification_dispatch as nd
        isp = _isp_of(customer)
        if not isp:
            return
        plan = customer.service_plan
        variables = {
            'customer_name': customer.full_name or '',
            'isp_name': isp.name or isp.company_name or '',
            'username': radius_username(customer),
            'account_number': customer.account_number or '',
            'phone': customer.phone or '',
            'plan': plan.name if plan else (customer.package or ''),
            'expiry_date': (customer.subscription_end.strftime('%d %b %Y %H:%M')
                            if customer.subscription_end else ''),
        }
        variables.update(extra or {})
        nd.dispatch_event(isp, customer, event_key, channel, variables)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        record_system_log('notification', f'{event_key} dispatch failed for '
                          f'customer {customer.id}: {exc}', level='WARNING')


@subscriber_bp.route('/<int:customer_id>/send-credentials', methods=['POST'])
@jwt_required()
def send_credentials(customer_id):
    """SMS the subscriber their own login, as previewed (or as edited)."""
    customer, user, error = _load(customer_id)
    if error:
        return error
    if not customer.phone:
        return _fail('This subscriber has no phone number on file')

    data = request.get_json(silent=True) or {}
    body = (data.get('message') or '').strip()
    if not body:
        body, extras = messages.preview(customer, 'credentials')
        if body is None:
            return _fail(extras.get('error', 'No credentials to send'))

    sent, failure = _send_sms(customer, body)
    if not sent:
        return failure

    db.session.add(Notification(
        customer_id=customer.id, notification_type='sms',
        title='Connection credentials',
        # The filed record must not archive the password in plaintext — the SMS
        # is the delivery, the record is only that it happened.
        message='Connection credentials sent by SMS.',
        priority=NotificationPriority.MEDIUM,
    ))
    events.record(customer, 'sms', 'Credentials sent',
                  detail='Username and password sent by SMS', actor=user)
    db.session.commit()
    return _ok({'sent_to': customer.phone})


@subscriber_bp.route('/<int:customer_id>/send-payment-details', methods=['POST'])
@jwt_required()
def send_payment_details(customer_id):
    """SMS how to pay: the ISP's real collection route and the account number."""
    customer, user, error = _load(customer_id)
    if error:
        return error
    if not customer.phone:
        return _fail('This subscriber has no phone number on file')

    data = request.get_json(silent=True) or {}
    body = (data.get('message') or '').strip() or messages.payment_details_body(customer)

    sent, failure = _send_sms(customer, body)
    if not sent:
        return failure

    db.session.add(Notification(
        customer_id=customer.id, notification_type='sms',
        title='Payment details', message=body, priority=NotificationPriority.MEDIUM,
    ))
    events.record(customer, 'sms', 'Payment details sent', detail=body[:200], actor=user)
    db.session.commit()
    return _ok({'sent_to': customer.phone, 'body': body})


@subscriber_bp.route('/<int:customer_id>/invoice', methods=['POST'])
@jwt_required()
def generate_invoice(customer_id):
    """Raise one invoice for the account's current package."""
    customer, user, error = _load(customer_id)
    if error:
        return error

    plan = customer.service_plan
    data = request.get_json(silent=True) or {}
    amount = data.get('amount')
    if amount is None:
        if not plan or plan.price is None:
            return _fail('This subscriber has no package price to invoice — pass an amount')
        amount = float(plan.price)
    try:
        amount = round(float(amount), 2)
    except (TypeError, ValueError):
        return _fail('Amount must be a number')
    if amount <= 0:
        return _fail('An invoice needs a positive amount')

    due_days = data.get('due_days', 7)
    try:
        due_days = max(0, int(due_days))
    except (TypeError, ValueError):
        due_days = 7

    # Numbered from the account and the clock so two operators invoicing the
    # same subscriber in the same second cannot collide on the unique column.
    number = f'INV-{customer.id}-{datetime.now().strftime("%Y%m%d%H%M%S")}'
    invoice = Invoice(
        invoice_number=number,
        amount=amount,
        status=InvoiceStatus.PENDING,
        due_date=datetime.utcnow() + timedelta(days=due_days),
        notes=data.get('notes') or (f'{plan.name} subscription' if plan else 'Internet service'),
        customer_id=customer.id,
        isp_id=customer.isp_id,
    )
    db.session.add(invoice)
    events.record(customer, 'invoice', 'Invoice generated',
                  detail=f'{number} · due {_fmt_dt(invoice.due_date)}',
                  amount=amount, actor=user)
    db.session.commit()

    return _ok({
        'invoice': {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'amount': float(invoice.amount),
            'status': invoice.status.value,
            'due_date': invoice.due_date.isoformat(),
            'notes': invoice.notes,
        }
    }, 201)


@subscriber_bp.route('/<int:customer_id>/pause', methods=['POST'])
@jwt_required()
def pause_subscription(customer_id):
    """Stop the clock: remove access and bank the days still owed.

    Optionally set `pause_until` and the subscription comes back on its own —
    see services.subscription_pause for why the banked days live on the event.
    """
    customer, user, error = _load(customer_id)
    if error:
        return error
    if customer.status == CustomerStatus.SUSPENDED:
        return _fail('This subscription is already suspended')

    data = request.get_json(silent=True) or {}
    until = _parse_dt(data.get('pause_until'))
    if data.get('pause_until') and not until:
        return _fail('Invalid auto-resume time — expected an ISO 8601 datetime')
    if until and until <= datetime.utcnow():
        return _fail('The auto-resume time is already in the past')

    try:
        banked = pause_service.pause(customer, isp=_isp_of(customer), until=until, actor=user)
    except Exception as exc:
        db.session.rollback()
        return _fail(f'Could not remove RADIUS access: {exc}', 502)

    db.session.commit()
    if data.get('notify'):
        _dispatch(customer, 'account_suspended')

    return _ok({
        'status': customer.status.value,
        'banked_days': banked,
        'pause_until': until.isoformat() if until else None,
        'subscription': insights.subscription_state(customer),
    })


@subscriber_bp.route('/<int:customer_id>/resume', methods=['POST'])
@jwt_required()
def resume_subscription(customer_id):
    """Restore access and give back the days banked at the pause."""
    customer, user, error = _load(customer_id)
    if error:
        return error
    if customer.status == CustomerStatus.ACTIVE:
        return _fail('This subscription is already active')

    try:
        restored = pause_service.resume(customer, isp=_isp_of(customer), actor=user)
    except Exception as exc:
        db.session.rollback()
        return _fail(f'Could not restore RADIUS access: {exc}', 502)

    db.session.commit()
    _dispatch(customer, 'account_reactivated')
    return _ok({
        'status': customer.status.value,
        'restored_days': restored,
        'subscription': insights.subscription_state(customer),
    })


@subscriber_bp.route('/<int:customer_id>/block', methods=['POST'])
@jwt_required()
def block_subscriber(customer_id):
    """Cut access as an enforcement action. The clock keeps running."""
    customer, user, error = _load(customer_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    reason = (data.get('reason') or '').strip()

    isp = _isp_of(customer)
    if isp:
        try:
            suspend_customer_access(customer, isp)
        except Exception as exc:
            return _fail(f'Could not remove RADIUS access: {exc}', 502)
    customer.status = CustomerStatus.SUSPENDED

    events.record(customer, 'blocked', 'Subscriber blocked',
                  detail=reason or 'Access revoked by operator',
                  to_value='blocked', actor=user)
    db.session.commit()
    _dispatch(customer, 'account_suspended')
    return _ok({'status': customer.status.value})


@subscriber_bp.route('/<int:customer_id>/unblock', methods=['POST'])
@jwt_required()
def unblock_subscriber(customer_id):
    """Restore access after a block. No days are handed back — none were banked."""
    customer, user, error = _load(customer_id)
    if error:
        return error

    customer.status = CustomerStatus.ACTIVE
    isp = _isp_of(customer)
    if isp:
        try:
            provision_customer_radius(customer, customer.service_plan, isp)
        except Exception as exc:
            return _fail(f'Could not restore RADIUS access: {exc}', 502)

    events.record(customer, 'unblocked', 'Subscriber unblocked',
                  detail='Access restored by operator', actor=user)
    db.session.commit()
    _dispatch(customer, 'account_reactivated')
    return _ok({'status': customer.status.value})


@subscriber_bp.route('/<int:customer_id>/fup-override', methods=['POST'])
@jwt_required()
def fup_override(customer_id):
    """Set how fair use is applied to this one account.

    inherit    — no override; the package policy applies
    exempt     — never throttle this account
    throttle   — rate-limit past the cap even where the plan would not
    disconnect — drop the session past the cap instead of slowing it

    The window matters: an override with no end quietly becomes policy, and one
    the scheduler ignores is a button that lies. services.fup_enforcement reads
    both, so what this writes is what actually happens on the router.
    """
    customer, user, error = _load(customer_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    mode = (data.get('mode') or '').strip().lower()
    if mode not in OVERRIDE_MODES:
        return _fail(f"mode must be one of {', '.join(OVERRIDE_MODES)}")

    reason = (data.get('reason') or '').strip()[:500] or None
    previous = (customer.fup_override_mode or 'inherit')

    until = None
    if mode != 'inherit':
        raw_days = data.get('days')
        if raw_days not in (None, '', 0, '0'):
            try:
                days = max(1, min(365, int(raw_days)))
            except (TypeError, ValueError):
                return _fail('Override duration must be a whole number of days')
            until = datetime.utcnow() + timedelta(days=days)

    customer.fup_override_mode = None if mode == 'inherit' else mode
    customer.fup_override_reason = reason
    customer.fup_override_until = until

    isp = _isp_of(customer)
    # Apply the decision now rather than leaving it for the next scheduler pass —
    # an operator who exempts someone expects their speed back immediately.
    if isp and customer.status == CustomerStatus.ACTIVE:
        try:
            if mode == 'exempt' and customer.fup_throttled:
                provision_customer_radius(customer, customer.service_plan, isp, throttle=False)
                customer.fup_throttled = False
            elif mode == 'throttle' and not customer.fup_throttled:
                provision_customer_radius(customer, customer.service_plan, isp, throttle=True)
                customer.fup_throttled = True
        except Exception as exc:
            return _fail(f'Could not apply the override on RADIUS: {exc}', 502)

    window = f" until {until.strftime('%d %b %Y')}" if until else ' with no end date'
    events.record(
        customer,
        'fup_released' if mode in ('inherit', 'exempt') else 'fup_throttled',
        f'Fair use override: {mode}',
        detail=(reason or f'Override set to {mode}{window}'),
        from_value=previous, to_value=mode, actor=user,
    )
    db.session.commit()
    return _ok({'fup': insights.fup_snapshot(customer)})


@subscriber_bp.route('/<int:customer_id>/compensate', methods=['POST'])
@jwt_required()
def compensate(customer_id):
    """Give service time back after an outage or a service failure."""
    customer, user, error = _load(customer_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}

    # Minutes is the unit on the wire. An outage worth compensating is often
    # measured in minutes, and expressing that as a fraction of a day (0.0035)
    # is how rounding errors get into someone's expiry date.
    raw_minutes = data.get('minutes')
    if raw_minutes is None and data.get('days') is not None:
        try:
            raw_minutes = float(data['days']) * 1440
        except (TypeError, ValueError):
            return _fail('Duration must be a number')
    try:
        minutes = int(round(float(raw_minutes or 0)))
    except (TypeError, ValueError):
        return _fail('Duration must be a number')

    if minutes <= 0:
        return _fail('Compensation needs a positive duration')
    if minutes > 365 * 1440:
        return _fail('That is more than a year — set the expiry directly instead')

    days = minutes / 1440
    reason = (data.get('reason') or '').strip() or 'Service compensation'
    now = datetime.utcnow()
    before = customer.subscription_end
    base = before if (before and before > now) else now
    customer.subscription_end = base + timedelta(minutes=minutes)

    isp = _isp_of(customer)
    if isp and customer.status == CustomerStatus.ACTIVE:
        try:
            provision_customer_radius(customer, customer.service_plan, isp,
                                      throttle=bool(customer.fup_throttled))
        except Exception as exc:
            record_system_log('radius', f'Compensation re-provision failed for '
                              f'{customer.id}: {exc}', level='WARNING')

    events.record(
        customer, 'compensated', 'Service compensated',
        detail=f'{_humanise_minutes(minutes)} added — {reason}',
        from_value=before.isoformat() if before else None,
        to_value=customer.subscription_end.isoformat(), actor=user,
    )
    db.session.commit()

    if data.get('notify'):
        _dispatch(customer, 'expiry_date_changed')

    return _ok({
        'minutes': minutes,
        'days': round(days, 4),
        'label': _humanise_minutes(minutes),
        'subscription': insights.subscription_state(customer),
    })


def _humanise_minutes(minutes):
    """'3 minutes', '2 hours', '5 days' — whichever unit the number is really in."""
    if minutes % 1440 == 0:
        value, unit = minutes // 1440, 'day'
    elif minutes % 60 == 0:
        value, unit = minutes // 60, 'hour'
    else:
        value, unit = minutes, 'minute'
    return f'{value} {unit}{"" if value == 1 else "s"}'
