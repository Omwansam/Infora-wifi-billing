"""The refactor must not change a single command for an existing router.

`load_balancing.py` is being generalised from exactly two WANs to a list, so that
an ISP can aggregate capacity from several providers. Every router already in the
field runs a two-WAN config, and this file is the guarantee that none of them
notice: 40 scenarios across both RouterOS majors, all four modes, weighted and
even splits, DHCP and static, captured from the generator *before* the refactor.

If a byte moves, this fails. That is the point — three separate outages this
month came from small changes to this generator, and none of them were visible in
review.

Regenerate deliberately (never to make a red test green):
    backend/.venv/bin/python -m pytest backend/server/tests/test_lb_golden.py \
        --regenerate-golden

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.load_balancing import (  # noqa: E402
    build_lb_remove_steps, build_lb_steps, validate_wan_config,
)

GOLDEN = os.path.join(os.path.dirname(__file__), 'fixtures_lb_golden.json')


class FakeDevice:
    def __init__(self, version):
        self.device_name = 'X'
        self.os_version = version


def _scenarios():
    """The same matrix the fixture was captured from."""
    for ros in ('7.14', '6.49'):
        for mode in ('failover', 'load_balance', 'app_steer', 'off'):
            for weights in ((1, 1), (3, 1)):
                for types in (('dhcp', 'dhcp'), ('static', 'dhcp')):
                    yield ros, mode, weights, types


def _config(mode, weights, types):
    config, err = validate_wan_config({
        'mode': mode, 'lan_interface': 'infora-bridge', 'primary_wan': 'wan1',
        'wan1': {'port': 'ether1', 'type': types[0], 'weight': weights[0],
                 'ip': '100.64.0.2/30', 'gateway': '100.64.0.1'},
        'wan2': {'port': 'ether2', 'type': types[1], 'weight': weights[1]},
        'probe_hosts': ['8.8.8.8', '1.0.0.1'],
        'pin_management_to': 'wan1',
    })
    assert err is None, err
    return config


@pytest.fixture(scope='module')
def golden():
    with open(GOLDEN, encoding='utf-8') as fh:
        return json.load(fh)


@pytest.mark.parametrize('ros,mode,weights,types', list(_scenarios()))
def test_generated_steps_are_unchanged(golden, ros, mode, weights, types):
    key = f'{ros}|{mode}|{weights}|{types}'
    expected = [tuple(step) for step in golden[key]]

    actual = list(build_lb_steps(FakeDevice(ros), _config(mode, weights, types)))

    assert len(actual) == len(expected), (
        f'{key}: step count changed {len(expected)} -> {len(actual)}'
    )
    for i, (got, want) in enumerate(zip(actual, expected)):
        assert got[0] == want[0], f'{key}: step {i} label {want[0]!r} -> {got[0]!r}'
        assert got[1] == want[1], (
            f'{key}: step {i} ({want[0]}) command changed\n  was: {want[1]}\n  now: {got[1]}'
        )


@pytest.mark.parametrize('ros', ['7.14', '6.49'])
@pytest.mark.parametrize('mode', ['failover', 'load_balance', 'app_steer', 'off'])
def test_teardown_steps_are_unchanged(golden, ros, mode):
    expected = [tuple(step) for step in golden[f'{ros}|{mode}|remove']]
    config, _ = validate_wan_config(
        {'mode': 'off', 'wan1': {'port': 'ether1'}, 'wan2': {'port': 'ether2'}})

    actual = list(build_lb_remove_steps(config))

    assert actual == expected


def test_the_fixture_covers_what_it_claims_to():
    """A fixture that silently lost scenarios would pass everything above."""
    with open(GOLDEN, encoding='utf-8') as fh:
        data = json.load(fh)

    assert len(data) == 40, 'scenario matrix changed — regenerate deliberately'
    assert sum(len(v) for v in data.values()) > 900
