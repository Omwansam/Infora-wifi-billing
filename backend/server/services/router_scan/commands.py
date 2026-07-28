"""The read-only command catalogue for a router scan.

The load-bearing promise of the scan is that it **cannot change the router**. An
operator hands us credentials to a box currently serving several hundred paying
subscribers through somebody else's billing system; a stray ``set`` in here is an
outage.

That promise is enforced structurally rather than by a keyword blocklist. We
never execute an arbitrary string: every command is *built* here from a menu path
drawn from :data:`READ_MENUS` plus field names matched against :data:`_FIELD_RE`,
and :func:`assert_read_only` then checks the finished string against the exact
templates we generate. A blocklist over free text was tried first and is a trap —
``[/ppp secret get $i disabled]`` reads a *property* named ``disabled`` and would
trip any naive "contains a write verb" rule, so the check has to be structural to
be both safe and usable.

Why an emitter instead of ``print terse``: ``_parse_terse_rows`` in
services.device_config_ops splits on whitespace, and subscriber data is full of
it — ``comment=John Kabete 0712345678 exp 15/08`` and passwords like
``my pass word`` are both shredded. One field per line with an explicit record
marker survives everything RouterOS permits (names, comments and passwords
cannot contain newlines).
"""
import re

# Marker emitted between records by the templates below.
RECORD_SEPARATOR = '#REC'

# Menu paths the scan may read. Anything absent here is unreachable, so widening
# the scan is a deliberate edit to this tuple.
READ_MENUS = (
    '/system resource',
    '/system routerboard',
    '/system identity',
    '/system script',
    '/system scheduler',
    '/ppp aaa',
    '/ppp profile',
    '/ppp secret',
    '/ppp active',
    '/radius',
    '/radius incoming',
    '/interface pppoe-server server',
    '/interface bridge',
    '/interface bridge port',
    '/ip pool',
    '/ip address',
    '/ip dhcp-server',
    '/ip dhcp-server network',
    '/ip dhcp-server lease',
    '/ip hotspot',
    '/ip hotspot profile',
    '/ip hotspot user',
    '/ip hotspot user profile',
    '/ip hotspot ip-binding',
    '/ip hotspot walled-garden',
    '/ip firewall filter',
    '/ip firewall address-list',
    '/queue simple',
    '/queue tree',
    '/tool user-manager user',
    # Read-only, and needed to tell the operator the truth about why passwords
    # came back empty: the RouterOS `sensitive` policy lives on the user's group.
    # Guessing at this produced a scary, wrong, blocking message in production.
    '/user',
    '/user group',
)

_MENU_RE = re.compile(r'^/[a-z0-9]+(?: [a-z0-9-]+)*$')
_FIELD_RE = re.compile(r'^[a-z][a-z0-9-]*$')

_MENU_PAT = r'/[a-z0-9]+(?: [a-z0-9-]+)*'

# The three command shapes we emit. assert_read_only() accepts nothing else.
_PRINT_CMD_RE = re.compile(rf'^{_MENU_PAT} print(?: [a-z-]+)*$')
_LIST_CMD_RE = re.compile(
    rf'^:foreach i in=\[{_MENU_PAT} find\] do=\{{'
    rf':put "{RECORD_SEPARATOR}";'
    rf'(?::do \{{:put \("[a-z][a-z0-9-]*=" \. \[:tostr \[{_MENU_PAT} get \$i [a-z][a-z0-9-]*\]\]\)\}} on-error=\{{\}};)+'
    rf'\}}$'
)
_SINGLE_CMD_RE = re.compile(
    rf'^:put "{RECORD_SEPARATOR}";'
    rf'(?::do \{{:put \("[a-z][a-z0-9-]*=" \. \[:tostr \[{_MENU_PAT} get [a-z][a-z0-9-]*\]\]\)\}} on-error=\{{\}};)+$'
)

# For the operator-run agent script (§3b) we cannot use the templates above —
# it accumulates into a variable instead of printing. Its safety check is
# different in kind: reject any *menu* invocation that is not a read. `:set` and
# `:local` are scripting assignments, not menu writes, so they stay legal.
_MENU_WRITE_RE = re.compile(
    rf'{_MENU_PAT}\s+(?:add|set|remove|unset|enable|disable|move|edit|reset|'
    r'reset-configuration|import|export|restore|save|upgrade|downgrade|'
    r'install|reboot|shutdown|kill|password)(?![\w-])'
)
_AGENT_ALLOWED_MENU_CMDS = ('/tool fetch',)


