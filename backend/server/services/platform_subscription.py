"""The tenant's own subscription to this platform.

This is the bill an ISP pays *us*, not the bill an ISP sends its subscribers —
that is ``Invoice``/``services.subscription_expiry``, and the two must never be
confused. When this one lapses the operator console locks down: the tenant can
reach the subscription page and nothing else, until an invoice is settled.

Deliberate boundary: a lapsed tenant loses the *console*, never their network.
RADIUS, the captive portal, the ACS and the provisioning endpoints keep serving,
because cutting off an ISP's paying subscribers over a late platform bill would
punish the wrong people. See ``app.enforce_platform_subscription``.
"""
from datetime import datetime, timedelta
from decimal import Decimal

from flask import current_app

from extensions import db
from models import ISP, PlatformInvoice

# List price per plan tier, in the platform's billing currency. An ISP on a
# negotiated rate carries its own ``subscription_amount``, which wins.
PLAN_PRICES = {
    'basic': Decimal('500'),
    'pro': Decimal('2500'),
    'enterprise': Decimal('10000'),
}

DEFAULT_TRIAL_DAYS = 14
DEFAULT_PERIOD_DAYS = 30
DEFAULT_GRACE_DAYS = 0
# How early the next invoice is raised, so a tenant can pay before expiry
# rather than only after the lockout has already bitten.
DEFAULT_ISSUE_LEAD_DAYS = 7


def _int_setting(key, default):
    try:
        return int(current_app.config.get(key, default))
    except (TypeError, ValueError):
        return default


def trial_days():
    return _int_setting('PLATFORM_TRIAL_DAYS', DEFAULT_TRIAL_DAYS)


def period_days():
    return _int_setting('PLATFORM_BILLING_PERIOD_DAYS', DEFAULT_PERIOD_DAYS)


def grace_days():
    return _int_setting('PLATFORM_GRACE_DAYS', DEFAULT_GRACE_DAYS)


def issue_lead_days():
    return _int_setting('PLATFORM_ISSUE_LEAD_DAYS', DEFAULT_ISSUE_LEAD_DAYS)


def platform_name():
    return current_app.config.get('PLATFORM_VENDOR_NAME') or 'Lumen'


def currency_for(isp):
    return (isp.currency or 'KES') if isp else 'KES'


def plan_amount(isp):
    """What one billing period costs this tenant."""
    if isp is not None and isp.subscription_amount is not None:
        return Decimal(str(isp.subscription_amount))
    plan = (isp.subscription_plan if isp else None) or 'basic'
    return PLAN_PRICES.get(plan.lower(), PLAN_PRICES['basic'])


# ---------------------------------------------------------------------------
#  State
# ---------------------------------------------------------------------------

def start_trial(isp, days=None):
    """Put a brand-new tenant on the clock. Called from onboarding.

    Idempotent: never shortens or resets an expiry that is already set, so
    re-running provisioning cannot silently take days off a paying tenant.
    """
    if isp.subscription_expires_at is not None:
        return isp.subscription_expires_at
    isp.subscription_expires_at = datetime.utcnow() + timedelta(days=days or trial_days())
    isp.subscription_is_trial = True
    return isp.subscription_expires_at


def lockout_at(isp):
    """The moment the console closes — expiry plus any configured grace."""
    if not isp or not isp.subscription_expires_at:
        return None
    return isp.subscription_expires_at + timedelta(days=grace_days())


def is_locked(isp):
    """True when this tenant may no longer use the console.

    A tenant with no expiry set is *not* locked: that is every ISP created
    before this feature existed, and they must not be shut out by a deploy.
    """
    deadline = lockout_at(isp)
    return deadline is not None and datetime.utcnow() >= deadline


