"""Tests for dual-WAN load balancing.

The fixtures here are real output captured from Kifaru (hEX lite, RouterOS
7.23.2) while its load balancing was silently inert — every WAN1 rule accepted
by the router and then flagged invalid, and "WAN2" patched into the router's own
LAN. That state is the regression these tests exist to catch, so the strings are
reproduced verbatim rather than idealised.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services import load_balancing as lb  # noqa: E402


class FakeDevice:
    device_name = 'Kifaru'
    os_version = '7.23.2 (stable)'
    id = 37


# --- captured from the live router -----------------------------------------

BROKEN_INTERFACES = """\
Flags: R - RUNNING; S - SLAVE
Columns: NAME, TYPE, ACTUAL-MTU, L2MTU, MAX-L2MTU, MAC-ADDRESS
#    NAME                TYPE      ACTUAL-MTU  L2MTU  MAX-  MAC-ADDRESS
0 RS ether1              ether           1500   1598  2028  E4:8D:8C:96:A3:19
1 R  ether2              ether           1500   1598  2028  E4:8D:8C:96:A3:1A
2    ether3              ether           1500   1598  2028  E4:8D:8C:96:A3:1B
3  S ether4              ether           1500   1598  2028  E4:8D:8C:96:A3:1C
6 R  infora-bridge       bridge          1500   1598        E4:8D:8C:96:A3:1A
"""

BROKEN_BRIDGE_PORTS = """\
Flags: I - INACTIVE; H - HW-OFFLOAD
Columns: INTERFACE, BRIDGE, HW, HORIZON, PVID
#    INTERFACE  BRIDGE         HW   HORI  P
0  H ether1     bridgeLocal    yes  none  1
1 I  ether4     infora-bridge  yes  none  1
"""

BROKEN_ADDRESSES = """\
Flags: X - DISABLED, I - INVALID; D - DYNAMIC; S - SLAVE
 1     ;;; infora-billing
       address=172.31.0.1/16 network=172.31.0.0 interface=infora-bridge
       actual-interface=infora-bridge vrf=main

 3  D  address=172.31.0.101/16 network=172.31.0.0 interface=ether2
       actual-interface=ether2 vrf=main
"""

BROKEN_MANGLE = """\
Flags: X - DISABLED, I - INVALID; D - DYNAMIC
 0 I  ;;; infora-lb
      ;;; in/out-interface matcher not possible when interface (ether1) is slave - use master instead (bridgeLocal)
      chain=input action=mark-connection new-connection-mark=WAN1_conn
      passthrough=yes in-interface=ether1

 1    ;;; infora-lb
      chain=input action=mark-connection new-connection-mark=WAN2_conn
      passthrough=yes in-interface=ether2
"""

BROKEN_DHCP = """\
Flags: X - DISABLED, I - INVALID, D - DYNAMIC
 0   ;;; defconf
     name="client1" interface=bridgeLocal add-default-route=yes status=bound

 1 I ;;; infora-wan-dhcp
     ;;; DHCP client can not run on slave or passthrough interface!
     name="client2" interface=ether1 add-default-route=yes status=bound
"""

HEALTHY_INTERFACES = """\
Flags: R - RUNNING; S - SLAVE
#    NAME           TYPE    ACTUAL-MTU
0 R  ether1         ether         1500
1 R  ether2         ether         1500
6 R  infora-bridge  bridge        1500
"""

HEALTHY_ADDRESSES = """\
Flags: X - DISABLED, I - INVALID; D - DYNAMIC
 0     address=172.31.0.1/16 network=172.31.0.0 interface=infora-bridge
       actual-interface=infora-bridge vrf=main

 1  D  address=41.90.10.5/24 network=41.90.10.0 interface=ether1
       actual-interface=ether1 vrf=main

 2  D  address=105.20.30.7/24 network=105.20.30.0 interface=ether2
       actual-interface=ether2 vrf=main
