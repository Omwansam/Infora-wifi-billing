"""Why the console says a subscriber is offline.

The page used to show a bare "Offline" chip, leaving the agent to guess between an
expired subscription, a FUP throttle, a suspension, a router fault and a bad line.
`diagnose_connection` picks one. These tests pin the precedence, because more than
one cause is usually true at once and only the first one is worth saying out loud:
there is no point discussing a flapping line with someone whose subscription
lapsed a week ago.

The disconnect-cause mapping is pinned too. It had been sitting in the database
for the life of the system, rendered only as an HTML `title` tooltip, so nothing
depended on it being right until now.

Pure decision logic — the datasource calls are stubbed, so no database.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import subscriber_insights as insights  # noqa: E402


# --- Disconnect causes ----------------------------------------------------

@pytest.mark.parametrize('code,blame', [
    ('Lost-Carrier', 'line'),        # the drop wire, the ONT, the power
    ('Lost-Service', 'line'),
    ('NAS-Reboot', 'network'),       # our router took everyone down with it
    ('NAS-Error', 'network'),
    ('User-Request', 'subscriber'),  # they switched it off; not a fault
    ('Idle-Timeout', 'subscriber'),
    ('Admin-Reset', 'policy'),       # somebody here did this on purpose
    ('Session-Timeout', 'policy'),
])
def test_causes_are_attributed_to_the_right_owner(code, blame):
    assert insights.explain_terminate_cause(code)['blame'] == blame


def test_unknown_cause_is_passed_through_not_swallowed():
    """A cause we have not mapped must still reach the screen."""
    out = insights.explain_terminate_cause('Some-New-Cause')

    assert out['code'] == 'Some-New-Cause'
    assert out['label'] == 'Some-New-Cause'
    assert out['blame'] == 'unknown'


def test_no_cause_yields_nothing_to_render():
    assert insights.explain_terminate_cause(None) is None
    assert insights.explain_terminate_cause('') is None


# --- Diagnosis precedence -------------------------------------------------

class FakeCustomer:
    id = 1
    isp_id = 1

    def __init__(self, status='active'):
        self.status = status


def _stub(monkeypatch, *, online=False, sub_state='active', throttled=False,
          cause=None, sessions=1, short=0):
    monkeypatch.setattr(insights, 'live_snapshot', lambda c, n=None: {'online': online})
    monkeypatch.setattr(insights, 'last_session',
                        lambda c, n=None: {'terminate_cause': cause, 'ended_at': None,
                                           'started_at': None})
    monkeypatch.setattr(insights, 'subscription_state', lambda c, n=None: {'state': sub_state})
    monkeypatch.setattr(insights, 'fup_snapshot',
                        lambda c, n=None: {'throttled': throttled, 'cap_display': '50 GB'})
    monkeypatch.setattr(insights, 'connection_stability',
                        lambda c, hours=24, now=None: {
                            'sessions': sessions, 'short_sessions': short,
                            'flapping': sessions >= 5 or short >= 3,
                            'dominant_cause': None, 'summary': f'{sessions} sessions',
                        })


def test_a_live_session_ends_the_question(monkeypatch):
    _stub(monkeypatch, online=True)

    out = insights.diagnose_connection(FakeCustomer())

    assert out['online'] is True
    assert out['reason']['code'] == 'online'


def test_suspension_outranks_everything_else(monkeypatch):
    """A suspended account explains the outage; the line is beside the point."""
    _stub(monkeypatch, cause='Lost-Carrier', sessions=9, throttled=True)

    out = insights.diagnose_connection(FakeCustomer(status='suspended'))

    assert out['reason']['code'] == 'suspended'


def test_expiry_outranks_a_bad_line(monkeypatch):
    _stub(monkeypatch, sub_state='expired', cause='Lost-Carrier', sessions=9)

    assert insights.diagnose_connection(FakeCustomer())['reason']['code'] == 'expired'


def test_grace_is_reported_without_being_blamed(monkeypatch):
    """In grace they still have service, so say so rather than implying a cut-off."""
    _stub(monkeypatch, sub_state='grace')

    out = insights.diagnose_connection(FakeCustomer())

    assert out['reason']['code'] == 'grace'
    assert 'not yet' in out['reason']['detail']


def test_fup_throttle_is_named_when_billing_is_current(monkeypatch):
    _stub(monkeypatch, throttled=True, cause='User-Request')

    out = insights.diagnose_connection(FakeCustomer())

    assert out['reason']['code'] == 'fup'
    assert '50 GB' in out['reason']['detail']


def test_a_line_fault_beats_a_flap_count(monkeypatch):
    """A named physical cause is more specific than "it keeps reconnecting"."""
    _stub(monkeypatch, cause='Lost-Carrier', sessions=9)

    out = insights.diagnose_connection(FakeCustomer())

    assert out['reason']['code'] == 'disconnect'
    assert out['reason']['blame'] == 'line'


def test_flapping_is_caught_when_no_cause_was_reported(monkeypatch):
    _stub(monkeypatch, cause=None, sessions=9)

    out = insights.diagnose_connection(FakeCustomer())

    assert out['reason']['code'] == 'flapping'
    assert out['reason']['blame'] == 'line'


def test_a_normal_sign_off_is_not_dressed_up_as_a_fault(monkeypatch):
    """The most common case: nothing is wrong and the console should say so."""
    _stub(monkeypatch, cause='User-Request', sessions=1)

    out = insights.diagnose_connection(FakeCustomer())

    assert out['reason']['blame'] == 'subscriber'


def test_no_history_at_all_still_produces_an_answer(monkeypatch):
    _stub(monkeypatch, cause=None, sessions=0)

    out = insights.diagnose_connection(FakeCustomer())

    assert out['reason']['code'] == 'idle'
    assert out['reason']['fix']
