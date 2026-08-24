"""Import API — router scans, reviewable runs, commit, revert, cutover scripts.

Admin-only throughout. A scan reads every subscriber's cleartext password off a
router; that is not a support-role capability, and it is why this blueprint does
its own role check rather than settling for ``@jwt_required``.

Passwords never appear in a list response. Candidates expose ``has_password``
only, mirroring how ``/api/customers/<id>/radius-credentials`` gates the reveal
of a single credential behind an explicit, audited request.
"""
import json

from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from auth_utils import get_current_user
from extensions import db
from models import ISP, ImportCandidate, ImportRun, MikrotikDevice, ServicePlan
from services import router_scan
from services.router_scan import commit as commit_service
from services.router_scan import scan as scan_service

imports_bp = Blueprint('imports', __name__, url_prefix='/api/import')


def _require_admin():
    """(user, error_response). Import is an admin-only surface."""
    user = get_current_user()
    if not user:
        return None, (jsonify({'error': 'Authentication required'}), 401)
    if user.role != 'admin':
        return None, (jsonify({'error': 'Admin access required'}), 403)
    return user, None


def _resolve_isp(user):
    if user.isp_id:
        return ISP.query.get(user.isp_id)
    return ISP.query.filter_by(is_active=True).first()


def _run_or_404(run_id, user):
    run = ImportRun.query.get(run_id)
    if not run:
        return None, (jsonify({'error': 'Import run not found'}), 404)
    if user.isp_id and run.isp_id != user.isp_id:
        return None, (jsonify({'error': 'Access denied'}), 403)
    return run, None


def _loads(value, default=None):
    if not value:
        return default
    try:
        return json.loads(value)
    except (ValueError, TypeError):
        return default


def serialize_run(run, detail=False):
    data = {
        'id': run.id,
        'source': run.source,
        'status': run.status,
        'mode': run.mode,
        'device_id': run.device_id,
        'device_name': run.device.device_name if run.device else None,
        'counts': _loads(run.counts, {}),
        'error': run.error,
        'started_at': run.started_at.isoformat() if run.started_at else None,
        'finished_at': run.finished_at.isoformat() if run.finished_at else None,
        'created_by': run.created_by.email if run.created_by else None,
    }
    if detail:
        data['fingerprint'] = _loads(run.fingerprint, {})
        data['options'] = _loads(run.options, {})
    return data


def serialize_candidate(candidate):
    """Candidate for the review table — deliberately without the password."""
    return {
        'id': candidate.id,
        'kind': candidate.kind,
        'login': candidate.login,
        'name': candidate.name,
        'phone': candidate.phone,
        'email': candidate.email,
        'profile_name': candidate.profile_name,
        'rate_limit': candidate.rate_limit_raw,
        'static_ip': candidate.static_ip,
        'mac': candidate.mac,
        'disabled': candidate.disabled,
        'online': candidate.online,
        'comment': candidate.comment,
        'subscription_end': candidate.subscription_end.isoformat() if candidate.subscription_end else None,
        'decision': candidate.decision,
        'status': candidate.status,
        'messages': _loads(candidate.messages, []),
        'match_customer_id': candidate.match_customer_id,
        'customer_id': candidate.customer_id,
        # Never the password itself.
        'has_password': bool(candidate.password_encrypted),
    }


# --- Runs ----------------------------------------------------------------

@imports_bp.route('/runs', methods=['GET'])
@jwt_required()
def list_runs():
    user, error = _require_admin()
    if error:
        return error
    query = ImportRun.query
    if user.isp_id:
        query = query.filter_by(isp_id=user.isp_id)
    runs = query.order_by(ImportRun.id.desc()).limit(50).all()
    return jsonify({'runs': [serialize_run(r) for r in runs]}), 200


@imports_bp.route('/runs/<int:run_id>', methods=['GET'])
@jwt_required()
def get_run(run_id):
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error

    # Package drafts are re-derived from the stored raw output rather than
    # persisted separately — one source of truth, and it means a parser fix
    # improves an existing run without a re-scan.
    packages = []
    try:
        _sections, inventory = scan_service.rebuild_inventory(run)
        packages = inventory['packages']
    except Exception:  # noqa: BLE001 — a run with no blob still lists fine
        pass

    return jsonify({
        'run': serialize_run(run, detail=True),
        'packages': packages,
        'available_plans': [
            {'id': p.id, 'name': p.name, 'speed': p.speed, 'plan_type': p.plan_type,
             'price': float(p.price or 0)}
            for p in ServicePlan.query.filter_by(isp_id=run.isp_id).all()
        ],
    }), 200


