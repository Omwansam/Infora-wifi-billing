"""Subscriber segments — the queues an operator actually works through.

The list page filters by what a subscriber *is*: PPPoE or hotspot, connected or
offline. The working day is organised by what a subscriber *needs* — who is about
to lapse, who has never paid, who has been dark for two days, whose line keeps
dropping. Those questions were answerable from data already stored and had no
route to the screen, so they were answered by scrolling.

Each segment is one SQL filter over `customers`, plus at most one bulk lookup.
Deliberately not per-subscriber calls: `subscriber_insights` is built for one
account at a time and running it across a fleet would be one query per row.

Adding a segment means adding a row to SEGMENTS and a branch in `apply_segment`.
Nothing else needs to know about it -- the API takes the key verbatim and the
list page renders whatever the catalogue endpoint returns.
"""
from datetime import datetime, timedelta

from sqlalchemy import func, or_

from extensions import db
from models import Customer, CustomerStatus, Payment, PaymentStatus, RadAcct

# Ordered by how often an operator opens them, because the UI renders them in
# this order and the first two are the morning's work.
SEGMENTS = [
    {
        'key': 'expiring',
        'label': 'Expiring soon',
        'description': 'Subscription ends within 7 days and has not lapsed yet',
        'tone': 'warning',
    },
    {
        'key': 'expired',
        'label': 'Lapsed',
        'description': 'Past the expiry date and the grace period',
        'tone': 'critical',
    },
    {
        'key': 'never_paid',
        'label': 'Never paid',
        'description': 'No completed payment has ever been recorded',
        'tone': 'critical',
    },
    {
        'key': 'dark',
        'label': 'Dark 48h+',
        'description': 'Active subscription but no RADIUS session for two days',
        'tone': 'warning',
    },
    {
        'key': 'throttled',
        'label': 'Over fair use',
        'description': 'Currently throttled by the FUP',
        'tone': 'info',
    },
    {
        'key': 'unstable',
        'label': 'Unstable line',
        'description': 'Five or more sessions in the last 24 hours',
        'tone': 'critical',
    },
]


def catalogue():
    return [dict(segment) for segment in SEGMENTS]


def _logins_with_recent_session(since):
    """Lowercased RADIUS logins seen since `since`. One query, not one per row."""
    rows = (
        db.session.query(func.lower(RadAcct.username))
        .filter(RadAcct.acctstarttime >= since)
        .distinct()
        .all()
    )
    return {row[0] for row in rows if row[0]}


def _logins_flapping(since, threshold=5):
    """Logins whose session count since `since` looks like a fault, not usage."""
    rows = (
        db.session.query(func.lower(RadAcct.username), func.count(RadAcct.radacctid))
        .filter(RadAcct.acctstarttime >= since)
        .group_by(func.lower(RadAcct.username))
        .having(func.count(RadAcct.radacctid) >= threshold)
        .all()
    )
    return {row[0] for row in rows if row[0]}


def _session_now():
    """The clock radacct is written on -- local, not UTC. See `apply_segment`."""
    return datetime.now()


def _customer_login_column():
    """The login a radacct row would carry. Mirrors `radius_username`."""
    return func.lower(func.coalesce(Customer.radius_login, Customer.email, ''))


def apply_segment(query, segment, now=None):
    """Narrow a Customer query to one segment. Unknown keys pass through.

    Returns the query unchanged for 'all' or an unrecognised key rather than
    raising: a stale bookmark should show the full list, not an error page.

    **Two clocks.** `subscription_end` is written with `utcnow()` by plan_utils,
    while radacct carries whatever local time FreeRADIUS was running on. They are
    the same today only because the container happens to run UTC -- set
    TZ=Africa/Nairobi and every session window below would silently shift three
    hours. So expiry comparisons take `now` (UTC) and session windows take
    `_session_now()`, and neither borrows the other's clock.
    """
    if not segment or segment == 'all':
        return query
    now = now or datetime.utcnow()

    if segment == 'expiring':
        return query.filter(
            Customer.subscription_end.isnot(None),
            Customer.subscription_end >= now,
            Customer.subscription_end <= now + timedelta(days=7),
        )

    if segment == 'expired':
        # Grace is per-subscriber, so it has to be part of the comparison rather
        # than a fixed offset -- a tenant that grants 5 days would otherwise see
        # subscribers listed as lapsed while they still have service.
        grace = func.coalesce(Customer.grace_period_days, 0)
        return query.filter(
            Customer.subscription_end.isnot(None),
            Customer.subscription_end < now - grace * timedelta(days=1),
        )

    if segment == 'never_paid':
        paid = (
            db.session.query(Payment.customer_id)
            .filter(Payment.payment_status == PaymentStatus.COMPLETED)
            .distinct()
        )
        return query.filter(~Customer.id.in_(paid))

    if segment == 'dark':
        seen = _logins_with_recent_session(_session_now() - timedelta(hours=48))
        # An empty set would make `notin_` match everything, which is correct
        # here: nobody has connected in two days, so everyone is dark.
        return query.filter(
            Customer.status == CustomerStatus.ACTIVE,
            _customer_login_column().notin_(seen) if seen else True,
        )

    if segment == 'throttled':
        return query.filter(Customer.fup_throttled.is_(True))

    if segment == 'unstable':
        flapping = _logins_flapping(_session_now() - timedelta(hours=24))
        if not flapping:
            # No match must return nothing, not everything.
            return query.filter(db.false())
        return query.filter(_customer_login_column().in_(flapping))

    return query


def counts(base_query, now=None):
    """How many subscribers sit in each segment, for the filter chips.

    Counted off the caller's already-scoped query so tenant scoping and any
    active search are respected -- a chip that ignores the current filter sends
    the operator somewhere they did not ask to go.
    """
    now = now or datetime.utcnow()
    out = {}
    for segment in SEGMENTS:
        try:
            out[segment['key']] = apply_segment(base_query, segment['key'], now).count()
        except Exception:  # noqa: BLE001 - a broken segment must not blank the page
            out[segment['key']] = None
    return out
