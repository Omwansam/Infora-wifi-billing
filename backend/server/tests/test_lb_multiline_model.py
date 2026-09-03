"""The multi-line wan_config model.

Being generalised from exactly two WANs to a list so an ISP can aggregate
capacity from several providers. Every router in the field stores the old shape
and nothing rewrites it — a device keeps its stored JSON until its next
successful apply — so the two shapes must stay interchangeable indefinitely, not
just across one release.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.load_balancing import MAX_LINES, validate_wan_config  # noqa: E402

# Fusion's real stored config.
LEGACY = {
    'enabled': True, 'mode': 'load_balance', 'lan_interface': 'infora-bridge',
    'primary_wan': 'wan1', 'probe_hosts': ['8.8.8.8', '1.0.0.1'],
    'pin_management_to': None, 'subscriber_list': 'ISP2-SUBS',
    'wan1': {'port': 'ether1', 'type': 'dhcp', 'weight': 1},
    'wan2': {'port': 'ether2', 'type': 'dhcp', 'weight': 1},
}


def _line(n, **over):
    line = {'id': f'wan{n}', 'port': f'ether{n}', 'type': 'dhcp',
            'weight': 1, 'priority': n, 'probe': f'9.9.9.{n}'}
    line.update(over)
    return line


def _config(count=2, mode='load_balance', **over):
    config = {'mode': mode, 'lan_interface': 'infora-bridge', 'primary_wan': 'wan1',
              'lines': [_line(n) for n in range(1, count + 1)]}
    config.update(over)
    return config


# --- the old shape must keep working forever -------------------------------

def test_a_stored_legacy_config_still_validates():
    clean, err = validate_wan_config(LEGACY)

    assert err is None
    assert [l['id'] for l in clean['lines']] == ['wan1', 'wan2']
    assert [l['port'] for l in clean['lines']] == ['ether1', 'ether2']


def test_positional_probes_move_onto_their_line():
    clean, _ = validate_wan_config(LEGACY)

    assert [l['probe'] for l in clean['lines']] == ['8.8.8.8', '1.0.0.1']


def test_the_legacy_keys_are_mirrored_back():
    """Callers not yet generalised keep reading wan1/wan2/probe_hosts."""
    clean, _ = validate_wan_config(LEGACY)

    assert clean['wan1'] == {'port': 'ether1', 'type': 'dhcp', 'weight': 1}
    assert clean['wan2']['port'] == 'ether2'
    assert clean['probe_hosts'] == ['8.8.8.8', '1.0.0.1']


def test_normalised_output_can_be_fed_straight_back_in():
    """The console stores what this returns, so it is the next call's input."""
    once, _ = validate_wan_config(LEGACY)
    twice, err = validate_wan_config(once)

    assert err is None
    assert twice['lines'] == once['lines']


def test_a_static_line_mirrors_its_addressing():
    clean, err = validate_wan_config({
        **LEGACY,
        'wan1': {'port': 'ether1', 'type': 'static', 'weight': 1,
                 'ip': '100.64.0.2/30', 'gateway': '100.64.0.1'},
    })

    assert err is None
    assert clean['wan1']['ip'] == '100.64.0.2/30'
    assert clean['lines'][0]['gateway'] == '100.64.0.1'


# --- the new shape ---------------------------------------------------------

def test_five_lines_are_accepted():
    clean, err = validate_wan_config(_config(count=5))

    assert err is None
    assert len(clean['lines']) == 5


def test_a_sixth_line_is_refused():
    _, err = validate_wan_config(_config(count=MAX_LINES + 1))

    assert f'at most {MAX_LINES}' in err


def test_one_line_is_refused():
    _, err = validate_wan_config(_config(count=1))

    assert 'at least two' in err


def test_ids_survive_a_line_being_removed():
    """The id names to_WANn / WANn_conn on the router. Renumbering the third line
    when the second is deleted would leave teardown unable to match what is
    actually there."""
    config = _config(count=3)
    del config['lines'][1]

    clean, err = validate_wan_config(config)

    assert err is None
    assert [l['id'] for l in clean['lines']] == ['wan1', 'wan3']


# --- the rules that stop a broken config reaching a router ------------------

def test_two_lines_may_not_share_a_probe():
    """Health is per line. A shared probe means a dead line reports healthy and
    keeps taking traffic — worse than having no health check."""
    config = _config(count=2)
    config['lines'][1]['probe'] = config['lines'][0]['probe']

    _, err = validate_wan_config(config)

    assert 'own probe host' in err


def test_two_lines_may_not_share_a_port():
    config = _config(count=2)
    config['lines'][1]['port'] = 'ether1'

    _, err = validate_wan_config(config)

    assert 'different port' in err


def test_pin_management_to_must_name_a_real_line():
    _, err = validate_wan_config(_config(count=2, pin_management_to='wan9'))

    assert 'unknown line' in err


@pytest.mark.parametrize('bad', [0, -1])
def test_weights_below_one_are_refused(bad):
    config = _config(count=2)
    config['lines'][0]['weight'] = bad

    _, err = validate_wan_config(config)

    assert 'weights must be' in err


def test_a_bad_probe_address_is_refused():
    config = _config(count=2)
    config['lines'][0]['probe'] = 'not-an-ip'

    _, err = validate_wan_config(config)

    assert 'not a valid IP' in err


# --- roles: carried now, derived from mode until the UI exposes them --------

@pytest.mark.parametrize('mode,expected', [
    ('load_balance', ['active', 'active', 'active']),
    ('failover', ['active', 'standby', 'standby']),
    ('app_steer', ['active', 'steer', 'steer']),
])
def test_roles_are_derived_from_the_mode(mode, expected):
    clean, err = validate_wan_config(_config(count=3, mode=mode))

    assert err is None
    assert [l['role'] for l in clean['lines']] == expected


def test_an_explicit_role_beats_the_derived_one():
    """Three paid lines balanced plus an LTE backup — the case this exists for."""
    config = _config(count=4)
    config['lines'][3]['role'] = 'standby'

    clean, err = validate_wan_config(config)

    assert err is None
    assert [l['role'] for l in clean['lines']] == ['active', 'active', 'active', 'standby']


def test_capacity_is_carried_but_optional():
    """Nullable and unused today, so reporting total supply later needs no second
    migration of every stored config."""
    config = _config(count=2)
    config['lines'][0]['capacity_mbps'] = 100

    clean, _ = validate_wan_config(config)

    assert clean['lines'][0]['capacity_mbps'] == 100
    assert clean['lines'][1]['capacity_mbps'] is None


def test_off_needs_no_lines_at_all():
    clean, err = validate_wan_config({'mode': 'off'})

    assert err is None
    assert clean['lines'] == []
    assert clean['enabled'] is False
