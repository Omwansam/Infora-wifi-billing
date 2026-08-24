"""A small, dependency-light RADIUS client — enough to ask our own FreeRADIUS
"would this subscriber authenticate?" and believe the answer.

Why speak the protocol instead of querying the database: every interesting
failure in this system lives *between* the tables. ``radcheck`` can hold a
perfect password while ``rlm_sql``'s ``sql_user_name`` is empty, or the
``plan_<id>`` group never got its reply rows, or a stray ``Auth-Type := Accept``
short-circuits mschap. No ``SELECT`` sees any of that. One Access-Request sees
all of it.

**PAP is not a substitute for MS-CHAPv2 here.** A MikroTik PPPoE CPE dials
MS-CHAPv2 by default, and the two paths fail independently — a broken mschap
module rejects every PPPoE dial while PAP hotspot logins keep working. Checking
PPPoE clients with PAP would report green during exactly that outage, so this
module implements the real MS-CHAPv2 exchange (RFC 2759).

MD4 is implemented here rather than imported: OpenSSL 3 dropped it, so
``hashlib.new('md4')`` raises on the images we ship. Single DES comes from
``cryptography``'s decrepit corner as ``TripleDES`` with the key repeated three
times, which is the standard way to get 1DES out of a 3DES primitive.
"""
import hmac
import os
import socket
import struct
from hashlib import md5, sha1

try:  # cryptography >= 43 moved TripleDES out of primitives
    from cryptography.hazmat.decrepit.ciphers.algorithms import TripleDES
except ImportError:  # pragma: no cover - older cryptography
    from cryptography.hazmat.primitives.ciphers.algorithms import TripleDES
from cryptography.hazmat.primitives.ciphers import Cipher, modes

# --- RADIUS codes and the handful of attributes we need ------------------

ACCESS_REQUEST = 1
ACCESS_ACCEPT = 2
ACCESS_REJECT = 3

ATTR_USER_NAME = 1
ATTR_USER_PASSWORD = 2
ATTR_NAS_IP_ADDRESS = 4
ATTR_NAS_PORT = 5
ATTR_SERVICE_TYPE = 6
ATTR_FRAMED_IP_ADDRESS = 8
ATTR_REPLY_MESSAGE = 18
ATTR_VENDOR_SPECIFIC = 26
ATTR_CALLING_STATION_ID = 31
ATTR_NAS_IDENTIFIER = 32
ATTR_NAS_PORT_TYPE = 61
ATTR_MESSAGE_AUTHENTICATOR = 80

VENDOR_MICROSOFT = 311
MS_CHAP_CHALLENGE = 11
MS_CHAP2_RESPONSE = 25
MS_CHAP2_SUCCESS = 26
MS_MPPE_SEND_KEY = 16
MS_MPPE_RECV_KEY = 17

VENDOR_MIKROTIK = 14988
MIKROTIK_RATE_LIMIT = 8
MIKROTIK_TOTAL_LIMIT = 9

SERVICE_TYPE_FRAMED = 2
SERVICE_TYPE_LOGIN = 1
NAS_PORT_TYPE_ETHERNET = 15


class RadiusError(Exception):
    """The exchange could not be completed (timeout, malformed reply, …)."""


# --- MD4 (RFC 1320) ------------------------------------------------------

_MD4_R2_X = (0, 4, 8, 12, 1, 5, 9, 13, 2, 6, 10, 14, 3, 7, 11, 15)
_MD4_R3_X = (0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15)
_MASK = 0xFFFFFFFF


def _rotl(value, bits):
    value &= _MASK
    return ((value << bits) | (value >> (32 - bits))) & _MASK


