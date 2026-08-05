"""Self-serve ISP signup — the five wizard steps plus the provisioning poll.

Every endpoint here is public, so the guiding rule is that the *server* owns the
wizard's position. The client is handed an opaque token at ``/start`` and echoes
it back; each step re-reads the row and re-checks what has actually been proven
before it acts. A request that claims to be at step 5 without a
``whatsapp_verified_at`` is refused, which is what stops the OTP from being
decorative.

See ONBOARDING.md for the flow diagram and the provider environment variables.
"""
from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request

from extensions import db
from models import OnboardingSignup, User
from services import tenant_slug, whatsapp_otp
from services.brand_constants import BRAND_NAME
from services.email_validation import InvalidEmail, validate_signup_email
from services.password_policy import MIN_PASSWORD_LENGTH, WeakPassword, validate_password
from services.phone_utils import (
    DEFAULT_COUNTRY,
    InvalidPhone,
    country_choices,
    country_defaults,
    is_known_country,
    mask_phone,
    normalize_phone,
)
from services.rate_limit import client_ip, is_rate_limited, rate_limit
from services.system_log import record_system_log
from services.tenant_provisioning import initial_tasks, load_tasks, start_provisioning

onboarding_bp = Blueprint('onboarding', __name__, url_prefix='/api/onboarding')

SIGNUP_TTL_HOURS = 24

