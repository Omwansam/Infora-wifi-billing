"""What counts as an *online* subscriber — one definition, used everywhere.

RADIUS accounting is the record of truth: the NAS sends Accounting-Start when a
session comes up, Interim-Updates while it lives (``interim-update=5m``, set on
both ``/ppp aaa`` and the hotspot profile), and Accounting-Stop when it ends.

Two things make a naive ``acctstoptime IS NULL`` query wrong:

* **Sessions that never stopped.** If a router loses power or its tunnel drops
  mid-session, no Accounting-Stop is ever sent and the row stays open forever.
  Counting it as online means a subscriber who left months ago is still shown
  connected. A live session refreshes ``acctupdatetime`` every interim, so a row
  that has gone quiet for several intervals is stale, not online.

* **Unattributed rows.** FreeRADIUS knows the username, not our customer id.
  Rows written before the accounting query learned to resolve ``customer_id``
  (and any written while a subscriber did not yet exist) have NULL there, and
  every ISP-scoped query in the app filters on ``isp_id`` — so those sessions are
  invisible. :func:`link_unattributed_sessions` repairs them by username.
"""
import os
from datetime import datetime, timedelta

from sqlalchemy import func, or_

from extensions import db
from models import Customer, RadAcct


def stale_after_minutes():
    """Minutes without an interim update before a session is presumed dead.

    Three missed 5-minute interims by default — long enough to ride out a brief
    tunnel blip, short enough that a powered-off router stops showing phantom
    users within the quarter hour.
    """
    try:
        return max(1, int(os.getenv('RADIUS_SESSION_STALE_MINUTES', '15')))
    except (TypeError, ValueError):
        return 15


def online_cutoff(now=None):
    return (now or datetime.now()) - timedelta(minutes=stale_after_minutes())


def online_filter(now=None):
    """SQLAlchemy criterion selecting genuinely-live radacct rows.

    Falls back to ``acctstarttime`` when ``acctupdatetime`` is NULL so a session
    that has not reached its first interim yet still counts.
    """
    cutoff = online_cutoff(now)
    return db.and_(
        RadAcct.acctstoptime.is_(None),
        or_(
            RadAcct.acctupdatetime >= cutoff,
            db.and_(RadAcct.acctupdatetime.is_(None), RadAcct.acctstarttime >= cutoff),
        ),
    )


def online_sessions_query(isp_id=None, now=None):
    """Base query over live sessions, optionally scoped to one ISP."""
    query = RadAcct.query.filter(online_filter(now))
    if isp_id:
        query = query.filter(RadAcct.isp_id == isp_id)
    return query


def online_customer_ids(isp_id=None, now=None):
    """Customer ids with at least one live session."""
    rows = (
        online_sessions_query(isp_id, now)
        .filter(RadAcct.customer_id.isnot(None))
        .with_entities(RadAcct.customer_id)
        .distinct()
        .all()
    )
    return {row[0] for row in rows}


def link_unattributed_sessions(limit=500):
    """Attach customer_id / isp_id to accounting rows that lack them.

    Matches on the same rule as ``radius_username``: the operator-set
    ``radius_login`` when present, else the email. Cheap — it only ever looks at
    rows where ``customer_id IS NULL`` — so it is safe to call on a read path.

    Returns the number of rows linked.
    """
    pending = (
        RadAcct.query
        .filter(RadAcct.customer_id.is_(None), RadAcct.username.isnot(None))
        .limit(limit)
        .all()
    )
    if not pending:
        return 0

    wanted = {(row.username or '').strip().lower() for row in pending}
    wanted.discard('')
    if not wanted:
        return 0

    customers = Customer.query.filter(
        func.lower(func.coalesce(Customer.radius_login, Customer.email)).in_(wanted)
    ).all()
    by_login = {
        (c.radius_login or c.email or '').strip().lower(): c
        for c in customers
        if (c.radius_login or c.email)
    }

    linked = 0
    for row in pending:
        customer = by_login.get((row.username or '').strip().lower())
        if not customer:
            continue
        row.customer_id = customer.id
        if row.isp_id is None:
            row.isp_id = customer.isp_id
        linked += 1

    if linked:
        db.session.commit()
    return linked


def close_stale_sessions(now=None):
    """Close sessions the NAS never sent an Accounting-Stop for.

    Keeps history honest: without this a router that lost power leaves rows open
    forever, and any later report over "sessions in period" counts them as
    running. The stop time is the last interim we actually heard, not now, so
    session duration stays truthful.

    Returns the number of rows closed.
    """
    cutoff = online_cutoff(now)
    stale = RadAcct.query.filter(
        RadAcct.acctstoptime.is_(None),
        or_(
            RadAcct.acctupdatetime < cutoff,
            db.and_(RadAcct.acctupdatetime.is_(None), RadAcct.acctstarttime < cutoff),
        ),
    ).all()

    for row in stale:
        row.acctstoptime = row.acctupdatetime or row.acctstarttime
        if not row.acctterminatecause:
            row.acctterminatecause = 'Interim-Update-Timeout'
    if stale:
        db.session.commit()
    return len(stale)


def refresh_session_attribution():
    """Housekeeping to run before reading online counts. Returns (linked, closed)."""
    linked = link_unattributed_sessions()
    return linked, 0
