"""Tests for the router-scan parsers and mappers.

These cover the modules that must be right against RouterOS output we cannot
reproduce in CI, so the fixtures are shaped like real v6/v7 output — including
the cases that break naive parsing: comments with spaces, passwords with spaces,
asymmetric rate limits, disabled secrets, MAC-only hotspot users, and a v7
export taken without ``show-sensitive``.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.router_scan import commands, fingerprint, inventory, parser, profiles  # noqa: E402
from services.router_scan.comments import mine_comment  # noqa: E402


# --- commands: the read-only guarantee -----------------------------------

def test_every_catalogue_command_is_read_only():
    built = commands.build_scan_commands()
    assert built, 'catalogue is empty'
    for key, command, _required in built:
        assert commands.assert_read_only(command), key


@pytest.mark.parametrize('bad', [
    '/ppp secret remove [find]',
    '/ppp secret print; /ppp secret remove [find]',
    '/system reset-configuration',
    '/ip firewall filter add chain=input action=drop',
    ':foreach i in=[/ppp secret find] do={/ppp secret set $i disabled=yes}',
    '/user add name=hacker password=x group=full',
])
def test_write_commands_are_refused(bad):
    with pytest.raises(commands.UnsafeCommand):
        commands.assert_read_only(bad)


def test_menu_outside_allowlist_is_refused():
    with pytest.raises(commands.UnsafeCommand):
        commands.list_command('/system license', ['name'])


def test_field_names_are_validated():
    with pytest.raises(commands.UnsafeCommand):
        commands.list_command('/ppp secret', ['name; /ppp secret remove [find]'])


def test_agent_script_contains_no_menu_writes():
    script = commands.build_agent_script('https://billing.example/api/import/router/ingest?token=abc')
    assert '/tool fetch' in script
    assert commands.assert_script_read_only(script)


def test_agent_script_rejects_a_smuggled_write():
    with pytest.raises(commands.UnsafeCommand):
        commands.assert_script_read_only('/ppp secret print\n/ppp secret remove [find]\n')


# --- parser: the emitter stream ------------------------------------------

SECRET_STREAM = """#REC
name=john_kabete
password=S3cret Pass!
profile=PPPOE-10M
service=pppoe
remote-address=pppoe-pool
caller-id=AA:BB:CC:DD:EE:FF
disabled=false
comment=John Kabete 0712345678 exp 15/08/2026
#REC
name=mary_w
password=hunter2
profile=PPPOE-20M
service=pppoe
remote-address=10.20.0.14
disabled=true
comment=Mary Wanjiru | 0722000000 | due 2026-08-01
"""


def test_parse_records_keeps_spaces_in_values():
    rows = parser.parse_records(SECRET_STREAM)
    assert len(rows) == 2
    assert rows[0]['password'] == 'S3cret Pass!'
    assert rows[0]['comment'] == 'John Kabete 0712345678 exp 15/08/2026'
    assert rows[1]['comment'] == 'Mary Wanjiru | 0722000000 | due 2026-08-01'


def test_parse_records_ignores_preamble_and_blank_lines():
    noisy = 'some shell banner\n\n' + SECRET_STREAM + '\n\n'
    assert len(parser.parse_records(noisy)) == 2


def test_parse_records_treats_empty_values_as_none():
    rows = parser.parse_records('#REC\nname=x\npassword=\ncomment=\n')
    assert rows[0]['name'] == 'x'
    assert rows[0]['password'] is None


# --- parser: /export -----------------------------------------------------

EXPORT_V6 = """# jul/28/2026 10:14:02 by RouterOS 6.49.10
/ppp profile
set [ find default=yes ] name=default
add local-address=10.20.0.1 name=PPPOE-10M rate-limit=5M/10M remote-address=pppoe-pool
add local-address=10.20.0.1 name=PPPOE-20M rate-limit=10M/20M remote-address=pppoe-pool
/ppp secret
add comment="John Kabete 0712345678 exp 15/08/2026" name=john_kabete password=\\
    "S3cret Pass!" profile=PPPOE-10M remote-address=pppoe-pool \\
    service=pppoe
add comment="Mary Wanjiru" disabled=yes name=mary_w password=hunter2 profile=\\
    PPPOE-20M remote-address=10.20.0.14 service=pppoe
