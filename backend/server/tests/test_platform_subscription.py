"""Tests for the platform-subscription paywall's decision logic.

The lockout maths is the part that is easy to get subtly wrong and expensive
when it is: an off-by-one here either shuts a paying tenant out of their own
console or lets an unpaid one keep using it. No database — everything below is
the pure arithmetic around expiry, grace and renewal.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest
from flask import Flask

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import platform_subscription as sub  # noqa: E402


@pytest.fixture
def ctx():
    """Bare app context — the service reads its settings from config."""
    app = Flask(__name__)
    app.config.update(
        PLATFORM_TRIAL_DAYS=14,
        PLATFORM_BILLING_PERIOD_DAYS=30,
        PLATFORM_GRACE_DAYS=0,
        PLATFORM_ISSUE_LEAD_DAYS=7,
        PLATFORM_VENDOR_NAME='Lumen',
    )
    with app.app_context():
        yield app


def tenant(expires_in_days=None, plan='basic', amount=None, trial=True):
    expires = None if expires_in_days is None else datetime.utcnow() + timedelta(days=expires_in_days)
    return SimpleNamespace(
        id=1, slug='acme', currency='KES',
        subscription_expires_at=expires,
        subscription_plan=plan,
        subscription_amount=amount,
        subscription_is_trial=trial,
    )


# --- the lock ---------------------------------------------------------------

def test_tenant_without_expiry_is_never_locked(ctx):
    """Every ISP created before this feature has no expiry. A deploy must not
    lock them all out."""
    assert sub.is_locked(tenant(expires_in_days=None)) is False


def test_future_expiry_is_not_locked(ctx):
    assert sub.is_locked(tenant(expires_in_days=3)) is False


def test_past_expiry_is_locked(ctx):
    assert sub.is_locked(tenant(expires_in_days=-1)) is True


def test_grace_holds_the_lock_off(ctx):
    ctx.config['PLATFORM_GRACE_DAYS'] = 5
    assert sub.is_locked(tenant(expires_in_days=-2)) is False
    assert sub.is_locked(tenant(expires_in_days=-6)) is True


def test_lockout_at_is_expiry_plus_grace(ctx):
    ctx.config['PLATFORM_GRACE_DAYS'] = 3
    isp = tenant(expires_in_days=1)
    assert sub.lockout_at(isp) == isp.subscription_expires_at + timedelta(days=3)


def test_lockout_at_is_none_without_expiry(ctx):
    assert sub.lockout_at(tenant(expires_in_days=None)) is None


def test_none_isp_is_not_locked(ctx):
    """The gate calls this for admins with no tenant; it must not raise."""
    assert sub.is_locked(None) is False


# --- days left --------------------------------------------------------------

def test_days_left_counts_down(ctx):
    assert sub.days_left(tenant(expires_in_days=5)) == 4  # 4 whole days remain
    assert sub.days_left(tenant(expires_in_days=None)) is None


def test_days_left_is_negative_once_past(ctx):
    assert sub.days_left(tenant(expires_in_days=-2)) < 0


# --- price ------------------------------------------------------------------

@pytest.mark.parametrize('plan,expected', [
    ('basic', Decimal('500')),
    ('pro', Decimal('2500')),
    ('enterprise', Decimal('10000')),
    ('PRO', Decimal('2500')),          # tier casing is not the tenant's problem
    ('nonsense', Decimal('500')),      # unknown tier bills as basic, never zero
    (None, Decimal('500')),
])
def test_plan_amount_per_tier(ctx, plan, expected):
    assert sub.plan_amount(tenant(plan=plan)) == expected


def test_negotiated_amount_overrides_the_list_price(ctx):
    assert sub.plan_amount(tenant(plan='enterprise', amount='750')) == Decimal('750')


# --- trial ------------------------------------------------------------------

def test_start_trial_sets_the_clock(ctx):
    isp = tenant(expires_in_days=None)
    sub.start_trial(isp)
    assert 13 <= (isp.subscription_expires_at - datetime.utcnow()).days <= 14
    assert isp.subscription_is_trial is True


def test_start_trial_never_shortens_an_existing_expiry(ctx):
    """Re-running provisioning must not take days off a paying tenant."""
    isp = tenant(expires_in_days=200)
    original = isp.subscription_expires_at
    sub.start_trial(isp)
    assert isp.subscription_expires_at == original


# --- settings ---------------------------------------------------------------

def test_settings_fall_back_when_misconfigured(ctx):
    ctx.config['PLATFORM_GRACE_DAYS'] = 'not-a-number'
    assert sub.grace_days() == sub.DEFAULT_GRACE_DAYS
