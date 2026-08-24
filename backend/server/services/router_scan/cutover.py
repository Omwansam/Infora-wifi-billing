"""Cutover progress and the post-cutover watch — §14–§15 of the design.

Two things the cutover page could not previously do, both for the same reason:
nothing recorded *state*. Generating a batch script wrote nothing back, so the
next batch was the same subscribers again, and the page could never say how far
through a migration you were.

``ImportCandidate.cutover_at`` fixes that, and it is deliberately set when the
script is **generated**, not when it is proven to have run. Anything else would
need the router to report back, and during a cutover the operator is watching a
terminal, not this page. Generating a batch is the operator saying "I am moving
these"; :func:`reset_moved` is there for the paste that never happened.
"""
from datetime import datetime

from extensions import db
from models import Customer, ImportCandidate, RadAcct

from .adoption_script import ADOPTION_COMMENT  # noqa: F401  (re-exported for callers)


def _entry(candidate):
    return {'login': candidate.login, 'kind': candidate.kind or 'pppoe'}


def movable_candidates(run):
    """Committed clients that authenticate — i.e. can be cut over at all."""
    return ImportCandidate.query.filter(
        ImportCandidate.run_id == run.id,
        ImportCandidate.status == 'created',
        ImportCandidate.kind != 'static',
        ImportCandidate.login.isnot(None),
    )


def select_batch(run, limit=None, profile=None, kind=None, logins=None,
                 include_moved=False):
    """The next batch to move.

    Ordered by id so "the next fifty" is stable across calls — an unordered
    ``LIMIT`` would hand back an arbitrary slice each time, which is not
    something anyone should paste into a live router.
    """
    query = movable_candidates(run)
    if logins:
        wanted = {str(l).strip().lower() for l in logins if str(l or '').strip()}
        query = query.filter(db.func.lower(ImportCandidate.login).in_(wanted))
    else:
        if not include_moved:
            query = query.filter(ImportCandidate.cutover_at.is_(None))
        if profile:
            query = query.filter(ImportCandidate.profile_name == profile)
        if kind:
            query = query.filter(ImportCandidate.kind == kind)
    query = query.order_by(ImportCandidate.id)
    if limit:
        query = query.limit(int(limit))
    return query.all()


def mark_moved(candidates, when=None):
    when = when or datetime.utcnow()
    for candidate in candidates:
        candidate.cutover_at = when
    db.session.commit()
    return len(candidates)


def reset_moved(run, logins=None):
    """Un-mark a batch — for the script that was generated but never pasted."""
    query = movable_candidates(run).filter(ImportCandidate.cutover_at.isnot(None))
    if logins:
        wanted = {str(l).strip().lower() for l in logins if str(l or '').strip()}
        query = query.filter(db.func.lower(ImportCandidate.login).in_(wanted))
    rows = query.all()
    for candidate in rows:
        candidate.cutover_at = None
    db.session.commit()
    return len(rows)


def profile_breakdown(run):
    """Per-package progress, because a cutover is usually run a package at a
    time — 'all the 5M customers, then all the 10M ones'."""
    rows = movable_candidates(run).all()
    buckets = {}
    for candidate in rows:
        key = candidate.profile_name or '(no profile)'
        bucket = buckets.setdefault(key, {'profile': key, 'total': 0, 'moved': 0, 'kinds': set()})
        bucket['total'] += 1
        bucket['kinds'].add(candidate.kind or 'pppoe')
        if candidate.cutover_at:
            bucket['moved'] += 1
    out = []
    for bucket in buckets.values():
        bucket['kinds'] = sorted(bucket['kinds'])
        bucket['remaining'] = bucket['total'] - bucket['moved']
        out.append(bucket)
    return sorted(out, key=lambda b: (-b['total'], b['profile']))