def md4(data):
    """MD4 digest. Present because OpenSSL 3 removed it from ``hashlib``."""
    state = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476]
    message = bytearray(data)
    bit_length = (len(data) * 8) & 0xFFFFFFFFFFFFFFFF
    message.append(0x80)
    while len(message) % 64 != 56:
        message.append(0)
    message += bit_length.to_bytes(8, 'little')

    for offset in range(0, len(message), 64):
        x = list(struct.unpack('<16I', message[offset:offset + 64]))
        a, b, c, d = state

        for i in range(16):  # round 1
            k, s = i, (3, 7, 11, 19)[i % 4]
            f = (b & c) | ((~b & _MASK) & d)
            a, b, c, d = d, _rotl(a + f + x[k], s), b, c
        for i in range(16):  # round 2
            k, s = _MD4_R2_X[i], (3, 5, 9, 13)[i % 4]
            f = (b & c) | (b & d) | (c & d)
            a, b, c, d = d, _rotl(a + f + x[k] + 0x5A827999, s), b, c
        for i in range(16):  # round 3
            k, s = _MD4_R3_X[i], (3, 9, 11, 15)[i % 4]
            f = b ^ c ^ d
            a, b, c, d = d, _rotl(a + f + x[k] + 0x6ED9EBA1, s), b, c

        state = [(state[0] + a) & _MASK, (state[1] + b) & _MASK,
                 (state[2] + c) & _MASK, (state[3] + d) & _MASK]

    return struct.pack('<4I', *state)


# --- MS-CHAPv2 (RFC 2759) ------------------------------------------------

def _des_key_from_7(key7):
    """Expand a 7-byte chunk into an 8-byte DES key (parity bit ignored)."""
    bits = int.from_bytes(key7, 'big')
    return bytes(((bits >> (49 - 7 * i)) & 0x7F) << 1 for i in range(8))


def _des_encrypt(key7, block8):
    algorithm = TripleDES(_des_key_from_7(key7) * 3)
    encryptor = Cipher(algorithm, modes.ECB()).encryptor()
    return encryptor.update(block8) + encryptor.finalize()


def nt_password_hash(password):
    """MD4 of the UTF-16LE password — the NT hash MS-CHAPv2 is built on."""
    return md4(password.encode('utf-16-le'))


def challenge_hash(peer_challenge, authenticator_challenge, username):
    """RFC 2759 §8.2. Note the spec's own §9.2 vector for this is inconsistent —
    validate against FreeRADIUS's answer, not against that vector."""
    digest = sha1(peer_challenge + authenticator_challenge + username.encode('utf-8')).digest()
    return digest[:8]


def challenge_response(challenge8, password_hash):
    """RFC 2759 §8.5 — three single-DES blocks over the zero-padded NT hash."""
    padded = password_hash + b'\x00' * (21 - len(password_hash))
    return b''.join(
        _des_encrypt(padded[i:i + 7], challenge8) for i in (0, 7, 14)
    )


def build_mschapv2(username, password, authenticator_challenge=None,
                   peer_challenge=None, ident=1):
    """Return the (MS-CHAP-Challenge, MS-CHAP2-Response) attribute values."""
    authenticator_challenge = authenticator_challenge or os.urandom(16)
    peer_challenge = peer_challenge or os.urandom(16)
    challenge = challenge_hash(peer_challenge, authenticator_challenge, username)
    response = challenge_response(challenge, nt_password_hash(password))
    # Ident, Flags, PeerChallenge(16), Reserved(8), NT-Response(24) = 50 bytes
    value = bytes([ident, 0]) + peer_challenge + b'\x00' * 8 + response
    return authenticator_challenge, value


# --- Attribute encoding --------------------------------------------------

def _encode_attribute(attr_type, value):
    if len(value) > 253:
        raise RadiusError(f'attribute {attr_type} is too long ({len(value)} bytes)')
    return bytes([attr_type, len(value) + 2]) + value


def _encode_vsa(vendor_id, vendor_type, value):
    inner = bytes([vendor_type, len(value) + 2]) + value
    return _encode_attribute(ATTR_VENDOR_SPECIFIC, struct.pack('>I', vendor_id) + inner)


