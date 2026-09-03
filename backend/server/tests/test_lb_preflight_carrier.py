"""Pre-flight: catching a dead WAN port before the router's uplink is removed.

The apply retires the router's working DHCP client before the replacement can
bind, and for a DHCP WAN every route it installs comes from the lease script
firing on bind. A port with no carrier never binds, so the router ends up with no
default route at all — still serving its LAN, invisible to us.

Checking carrier costs nothing and happens before anything on the router has been
touched, which is the only point where the answer is free. The rollback guard is
the net; this is not needing the net.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import load_balancing as lb  # noqa: E402

# Real `/interface print` shape: index, flag letters, then the name.
INTERFACES = """Flags: D - DYNAMIC; X - DISABLED; R - RUNNING; S - SLAVE
 #     NAME    TYPE   ACTUAL-MTU
 0  RS ether1  ether  1500
 1  R  ether2  ether  1500
 2     ether3  ether  1500
 3  X  ether4  ether  1500
"""


def test_a_live_port_reads_as_running():
    assert lb._iface_is_running({'interfaces': INTERFACES}, 'ether2') is True


def test_a_port_with_no_carrier_reads_as_not_running():
    assert lb._iface_is_running({'interfaces': INTERFACES}, 'ether3') is False


def test_a_slave_port_still_reports_its_carrier():
    """RS is running AND slave — the two flags are independent."""
    assert lb._iface_is_running({'interfaces': INTERFACES}, 'ether1') is True


def test_an_unknown_port_is_none_not_false():
    """None means "could not tell", and must not be reported to the operator as
    "nothing is plugged in" — that would block a working config on a parse miss."""
    assert lb._iface_is_running({'interfaces': INTERFACES}, 'ether9') is None
    assert lb._iface_is_running({}, 'ether1') is None


def test_the_header_row_is_not_mistaken_for_an_interface():
    assert lb._iface_is_running({'interfaces': 'Flags: R - RUNNING\n'}, 'R') is None


def _preflight(monkeypatch, port, interfaces=INTERFACES, addresses=''):
    monkeypatch.setattr(lb, '_read_router_state', lambda d, **k: {
        'interfaces': interfaces, 'addresses': addresses,
        'bridge_ports': '', 'dhcp_clients': '', 'routes': '',
    })
    config = {
        'mode': 'load_balance', 'lan_interface': 'infora-bridge',
        'wan1': {'port': port, 'type': 'dhcp', 'weight': 1},
        'wan2': {'port': 'ether2', 'type': 'dhcp', 'weight': 1},
    }
    return lb.preflight_wan_config(object(), config)


def test_a_dead_wan_port_blocks_the_push(monkeypatch):
    blockers, _ = _preflight(monkeypatch, 'ether3')

    assert any('no link' in b for b in blockers)


def test_a_live_wan_port_does_not_block(monkeypatch):
    blockers, _ = _preflight(monkeypatch, 'ether2')

    assert not [b for b in blockers if 'no link' in b]


def test_an_unparseable_port_does_not_block(monkeypatch):
    """A parsing miss must not stop an operator configuring a working router."""
    blockers, _ = _preflight(monkeypatch, 'ether2', interfaces='')

    assert not [b for b in blockers if 'no link' in b]


def test_a_live_port_with_no_address_warns_rather_than_blocks(monkeypatch):
    """Carrier but no lease yet is normal mid-setup — say so, do not refuse."""
    blockers, warnings = _preflight(monkeypatch, 'ether2')

    assert not [b for b in blockers if 'no link' in b]
    assert any('DHCP from the ISP' in w for w in warnings)