"""


def _config(**over):
    base = {
        'mode': 'failover', 'lan_interface': 'infora-bridge',
        'wan1': {'port': 'ether1', 'type': 'dhcp', 'weight': 1},
        'wan2': {'port': 'ether2', 'type': 'dhcp', 'weight': 1},
        'probe_hosts': ['8.8.8.8', '1.0.0.1'], 'primary_wan': 'wan1',
        'subscriber_list': 'ISP2-SUBS', 'pin_management_to': None, 'enabled': True,
    }
    base.update(over)
    return base


def _state(**over):
    base = {
        'interfaces': HEALTHY_INTERFACES,
        'bridge_ports': 'Columns: INTERFACE, BRIDGE\n',
        'addresses': HEALTHY_ADDRESSES,
        'dhcp_clients': '',
        'routes': '  DAd+ 0.0.0.0/0  41.90.10.1  main  1\n',
        'mangle': '', 'nat': '', 'tables': '',
    }
    base.update(over)
    return base


# --- the root cause: both WAN ports must be reclaimed ----------------------

def test_both_wan_ports_are_reclaimed_from_any_bridge():
    """Only WAN2 used to be reclaimed. On a factory hEX, defconf leaves ether1
    in bridgeLocal, and RouterOS then refuses every rule WAN1 needs."""
    steps = dict(lb.build_lb_steps(FakeDevice(), _config()))

    assert 'reclaim-wan1' in steps, 'WAN1 is never freed from its bridge'
    assert 'reclaim-wan2' in steps
    assert 'ether1' in steps['reclaim-wan1']
    assert 'ether2' in steps['reclaim-wan2']
    for label in ('reclaim-wan1', 'reclaim-wan2'):
        assert '/interface bridge port remove' in steps[label]


def test_defconf_uplink_is_demoted_not_removed():
    """defconf's client installs a competing distance-1 default, so the recursive
    failover defaults never win — but it is also usually the router's ONLY route,
    and the push travels over it. Deleting it cut the connection mid-push and
    stranded the router. Demoting settles the competition without the cliff."""
    steps = dict(lb.build_lb_steps(FakeDevice(), _config()))

    assert 'demote-defconf-dhcp' in steps
    assert 'retire-defconf-dhcp' not in steps, 'the uplink must never be deleted'
    assert 'comment="defconf"' in steps['demote-defconf-dhcp']
    assert f'default-route-distance={lb.FALLBACK_ROUTE_DISTANCE}' in steps['demote-defconf-dhcp']
    assert 'remove' not in steps['demote-defconf-dhcp']


def test_no_step_ever_deletes_a_dhcp_client():
    """The whole class of outage: one command between removing the working client
    and the replacement binding is enough to lose the router."""
    for label, cmd in lb.build_lb_steps(FakeDevice(), _config()):
        assert not ('dhcp-client remove' in cmd), f'{label} deletes a DHCP client'


def test_an_existing_client_is_adopted_rather_than_replaced():
    """RouterOS allows one client per interface, so remove-then-add leaves the WAN
    unaddressed in between — on the WAN carrying the tunnel that gap is the outage."""
    steps = dict(lb.build_lb_steps(FakeDevice(), _config()))

    assert '[:len [/ip dhcp-client find interface=ether1]]=0' in steps['wan1-dhcp-ensure']
    assert '/ip dhcp-client set' in steps['wan1-dhcp-configure']
    assert f'default-route-distance={lb.FALLBACK_ROUTE_DISTANCE}' in steps['wan1-dhcp-configure']


def test_teardown_restores_the_client_instead_of_deleting_it():
    """By teardown the infora-lb client is usually the router's original uplink
    wearing our comment. Removing it would strand the router on Disable."""
    steps = dict(lb.build_lb_remove_steps(_config()))

    assert 'restore-dhcp' in steps
    assert 'remove-dhcp' not in steps
    assert 'add-default-route=yes' in steps['restore-dhcp']
    assert 'default-route-distance=1' in steps['restore-dhcp']


def test_ports_are_reclaimed_before_addressing_is_applied():
    """Order matters: a DHCP client added to a still-enslaved port is rejected."""
    labels = [label for label, _ in lb.build_lb_steps(FakeDevice(), _config())]
    assert labels.index('reclaim-wan1') < labels.index('wan1-dhcp-ensure')
    assert labels.index('reclaim-wan2') < labels.index('wan2-dhcp-ensure')


def test_masquerade_exists_for_both_wans():
    steps = dict(lb.build_lb_steps(FakeDevice(), _config()))
    assert 'out-interface=ether1' in steps['nat-1']
    assert 'out-interface=ether2' in steps['nat-2']
    assert 'action=masquerade' in steps['nat-1']


# --- parsing the router's own output ---------------------------------------

def test_slave_detection_on_real_output():
    state = _state(interfaces=BROKEN_INTERFACES, bridge_ports=BROKEN_BRIDGE_PORTS)
    assert lb._iface_is_slave(state, 'ether1') is True
    assert lb._iface_is_slave(state, 'ether4') is True
    assert lb._iface_is_slave(state, 'ether2') is False
    assert lb._iface_is_slave(state, 'ether3') is False


def test_address_extraction():
    state = _state(addresses=BROKEN_ADDRESSES)
    assert '172.31.0.101/16' in lb._addresses_on(state, 'ether2')
    assert '172.31.0.1/16' in lb._addresses_on(state, 'infora-bridge')
    assert lb._addresses_on(state, 'ether1') == []


@pytest.mark.parametrize('a,b,overlaps', [
    ('172.31.0.101/16', '172.31.0.1/16', True),
    ('41.90.10.5/24', '172.31.0.1/16', False),
    ('192.168.1.101/24', '172.31.0.1/16', False),
    (None, '172.31.0.1/16', False),
    ('garbage', '172.31.0.1/16', False),
])
def test_same_subnet(a, b, overlaps):
    assert lb._same_subnet(a, b) is overlaps


def test_invalid_objects_are_surfaced_with_routeros_reason():
    state = _state(mangle=BROKEN_MANGLE, dhcp_clients=BROKEN_DHCP)
    problems = lb._invalid_lb_objects(state)
    joined = ' '.join(reason for _, reason in problems)
    assert problems, 'RouterOS rejected rules but none were reported'
    assert 'not possible' in joined or 'can not run' in joined


def test_only_broken_objects_are_reported_as_invalid():
    """BROKEN_MANGLE holds one rejected rule and one healthy one. Reporting the
    healthy one too — which an earlier version did — makes the failure list
    untrustworthy."""
    problems = lb._invalid_lb_objects(_state(mangle=BROKEN_MANGLE))
    assert len(problems) == 1, problems
    assert 'ether1' in problems[0][1]


def test_no_invalid_objects_on_a_clean_router():
    healthy = (
        'Flags: X - DISABLED, I - INVALID; D - DYNAMIC\n'
        ' 0    ;;; infora-lb\n'
        '      chain=srcnat action=masquerade out-interface=ether1\n'
        '\n'
        ' 1    ;;; infora-lb\n'
        '      chain=srcnat action=masquerade out-interface=ether2\n'
    )
    assert lb._invalid_lb_objects(_state(nat=healthy)) == []


# --- block parsing / flag reading ------------------------------------------

BROKEN_NAT = """\
Flags: X - DISABLED, I - INVALID; D - DYNAMIC
 0 I  ;;; infora-lb
      ;;; in/out-interface matcher not possible when interface (ether1) is slave - use master instead (bridgeLocal)
      chain=srcnat action=masquerade out-interface=ether1

 1    ;;; infora-lb
      chain=srcnat action=masquerade out-interface=ether2
