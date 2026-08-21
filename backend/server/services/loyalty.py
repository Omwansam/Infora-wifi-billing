"""Loyalty points: earning on payment, spending against a renewal.

The balance is the sum of the ledger, never a stored counter. That costs a
little on read and buys the thing that matters: "why do I have 40 points" is
answerable, and a rule change cannot retroactively rewrite what someone already
earned.

Redemption spends the **oldest live batch first**. Points expire per batch, so
spending newest-first would let old points lapse while the subscriber holds a
balance they thought they could use — the complaint you would never trace back
to the rounding rule that caused it.

Every mutation is a row. Expiry is a row, an operator adjustment is a row, and
nothing here ever edits a past one.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP

from extensions import db
from models import LoyaltyLedger, LoyaltySettings

logger = logging.getLogger(__name__)

EARN = 'payment'
REDEEM = 'redemption'
EXPIRY = 'expiry'
ADJUST = 'adjustment'


def get_settings(isp, create=True):
    """The ISP's rules, created with defaults on first read."""
    row = LoyaltySettings.query.filter_by(isp_id=isp.id).first()
    if row is None and create:
        row = LoyaltySettings(isp_id=isp.id)
        db.session.add(row)
        db.session.commit()
    return row


def serialize_settings(row):
    return {
        'enabled': bool(row.enabled),
        'points_earned': int(row.points_earned or 0),
        'earn_per': float(row.earn_per or 0),
        'rounding': row.rounding or 'floor',
        'point_value': float(row.point_value or 0),
        'min_redeem': int(row.min_redeem or 0),
        'expiry_months': row.expiry_months,
    }


def points_for_amount(settings, amount):
    """How many points `amount` of spend earns under these rules."""
    per = Decimal(str(settings.earn_per or 0))
    if per <= 0:
        return 0
    raw = (Decimal(str(amount or 0)) / per) * Decimal(int(settings.points_earned or 0))
    mode = ROUND_HALF_UP if (settings.rounding or 'floor') == 'nearest' else ROUND_DOWN
    return int(raw.quantize(Decimal('1'), rounding=mode))


def balance(customer_id):
    """Live balance: everything earned, minus everything spent or expired."""
    total = db.session.query(db.func.coalesce(db.func.sum(LoyaltyLedger.points), 0)).filter(
        LoyaltyLedger.customer_id == customer_id,
    ).scalar()
    return int(total or 0)


def history(customer_id, limit=50):
    return (LoyaltyLedger.query
            .filter_by(customer_id=customer_id)
            .order_by(LoyaltyLedger.created_at.desc(), LoyaltyLedger.id.desc())
            .limit(limit).all())


def serialize_entry(row):
    return {
        'id': row.id,
        'points': int(row.points),
        'reason': row.reason,
        'description': row.description or '',
        'expires_at': row.expires_at.isoformat() if row.expires_at else None,
        'created_at': row.created_at.isoformat() if row.created_at else None,
    }


def award_for_payment(payment, isp=None, commit=True):
    """Credit points for a completed payment. Idempotent per payment.

    Returns the ledger row, or ``None`` when the scheme is off, the amount
    earns nothing, or this payment has already been credited.
    """
    customer = getattr(payment, 'customer', None)
    if customer is None:
        return None
    isp = isp or getattr(customer, 'isp', None)
    if isp is None:
        return None

    settings = get_settings(isp, create=False)
    if settings is None or not settings.enabled:
        return None

    # Re-running a callback must not pay twice.
    existing = LoyaltyLedger.query.filter_by(payment_id=payment.id, reason=EARN).first()
    if existing is not None:
        return None

    points = points_for_amount(settings, payment.amount)
    if points <= 0:
        return None

    expires_at = None
    if settings.expiry_months:
        expires_at = datetime.utcnow() + timedelta(days=30 * int(settings.expiry_months))

    row = LoyaltyLedger(
        isp_id=isp.id, customer_id=customer.id, points=points, reason=EARN,
        description=f'Payment of {payment.amount}',
        payment_id=payment.id, expires_at=expires_at,
    )
    db.session.add(row)
    if commit:
        db.session.commit()
    logger.info('Loyalty: +%s points to customer=%s for payment=%s',
                points, customer.id, payment.id)
    return row


