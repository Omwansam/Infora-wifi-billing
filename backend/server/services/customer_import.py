"""Bulk client importer — migrating subscribers from another billing system.

Parses a CSV (or a list of row dicts) of subscribers, cleans + validates each
row, and on commit creates ``Customer`` rows and provisions RADIUS exactly like
a normal signup — reusing :func:`provision_customer_radius` so imported clients
keep their original login + password and the CPE keeps dialing unchanged
(zero-touch cutover).

See MIGRATION_FROM_OTHER_BILLING.md §7.
"""
import csv
import io
import re
from datetime import datetime

from extensions import db
from models import Customer, CustomerStatus, RadCheck, RadReply, ServicePlan
from services.hotspot_credentials import normalize_phone
from services.radius_provisioning import (
    ensure_account_number,
    find_customer_by_login,
    provision_customer_radius,
    radius_username,
    set_customer_radius_password,
)

# Canonical columns of the import template (order is the template's column order).
TEMPLATE_COLUMNS = [
    'name', 'login', 'password', 'email', 'phone', 'plan',
    'connection_type', 'status', 'subscription_end', 'balance',
    'static_ip', 'mac', 'account_number',
]

# A couple of illustrative rows so operators see the expected shape.
TEMPLATE_SAMPLE_ROWS = [
    ['John Kabete', 'john_kabete', 'S3cret!', 'john@example.com', '0712345678',
     'Home 8M', 'pppoe', 'active', '2026-08-15', '0', '', '', ''],
    ['Mary Wanjiru', 'mary_w', '', '', '0722000000',
     'Home 8M', 'pppoe', 'active', '2026-07-25', '0', '102.0.0.20', '', ''],
]

# Header aliases from common exports → our canonical column names. Matched
# case-insensitively after stripping spaces/underscores.
COLUMN_ALIASES = {
    'name': 'name', 'fullname': 'name', 'full name': 'name', 'customer': 'name',
    'customername': 'name', 'client': 'name', 'subscriber': 'name',
    'login': 'login', 'username': 'login', 'user': 'login', 'pppoelogin': 'login',
    'pppoeusername': 'login', 'radiuslogin': 'login', 'account': 'login',
    'password': 'password', 'pass': 'password', 'pppoepassword': 'password',
    'secret': 'password', 'pppoepass': 'password',
    'email': 'email', 'emailaddress': 'email', 'mail': 'email',
    'phone': 'phone', 'mobile': 'phone', 'msisdn': 'phone', 'phonenumber': 'phone',
    'cell': 'phone',
    'plan': 'plan', 'tariff': 'plan', 'package': 'plan', 'service': 'plan',
    'profile': 'plan', 'serviceplan': 'plan',
    'connectiontype': 'connection_type', 'type': 'connection_type',
    'conntype': 'connection_type', 'service_type': 'connection_type',
    'status': 'status', 'state': 'status', 'active': 'status',
    'subscriptionend': 'subscription_end', 'expiry': 'subscription_end',
    'expiration': 'subscription_end', 'expirydate': 'subscription_end',
    'duedate': 'subscription_end', 'nextdue': 'subscription_end',
    'validtill': 'subscription_end', 'expires': 'subscription_end',
    'balance': 'balance', 'owed': 'balance', 'outstanding': 'balance',
    'arrears': 'balance',
    'staticip': 'static_ip', 'ip': 'static_ip', 'framedip': 'static_ip',
    'framedipaddress': 'static_ip', 'fixedip': 'static_ip',
    'mac': 'mac', 'macaddress': 'mac', 'callingstationid': 'mac',
    'accountnumber': 'account_number', 'accountno': 'account_number',
    'acct': 'account_number', 'accountno.': 'account_number',
}

VALID_STATUSES = {s.value for s in CustomerStatus}
VALID_CONNECTION_TYPES = {'pppoe', 'hotspot', 'wireguard'}