class UnsafeCommand(RuntimeError):
    """Raised when a command isn't one of the read-only shapes we build."""


def assert_read_only(command):
    """Validate a finished command string, or raise :class:`UnsafeCommand`.

    Structural, not a keyword scan: the command must match one of the templates
    this module generates. Anything else — including a legitimate-looking
    ``print`` with a trailing ``; /ppp secret remove ...`` — fails.
    """
    text = (command or '').strip()
    if not text:
        raise UnsafeCommand('empty command')
    if _PRINT_CMD_RE.match(text) or _LIST_CMD_RE.match(text) or _SINGLE_CMD_RE.match(text):
        return text
    raise UnsafeCommand(f'refusing to run non-read-only command: {text[:120]!r}')


def assert_script_read_only(script):
    """Validate the operator-run agent script contains no menu writes.

    Applied to a multi-line script rather than a single command, so it checks the
    property that actually matters to someone reading it before pasting: every
    menu touched is read, and the only non-read menu command is ``/tool fetch``
    to upload the result.
    """
    text = script or ''
    scrubbed = text
    for allowed in _AGENT_ALLOWED_MENU_CMDS:
        scrubbed = scrubbed.replace(allowed, '')
    match = _MENU_WRITE_RE.search(scrubbed)
    if match:
        raise UnsafeCommand(
            f'agent script contains a menu write: {match.group(0)!r}'
        )
    return text


def _check_menu(menu):
    menu = (menu or '').strip()
    if not _MENU_RE.match(menu):
        raise UnsafeCommand(f'malformed menu path {menu!r}')
    if menu not in READ_MENUS:
        raise UnsafeCommand(f'menu {menu!r} is not in the read-only allowlist')
    return menu


def _check_fields(fields):
    for field in fields:
        if not _FIELD_RE.match(field or ''):
            raise UnsafeCommand(f'malformed field name {field!r}')
    return list(fields)


def print_command(menu, detail=False):
    """A plain ``<menu> print [detail]``, validated."""
    menu = _check_menu(menu)
    return assert_read_only(f'{menu} print detail' if detail else f'{menu} print')


def list_command(menu, fields):
    """Record emitter over every item in ``menu``.

    One ``key=value`` line per field, preceded by a ``#REC`` marker per record.
    Each field is individually ``:do{}on-error={}`` guarded: a property that is
    unset — or simply absent on this RouterOS version — raises on read and would
    otherwise abort the whole ``:foreach``, costing the entire roster instead of
    one field. ``:tostr`` normalises booleans and numbers so the parser only ever
    sees text.
    """
    menu = _check_menu(menu)
    fields = _check_fields(fields)
    parts = [f':foreach i in=[{menu} find] do={{:put "{RECORD_SEPARATOR}";']
    for field in fields:
        parts.append(
            f':do {{:put ("{field}=" . [:tostr [{menu} get $i {field}]])}} on-error={{}};'
        )
    parts.append('}')
    return assert_read_only(''.join(parts))


def single_command(menu, fields):
    """Record emitter for a singleton menu (``/ppp aaa``, ``/system resource``).

    Singletons have no ``find``, so the fields are read directly. Emitting the
    same ``#REC``/``key=value`` shape as :func:`list_command` means the parser
    handles both without a special case — and unlike ``print``, the output is not
    subject to RouterOS's column wrapping.
    """
    menu = _check_menu(menu)
    fields = _check_fields(fields)
    parts = [f':put "{RECORD_SEPARATOR}";']
    for field in fields:
        parts.append(
            f':do {{:put ("{field}=" . [:tostr [{menu} get {field}]])}} on-error={{}};'
        )
    return assert_read_only(''.join(parts))


# --- Field sets ----------------------------------------------------------

RESOURCE_FIELDS = [
    'version', 'board-name', 'architecture-name', 'uptime', 'cpu-load',
    'total-memory', 'free-memory', 'total-hdd-space', 'free-hdd-space',
]
IDENTITY_FIELDS = ['name']
ROUTERBOARD_FIELDS = ['model', 'serial-number', 'current-firmware']
AAA_FIELDS = ['use-radius', 'accounting', 'interim-update']
RADIUS_INCOMING_FIELDS = ['accept', 'port']

