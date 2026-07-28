"""Scan orchestration: get RouterOS output in, get an ImportRun out.

Three transports, one parser (see ROUTER_SCAN_IMPORT_AND_TAKEOVER.md §3):

* :func:`scan_via_ssh` — live, over the existing serialized SSH helper;
* :func:`ingest_agent_chunk` — the operator ran our read-only script and it
  POSTed back;
* :func:`scan_from_export` — the operator uploaded a ``/export``.

The transport only decides how the text arrives. Everything after that —
parsing, fingerprinting, normalisation — is shared, which is why an operator who
will not give us router access still gets exactly the same import.
"""
import json
import secrets
from datetime import datetime, timedelta

from extensions import db
from models import ImportCandidate, ImportRun

from .commands import build_scan_commands
from .fingerprint import fingerprint
from .inventory import build_inventory
from .parser import export_to_sections, parse_records

# Live SSH needs a far longer budget than a stats poll: ~20 read commands, one
# of which streams several hundred subscribers.
SCAN_SSH_TIMEOUT = 60
SCAN_LOCK_WAIT = 45

AGENT_TOKEN_TTL_MINUTES = 60


def _json_dump(value):
    return json.dumps(value, default=str)


def _json_load(value, default=None):
    if not value:
        return default
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return default


# --- Transports ----------------------------------------------------------

def collect_via_ssh(device):
    """Run the read-only catalogue over SSH. Returns ``{key: raw_output}``.

    Uses services.device_config_ops.mikrotik_ssh, which already serialises access
    per device behind a file lock and retries MikroTik's flaky SSH banner. One
    session for the whole scan: reconnecting between commands is what makes a
    router drop the connection mid-banner in the first place.

    A failing optional command records its error and the scan continues — a
    router with no hotspot or no user-manager is normal, and one absent menu must
    never cost us the roster.
    """
    from services.device_config_ops import mikrotik_ssh

    sections_raw = {}
    errors = {}
    with mikrotik_ssh(device, timeout=SCAN_SSH_TIMEOUT, lock_wait=SCAN_LOCK_WAIT) as client:
        for key, command, required in build_scan_commands():
            try:
                out, err = client.run_cli(command)
                sections_raw[key] = out or ''
                if err and err.strip():
                    errors[key] = err.strip()[:300]
            except Exception as exc:  # noqa: BLE001 — one menu must not kill the scan
                errors[key] = str(exc)[:300]
                if required:
                    raise
    return sections_raw, errors


def parse_raw_sections(sections_raw):
    """Parse each transport-captured section into records."""
    return {key: parse_records(text) for key, text in (sections_raw or {}).items()}


# --- Run lifecycle -------------------------------------------------------

def create_run(isp, user, source, device=None, mode='dry_run'):
    run = ImportRun(
        isp_id=isp.id,
        device_id=device.id if device else None,
        created_by_id=user.id if user else None,
        source=source,
        status='scanning',
        mode=mode,
    )
    db.session.add(run)
    db.session.flush()
    return run


def issue_ingest_token(run):
    """Mint the single-run, short-lived token for the agent transport.

    Short-lived and single-purpose on purpose: it gets pasted into a terminal and
    will end up in somebody's clipboard history.
    """
    run.ingest_token = secrets.token_hex(32)
    run.ingest_token_expires_at = datetime.utcnow() + timedelta(minutes=AGENT_TOKEN_TTL_MINUTES)
    return run.ingest_token


def resolve_ingest_run(token):
    """Look up a run by agent token, enforcing expiry."""
    if not token:
        return None
    run = ImportRun.query.filter_by(ingest_token=token).first()
    if not run:
        return None
    if run.ingest_token_expires_at and run.ingest_token_expires_at < datetime.utcnow():
        return None
    return run


def ingest_agent_chunk(run, key, seq, body):
    """Accept one uploaded chunk from the agent script and append it.

    Chunks arrive per menu and, for large menus, per 40 records. They are stored
    verbatim in the run's raw blob keyed by ``(key, seq)`` so a retried or
    out-of-order upload overwrites rather than duplicates.
    """
    blob = _json_load(run.raw_blob, {}) or {}
    chunks = blob.setdefault('_chunks', {})
    chunks[f'{key}:{int(seq)}'] = body or ''
    run.raw_blob = _json_dump(blob)
    return len(chunks)


def assemble_agent_chunks(run):
    """Concatenate the agent's chunks back into ``{key: raw_output}``."""
    blob = _json_load(run.raw_blob, {}) or {}
    chunks = blob.get('_chunks') or {}
    ordered = {}
    for composite, text in chunks.items():
        key, _, seq = composite.rpartition(':')
        if key == '__done__':
            continue
        ordered.setdefault(key, []).append((int(seq or 0), text))
    return {key: ''.join(t for _s, t in sorted(parts)) for key, parts in ordered.items()}


# --- Normalisation into candidates ---------------------------------------

def _store_password(candidate_row, cleartext):
    """Encrypt a scanned password onto the candidate.

    A scan produces several hundred subscribers' live credentials. They are
    encrypted here, at the boundary, so the plaintext never reaches the database
    and never reaches a log line.
    """
    if not cleartext:
        return
    from services.encryption import encrypt_value
    candidate_row.password_encrypted = encrypt_value(cleartext)