def encode_pap_password(password, secret, request_authenticator):
    """RFC 2865 §5.2 — XOR the password against a chained MD5 keystream."""
    raw = password.encode('utf-8')
    padded = raw + b'\x00' * ((16 - len(raw) % 16) % 16)
    if not padded:
        padded = b'\x00' * 16
    out = bytearray()
    previous = request_authenticator
    for offset in range(0, len(padded), 16):
        block = md5(secret + previous).digest()
        chunk = bytes(a ^ b for a, b in zip(padded[offset:offset + 16], block))
        out += chunk
        previous = chunk
    return bytes(out)


def parse_attributes(payload):
    """Decode the attribute section into ``[(type, value)]`` plus VSAs as
    ``[(vendor_id, vendor_type, value)]``."""
    attributes = []
    vsas = []
    index = 0
    while index + 2 <= len(payload):
        attr_type = payload[index]
        length = payload[index + 1]
        if length < 2 or index + length > len(payload):
            break
        value = payload[index + 2:index + length]
        if attr_type == ATTR_VENDOR_SPECIFIC and len(value) >= 6:
            vendor_id = struct.unpack('>I', value[:4])[0]
            inner = value[4:]
            position = 0
            while position + 2 <= len(inner):
                vendor_type = inner[position]
                vendor_length = inner[position + 1]
                if vendor_length < 2 or position + vendor_length > len(inner):
                    break
                vsas.append((vendor_id, vendor_type, inner[position + 2:position + vendor_length]))
                position += vendor_length
        else:
            attributes.append((attr_type, value))
        index += length
    return attributes, vsas


# --- The exchange --------------------------------------------------------

