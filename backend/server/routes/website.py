"""Public marketing website API — no admin JWT required."""
from __future__ import annotations

import json
import re
from datetime import datetime
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from werkzeug.security import generate_password_hash
from auth_utils import create_user_tokens, get_current_user
from services.rate_limit import rate_limit
from extensions import db
from models import (
    Customer,
    ISP,
    MikrotikDevice,
    Payment,
    PaymentStatus,
    SystemSetting,
    User,
    WebsiteInquiry,
    WebsiteInquirySource,
    WebsiteInquiryStatus,
)
from services.brand_constants import (
    BRAND_FULL_NAME,
    BRAND_NAME,
    BRAND_PORTAL_ABOUT,
    BRAND_PORTAL_TAGLINE,
    BRAND_SUPPORT_EMAIL,
    BRAND_WEBSITE,
)

website_bp = Blueprint('website', __name__, url_prefix='/api/website')

DEFAULT_CHANGELOG = [
    {
        'version': 'v2.4.0',
        'date': 'Jun 2026',
        'tag': 'Latest',
        'title': 'Customer KYC & verification workflow',
        'items': [
            'Document upload and admin review for subscriber onboarding',
            'KYC status badges across customer list and detail views',
            'Automated service hold until verification is complete',
        ],
    },
    {
        'version': 'v2.3.0',
        'date': 'May 2026',
        'tag': 'Feature',
        'title': 'M-Pesa STK Push & payment reconciliation',
        'items': [
            'Real-time M-Pesa payment callbacks with instant activation',
            'Payment status tracking and failed transaction retry',
            'Unified payments ledger across hotspot and PPPoE',
        ],
    },
    {
        'version': 'v2.2.0',
        'date': 'Apr 2026',
        'tag': 'Feature',
        'title': 'Branded captive portal & PPPoE portal',
        'items': [
            'Customizable hotspot login with package selection',
            'PPPoE self-service portal for bill pay and account management',
            'Mobile-optimized portal shell with ISP branding',
        ],
    },
]


def _public_settings():
    rows = SystemSetting.query.filter_by(is_public=True).all()
    return {row.key: row.value for row in rows}


def _primary_isp():
    return ISP.query.filter_by(is_active=True).order_by(ISP.id.asc()).first()


def _format_count(value, suffix='+'):
    if value >= 1_000_000:
        text = f'{value / 1_000_000:.1f}M'
        return text.replace('.0M', 'M') + suffix
    if value >= 1_000:
        return f'{round(value / 1_000)}K{suffix}'
    return f'{value}{suffix}'


def _serialize_inquiry(row):
    return {
        'id': row.id,
        'name': row.name,
        'email': row.email,
        'company': row.company,
        'phone': row.phone,
        'inquiry_type': row.inquiry_type,
        'message': row.message,
        'source': row.source.value if row.source else None,
        'status': row.status.value if row.status else None,
        'created_at': row.created_at.isoformat() if row.created_at else None,
    }


def _validate_email(email):
    return bool(email and re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email))


def _create_inquiry(data, source):
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    message = (data.get('message') or '').strip()

    if not name or not email:
        return None, ('Name and email are required', 400)
    if not _validate_email(email):
        return None, ('Invalid email address', 400)
    if source != WebsiteInquirySource.TRIAL and not message:
        return None, ('Message is required', 400)

    inquiry = WebsiteInquiry(
        name=name,
        email=email,
        company=(data.get('company') or '').strip() or None,
        phone=(data.get('phone') or '').strip() or None,
        inquiry_type=(data.get('inquiry_type') or data.get('type') or '').strip() or None,
        message=message or None,
        source=source.value,
        status=WebsiteInquiryStatus.NEW.value,
    )
    db.session.add(inquiry)
    return inquiry, None


def _auth_payload(user):
    access_token, refresh_token = create_user_tokens(user)
    return {
        'success': True,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'is_admin': user.role == 'admin',
            'is_active': user.is_active,
        },
    }


@website_bp.route('/config', methods=['GET'])
def website_config():
    settings = _public_settings()
    isp = _primary_isp()

    sales_email = settings.get('website_sales_email') or (isp.email if isp else BRAND_SUPPORT_EMAIL)
    support_email = settings.get('website_support_email') or settings.get('portal_support_email') or BRAND_SUPPORT_EMAIL
    whatsapp = settings.get('website_whatsapp') or settings.get('portal_support_phone') or (isp.phone if isp else '')

    return jsonify({
        'success': True,
        'data': {
            'name': settings.get('website_brand_name', BRAND_NAME),
            'full_name': settings.get('website_full_name', BRAND_FULL_NAME),
            'tagline': settings.get('website_tagline', 'Connect. Bill. Grow.'),
            'description': settings.get(
                'website_description',
                'Lumen helps local ISPs grow their business by automating billing, payments, and network management.',
            ),
            'support_email': support_email,
            'sales_email': sales_email,
            'whatsapp': whatsapp,
            'website': settings.get('website_url', isp.website if isp else BRAND_WEBSITE),
            'portal_tagline': settings.get('portal_tagline', BRAND_PORTAL_TAGLINE),
            'portal_about': settings.get('portal_about', BRAND_PORTAL_ABOUT),
            'trial_days': int(settings.get('website_trial_days', '14')),
        },
    }), 200


