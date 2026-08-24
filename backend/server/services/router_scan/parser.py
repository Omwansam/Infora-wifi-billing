"""Pure parsers for RouterOS output. No I/O, no models, no Flask.

Two input shapes, one output shape (a list of dicts per menu):

  * :func:`parse_records` — the ``#REC`` / ``key=value`` stream produced by the
    emitters in :mod:`.commands`, used by the SSH and agent transports.
  * :func:`parse_export` — a ``/export`` ``.rsc`` file pasted or uploaded by an
    operator who cannot (or will not) give us access to the router.

Keeping this module pure is deliberate: it is the part most likely to be wrong
against a RouterOS version we have never seen, and it is the part we can test
exhaustively from captured fixtures without a router in the loop.
"""
import re

from .commands import RECORD_SEPARATOR

# RouterOS renders an unset property as an empty string, and `:tostr` of an
# empty array as "". Treat both, plus the literal "(unknown)", as absent.
_EMPTY = ('', 'none', '(unknown)')


def _clean(value):
    text = (value or '').strip()
    return None if text.lower() in _EMPTY else text


def parse_records(output):
    """Parse a ``#REC``-delimited ``key=value`` stream into a list of dicts.

    Values may contain spaces, ``=``, ``,``, ``|`` and quotes — everything except
    a newline, which RouterOS forbids in the properties we read. That is the
    whole reason this format exists instead of ``print terse``.

    Unparseable lines are skipped rather than raising: a scan that loses one
    field is recoverable, one that raises loses the roster.
    """
    records = []
    current = None
    for raw_line in (output or '').replace('\r', '').split('\n'):
        line = raw_line.strip()
        if not line:
            continue
        if line == RECORD_SEPARATOR:
            current = {}
            records.append(current)
            continue
        if current is None:
            # Output before the first marker — a shell banner, an echoed
            # command, RouterOS's "interrupted" notice. Not ours.
            continue
        key, sep, value = line.partition('=')
        if not sep:
            continue
        key = key.strip()
        if key:
            current[key] = _clean(value)
    return [r for r in records if r]


def parse_kv_block(output):
    """Parse a ``name: value`` block (``/ppp aaa print``) into one dict.

    Retained for reading output we did not generate — an operator pasting a
    ``print`` by hand, or a transport that predates the emitters.
    """
    info = {}
    for raw_line in (output or '').replace('\r', '').split('\n'):
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        key, sep, value = line.partition(':')
        if sep and key.strip():
            info[key.strip()] = _clean(value)
    return info


# --- /export (.rsc) ------------------------------------------------------

# A menu header line in an export: "/ppp secret" or "/ip hotspot user profile".
_EXPORT_MENU_RE = re.compile(r'^/[a-z0-9]+(?:[ /][a-z0-9-]+)*\s*$')
# The verbs an export uses to describe state.
_EXPORT_VERB_RE = re.compile(r'^(add|set)\b\s*(.*)$', re.IGNORECASE)


def _split_kv_tokens(text):
    """Split ``a=1 b="two words" c=x`` respecting quotes and escapes.

    RouterOS quotes any value containing a space and backslash-escapes embedded
    quotes. Splitting on whitespace — which the existing terse parsers do — turns
    ``comment="John Kabete 0712"`` into three broken tokens, which is precisely
    the bug this avoids.
    """
    tokens = []
    buf = []
    in_quotes = False
    escaped = False
    for ch in text:
        if escaped:
            buf.append(ch)
            escaped = False
            continue
        if ch == '\\':
            escaped = True
            continue
        if ch == '"':
            in_quotes = not in_quotes
            continue
        if ch.isspace() and not in_quotes:
            if buf:
                tokens.append(''.join(buf))
                buf = []
            continue
        buf.append(ch)
    if buf:
        tokens.append(''.join(buf))
    return tokens


