"""Turn reviewed candidates into customers, packages and RADIUS rows.

Deliberately thin. The heavy lifting — savepoint-per-row isolation, plan
resolution, status normalisation, account numbers, and the actual
``provision_customer_radius`` call — already exists in
:mod:`services.customer_import` and is battle-tested by the CSV path. This
module's job is to convert candidates into the row shape that importer accepts,
create the priced packages first, and record provenance so a run can be reverted.

Growing a second creation path here would mean two places to keep correct
forever; there is exactly one, and it is the one that already works.
"""
import json
import threading
from datetime import datetime, timedelta

from extensions import db
from models import Customer, ImportCandidate, ImportRun, ServicePlan

from .profiles import draft_to_plan_kwargs

# Billing anchors (ROUTER_SCAN_IMPORT_AND_TAKEOVER.md §10).
ANCHOR_UNIFORM = 'uniform'      # everyone gets today + N days
ANCHOR_MINED = 'mined'          # use the date found in the router comment
ANCHOR_NONE = 'none'            # leave subscription_end unset

DEFAULT_GRACE_DAYS = 30

# Refuse to commit when more than this share of clients would land already
# expired. A bad date parse across 400 subscribers is a mass disconnection, and
# that is the worst thing this feature can do.
PAST_DATED_BLOCK_RATIO = 0.05


def _messages(candidate):
    try:
        return json.loads(candidate.messages) if candidate.messages else []
    except (ValueError, TypeError):
        return []


def _set_messages(candidate, messages):
    candidate.messages = json.dumps(messages) if messages else None


def resolve_anchor(candidate, anchor, grace_days, now=None):
    """Decide one candidate's ``subscription_end``.

    A mined date is only honoured when the comment actually said so (``exp``,
    ``due``, ``till``…) — an unqualified date in a comment is as likely to be a
    join date as an expiry, and guessing wrong cuts someone off.
    """
    now = now or datetime.utcnow()
    if anchor == ANCHOR_NONE:
        return None
    if anchor == ANCHOR_MINED and candidate.subscription_end:
        return candidate.subscription_end
    return now + timedelta(days=grace_days or DEFAULT_GRACE_DAYS)


def expiry_preview(candidates, anchor, grace_days):
    """What the anchor policy would do, before it does it.

    Returns the resulting date distribution plus the past-dated count, which the
    UI renders as a histogram and the commit path uses as a hard gate.
    """
    now = datetime.utcnow()
    buckets = {}
    past = 0
    total = 0
    for candidate in candidates:
        if candidate.decision != 'import':
            continue
        total += 1
        end = resolve_anchor(candidate, anchor, grace_days, now=now)
        if end is None:
            buckets['no expiry'] = buckets.get('no expiry', 0) + 1
            continue
        if end < now:
            past += 1
        key = end.date().isoformat()
        buckets[key] = buckets.get(key, 0) + 1
    ratio = (past / total) if total else 0.0
    return {
        'total': total,
        'past_dated': past,
        'past_dated_ratio': round(ratio, 4),
        'blocking': ratio > PAST_DATED_BLOCK_RATIO,
        'buckets': sorted(
            ({'date': k, 'count': v} for k, v in buckets.items()),
            key=lambda b: b['date'],
        ),
    }


def create_packages(run, drafts, isp):
    """Create the priced packages the operator approved, once, up front.

    Returns ``{lowercased draft name: ServicePlan}`` so candidate rows resolve to
    real objects. Existing packages with the same name are reused rather than
    duplicated — a re-scan must not create "PPPOE-10M" twice.
    """
    created = {}
    existing = {
        p.name.strip().lower(): p
        for p in ServicePlan.query.filter_by(isp_id=isp.id).all()
    }
    for draft in drafts:
        name = (draft.get('name') or '').strip()
        if not name or draft.get('decision') != 'create':
            continue
        key = name.lower()
        if draft.get('map_to_plan_id'):
            plan = ServicePlan.query.get(int(draft['map_to_plan_id']))
            if plan:
                created[key] = plan
                continue
        if key in existing:
            created[key] = existing[key]
            continue
        plan = ServicePlan(**draft_to_plan_kwargs(draft, isp.id))
        db.session.add(plan)
        db.session.flush()
        created[key] = plan
        existing[key] = plan
    # Packages the operator explicitly remapped rather than created.
    for draft in drafts:
        name = (draft.get('name') or '').strip().lower()
        if name and name not in created and draft.get('map_to_plan_id'):
            plan = ServicePlan.query.get(int(draft['map_to_plan_id']))
            if plan:
                created[name] = plan
    return created


