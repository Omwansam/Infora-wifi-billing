"""The TR-069 enrolment window — who is allowed to knock, and when.

An enrolment window relaxes the ACS from "credentials must match a known device"
to "an unknown device may register as pending". That is only defensible because the
ACS is reachable solely over the management tunnel, so the relaxation is bounded by
topology as well as by a clock. These tests pin the three ways that argument can be
broken:

  * a window opened while the ACS is public,
  * a window that has expired still being honoured,
  * two tenants open at once, where guessing files a subscriber's CPE under the
    wrong ISP.

Decision logic only — no database, no live app — matching test_tr069_vendors.py.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys
from datetime import datetime, timedelta

import pytest
from flask import Flask

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.tr069 import enrollment  # noqa: E402

TUNNEL_URL = 'http://10.250.0.1:7547/tr069'
PUBLIC_URL = 'http://acs.ruirufactorymabati.com:7547/tr069'


@pytest.fixture
def ctx():
    """Bare app context — the helpers read config, not the database."""
    app = Flask(__name__)
    app.config['WIREGUARD_MGMT_SUBNET'] = '10.250.0.0/24'
    app.config['TR069_ACS_URL'] = TUNNEL_URL
    with app.app_context():
        yield app


class FakeIsp:
    def __init__(self, isp_id=1, until=None):
        self.id = isp_id
        self.cpe_enrollment_until = until


# --- Is the ACS actually tunnel-only? -------------------------------------

@pytest.mark.parametrize('url,expected', [
    (TUNNEL_URL, True),
    ('http://10.250.0.9:7547/tr069', True),
    (PUBLIC_URL, False),
    # A hostname cannot be proven tunnel-local; refusing is the safe way to be wrong.
    ('http://acs.internal:7547/tr069', False),
    ('http://192.168.1.5:7547/tr069', False),
    ('', False),
])
def test_tunnel_only_detection(ctx, url, expected):
    assert enrollment.acs_is_tunnel_only(url) is expected


def test_window_refuses_to_open_on_a_public_acs(ctx):
    """The guard: no window while the ACS faces the internet."""
    ctx.config['TR069_ACS_URL'] = PUBLIC_URL

    state, error = enrollment.open_window(FakeIsp(), minutes=30)

    assert state is None
    assert 'tunnel-only' in error


@pytest.mark.parametrize('minutes', [0, -5, enrollment.MAX_WINDOW_MINUTES + 1, 'abc'])
def test_window_rejects_out_of_range_durations(ctx, minutes):
    state, error = enrollment.open_window(FakeIsp(), minutes=minutes)

    assert state is None and error


# --- Expiry is by wall clock, not by a flag -------------------------------

def test_window_state_open_while_future():
    state = enrollment.window_state(FakeIsp(until=datetime.utcnow() + timedelta(minutes=10)))

    assert state['open'] is True
    assert 0 < state['seconds_remaining'] <= 600


@pytest.mark.parametrize('until', [
    None,
    datetime(2020, 1, 1),                      # long past
])
def test_window_state_closed(until):
    state = enrollment.window_state(FakeIsp(until=until))

    assert state['open'] is False
    assert state['seconds_remaining'] == 0


# --- Which ISP does an unknown CPE get filed under? -----------------------

def _patch_isps(monkeypatch, rows):
    """Stand in for ISP.query.filter(...).all() without a database."""
    class Query:
        def filter(self, *_args, **_kwargs):
            return self

        def all(self):
            return rows

    monkeypatch.setattr(enrollment.ISP, 'query', Query())


def test_no_window_open_rejects(ctx, monkeypatch):
    _patch_isps(monkeypatch, [])

    isp_id, reason = enrollment.open_window_isp_id()

    assert isp_id is None
    assert 'no enrolment window' in reason


def test_single_open_window_names_its_isp(ctx, monkeypatch):
    _patch_isps(monkeypatch, [FakeIsp(isp_id=7)])

    isp_id, reason = enrollment.open_window_isp_id()

    assert isp_id == 7
    assert reason is None


def test_two_tenants_open_is_refused_not_guessed(ctx, monkeypatch):
    """Filing a subscriber's CPE under the wrong tenant is worse than a retry."""
    _patch_isps(monkeypatch, [FakeIsp(isp_id=3), FakeIsp(isp_id=8)])

    isp_id, reason = enrollment.open_window_isp_id()

    assert isp_id is None
    assert 'multiple' in reason and '3' in reason and '8' in reason


def test_public_acs_disables_registration_even_with_a_window_row(ctx, monkeypatch):
    """A window left in the database must not survive a switch to a public ACS."""
    ctx.config['TR069_ACS_URL'] = PUBLIC_URL
    _patch_isps(monkeypatch, [FakeIsp(isp_id=7)])

    isp_id, reason = enrollment.open_window_isp_id()

    assert isp_id is None
    assert 'tunnel-only' in reason