# Foreign status vocabularies → our three. Anything here is auto-cleaned; only
# genuinely unrecognised values fall back to the operator's default_status.
STATUS_SYNONYMS = {
    'active': 'active', 'enabled': 'active', 'online': 'active', 'connected': 'active',
    'live': 'active', 'ok': 'active', 'current': 'active', 'paid': 'active', 'up': 'active',
    'suspended': 'suspended', 'churned': 'suspended', 'cancelled': 'suspended',
    'canceled': 'suspended', 'inactive': 'suspended', 'disabled': 'suspended',
    'expired': 'suspended', 'blocked': 'suspended', 'terminated': 'suspended',
    'deactivated': 'suspended', 'offline': 'suspended', 'closed': 'suspended',
    'unpaid': 'suspended', 'overdue': 'suspended', 'former': 'suspended', 'left': 'suspended',
    'pending': 'pending', 'new': 'pending', 'prospect': 'pending', 'unactivated': 'pending',
    'trial': 'pending', 'onboarding': 'pending', 'draft': 'pending', 'lead': 'pending',
}


def normalize_status(value, default_status):
    """Map a foreign status onto active/suspended/pending.

    Returns (status, change) where ``change`` is (original, mapped) when the raw
    value was rewritten (for reporting), else None.
    """
    v = (value or '').strip().lower()
    if not v:
        return default_status, None
    if v in VALID_STATUSES:
        return v, None
    mapped = STATUS_SYNONYMS.get(v)
    if mapped:
        return mapped, (v, mapped)
    return default_status, (v, default_status)


def _norm_key(text):
    """Loose key for matching plan names: lowercased, no spaces/punctuation."""
    return re.sub(r'[^a-z0-9]', '', (text or '').strip().lower())


def _speed_number(text):
    """First integer in a string, e.g. '20MBPS'→20, 'Home 3Mbps'→3, '5MB'→5."""
    m = re.search(r'(\d+)', text or '')
    return int(m.group(1)) if m else None


def _build_plan_indexes(plan_list):
    """Return (by_name, by_key, by_speed) lookups over a list of ServicePlans."""
    by_name = {}
    by_key = {}
    by_speed = {}
    for p in plan_list:
        by_name[p.name.strip().lower()] = p
        by_key[_norm_key(p.name)] = p
        num = _speed_number(p.speed) or _speed_number(p.name)
        if num is not None:
            by_speed.setdefault(num, []).append(p)
    return by_name, by_key, by_speed


def _auto_match_plan(plan_name, by_speed):
    """Best existing plan for a foreign plan name, matched by speed number.

    Only returns a plan when the match is unambiguous (exactly one existing plan
    at that speed) — otherwise the caller surfaces it for operator mapping.
    """
    num = _speed_number(plan_name)
    if num is None:
        return None
    candidates = by_speed.get(num, [])
    return candidates[0] if len(candidates) == 1 else None


def build_template_csv():
    """Return the import template as a CSV string (header + sample rows)."""
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(TEMPLATE_COLUMNS)
    for row in TEMPLATE_SAMPLE_ROWS:
        writer.writerow(row)
    return out.getvalue()


def _canonical_header(raw_header):
    key = (raw_header or '').strip().lower().replace('_', '').replace('-', '').replace(' ', '')
    return COLUMN_ALIASES.get(key)


def parse_csv(content):
    """Parse CSV text/bytes into a list of canonicalised row dicts.

    Unknown columns are dropped; known aliases are mapped to canonical names.
    """
    if isinstance(content, bytes):
        content = content.decode('utf-8-sig', errors='replace')
    reader = csv.reader(io.StringIO(content))
    rows = list(reader)
    if not rows:
        return []
    header = rows[0]
    # Map each source column index → canonical name (or None to ignore).
    index_map = [(_canonical_header(h), i) for i, h in enumerate(header)]
    parsed = []
    for source in rows[1:]:
        if not any((cell or '').strip() for cell in source):
            continue  # skip blank lines
        row = {}
        for canonical, idx in index_map:
            if canonical and idx < len(source):
                row[canonical] = source[idx]
        parsed.append(row)
    return parsed


