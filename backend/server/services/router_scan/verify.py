"""Pre-cutover verification — ROUTER_SCAN_IMPORT_AND_TAKEOVER.md §15.

One question, per client, before anything is switched: **would this subscriber
authenticate against us right now?** Asked by sending a real Access-Request to
our own FreeRADIUS with the credentials that were actually written, and reading
the reply. Not by querying ``radcheck`` and reasoning about it — the failures
worth catching all live between the tables, where no ``SELECT`` can see them.

Each subscriber is checked the way that subscriber really dials: PPPoE with
MS-CHAPv2, hotspot with PAP. That distinction is the point. A broken mschap
module or a stray ``Auth-Type := Accept`` rejects (or hollowly accepts) every
PPPoE dial while PAP logins keep working — verifying everyone with PAP would
report a clean bill of health during exactly that outage.

**What this proves and what it does not.** The probe reaches FreeRADIUS from the
app container, so it matches the ``docker_bridge`` entry in ``clients.conf``, not
the router's own entry. It therefore exercises the subscriber half of the chain
completely — ``radcheck``, ``radusergroup``, the ``plan_<id>`` group,
``radreply``, mschap, the reply attributes — and says nothing about whether the
*router's* NAS entry and shared secret are right. That half is what the adoption
step and the first canary client prove.
"""
import os
import time
from datetime import datetime

from flask import current_app

from extensions import db
from models import Customer, ImportCandidate, RadCheck

from .radius_probe import (
    ACCESS_ACCEPT,
    ACCESS_REJECT,
    RadiusError,
    RadiusProbe,
    has_mppe_keys,
    has_mschap2_success,
    reply_message,
    reply_rate_limit,
)

# A whole run can be far more work than one request should hold open, so
# verification is resumable: each call works until this deadline, persists what
# it finished, and the caller asks again for the remainder.
DEFAULT_DEADLINE_SECONDS = 25

PASS = 'pass'
WARN = 'warn'
FAIL = 'fail'


def resolve_probe(isp=None, device=None, timeout=3.0, retries=2):
    """Where the app talks to FreeRADIUS — deliberately not the router's path.

    A router reaches RADIUS at the tunnel address, which the wireguard container
    DNATs; from inside the app container that address is not the RADIUS server at
    all. The app's own route is the compose service name, and the secret that
    goes with it is the ``docker_bridge`` client's — i.e. ``RADIUS_SECRET``.
    """
    config = current_app.config if current_app else {}
    host = (
        os.getenv('RADIUS_VERIFY_HOST')
        or config.get('RADIUS_VERIFY_HOST')
        or os.getenv('FREERADIUS_HOST')
        or config.get('FREERADIUS_HOST')
        or 'freeradius'
    )
    secret = (
        os.getenv('RADIUS_VERIFY_SECRET')
        or config.get('RADIUS_VERIFY_SECRET')
        or os.getenv('RADIUS_SECRET')
        or config.get('RADIUS_SECRET')
        or 'radius_secret_key'
    )
    port = int(os.getenv('RADIUS_AUTH_PORT') or config.get('RADIUS_AUTH_PORT') or 1812)
    nas_ip = None
    if device is not None:
        nas_ip = (device.management_wg_ip or device.device_ip or '').split('/')[0] or None
    return RadiusProbe(host, secret, port=port, timeout=timeout, retries=retries, nas_ip=nas_ip)


def expected_rate_limit(customer):
    """The Mikrotik-Rate-Limit this customer's plan should hand back."""
    from services.plan_utils import generate_radius_attributes

    plan = getattr(customer, 'service_plan', None)
    if plan is None:
        return None
    for attribute in generate_radius_attributes(plan):
        if attribute.get('attribute') == 'Mikrotik-Rate-Limit':
            return (attribute.get('value') or '').strip()
    return None


def stored_password(username, isp_id):
    """The cleartext FreeRADIUS itself will compare against."""
    row = (
        RadCheck.query
        .filter_by(username=username, attribute='Cleartext-Password', isp_id=isp_id)
        .first()
    )
    return row.value if row else None


