"""Retention risk — which signals fire, and what the score is allowed to claim.

The reasons carry the value here, not the number. "Score 62" tells an operator
nothing; "never paid, and their line keeps dropping" tells them what to say when
they ring. So these tests pin which signals fire and that the reasons survive
into the output, and treat the arithmetic as secondary.

The weights are a starting position, not a fitted model -- there is no churn
history in this system to fit against yet -- so the score is only asserted where
it must hold regardless of tuning: it never exceeds 100, and an account with
nothing wrong scores zero.

Signal logic only -- datasources are stubbed, so no database.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys
from datetime import datetime, timedelta

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import subscriber_insights as insights  # noqa: E402

NOW = datetime(2026, 9, 3, 12, 0)


class FakeCustomer:
    id = 1
    isp_id = 1


def _fake_ticket_model(open_count):
    """Stands in for the Ticket model, including the column expressions the
    caller builds a filter from (`ticket_status.in_(...)`)."""
    class Column:
        def in_(self, *_args):
            return self

        def __eq__(self, _other):
            return self

        def __hash__(self):
            return id(self)

    class Query:
        def filter(self, *criteria):
            return self

        def count(self):
            return open_count

    class Ticket:
        query = Query()
        customer_id = Column()
        ticket_status = Column()

    return Ticket


@pytest.fixture
def clean(monkeypatch):
    """A subscriber with nothing wrong. Each test breaks exactly one thing."""
    monkeypatch.setattr(insights, '_payment_totals',
                        lambda c, n=None: (5000.0, {'date': (NOW - timedelta(days=3)).isoformat()}))
    monkeypatch.setattr(insights, 'subscription_state',
                        lambda c, n=None: {'state': 'active', 'days_remaining': 25})
    monkeypatch.setattr(insights, 'connection_stability',
                        lambda c, hours=24, now=None: {'flapping': False})
    monkeypatch.setattr(insights, 'last_session',
                        lambda c, n=None: {'ended_at': (NOW - timedelta(hours=2)).isoformat()})
    monkeypatch.setattr(insights, '_bytes_between', lambda c, s, e: 1_000_000_000)

    # The whole model is swapped, not its `query` attribute: reading
    # `Ticket.query` off a Flask-SQLAlchemy model needs an app context, and
    # monkeypatch reads the old value before setting the new one.
    import models
    monkeypatch.setattr(models, 'Ticket', _fake_ticket_model(open_count=0))
    return monkeypatch


def _keys(customer=None):
    return {r['key'] for r in insights.retention_risk(customer or FakeCustomer(), NOW)['reasons']}


def test_a_healthy_account_scores_zero(clean):
    result = insights.retention_risk(FakeCustomer(), NOW)

    assert result['score'] == 0
    assert result['band'] == 'none'
    assert result['reasons'] == []


def test_never_paid_fires(clean):
    clean.setattr(insights, '_payment_totals', lambda c, n=None: (0.0, None))

    assert 'never_paid' in _keys()


def test_a_stale_payment_fires_but_a_recent_one_does_not(clean):
    clean.setattr(insights, '_payment_totals',
                  lambda c, n=None: (5000.0, {'date': (NOW - timedelta(days=90)).isoformat()}))

    assert 'payment_lapsed' in _keys()


def test_expiry_states_are_mutually_exclusive(clean):
    """Expired and expiring-soon must never both fire — that would double-count."""
    clean.setattr(insights, 'subscription_state', lambda c, n=None: {'state': 'expired'})
    keys = _keys()

    assert 'expired' in keys and 'expiring_soon' not in keys


def test_expiring_soon_fires_inside_the_window(clean):
    clean.setattr(insights, 'subscription_state',
                  lambda c, n=None: {'state': 'active', 'days_remaining': 3})

    assert 'expiring_soon' in _keys()


def test_a_flapping_line_is_a_retention_risk(clean):
    clean.setattr(insights, 'connection_stability',
                  lambda c, hours=24, now=None: {'flapping': True})

    assert 'unstable_line' in _keys()


def test_going_dark_for_a_week_fires(clean):
    clean.setattr(insights, 'last_session',
                  lambda c, n=None: {'ended_at': (NOW - timedelta(days=10)).isoformat()})

    assert 'went_dark' in _keys()


def test_collapsed_usage_fires_against_their_own_baseline(clean):
    """Relative to themselves — a light user is not automatically at risk."""
    def usage(c, start, end):
        recent = (NOW - end).total_seconds() < 3600
        return 100_000_000 if recent else 9_000_000_000

    clean.setattr(insights, '_bytes_between', usage)

    assert 'usage_collapsed' in _keys()


def test_a_small_drop_on_a_light_user_is_not_a_signal(clean):
    """Dropping from 40 MB to 10 MB is noise, not churn."""
    def usage(c, start, end):
        recent = (NOW - end).total_seconds() < 3600
        return 10_000_000 if recent else 120_000_000

    clean.setattr(insights, '_bytes_between', usage)

    assert 'usage_collapsed' not in _keys()


def test_a_bad_date_does_not_take_the_panel_down(clean):
    """Payment dates come from the database and have been malformed before."""
    clean.setattr(insights, '_payment_totals',
                  lambda c, n=None: (5000.0, {'date': 'not-a-date'}))

    result = insights.retention_risk(FakeCustomer(), NOW)

    assert result['band'] == 'none'


def test_the_score_is_capped_and_reasons_are_ordered(clean):
    """Everything wrong at once must not produce a number above 100."""
    clean.setattr(insights, '_payment_totals', lambda c, n=None: (0.0, None))
    clean.setattr(insights, 'subscription_state', lambda c, n=None: {'state': 'expired'})
    clean.setattr(insights, 'connection_stability',
                  lambda c, hours=24, now=None: {'flapping': True})
    clean.setattr(insights, 'last_session',
                  lambda c, n=None: {'ended_at': (NOW - timedelta(days=30)).isoformat()})

    result = insights.retention_risk(FakeCustomer(), NOW)

    assert result['score'] == 100
    assert result['band'] == 'high'
    weights = [r['weight'] for r in result['reasons']]
    assert weights == sorted(weights, reverse=True)


def test_an_open_ticket_is_a_signal(clean):
    """Someone who has already complained is closer to leaving than someone who
    has not, even when everything else looks fine."""
    import models
    clean.setattr(models, 'Ticket', _fake_ticket_model(open_count=1))

    assert 'open_ticket' in _keys()
