"""Tests for the takeover cutover: the RADIUS probe and the scripts it gates.

The probe is tested against the published RFC vectors rather than against our
own output, because "it agrees with itself" is exactly the failure mode that
would let a broken MS-CHAPv2 implementation report a clean bill of health across
a whole roster.

Run: backend/.venv/bin/python -m pytest backend/server/tests -q
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.router_scan import adoption_script  # noqa: E402
from services.router_scan import radius_probe as probe  # noqa: E402


# --- MD4: RFC 1320 §A.5 ---------------------------------------------------

@pytest.mark.parametrize('message,digest', [
    (b'', '31d6cfe0d16ae931b73c59d7e0c089c0'),
    (b'a', 'bde52cb31de33e46245e05fbdbd6fb24'),
    (b'abc', 'a448017aaf21d8525fc10ae87aa6729d'),
    (b'message digest', 'd9130a8164549fe818874806e1c7014b'),
    (b'abcdefghijklmnopqrstuvwxyz', 'd79e1c308aa5bbcdeea8ed63df412da9'),
    (b'12345678901234567890123456789012345678901234567890123456789012345678901234567890',
     'e33b4ddc9c38f2199c3e7b164fcc0536'),
])
def test_md4_matches_rfc1320(message, digest):
    assert probe.md4(message).hex() == digest


def test_md4_is_used_because_openssl_dropped_it():
    """Guards the reason this exists: hashlib cannot be swapped back in."""
    import hashlib
    try:
        hashlib.new('md4')
    except ValueError:
        return  # expected on OpenSSL 3 — our implementation is required
    pytest.skip('this OpenSSL still ships MD4')


# --- MS-CHAPv2: RFC 2759 §9.2 --------------------------------------------

RFC_AUTH_CHALLENGE = bytes.fromhex('5B5D7C7D7B3F2F3E3C2C602132262628')
RFC_PEER_CHALLENGE = bytes.fromhex('21402324255E262A28295F2B3A337C7E')
RFC_USERNAME = 'User'
RFC_PASSWORD = 'clientPass'


def test_nt_password_hash_matches_rfc2759():
    assert probe.nt_password_hash(RFC_PASSWORD).hex().upper() == '44EBBA8D5312B8D611474411F56989AE'


def test_challenge_hash_matches_rfc2759():
    got = probe.challenge_hash(RFC_PEER_CHALLENGE, RFC_AUTH_CHALLENGE, RFC_USERNAME)
    assert got.hex().upper() == 'D02E4386BCE91226'


def test_challenge_response_matches_rfc2759():
    challenge = bytes.fromhex('D02E4386BCE91226')
    got = probe.challenge_response(challenge, probe.nt_password_hash(RFC_PASSWORD))
    assert got.hex().upper() == '82309ECD8D708B5EA08FAA3981CD83544233114A3D85D6DF'


def test_mschapv2_response_attribute_is_50_bytes():
    """Ident + Flags + PeerChallenge(16) + Reserved(8) + NT-Response(24)."""
    challenge, response = probe.build_mschapv2(RFC_USERNAME, RFC_PASSWORD)
    assert len(challenge) == 16
    assert len(response) == 50
    assert response[1] == 0  # Flags
    assert response[18:26] == b'\x00' * 8  # Reserved


# --- PAP (RFC 2865 §5.2) --------------------------------------------------

def test_pap_password_round_trips():
    from hashlib import md5

    secret, authenticator = b's3cret', bytes(range(16))
    encoded = probe.encode_pap_password('hunter2', secret, authenticator)
    assert len(encoded) % 16 == 0
    decoded = bytes(a ^ b for a, b in zip(encoded, md5(secret + authenticator).digest()))
    assert decoded.rstrip(b'\x00') == b'hunter2'


def test_pap_password_spans_multiple_blocks():
    """A >16 byte password must chain, not repeat the first keystream block."""
    encoded = probe.encode_pap_password('x' * 20, b'sec', bytes(16))
    assert len(encoded) == 32
    assert encoded[:16] != encoded[16:]


# --- Attribute encoding ---------------------------------------------------

def test_vsa_round_trips_through_the_parser():
    packet = probe._encode_vsa(probe.VENDOR_MIKROTIK, probe.MIKROTIK_RATE_LIMIT, b'5M/20M')
    _attrs, vsas = probe.parse_attributes(packet)
    assert vsas == [(probe.VENDOR_MIKROTIK, probe.MIKROTIK_RATE_LIMIT, b'5M/20M')]
    assert probe.reply_rate_limit({'vsas': vsas}) == '5M/20M'


def test_parser_survives_a_truncated_attribute():
    """A malformed reply must not raise — it is a verification result, not a 500."""
    attrs, vsas = probe.parse_attributes(bytes([1, 40, 65, 66]))
    assert attrs == [] and vsas == []


def test_oversized_attribute_is_refused():
    with pytest.raises(probe.RadiusError):
        probe._encode_attribute(probe.ATTR_USER_NAME, b'x' * 254)


# --- Message-Authenticator (RFC 2869 §5.14 / CVE-2024-3596) --------------

def _built_packet(monkeypatch, probe_obj):
    """Capture the bytes the probe would put on the wire."""
    sent = {}

    class FakeSocket:
        def settimeout(self, _): pass

        def sendto(self, data, _addr):
            sent['packet'] = data
            raise TimeoutError('captured')

        def close(self): pass

    monkeypatch.setattr(probe.socket, 'socket', lambda *a, **k: FakeSocket())
    with pytest.raises(probe.RadiusError):
        probe_obj.mschapv2('someone', 'secret')
    return sent['packet']


def test_request_carries_a_message_authenticator(monkeypatch):
    """Without it a current FreeRADIUS drops the packet and answers nothing —
    which is indistinguishable from an unreachable server."""
    packet = _built_packet(monkeypatch, probe.RadiusProbe('127.0.0.1', 'sec', retries=1))
    _attrs, _vsas = probe.parse_attributes(packet[20:])
    types = [t for t, _v in probe.parse_attributes(packet[20:])[0]]
    assert probe.ATTR_MESSAGE_AUTHENTICATOR in types


def test_message_authenticator_verifies_the_way_the_server_checks_it(monkeypatch):
    """HMAC-MD5 over the whole packet with its own field zeroed."""
    import hmac
    from hashlib import md5

    secret = b'sec'
    packet = _built_packet(monkeypatch, probe.RadiusProbe('127.0.0.1', secret, retries=1))
    attrs, _ = probe.parse_attributes(packet[20:])
    signature = dict(attrs)[probe.ATTR_MESSAGE_AUTHENTICATOR]
    zeroed = packet.replace(signature, b'\x00' * 16)
    assert hmac.new(secret, zeroed, md5).digest() == signature


def test_timeout_names_the_wrong_secret_case(monkeypatch):
    """A bad secret is dropped silently, so the timeout text has to cover both."""
    class FakeSocket:
        def settimeout(self, _): pass

        def sendto(self, _data, _addr):
            raise TimeoutError('timed out')

        def close(self): pass

    monkeypatch.setattr(probe.socket, 'socket', lambda *a, **k: FakeSocket())
    with pytest.raises(probe.RadiusError) as caught:
        probe.RadiusProbe('127.0.0.1', 'sec', retries=1).mschapv2('someone', 'pw')
    assert 'shared secret' in str(caught.value)
    assert 'unreachable' in str(caught.value)


# --- The cutover scripts --------------------------------------------------

def test_hotspot_users_are_moved_through_the_hotspot_menu():
    """A hotspot user has no /ppp secret; sending them through it would silently
    leave them on the old system while the UI reported them moved."""
    script = adoption_script.build_retire_secrets_script([
        {'login': 'ppp-guy', 'kind': 'pppoe'},
        {'login': 'hs-guy', 'kind': 'hotspot'},
    ])
    assert '/ppp secret set [find name="ppp-guy"] disabled=yes' in script
    assert '/ip hotspot user set [find name="hs-guy"] disabled=yes' in script
    assert '/ppp secret set [find name="hs-guy"]' not in script
    assert '/ip hotspot active remove [find user="hs-guy"]' in script


def test_bare_logins_are_still_treated_as_pppoe():
    script = adoption_script.build_retire_secrets_script(['legacy'])
    assert '/ppp secret set [find name="legacy"] disabled=yes' in script


def test_everyone_is_disabled_before_any_session_is_dropped():
    """The other order lets a client redial into its still-enabled local secret."""
    script = adoption_script.build_retire_secrets_script(['a', 'b'])
    lines = script.splitlines()
    last_disable = max(i for i, l in enumerate(lines) if 'disabled=yes' in l)
    first_kick = min(i for i, l in enumerate(lines) if 'active remove' in l)
    assert last_disable < first_kick


def test_credentials_are_disabled_never_removed():
    """Removing takes the password with it, and the password is what makes
    rollback free."""
    script = adoption_script.build_retire_secrets_script([
        {'login': 'a', 'kind': 'pppoe'}, {'login': 'b', 'kind': 'hotspot'},
    ])
    for line in script.splitlines():
        if line.startswith('#'):
            continue
        assert '/ppp secret remove' not in line
        assert '/ip hotspot user remove' not in line


def test_an_injected_quote_cannot_break_out_of_the_find_expression():
    """These names come off someone else's router. A quote would close the
    RouterOS string early and let the rest of the value be read as commands;
    everything else stays harmless *because* it remains inside the quotes.

    Only the quote is stripped, deliberately. Scrubbing more would mangle
    legitimate logins into ones `[find name=…]` never matches, which silently
    leaves that subscriber behind on the old system.
    """
    script = adoption_script.build_retire_secrets_script(['ev"il] ; /system reboot'])
    command = next(l for l in script.splitlines() if l.startswith(':do'))
    # Exactly one quoted value: the two delimiters and nothing else.
    assert command.count('"') == 2
    payload = command.split('"')[1]
    assert payload == 'evil] ; /system reboot'


def test_rollback_re_enables_both_menus_and_drops_our_radius_entry():
    script = adoption_script.build_rollback_script([
        {'login': 'a', 'kind': 'pppoe'}, {'login': 'b', 'kind': 'hotspot'},
    ])
    assert '/ppp secret set [find name="a"] disabled=no' in script
    assert '/ip hotspot user set [find name="b"] disabled=no' in script
    assert f'/radius remove [find comment="{adoption_script.ADOPTION_COMMENT}"]' in script
    # use-radius is deliberately left alone.
    assert 'use-radius' not in script


def test_canary_is_the_batch_script_for_one_person():
    script = adoption_script.build_canary_script({'login': 'solo', 'kind': 'hotspot'})
    assert '/ip hotspot user set [find name="solo"] disabled=yes' in script
    assert '/ip hotspot active remove [find user="solo"]' in script


def test_empty_batch_is_refused():
    with pytest.raises(ValueError):
        adoption_script.build_retire_secrets_script([])
    with pytest.raises(ValueError):
        adoption_script.build_retire_secrets_script([{'login': '  ', 'kind': 'pppoe'}])


# --- Verification verdicts ------------------------------------------------

def _reply(code, vsas=(), attrs=()):
    return {'code': code, 'vsas': list(vsas), 'attributes': list(attrs), 'size': 0}


def test_accept_without_mschap2_success_is_a_failure_not_a_pass():
    """The ~53-byte Accept produced by an `Auth-Type := Accept` row: the server
    says yes and the CPE still reports a login failure."""
    from services.router_scan.verify import FAIL, _classify

    state, detail = _classify('pppoe', _reply(probe.ACCESS_ACCEPT), None)
    assert state == FAIL
    assert 'MS-CHAP2-Success' in detail


def test_healthy_pppoe_accept_passes():
    from services.router_scan.verify import PASS, _classify

    vsas = [
        (probe.VENDOR_MICROSOFT, probe.MS_CHAP2_SUCCESS, b'ok'),
        (probe.VENDOR_MICROSOFT, probe.MS_MPPE_SEND_KEY, b'k'),
        (probe.VENDOR_MICROSOFT, probe.MS_MPPE_RECV_KEY, b'k'),
        (probe.VENDOR_MIKROTIK, probe.MIKROTIK_RATE_LIMIT, b'5M/20M'),
    ]
    state, _ = _classify('pppoe', _reply(probe.ACCESS_ACCEPT, vsas), '5M/20M')
    assert state == PASS


def test_wrong_rate_limit_warns_rather_than_passing():
    from services.router_scan.verify import WARN, _classify

    vsas = [
        (probe.VENDOR_MICROSOFT, probe.MS_CHAP2_SUCCESS, b'ok'),
        (probe.VENDOR_MICROSOFT, probe.MS_MPPE_SEND_KEY, b'k'),
        (probe.VENDOR_MICROSOFT, probe.MS_MPPE_RECV_KEY, b'k'),
        (probe.VENDOR_MIKROTIK, probe.MIKROTIK_RATE_LIMIT, b'1M/1M'),
    ]
    state, detail = _classify('pppoe', _reply(probe.ACCESS_ACCEPT, vsas), '5M/20M')
    assert state == WARN
    assert '1M/1M' in detail and '5M/20M' in detail


def test_hotspot_is_not_held_to_the_mschap_requirement():
    from services.router_scan.verify import PASS, _classify

    state, _ = _classify('hotspot', _reply(probe.ACCESS_ACCEPT), None)
    assert state == PASS


def test_reject_carries_the_servers_own_reason():
    from services.router_scan.verify import FAIL, _classify

    attrs = [(probe.ATTR_REPLY_MESSAGE, b'Your account has expired')]
    state, detail = _classify('pppoe', _reply(probe.ACCESS_REJECT, attrs=attrs), None)
    assert state == FAIL
    assert 'Your account has expired' in detail