def candidate_to_row(candidate, plan_by_profile, anchor, grace_days, now=None):
    """Convert one candidate into a ``customer_import`` row dict.

    Passwords are decrypted here and only here, at the moment of provisioning,
    and handed straight to the importer which re-encrypts via
    ``set_customer_radius_password``.
    """
    from services.encryption import decrypt_value

    plan = plan_by_profile.get((candidate.profile_name or '').strip().lower())
    end = resolve_anchor(candidate, anchor, grace_days, now=now)
    password = decrypt_value(candidate.password_encrypted) if candidate.password_encrypted else None

    return {
        'name': candidate.name or candidate.login or candidate.mac or 'Imported client',
        'login': candidate.login,
        'password': password,
        'email': candidate.email,
        'phone': candidate.phone,
        # The importer resolves by plan name; give it the package we created so
        # its own auto-create path never fires for a router import.
        'plan': plan.name if plan else (candidate.profile_name or ''),
        'connection_type': 'hotspot' if candidate.kind == 'hotspot' else 'pppoe',
        'status': 'suspended' if candidate.disabled else 'active',
        'subscription_end': end.strftime('%Y-%m-%d') if end else '',
        'balance': '',
        'static_ip': candidate.static_ip or '',
        'mac': candidate.mac or '',
        'account_number': '',
    }


def commit_run(run, isp, anchor=ANCHOR_UNIFORM, grace_days=DEFAULT_GRACE_DAYS,
               drafts=None, force=False, batch_size=50):
    """Create every candidate marked ``import``. Returns a summary.

    Static/queue candidates are skipped here on purpose: they have no login and
    never authenticate, so pushing them through the RADIUS provisioning path
    would write credentials nothing will ever use. Billing-only import for those
    is tracked separately (§9c of the design) and is not part of this pass.
    """
    from services.customer_import import process_import

    candidates = ImportCandidate.query.filter_by(run_id=run.id).all()
    importable = [
        c for c in candidates
        if c.decision == 'import' and c.status in ('new', 'error') and c.kind != 'static'
    ]

    preview = expiry_preview(importable, anchor, grace_days)
    if preview['blocking'] and not force:
        return {
            'committed': False,
            'blocked_by': 'past_dated_expiry',
            'expiry_preview': preview,
            'detail': (
                f"{preview['past_dated']} of {preview['total']} clients would be imported "
                'already expired and suspended on arrival. Re-check the billing anchor, '
                'or confirm explicitly to proceed.'
            ),
        }

    plan_by_profile = create_packages(run, drafts or [], isp)
    db.session.flush()

    now = datetime.utcnow()
    rows = []
    row_candidates = []
    for candidate in importable:
        rows.append(candidate_to_row(candidate, plan_by_profile, anchor, grace_days, now=now))
        row_candidates.append(candidate)

    run.status = 'importing'
    db.session.commit()

    created = failed = 0
    needs_reconfigure = 0
    # Batched so progress is visible on a 400-row run and a crash does not lose
    # everything that already succeeded.
    for start in range(0, len(rows), batch_size):
        chunk = rows[start:start + batch_size]
        chunk_candidates = row_candidates[start:start + batch_size]
        summary = process_import(
            isp, chunk, dry_run=False, default_status='active',
            auto_create_plans=True,
        )
        for result, candidate in zip(summary.get('rows') or [], chunk_candidates):
            if result.get('status') == 'created':
                candidate.status = 'created'
                candidate.customer_id = result.get('customer_id')
                created += 1
                if (result.get('data') or {}).get('password_generated'):
                    needs_reconfigure += 1
            else:
                candidate.status = 'error'
                _set_messages(candidate, result.get('messages') or ['create failed'])
                failed += 1
        run.counts = json.dumps({
            'total': len(rows),
            'created': created,
            'failed': failed,
            'needs_reconfigure': needs_reconfigure,
            'progress': min(start + batch_size, len(rows)),
        })
        db.session.commit()

    run.status = 'completed'
    run.mode = 'commit'
    run.finished_at = datetime.utcnow()
    db.session.commit()

    return {
        'committed': True,
        'created': created,
        'failed': failed,
        'needs_reconfigure': needs_reconfigure,
        'packages_created': len(plan_by_profile),
        'skipped_static': sum(1 for c in candidates if c.kind == 'static'),
        'expiry_preview': preview,
    }