# Accepted date formats, tried in order. Day-first (DD/MM) is prioritised over
# month-first to match Kenyan/most-of-world exports; ISO is first regardless.
_DATE_FORMATS = (
    '%Y-%m-%d',
    '%Y-%m-%d %H:%M:%S',
    '%Y-%m-%dT%H:%M:%S',
    '%Y/%m/%d',
    '%d/%m/%Y',
    '%d/%m/%y',
    '%d-%m-%Y',
    '%d.%m.%Y',
    '%m/%d/%Y',
    '%d %b %Y',
    '%d %B %Y',
    '%b %d %Y',
    '%b %d, %Y',
    '%B %d, %Y',
    '%Y%m%d',
)


def _parse_date(value):
    """Parse a loose date string into a naive datetime. Stdlib only.

    Returns (datetime|None, error|None). Blank → (None, None).
    """
    value = (value or '').strip()
    if not value:
        return None, None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt), None
        except ValueError:
            continue
    # Last resort: take the leading YYYY-MM-DD / DD/MM/YYYY off a longer string
    # (e.g. an ISO timestamp with a timezone or fractional seconds).
    head = value[:10]
    for fmt in ('%Y-%m-%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(head, fmt), None
        except ValueError:
            continue
    return None, f'unparseable date {value!r}'


def _clean_and_validate(raw, isp, ctx, seen):
    """Clean one raw row and validate it.

    Returns (cleaned_dict, [errors], meta) where meta reports the auto-cleaning
    that happened: ``status_change`` and ``unmatched_plan`` so the caller can
    aggregate them for the operator.
    """
    errors = []
    meta = {'status_change': None, 'unmatched_plan': None, 'plan_to_create': None}

    name = (raw.get('name') or '').strip()
    login = (raw.get('login') or '').strip().lower() or None
    password = (raw.get('password') or '').strip() or None
    email = (raw.get('email') or '').strip().lower() or None
    phone_raw = (raw.get('phone') or '').strip()
    phone = normalize_phone(phone_raw) if phone_raw else None
    plan_name = (raw.get('plan') or '').strip()
    connection_type = (raw.get('connection_type') or '').strip().lower() or None
    static_ip = (raw.get('static_ip') or '').strip() or None
    mac = (raw.get('mac') or '').strip().upper() or None
    account_number = (raw.get('account_number') or '').strip() or None

    # Status: auto-clean foreign vocabularies (churned→suspended, etc.).
    status, status_change = normalize_status(raw.get('status'), ctx['default_status'])
    meta['status_change'] = status_change

    if not name:
        errors.append('name is required')

    # A subscriber needs at least one login handle.
    if not login and not email:
        errors.append('a login or an email is required')

    # Plan resolution: explicit operator mapping → exact name → unambiguous
    # speed auto-match → pending-create intent → otherwise flag for mapping.
    plan = None
    plan_pending_create = False
    if not plan_name:
        errors.append('plan is required')
    else:
        key = _norm_key(plan_name)
        plan = (
            ctx['plan_map'].get(key)
            or ctx['by_name'].get(plan_name.lower())
            or ctx['by_key'].get(key)
            or _auto_match_plan(plan_name, ctx['by_speed'])
        )
        if plan is None and key in ctx['create_keys']:
            plan_pending_create = True
            meta['plan_to_create'] = plan_name
        if plan is None and not plan_pending_create:
            errors.append(f'unknown plan {plan_name!r} — map it to a package or create it')
            meta['unmatched_plan'] = plan_name

    if connection_type and connection_type not in VALID_CONNECTION_TYPES:
        errors.append(f'invalid connection_type {connection_type!r}')
    if plan and connection_type and plan.plan_type != connection_type:
        errors.append(f'plan {plan.name!r} is {plan.plan_type}, not {connection_type}')

    subscription_end, date_err = _parse_date(raw.get('subscription_end'))
    if date_err:
        errors.append(date_err)

    balance_raw = (raw.get('balance') or '').strip()
    balance = 0.0
    if balance_raw:
        try:
            balance = float(balance_raw.replace(',', ''))
        except ValueError:
            errors.append(f'invalid balance {balance_raw!r}')

    # Uniqueness — against the DB and against earlier rows in this same file.
    if email:
        if email in seen['email']:
            errors.append(f'duplicate email {email!r} within file')
        elif Customer.query.filter_by(email=email).first():
            errors.append(f'email {email!r} already exists')
    if login:
        if login in seen['login']:
            errors.append(f'duplicate login {login!r} within file')
        elif find_customer_by_login(login, isp_id=isp.id):
            errors.append(f'login {login!r} already exists')
    if account_number:
        if account_number in seen['account']:
            errors.append(f'duplicate account number {account_number!r} within file')
        elif Customer.query.filter_by(account_number=account_number, isp_id=isp.id).first():
            errors.append(f'account number {account_number!r} already exists')

    if not errors:
        if email:
            seen['email'].add(email)
        if login:
            seen['login'].add(login)
        if account_number:
            seen['account'].add(account_number)

    cleaned = {
        'name': name,
        'login': login,
        'password': password,
        'email': email,
        'phone': phone,
        'plan': plan,
        'plan_name': plan_name,
        'plan_pending_create': plan_pending_create,
        'connection_type': connection_type or (plan.plan_type if plan else 'pppoe'),
        'status': status,
        'subscription_end': subscription_end,
        'balance': balance,
        'static_ip': static_ip,
        'mac': mac,
        'account_number': account_number,
    }
    return cleaned, errors, meta


def _add_reply_attribute(customer, isp, attribute, value):
    username = radius_username(customer)
    RadReply.query.filter_by(
        username=username, attribute=attribute, isp_id=isp.id
    ).delete(synchronize_session=False)
    db.session.add(RadReply(
        username=username, attribute=attribute, op=':=', value=value,
        isp_id=isp.id, customer_id=customer.id, is_active=True,
    ))


def _add_check_attribute(customer, isp, attribute, value):
    username = radius_username(customer)
    RadCheck.query.filter_by(
        username=username, attribute=attribute, isp_id=isp.id
    ).delete(synchronize_session=False)
    db.session.add(RadCheck(
        username=username, attribute=attribute, op=':=', value=value,
        isp_id=isp.id, customer_id=customer.id, is_active=True,
    ))


def _create_customer(cleaned, isp):
    """Create + provision one customer from a validated, cleaned row."""
    plan = cleaned['plan']
    status = CustomerStatus(cleaned['status'])
    connection_type = cleaned['connection_type']

    customer = Customer(
        full_name=cleaned['name'],
        email=cleaned['email'],
        radius_login=cleaned['login'],
        phone=cleaned['phone'] or '',
        status=status,
        balance=cleaned['balance'] or 0,
        package=plan.name if plan else 'Imported',
        isp_id=isp.id,
        service_plan_id=plan.id if plan else None,
        connection_type=connection_type,
        subscription_end=cleaned['subscription_end'],
    )
    if cleaned['subscription_end'] and status == CustomerStatus.ACTIVE:
        customer.subscription_start = datetime.utcnow()

    db.session.add(customer)
    db.session.flush()

    ensure_account_number(customer, isp, preferred=cleaned['account_number'])

    # Preserve the original password when supplied; otherwise generate one (the
    # client will need reconfiguring — flagged to the operator in the summary).
    cleartext = set_customer_radius_password(customer, cleaned['password'])

    if status == CustomerStatus.ACTIVE and plan:
        if plan.plan_type == 'wireguard':
            from services.wireguard_provisioning import provision_customer_wireguard
            provision_customer_wireguard(customer, plan, isp)
        else:
            provision_customer_radius(customer, plan, isp, password=cleartext)
            # Carry static IP / hotspot MAC as standard FreeRADIUS attributes.
            if cleaned['static_ip']:
                _add_reply_attribute(customer, isp, 'Framed-IP-Address', cleaned['static_ip'])
            if cleaned['mac'] and connection_type == 'hotspot':
                _add_check_attribute(customer, isp, 'Calling-Station-Id', cleaned['mac'])

    return customer, (cleaned['password'] is None and status == CustomerStatus.ACTIVE)


def _suggest_plan(plan_name, by_speed):
    """Best-effort existing plan for a foreign name (even if ambiguous)."""
    num = _speed_number(plan_name)
    candidates = by_speed.get(num, []) if num is not None else []
    return candidates[0] if candidates else None


def _create_plan_from_name(plan_name, isp, connection_type='pppoe'):
    """Auto-create a placeholder ServicePlan from a CSV plan name.

    Speed is derived from the name (e.g. '20MBPS'→'20M'); price defaults to 0 so
    the operator sets real pricing in Packages afterwards.
    """
    num = _speed_number(plan_name)
    speed = f'{num}M' if num is not None else (plan_name.strip() or 'Imported')
    ptype = connection_type if connection_type in VALID_CONNECTION_TYPES else 'pppoe'
    plan = ServicePlan(
        name=plan_name.strip(),
        speed=speed,
        price=0,
        features={},
        plan_type=ptype,
        bandwidth_limit=num,
        billing_cycle_days=30,
        isp_id=isp.id,
        is_active=True,
    )
    db.session.add(plan)
    db.session.flush()
    return plan


def _resolve_plan_map(plan_map, by_name, by_key):
    """Turn an operator {old_name: plan_id|plan_name} map into {norm_key: plan}."""
    resolved = {}
    for old_name, target in (plan_map or {}).items():
        plan = None
        if isinstance(target, int) or (isinstance(target, str) and target.isdigit()):
            plan = ServicePlan.query.get(int(target))
        if plan is None and isinstance(target, str):
            plan = by_name.get(target.strip().lower()) or by_key.get(_norm_key(target))
        if plan is not None:
            resolved[_norm_key(old_name)] = plan
    return resolved


def process_import(isp, rows, dry_run=True, default_status='active',
                   plan_map=None, create_plans=None, auto_create_plans=True):
    """Validate (and, unless ``dry_run``, create) a batch of imported clients.

    ``plan_map`` maps foreign plan names → existing package (id or name).
    ``auto_create_plans`` (default true): any package name that matches nothing
    is created automatically as a placeholder — the operator can still override
    it to an existing package via ``plan_map``. ``create_plans`` explicitly forces
    creation of specific names. On commit the plans are created first, then each
    row is created in its own SAVEPOINT so one bad row can't roll back the rest.

    Returns a summary with per-row status plus the auto-cleaning report
    (``plan_resolutions``, ``status_normalizations``, ``available_plans``).
    """
    plan_list = ServicePlan.query.filter_by(isp_id=isp.id).all()
    by_name, by_key, by_speed = _build_plan_indexes(plan_list)
    resolved_map = _resolve_plan_map(plan_map, by_name, by_key)

    # Names to create: operator-forced ones, plus (when auto_create_plans) every
    # CSV package that resolves to nothing. Keyed by norm-key → display name.
    create_names = {}
    for name in (create_plans or []):
        if name and name.strip():
            create_names[_norm_key(name)] = name.strip()
    if auto_create_plans:
        for raw in rows:
            pname = (raw.get('plan') or '').strip()
            if not pname:
                continue
            key = _norm_key(pname)
            if key in create_names or key in resolved_map:
                continue
            if by_name.get(pname.lower()) or by_key.get(key) or _auto_match_plan(pname, by_speed):
                continue
            create_names[key] = pname

    # On commit, materialise those plans up-front so rows resolve to real objects.
    if not dry_run and create_names:
        for key, name in create_names.items():
            if not (by_name.get(name.lower()) or by_key.get(key)):
                plan_list.append(_create_plan_from_name(name, isp))
        by_name, by_key, by_speed = _build_plan_indexes(plan_list)
        resolved_map = _resolve_plan_map(plan_map, by_name, by_key)

    ctx = {
        'default_status': default_status,
        'by_name': by_name,
        'by_key': by_key,
        'by_speed': by_speed,
        'plan_map': resolved_map,
        'create_keys': set(create_names.keys()),
    }
    seen = {'email': set(), 'login': set(), 'account': set()}

    results = []
    valid = 0
    created = 0
    failed = 0
    needs_reconfigure = 0
    unmatched = {}          # name -> count (still an error: needs mapping)
    to_create = {}          # name -> count (will be auto-created)
    status_counts = {}      # (from, to) -> count

    for idx, raw in enumerate(rows, start=1):
        cleaned, errors, meta = _clean_and_validate(raw, isp, ctx, seen)

        if meta['unmatched_plan']:
            unmatched[meta['unmatched_plan']] = unmatched.get(meta['unmatched_plan'], 0) + 1
        if meta['plan_to_create']:
            to_create[meta['plan_to_create']] = to_create.get(meta['plan_to_create'], 0) + 1
        if meta['status_change']:
            status_counts[meta['status_change']] = status_counts.get(meta['status_change'], 0) + 1

        plan_display = cleaned['plan'].name if cleaned['plan'] else cleaned['plan_name']
        if cleaned['plan_pending_create']:
            plan_display = f"{cleaned['plan_name']} (new)"
        preview = {
            'name': cleaned['name'],
            'login': cleaned['login'] or cleaned['email'],
            'email': cleaned['email'],
            'phone': cleaned['phone'],
            'plan': plan_display,
            'connection_type': cleaned['connection_type'],
            'status': cleaned['status'],
            'subscription_end': cleaned['subscription_end'].isoformat() if cleaned['subscription_end'] else None,
            'account_number': cleaned['account_number'],
            'password_generated': cleaned['password'] is None,
        }
        entry = {'row': idx, 'status': 'error' if errors else 'valid',
                 'messages': errors, 'data': preview}

        if errors:
            if not dry_run:
                failed += 1
            results.append(entry)
            continue

        valid += 1
        if dry_run:
            entry['status'] = 'valid'
            results.append(entry)
            continue

        try:
            with db.session.begin_nested():
                customer, generated = _create_customer(cleaned, isp)
            entry['status'] = 'created'
            entry['customer_id'] = customer.id
            entry['data']['account_number'] = customer.account_number
            created += 1
            if generated:
                needs_reconfigure += 1
        except Exception as exc:
            db.session.rollback()
            entry['status'] = 'error'
            entry['messages'] = [f'create failed: {exc}']
            failed += 1
        results.append(entry)

    if not dry_run:
        db.session.commit()

    # One list the UI renders: packages needing an action. ``create`` ones will
    # be auto-created (default) but can be remapped; ``unmatched`` ones (only
    # when auto_create_plans is off) must be resolved before those rows import.
    plan_resolutions = []
    for name, count in sorted(to_create.items(), key=lambda kv: -kv[1]):
        suggestion = _suggest_plan(name, by_speed)
        plan_resolutions.append({
            'name': name,
            'count': count,
            'action': 'create',
            'default': '__create__',
            'suggestion_id': suggestion.id if suggestion else None,
            'suggestion_name': suggestion.name if suggestion else None,
        })
    for name, count in sorted(unmatched.items(), key=lambda kv: -kv[1]):
        suggestion = _suggest_plan(name, by_speed)
        plan_resolutions.append({
            'name': name,
            'count': count,
            'action': 'unmatched',
            'default': str(suggestion.id) if suggestion else '',
            'suggestion_id': suggestion.id if suggestion else None,
            'suggestion_name': suggestion.name if suggestion else None,
        })

    status_normalizations = [
        {'from': frm, 'to': to, 'count': count}
        for (frm, to), count in sorted(status_counts.items(), key=lambda kv: -kv[1])
    ]

    return {
        'dry_run': dry_run,
        'total': len(rows),
        'valid': valid,
        'would_create': valid if dry_run else None,
        'created': None if dry_run else created,
        'failed': None if dry_run else failed,
        'errors': sum(1 for r in results if r['status'] == 'error'),
        'needs_reconfigure': None if dry_run else needs_reconfigure,
        'auto_create_plans': auto_create_plans,
        'plans_to_create': len(to_create),
        'plan_resolutions': plan_resolutions,
        # Back-compat alias (only the ones still erroring).
        'unmatched_plans': [r for r in plan_resolutions if r['action'] == 'unmatched'],
        'status_normalizations': status_normalizations,
        'available_plans': [
            {'id': p.id, 'name': p.name, 'speed': p.speed, 'plan_type': p.plan_type}
            for p in plan_list
        ],
        'rows': results,
    }