@imports_bp.route('/runs/<int:run_id>/candidates', methods=['GET'])
@jwt_required()
def list_candidates(run_id):
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error

    query = ImportCandidate.query.filter_by(run_id=run.id)
    status = (request.args.get('status') or '').strip()
    if status:
        query = query.filter_by(status=status)
    kind = (request.args.get('kind') or '').strip()
    if kind:
        query = query.filter_by(kind=kind)
    search = (request.args.get('q') or '').strip().lower()
    if search:
        like = f'%{search}%'
        query = query.filter(
            db.or_(ImportCandidate.login.ilike(like), ImportCandidate.name.ilike(like))
        )

    page = max(1, int(request.args.get('page', 1)))
    per_page = min(500, max(1, int(request.args.get('per_page', 100))))
    total = query.count()
    rows = (query.order_by(ImportCandidate.id)
            .offset((page - 1) * per_page).limit(per_page).all())

    return jsonify({
        'candidates': [serialize_candidate(c) for c in rows],
        'total': total,
        'page': page,
        'per_page': per_page,
    }), 200


@imports_bp.route('/runs/<int:run_id>/candidates', methods=['PATCH'])
@jwt_required()
def update_candidates(run_id):
    """Bulk operator edits: include/exclude rows, retarget a package."""
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    ids = data.get('ids')
    decision = (data.get('decision') or '').strip().lower() or None
    plan_id = data.get('resolved_plan_id')

    if decision and decision not in ('import', 'skip', 'update'):
        return jsonify({'error': f'invalid decision {decision!r}'}), 400

    query = ImportCandidate.query.filter_by(run_id=run.id)
    if ids:
        query = query.filter(ImportCandidate.id.in_(ids))
    elif not data.get('all'):
        return jsonify({'error': 'pass ids[] or all=true'}), 400

    updated = 0
    for candidate in query.all():
        if decision:
            candidate.decision = decision
        if plan_id is not None:
            candidate.resolved_plan_id = int(plan_id) if plan_id else None
        updated += 1
    db.session.commit()
    return jsonify({'updated': updated}), 200


# --- Scanning ------------------------------------------------------------

@imports_bp.route('/router/scan', methods=['POST'])
@jwt_required()
def scan_router():
    """Live SSH scan of a registered device. Read-only on the router."""
    user, error = _require_admin()
    if error:
        return error
    isp = _resolve_isp(user)
    if not isp:
        return jsonify({'error': 'No ISP context'}), 400

    data = request.get_json(silent=True) or {}
    device = MikrotikDevice.query.get(data.get('device_id') or 0)
    if not device:
        return jsonify({'error': 'Device not found'}), 404
    if user.isp_id and device.isp_id != user.isp_id:
        return jsonify({'error': 'Access denied'}), 403

    # Asynchronous: an empty router already takes ~15 s over the management
    # tunnel, and a few hundred secrets will take much longer than a worker will
    # wait. The client polls GET /api/import/runs/<id> until status leaves
    # 'scanning'.
    try:
        run = scan_service.start_device_scan(
            current_app._get_current_object(), isp, user, device,
            mine_comments=bool(data.get('mine_comments', True)),
        )
    except Exception as exc:  # noqa: BLE001 — surfaced to the operator verbatim
        db.session.rollback()
        return jsonify({'error': f'Could not start scan: {exc}'}), 502

    return jsonify({'run': serialize_run(run, detail=True), 'started': True}), 202


@imports_bp.route('/router/scan/upload', methods=['POST'])
@jwt_required()
def scan_upload():
    """Parse an uploaded ``/export`` — no access to the router required."""
    user, error = _require_admin()
    if error:
        return error
    isp = _resolve_isp(user)
    if not isp:
        return jsonify({'error': 'No ISP context'}), 400

    if 'file' in request.files:
        text = request.files['file'].read().decode('utf-8-sig', errors='replace')
        device_id = request.form.get('device_id')
    else:
        data = request.get_json(silent=True) or {}
        text = data.get('export') or ''
        device_id = data.get('device_id')

    if not (text or '').strip():
        return jsonify({'error': 'No export content supplied'}), 400

    device = MikrotikDevice.query.get(int(device_id)) if device_id else None
    try:
        run, inventory = router_scan.scan_from_export(isp, user, text, device=device)
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        return jsonify({'error': f'Could not parse export: {exc}'}), 400

    return jsonify({
        'run': serialize_run(run, detail=True),
        'packages': inventory['packages'],
        'counts': inventory['counts'],
    }), 200