@website_bp.route('/stats', methods=['GET'])
def website_stats():
    settings = _public_settings()
    isp_count = ISP.query.filter_by(is_active=True).count()
    customer_count = Customer.query.count()
    device_count = MikrotikDevice.query.count()
    payment_count = Payment.query.filter_by(payment_status=PaymentStatus.COMPLETED).count()

    trial_days = int(settings.get('website_trial_days', '14'))

    stats = [
        {
            'value': settings.get('website_stat_isps') or _format_count(max(isp_count, 1)),
            'label': 'ISPs Worldwide',
        },
        {
            'value': settings.get('website_stat_subscribers') or _format_count(max(customer_count, 1)),
            'label': 'Subscribers Managed',
        },
        {
            'value': settings.get('website_stat_uptime', '99.9%'),
            'label': 'Uptime SLA',
        },
        {
            'value': str(trial_days),
            'label': 'Day Free Trial',
        },
    ]

    return jsonify({
        'success': True,
        'data': {
            'stats': stats,
            'raw': {
                'isp_count': isp_count,
                'customer_count': customer_count,
                'device_count': device_count,
                'payment_count': payment_count,
            },
        },
    }), 200


@website_bp.route('/changelog', methods=['GET'])
def website_changelog():
    settings = _public_settings()
    raw = settings.get('website_changelog')
    if raw:
        try:
            entries = json.loads(raw)
            if isinstance(entries, list) and entries:
                return jsonify({'success': True, 'data': entries}), 200
        except json.JSONDecodeError:
            pass
    return jsonify({'success': True, 'data': DEFAULT_CHANGELOG}), 200


@website_bp.route('/contact', methods=['POST'])
@rate_limit(limit=6, window=60, scope='website-contact')
def website_contact():
    data = request.get_json() or {}
    inquiry, error = _create_inquiry(data, WebsiteInquirySource.CONTACT)
    if error:
        return jsonify({'success': False, 'error': error[0]}), error[1]

    try:
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Thank you — we received your message and will reply within 24 hours.',
            'inquiry_id': inquiry.id,
        }), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Failed to submit enquiry: {exc}'}), 500


@website_bp.route('/affiliate', methods=['POST'])
@rate_limit(limit=6, window=60, scope='website-affiliate')
def website_affiliate():
    data = request.get_json() or {}
    if not data.get('message'):
        data['message'] = 'Affiliate program application'
    data['inquiry_type'] = data.get('inquiry_type') or 'Affiliate application'
    inquiry, error = _create_inquiry(data, WebsiteInquirySource.AFFILIATE)
    if error:
        return jsonify({'success': False, 'error': error[0]}), error[1]

    try:
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Affiliate application received. Our partnerships team will contact you soon.',
            'inquiry_id': inquiry.id,
        }), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Failed to submit application: {exc}'}), 500


@website_bp.route('/trial-signup', methods=['POST'])
@rate_limit(limit=5, window=60, scope='website-trial-signup')
def website_trial_signup():
    data = request.get_json() or {}
    first_name = (data.get('first_name') or '').strip()
    last_name = (data.get('last_name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    company_name = (data.get('company_name') or data.get('company') or '').strip()
    phone = (data.get('phone') or '').strip() or None

    if not all([first_name, last_name, email, password, company_name]):
        return jsonify({'success': False, 'error': 'First name, last name, email, password, and company are required'}), 400
    if not _validate_email(email):
        return jsonify({'success': False, 'error': 'Invalid email address'}), 400
    if len(password) < 6:
        return jsonify({'success': False, 'error': 'Password must be at least 6 characters long'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'error': 'Email already registered. Try logging in instead.'}), 409

    try:
        isp = ISP(
            name=company_name[:100],
            company_name=company_name,
            email=email,
            phone=phone,
            website=BRAND_WEBSITE,
            subscription_plan='basic',
            max_devices=10,
            max_customers=500,
            is_active=True,
        )
        isp.generate_api_key()
        isp.generate_radius_secret()
        db.session.add(isp)
        db.session.flush()

        user = User(
            email=email,
            password_hash=generate_password_hash(password),
            first_name=first_name,
            last_name=last_name,
            role='admin',
            is_active=True,
            isp_id=isp.id,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.session.add(user)
        db.session.flush()

        inquiry = WebsiteInquiry(
            name=f'{first_name} {last_name}'.strip(),
            email=email,
            company=company_name,
            phone=phone,
            inquiry_type='Trial signup',
            message=f'New ISP trial registration for {company_name}',
            source=WebsiteInquirySource.TRIAL.value,
            status=WebsiteInquiryStatus.NEW.value,
            user_id=user.id,
            isp_id=isp.id,
        )
        db.session.add(inquiry)
        db.session.commit()

        payload = _auth_payload(user)
        payload['message'] = 'Trial account created successfully'
        payload['isp_id'] = isp.id
        return jsonify(payload), 201
    except Exception as exc:
        db.session.rollback()
        return jsonify({'success': False, 'error': f'Registration failed: {exc}'}), 500


@website_bp.route('/login', methods=['POST'])
@rate_limit(limit=10, window=60, scope='website-login')
def website_login():
    """Public login for marketing site — returns tokens for billing app handoff."""
    from werkzeug.security import check_password_hash

    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'success': False, 'error': 'Email and password are required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.is_active or not check_password_hash(user.password_hash, password):
        return jsonify({'success': False, 'error': 'Invalid email or password'}), 401

    user.last_login = datetime.now()
    db.session.commit()

    payload = _auth_payload(user)
    payload['message'] = 'Login successful'
    return jsonify(payload), 200


@website_bp.route('/inquiries', methods=['GET'])
@jwt_required()
def website_inquiries():
    current_user = get_current_user()
    if not current_user or current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    source = request.args.get('source')
    query = WebsiteInquiry.query.order_by(WebsiteInquiry.created_at.desc())
    if source:
        try:
            query = query.filter_by(source=WebsiteInquirySource(source))
        except ValueError:
            return jsonify({'error': 'Invalid source filter'}), 400

    rows = query.limit(100).all()
    return jsonify({
        'success': True,
        'inquiries': [_serialize_inquiry(row) for row in rows],
        'total': len(rows),
    }), 200
