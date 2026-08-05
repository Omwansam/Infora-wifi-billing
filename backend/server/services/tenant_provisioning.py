"""Turn a verified signup into a working tenant.

The four steps here are the four rows the provisioning screen renders, in order,
which is why they are declared as data (:data:`TASKS`) rather than buried in
control flow — the UI and the job read the same list.

It runs on a background thread and reports progress by writing the task list
back to ``OnboardingSignup.tasks``; the client polls ``GET /status``. That is
the same shape as the import commit job: the work outlives a single request, so
a dropped connection or a closed tab must not lose it.

Ordering is deliberate. The ISP row comes first because the admin user needs its
id; the welcome email comes after both because it quotes the account address.
Only the first two steps are fatal — a bounced welcome email leaves a perfectly
usable account, and failing the whole signup over it would be the worse outcome.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime

from werkzeug.security import generate_password_hash

from extensions import db
from models import ISP, OnboardingSignup, User
from services import tenant_slug
from services.brand_constants import BRAND_FULL_NAME, BRAND_NAME, BRAND_SUPPORT_EMAIL

logger = logging.getLogger(__name__)

# key, label — mirrored by the provisioning screen.
TASKS = [
    ('account_address', 'Creating your account address'),
    ('admin_user', 'Creating your admin account'),
    ('welcome_email', 'Sending your welcome email'),
    ('ready', 'Account ready'),
]


def initial_tasks():
    return [
        {'key': key, 'label': label, 'status': 'pending', 'detail': None}
        for key, label in TASKS
    ]


def load_tasks(signup):
    if not signup.tasks:
        return initial_tasks()
    try:
        return json.loads(signup.tasks)
    except (TypeError, ValueError):
        return initial_tasks()


def _set_task(signup, key, status, detail=None):
    """Update one task row and commit, so the next poll sees it immediately."""
    tasks = load_tasks(signup)
    for task in tasks:
        if task['key'] == key:
            task['status'] = status
            if detail is not None:
                task['detail'] = detail
            break
    signup.tasks = json.dumps(tasks)
    db.session.commit()


def _default_plan_limits(_signup):
    """Starting quotas for a new tenant.

    Matches what ``website_trial_signup`` has been handing out, so a self-serve
    account and a marketing-site trial are the same product.
    """
    return {'subscription_plan': 'basic', 'max_devices': 10, 'max_customers': 500}


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

def _create_isp(signup):
    """Step 1 — the ISP row, and with it the account address.

    The slug is *claimed* here rather than at step 3, because the step-3 check
    is only advisory: two people can pass it seconds apart with the same name.
    The unique index is the arbiter, so a lost race re-suggests instead of
    raising an IntegrityError at the user.
    """
    slug = signup.slug or tenant_slug.slugify_isp_name(signup.isp_name)
    if tenant_slug.is_slug_taken(slug):
        slug = tenant_slug.suggest_slug(slug)

    limits = _default_plan_limits(signup)
    isp = ISP(
        name=(signup.isp_name or slug)[:100],
        company_name=signup.isp_name or slug,
        email=signup.email,
        slug=slug,
        phone=signup.whatsapp_e164,
        support_phone=signup.whatsapp_e164,
        country=signup.country,
        timezone=signup.timezone,
        currency=signup.currency or 'KES',
        referral_source=signup.referral_source,
        onboarded_at=datetime.now(),
        is_active=True,
        # Prefix derived from the slug, not the display name: the slug is
        # immutable, so account numbers stay stable across a later rename.
        account_number_prefix=_account_prefix(slug),
        **limits,
    )
    isp.generate_api_key()
    isp.generate_radius_secret()
    db.session.add(isp)
    db.session.flush()

    signup.isp_id = isp.id
    signup.slug = slug
    return isp


def _account_prefix(slug):
    """'acme-net' -> 'ACM'. Mirrors radius_provisioning._derive_account_prefix."""
    import re

    letters = re.sub(r'[^A-Za-z]', '', slug or '').upper()
    return letters[:3] or 'ACC'


def _create_admin(signup, isp, password_hash):
    """Step 2 — the admin user, bound to the tenant.

    ``role='admin'`` and a non-null ``isp_id`` are the two things the old
    ``/api/auth/register`` path got wrong; every console route resolves data
    through them.
    """
    first_name, _, last_name = (signup.full_name or '').strip().partition(' ')
    user = User(
        email=signup.email,
        password_hash=password_hash,
        first_name=(first_name or signup.email.split('@')[0])[:50],
        last_name=(last_name.strip() or '-')[:50],
        role='admin',
        is_active=True,
        isp_id=isp.id,
        whatsapp_number=signup.whatsapp_e164,
        whatsapp_verified_at=signup.whatsapp_verified_at,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.session.add(user)
    db.session.flush()
    signup.user_id = user.id
    return user


def _send_welcome_email(signup, isp, user):
    """Step 3 — welcome email. Best-effort; never fatal."""
    from services.mailer import send_email

    address = tenant_slug.account_address(isp.slug)
    sign_in_url = _sign_in_url()
    name = user.first_name or 'there'

    text = (
        f'Hi {name},\n\n'
        f'Your {BRAND_FULL_NAME} account is ready.\n\n'
        f'  Account address : {address}\n'
        f'  Sign-in email   : {user.email}\n'
        f'  Sign in         : {sign_in_url}\n\n'
        'Next steps:\n'
        '  1. Sign in and add your first service package.\n'
        '  2. Connect a router so it can authenticate subscribers.\n'
        '  3. Import or add your customers.\n\n'
        f'Need a hand? Reply to this email or contact {BRAND_SUPPORT_EMAIL}.\n\n'
        f'— The {BRAND_NAME} team\n'
    )
    html = f"""\
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#111">
  <h2 style="margin:0 0 16px">Your {BRAND_FULL_NAME} account is ready</h2>
  <p>Hi {name},</p>
  <table style="border-collapse:collapse;margin:20px 0;font-size:14px">
    <tr><td style="padding:6px 16px 6px 0;color:#666">Account address</td>
        <td style="padding:6px 0"><strong>{address}</strong></td></tr>
    <tr><td style="padding:6px 16px 6px 0;color:#666">Sign-in email</td>
        <td style="padding:6px 0"><strong>{user.email}</strong></td></tr>
  </table>
  <p><a href="{sign_in_url}"
        style="background:#f97316;color:#fff;padding:12px 22px;border-radius:8px;
               text-decoration:none;display:inline-block">Sign in to your console</a></p>
  <ol style="color:#444;font-size:14px;line-height:1.7">
    <li>Sign in and add your first service package.</li>
    <li>Connect a router so it can authenticate subscribers.</li>
    <li>Import or add your customers.</li>
  </ol>
  <p style="color:#666;font-size:13px">
    Need a hand? Reply to this email or contact {BRAND_SUPPORT_EMAIL}.
  </p>
