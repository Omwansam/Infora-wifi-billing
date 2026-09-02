"""How the ACS diagnostic grades what it finds.

`grade()` decides the console's reachability badge, and it got this wrong once:
"no CPE has ever informed" was graded `warn`, so a perfectly healthy ACS displayed
"Path problem" — and would have kept displaying it until someone installed a CPE,
because an empty fleet is the normal state before the first install.

The severity ladder these tests pin:

  * ``error`` — the path is broken; nothing can reach the ACS
  * ``warn``  — part of it is down, e.g. one router of several
  * ``info``  — an observation, never a fault

Pure grading logic — no database, no live app — matching test_tr069_vendors.py.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.acs_diagnostics import grade  # noqa: E402

ACS = 'http://10.250.0.1:7547/tr069'


def _check(ok, severity='error', label='check'):
    return {'id': label, 'label': label, 'ok': ok, 'detail': '', 'severity': severity}


def test_all_passing_is_ok():
    state, verdict = grade([_check(True), _check(True, 'warn')], ACS)

    assert state == 'ok'
    assert 'reachable' in verdict.lower()


def test_info_checks_never_degrade_the_state():
    """The regression guard: an empty CPE fleet is not a path fault."""
    state, _ = grade([_check(True), _check(False, 'info', 'A CPE has informed')], ACS)

    assert state == 'ok'


def test_a_failed_warn_check_is_degraded_not_broken():
    """One router down out of several is partial, not a dead ACS."""
    state, verdict = grade([_check(True), _check(False, 'warn', 'router 5 tunnel')], ACS)

    assert state == 'warn'
    assert 'router 5 tunnel' in verdict


def test_an_error_check_blocks():
    state, verdict = grade([_check(False, 'error', 'DNAT'), _check(False, 'warn')], ACS)

    assert state == 'fail'
    assert verdict.startswith('Blocked at: DNAT')


def test_unconfigured_acs_is_a_failure_even_with_no_failed_checks():
    state, verdict = grade([_check(True)], '')

    assert state == 'fail'
    assert 'not configured' in verdict
