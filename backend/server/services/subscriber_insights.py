"""Everything the subscriber detail page shows, derived from real records.

The page asks five kinds of question, and each has exactly one source of truth:

* **Was the line up, and how much moved?**  ``radacct``. Never the
  ``customers.usage_percentage`` column — that is a hint the UI used to trust
  and nothing keeps it current.
* **What was paid?**  ``payments`` (completed only).
* **What happened to the account?**  ``customer_events``.
* **What did we say to them?**  ``notifications``.
* **What is the plan allowed to do?**  ``service_plans`` via ``plan_utils``.

Bucketing note — the one honest approximation here. RADIUS accounting keeps a
*single row per session*, updated in place every interim; the octet counters are
cumulative and there is no per-interval sample anywhere. So a session's bytes
cannot be resolved to the hour it actually flowed in. Every time-bucketed figure
below therefore spreads a session's bytes **uniformly across the wall-clock time
it covers** inside the window. For a 4-hour evening session that is close to
right; for one that idles all day and streams for ten minutes it is not. It is
stated in the payload as ``"approximate": true`` so the UI can say so rather
than implying a precision the data does not have.
"""

from datetime import datetime, timedelta

from sqlalchemy import func, or_

from extensions import db
from models import (
    Customer, CustomerDevice, CustomerNote, Invoice, Notification, Payment,
    PaymentStatus, RadAcct, Ticket,
)
from services.customer_events import PACKAGE_EVENT_TYPES
from services.fup_monitoring import (
    compute_fup_status, customer_is_fup_monitored, fup_period_start,
    get_fup_threshold_bytes,
)
from services.plan_utils import (
    extract_package_policy, format_plan_data_cap_display, get_plan_speed_mbps,
)
from services.radius_provisioning import radius_username
from services.session_tracking import online_cutoff

GB = 1024 ** 3

# Two clocks, deliberately. `radacct` timestamps are written by FreeRADIUS in the
# server's local time — services.session_tracking already compares them against
# datetime.now(), and mixing in utcnow() there would make every session look
# hours stale in any non-UTC deployment. The subscription columns are the other
# way round: plan_utils.plan_subscription_end writes them with utcnow(), so
# expiry maths must use utcnow() too. Nothing here may compare across the two.


# ---------------------------------------------------------------------------
# Accounting access
# ---------------------------------------------------------------------------

def acct_query(customer):
    """Every accounting row belonging to this subscriber.

    Matched on customer_id *or* the RADIUS login, because attribution lags:
    FreeRADIUS writes the username and a background pass fills the id in later
    (see session_tracking.link_unattributed_sessions). Filtering on the id alone
    silently drops a subscriber's most recent sessions — exactly the ones the
    page is about.
    """
    login = (radius_username(customer) or '').lower()
    criteria = [RadAcct.customer_id == customer.id]
    if login:
        criteria.append(func.lower(RadAcct.username) == login)
    return RadAcct.query.filter(or_(*criteria))


def _session_bytes(row):
    return int(row.acctinputoctets or 0) + int(row.acctoutputoctets or 0)


def _session_end(row, now):
    """When the session stopped, or 'now' while it is still open."""
    return row.acctstoptime or min(now, row.acctupdatetime or now)