"""


def test_masquerade_on_a_slave_port_is_not_counted_as_active():
    """The false pass: the rule text is there, but RouterOS rejected it, so
    nothing out that interface is NAT'd."""
    assert lb._rule_is_active(BROKEN_NAT, 'out-interface=ether1') is False
    assert lb._rule_is_active(BROKEN_NAT, 'out-interface=ether2') is True
    assert lb._rule_is_active(BROKEN_NAT, 'out-interface=ether9') is False


@pytest.mark.parametrize('header,expected', [
    ('0 I  ;;; infora-lb', ['I']),
    ('1    ;;; infora-lb', []),
    ('0 I  chain=srcnat action=masquerade', ['I']),
    ('1    chain=srcnat action=masquerade', []),
    ('0  Is  0.0.0.0/0  8.8.8.8  main  1', ['Is']),
    ('  DAd+ 0.0.0.0/0  192.168.1.1  main  1', []),
    ('3  X  chain=input', ['X']),
])
def test_flag_extraction(header, expected):
    assert lb._block_flags([header]) == expected


@pytest.mark.parametrize('header,broken', [
    ('0 I  ;;; infora-lb', True),      # invalid rule
    ('0  Is  0.0.0.0/0', True),        # inactive route
    ('3  X  chain=input', True),       # disabled
    ('1    ;;; infora-lb', False),
    ('  DAc  10.250.0.0/24', False),   # dynamic+active+connected
])
def test_broken_detection(header, broken):
    assert lb._block_is_broken([header]) is broken