def _classify(kind, reply, want_rate):
    """Turn one reply into (state, detail)."""
    got_rate = reply_rate_limit(reply)

    if reply['code'] == ACCESS_REJECT:
        message = reply_message(reply)
        return FAIL, f'Access-Reject{f" — {message}" if message else ""}'

    if reply['code'] != ACCESS_ACCEPT:
        return FAIL, f'unexpected RADIUS code {reply["code"]}'

    if kind == 'pppoe':
        # An Accept that carries no MS-CHAP2-Success is the signature of an
        # `Auth-Type := Accept` row: the server says yes, but the CPE cannot
        # validate the answer and reports "login failed" to the subscriber.
        if not has_mschap2_success(reply):
            return FAIL, (
                'accepted without MS-CHAP2-Success — the CPE cannot validate this '
                'reply and will report a login failure. Usually an Auth-Type := Accept '
                'row short-circuiting mschap.'
            )
        if not has_mppe_keys(reply):
            return WARN, 'accepted with MS-CHAP2-Success but no MPPE keys'

    if want_rate and not got_rate:
        return WARN, (
            f'authenticates, but the reply carried no Mikrotik-Rate-Limit '
            f'(expected {want_rate}) — this client would connect unshaped'
        )
    if want_rate and got_rate and got_rate != want_rate:
        return WARN, f'authenticates, but rate limit is {got_rate}, expected {want_rate}'

    detail = f'authenticates, rate limit {got_rate}' if got_rate else 'authenticates'
    return PASS, detail


def verify_candidate(candidate, probe, now=None):
    """Check one candidate end to end and record the verdict on it."""
    now = now or datetime.utcnow()
    candidate.verified_at = now

    customer = Customer.query.get(candidate.customer_id) if candidate.customer_id else None
    if customer is None:
        candidate.verify_state = FAIL
        candidate.verify_detail = 'no customer on record — was this run committed?'
        return candidate.verify_state

    from services.radius_provisioning import radius_username

    username = radius_username(customer)
    if not username:
        candidate.verify_state = FAIL
        candidate.verify_detail = 'customer has no RADIUS login'
        return candidate.verify_state

    password = stored_password(username, customer.isp_id)
    if not password:
        candidate.verify_state = FAIL
        candidate.verify_detail = (
            f'no Cleartext-Password in radcheck for "{username}" — this client '
            'cannot authenticate at all'
        )
        return candidate.verify_state

    want_rate = expected_rate_limit(customer)
    try:
        if candidate.kind == 'hotspot':
            reply = probe.pap(username, password)
        else:
            reply = probe.mschapv2(username, password)
    except RadiusError as exc:
        candidate.verify_state = FAIL
        candidate.verify_detail = str(exc)
        return candidate.verify_state

    state, detail = _classify(candidate.kind, reply, want_rate)
    candidate.verify_state = state
    candidate.verify_detail = detail
    return state


def verifiable_candidates(run, only_pending=False, logins=None):
    """Candidates worth checking: committed, and able to authenticate at all.

    Static/queue clients are excluded for the same reason the commit skips them —
    they have no login and never present credentials to anything.
    """
    query = ImportCandidate.query.filter(
        ImportCandidate.run_id == run.id,
        ImportCandidate.status == 'created',
        ImportCandidate.kind != 'static',
    )
    if logins:
        wanted = {str(l).strip().lower() for l in logins if str(l or '').strip()}
        query = query.filter(db.func.lower(ImportCandidate.login).in_(wanted))
    elif only_pending:
        query = query.filter(ImportCandidate.verify_state.is_(None))
    return query.order_by(ImportCandidate.id).all()


def verify_run(run, isp=None, limit=None, only_pending=False, logins=None,
               deadline_seconds=DEFAULT_DEADLINE_SECONDS, probe=None):
    """Verify a run's clients, resumably. Returns a summary of the whole run.

    Stops at ``deadline_seconds`` and reports what is still pending rather than
    holding a request open across 400 UDP round trips — the caller loops.
    """
    probe = probe or resolve_probe(isp, device=run.device)
    pending = verifiable_candidates(run, only_pending=only_pending, logins=logins)
    if limit:
        pending = pending[:int(limit)]

    started = time.monotonic()
    checked = 0
    for candidate in pending:
        verify_candidate(candidate, probe)
        checked += 1
        if checked % 25 == 0:
            db.session.commit()
        if time.monotonic() - started > deadline_seconds:
            break
    db.session.commit()

    summary = verification_summary(run)
    summary['checked_now'] = checked
    return summary


def verification_summary(run):
    """Counts across the whole run, plus every failure spelled out."""
    candidates = verifiable_candidates(run)
    counts = {PASS: 0, WARN: 0, FAIL: 0, 'pending': 0}
    problems = []
    for candidate in candidates:
        state = candidate.verify_state
        if state in counts:
            counts[state] += 1
        else:
            counts['pending'] += 1
        if state in (WARN, FAIL):
            problems.append({
                'id': candidate.id,
                'login': candidate.login,
                'kind': candidate.kind,
                'profile': candidate.profile_name,
                'state': state,
                'detail': candidate.verify_detail,
            })
    total = len(candidates)
    return {
        'total': total,
        'passed': counts[PASS],
        'warned': counts[WARN],
        'failed': counts[FAIL],
        'pending': counts['pending'],
        'problems': problems,
        'headline': (
            f'{counts[PASS]} of {total} would authenticate'
            if total else 'No committed clients to verify'
        ),
    }