def _spread(rows, window_start, window_end, bucket_of, now, granularity='day'):
    """Distribute each session's bytes over the buckets its lifetime touches.

    ``bucket_of(moment) -> key``, ``granularity`` is 'hour' or 'day'. Returns
    ``{key: [down_bytes, up_bytes, seconds]}``. See the module docstring for why
    this is a spread and not a lookup.
    """
    buckets = {}
    for row in rows:
        start = row.acctstarttime
        if not start:
            continue
        end = _session_end(row, now) or start
        start = max(start, window_start)
        end = min(end, window_end)
        if end <= start:
            # A session with no measurable overlap still happened; put it whole
            # into the bucket it started in rather than dropping it.
            key = bucket_of(row.acctstarttime)
            slot = buckets.setdefault(key, [0, 0, 0])
            slot[0] += int(row.acctoutputoctets or 0)
            slot[1] += int(row.acctinputoctets or 0)
            continue

        total_seconds = (end - start).total_seconds()
        # NAS-relative: input = what the subscriber sent up, output = what they
        # pulled down. Getting these backwards is the classic radacct bug.
        down = int(row.acctoutputoctets or 0)
        up = int(row.acctinputoctets or 0)

        cursor = start
        while cursor < end:
            key = bucket_of(cursor)
            edge = _bucket_end(cursor, granularity, end)
            span = (edge - cursor).total_seconds()
            share = span / total_seconds if total_seconds else 1.0
            slot = buckets.setdefault(key, [0, 0, 0])
            slot[0] += int(down * share)
            slot[1] += int(up * share)
            slot[2] += int(span)
            cursor = edge
    return buckets