@imports_bp.route('/router/agent-script', methods=['POST'])
@jwt_required()
def agent_script():
    """Mint a run + token and return the read-only script for the operator.

    The script is shown in full in the UI: its safety property is that a human
    can read it and see there is no write in it.
    """
    user, error = _require_admin()
    if error:
        return error
    isp = _resolve_isp(user)
    if not isp:
        return jsonify({'error': 'No ISP context'}), 400

    # Resolve the upload URL from configuration, NEVER from request.host_url.
    # Behind the reverse proxy the request arrives as plain http, so host_url
    # yields an http:// URL that redirects 301 to https. RouterOS `/tool fetch`
    # is not expected to follow that, and every fetch in the generated script is
    # `on-error={}` guarded — so the operator would see "scan uploaded" and no
    # data would ever arrive. It would also push subscriber passwords in the
    # clear. Reuses the resolver the provisioning one-liner already relies on.
    from services.provisioning_scripts import resolve_provision_base_url

    data = request.get_json(silent=True) or {}
    base = ((data.get('base_url') or resolve_provision_base_url()) or '').strip().rstrip('/')
    if not base:
        return jsonify({
            'error': 'No public base URL configured — set PUBLIC_BASE_URL so the router '
                     'has an address to upload its scan to.',
        }), 400
    if not base.startswith('https://'):
        # Refuse rather than mint a script that fails silently or leaks credentials.
        return jsonify({
            'error': f'Refusing to build a scan script that uploads over {base.split("://")[0]}. '
                     'The router would send subscriber passwords in the clear, and a redirect '
                     'to https would be dropped. Configure PUBLIC_BASE_URL as an https:// URL.',
        }), 400

    device = MikrotikDevice.query.get(data.get('device_id') or 0)
    run = scan_service.create_run(isp, user, 'router-agent', device=device)
    token = scan_service.issue_ingest_token(run)
    db.session.commit()

    ingest_url = f'{base}/api/import/router/ingest?token={token}'
    try:
        script = router_scan.build_agent_script(ingest_url)
    except Exception as exc:  # noqa: BLE001
        return jsonify({'error': str(exc)}), 500

    return jsonify({
        'run': serialize_run(run),
        'script': script,
        'ingest_url': ingest_url,
        'expires_at': run.ingest_token_expires_at.isoformat() if run.ingest_token_expires_at else None,
    }), 200


@imports_bp.route('/router/ingest', methods=['POST'])
def ingest_agent():
    """Receive one chunk from the agent script. Token-authenticated, no JWT.

    The router has no session; the single-run, short-lived token in the query
    string is the whole credential, which is why it expires in an hour and is
    cleared the moment the run is finalised.
    """
    token = request.args.get('token')
    run = scan_service.resolve_ingest_run(token)
    if not run:
        return jsonify({'error': 'Invalid or expired ingest token'}), 403

    key = (request.args.get('key') or '').strip()
    seq = request.args.get('seq') or 0
    body = request.get_data(as_text=True) or ''

    if key == '__done__':
        try:
            scan_service.finalise_agent_run(run)
        except Exception as exc:  # noqa: BLE001
            db.session.rollback()
            run.status = 'failed'
            run.error = str(exc)[:1000]
            db.session.commit()
            return jsonify({'error': str(exc)}), 500
        return jsonify({'status': 'complete', 'run_id': run.id}), 200

    if not key:
        return jsonify({'error': 'key is required'}), 400
    scan_service.ingest_agent_chunk(run, key, seq, body)
    db.session.commit()
    return jsonify({'status': 'ok'}), 200


# --- Planning and commit -------------------------------------------------

@imports_bp.route('/runs/<int:run_id>/plan', methods=['POST'])
@jwt_required()
def plan_run(run_id):
    """Store the operator's pricing + billing-anchor decisions on the run."""
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    options = scan_service.store_options(
        run,
        packages=data.get('packages'),
        anchor=data.get('anchor'),
        grace_days=data.get('grace_days'),
        mine_comments=data.get('mine_comments'),
    )
    db.session.commit()

    candidates = ImportCandidate.query.filter_by(run_id=run.id).all()
    preview = commit_service.expiry_preview(
        candidates,
        options.get('anchor') or commit_service.ANCHOR_UNIFORM,
        options.get('grace_days') or commit_service.DEFAULT_GRACE_DAYS,
    )
    return jsonify({'options': options, 'expiry_preview': preview}), 200