# `default` and `dynamic` are what separate a real subscriber from a RouterOS
# built-in. Without them the stock `default-trial` hotspot entry — a counters
# placeholder with no password property at all — is imported as a client, and
# then makes the password check conclude the whole roster is unreadable. Both
# are ordinary readable properties, so this costs one extra field per record.
SECRET_FIELDS = [
    'name', 'password', 'profile', 'service', 'remote-address', 'local-address',
    'caller-id', 'routes', 'disabled', 'comment', 'last-logged-out',
    'limit-bytes-in', 'limit-bytes-out', 'default', 'dynamic',
]
PROFILE_FIELDS = [
    'name', 'rate-limit', 'local-address', 'remote-address', 'dns-server',
    'only-one', 'session-timeout', 'idle-timeout', 'parent-queue', 'comment',
    'default', 'dynamic',
]
ACTIVE_FIELDS = ['name', 'service', 'address', 'caller-id', 'uptime', 'encoding']
HOTSPOT_USER_FIELDS = [
    'name', 'password', 'profile', 'mac-address', 'address', 'server',
    'limit-uptime', 'limit-bytes-total', 'disabled', 'comment',
    'default', 'dynamic',
]
HOTSPOT_PROFILE_FIELDS = [
    'name', 'rate-limit', 'shared-users', 'session-timeout', 'idle-timeout',
    'keepalive-timeout', 'default', 'dynamic',
]
LEASE_FIELDS = [
    'address', 'mac-address', 'client-id', 'host-name', 'server', 'status',
    'dynamic', 'disabled', 'comment',
]
QUEUE_FIELDS = [
    'name', 'target', 'max-limit', 'burst-limit', 'limit-at', 'parent',
    'disabled', 'comment',
]
POOL_FIELDS = ['name', 'ranges', 'next-pool']
RADIUS_FIELDS = ['address', 'service', 'src-address', 'timeout', 'disabled', 'comment']

# --- The scan catalogue --------------------------------------------------
#
# (key, menu, mode, fields, required). mode 'list' -> per-item emitter;
# 'single' -> singleton menu. `required=False` records an error and continues:
# a router with no hotspot, no queues or no user-manager is normal, not a
# failure, and one absent menu must never cost us the roster.

SCAN_PLAN = (
    # --- posture --------------------------------------------------------
    ('system_resource',    '/system resource',              'single', RESOURCE_FIELDS,        True),
    ('system_identity',    '/system identity',              'single', IDENTITY_FIELDS,        False),
    ('system_routerboard', '/system routerboard',           'single', ROUTERBOARD_FIELDS,     False),
    ('ppp_aaa',            '/ppp aaa',                      'single', AAA_FIELDS,             False),
    ('radius_incoming',    '/radius incoming',              'single', RADIUS_INCOMING_FIELDS, False),
    ('radius',             '/radius',                       'list',   RADIUS_FIELDS,          False),
    # --- plan skeletons -------------------------------------------------
    ('ppp_profiles',       '/ppp profile',                  'list',   PROFILE_FIELDS,         False),
    ('hotspot_profiles',   '/ip hotspot user profile',      'list',   HOTSPOT_PROFILE_FIELDS, False),
    # --- the roster -----------------------------------------------------
    ('ppp_secrets',        '/ppp secret',                   'list',   SECRET_FIELDS,          False),
    ('ppp_active',         '/ppp active',                   'list',   ACTIVE_FIELDS,          False),
    ('hotspot_users',      '/ip hotspot user',              'list',   HOTSPOT_USER_FIELDS,    False),
    ('hotspot_bindings',   '/ip hotspot ip-binding',        'list',   ['address', 'mac-address', 'type', 'comment'], False),
    ('dhcp_leases',        '/ip dhcp-server lease',         'list',   LEASE_FIELDS,           False),
    ('queues',             '/queue simple',                 'list',   QUEUE_FIELDS,           False),
    # --- address plan ---------------------------------------------------
    ('pools',              '/ip pool',                      'list',   POOL_FIELDS,            False),
    ('addresses',          '/ip address',                   'list',   ['address', 'interface', 'network', 'disabled', 'comment'], False),
    ('pppoe_servers',      '/interface pppoe-server server', 'list',  ['service-name', 'interface', 'default-profile', 'authentication', 'disabled'], False),
    ('hotspot_servers',    '/ip hotspot',                   'list',   ['name', 'interface', 'address-pool', 'profile', 'disabled'], False),
    # --- incumbent-system evidence --------------------------------------
    ('firewall_filter',    '/ip firewall filter',           'list',   ['chain', 'action', 'comment', 'disabled'], False),
    ('address_lists',      '/ip firewall address-list',     'list',   ['list', 'address', 'timeout', 'comment'], False),
    ('scripts',            '/system script',                'list',   ['name', 'comment'],    False),
    ('schedulers',         '/system scheduler',             'list',   ['name', 'start-time', 'interval', 'on-event', 'comment'], False),
    ('user_manager',       '/tool user-manager user',       'list',   ['name', 'password', 'shared-users', 'comment'], False),
    # Who we connected as, and what that group is allowed to read. Lets the
    # password diagnosis state a fact instead of an inference.
    ('router_users',       '/user',                         'list',   ['name', 'group', 'disabled'], False),
    ('router_groups',      '/user group',                   'list',   ['name', 'policy'],     False),
)