def test_blocks_split_without_blank_line_separators():
    text = (
        ' 0    chain=srcnat action=masquerade out-interface=ether1\n'
        ' 1 I  chain=srcnat action=masquerade out-interface=ether2\n'
    )
    blocks = list(lb._iter_rule_blocks(text))
    assert len(blocks) == 2, blocks
    assert lb._rule_is_active(text, 'out-interface=ether1') is True
    assert lb._rule_is_active(text, 'out-interface=ether2') is False


# --- pre-flight -------------------------------------------------------------

def test_preflight_blocks_a_wan_patched_into_our_own_lan(monkeypatch):
    """Kifaru's ether2 leased 172.31.0.101 from this router's own pool, so the
    "WAN2" default pointed back into the LAN. That is a loop, not an uplink."""
    monkeypatch.setattr(lb, '_read_router_state',
                        lambda *a, **k: _state(addresses=BROKEN_ADDRESSES))
    blockers, _ = lb.preflight_wan_config(FakeDevice(), _config())
    assert any('LAN subnet' in b for b in blockers), blockers


def test_preflight_blocks_a_missing_interface(monkeypatch):
    monkeypatch.setattr(lb, '_read_router_state', lambda *a, **k: _state())
    blockers, _ = lb.preflight_wan_config(
        FakeDevice(), _config(wan2={'port': 'ether9', 'type': 'dhcp', 'weight': 1}))
    assert any('does not exist' in b for b in blockers), blockers


def test_preflight_blocks_using_the_lan_as_a_wan(monkeypatch):
    monkeypatch.setattr(lb, '_read_router_state', lambda *a, **k: _state())
    blockers, _ = lb.preflight_wan_config(
        FakeDevice(), _config(wan2={'port': 'infora-bridge', 'type': 'dhcp', 'weight': 1}))
    assert any('LAN interface' in b for b in blockers), blockers


def test_preflight_warns_but_does_not_block_on_a_slave_port(monkeypatch):
    """The push now reclaims it, so this is information, not a refusal."""
    monkeypatch.setattr(lb, '_read_router_state', lambda *a, **k: _state(
        interfaces=BROKEN_INTERFACES, bridge_ports=BROKEN_BRIDGE_PORTS,
        addresses=HEALTHY_ADDRESSES))
    blockers, warnings = lb.preflight_wan_config(FakeDevice(), _config())
    assert not blockers, blockers
    assert any('bridge slave' in w for w in warnings), warnings


def test_preflight_explains_what_happens_to_the_existing_uplink(monkeypatch):
    """It used to warn the uplink would be removed and to expect a site visit.
    It is not removed any more, so the warning must say what actually happens —
    an operator who still believes the old one will not run this at all."""
    monkeypatch.setattr(lb, '_read_router_state',
                        lambda *a, **k: _state(dhcp_clients=BROKEN_DHCP))

    _, warnings = lb.preflight_wan_config(FakeDevice(), _config())

    text = ' '.join(warnings)
    assert 'demoted' in text
    assert 'without a route' in text
    assert 'site visit' not in text