@imports_bp.route('/runs/<int:run_id>/commit', methods=['POST'])
@jwt_required()
def commit_run_route(run_id):
    """Create customers, packages and RADIUS rows for the approved candidates."""
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error
    if run.status == 'completed':
        return jsonify({'error': 'This run has already been committed'}), 409

    isp = ISP.query.get(run.isp_id)
    data = request.get_json(silent=True) or {}
    options = scan_service.run_options(run)
    drafts = data.get('packages') or options.get('packages') or []

    # Asynchronous, for the same reason as the scan: 400 customers means 400
    # inserts plus ~1,600 RADIUS rows. The past-dated-expiry guard is still
    # evaluated synchronously, so a blocked commit answers with its reason (409)
    # rather than failing invisibly in the background.
    try:
        summary = commit_service.start_commit(
            current_app._get_current_object(), run, isp,
            anchor=data.get('anchor') or options.get('anchor') or commit_service.ANCHOR_UNIFORM,
            grace_days=int(data.get('grace_days') or options.get('grace_days')
                           or commit_service.DEFAULT_GRACE_DAYS),
            drafts=drafts,
            force=bool(data.get('force')),
        )
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        run.status = 'failed'
        run.error = str(exc)[:1000]
        db.session.commit()
        return jsonify({'error': f'Import failed: {exc}'}), 500

    status = 202 if summary.get('started') else 409
    return jsonify({'run': serialize_run(run), **summary}), status


@imports_bp.route('/runs/<int:run_id>/revert', methods=['POST'])
@jwt_required()
def revert_run_route(run_id):
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error
    try:
        summary = commit_service.revert_run(run)
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        return jsonify({'error': f'Revert failed: {exc}'}), 500
    return jsonify(summary), 200


# --- Cutover -------------------------------------------------------------

@imports_bp.route('/runs/<int:run_id>/adoption-script', methods=['GET'])
@jwt_required()
def adoption_script(run_id):
    """The additive-only script that points a live router at Infora.

    Separate from the "link a MikroTik" provisioning script on purpose — see
    services/router_scan/adoption_script.py for why running that one against a
    live third-party deployment would renumber every subscriber.
    """
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error
    if not run.device:
        return jsonify({'error': 'This run has no linked device'}), 400

    isp = ISP.query.get(run.isp_id)
    try:
        script = router_scan.build_adoption_script(
            run.device, isp,
            interim_update=request.args.get('interim') or '5m',
            remove_fasttrack=(request.args.get('fasttrack', 'remove') != 'keep'),
        )
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    name = (run.device.device_name or 'router').replace(' ', '-')
    return Response(
        script,
        mimetype='text/plain',
        headers={'Content-Disposition': f'attachment; filename=infora-adopt-{name}.rsc'},
    )


@imports_bp.route('/runs/<int:run_id>/cutover', methods=['GET'])
@jwt_required()
def cutover_status(run_id):
    """Where this migration actually stands — moved, remaining, verified."""
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error
    state = router_scan.cutover_state(run)
    last = state.get('last_moved_at')
    state['last_moved_at'] = last.isoformat() if last else None
    return jsonify(state), 200


@imports_bp.route('/runs/<int:run_id>/verify', methods=['POST'])
@jwt_required()
def verify_run_route(run_id):
    """Pre-cutover check: send a real Access-Request per client and report.

    Resumable rather than backgrounded: each call works until its deadline and
    returns what is still pending, so the caller loops and shows progress. A
    background thread would need shared state across four gunicorn workers to
    say anything useful about progress, for no gain.
    """
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    isp = ISP.query.get(run.isp_id)
    try:
        summary = router_scan.verify_run(
            run, isp,
            limit=data.get('limit'),
            only_pending=bool(data.get('only_pending', True)),
            logins=data.get('logins'),
        )
    except Exception as exc:  # noqa: BLE001 - a probe failure is a result, not a 500
        current_app.logger.exception('verify run %s failed', run.id)
        return jsonify({'error': f'Verification could not run: {exc}'}), 502
    return jsonify(summary), 200


