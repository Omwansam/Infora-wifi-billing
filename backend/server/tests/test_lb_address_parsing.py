"""Reading addresses off a router, in the format it actually prints.

`_addresses_on` only understood the terse form (`address=… interface=…`), but
`_read_router_state` collects `/ip address print without-paging`, which is
columnar. So it returned nothing for every port on every router — and that
silently disabled the blocker above it, the one that catches a "WAN" patched into
our own LAN. That is the exact wiring mistake that cost us Kifaru, and the check
written to prevent it had never fired once.

Fixtures are the real output from Fusion.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import load_balancing as lb  # noqa: E402

COLUMNAR = """Flags: D - DYNAMIC
Columns: ADDRESS, NETWORK, INTERFACE, VRF
#   ADDRESS           NETWORK       INTERFACE           VRF
;;; defconf
0   192.168.88.1/24   192.168.88.0  bridge              main
1 D 192.168.0.100/24  192.168.0.0   ether1              main
;;; infora-mgmt-tunnel
2   10.250.0.5/24     10.250.0.0    wg-mgmt             main
;;; infora-billing
3   172.31.0.1/16     172.31.0.0    infora-bridge       main
"""

TERSE = ('address=10.0.0.1/24 interface=ether5 network=10.0.0.0\n'
         'address=10.9.0.1/24 interface=ether6 network=10.9.0.0\n')


def test_columnar_output_is_read():
    state = {'addresses': COLUMNAR}

    assert lb._addresses_on(state, 'ether1') == ['192.168.0.100/24']
    assert lb._addresses_on(state, 'infora-bridge') == ['172.31.0.1/16']


def test_terse_output_still_works():
    """Both shapes are in play depending on the caller; neither may regress."""
    assert lb._addresses_on({'addresses': TERSE}, 'ether5') == ['10.0.0.1/24']


def test_a_port_with_no_address_returns_nothing():
    assert lb._addresses_on({'addresses': COLUMNAR}, 'ether2') == []


def test_header_and_comment_rows_are_not_parsed_as_addresses():
    assert lb._addresses_on({'addresses': COLUMNAR}, 'ADDRESS') == []
    assert lb._addresses_on({'addresses': COLUMNAR}, 'defconf') == []


def test_a_similar_interface_name_does_not_match():
    """ether1 must not match the ether10 row — substring matching would."""
    state = {'addresses': COLUMNAR + ' 4   10.5.0.1/24  10.5.0.0  ether10  main\n'}

    assert lb._addresses_on(state, 'ether1') == ['192.168.0.100/24']
    assert lb._addresses_on(state, 'ether10') == ['10.5.0.1/24']


def test_the_lan_address_can_now_be_found():
    """Everything downstream of this was dead while it returned None."""
    assert lb._lan_address({'addresses': COLUMNAR}, 'infora-bridge') == '172.31.0.1/16'


def test_a_wan_patched_into_the_lan_is_finally_blocked(monkeypatch):
    """The Kifaru wiring: a 'WAN' leasing from the router's own LAN pool."""
    state = {
        'interfaces': ' 0 R  ether1  ether 1500\n 1 R  ether2  ether 1500\n',
        'addresses': COLUMNAR + ' 4   172.31.5.9/16  172.31.0.0  ether2  main\n',
        'bridge_ports': '', 'dhcp_clients': '', 'routes': '',
    }
    monkeypatch.setattr(lb, '_read_router_state', lambda d, **k: state)
    config = {
        'mode': 'failover', 'lan_interface': 'infora-bridge',
        'wan1': {'port': 'ether1', 'type': 'dhcp', 'weight': 1},
        'wan2': {'port': 'ether2', 'type': 'dhcp', 'weight': 1},
    }

    blockers, _ = lb.preflight_wan_config(object(), config)

    assert any('inside the LAN subnet' in b for b in blockers)


def test_a_port_that_has_an_address_is_not_warned_about(monkeypatch):
    """The false warning this bug produced: ether1 holds 192.168.0.100/24."""
    state = {
        'interfaces': ' 0 R  ether1  ether 1500\n 1 R  ether2  ether 1500\n',
        'addresses': COLUMNAR, 'bridge_ports': '', 'dhcp_clients': '', 'routes': '',
    }
    monkeypatch.setattr(lb, '_read_router_state', lambda d, **k: state)
    config = {
        'mode': 'failover', 'lan_interface': 'infora-bridge',
        'wan1': {'port': 'ether1', 'type': 'dhcp', 'weight': 1},
        'wan2': {'port': 'ether2', 'type': 'dhcp', 'weight': 1},
    }

    _, warnings = lb.preflight_wan_config(object(), config)

    assert not [w for w in warnings if w.startswith('wan1:') and 'no address yet' in w]
    # ether2 genuinely has none, so that one should still be raised.
    assert [w for w in warnings if w.startswith('wan2:') and 'no address yet' in w]
