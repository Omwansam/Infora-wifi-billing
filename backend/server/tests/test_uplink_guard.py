"""The uplink guard, against the router output that defeated it.

Built from a live RB3011 (device 40) that was provisioned with two ISPs: the
active default route ran over ``pppoe-out-isp1``, so the route check named that
virtual interface and stopped. ``ether1`` — the physical port the PPPoE session
runs on, and a declared member of the ``WAN`` interface list — looked free, was
offered by the wizard, and got bridged into the subscriber domain.

The fixtures are that router's real ``print terse`` output.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.device_config_ops import detect_uplink_interfaces  # noqa: E402


class FakeClient:
    """Answers ``run_cli`` from a dict of command-substring -> output."""

    def __init__(self, responses):
        self.responses = responses
        self.asked = []

    def run_cli(self, command):
        self.asked.append(command)
        for needle, output in self.responses.items():
            if needle in command:
                return output, ''
        return '', ''


# --- The RB3011 that went wrong ------------------------------------------

RB3011 = {
    # Default route is the PPPoE session, not a physical port.
    '/ip route find': 'pppoe-out-isp1',
    '/interface pppoe-client print terse':
        '0 name=pppoe-out-isp1 interface=ether1 user=isp1 disabled=no\n',
    '/interface vlan print terse': '',
    # ether2 is the second ISP, addressed by DHCP.
    '/ip dhcp-client print terse':
        '0 interface=ether2 status=bound address=192.168.0.100/24\n',
    '/interface list member print terse where list=WAN':
        '0 comment=defconf list=WAN interface=ether1 dynamic=no\n'
        '1 comment="WAN2: ISP2 uplink" list=WAN interface=ether2 dynamic=no\n'
        '2 list=WAN interface=pppoe-out-isp1 dynamic=no\n',
    '/interface bridge port print terse where bridge=': '',
}


def test_the_physical_port_under_a_pppoe_uplink_is_guarded():
    """The regression. ether1 carries pppoe-out-isp1; bridging it merges the
    ISP's network into the subscriber one."""
    uplinks = detect_uplink_interfaces(FakeClient(RB3011))
    assert 'ether1' in uplinks, uplinks
    assert 'pppoe-out-isp1' in uplinks


def test_the_dhcp_uplink_is_still_guarded():
    uplinks = detect_uplink_interfaces(FakeClient(RB3011))
    assert 'ether2' in uplinks


def test_service_ports_are_left_assignable():
    """Over-guarding is its own outage: an operator who cannot assign a port
    cannot deploy the router at all."""
    uplinks = detect_uplink_interfaces(FakeClient(RB3011))
    for port in ('ether3', 'ether4', 'ether5', 'ether6', 'ether9', 'ether10'):
        assert port not in uplinks


def test_each_guarded_port_says_why():
    """The operator sees this text when a port is silently dropped from their
    port map, so it has to name the signal that matched."""
    uplinks = detect_uplink_interfaces(FakeClient(RB3011))
    assert 'WAN interface list' in uplinks['ether1'] or 'carries' in uplinks['ether1']
    assert 'DHCP client' in uplinks['ether2'] or 'WAN interface list' in uplinks['ether2']


# --- The older shapes that must keep working -----------------------------

def test_gateway_with_an_interface_suffix():
    """The common case: immediate-gw is `IP%interface`."""
    uplinks = detect_uplink_interfaces(FakeClient({
        '/ip route find': '192.168.2.1%ether1',
        '/interface bridge port print terse where bridge=': '',
    }))
    assert 'ether1' in uplinks


def test_wan_behind_a_factory_bridge_expands_to_its_member_ports():
    """A board routing the WAN through bridgeLocal names the *bridge*; the real
    uplink hides inside it."""
    uplinks = detect_uplink_interfaces(FakeClient({
        '/ip route find': '192.168.2.1%bridgeLocal',
        '/interface bridge port print terse where bridge=bridgeLocal':
            '0 interface=ether1 bridge=bridgeLocal\n',
        '/interface bridge port print terse where bridge=ether1': '',
    }))
    assert 'bridgeLocal' in uplinks
    assert 'ether1' in uplinks


def test_our_own_bridges_are_never_uplinks():
    """A stray DHCP client on the service bridge must not lock the operator out
    of assigning any port at all."""
    uplinks = detect_uplink_interfaces(FakeClient({
        '/ip dhcp-client print terse':
            '0 interface=infora-bridge status=bound\n'
            '1 interface=infora-mgmt-bridge status=bound\n',
        '/interface bridge port print terse where bridge=': '',
    }))
    assert 'infora-bridge' not in uplinks
    assert 'infora-mgmt-bridge' not in uplinks


def test_a_bare_gateway_ip_names_no_interface():
    """immediate-gw without a suffix and without a route interface is an
    address, not a port — guarding it would invent one."""
    uplinks = detect_uplink_interfaces(FakeClient({
        '/ip route find': '192.168.2.1',
        '/interface bridge port print terse where bridge=': '',
    }))
    assert '192.168.2.1' not in uplinks
    assert uplinks == {}


def test_an_empty_router_guards_nothing():
    assert detect_uplink_interfaces(FakeClient({})) == {}


def test_detection_survives_a_command_that_errors():
    """Detection is best-effort: a RouterOS build without /interface list must
    not abort the whole guard and leave every uplink unprotected."""
    class Exploding(FakeClient):
        def run_cli(self, command):
            if '/interface list member' in command:
                raise RuntimeError('no such command')
            return super().run_cli(command)

    uplinks = detect_uplink_interfaces(Exploding({
        '/ip dhcp-client print terse': '0 interface=ether2 status=bound\n',
        '/interface bridge port print terse where bridge=': '',
    }))
    assert 'ether2' in uplinks


def test_result_supports_membership_and_truthiness():
    """list_interfaces() and configure_services() both use it as a set."""
    uplinks = detect_uplink_interfaces(FakeClient(RB3011))
    assert bool(uplinks)
    assert 'ether1' in uplinks
    assert [p for p in ('ether1', 'ether3') if p in uplinks] == ['ether1']


# --- The management port must be discoverable ----------------------------

def test_management_bridge_joins_the_discovery_lists():
    """A management port nobody can find is not a management port. Winbox
    neighbour discovery and MAC-Winbox are both scoped to an interface list,
    and a new bridge starts in none of them."""
    from services.device_config_ops import build_services_commands

    steps, _params = build_services_commands({
        'port_roles': {'ether9': 'hotspot', 'ether10': 'management'},
    })
    commands = ' '.join(c for step in steps for c in step['commands'])
    assert '/ip neighbor discovery-settings get discover-interface-list' in commands
    assert '/tool mac-server get allowed-interface-list' in commands
    assert '/tool mac-server mac-winbox get allowed-interface-list' in commands
    assert 'interface=infora-mgmt-bridge' in commands


@pytest.mark.parametrize('pseudo', ['all', 'none'])
def test_builtin_pseudo_lists_are_skipped(pseudo):
    """Membership is meaningless for `all` and deliberate for `none`."""
    from services.device_config_ops import _join_interface_list

    command = _join_interface_list('/tool mac-server', 'allowed-interface-list')
    assert f'$l != "{pseudo}"' in command
    assert command.startswith(':do {') and command.endswith('on-error={}')