@imports_bp.route('/runs/<int:run_id>/cutover-script', methods=['POST'])
@jwt_required()
def cutover_script(run_id):
    """Batch-move imported subscribers onto Infora by disabling local credentials.

    Reversible per subscriber: the credential is disabled, never removed, so the
    password stays on the router and rollback costs one command.

    Generating the script marks the batch as moved, which is what stops the next
    click handing back the same people. ``dry_run`` previews without marking,
    and /cutover-reset undoes a batch that was never pasted.
    """
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    candidates = router_scan.select_batch(
        run,
        limit=data.get('limit'),
        profile=data.get('profile'),
        kind=data.get('kind'),
        logins=data.get('logins'),
        include_moved=bool(data.get('include_moved')),
    )
    if not candidates:
        return jsonify({
            'error': 'No subscribers left to cut over in this selection — '
                     'everyone matching it has already been moved.'
        }), 400

    entries = [{'login': c.login, 'kind': c.kind or 'pppoe'} for c in candidates]
    try:
        script = router_scan.build_retire_secrets_script(entries)
    except ValueError as exc:
        return jsonify({'error': str(exc)}), 400

    unverified = [c.login for c in candidates if c.verify_state in (None, 'fail')]
    if not data.get('dry_run'):
        router_scan.mark_moved(candidates)

    return jsonify({
        'script': script,
        'count': len(entries),
        'logins': [e['login'] for e in entries],
        'entries': entries,
        'marked': not data.get('dry_run'),
        # Naming them is the point: moving a client whose credentials do not
        # authenticate is how a cutover turns into an outage.
        'unverified': unverified,
    }), 200


@imports_bp.route('/runs/<int:run_id>/cutover-reset', methods=['POST'])
@jwt_required()
def cutover_reset(run_id):
    """Un-mark a batch — for a script that was generated but never pasted."""
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error
    data = request.get_json(silent=True) or {}
    count = router_scan.reset_moved(run, logins=data.get('logins'))
    return jsonify({'reset': count}), 200


@imports_bp.route('/runs/<int:run_id>/watch', methods=['GET'])
@jwt_required()
def cutover_watch(run_id):
    """Post-cutover watch: who did not come back."""
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error
    include_router = request.args.get('router', '1') != '0'
    return jsonify(router_scan.watch(run, include_router=include_router)), 200


@imports_bp.route('/runs/<int:run_id>/rollback-script', methods=['POST'])
@jwt_required()
def rollback_script(run_id):
    """Re-enable local credentials and drop our RADIUS entry.

    Defaults to everyone this run moved, not everyone it imported: re-enabling a
    secret nobody disabled is harmless, but the script an operator reads under
    pressure should say exactly what it is undoing. Pass ``all: true`` for the
    belt-and-braces version.
    """
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error
    data = request.get_json(silent=True) or {}

    if data.get('logins'):
        candidates = router_scan.select_batch(run, logins=data['logins'], include_moved=True)
    elif data.get('all'):
        candidates = router_scan.movable_candidates(run).all()
    else:
        candidates = [c for c in router_scan.movable_candidates(run).all() if c.cutover_at]
        if not candidates:
            candidates = router_scan.movable_candidates(run).all()

    entries = [{'login': c.login, 'kind': c.kind or 'pppoe'} for c in candidates]
    script = router_scan.build_rollback_script(entries)
    if data.get('reset', True):
        router_scan.reset_moved(run, logins=[e['login'] for e in entries] or None)
    return jsonify({'script': script, 'count': len(entries)}), 200


# --- Comment mining preview ----------------------------------------------

@imports_bp.route('/runs/<int:run_id>/comment-preview', methods=['GET'])
@jwt_required()
def comment_preview(run_id):
    """What comment mining would extract, over this operator's own comments.

    Rendered as a before/after table before anything is applied — mining is
    never silent, because a bad date across 400 subscribers is a mass
    disconnection.
    """
    user, error = _require_admin()
    if error:
        return error
    run, error = _run_or_404(run_id, user)
    if error:
        return error

    from services.router_scan.comments import preview as mine_preview
    comments = [
        c.comment for c in
        ImportCandidate.query.filter_by(run_id=run.id).all()
        if (c.comment or '').strip()
    ]
    return jsonify(mine_preview(comments, limit=int(request.args.get('limit', 20)))), 200
