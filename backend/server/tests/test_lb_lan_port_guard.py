"""The two gaps that cost Fusion four days offline.

Fusion had ether2 declared a PPPoE subscriber port in `service_config` and
selected as WAN2 in `wan_config`. The apply reclaimed it from the LAN bridge, so
the router pointed a "WAN" at its own customers; the recursive default failed
over onto that line and the management tunnel never came back. The router itself
stayed perfectly healthy the whole time — uptime climbing, CPU at 2% — which is
why nothing else on the page caught it.

Two defects, tested here:

1. Pre-flight treated "is a bridge slave" as a WARNING. It has to stay a warning
   in general (a factory MikroTik bridges ether1 in defconf, and reclaiming it is
   the entire point of the apply) but being a slave of *our own LAN bridge* is a
   different fact and must block.
2. Teardown never restored bridge membership, so "Disable dual-WAN" reported
   success while the subscriber port stayed dead.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import load_balancing as lb  # noqa: E402

# Fusion's shape: ether1 the real uplink, ether2 a port of the service bridge.
BRIDGE_PORTS = """Flags: I - INACTIVE; H - HW-OFFLOAD
 #   INTERFACE  BRIDGE          HW   PVID
 0 H ether2     infora-bridge   yes     1
 1 H ether3     infora-bridge   yes     1
"""

# A factory router: ether1 sits in defconf's own bridge, not ours.
DEFCONF_PORTS = """Flags: I - INACTIVE; H - HW-OFFLOAD
 #   INTERFACE  BRIDGE       HW   PVID
 0 H ether1     bridgeLocal  yes     1
"""


class FakeDevice:
    def __init__(self, wan_config=None, service_config=None):
        self.wan_config = wan_config
        self.service_config = service_config
        self.device_name = 'Fusion'


# --------------------------------------------------------------- slave-of ---

def test_a_service_bridge_port_is_recognised():
    assert lb._is_slave_of({'bridge_ports': BRIDGE_PORTS}, 'ether2', 'infora-bridge') is True


def test_a_port_in_a_different_bridge_is_not_ours():
    """The factory case. ether1 is a slave, but not of the LAN bridge."""
    assert lb._is_slave_of({'bridge_ports': DEFCONF_PORTS}, 'ether1', 'infora-bridge') is False
    # ...while the generic slave test still sees it, so the warning still fires.
    assert lb._iface_is_slave({'bridge_ports': DEFCONF_PORTS}, 'ether1') is True


def test_a_free_port_is_in_no_bridge():
    assert lb._is_slave_of({'bridge_ports': BRIDGE_PORTS}, 'ether9', 'infora-bridge') is False


def test_no_bridge_name_never_matches():
    assert lb._is_slave_of({'bridge_ports': BRIDGE_PORTS}, 'ether2', '') is False


# ------------------------------------------------------------ restore list ---

FUSION_SERVICE = ('{"port_roles": {"ether2": "pppoe", "ether3": "pppoe", '
                  '"ether10": "management"}}')
FUSION_WAN = ('{"mode": "load_balance", "lan_interface": "infora-bridge", '
              '"wan1": {"port": "ether1"}, "wan2": {"port": "ether2"}}')


def test_only_the_subscriber_port_is_restored():
    """ether2 was a LAN port and goes back; ether1 was the uplink and does not."""
    pairs = lb.ports_to_restore(FakeDevice(FUSION_WAN, FUSION_SERVICE))
    assert pairs == [('ether2', 'infora-bridge')]


def test_a_real_second_uplink_is_never_bridged():
    """The dangerous case: re-bridging an ISP handoff would leak DHCP onto the LAN."""
    wan = ('{"mode": "failover", "lan_interface": "infora-bridge", '
           '"lines": [{"port": "ether1"}, {"port": "ether9"}]}')
    assert lb.ports_to_restore(FakeDevice(wan, FUSION_SERVICE)) == []


def test_a_skipped_port_is_not_restored():
    service = '{"port_roles": {"ether2": "skip"}}'
    assert lb.ports_to_restore(FakeDevice(FUSION_WAN, service)) == []


def test_no_service_config_restores_nothing():
    """Unknown provenance means we must not guess."""
    assert lb.ports_to_restore(FakeDevice(FUSION_WAN, None)) == []


def test_the_new_lines_shape_is_read_too():
    wan = ('{"mode": "load_balance", "lan_interface": "infora-bridge", '
           '"lines": [{"id": "wan1", "port": "ether1"}, {"id": "wan2", "port": "ether3"}]}')
    assert lb.ports_to_restore(FakeDevice(wan, FUSION_SERVICE)) == [('ether3', 'infora-bridge')]


# ---------------------------------------------------------------- teardown ---

def test_teardown_rebridges_only_what_it_is_given():
    steps = lb.build_lb_remove_steps(restore_ports=[('ether2', 'infora-bridge')])
    cmds = '\n'.join(cmd for _, cmd in steps)
    assert 'bridge port add bridge=infora-bridge interface=ether2' in cmds
    # Guarded, so running teardown twice cannot add a duplicate port row.
    assert 'bridge port find interface=ether2' in cmds


def test_teardown_without_restore_ports_touches_no_bridge():
    cmds = '\n'.join(cmd for _, cmd in lb.build_lb_remove_steps())
    assert 'bridge port add' not in cmds


def test_teardown_still_strips_every_lb_artifact():
    """The rebridge must not have displaced the original teardown."""
    cmds = '\n'.join(cmd for _, cmd in lb.build_lb_remove_steps(
        restore_ports=[('ether2', 'infora-bridge')]))
    for fragment in ('firewall mangle remove', 'firewall nat remove', 'route remove',
                     'routing table remove', 'infora-masquerade'):
        assert fragment in cmds


# --------------------------------------------------------------- preflight ---

FUSION_INTERFACES = """Flags: D - DYNAMIC; X - DISABLED; R - RUNNING; S - SLAVE
 #     NAME           TYPE    ACTUAL-MTU
 0  R  ether1         ether   1500
 1  RS ether2         ether   1500
 2  RS ether3         ether   1500
 3  R  infora-bridge  bridge  1500