REFERRAL_SOURCES = [
    'Search engine', 'Social media', 'Friend or colleague', 'Existing customer',
    'Industry event', 'Reseller or partner', 'Advertisement', 'Other',
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _error(message, status=400, **extra):
    return jsonify({'success': False, 'error': message, **extra}), status


def _signup_from_token(token, *, allow_completed=False):
    """Resolve a signup token. Returns ``(signup, error_response)``."""
    token = (token or '').strip()
    if not token:
        return None, _error('Your signup session is missing. Start again.', 400)

    signup = OnboardingSignup.query.filter_by(token=token).first()
    if not signup:
        return None, _error('Your signup session was not found. Start again.', 404)

    if signup.status in ('completed', 'provisioning') and not allow_completed:
        return None, _error('This signup has already been submitted.', 409)

    if signup.expires_at and datetime.now() > signup.expires_at and not allow_completed:
        return None, _error('Your signup session expired. Start again.', 410)

    return signup, None


def _require_verified(signup):
    if not signup.whatsapp_verified_at:
        return _error('Verify your WhatsApp number first.', 403)
    return None


def _otp_state(signup):
    """Timer fields the verification screen renders."""
    return {
        'expires_in': whatsapp_otp.seconds_until(signup.otp_expires_at),
        'resend_in': whatsapp_otp.resend_cooldown_remaining(signup.otp_last_sent_at),
        'attempts_left': max(0, whatsapp_otp.MAX_VERIFY_ATTEMPTS - (signup.otp_attempts or 0)),
        'sends_left': max(0, whatsapp_otp.MAX_SENDS - (signup.otp_sent_count or 0)),
    }


def _issue_otp(signup):
    """Generate, store and deliver a fresh code. Returns the plain code."""
    code = whatsapp_otp.generate_code()
    now = datetime.now()

    signup.otp_hash = whatsapp_otp.hash_code(code)
    signup.otp_expires_at = whatsapp_otp.expiry_from(now)
    signup.otp_attempts = 0
    signup.otp_sent_count = (signup.otp_sent_count or 0) + 1
    signup.otp_last_sent_at = now

    whatsapp_otp.send_otp(signup.whatsapp_e164, code, BRAND_NAME)
    return code


def _echo_code(code):
    """Dev-only affordance: surface the code when there is no real provider.

    Gated on a stub provider *and* development mode — see
    ``whatsapp_otp.can_echo_code``.
    """
    return {'dev_code': code} if whatsapp_otp.can_echo_code() else {}


def _email_in_use(email):
    return User.query.filter_by(email=email).first() is not None


def _serialize(signup):
    """The wizard's view of its own state, used to resume after a refresh."""
    return {
        'token': signup.token,
        'step': signup.step,
        'status': signup.status,
        'full_name': signup.full_name,
        'email': signup.email,
        'whatsapp': signup.whatsapp_e164,
        'whatsapp_masked': mask_phone(signup.whatsapp_e164),
        'whatsapp_verified': bool(signup.whatsapp_verified_at),
        'isp_name': signup.isp_name,
        'slug': signup.slug,
        'account_address': tenant_slug.account_address(signup.slug) if signup.slug else None,
        'country': signup.country,
        'timezone': signup.timezone,
        'currency': signup.currency,
        'referral_source': signup.referral_source,
    }


# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

@onboarding_bp.route('/countries', methods=['GET'])
def countries():
    """Country / dial-code / timezone / currency table for the selects."""
    return jsonify({
        'success': True,
        'countries': country_choices(),
        'default_country': DEFAULT_COUNTRY,
        'referral_sources': REFERRAL_SOURCES,
        'base_domain': tenant_slug.base_domain(),
        'min_password_length': MIN_PASSWORD_LENGTH,
    }), 200


@onboarding_bp.route('/locale', methods=['GET'])
@rate_limit(limit=30, window=60, scope='onboarding-locale')
def locale():
    """Geo-default for step 4 ("Detected from your location").

    Reads the CDN's country header when there is one. No IP-geolocation call:
    an outbound lookup in the request path is a latency and privacy cost for a
    field the user can change in one click.
    """
    detected = (
        request.headers.get('CF-IPCountry')
        or request.headers.get('X-Country-Code')
        or request.headers.get('X-AppEngine-Country')
        or ''
    ).upper()

    country = detected if is_known_country(detected) else DEFAULT_COUNTRY
    timezone, currency = country_defaults(country)
    return jsonify({
        'success': True,
        'country': country,
        'timezone': timezone,
        'currency': currency,
        'detected': bool(detected and is_known_country(detected)),
    }), 200


# ---------------------------------------------------------------------------
# Step 1 — identity + send code
# ---------------------------------------------------------------------------

@onboarding_bp.route('/start', methods=['POST'])
@rate_limit(limit=5, window=60, scope='onboarding-start')
def start():
    data = request.get_json() or {}

    full_name = (data.get('full_name') or '').strip()
    if len(full_name) < 2:
        return _error('Enter your full name')
    if len(full_name) > 120:
        return _error('That name is too long')

    try:
        email = validate_signup_email(data.get('email'))
    except InvalidEmail as exc:
        return _error(str(exc))

    country = (data.get('country') or DEFAULT_COUNTRY).upper()
    if not is_known_country(country):
        return _error('Select a valid country code')

    try:
        phone = normalize_phone(data.get('whatsapp'), country)
    except InvalidPhone as exc:
        return _error(str(exc))

    # Consistent with the marketing-site trial signup: tell people plainly that
    # the address is taken rather than silently doing nothing. This does allow
    # email enumeration; it is a deliberate trade for a usable flow, and the
    # sign-in page leaks the same fact anyway.
    if _email_in_use(email):
        return _error('That email is already registered. Sign in instead.', 409,
                      email_in_use=True)

    # Per-number cap on top of the per-IP decorator: one phone should not be
    # able to soak up codes from a rotating IP pool.
    if is_rate_limited(f'onboarding-phone|{phone}', limit=3, window=3600):
        return _error('Too many verification codes for this number. Try again later.', 429)

    signup = OnboardingSignup(
        token=secrets.token_urlsafe(32),
        full_name=full_name,
        email=email,
        whatsapp_e164=phone,
        country=country,
        step=1,
        status='pending',
        tasks=None,
        expires_at=datetime.now() + timedelta(hours=SIGNUP_TTL_HOURS),
        ip_address=client_ip()[:45],
        user_agent=(request.headers.get('User-Agent') or '')[:255],
    )
    db.session.add(signup)

    try:
        code = _issue_otp(signup)
    except whatsapp_otp.WhatsAppError as exc:
        db.session.rollback()
        return _error(str(exc), 502)

    signup.step = 2
    db.session.commit()

    return jsonify({
        'success': True,
        'token': signup.token,
        'whatsapp': phone,
        'whatsapp_masked': mask_phone(phone),
        **_otp_state(signup),
        **_echo_code(code),
    }), 201


# ---------------------------------------------------------------------------
# Step 2 — resend / verify
# ---------------------------------------------------------------------------

@onboarding_bp.route('/resend', methods=['POST'])
@rate_limit(limit=10, window=300, scope='onboarding-resend')
def resend():
    data = request.get_json() or {}
    signup, err = _signup_from_token(data.get('token'))
    if err:
        return err

    if signup.whatsapp_verified_at:
        return _error('This number is already verified.', 409)

    remaining = whatsapp_otp.resend_cooldown_remaining(signup.otp_last_sent_at)
    if remaining > 0:
        return _error(f'Please wait {remaining}s before requesting another code.',
                      429, resend_in=remaining)

    if (signup.otp_sent_count or 0) >= whatsapp_otp.MAX_SENDS:
        return _error('Too many codes requested. Start again in a few minutes.', 429)

    try:
        code = _issue_otp(signup)
    except whatsapp_otp.WhatsAppError as exc:
        db.session.rollback()
        return _error(str(exc), 502)

    db.session.commit()
    return jsonify({'success': True, **_otp_state(signup), **_echo_code(code)}), 200


@onboarding_bp.route('/change-number', methods=['POST'])
@rate_limit(limit=5, window=300, scope='onboarding-change-number')
def change_number():
    """"Use a different number" — re-target the same signup and re-send."""
    data = request.get_json() or {}
    signup, err = _signup_from_token(data.get('token'))
    if err:
        return err

    if signup.whatsapp_verified_at:
        return _error('This number is already verified.', 409)

    country = (data.get('country') or signup.country or DEFAULT_COUNTRY).upper()
    if not is_known_country(country):
        return _error('Select a valid country code')

    try:
        phone = normalize_phone(data.get('whatsapp'), country)
    except InvalidPhone as exc:
        return _error(str(exc))

    if is_rate_limited(f'onboarding-phone|{phone}', limit=3, window=3600):
        return _error('Too many verification codes for this number. Try again later.', 429)

    signup.whatsapp_e164 = phone
    signup.country = country
    # A new number is a new challenge: the old send budget must not carry over,
    # or the cap becomes per-number instead of per-signup.
    signup.otp_sent_count = 0
    signup.otp_last_sent_at = None

    try:
        code = _issue_otp(signup)
    except whatsapp_otp.WhatsAppError as exc:
        db.session.rollback()
        return _error(str(exc), 502)

    db.session.commit()
    return jsonify({
        'success': True,
        'whatsapp': phone,
        'whatsapp_masked': mask_phone(phone),
        **_otp_state(signup),
        **_echo_code(code),
    }), 200


@onboarding_bp.route('/verify', methods=['POST'])
@rate_limit(limit=10, window=300, scope='onboarding-verify')
def verify():
    data = request.get_json() or {}
    signup, err = _signup_from_token(data.get('token'))
    if err:
        return err

    if signup.whatsapp_verified_at:
        return jsonify({'success': True, 'already_verified': True, 'step': signup.step}), 200

    code = (data.get('code') or '').strip()
    if not code:
        return _error('Enter the 6-digit code')

    if whatsapp_otp.is_expired(signup.otp_expires_at):
        return _error('That code has expired. Request a new one.', 410, expired=True)

    if (signup.otp_attempts or 0) >= whatsapp_otp.MAX_VERIFY_ATTEMPTS:
        return _error('Too many incorrect attempts. Request a new code.', 429,
                      locked=True)

    if not whatsapp_otp.verify_code_hash(signup.otp_hash, code):
        signup.otp_attempts = (signup.otp_attempts or 0) + 1
        db.session.commit()
        left = max(0, whatsapp_otp.MAX_VERIFY_ATTEMPTS - signup.otp_attempts)
        message = ('Incorrect code. Request a new one.' if left == 0
                   else f'Incorrect code. {left} attempt{"s" if left != 1 else ""} left.')
        return _error(message, 400, attempts_left=left, locked=left == 0)

    signup.whatsapp_verified_at = datetime.now()
    # The code is spent — clear it so a replay cannot reuse the same hash.
    signup.otp_hash = None
    signup.otp_expires_at = None
    signup.step = max(signup.step or 1, 3)
    db.session.commit()

    return jsonify({'success': True, 'step': signup.step}), 200


# ---------------------------------------------------------------------------
# Step 3 — account address
# ---------------------------------------------------------------------------

@onboarding_bp.route('/slug-check', methods=['GET'])
@rate_limit(limit=60, window=60, scope='onboarding-slug-check')
def slug_check():
    """Live availability for the step-3 field. Called on every keystroke."""
    raw = request.args.get('slug') or request.args.get('name') or ''
    candidate = tenant_slug.slugify_isp_name(raw) if request.args.get('name') else raw.strip().lower()

    if not candidate:
        return jsonify({'success': True, 'slug': '', 'available': False,
                        'message': ''}), 200

    available, normalised, message = tenant_slug.check_slug(candidate)
    payload = {
        'success': True,
        'slug': normalised or candidate,
        'available': available,
        'message': message,
        'account_address': tenant_slug.account_address(normalised or candidate),
    }
    if not available and normalised:
        payload['suggestion'] = tenant_slug.suggest_slug(normalised)
    return jsonify(payload), 200


@onboarding_bp.route('/account', methods=['POST'])
@rate_limit(limit=20, window=60, scope='onboarding-account')
def account():
    data = request.get_json() or {}
    signup, err = _signup_from_token(data.get('token'))
    if err:
        return err
    if (err := _require_verified(signup)):
        return err

    isp_name = (data.get('isp_name') or '').strip()
    if len(isp_name) < 2:
        return _error('Enter your ISP or company name')
    if len(isp_name) > 100:
        return _error('That name is too long')

    # The client sends the slug it displayed; re-derive rather than trust it.
    candidate = (data.get('slug') or '').strip().lower() or tenant_slug.slugify_isp_name(isp_name)
    available, normalised, message = tenant_slug.check_slug(candidate)
    if not available:
        return _error(message, 409,
                      suggestion=tenant_slug.suggest_slug(normalised or isp_name))

    signup.isp_name = isp_name
    signup.slug = normalised
    signup.step = max(signup.step or 1, 4)
    db.session.commit()

    return jsonify({
        'success': True,
        'step': signup.step,
        'slug': normalised,
        'account_address': tenant_slug.account_address(normalised),
    }), 200


# ---------------------------------------------------------------------------
# Step 4 — operating locale
# ---------------------------------------------------------------------------

@onboarding_bp.route('/profile', methods=['POST'])
@rate_limit(limit=20, window=60, scope='onboarding-profile')
def profile():
    data = request.get_json() or {}
    signup, err = _signup_from_token(data.get('token'))
    if err:
        return err
    if (err := _require_verified(signup)):
        return err
    if not signup.slug:
        return _error('Choose your account address first.', 400)

    country = (data.get('country') or '').upper()
    if not is_known_country(country):
        return _error('Select the country you operate in')

    default_tz, default_currency = country_defaults(country)
    timezone = (data.get('timezone') or '').strip() or default_tz
    currency = (data.get('currency') or '').strip().upper() or default_currency

    if not (3 <= len(currency) <= 10):
        return _error('Select a billing currency')

    referral = (data.get('referral_source') or '').strip()
    if not referral:
        return _error('Tell us how you heard about us')

    signup.country = country
    signup.timezone = timezone[:64]
    signup.currency = currency
    signup.referral_source = referral[:60]
    signup.step = max(signup.step or 1, 5)
    db.session.commit()

    return jsonify({'success': True, 'step': signup.step,
                    'timezone': signup.timezone, 'currency': signup.currency}), 200


# ---------------------------------------------------------------------------
# Step 5 — password, then provision
# ---------------------------------------------------------------------------

@onboarding_bp.route('/complete', methods=['POST'])
@rate_limit(limit=10, window=60, scope='onboarding-complete')
def complete():
    data = request.get_json() or {}
    signup, err = _signup_from_token(data.get('token'))
    if err:
        return err
    if (err := _require_verified(signup)):
        return err

    # Everything the provisioning job needs must already be on the row. This is
    # the check that makes the earlier steps non-optional.
    missing = [
        label for label, value in (
            ('account address', signup.slug),
            ('ISP name', signup.isp_name),
            ('country', signup.country),
            ('currency', signup.currency),
        ) if not value
    ]
    if missing:
        return _error(f'Missing {missing[0]} — go back and complete that step.', 400)

    try:
        password = validate_password(
            data.get('password'), data.get('confirm_password') or data.get('password'),
        )
    except WeakPassword as exc:
        return _error(str(exc))
    if not data.get('accept_terms'):
        return _error('Accept the terms of service and privacy policy to continue')

    # Re-check late: someone may have registered this address while the wizard
    # was open.
    if _email_in_use(signup.email):
        return _error('That email is already registered. Sign in instead.', 409,
                      email_in_use=True)

    signup.status = 'provisioning'
    signup.provisioning_started_at = datetime.now()
    # Seed the task list before the worker starts, so the first poll always has
    # rows to render even if the thread has not been scheduled yet.
    signup.tasks = json.dumps(initial_tasks())
    db.session.commit()

    record_system_log('onboarding', f'Provisioning tenant {signup.slug} for {signup.email}',
                      'INFO', commit=True)

    start_provisioning(current_app._get_current_object(), signup, password)

    return jsonify({
        'success': True,
        'status': signup.status,
        'slug': signup.slug,
        'account_address': tenant_slug.account_address(signup.slug),
        'tasks': load_tasks(signup),
    }), 202


# ---------------------------------------------------------------------------
# Provisioning poll + resume
# ---------------------------------------------------------------------------

@onboarding_bp.route('/status', methods=['GET'])
@rate_limit(limit=120, window=60, scope='onboarding-status')
def status():
    signup, err = _signup_from_token(request.args.get('token'), allow_completed=True)
    if err:
        return err

    elapsed = None
    if signup.provisioning_started_at:
        end = signup.completed_at or datetime.now()
        elapsed = max(0, int((end - signup.provisioning_started_at).total_seconds()))

    return jsonify({
        'success': True,
        'status': signup.status,
        'step': signup.step,
        'slug': signup.slug,
        'account_address': tenant_slug.account_address(signup.slug) if signup.slug else None,
        'tasks': load_tasks(signup),
        'error': signup.error,
        'elapsed_seconds': elapsed,
    }), 200


@onboarding_bp.route('/session', methods=['GET'])
@rate_limit(limit=60, window=60, scope='onboarding-session')
def session():
    """Rehydrate the wizard after a page refresh."""
    signup, err = _signup_from_token(request.args.get('token'), allow_completed=True)
    if err:
        return err
    return jsonify({'success': True, **_serialize(signup), **_otp_state(signup)}), 200