def cutover_state(run):
    """Everything the page needs to show where this migration stands."""
    from .verify import verification_summary

    rows = movable_candidates(run).all()
    moved = [c for c in rows if c.cutover_at]
    return {
        'run_id': run.id,
        'device_id': run.device_id,
        'device_name': run.device.device_name if run.device else None,
        'total': len(rows),
        'moved': len(moved),
        'remaining': len(rows) - len(moved),
        'kinds': {
            'pppoe': sum(1 for c in rows if (c.kind or 'pppoe') == 'pppoe'),
            'hotspot': sum(1 for c in rows if c.kind == 'hotspot'),
        },
        'profiles': profile_breakdown(run),
        'verification': verification_summary(run),
        'last_moved_at': max((c.cutover_at for c in moved), default=None),
    }


# --- Post-cutover watch --------------------------------------------------

def _router_active_counts(device):
    """Live session counts straight off the router.

    Uses the poller convention from device_config_ops: a short lock wait, and a
    ``busy`` answer rather than competing for the device's single SSH slot while
    the operator is mid-cutover.
    """
    from services.device_config_ops import DeviceBusy, mikrotik_ssh

    if device is None:
        return {'available': False, 'reason': 'This run is not linked to a router.'}
    try:
        with mikrotik_ssh(device, timeout=15, lock_wait=2) as client:
            ppp_out, _ = client.run_cli('/ppp active print count-only')
            hotspot_out, _ = client.run_cli('/ip hotspot active print count-only')
            secrets_out, _ = client.run_cli('/ppp secret print count-only where disabled=no')
    except DeviceBusy:
        return {'available': False, 'reason': 'The router is busy with another operation.'}
    except Exception as exc:  # noqa: BLE001 - surface the reason, never 500 a watch panel
        return {'available': False, 'reason': f'Could not reach the router: {exc}'}

    def as_int(text):
        digits = ''.join(ch for ch in (text or '') if ch.isdigit())
        return int(digits) if digits else None

    return {
        'available': True,
        'ppp_active': as_int(ppp_out),
        'hotspot_active': as_int(hotspot_out),
        'local_secrets_enabled': as_int(secrets_out),
    }


def watch(run, include_router=True):
    """Imported vs moved vs actually-online, on one payload.

    The question during the first hour is never "how many sessions exist" — it
    is **"which of the people I just moved have not come back?"**. Everything
    here is arranged to answer that one.
    """
    from services.radius_provisioning import radius_username
    from services.session_tracking import online_filter

    rows = movable_candidates(run).all()
    moved = [c for c in rows if c.cutover_at]

    customer_ids = [c.customer_id for c in moved if c.customer_id]
    customers = {}
    if customer_ids:
        for customer in Customer.query.filter(Customer.id.in_(customer_ids)).all():
            customers[customer.id] = customer

    logins_by_candidate = {}
    for candidate in moved:
        customer = customers.get(candidate.customer_id)
        login = radius_username(customer) if customer else (candidate.login or '').lower()
        logins_by_candidate[candidate.id] = login

    online_logins = set()
    wanted = {login for login in logins_by_candidate.values() if login}
    if wanted:
        online_rows = (
            RadAcct.query
            .filter(online_filter())
            .filter(db.func.lower(RadAcct.username).in_(wanted))
            .with_entities(RadAcct.username)
            .distinct()
            .all()
        )
        online_logins = {(row[0] or '').lower() for row in online_rows}

    missing = []
    for candidate in moved:
        login = logins_by_candidate.get(candidate.id)
        if login and login in online_logins:
            continue
        missing.append({
            'id': candidate.id,
            'login': candidate.login,
            'kind': candidate.kind,
            'profile': candidate.profile_name,
            'moved_at': candidate.cutover_at.isoformat() if candidate.cutover_at else None,
            'verify_state': candidate.verify_state,
            'verify_detail': candidate.verify_detail,
        })

    infora_online = len([c for c in moved if logins_by_candidate.get(c.id) in online_logins])
    router = _router_active_counts(run.device) if include_router else {'available': False,
                                                                      'reason': 'not requested'}

    return {
        'imported': len(rows),
        'moved': len(moved),
        'online_via_infora': infora_online,
        'not_back_yet': missing,
        'router': router,
        'checked_at': datetime.utcnow().isoformat(),
    }