</div>"""

    return send_email(
        user.email,
        f'Your {BRAND_FULL_NAME} account is ready',
        text,
        html_body=html,
        sender_name=BRAND_NAME,
    )


def _sign_in_url():
    from services.portal_urls import portal_frontend_base_url

    base = portal_frontend_base_url() or ''
    return f'{base.rstrip("/")}/login' if base else '/login'


# ---------------------------------------------------------------------------
# Job
# ---------------------------------------------------------------------------

def provision_signup(signup_id, password_hash):
    """Run all four steps for one signup. Assumes an active app context."""
    signup = OnboardingSignup.query.get(signup_id)
    if not signup:
        logger.error('provision_signup: signup %s vanished', signup_id)
        return

    try:
        # --- 1. account address ---
        _set_task(signup, 'account_address', 'running', 'Creating your account address…')
        isp = _create_isp(signup)
        db.session.commit()
        address = tenant_slug.account_address(isp.slug)
        _set_task(signup, 'account_address', 'done',
                  f'Account address ready — {address}.')

        # --- 2. admin user ---
        _set_task(signup, 'admin_user', 'running', 'Creating your admin account…')
        user = _create_admin(signup, isp, password_hash)
        db.session.commit()
        _set_task(signup, 'admin_user', 'done', 'Admin user provisioned.')

        # --- 3. welcome email (non-fatal) ---
        _set_task(signup, 'welcome_email', 'running', 'Sending your welcome email…')
        try:
            sent = _send_welcome_email(signup, isp, user)
            _set_task(signup, 'welcome_email', 'done',
                      'Welcome email sent.' if sent
                      else 'Welcome email could not be sent — your account is still ready.')
        except Exception as exc:
            logger.warning('Welcome email failed for signup %s: %s', signup_id, exc)
            _set_task(signup, 'welcome_email', 'done',
                      'Welcome email could not be sent — your account is still ready.')

        # --- 4. finalise ---
        _set_task(signup, 'ready', 'running', 'Finishing up…')
        signup.status = 'completed'
        signup.completed_at = datetime.now()
        signup.step = 6
        db.session.commit()
        _set_task(signup, 'ready', 'done', 'Account ready — sign in to continue.')

        logger.info('Provisioned tenant %s (isp_id=%s) for %s',
                    isp.slug, isp.id, signup.email)

    except Exception as exc:
        db.session.rollback()
        logger.exception('Provisioning failed for signup %s', signup_id)
        try:
            signup = OnboardingSignup.query.get(signup_id)
            if signup:
                tasks = load_tasks(signup)
                for task in tasks:
                    if task['status'] == 'running':
                        task['status'] = 'failed'
                        task['detail'] = str(exc)[:200]
                signup.tasks = json.dumps(tasks)
                signup.status = 'failed'
                signup.error = str(exc)[:500]
                db.session.commit()
        except Exception:
            db.session.rollback()
            logger.exception('Could not record provisioning failure for %s', signup_id)


def start_provisioning(app, signup, password):
    """Kick the job onto a background thread and return immediately.

    The password is hashed *here*, on the request thread, and only the hash
    crosses into the worker — the plaintext never outlives this call.
    """
    import threading

    password_hash = generate_password_hash(password)
    signup_id = signup.id

    def _run():
        with app.app_context():
            provision_signup(signup_id, password_hash)

    thread = threading.Thread(
        target=_run, daemon=True, name=f'provision-signup-{signup_id}'
    )
    thread.start()
    return thread