def test_preflight_passes_on_a_healthy_router(monkeypatch):
    monkeypatch.setattr(lb, '_read_router_state', lambda *a, **k: _state())
    blockers, _ = lb.preflight_wan_config(FakeDevice(), _config())
    assert blockers == []


def test_unreachable_router_is_a_blocker(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError('ssh timed out')
    monkeypatch.setattr(lb, '_read_router_state', boom)
    blockers, _ = lb.preflight_wan_config(FakeDevice(), _config())
    assert blockers and 'pre-check' in blockers[0]


def test_preflight_is_a_noop_when_mode_is_off(monkeypatch):
    monkeypatch.setattr(lb, '_read_router_state',
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError('should not read')))
    assert lb.preflight_wan_config(FakeDevice(), _config(mode='off')) == ([], [])


# --- post-push verification -------------------------------------------------

def test_verification_fails_on_the_exact_state_we_found(monkeypatch):
    """The whole point: this config previously reported as applied and healthy."""
    monkeypatch.setattr(lb, '_read_router_state', lambda *a, **k: _state(
        interfaces=BROKEN_INTERFACES, bridge_ports=BROKEN_BRIDGE_PORTS,
        addresses=BROKEN_ADDRESSES, mangle=BROKEN_MANGLE, dhcp_clients=BROKEN_DHCP,
        nat=BROKEN_NAT, tables='', routes=' 0  Is  0.0.0.0/0  8.8.8.8  main  1\n'))
    checks = lb.verify_lb(FakeDevice(), _config())
    failed = {c['id'] for c in checks if not c['ok']}

    assert 'wan1-free' in failed, 'enslaved WAN1 not caught'
    assert 'no-invalid' in failed, 'RouterOS-rejected rules not caught'
    assert 'wan2-address' in failed, 'LAN-subnet WAN2 not caught'
    assert 'tables' in failed
    assert 'default-active' in failed, 'inactive defaults not caught'
    # WAN1's masquerade is present but rejected; WAN2's is genuinely fine. The
    # invalid one must fail even though a grep for its text would match.
    assert 'wan1-nat' in failed, 'invalid masquerade reported as working'
    assert 'wan2-nat' not in failed, 'valid masquerade wrongly failed'


def test_verification_passes_on_a_healthy_router(monkeypatch):
    monkeypatch.setattr(lb, '_read_router_state', lambda *a, **k: _state(
        tables='0 D name="main" fib\n1 name="to_WAN1" fib\n2 name="to_WAN2" fib\n',
        nat=('chain=srcnat action=masquerade out-interface=ether1\n'
             'chain=srcnat action=masquerade out-interface=ether2\n'),
        routes='  DAd+ 0.0.0.0/0  41.90.10.1  main  1\n',
    ))
    checks = lb.verify_lb(FakeDevice(), _config())
    failed = [c for c in checks if not c['ok']]
    assert not failed, failed


def test_verification_of_teardown(monkeypatch):
    monkeypatch.setattr(lb, '_read_router_state', lambda *a, **k: _state())
    checks = lb.verify_lb(FakeDevice(), _config(mode='off'))
    assert checks[0]['id'] == 'torn-down'
    assert checks[0]['ok'] is True