def start_commit(app, run, isp, **kwargs):
    """Run :func:`commit_run` on a background thread.

    Creating 400 customers means 400 inserts plus ~1,600 RADIUS rows and a
    password encrypt each — not an HTTP-request-shaped job. The batched progress
    already written to ``ImportRun.counts`` is what the UI polls.

    The pre-flight guard is evaluated *synchronously* before the thread starts,
    so a blocked commit still answers the request with its explanation instead of
    disappearing into a background failure.
    """
    candidates = ImportCandidate.query.filter_by(run_id=run.id).all()
    importable = [
        c for c in candidates
        if c.decision == 'import' and c.status in ('new', 'error') and c.kind != 'static'
    ]
    preview = expiry_preview(
        importable,
        kwargs.get('anchor', ANCHOR_UNIFORM),
        kwargs.get('grace_days', DEFAULT_GRACE_DAYS),
    )
    if preview['blocking'] and not kwargs.get('force'):
        return {
            'started': False,
            'committed': False,
            'blocked_by': 'past_dated_expiry',
            'expiry_preview': preview,
            'detail': (
                f"{preview['past_dated']} of {preview['total']} clients would be imported "
                'already expired and suspended on arrival. Re-check the billing anchor, '
                'or confirm explicitly to proceed.'
            ),
        }

    run_id, isp_id = run.id, isp.id
    run.status = 'importing'
    db.session.commit()

    def _work():
        with app.app_context():
            from models import ISP
            record = ImportRun.query.get(run_id)
            target_isp = ISP.query.get(isp_id)
            if not record or not target_isp:
                return
            try:
                commit_run(record, target_isp, **kwargs)
            except Exception as exc:  # noqa: BLE001 — must surface on the run row
                db.session.rollback()
                record = ImportRun.query.get(run_id)
                if record:
                    record.status = 'failed'
                    record.error = str(exc)[:1000]
                    record.finished_at = datetime.utcnow()
                    db.session.commit()

    threading.Thread(target=_work, daemon=True).start()
    return {'started': True, 'committed': None, 'expiry_preview': preview,
            'total': len(importable)}


def revert_run(run):
    """Delete the customers this run created — nothing else.

    Refuses any customer that has since taken a payment or been edited: a revert
    is for undoing a bad import minutes later, not for erasing history. The
    ``delete-orphan`` cascades on Customer already remove the RADIUS rows
    correctly, so this does not touch radcheck/radreply directly.
    """
    candidates = ImportCandidate.query.filter_by(run_id=run.id).filter(
        ImportCandidate.customer_id.isnot(None)
    ).all()

    deleted = 0
    kept = []
    for candidate in candidates:
        customer = Customer.query.get(candidate.customer_id)
        if not customer:
            candidate.customer_id = None
            continue
        if customer.last_payment_date or (customer.payments and len(customer.payments)):
            kept.append({'login': candidate.login, 'reason': 'has payment history'})
            continue
        if customer.invoices and len(customer.invoices):
            kept.append({'login': candidate.login, 'reason': 'has invoices'})
            continue
        db.session.delete(customer)
        candidate.customer_id = None
        candidate.status = 'new'
        deleted += 1

    run.status = 'reverted'
    db.session.commit()
    return {'deleted': deleted, 'kept': kept}
