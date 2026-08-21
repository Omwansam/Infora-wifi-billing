"""The revenue digest — what an operator would otherwise log in to check.

Builds from the same tables the Overview page reads, so the numbers in an
email and the numbers on screen cannot disagree. Sending goes through
``services.mailer``, which means a tenant with their own SMTP gets a digest
from their own domain.

:func:`due_isps` is the scheduler's half. It is driven by
``sales_digest_last_sent_at`` rather than by a cron expression per tenant, so a
missed run catches up on the next tick instead of silently skipping a day.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal

from extensions import db
from models import Customer, CustomerStatus, ISP, Payment, PaymentStatus, Ticket

logger = logging.getLogger(__name__)

FREQUENCY_HOURS = {'daily': 24, 'weekly': 24 * 7}


def recipients(isp):
    raw = (isp.sales_digest_recipients or '').replace(';', ',')
    return [e.strip() for e in raw.split(',') if e.strip() and '@' in e]


def _window(isp, now=None):
    now = now or datetime.utcnow()
    hours = FREQUENCY_HOURS.get((isp.sales_digest_frequency or 'daily').lower(), 24)
    return now - timedelta(hours=hours), now, hours


def build(isp, now=None):
    """Gather the figures. Pure read — safe to call for a preview."""
    since, until, hours = _window(isp, now)
    period = 'week' if hours > 24 else 'day'

    paid = (db.session.query(db.func.coalesce(db.func.sum(Payment.amount), 0))
            .join(Customer, Payment.customer_id == Customer.id)
            .filter(Customer.isp_id == isp.id)
            .filter(Payment.payment_status == PaymentStatus.COMPLETED)
            .filter(Payment.payment_date >= since)
            .scalar()) or Decimal('0')

    count = (db.session.query(db.func.count(Payment.id))
             .join(Customer, Payment.customer_id == Customer.id)
             .filter(Customer.isp_id == isp.id)
             .filter(Payment.payment_status == PaymentStatus.COMPLETED)
             .filter(Payment.payment_date >= since)
             .scalar()) or 0

    joined = (db.session.query(db.func.count(Customer.id))
              .filter(Customer.isp_id == isp.id)
              .filter(Customer.join_date >= since)
              .scalar()) or 0

    active = (db.session.query(db.func.count(Customer.id))
              .filter(Customer.isp_id == isp.id)
              .filter(Customer.status == CustomerStatus.ACTIVE)
              .scalar()) or 0

    expiring = (db.session.query(db.func.count(Customer.id))
                .filter(Customer.isp_id == isp.id)
                .filter(Customer.subscription_end.isnot(None))
                .filter(Customer.subscription_end >= until)
                .filter(Customer.subscription_end <= until + timedelta(days=3))
                .scalar()) or 0

    expired = (db.session.query(db.func.count(Customer.id))
               .filter(Customer.isp_id == isp.id)
               .filter(Customer.subscription_end.isnot(None))
               .filter(Customer.subscription_end < until)
               .scalar()) or 0

    open_tickets = (db.session.query(db.func.count(Ticket.id))
                    .join(Customer, Ticket.customer_id == Customer.id)
                    .filter(Customer.isp_id == isp.id)
                    .filter(Ticket.ticket_status.isnot(None))
                    .scalar()) or 0

    return {
        'period': period, 'since': since, 'until': until,
        'currency': isp.currency or 'KES',
        'collected': Decimal(str(paid)), 'payments': int(count),
        'joined': int(joined), 'active': int(active),
        'expiring_soon': int(expiring), 'expired': int(expired),
        'open_tickets': int(open_tickets),
    }


def render(isp, data):
    """Plain text, because a digest is read on a phone at 6am."""
    brand = isp.name or isp.company_name or 'Your network'
    cur = data['currency']
    lines = [
        f"{brand} — {data['period']} summary",
        f"{data['since']:%d %b %H:%M} to {data['until']:%d %b %H:%M} UTC",
        '',
        f"Collected        {cur} {data['collected']:,.2f} across {data['payments']} payment(s)",
        f"New subscribers  {data['joined']}",
        f"Active           {data['active']}",
        '',
        f"Expiring in 3d   {data['expiring_soon']}",
        f"Already expired  {data['expired']}",
        f"Open tickets     {data['open_tickets']}",
    ]
    if data['expired']:
        lines += ['', f"{data['expired']} subscriber(s) are past expiry — chasing those is "
                      f"usually the fastest money on this list."]
    return '\n'.join(lines)


def send(isp, now=None, force=False):
    """Build and email the digest. Returns ``(sent_count, reason)``."""
    if not force and not isp.sales_digest_enabled:
        return 0, 'Digest is switched off'

    people = recipients(isp)
    if not people:
        return 0, 'No recipients set'

    data = build(isp, now)
    body = render(isp, data)
    subject = f"{isp.name or 'Your network'} — {data['period']} summary"

    from services.mailer import send_email

    sent = 0
    for address in people:
        if send_email(address, subject, body, isp=isp,
                      sender_name=isp.name or isp.company_name):
            sent += 1

    isp.sales_digest_last_sent_at = now or datetime.utcnow()
    db.session.commit()
    logger.info('Sales digest for isp=%s sent to %s/%s recipients', isp.id, sent, len(people))
    return sent, f'Sent to {sent} of {len(people)} recipient(s)'


def due_isps(now=None):
    """Tenants whose digest window has elapsed.

    Driven by last-sent rather than a cron expression, so a run missed while
    the box was down catches up on the next tick instead of skipping silently.
    """
    now = now or datetime.utcnow()
    due = []
    for isp in ISP.query.filter_by(sales_digest_enabled=True).all():
        hours = FREQUENCY_HOURS.get((isp.sales_digest_frequency or 'daily').lower(), 24)
        last = isp.sales_digest_last_sent_at
        if last is None or (now - last) >= timedelta(hours=hours):
            due.append(isp)
    return due


def run_due(now=None):
    """Scheduler entry point. Sends every digest that is due."""
    total = 0
    for isp in due_isps(now):
        try:
            sent, _ = send(isp, now)
            total += sent
        except Exception as exc:  # one tenant's bad SMTP must not stop the rest
            logger.error('Sales digest failed for isp=%s: %s', isp.id, exc)
            db.session.rollback()
    return total
