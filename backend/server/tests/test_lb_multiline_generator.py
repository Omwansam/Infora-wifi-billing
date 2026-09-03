"""Generating router config for more than two lines.

The generator is now driven by a list. Two-line output is guaranteed unchanged by
test_lb_golden.py; this covers what only appears once there are more, and the
structural choices that keep it safe at five.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import re
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import load_balancing as lb  # noqa: E402


class FakeDevice:
    device_name = 'X'
    os_version = '7.24'


def _line(n, **over):
    line = {'id': f'wan{n}', 'port': f'ether{n}', 'type': 'dhcp',
            'weight': 1, 'priority': n, 'probe': f'9.9.9.{n}'}
    line.update(over)
    return line


def _steps(lines, mode='load_balance', **over):
    config, err = lb.validate_wan_config(
        {'mode': mode, 'lan_interface': 'infora-bridge', 'lines': lines, **over})
    assert err is None, err
    return dict(lb.build_lb_steps(FakeDevice(), config)), config


def _labels(lines, **kw):
    config, err = lb.validate_wan_config(
        {'mode': kw.pop('mode', 'load_balance'), 'lan_interface': 'infora-bridge',
         'lines': lines, **kw})
    assert err is None, err
    return [label for label, _ in lb.build_lb_steps(FakeDevice(), config)]


# --- one set of objects per line -------------------------------------------

@pytest.mark.parametrize('prefix', ['reclaim-wan', 'table-wan', 'blackhole-',
                                   'main-default-', 'mangle-in-', 'mangle-out-', 'nat-'])
def test_five_lines_produce_five_of_each(prefix):
    labels = _labels([_line(n) for n in range(1, 6)])

    # Anchored on the per-line form: a bare "nat" prefix also catches nat-reset
    # and nat-defconf-reset, which are one-per-plan rather than one-per-line.
    matches = [l for l in labels if l.startswith(prefix) and l[len(prefix):len(prefix) + 1].isdigit()
               or (prefix.endswith('wan') and l.startswith(prefix))]

    assert len(matches) == 5, f'{prefix}: {matches}'


def test_each_line_gets_its_own_routing_table():
    steps, _ = _steps([_line(n) for n in range(1, 6)])

    for n in range(1, 6):
        assert f'name=to_WAN{n} ' in steps[f'table-wan{n}']


# --- PCC across N weighted lines -------------------------------------------

def test_buckets_follow_the_weights():
    lines = [_line(1, weight=3), _line(2, weight=2), _line(3, weight=1), _line(4, weight=1)]
    steps, _ = _steps(lines)

    marks = []
    for label, cmd in steps.items():
        if label.startswith('pcc-') and 'route' not in label:
            marks.append(re.search(r'new-connection-mark=(\w+)', cmd).group(1))

    assert len(marks) == 7, 'one bucket per unit of weight'
    assert marks.count('WAN1_conn') == 3
    assert marks.count('WAN2_conn') == 2
    assert marks.count('WAN3_conn') == 1
    assert marks.count('WAN4_conn') == 1


def test_every_bucket_shares_one_denominator():
    """PCC splits on i/total; a mismatched denominator silently misroutes."""
    steps, _ = _steps([_line(1, weight=3), _line(2, weight=1)])

    totals = {re.search(r'both-addresses:(\d+)/', cmd).group(1)
              for label, cmd in steps.items()
              if label.startswith('pcc-') and 'route' not in label}

    assert totals == {'4'}


def test_a_standby_line_gets_no_pcc_bucket():
    """The whole point of roles: three paid lines share load, the LTE backup
    carries nothing until they are all down."""
    lines = [_line(1), _line(2), _line(3), _line(4, role='standby')]
    steps, _ = _steps(lines)

    buckets = ' '.join(cmd for label, cmd in steps.items()
                       if label.startswith('pcc-') and 'route' not in label)

    assert 'WAN4_conn' not in buckets
    for n in (1, 2, 3):
        assert f'WAN{n}_conn' in buckets


def test_a_standby_line_still_gets_everything_else():
    """It must be routable the moment it is needed."""
    labels = _labels([_line(1), _line(2), _line(3, role='standby')])

    for prefix in ('table-wan3', 'nat-3', 'mangle-in-3', 'mangle-out-3', 'main-default-3'):
        assert any(l.startswith(prefix) for l in labels), prefix


# --- failover order ---------------------------------------------------------

def test_the_failover_chain_follows_priority():
    lines = [_line(1, priority=3), _line(2, priority=1), _line(3, priority=2)]
    steps, _ = _steps(lines, mode='failover')

    order = []
    for n in (1, 2, 3):
        cmd = steps[f'main-default-{n}']
        order.append((n, int(re.search(r'distance=(\d+)', cmd).group(1))))

    # wan2 is priority 1, so it takes distance 1.
    assert dict(order)[2] == 1
    assert dict(order)[3] == 2
    assert dict(order)[1] == 3


# --- the O(N) fallback ------------------------------------------------------

def test_backups_stay_linear_not_quadratic():
    """A full mesh would put a route-add per line in every lease script, and one
    rejection inside that single `:if ... do={}` block silently abandons the
    rest — which is how Fusion lost its probe route twice."""
    steps, _ = _steps([_line(n) for n in range(1, 6)])

    primary = steps['wan1-dhcp-seed'].count('-bk')
    others = [steps[f'wan{n}-dhcp-seed'].count('-bk') for n in range(2, 6)]

    assert primary == 5, 'primary covers every other table (1 remove + 4 adds)'
    assert others == [2, 2, 2, 2], 'every other line covers only the primary'


def test_two_lines_still_back_each_other_up():
    """At two the O(N) rule collapses to the mutual arrangement it always was."""
    steps, _ = _steps([_line(1), _line(2)])

    assert steps['wan1-dhcp-seed'].count('-bk') == 2
    assert steps['wan2-dhcp-seed'].count('-bk') == 2


# --- pinning ---------------------------------------------------------------

def test_management_can_be_pinned_to_any_line():
    steps, _ = _steps([_line(n) for n in range(1, 6)], pin_management_to='wan3')

    assert 'new-routing-mark=to_WAN3' in steps['pin-mgmt']


# --- safety -----------------------------------------------------------------

def test_a_string_of_backup_tables_does_not_become_one_route_per_letter():
    """Defensive: this generates router config, and a silent per-character
    expansion would write nonsense routes into a live routing table."""
    cmds = lb._gw_route_cmds('wan1', 'to_WAN1', 'to_WAN2', '8.8.8.8', True, '$gw')

    assert sum(1 for c in cmds if '-bk1' in c and 'add' in c) == 1


def test_every_emitted_route_carries_the_teardown_tag():
    """Teardown and the step-0 reset both match on comment~"infora-lb". A route
    tagged anything else survives both and is orphaned on the router forever."""
    steps, _ = _steps([_line(n) for n in range(1, 6)])

    for label, cmd in steps.items():
        if '/ip route add' in cmd:
            for comment in re.findall(r'comment=\\?"([^"\\]+)', cmd):
                assert comment.startswith(lb.LB_COMMENT), f'{label}: {comment}'