def build_scan_commands():
    """Render :data:`SCAN_PLAN` into ``[(key, command, required), ...]``.

    Every command is validated on the way out, so a bad edit to the catalogue
    fails here — at scan time with a clear error — rather than on a customer's
    router.
    """
    built = []
    for key, menu, mode, fields, required in SCAN_PLAN:
        if mode == 'single':
            command = single_command(menu, fields)
        elif mode == 'list':
            command = list_command(menu, fields)
        else:  # pragma: no cover — guards a typo in the catalogue
            raise UnsafeCommand(f'unknown scan mode {mode!r} for {key}')
        built.append((key, command, required))
    return built


# --- The agent script (transport 3b) -------------------------------------

# Records per upload. RouterOS builds strings slowly and `http-data` is
# size-capped on v6 builds, so a 400-secret roster has to go up in pieces.
AGENT_CHUNK_RECORDS = 40


def _agent_upload(key):
    """The one-line ``/tool fetch`` that ships the accumulated buffer."""
    return (
        ':do {/tool fetch url=($u . "&key=' + key + '&seq=" . $s) http-method=post '
        'http-data=$p check-certificate=no keep-result=no} on-error={}'
    )


def _agent_block(key, menu, mode, fields):
    """One menu's worth of accumulate-and-upload script."""
    lines = [f'# --- {key} ---', ':set p ""', ':set c 0', ':set s 0']
    # `{TARGET}` is substituted per mode: singletons read `get <field>`, lists
    # read `get $i <field>`.
    appends = [
        f':do {{:set p ($p . "{f}=" . [:tostr [{menu} get {{TARGET}} {f}]] . "\\n")}} on-error={{}}'
        for f in fields
    ]
    upload = _agent_upload(key)

    if mode == 'single':
        lines.append(f':set p ($p . "{RECORD_SEPARATOR}\\n")')
        lines += [a.replace('{TARGET} ', '') for a in appends]
        lines.append(upload)
    else:
        body = [f':set p ($p . "{RECORD_SEPARATOR}\\n")']
        body += [a.replace('{TARGET}', '$i') for a in appends]
        body.append(':set c ($c + 1)')
        body.append(
            f':if ($c >= {AGENT_CHUNK_RECORDS}) do={{{upload}; '
            ':set p ""; :set c 0; :set s ($s + 1)}'
        )
        lines.append(f':foreach i in=[{menu} find] do={{' + '; '.join(body) + '}')
        # Whatever is left after the last full chunk.
        lines.append(f':if ([:len $p] > 0) do={{{upload}}}')
    return lines


def build_agent_script(ingest_url):
    """A pasteable RouterOS script that scans and POSTs the result back.

    Contains no configuration commands whatsoever — which is the point, and why
    the UI shows it to the operator verbatim before they run it. It is driven by
    the same :data:`SCAN_PLAN` as the SSH transport, so the two cannot drift.

    ``ingest_url`` must already carry its token query parameter; the script
    appends ``&key=<menu>&seq=<n>`` per upload and the server reassembles the run.
    """
    safe_url = (ingest_url or '').replace('"', '').replace('\\', '')
    if not safe_url:
        raise ValueError('ingest_url is required')

    lines = [
        '# ============================================================',
        '# Infora billing — READ-ONLY router scan',
        '#',
        '# Every command below is a print/get plus one /tool fetch upload.',
        '# Nothing on this router is created, changed, enabled or removed.',
        '# Read it before you run it — that is why it is shown in full.',
        '# ============================================================',
        f':local u "{safe_url}"',
        ':local p ""',
        ':local c 0',
        ':local s 0',
        '',
    ]
    for key, menu, mode, fields, _required in SCAN_PLAN:
        lines += _agent_block(key, menu, mode, fields)
        lines.append('')
    lines += [
        '# --- end of scan: tell the server the run is complete ---',
        ':do {/tool fetch url=($u . "&key=__done__&seq=0") http-method=post '
        'http-data="ok" check-certificate=no keep-result=no} on-error={}',
        ':put "Infora scan uploaded."',
    ]
    return assert_script_read_only('\n'.join(lines) + '\n')