def _live_batches(customer_id):
    """Unspent, unexpired earning rows, oldest first."""
    now = datetime.utcnow()
    rows = (LoyaltyLedger.query
            .filter(LoyaltyLedger.customer_id == customer_id,
                    LoyaltyLedger.points > 0,
                    LoyaltyLedger.reason.in_((EARN, ADJUST)))
            .order_by(LoyaltyLedger.created_at.asc(), LoyaltyLedger.id.asc())
            .all())
    return [r for r in rows
            if r.points > (r.consumed_points or 0)
            and (r.expires_at is None or r.expires_at > now)]


class RedemptionError(RuntimeError):
    """Why a redemption could not go through, in words a subscriber can read."""


def redeem(customer, points, isp=None, description=None, commit=True):
    """Spend `points`, oldest batch first. Returns the discount value.

    Raises :class:`RedemptionError` rather than silently redeeming less than
    asked — a partial redemption an operator did not ask for is worse than a
    refusal they can act on.
    """
    isp = isp or getattr(customer, 'isp', None)
    settings = get_settings(isp, create=False) if isp else None
    if settings is None or not settings.enabled:
        raise RedemptionError('The loyalty scheme is switched off.')

    points = int(points or 0)
    if points <= 0:
        raise RedemptionError('Enter how many points to redeem.')

    available = balance(customer.id)
    if points > available:
        raise RedemptionError(f'Only {available} points available.')
    if available < int(settings.min_redeem or 0):
        raise RedemptionError(
            f'A balance of {settings.min_redeem} points is needed before redeeming.')

    remaining = points
    for batch in _live_batches(customer.id):
        if remaining <= 0:
            break
        free = batch.points - (batch.consumed_points or 0)
        take = min(free, remaining)
        batch.consumed_points = (batch.consumed_points or 0) + take
        remaining -= take

    if remaining > 0:
        # The sum said yes but no live batch backs it — every candidate had
        # expired. Refuse rather than hand out points that are already gone.
        db.session.rollback()
        raise RedemptionError('Those points have expired.')

    value = (Decimal(str(settings.point_value or 0)) * points).quantize(Decimal('0.01'))
    row = LoyaltyLedger(
        isp_id=isp.id, customer_id=customer.id, points=-points, reason=REDEEM,
        description=description or f'Redeemed for {value}',
    )
    db.session.add(row)
    if commit:
        db.session.commit()
    logger.info('Loyalty: -%s points from customer=%s worth %s', points, customer.id, value)
    return value


def scheme_stats(isp):
    """Headline numbers for the settings panel: what the scheme has cost so far."""
    earned = db.session.query(db.func.coalesce(db.func.sum(LoyaltyLedger.points), 0)).filter(
        LoyaltyLedger.isp_id == isp.id, LoyaltyLedger.points > 0).scalar() or 0
    spent = db.session.query(db.func.coalesce(db.func.sum(LoyaltyLedger.points), 0)).filter(
        LoyaltyLedger.isp_id == isp.id, LoyaltyLedger.points < 0,
        LoyaltyLedger.reason == REDEEM).scalar() or 0
    expired = db.session.query(db.func.coalesce(db.func.sum(LoyaltyLedger.points), 0)).filter(
        LoyaltyLedger.isp_id == isp.id, LoyaltyLedger.reason == EXPIRY).scalar() or 0
    holders = db.session.query(db.func.count(db.distinct(LoyaltyLedger.customer_id))).filter(
        LoyaltyLedger.isp_id == isp.id).scalar() or 0

    settings = get_settings(isp, create=False)
    value = float(settings.point_value or 0) if settings else 0
    outstanding = int(earned) + int(spent) + int(expired)
    return {
        'earned': int(earned),
        'redeemed': abs(int(spent)),
        'expired': abs(int(expired)),
        'outstanding': outstanding,
        # What the unredeemed balance would cost if everyone cashed in today.
        'liability': round(outstanding * value, 2),
        'holders': int(holders),
    }


def expire_stale(isp, commit=True):
    """Write off batches whose expiry has passed. Safe to run repeatedly."""
    now = datetime.utcnow()
    rows = (LoyaltyLedger.query
            .filter(LoyaltyLedger.isp_id == isp.id,
                    LoyaltyLedger.points > 0,
                    LoyaltyLedger.expires_at.isnot(None),
                    LoyaltyLedger.expires_at <= now)
            .all())
    expired = 0
    for batch in rows:
        free = batch.points - (batch.consumed_points or 0)
        if free <= 0:
            continue
        batch.consumed_points = batch.points
        db.session.add(LoyaltyLedger(
            isp_id=isp.id, customer_id=batch.customer_id, points=-free, reason=EXPIRY,
            description=f'{free} points expired',
        ))
        expired += free
    if commit and expired:
        db.session.commit()
    return expired