def persist_inventory(run, sections, inventory):
    """Write the fingerprint and one ImportCandidate per discovered subscriber."""
    from services.radius_provisioning import find_customer_by_login

    run.fingerprint = _json_dump(fingerprint(sections))

    seen_logins = set()
    duplicates = 0
    for item in inventory['candidates']:
        login = (item.get('login') or '').strip().lower() or None
        status = 'new'
        messages = []
        match_id = None

        if login:
            if login in seen_logins:
                status = 'duplicate'
                messages.append('duplicate login within this scan')
            else:
                seen_logins.add(login)
                existing = find_customer_by_login(login, isp_id=run.isp_id)
                if existing:
                    status = 'duplicate'
                    match_id = existing.id
                    messages.append('already exists in Infora — will be skipped')
        if status == 'duplicate':
            duplicates += 1

        if item.get('kind') == 'static':
            messages.append('static/queue client: billable but not enforceable by RADIUS')
        if not item.get('password') and item.get('kind') != 'static':
            messages.append('no password on the router — a new one will be generated')

        row = ImportCandidate(
            run_id=run.id,
            kind=item.get('kind') or 'pppoe',
            login=login,
            name=item.get('name'),
            phone=item.get('phone'),
            email=item.get('email'),
            profile_name=item.get('profile_name'),
            rate_limit_raw=(item.get('rate_limit') or {}).get('raw') if item.get('rate_limit') else None,
            static_ip=item.get('static_ip'),
            mac=item.get('mac'),
            disabled=bool(item.get('disabled')),
            online=bool(item.get('online')),
            comment=item.get('comment'),
            raw=_json_dump(item.get('raw') or {}),
            subscription_end=item.get('mined_expiry'),
            decision='skip' if status == 'duplicate' else 'import',
            status=status,
            messages=_json_dump(messages) if messages else None,
            match_customer_id=match_id,
        )
        _store_password(row, item.get('password'))
        db.session.add(row)

    counts = dict(inventory['counts'])
    counts['duplicates'] = duplicates
    counts['importable'] = counts['total'] - duplicates
    run.counts = _json_dump(counts)
    return inventory


def store_options(run, **options):
    """Merge operator decisions onto the run (pricing, anchor, plan map…)."""
    current = _json_load(run.options, {}) or {}
    current.update({k: v for k, v in options.items() if v is not None})
    run.options = _json_dump(current)
    return current


def run_options(run):
    return _json_load(run.options, {}) or {}


def run_fingerprint(run):
    return _json_load(run.fingerprint, {}) or {}


def run_counts(run):
    return _json_load(run.counts, {}) or {}


# --- Entry points --------------------------------------------------------

def scan_device(isp, user, device, mine_comments=True):
    """Live SSH scan → persisted, reviewable run."""
    run = create_run(isp, user, 'router-ssh', device=device)
    try:
        sections_raw, errors = collect_via_ssh(device)
    except Exception as exc:
        run.status = 'failed'
        run.error = str(exc)[:1000]
        run.finished_at = datetime.utcnow()
        db.session.commit()
        raise

    sections = parse_raw_sections(sections_raw)
    inventory = build_inventory(sections, mine_comments=mine_comments)
    run.raw_blob = _json_dump({'sections': sections_raw, 'errors': errors})
    persist_inventory(run, sections, inventory)
    run.status = 'scanned'
    run.finished_at = datetime.utcnow()
    db.session.commit()
    return run, inventory


def scan_from_export(isp, user, text, device=None, mine_comments=True):
    """Uploaded ``/export`` → persisted, reviewable run.

    The commonest real case: the router is behind CGNAT and the operator will not
    (or cannot) open access to it, so they paste a config export instead.
    """
    sections = export_to_sections(text)
    inventory = build_inventory(sections, mine_comments=mine_comments)
    run = create_run(isp, user, 'router-export', device=device)
    run.raw_blob = _json_dump({'export': text})
    persist_inventory(run, sections, inventory)
    run.status = 'scanned'
    run.finished_at = datetime.utcnow()
    db.session.commit()
    return run, inventory


def finalise_agent_run(run, mine_comments=True):
    """Parse an agent-uploaded run once the script signals completion."""
    sections_raw = assemble_agent_chunks(run)
    sections = parse_raw_sections(sections_raw)
    inventory = build_inventory(sections, mine_comments=mine_comments)
    persist_inventory(run, sections, inventory)
    run.status = 'scanned'
    run.finished_at = datetime.utcnow()
    run.ingest_token = None
    db.session.commit()
    return run, inventory


def rebuild_inventory(run, mine_comments=True):
    """Re-parse a stored run without touching the router.

    Lets the operator change the comment-mining rules, or lets us fix a parser
    bug, and re-derive the candidates from the captured output.
    """
    blob = _json_load(run.raw_blob, {}) or {}
    if blob.get('export'):
        sections = export_to_sections(blob['export'])
    else:
        sections = parse_raw_sections(blob.get('sections') or assemble_agent_chunks(run))
    return sections, build_inventory(sections, mine_comments=mine_comments)