"""

FUSION_STATE = {
    'interfaces': FUSION_INTERFACES,
    'bridge_ports': BRIDGE_PORTS,
    'addresses': ' 0  192.168.88.1/24  192.168.88.0  infora-bridge\n',
    'dhcp_clients': ' 0  ether1  yes  bound\n',
    'routes': '', 'mangle': '', 'nat': '', 'tables': '',
}


def _preflight(monkeypatch, config, state=None):
    monkeypatch.setattr(lb, '_read_router_state', lambda *a, **k: state or FUSION_STATE)
    return lb.preflight_wan_config(FakeDevice(), config)


def test_the_fusion_config_is_now_blocked(monkeypatch):
    """The exact config that stranded Fusion: ether2 is a LAN bridge port."""
    blockers, _ = _preflight(monkeypatch, {
        'mode': 'load_balance', 'lan_interface': 'infora-bridge',
        'wan1': {'port': 'ether1', 'type': 'dhcp'},
        'wan2': {'port': 'ether2', 'type': 'dhcp'},
        'probe_hosts': ['8.8.8.8', '1.0.0.1'],
    })
    assert any('ether2' in b and 'infora-bridge' in b for b in blockers), blockers


def test_the_block_says_how_to_clear_it(monkeypatch):
    blockers, _ = _preflight(monkeypatch, {
        'mode': 'failover', 'lan_interface': 'infora-bridge',
        'wan1': {'port': 'ether1', 'type': 'dhcp'},
        'wan2': {'port': 'ether2', 'type': 'dhcp'},
        'probe_hosts': ['8.8.8.8', '1.0.0.1'],
    })
    joined = ' '.join(blockers)
    assert 'serving subscribers' in joined and 'Configure Services' in joined


def test_a_factory_bridged_uplink_still_only_warns(monkeypatch):
    """ether1 in defconf's bridge must remain applyable — that is the normal case."""
    state = dict(FUSION_STATE, bridge_ports=DEFCONF_PORTS)
    blockers, warnings = _preflight(monkeypatch, {
        'mode': 'failover', 'lan_interface': 'infora-bridge',
        'wan1': {'port': 'ether1', 'type': 'dhcp'},
        'wan2': {'port': 'ether3', 'type': 'dhcp'},
        'probe_hosts': ['8.8.8.8', '1.0.0.1'],
    }, state=state)
    assert blockers == [], blockers
    assert any('bridge slave' in w for w in warnings), warnings