def _join_continuations(text):
    """Fold RouterOS's trailing-backslash line continuations into single lines.

    The whitespace immediately before the backslash is significant and must be
    preserved, because RouterOS breaks lines in two different places::

        ... password=\\            <- mid-token: no space, must join tight
            "S3cret Pass!"
        ... interface=bridge \\     <- between tokens: the space is the separator
            network=10.20.0.0

    Adding a space unconditionally splits ``password="S3cret Pass!"`` into a
    valueless ``password=`` plus an orphan token; stripping unconditionally
    glues ``interface=bridgenetwork=...`` together. So: keep what was there, and
    strip only the continuation line's indentation.
    """
    lines = []
    pending = ''
    for raw_line in (text or '').replace('\r', '').split('\n'):
        line = raw_line.lstrip() if pending else raw_line
        trimmed = line.rstrip()
        if trimmed.endswith('\\'):
            pending += trimmed[:-1]
            continue
        lines.append((pending + line).strip())
        pending = ''
    if pending:
        lines.append(pending.strip())
    return lines


def parse_export(text):
    """Parse a ``/export`` file into ``{menu_path: [record, ...]}``.

    Menu paths are normalised to the space-separated form used by
    :data:`.commands.READ_MENUS` (``/ip hotspot user profile``), so an export and
    a live scan produce interchangeable inventories.

    ``set [ find ... ]`` lines are captured too, with ``_verb='set'``: RouterOS
    exports built-in objects (the stock ``default`` PPP profile, ``/ppp aaa``)
    as ``set`` rather than ``add``, and those carry real configuration.
    """
    menus = {}
    current_menu = None
    for line in _join_continuations(text):
        if not line or line.startswith('#'):
            continue
        if line.startswith('/'):
            if _EXPORT_MENU_RE.match(line):
                # "/ip hotspot user profile" and "/ip/hotspot/user/profile"
                # are both valid export headers depending on version.
                current_menu = '/' + ' '.join(line.strip().lstrip('/').replace('/', ' ').split())
            else:
                current_menu = None
            continue
        if current_menu is None:
            continue
        verb_match = _EXPORT_VERB_RE.match(line)
        if not verb_match:
            continue
        verb, remainder = verb_match.group(1).lower(), verb_match.group(2)
        # `set [ find default=yes ] name=x` — drop the selector, keep the
        # assignments. The selector is how the object is located on replay; for
        # our purposes the assignments are the record.
        selector = None
        if remainder.startswith('['):
            close = remainder.find(']')
            if close != -1:
                selector = remainder[1:close].strip()
                remainder = remainder[close + 1:].strip()
        record = {}
        for token in _split_kv_tokens(remainder):
            key, sep, value = token.partition('=')
            if sep and key.strip():
                record[key.strip()] = _clean(value)
        if not record:
            continue
        record['_verb'] = verb
        if selector:
            record['_selector'] = selector
        menus.setdefault(current_menu, []).append(record)
    return menus


# Which export menu feeds which scan key. Mirrors SCAN_PLAN so an uploaded
# export and an SSH scan land in the same inventory shape.
EXPORT_MENU_TO_KEY = {
    '/ppp secret': 'ppp_secrets',
    '/ppp profile': 'ppp_profiles',
    '/ppp aaa': 'ppp_aaa',
    '/radius': 'radius',
    '/radius incoming': 'radius_incoming',
    '/ip hotspot user': 'hotspot_users',
    '/ip hotspot user profile': 'hotspot_profiles',
    '/ip hotspot': 'hotspot_servers',
    '/ip hotspot ip-binding': 'hotspot_bindings',
    '/ip dhcp-server lease': 'dhcp_leases',
    '/ip pool': 'pools',
    '/ip address': 'addresses',
    '/interface pppoe-server server': 'pppoe_servers',
    '/ip firewall filter': 'firewall_filter',
    '/ip firewall address-list': 'address_lists',
    '/queue simple': 'queues',
    '/system script': 'scripts',
    '/system scheduler': 'schedulers',
    # An export carries the router's name, so the profile card can title itself
    # for an uploaded file the same way it does for a live scan. `/system
    # resource` and `/system routerboard` are deliberately absent: they are
    # runtime state and never appear in an export at all.
    '/system identity': 'system_identity',
    '/tool user-manager user': 'user_manager',
}


def export_to_sections(text):
    """Parse an export and re-key it onto the scan's section names."""
    menus = parse_export(text)
    sections = {}
    for menu, records in menus.items():
        key = EXPORT_MENU_TO_KEY.get(menu)
        if key:
            sections.setdefault(key, []).extend(records)
    return sections