class RadiusProbe:
    """One configured route to a RADIUS server, reusable across many checks."""

    def __init__(self, host, secret, port=1812, timeout=3.0, retries=2,
                 nas_ip=None, nas_identifier='infora-verify'):
        self.host = host
        self.port = int(port or 1812)
        self.secret = secret.encode('utf-8') if isinstance(secret, str) else secret
        self.timeout = timeout
        self.retries = max(1, int(retries))
        self.nas_ip = nas_ip
        self.nas_identifier = nas_identifier
        self._identifier = 0

    def _next_identifier(self):
        self._identifier = (self._identifier + 1) % 256
        return self._identifier

    def _common_attributes(self, username, service_type, calling_station=None):
        parts = [
            _encode_attribute(ATTR_USER_NAME, username.encode('utf-8')),
            _encode_attribute(ATTR_NAS_IDENTIFIER, self.nas_identifier.encode('utf-8')),
            _encode_attribute(ATTR_SERVICE_TYPE, struct.pack('>I', service_type)),
            _encode_attribute(ATTR_NAS_PORT, struct.pack('>I', 0)),
            _encode_attribute(ATTR_NAS_PORT_TYPE, struct.pack('>I', NAS_PORT_TYPE_ETHERNET)),
        ]
        if self.nas_ip:
            try:
                packed = socket.inet_aton(self.nas_ip)
                parts.append(_encode_attribute(ATTR_NAS_IP_ADDRESS, packed))
            except OSError:
                pass
        if calling_station:
            parts.append(_encode_attribute(ATTR_CALLING_STATION_ID, calling_station.encode('utf-8')))
        return parts

    def _send(self, attributes, authenticator):
        identifier = self._next_identifier()
        # Message-Authenticator (RFC 2869 §5.14) is not optional against a
        # current FreeRADIUS: the BlastRADIUS mitigation (CVE-2024-3596) turned
        # `require_message_authenticator` on by default, and a request without
        # it is dropped as an "Insecure packet" with **no reply at all** — which
        # from here is indistinguishable from an unreachable server. It is an
        # HMAC-MD5 over the whole packet with its own field zeroed, so it goes
        # in as zeros first and is overwritten once the length is known.
        placeholder = _encode_attribute(ATTR_MESSAGE_AUTHENTICATOR, b'\x00' * 16)
        body = b''.join(attributes) + placeholder
        length = 20 + len(body)
        header = struct.pack('>BBH', ACCESS_REQUEST, identifier, length)
        digest = hmac.new(self.secret, header + authenticator + body, md5).digest()
        body = body[:-16] + digest
        packet = header + authenticator + body

        last_error = None
        for _ in range(self.retries):
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(self.timeout)
            try:
                sock.sendto(packet, (self.host, self.port))
                data, _peer = sock.recvfrom(8192)
            except (socket.timeout, OSError) as exc:
                last_error = exc
                continue
            finally:
                sock.close()

            if len(data) < 20:
                last_error = RadiusError('reply shorter than a RADIUS header')
                continue
            code, reply_id, reply_length = struct.unpack('>BBH', data[:4])
            if reply_id != identifier:
                last_error = RadiusError('reply identifier did not match the request')
                continue
            reply_authenticator = data[4:20]
            payload = data[20:reply_length]
            expected = md5(
                data[:4] + authenticator + payload + self.secret
            ).digest()
            if expected != reply_authenticator:
                # Wrong shared secret is the overwhelmingly common cause, and it
                # is indistinguishable from tampering — say so plainly.
                raise RadiusError(
                    'reply failed its authenticator check — the shared secret '
                    'this probe used does not match the server'
                )
            attrs, vsas = parse_attributes(payload)
            return {'code': code, 'attributes': attrs, 'vsas': vsas, 'size': reply_length}

        # A wrong shared secret does NOT produce the friendly authenticator error
        # below: since the BlastRADIUS mitigation, FreeRADIUS drops a request
        # whose Message-Authenticator does not verify and answers nothing at all.
        # From here that is byte-for-byte an unreachable server, so say both.
        raise RadiusError(
            f'no reply from {self.host}:{self.port} after {self.retries} attempt(s) '
            f'({last_error}). Either the server is unreachable, or the shared secret '
            'is wrong — a modern FreeRADIUS drops a request it cannot authenticate '
            'without replying, so the two look identical from the client side.'
        )

    def pap(self, username, password, calling_station=None):
        """A hotspot-style PAP Access-Request."""
        authenticator = os.urandom(16)
        attributes = self._common_attributes(username, SERVICE_TYPE_LOGIN, calling_station)
        attributes.append(_encode_attribute(
            ATTR_USER_PASSWORD,
            encode_pap_password(password, self.secret, authenticator),
        ))
        return self._send(attributes, authenticator)

    def mschapv2(self, username, password, calling_station=None):
        """A PPPoE-style MS-CHAPv2 Access-Request — what a MikroTik CPE sends."""
        authenticator = os.urandom(16)
        challenge, response = build_mschapv2(username, password)
        attributes = self._common_attributes(username, SERVICE_TYPE_FRAMED, calling_station)
        attributes.append(_encode_vsa(VENDOR_MICROSOFT, MS_CHAP_CHALLENGE, challenge))
        attributes.append(_encode_vsa(VENDOR_MICROSOFT, MS_CHAP2_RESPONSE, response))
        return self._send(attributes, authenticator)


# --- Reading the reply ---------------------------------------------------

def find_vsa(reply, vendor_id, vendor_type):
    for vid, vtype, value in reply.get('vsas') or []:
        if vid == vendor_id and vtype == vendor_type:
            return value
    return None


def reply_rate_limit(reply):
    value = find_vsa(reply, VENDOR_MIKROTIK, MIKROTIK_RATE_LIMIT)
    return value.decode('utf-8', 'replace').strip() if value else None


def reply_message(reply):
    for attr_type, value in reply.get('attributes') or []:
        if attr_type == ATTR_REPLY_MESSAGE:
            return value.decode('utf-8', 'replace').strip()
    return None


def has_mschap2_success(reply):
    return find_vsa(reply, VENDOR_MICROSOFT, MS_CHAP2_SUCCESS) is not None


def has_mppe_keys(reply):
    return (
        find_vsa(reply, VENDOR_MICROSOFT, MS_MPPE_SEND_KEY) is not None
        and find_vsa(reply, VENDOR_MICROSOFT, MS_MPPE_RECV_KEY) is not None
    )