/ip pool
add name=pppoe-pool ranges=10.20.0.10-10.20.3.254
/ppp aaa
set accounting=yes interim-update=5m use-radius=no
"""


def test_export_parses_menus_and_continuations():
    sections = parser.export_to_sections(EXPORT_V6)
    assert len(sections['ppp_secrets']) == 2
    john = sections['ppp_secrets'][0]
    assert john['name'] == 'john_kabete'
    assert john['password'] == 'S3cret Pass!'
    assert john['comment'] == 'John Kabete 0712345678 exp 15/08/2026'
    assert sections['ppp_secrets'][1]['disabled'] == 'yes'


def test_export_captures_set_lines_for_singletons():
    sections = parser.export_to_sections(EXPORT_V6)
    aaa = sections['ppp_aaa'][0]
    assert aaa['use-radius'] == 'no'
    assert aaa['_verb'] == 'set'


def test_export_profiles_and_pools():
    sections = parser.export_to_sections(EXPORT_V6)
    names = {p['name'] for p in sections['ppp_profiles'] if p.get('name')}
    assert {'PPPOE-10M', 'PPPOE-20M'} <= names
    assert sections['pools'][0]['ranges'] == '10.20.0.10-10.20.3.254'


# --- profiles: the direction convention ----------------------------------

def test_rate_limit_is_upload_first():
    rate = profiles.parse_rate_limit('5M/20M')
    assert rate['upload_mbps'] == 5
    assert rate['download_mbps'] == 20


def test_rate_limit_bare_value_mirrors():
    rate = profiles.parse_rate_limit('2M')
    assert rate['upload_mbps'] == 2
    assert rate['download_mbps'] == 2


def test_rate_limit_sub_megabit():
    rate = profiles.parse_rate_limit('512k/1M')
    assert rate['upload_mbps'] == 0.512
    assert rate['download_mbps'] == 1


def test_rate_limit_with_burst():
    rate = profiles.parse_rate_limit('5M/20M 10M/40M 5M/20M 10/10 8')
    assert rate['download_mbps'] == 20
    assert rate['burst_download_mbps'] == 40
    assert rate['burst_time_seconds'] == 10
    assert rate['priority'] == 8


def test_unlimited_rate_limit_is_not_zero():
    rate = profiles.parse_rate_limit('')
    assert rate['download_mbps'] is None
    assert rate['upload_mbps'] is None


def test_stock_profile_defaults_to_skip():
    draft = profiles.profile_to_draft({'name': 'default'})
    assert draft['decision'] == 'skip'
    assert draft['is_stock']


def test_profile_without_rate_limit_is_flagged():
    draft = profiles.profile_to_draft({'name': 'Home'})
    assert draft['decision'] == 'skip'
    assert any('rate-limit' in w for w in draft['warnings'])


def test_draft_to_plan_kwargs_carries_asymmetry():
    draft = profiles.profile_to_draft({'name': 'PPPOE-20M', 'rate-limit': '10M/20M'})
    draft['price'] = 3500
    kwargs = profiles.draft_to_plan_kwargs(draft, isp_id=1)
    assert kwargs['bandwidth_limit'] == 20
    assert kwargs['speed'] == '20M'
    assert kwargs['features']['upload_speed_mbps'] == 10
    assert kwargs['price'] == 3500


def test_sub_megabit_package_never_becomes_zero_mbps():
    draft = profiles.profile_to_draft({'name': 'Lite', 'rate-limit': '256k/512k'})
    kwargs = profiles.draft_to_plan_kwargs(draft, isp_id=1)
    assert kwargs['bandwidth_limit'] == 1


# --- comments ------------------------------------------------------------

def test_mine_comment_extracts_name_phone_and_expiry():
    mined = mine_comment('John Kabete 0712345678 exp 15/08/2026')
    assert mined['phone'] == '254712345678'
    assert mined['expiry'].date().isoformat() == '2026-08-15'
    assert mined['expiry_is_explicit']
    assert 'John' in mined['name']


def test_mine_comment_pipe_separated():
    mined = mine_comment('Mary Wanjiru | 0722000000 | due 2026-08-01')
    assert mined['phone'] == '254722000000'
    assert mined['expiry'].date().isoformat() == '2026-08-01'
    assert mined['name'].startswith('Mary')


def test_unqualified_date_is_not_treated_as_expiry():
    mined = mine_comment('Peter joined 01/02/2025')
    assert mined['expiry'] is not None
    assert mined['expiry_is_explicit'] is False


def test_empty_comment_is_safe():
    mined = mine_comment(None)
    assert mined['name'] is None and mined['phone'] is None


# --- inventory -----------------------------------------------------------

def _sections_from_export(text):
    return parser.export_to_sections(text)


def test_inventory_builds_candidates_and_packages():
    sections = _sections_from_export(EXPORT_V6)
    inv = inventory.build_inventory(sections)
    logins = {c['login'] for c in inv['candidates']}
    assert logins == {'john_kabete', 'mary_w'}
    assert inv['counts']['with_password'] == 2
    assert inv['counts']['disabled'] == 1
    by_name = {p['name']: p for p in inv['packages']}
    assert by_name['PPPOE-10M']['subscriber_count'] == 1
    assert by_name['PPPOE-20M']['download_mbps'] == 20


def test_pool_name_is_not_imported_as_a_static_ip():
    """`remote-address=pppoe-pool` names a pool, not an address.

    Writing it into Framed-IP-Address would break every session it touched.
    """
    sections = _sections_from_export(EXPORT_V6)
    inv = inventory.build_inventory(sections)
    john = next(c for c in inv['candidates'] if c['login'] == 'john_kabete')
    assert john['static_ip'] is None
    assert john['pool_name'] == 'pppoe-pool'


def test_real_static_address_is_kept():
    stream = '#REC\nname=fixed\nremote-address=10.20.0.14\nprofile=PPPOE-10M\n'
    inv = inventory.build_inventory({'ppp_secrets': parser.parse_records(stream)})
    assert inv['candidates'][0]['static_ip'] == '10.20.0.14'


def test_mac_only_hotspot_user_is_kept():
    stream = '#REC\nmac-address=AA:BB:CC:00:11:22\nprofile=daily\n'
    inv = inventory.build_inventory({'hotspot_users': parser.parse_records(stream)})
    assert inv['candidates'][0]['mac'] == 'AA:BB:CC:00:11:22'
    assert inv['counts']['hotspot'] == 1


def test_live_sessions_without_secrets_become_candidates():
    """Delegated-auth routers have an empty /ppp secret — sessions are the roster."""
    active = parser.parse_records('#REC\nname=ghost\naddress=10.20.0.99\n')
    inv = inventory.build_inventory({'ppp_active': active})
    ghost = inv['candidates'][0]
    assert ghost['login'] == 'ghost'
    assert ghost['password'] is None
    assert ghost['from_live_session']


def test_queue_billed_clients_are_marked_unenforceable():
    queues = parser.parse_records(
        '#REC\nname=Kamau house\ntarget=10.50.0.14/32\nmax-limit=5M/10M\n'
    )
    inv = inventory.build_inventory({'queues': queues})
    client = inv['candidates'][0]
    assert client['kind'] == 'static'
    assert client['enforceable'] is False
    assert client['static_ip'] == '10.50.0.14'


# --- fingerprint ---------------------------------------------------------

def test_local_auth_router_is_detected():
    sections = _sections_from_export(EXPORT_V6)
    fp = fingerprint.fingerprint(sections)
    assert fp['auth_mode'] == 'local'
    assert fp['passwords']['state'] == 'readable'
    assert fp['recommended_path'] == 'router-scan'
    assert not fp['blocking']


def test_delegated_auth_router_is_detected():
    sections = {
        'ppp_aaa': [{'use-radius': 'yes'}],
        'radius': [{'address': '10.0.0.5', 'service': 'ppp', 'comment': 'centipede'}],
        'ppp_active': [{'name': 'someone', 'address': '10.20.0.3'}],
    }
    fp = fingerprint.fingerprint(sections)
    assert fp['auth_mode'] == 'delegated'
    assert fp['vendor'] == 'Centipede'
    assert fp['recommended_path'] == 'csv-merge'
    assert any('cannot be scanned' in f for f in fp['findings'])


def test_blank_passwords_block_the_import():
    """The `sensitive` policy trap: names present, every password empty.

    Imported blind this generates new passwords for everyone and breaks every
    CPE on the network, so it has to be a hard stop rather than a footnote.
    """
    sections = {
        'ppp_secrets': [
            {'name': 'a', 'password': None},
            {'name': 'b', 'password': None},
        ],
    }
    fp = fingerprint.fingerprint(sections)
    assert fp['blocking'] is True
    assert fp['passwords']['state'] == 'hidden'
    assert 'sensitive' in fp['passwords']['detail']


def test_partial_passwords_are_not_blocking():
    sections = {
        'ppp_secrets': [
            {'name': 'a', 'password': 'x'},
            {'name': 'b', 'password': None},
        ],
    }
    fp = fingerprint.fingerprint(sections)
    assert fp['blocking'] is False
    assert fp['passwords']['state'] == 'partial'


def test_fasttrack_is_reported():
    sections = {
        'ppp_secrets': [{'name': 'a', 'password': 'x'}],
        'firewall_filter': [{'chain': 'forward', 'action': 'fasttrack-connection'}],
    }
    fp = fingerprint.fingerprint(sections)
    assert fp['fasttrack_present']
    assert any('FastTrack' in f for f in fp['findings'])


def test_homegrown_expiry_automation_is_reported():
    sections = {
        'ppp_secrets': [{'name': 'a', 'password': 'x'}],
        'schedulers': [{
            'name': 'expire-clients',
            'on-event': '/ppp secret set [find comment~"exp"] disabled=yes',
        }],
    }
    fp = fingerprint.fingerprint(sections)
    assert fp['expiry_automation']
    assert any('expiry enforcement' in f for f in fp['findings'])


def test_queue_billed_router_is_detected():
    sections = {'queues': [{'name': 'q1', 'target': '10.0.0.2/32', 'max-limit': '5M/5M'}]}
    fp = fingerprint.fingerprint(sections)
    assert fp['auth_mode'] == 'queue-billed'
    assert any('will not be able to disconnect' in f for f in fp['findings'])
