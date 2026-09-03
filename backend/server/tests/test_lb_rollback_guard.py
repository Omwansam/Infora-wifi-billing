"""The dual-WAN rollback guard.

Applying dual-WAN changes the routing of a router we can only reach *through*
that routing. The apply retires the working default route on purpose — defconf's
DHCP client installs a competing distance-1 default that would beat the recursive
ones — and replaces it with defaults that only resolve once the new WAN is up. If
the new WAN does not come up, the router keeps serving its LAN with no path to the
internet or to us. That is a healthy router going dark permanently, and "Disable
dual-WAN" could not rescue it because the teardown never restored a default route
either.

The guard is a scheduler armed on the router before the push and cancelled only
after verification passes. These tests pin the three things that make it work:
it restores an uplink rather than merely removing rules, it is valid RouterOS
(a malformed scheduler is worse than none), and it is armed before the push and
disarmed only on success.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import load_balancing as lb  # noqa: E402

CONFIG = {
    'mode': 'load_balance',
    'lan_interface': 'infora-bridge',
    'wan1': {'port': 'ether1', 'type': 'dhcp', 'weight': 1},
    'wan2': {'port': 'ether2', 'type': 'dhcp', 'weight': 1},
}


def _guard_script():
    return dict(lb.build_lb_guard_steps(CONFIG))['guard-arm']


# --- The restore has to restore something ----------------------------------

def test_restore_puts_a_default_route_back():
    """Removing the LB rules is not enough — that is what stranded the router."""
    commands = ' '.join(cmd for _, cmd in lb.build_lb_restore_steps(CONFIG))

    assert 'add-default-route=yes' in commands
    assert 'ether1' in commands and 'ether2' in commands


def test_restore_is_a_superset_of_the_plain_teardown():
    teardown = {label for label, _ in lb.build_lb_remove_steps(CONFIG)}
    restore = {label for label, _ in lb.build_lb_restore_steps(CONFIG)}

    assert teardown < restore


def test_restore_survives_a_config_with_no_wan_ports():
    """A half-built config must not raise while we are trying to recover."""
    steps = lb.build_lb_restore_steps({'mode': 'load_balance'})

    assert steps and all(isinstance(c, str) for _, c in steps)


# --- A malformed scheduler is worse than no scheduler ----------------------

def test_the_guard_script_is_valid_routeros():
    script = _guard_script()
    body = script.split('on-event="', 1)[1][:-1]

    unescaped = [i for i, ch in enumerate(body) if ch == '"' and (i == 0 or body[i - 1] != '\\')]
    assert not unescaped, 'unescaped quote would truncate the on-event argument'
    assert body.count('{') == body.count('}'), 'unbalanced braces'
    assert script.endswith('"')


def test_the_guard_removes_itself_after_firing():
    """A fired guard that stays armed would undo the operator's next attempt too."""
    assert f'/system scheduler remove [find name=\\"{lb.GUARD_NAME}\\"]' in _guard_script()


def test_the_guard_leaves_a_trail_in_the_router_log():
    assert ':log warning' in _guard_script()


def test_the_guard_restores_the_uplink_not_just_the_rules():
    assert 'add-default-route=yes' in _guard_script()


@pytest.mark.parametrize('minutes', [1, 8, 30])
def test_the_guard_interval_is_honoured(minutes):
    script = dict(lb.build_lb_guard_steps(CONFIG, minutes=minutes))['guard-arm']

    assert f'interval={minutes}m' in script


def test_arming_clears_any_previous_guard_first():
    """Two guards would roll back twice, the second one over a good config."""
    labels = [label for label, _ in lb.build_lb_guard_steps(CONFIG)]

    assert labels.index('guard-reset') < labels.index('guard-arm')


# --- Order of operations in the apply --------------------------------------

def _apply_body():
    import pathlib
    import re

    source = (pathlib.Path(__file__).resolve().parents[1] / 'routes' / 'devices.py').read_text()
    body = source.split('def _apply_load_balancing')[1]
    match = re.search(r'\n(?=@devices_bp|def )', body)
    body = body[:match.start()] if match else body
    # Drop the local import block: it names every helper, so a plain `.find()`
    # would match the import rather than the call and the ordering assertions
    # below would pass no matter what order things actually run in.
    return re.sub(r'from services\.load_balancing import \([^)]*\)', '', body, count=1)


def test_the_guard_is_armed_before_the_push():
    body = _apply_body()

    assert body.index('build_lb_guard_steps') < body.index('build_lb_steps')


def test_the_push_is_abandoned_if_the_guard_cannot_be_armed():
    """Pushing without the safety net is the exact thing that stranded routers."""
    body = _apply_body()
    guarded = body[body.index('build_lb_guard_steps'):body.index('build_lb_steps')]

    assert 'return result' in guarded, 'no early return when the guard fails to arm'


def test_the_guard_is_only_disarmed_after_verification():
    body = _apply_body()

    assert body.index('verify_lb') < body.index('build_lb_disarm_steps')
