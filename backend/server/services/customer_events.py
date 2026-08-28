"""Append-only account history for the subscriber detail page.

Two tabs — "Subscription lifecycle" and "Package history" — can only be
answered from a written record, and nothing in the app wrote one. Every call
site that changes a subscriber's plan, expiry, status or credentials goes
through `record()` so the timeline is a by-product of the change rather than
something reconstructed afterwards from mutable columns.

`record()` never raises. History is a side effect of the operator's real
action; a failure to log must not roll back the connect, the payment, or the
plan change that actually mattered.
"""

from datetime import datetime, timedelta

from extensions import db
from models import CustomerEvent

# The subset of event types that describe *which package* the account was on.
# The Package history tab is exactly this filter over the same table, which is
# why there is no second model for it.
PACKAGE_EVENT_TYPES = ('created', 'plan_changed', 'expiry_changed', 'compensated')

# What the UI paints each kind as. Kept here rather than in the frontend so a
# new event type shows up correctly without a matching frontend release.
_TONE = {
    'created': 'neutral',
    'plan_changed': 'info',
    'expiry_changed': 'info',
    'payment': 'good',
    'connected': 'good',
    'activated': 'good',
    'unblocked': 'good',
    'fup_released': 'good',
    'compensated': 'good',
    'invoice': 'info',
    'note': 'neutral',
    'sms': 'neutral',
    'kyc': 'info',
    'password_reset': 'warning',
    'fup_throttled': 'warning',
    'disconnected': 'warning',
    'suspended': 'warning',
    'blocked': 'critical',
}


def _actor_name(user):
    """How the operator is credited on the timeline. `User` has no username."""
    if user is None:
        return None
    name = ' '.join(part for part in (getattr(user, 'first_name', None),
                                      getattr(user, 'last_name', None)) if part).strip()
    return (name or getattr(user, 'email', None) or None)


def record(customer, event_type, title, detail=None, from_value=None,
           to_value=None, amount=None, actor=None, commit=False):
    """Append one event. Returns the row, or None if it could not be written."""
    if customer is None:
        return None
    try:
        event = CustomerEvent(
            customer_id=customer.id,
            isp_id=getattr(customer, 'isp_id', None),
            event_type=event_type,
            title=title[:160],
            detail=detail,
            from_value=str(from_value)[:160] if from_value is not None else None,
            to_value=str(to_value)[:160] if to_value is not None else None,
            amount=amount,
            actor_user_id=getattr(actor, 'id', None),
            actor_name=_actor_name(actor),
            created_at=datetime.utcnow(),
        )
        db.session.add(event)
        if commit:
            db.session.commit()
        return event
    except Exception:
        # Never let bookkeeping break the operation it was describing.
        db.session.rollback()
        return None


def serialize(event):
    return {
        'id': event.id,
        'type': event.event_type,
        'tone': _TONE.get(event.event_type, 'neutral'),
        'title': event.title,
        'detail': event.detail,
        'from_value': event.from_value,
        'to_value': event.to_value,
        'amount': float(event.amount) if event.amount is not None else None,
        'actor': event.actor_name,
        'created_at': event.created_at.isoformat() if event.created_at else None,
    }


def timeline(customer, limit=50, types=None):
    """Newest-first events, with a synthetic "Account created" at the tail.

    Accounts that predate this table have no rows at all, and a lifecycle panel
    that renders empty for every existing subscriber is worse than useless — so
    the one event every account provably has is derived from `join_date` when
    it was never recorded.
    """
    query = CustomerEvent.query.filter_by(customer_id=customer.id)
    if types:
        query = query.filter(CustomerEvent.event_type.in_(types))
    rows = query.order_by(CustomerEvent.created_at.desc(), CustomerEvent.id.desc()) \
                .limit(limit).all()
    events = [serialize(row) for row in rows]

    has_created = any(event['type'] == 'created' for event in events)
    if not has_created and (types is None or 'created' in types):
        joined = customer.join_date or customer.created_at
        events.append({
            'id': None,
            'type': 'created',
            'tone': 'neutral',
            'title': 'Account created',
            'detail': 'Joined the network',
            'from_value': None,
            'to_value': None,
            'amount': None,
            'actor': None,
            'created_at': joined.isoformat() if joined else None,
        })
    return events


def package_history(customer, limit=50):
    """Only the events that changed what the subscriber is paying for."""
    return timeline(customer, limit=limit, types=PACKAGE_EVENT_TYPES)


def count(customer, types=None):
    query = CustomerEvent.query.filter_by(customer_id=customer.id)
    if types:
        query = query.filter(CustomerEvent.event_type.in_(types))
    total = query.count()
    if types is None or 'created' in types:
        has_created = CustomerEvent.query.filter_by(
            customer_id=customer.id, event_type='created'
        ).first() is not None
        if not has_created:
            total += 1  # the synthetic one `timeline()` appends
    return total


def backfill_created(customer, commit=False):
    """Write the 'created' event for an account, once.

    Idempotent on purpose: an account is created once, but the call sites that
    would write this (create_customer, a retried import, a backfill pass) can
    all run more than once, and a timeline with two birthdays on it is wrong.
    """
    if customer is None or customer.id is None:
        return None
    existing = CustomerEvent.query.filter_by(
        customer_id=customer.id, event_type='created'
    ).first()
    if existing:
        return existing
    return record(
        customer, 'created', 'Account created',
        detail='Joined the network', commit=commit,
    )


def expiry_window(customer):
    """(expiry, cut_off) — when the plan ends and when access actually stops."""
    end = customer.subscription_end
    if not end:
        return None, None
    grace = customer.grace_period_days or 0
    return end, end + timedelta(days=grace)