def test_verification_reports_an_unreachable_router(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError('no route to host')
    monkeypatch.setattr(lb, '_read_router_state', boom)
    checks = lb.verify_lb(FakeDevice(), _config())
    assert checks == [c for c in checks if not c['ok']]
    assert checks[0]['id'] == 'reachable'


# --- endpoint contract ------------------------------------------------------

def _devices_source():
    import pathlib

    return (pathlib.Path(__file__).resolve().parents[1] / 'routes' / 'devices.py').read_text()


def _function_body(name):
    """Source of one top-level function.

    Stops at the next top-level `def`, not the next `@devices_bp` — the helper
    that does the actual pushing sits between the route and the next decorated
    one, so splitting on the decorator swept it into the route's body and the
    "nothing blocking in the request" assertion could never fail.
    """
    import re

    body = _devices_source().split(f'def {name}')[1]
    match = re.search(r'\n(?=@devices_bp|def )', body)
    return body[:match.start()] if match else body


def test_apply_preflights_verifies_and_gates_the_save():
    """Persisting an unverified config is what let the console claim LB was live
    while the router ignored it.

    Asserted against `_apply_load_balancing`, which is where the push moved when
    it became a background job — the route itself now only starts the job.
    """
    body = _function_body('_apply_load_balancing')

    assert 'preflight_wan_config' in body, 'no pre-flight before pushing'
    assert 'verify_lb' in body, 'no verification after pushing'
    assert body.index('preflight_wan_config') < body.index('push_lb_steps')
    assert body.index('push_lb_steps') < body.index('verify_lb')
    # The save must sit behind result['ok'], which verification can clear.
    assert body.index('verify_lb') < body.index('device.wan_config = json.dumps')


def test_applying_never_blocks_the_request():
    """The push must not run inside the HTTP handler.

    Three SSH sessions against a router that answers in tens of seconds passes
    Cloudflare's ~100s ceiling, which returned a 524 while the work carried on
    holding the device's SSH lock — so the operator's retry then failed with
    "device busy" and one slow push looked like two unrelated errors.
    """
    route = _function_body('configure_load_balancing')

    assert 'start_job' in route, 'apply must be handed to a background job'
    for blocking in ('push_lb_steps(', 'verify_lb(', 'preflight_wan_config('):
        assert blocking not in route, f'{blocking} still runs inside the request'


def test_a_second_apply_returns_the_running_job():
    """Two concurrent pushes to one router is how a half-applied config happens."""
    route = _function_body('configure_load_balancing')

    assert 'running_job_for' in route
    assert route.index('running_job_for') < route.index('start_job')


# --- routes must appear without waiting for a bind event --------------------

def test_routes_are_seeded_from_the_current_lease():
    """The lease script fires on *bind*. An adopted client is usually already
    bound, and `renew` on a bound client renews without a bind event — so its
    script never ran and its probe route never appeared, leaving that WAN's
    recursive default flagged invalid. Fusion showed exactly that: WAN2's client
    was new and bound cleanly, WAN1's was adopted and installed nothing."""
    steps = dict(lb.build_lb_steps(FakeDevice(), _config()))

    seed = steps['wan1-dhcp-seed']
    assert '/ip dhcp-client get [find interface=ether1] gateway' in seed
    assert 'infora-lb-probe1' in seed, 'the probe route the default resolves through'
    assert ':if ([:len $gw] > 0)' in seed, 'must no-op on a client that has not bound'
    assert 'wan1-dhcp-renew' not in steps, 'renew does not fire the script'


def test_seed_and_lease_script_install_the_same_routes():
    """Two code paths writing the same routes drift. They share one builder, so a
    divergence would mean a WAN behaves differently on apply than on renewal.

    Compared on the route tags and destinations rather than whole command strings:
    the two differ legitimately in how the gateway is expressed and in quoting."""
    args = ('wan1', 'to_WAN1', 'to_WAN2', '8.8.8.8', True)
    seed = lb._seed_routes_cmd(*args, port='ether1')
    script = lb._lease_script(*args).replace('\\"', '"').replace('\\$', '$')

    tags = {f'{lb.LB_COMMENT}-gw1', f'{lb.LB_COMMENT}-bk1', f'{lb.LB_COMMENT}-probe1'}
    for tag in tags:
        assert seed.count(f'"{tag}"') == 2, f'{tag}: expected one remove and one add'
        assert script.count(f'"{tag}"') == 2

    for fragment in ('dst-address=0.0.0.0/0', 'dst-address=8.8.8.8/32',
                     'routing-table=to_WAN1', 'routing-table=to_WAN2',
                     'distance=1', 'distance=2', 'scope=10'):
        assert fragment in seed, f'seed missing {fragment}'
        assert fragment in script, f'script missing {fragment}'


def test_the_lease_script_still_guards_on_bind():
    script = lb._lease_script('wan1', 'to_WAN1', 'to_WAN2', '8.8.8.8', True)

    assert script.startswith(':if (\\$bound=1)')
    assert '\\"' in script, 'quotes must stay escaped inside script="..."'