def days_left(isp):
    if not isp or not isp.subscription_expires_at:
        return None
    delta = isp.subscription_expires_at - datetime.utcnow()
    # Round toward zero from above: 0 means "expires today", negative means past.
    return int(delta.total_seconds() // 86400)


def open_invoices(isp):
    return (PlatformInvoice.query
            .filter_by(isp_id=isp.id, status='pending')
            .order_by(PlatformInvoice.due_at.asc().nullslast())
            .all())


def amount_due(isp):
    return sum((Decimal(str(inv.amount)) for inv in open_invoices(isp)), Decimal('0'))


def subscription_state(isp):
    """Everything the console needs to render the subscription page and the
    sidebar lockout card, in one shape."""
    expires = isp.subscription_expires_at if isp else None
    left = days_left(isp)
    due = amount_due(isp) if isp else Decimal('0')
    return {
        'plan': (isp.subscription_plan if isp else None) or 'basic',
        'plan_label': ((isp.subscription_plan if isp else None) or 'basic').title(),
        'currency': currency_for(isp),
        'period_amount': float(plan_amount(isp)),
        'amount_due': float(due),
        'expires_at': expires.isoformat() if expires else None,
        'days_left': left,
        'expired': bool(expires and datetime.utcnow() >= expires),
        'locked': is_locked(isp),
        'is_trial': bool(isp.subscription_is_trial) if isp else False,
        'grace_days': grace_days(),
        'period_days': period_days(),
        'platform_name': platform_name(),
        'open_invoice_count': len(open_invoices(isp)) if isp else 0,
    }


# ---------------------------------------------------------------------------
#  Invoicing
# ---------------------------------------------------------------------------

def _invoice_number(isp, due_at):
    """INV-<slug>-<YYYYMMDD>, with a suffix only if that collides."""
    slug = (isp.slug or f'isp{isp.id}').lower()
    base = f'INV-{slug}-{due_at.strftime("%Y%m%d")}'
    if not PlatformInvoice.query.filter_by(number=base).first():
        return base
    for n in range(2, 100):
        candidate = f'{base}-{n}'
        if not PlatformInvoice.query.filter_by(number=candidate).first():
            return candidate
    raise RuntimeError(f'Could not allocate an invoice number for {base}')


def issue_invoice(isp, due_at=None, amount=None, notes=None):
    """Raise one period's bill. Returns the new invoice (uncommitted)."""
    period = period_days()
    start = isp.subscription_expires_at or datetime.utcnow()
    due = due_at or start
    invoice = PlatformInvoice(
        isp_id=isp.id,
        number=_invoice_number(isp, due),
        amount=amount if amount is not None else plan_amount(isp),
        currency=currency_for(isp),
        status='pending',
        period_start=start,
        period_end=start + timedelta(days=period),
        issued_at=datetime.utcnow(),
        due_at=due,
        notes=notes,
    )
    db.session.add(invoice)
    return invoice


def issue_due_invoices(lead_days=None):
    """Raise the next invoice for every tenant approaching or past expiry.

    Idempotent by design: a tenant with any pending invoice is skipped, so
    running this hourly, daily, or twice by accident issues the same one bill.
    """
    lead = issue_lead_days() if lead_days is None else lead_days
    horizon = datetime.utcnow() + timedelta(days=lead)
    issued = []

    candidates = ISP.query.filter(
        ISP.is_active.is_(True),
        ISP.subscription_expires_at.isnot(None),
        ISP.subscription_expires_at <= horizon,
    ).all()

    for isp in candidates:
        if PlatformInvoice.query.filter_by(isp_id=isp.id, status='pending').first():
            continue
        issued.append(issue_invoice(isp))

    if issued:
        db.session.commit()
    return issued


def mark_invoice_paid(invoice, reference=None, method='mpesa', phone=None, commit=True):
    """Settle an invoice and extend the tenant's access.

    The new expiry runs from whichever is later — now, or the current expiry —
    so paying early adds a period instead of throwing the unused remainder away,
    and paying late does not back-date the tenant into another lockout.
    """
    if invoice.status == 'paid':
        return invoice

    now = datetime.utcnow()
    invoice.status = 'paid'
    invoice.paid_at = now
    invoice.payment_method = method
    if reference:
        invoice.payment_reference = reference
    if phone:
        invoice.payer_phone = phone

    isp = invoice.isp or ISP.query.get(invoice.isp_id)
    if isp is not None:
        base = isp.subscription_expires_at
        if base is None or base < now:
            base = now
        isp.subscription_expires_at = base + timedelta(days=period_days())
        isp.subscription_is_trial = False

    if commit:
        db.session.commit()
    return invoice


def serialize_invoice(invoice):
    return {
        'id': invoice.id,
        'number': invoice.number,
        'amount': float(invoice.amount or 0),
        'currency': invoice.currency or 'KES',
        'status': invoice.status,
        'issued_at': invoice.issued_at.isoformat() if invoice.issued_at else None,
        'due_at': invoice.due_at.isoformat() if invoice.due_at else None,
        'paid_at': invoice.paid_at.isoformat() if invoice.paid_at else None,
        'period_start': invoice.period_start.isoformat() if invoice.period_start else None,
        'period_end': invoice.period_end.isoformat() if invoice.period_end else None,
        'payment_method': invoice.payment_method,
        'payment_reference': invoice.payment_reference,
        'notes': invoice.notes,
    }