def _bucket_end(cursor, granularity, hard_end):
    """Start of the next bucket after `cursor`, clamped to the window."""
    if granularity == 'hour':
        nxt = (cursor + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    else:
        nxt = (cursor + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return min(nxt, hard_end)


def _hour_key(moment):
    return moment.strftime('%Y-%m-%dT%H')


def _day_key(moment):
    return moment.strftime('%Y-%m-%d')


# ---------------------------------------------------------------------------
# Live state
# ---------------------------------------------------------------------------

def live_snapshot(customer, now=None):
    """The 'Live from router' card: is the line up, and what is moving on it."""
    now = now or datetime.now()
    cutoff = online_cutoff(now)

    live = (
        acct_query(customer)
        .filter(RadAcct.acctstoptime.is_(None))
        .filter(or_(
            RadAcct.acctupdatetime >= cutoff,
            db.and_(RadAcct.acctupdatetime.is_(None), RadAcct.acctstarttime >= cutoff),
        ))
        .order_by(RadAcct.acctstarttime.desc())
        .first()
    )
    last = (
        acct_query(customer)
        .order_by(RadAcct.acctstarttime.desc().nullslast())
        .first()
    )

    plan = customer.service_plan
    speeds = get_plan_speed_mbps(plan) if plan else {'download_mbps': None, 'upload_mbps': None}

    session = live or None
    down = up = 0
    seconds = 0
    if session:
        down = int(session.acctoutputoctets or 0)
        up = int(session.acctinputoctets or 0)
        seconds = int(session.acctsessiontime or 0)
        if not seconds and session.acctstarttime:
            seconds = int((now - session.acctstarttime).total_seconds())

    def avg_mbps(octets):
        if not seconds or not octets:
            return 0.0
        return round((octets * 8) / seconds / 1_000_000, 2)

    last_activity = None
    if last:
        last_activity = last.acctupdatetime or last.acctstoptime or last.acctstarttime

    return {
        'online': session is not None,
        'session_id': session.acctsessionid if session else None,
        'radacct_id': session.radacctid if session else None,
        'started_at': session.acctstarttime.isoformat() if session and session.acctstarttime else None,
        'uptime_seconds': seconds,
        'ip_address': session.framedipaddress if session else None,
        'mac_address': session.callingstationid if session else None,
        'nas_ip': session.nasipaddress if session else None,
        'session_down_bytes': down,
        'session_up_bytes': up,
        'avg_down_mbps': avg_mbps(down),
        'avg_up_mbps': avg_mbps(up),
        'plan_down_mbps': speeds.get('download_mbps'),
        'plan_up_mbps': speeds.get('upload_mbps'),
        'connection_type': customer.connection_type or 'pppoe',
        'last_activity': last_activity.isoformat() if last_activity else None,
        'terminate_cause': last.acctterminatecause if last and not session else None,
    }


def last_session(customer, now=None):
    """The most recent finished-or-running session, for the KPI strip."""
    now = now or datetime.now()
    row = (
        acct_query(customer)
        .order_by(RadAcct.acctstarttime.desc().nullslast())
        .first()
    )
    if not row:
        return None
    return {
        'started_at': row.acctstarttime.isoformat() if row.acctstarttime else None,
        'ended_at': row.acctstoptime.isoformat() if row.acctstoptime else None,
        'duration_seconds': int(row.acctsessiontime or 0),
        'down_bytes': int(row.acctoutputoctets or 0),
        'up_bytes': int(row.acctinputoctets or 0),
        'ip_address': row.framedipaddress,
        'live': row.acctstoptime is None,
    }


# ---------------------------------------------------------------------------
# Time series
# ---------------------------------------------------------------------------

def activity_calendar(customer, days=365, now=None):
    """One cell per day: how many sessions and how much data. Heatmap fuel."""
    now = now or datetime.now()
    start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    rows = (
        acct_query(customer)
        .filter(RadAcct.acctstarttime >= start)
        .with_entities(
            RadAcct.acctstarttime, RadAcct.acctstoptime, RadAcct.acctupdatetime,
            RadAcct.acctinputoctets, RadAcct.acctoutputoctets, RadAcct.acctsessiontime,
        )
        .all()
    )

    counts = {}
    for row in rows:
        if not row.acctstarttime:
            continue
        key = _day_key(row.acctstarttime)
        counts[key] = counts.get(key, 0) + 1

    buckets = _spread(rows, start, now, _day_key, now, granularity='day')

    series = []
    active_days = 0
    cursor = start
    while cursor <= now:
        key = _day_key(cursor)
        down, up, seconds = buckets.get(key, (0, 0, 0))
        sessions = counts.get(key, 0)
        if sessions or down or up:
            active_days += 1
        series.append({
            'date': key,
            'sessions': sessions,
            'bytes': int(down) + int(up),
            'seconds': int(seconds),
        })
        cursor += timedelta(days=1)

    return {'days': series, 'active_days': active_days, 'window_days': days}


def traffic_24h(customer, now=None):
    """Hourly down/up for the last 24 hours."""
    now = now or datetime.now()
    start = (now - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)

    rows = (
        acct_query(customer)
        .filter(or_(
            RadAcct.acctstoptime.is_(None),
            RadAcct.acctstoptime >= start,
        ))
        .filter(or_(RadAcct.acctstarttime.is_(None), RadAcct.acctstarttime <= now))
        .all()
    )
    buckets = _spread(rows, start, now, _hour_key, now, granularity='hour')

    series = []
    cursor = start
    total_down = total_up = 0
    while cursor <= now:
        down, up, _seconds = buckets.get(_hour_key(cursor), (0, 0, 0))
        total_down += int(down)
        total_up += int(up)
        series.append({
            'hour': cursor.isoformat(),
            'label': cursor.strftime('%H:00'),
            'down_bytes': int(down),
            'up_bytes': int(up),
        })
        cursor += timedelta(hours=1)

    return {
        'points': series,
        'total_down_bytes': total_down,
        'total_up_bytes': total_up,
        'approximate': True,
    }


def daily_usage(customer, now=None):
    """Per-day down/up for the current calendar month, plus the shape stats."""
    now = now or datetime.now()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    rows = (
        acct_query(customer)
        .filter(or_(RadAcct.acctstoptime.is_(None), RadAcct.acctstoptime >= start))
        .all()
    )
    buckets = _spread(rows, start, now, _day_key, now, granularity='day')

    series = []
    cursor = start
    total = 0
    peak_day, peak_bytes = None, 0
    while cursor <= now:
        key = _day_key(cursor)
        down, up, _seconds = buckets.get(key, (0, 0, 0))
        day_bytes = int(down) + int(up)
        total += day_bytes
        if day_bytes > peak_bytes:
            peak_day, peak_bytes = key, day_bytes
        series.append({
            'date': key,
            'label': cursor.strftime('%-d'),
            'down_bytes': int(down),
            'up_bytes': int(up),
        })
        cursor += timedelta(days=1)

    lifetime = (
        acct_query(customer)
        .with_entities(func.coalesce(
            func.sum(func.coalesce(RadAcct.acctinputoctets, 0)
                     + func.coalesce(RadAcct.acctoutputoctets, 0)), 0
        ))
        .scalar()
    )

    day_count = max(1, len(series))
    return {
        'points': series,
        'total_bytes': total,
        'peak_day': peak_day,
        'peak_bytes': peak_bytes,
        'avg_per_day_bytes': int(total / day_count),
        'lifetime_bytes': int(lifetime or 0),
        'approximate': True,
    }


def peak_hours(customer, days=30, now=None):
    """Average bytes by hour-of-day over the trailing window (0..23)."""
    now = now or datetime.now()
    start = (now - timedelta(days=days)).replace(minute=0, second=0, microsecond=0)

    rows = (
        acct_query(customer)
        .filter(or_(RadAcct.acctstoptime.is_(None), RadAcct.acctstoptime >= start))
        .all()
    )
    buckets = _spread(rows, start, now, _hour_key, now, granularity='hour')

    totals = [0] * 24
    observed = [0] * 24
    for key, (down, up, _seconds) in buckets.items():
        hour = int(key[-2:])
        totals[hour] += int(down) + int(up)
        observed[hour] += 1

    span_days = max(1, (now - start).days)
    hours = [{
        'hour': hour,
        'label': f'{hour:02d}:00',
        'avg_bytes': int(totals[hour] / span_days),
        'total_bytes': totals[hour],
    } for hour in range(24)]

    busiest = max(hours, key=lambda h: h['total_bytes']) if any(totals) else None
    return {
        'hours': hours,
        'busiest_hour': busiest['hour'] if busiest else None,
        'has_data': any(totals),
        'window_days': days,
        'approximate': True,
    }


def payment_trend(customer, months=12, now=None):
    """Completed payments per month, split by method. Categorical, not stacked noise."""
    now = now or datetime.now()
    first = (now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
             - timedelta(days=31 * (months - 1))).replace(day=1)

    rows = (
        Payment.query
        .filter(Payment.customer_id == customer.id)
        .filter(Payment.payment_status == PaymentStatus.COMPLETED)
        .filter(Payment.payment_date >= first)
        .with_entities(Payment.payment_date, Payment.amount, Payment.payment_method)
        .all()
    )

    keys = []
    cursor = first
    while len(keys) < months:
        keys.append(cursor.strftime('%Y-%m'))
        cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)

    by_month = {key: {} for key in keys}
    methods = set()
    for date, amount, method in rows:
        key = date.strftime('%Y-%m')
        if key not in by_month:
            continue
        method = (method or 'other').lower()
        methods.add(method)
        by_month[key][method] = by_month[key].get(method, 0) + float(amount or 0)

    ordered_methods = sorted(methods)
    points = []
    for key in keys:
        label = datetime.strptime(key, '%Y-%m').strftime('%b')
        totals = by_month[key]
        points.append({
            'month': key,
            'label': label,
            'total': round(sum(totals.values()), 2),
            'by_method': {method: round(totals.get(method, 0), 2) for method in ordered_methods},
        })

    lifetime, last_payment = _payment_totals(customer)
    active_months = sum(1 for point in points if point['total'] > 0)
    return {
        'points': points,
        'methods': ordered_methods,
        'lifetime': lifetime,
        'avg_per_month': round(lifetime / months, 2) if months else 0,
        'active_months': active_months,
        'window_months': months,
        'last_payment': last_payment,
    }


def _payment_totals(customer, now=None):
    now = now or datetime.now()
    lifetime = (
        Payment.query
        .filter(Payment.customer_id == customer.id,
                Payment.payment_status == PaymentStatus.COMPLETED)
        .with_entities(func.coalesce(func.sum(Payment.amount), 0))
        .scalar()
    )
    latest = (
        Payment.query
        .filter(Payment.customer_id == customer.id,
                Payment.payment_status == PaymentStatus.COMPLETED)
        .order_by(Payment.payment_date.desc())
        .first()
    )
    last_payment = None
    if latest:
        last_payment = {
            'amount': float(latest.amount or 0),
            'method': latest.payment_method,
            'date': latest.payment_date.isoformat() if latest.payment_date else None,
            'reference': latest.mpesa_receipt_number or latest.transaction_id,
        }
    return float(lifetime or 0), last_payment


def month_to_date_revenue(customer, now=None):
    now = now or datetime.now()
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = (
        Payment.query
        .filter(Payment.customer_id == customer.id,
                Payment.payment_status == PaymentStatus.COMPLETED,
                Payment.payment_date >= start)
        .with_entities(func.coalesce(func.sum(Payment.amount), 0))
        .scalar()
    )
    return float(total or 0)


# ---------------------------------------------------------------------------
# Fair use
# ---------------------------------------------------------------------------

def fup_snapshot(customer, now=None):
    """Usage against the plan's FUP threshold for the current reset period."""
    now = now or datetime.now()
    plan = customer.service_plan
    policy = extract_package_policy(plan) if plan else {}
    period_start = fup_period_start(policy.get('fup_reset_cycle') or 'monthly', now)

    totals = (
        acct_query(customer)
        .filter(or_(RadAcct.acctstoptime.is_(None), RadAcct.acctstoptime >= period_start))
        .with_entities(
            func.coalesce(func.sum(func.coalesce(RadAcct.acctoutputoctets, 0)), 0),
            func.coalesce(func.sum(func.coalesce(RadAcct.acctinputoctets, 0)), 0),
        )
        .first()
    )
    down = int(totals[0] or 0)
    up = int(totals[1] or 0)
    used = down + up

    threshold = get_fup_threshold_bytes(plan) if plan else None
    monitored = customer_is_fup_monitored(plan) if plan else False
    state, pct = compute_fup_status(used, threshold, bool(policy.get('fup_enabled')))

    # An expired override is no override — enforcement has already resumed, so
    # reporting one would make the dialog open on a window that is not there.
    from services.fup_enforcement import active_override_mode
    mode = active_override_mode(customer)
    override_until = customer.fup_override_until if mode != 'inherit' else None

    return {
        'monitored': monitored,
        'enabled': bool(policy.get('fup_enabled')),
        'state': state,
        'percent': pct,
        'used_bytes': used,
        'down_bytes': down,
        'up_bytes': up,
        'threshold_bytes': threshold,
        'cap_display': format_plan_data_cap_display(plan) if plan else 'Unlimited',
        'throttled': bool(customer.fup_throttled),
        'throttled_speed': policy.get('fup_throttled_speed'),
        'reset_cycle': policy.get('fup_reset_cycle') or 'monthly',
        'period_start': period_start.isoformat(),
        # The operator override in force. The menu label and the dialog both
        # open on this, so it must reflect what enforcement will actually do.
        'override_mode': mode,
        'override_reason': customer.fup_override_reason,
        'override_until': override_until.isoformat() if override_until else None,
    }


# ---------------------------------------------------------------------------
# Counts for the tab bar
# ---------------------------------------------------------------------------

def tab_counts(customer):
    """One number per tab. The bar is a map of the account, so they must be real."""
    from services.customer_events import count as event_count

    sessions = acct_query(customer).count()
    payments = Payment.query.filter_by(customer_id=customer.id).count()
    tickets = Ticket.query.filter_by(customer_id=customer.id).count()
    notes = CustomerNote.query.filter_by(customer_id=customer.id).count()
    messages = Notification.query.filter_by(customer_id=customer.id).count()
    devices = known_device_count(customer)

    return {
        'sessions': sessions,
        'payments': payments,
        'package_history': event_count(customer, PACKAGE_EVENT_TYPES),
        'sms': messages,
        'tickets': tickets,
        'devices': devices,
        'notes': notes,
        'invoices': Invoice.query.filter_by(customer_id=customer.id).count(),
    }


def known_device_count(customer):
    return len(devices(customer))


def devices(customer, limit=50):
    """Registered devices, plus any MAC that has actually authenticated.

    ``customer_devices`` is only ever populated by hand, so a subscriber with
    three phones on the line usually has zero rows in it. The MACs RADIUS saw
    are the devices that are really there, so they are merged in and marked as
    ``source: 'radius'`` rather than pretended to be registered.
    """
    registered = CustomerDevice.query.filter_by(customer_id=customer.id).all()
    out = []
    seen = set()
    for device in registered:
        mac = (device.device_mac_address or '').upper()
        seen.add(mac)
        out.append({
            'id': device.id,
            'source': 'registered',
            'name': device.device_name,
            'mac': device.device_mac_address,
            'ip': device.device_ip_address,
            'model': device.device_model,
            'type': device.device_type,
            'active': bool(device.is_active),
            'last_seen': device.last_seen.isoformat() if device.last_seen else None,
        })

    rows = (
        acct_query(customer)
        .filter(RadAcct.callingstationid.isnot(None))
        .filter(RadAcct.callingstationid != '')
        .with_entities(
            RadAcct.callingstationid,
            func.max(RadAcct.acctstarttime),
            func.max(RadAcct.framedipaddress),
            func.count(RadAcct.radacctid),
        )
        .group_by(RadAcct.callingstationid)
        .order_by(func.max(RadAcct.acctstarttime).desc())
        .limit(limit)
        .all()
    )
    for mac, last_seen, ip, sessions in rows:
        key = (mac or '').upper()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append({
            'id': None,
            'source': 'radius',
            'name': None,
            'mac': mac,
            'ip': ip,
            'model': None,
            'type': customer.connection_type or 'pppoe',
            'active': True,
            'sessions': sessions,
            'last_seen': last_seen.isoformat() if last_seen else None,
        })
    return out


# ---------------------------------------------------------------------------
# Subscription framing
# ---------------------------------------------------------------------------

def subscription_state(customer, now=None):
    """Days left, cut-off date, and which of the three states the account is in.

    UTC — `subscription_end` is written by plan_utils with utcnow(). Passing a
    local `now` here reads the expiry off by the UTC offset.
    """
    now = now or datetime.utcnow()
    end = customer.subscription_end
    grace = customer.grace_period_days or 0

    if not end:
        return {
            'has_expiry': False,
            'state': 'none',
            'label': 'No expiry set',
            'days_remaining': None,
            'expires_at': None,
            'cut_off_at': None,
            'grace_days': grace,
            'started_at': customer.subscription_start.isoformat() if customer.subscription_start else None,
        }

    cut_off = end + timedelta(days=grace)
    remaining = (end - now).total_seconds() / 86400
    days = int(remaining) if remaining >= 0 else -int(abs(remaining) + 0.999)

    if now <= end:
        state, label = 'active', f'{max(0, days)} day{"" if days == 1 else "s"}'
    elif now <= cut_off:
        state, label = 'grace', 'In grace'
    else:
        state, label = 'expired', 'Expired'

    return {
        'has_expiry': True,
        'state': state,
        'label': label,
        'days_remaining': days,
        'expires_at': end.isoformat(),
        'cut_off_at': cut_off.isoformat(),
        'grace_days': grace,
        'started_at': customer.subscription_start.isoformat() if customer.subscription_start else None,
    }


def wallet(customer):
    """Loyalty points, only if the tenant actually runs a scheme."""
    try:
        from models import ISP
        from services import loyalty
        isp = ISP.query.get(customer.isp_id) if customer.isp_id else None
        settings = loyalty.get_settings(isp, create=False) if isp else None
        if not settings or not getattr(settings, 'enabled', False):
            return {'enabled': False, 'points': 0, 'value': 0.0}
        points = loyalty.balance(customer.id)
        point_value = float(settings.point_value or 0)
        return {
            'enabled': True,
            'points': points,
            'value': round(points * point_value, 2) if point_value else None,
            'min_redeem': int(settings.min_redeem or 0),
        }
    except Exception:
        return {'enabled': False, 'points': 0, 'value': 0.0}
