"""Settings API — organisation-level configuration for the authenticated ISP.

Exposes the data behind Settings > General / Modules / Notifications /
Captive Portal / Subscription. All endpoints resolve the caller's ISP from the
JWT identity (admins fall back to the default active ISP) so the frontend never
needs to pass an ISP id.
"""
import os

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename

from extensions import db
from auth_utils import get_current_user
from models import (
    ISP, MikrotikDevice, NotificationSetting, PortalAnnouncement,
    PaymentSettings, RadiusConfig, RadiusNasClient, IntegrationSetting,
    ApiKey, ApiSetting,
)
from services.rate_limit import rate_limit
from services import notification_events as nev
from services.portal_urls import portal_entry_url, portal_frontend_base_url
from services.encryption import encrypt_value, decrypt_value
from datetime import datetime

import json
import re
import secrets

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')

_HEX_COLOR = re.compile(r'^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PORTAL_THEMES = [
    {'key': 'clean', 'name': 'Clean', 'badge': 'Default', 'description': 'White, ultra-light, works on any device'},
    {'key': 'dark', 'name': 'Dark', 'badge': 'Premium', 'description': 'Premium dark with glowing accents'},
    {'key': 'gradient', 'name': 'Gradient', 'badge': 'Vibrant', 'description': 'Vibrant purple gradient background'},
    {'key': 'neon', 'name': 'Neon', 'badge': 'Cyber', 'description': 'Cyberpunk dark with electric pink glow'},
    {'key': 'ocean', 'name': 'Ocean', 'badge': 'Calm', 'description': 'Deep blue with cyan, calm & professional'},
    {'key': 'sunset', 'name': 'Sunset', 'badge': 'Warm', 'description': 'Warm orange gradient, tropical feel'},
    {'key': 'forest', 'name': 'Forest', 'badge': 'Natural', 'description': 'Sage green, nature-inspired, scroll layout'},
    {'key': 'slate', 'name': 'Slate', 'badge': 'Minimal', 'description': 'Cool gray, ultra-minimal, scroll layout'},
    {'key': 'rose', 'name': 'Rose', 'badge': 'Warm', 'description': 'Warm blush tones, friendly, scroll layout'},
    {'key': 'midnight', 'name': 'Midnight', 'badge': 'Glass', 'description': 'Deep navy glass-morphism, scroll layout'},
]
_THEME_KEYS = {t['key'] for t in PORTAL_THEMES}


def _current_isp():
    """Resolve the ISP for the current request.

    Returns (isp, error_response, status). On success error_response is None.
    """
    user = get_current_user()
    if not user:
        return None, jsonify({'error': 'User not found'}), 404
    isp = None
    if getattr(user, 'isp_id', None):
        isp = ISP.query.get(user.isp_id)
    if isp is None and user.role == 'admin':
        isp = ISP.query.filter_by(is_active=True).order_by(ISP.id.asc()).first()
    if isp is None:
        return None, jsonify({'error': 'No ISP associated with this account'}), 404
    return isp, None, None


def _logo_dir():
    configured = os.environ.get('LOGO_UPLOAD_DIR')
    if configured:
        path = configured
    else:
        server_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        path = os.path.join(server_root, 'uploads', 'logos')
    os.makedirs(path, exist_ok=True)
    return path


def _public_base_url():
    """Public, browser-reachable base URL for assets served by this backend.

    Order of preference: ``PUBLIC_BASE_URL`` (explicit) → ``PROVISION_BASE_URL``
    (already required for one-line provisioning) → the request host (dev only).
    """
    for var in ('PUBLIC_BASE_URL', 'PROVISION_BASE_URL'):
        base = (os.environ.get(var) or '').strip().rstrip('/')
        if base:
            return base
    return request.host_url.rstrip('/')


def serialize_general(isp):
    return {
        'isp_name': isp.name,
        'company_name': isp.company_name,
        'hotspot_name': isp.hotspot_name,
        'support_phone': isp.support_phone or isp.phone,
        'theme_color': isp.theme_color or '#1BA449',
        'currency': isp.currency or 'KES',
        'logo_url': isp.logo_url,
        'website': isp.website,
        'data_retention_days': isp.data_retention_days,
        'hotspot_username_prefix': isp.hotspot_username_prefix,
        'hotspot_password_length': isp.hotspot_password_length,
        'custom_domain': isp.custom_domain,
        'current_portal_url': portal_entry_url(isp.id, isp=isp) or portal_frontend_base_url() or _public_base_url(),
    }


def serialize_modules(isp):
    return {
        'pppoe_enabled': bool(isp.pppoe_enabled),
        'hotspot_enabled': bool(isp.hotspot_enabled),
        'reseller_enabled': bool(isp.reseller_enabled),
    }


def serialize_announcement(a):
    return {
        'id': a.id,
        'title': a.title,
        'type': a.type,
        'message': a.message,
        'expires_at': a.expires_at.isoformat() if a.expires_at else None,
        'is_active': a.is_active,
        'is_live': a.is_live(),
        'created_at': a.created_at.isoformat() if a.created_at else None,
    }


# ---------------------------------------------------------------------------
# General
# ---------------------------------------------------------------------------

@settings_bp.route('/general', methods=['GET'])
@jwt_required()
def get_general():
    isp, err, status = _current_isp()
    if err:
        return err, status
    return jsonify(serialize_general(isp)), 200


@settings_bp.route('/general', methods=['PUT'])
@jwt_required()
def update_general():
    isp, err, status = _current_isp()
    if err:
        return err, status
    data = request.get_json() or {}

    if 'isp_name' in data:
        name = (data['isp_name'] or '').strip()
        if not name:
            return jsonify({'error': 'ISP name cannot be empty'}), 400
        isp.name = name
    if 'company_name' in data:
        isp.company_name = (data['company_name'] or '').strip() or isp.company_name
    if 'hotspot_name' in data:
        isp.hotspot_name = (data['hotspot_name'] or '').strip() or None
    if 'support_phone' in data:
        isp.support_phone = (data['support_phone'] or '').strip() or None
    if 'theme_color' in data:
        color = (data['theme_color'] or '').strip()
        isp.theme_color = color or '#1BA449'
    if 'currency' in data:
        isp.currency = (data['currency'] or '').strip().upper() or 'KES'
    if 'website' in data:
        isp.website = (data['website'] or '').strip() or None
    if 'logo_url' in data:
        isp.logo_url = (data['logo_url'] or '').strip() or None

    if 'data_retention_days' in data:
        raw = data['data_retention_days']
        if raw in (None, '', 'null'):
            isp.data_retention_days = None
        else:
            try:
                days = int(raw)
            except (TypeError, ValueError):
                return jsonify({'error': 'Data retention must be a whole number of days'}), 400
            if days < 7:
                return jsonify({'error': 'Data retention must be at least 7 days (leave blank to keep forever)'}), 400
            isp.data_retention_days = days

    if 'hotspot_username_prefix' in data:
        prefix = (data['hotspot_username_prefix'] or '').strip()
        isp.hotspot_username_prefix = prefix or None

    if 'hotspot_password_length' in data:
        raw = data['hotspot_password_length']
        if raw in (None, '', 'null'):
            isp.hotspot_password_length = None
        else:
            try:
                length = int(raw)
            except (TypeError, ValueError):
                return jsonify({'error': 'Password length must be a whole number'}), 400
            if length < 4:
                return jsonify({'error': 'Password length must be at least 4'}), 400
            isp.hotspot_password_length = length

    db.session.commit()
    return jsonify({'message': 'Settings saved', 'general': serialize_general(isp)}), 200


@settings_bp.route('/logo', methods=['POST'])
@jwt_required()
@rate_limit(limit=20, window=300, scope='settings-logo')
def upload_logo():
    isp, err, status = _current_isp()
    if err:
        return err, status
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {'.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'}:
        return jsonify({'error': 'Unsupported image type'}), 400

    filename = secure_filename(f'isp_{isp.id}_logo{ext}')
    path = os.path.join(_logo_dir(), filename)
    file.save(path)

    # Build a PUBLIC, browser-reachable URL. Behind the proxy ``request.host_url``
    # can resolve to the internal container host, which a customer's device on
    # the captive portal cannot load — so prefer the configured public base.
    # A cache-busting ?v= avoids the portal showing a stale cached logo after
    # the file is overwritten with a new upload of the same name.
    logo_url = f'{_public_base_url()}/api/settings/logo/{filename}?v={int(datetime.utcnow().timestamp())}'
    isp.logo_url = logo_url
    db.session.commit()
    return jsonify({'message': 'Logo uploaded', 'logo_url': logo_url}), 200


@settings_bp.route('/logo/<path:filename>', methods=['GET'])
def serve_logo(filename):
    safe = secure_filename(filename)
    path = os.path.join(_logo_dir(), safe)
    if not os.path.exists(path):
        return jsonify({'error': 'Not found'}), 404
    return send_file(path)


# ---------------------------------------------------------------------------
# Custom domain
# ---------------------------------------------------------------------------

@settings_bp.route('/custom-domain', methods=['PUT'])
@jwt_required()
def update_custom_domain():
    isp, err, status = _current_isp()
    if err:
        return err, status
    data = request.get_json() or {}
    domain = (data.get('custom_domain') or '').strip().lower()
    if domain:
        # Strip scheme/spaces; reject obviously invalid values.
        domain = domain.replace('https://', '').replace('http://', '').strip('/')
        if ' ' in domain or '.' not in domain:
            return jsonify({'error': 'Enter a valid subdomain, e.g. wifi.yourcompany.com'}), 400
    isp.custom_domain = domain or None
    db.session.commit()
    return jsonify({'message': 'Custom domain saved', 'custom_domain': isp.custom_domain}), 200


# ---------------------------------------------------------------------------
# Modules
# ---------------------------------------------------------------------------

@settings_bp.route('/modules', methods=['GET'])
@jwt_required()
def get_modules():
    isp, err, status = _current_isp()
    if err:
        return err, status
    return jsonify(serialize_modules(isp)), 200


@settings_bp.route('/modules', methods=['PUT'])
@jwt_required()
def update_modules():
    isp, err, status = _current_isp()
    if err:
        return err, status
    user = get_current_user()
    if user.role != 'admin':
        return jsonify({'error': 'Module access is managed by your system administrator'}), 403
    data = request.get_json() or {}
    if 'pppoe_enabled' in data:
        isp.pppoe_enabled = bool(data['pppoe_enabled'])
    if 'hotspot_enabled' in data:
        isp.hotspot_enabled = bool(data['hotspot_enabled'])
    if 'reseller_enabled' in data:
        isp.reseller_enabled = bool(data['reseller_enabled'])
    db.session.commit()
    return jsonify({'message': 'Modules updated', 'modules': serialize_modules(isp)}), 200


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

@settings_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    isp, err, status = _current_isp()
    if err:
        return err, status

    overrides = {
        (s.event_key, s.channel): s
        for s in NotificationSetting.query.filter_by(isp_id=isp.id).all()
    }

    groups = []
    for group in nev.GROUPS:
        events = []
        for ev in group['events']:
            ov = overrides.get((ev['key'], ev['channel']))
            events.append({
                'event_key': ev['key'],
                'label': ev['label'],
                'description': ev['description'],
                'channel': ev['channel'],
                'variables': ev['variables'],
                'default_template': ev['default_template'],
                'enabled': ov.enabled if ov is not None else ev['default_enabled'],
                'template': (ov.template if ov is not None else None) or '',
            })
        groups.append({
            'key': group['key'],
            'label': group['label'],
            'description': group['description'],
            'events': events,
        })
    return jsonify({'groups': groups}), 200


@settings_bp.route('/notifications', methods=['PUT'])
@jwt_required()
def update_notifications():
    isp, err, status = _current_isp()
    if err:
        return err, status
    data = request.get_json() or {}
    items = data.get('settings')
    if not isinstance(items, list):
        return jsonify({'error': 'Expected a "settings" list'}), 400

    existing = {
        (s.event_key, s.channel): s
        for s in NotificationSetting.query.filter_by(isp_id=isp.id).all()
    }

    for item in items:
        event_key = item.get('event_key')
        channel = item.get('channel')
        if not nev.is_valid_event(event_key, channel):
            continue
        enabled = bool(item.get('enabled'))
        template = (item.get('template') or '').strip() or None
        row = existing.get((event_key, channel))
        if row is None:
            row = NotificationSetting(isp_id=isp.id, event_key=event_key, channel=channel)
            db.session.add(row)
        row.enabled = enabled
        row.template = template

    db.session.commit()
    return jsonify({'message': 'Notification preferences saved'}), 200


# ---------------------------------------------------------------------------
# Captive portal
# ---------------------------------------------------------------------------

@settings_bp.route('/portal', methods=['GET'])
@jwt_required()
def get_portal():
    isp, err, status = _current_isp()
    if err:
        return err, status

    routers = []
    for d in MikrotikDevice.query.filter_by(isp_id=isp.id).order_by(MikrotikDevice.device_name.asc()).all():
        routers.append({
            'id': d.id,
            'name': d.device_name,
            'ip': getattr(d, 'device_ip', None),
            'theme': d.portal_theme or isp.default_portal_theme or 'clean',
            'portal_url': portal_entry_url(isp.id, d.id, isp=isp),
        })

    announcements = [
        serialize_announcement(a)
        for a in PortalAnnouncement.query.filter_by(isp_id=isp.id)
        .order_by(PortalAnnouncement.created_at.desc()).all()
    ]

    return jsonify({
        'default_portal_theme': isp.default_portal_theme or 'clean',
        'after_login_redirect_url': isp.after_login_redirect_url or 'https://www.google.com',
        'theme_color': isp.theme_color or '#1BA449',
        'hotspot_name': isp.hotspot_name or isp.name,
        'logo_url': isp.logo_url,
        'isp_name': isp.name,
        'isp_id': isp.id,
        'preview_portal_url': portal_entry_url(isp.id, isp=isp),
        'themes': PORTAL_THEMES,
        'routers': routers,
        'announcements': announcements,
    }), 200


@settings_bp.route('/portal', methods=['PUT'])
@jwt_required()
def update_portal():
    isp, err, status = _current_isp()
    if err:
        return err, status
    data = request.get_json() or {}
    if 'default_portal_theme' in data:
        theme = (data['default_portal_theme'] or '').strip()
        if theme not in _THEME_KEYS:
            return jsonify({'error': 'Unknown portal theme'}), 400
        isp.default_portal_theme = theme
    if 'after_login_redirect_url' in data:
        url = (data['after_login_redirect_url'] or '').strip()
        isp.after_login_redirect_url = url or None
    if 'theme_color' in data:
        color = (data['theme_color'] or '').strip()
        if color and not _HEX_COLOR.match(color):
            return jsonify({'error': 'Theme color must be a valid hex value (e.g. #1BA449)'}), 400
        isp.theme_color = color or '#1BA449'
    db.session.commit()
    return jsonify({'message': 'Captive portal settings saved'}), 200


@settings_bp.route('/portal/router/<int:device_id>', methods=['PUT'])
@jwt_required()
def update_router_theme(device_id):
    isp, err, status = _current_isp()
    if err:
        return err, status
    device = MikrotikDevice.query.get_or_404(device_id)
    if device.isp_id != isp.id:
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json() or {}
    theme = (data.get('theme') or '').strip()
    if theme and theme not in _THEME_KEYS:
        return jsonify({'error': 'Unknown portal theme'}), 400
    device.portal_theme = theme or None
    db.session.commit()
    return jsonify({'message': 'Router theme saved', 'theme': device.portal_theme}), 200


# ---------------------------------------------------------------------------
# Portal announcements
# ---------------------------------------------------------------------------

@settings_bp.route('/announcements', methods=['POST'])
@jwt_required()
def create_announcement():
    isp, err, status = _current_isp()
    if err:
        return err, status
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()
    if not title:
        return jsonify({'error': 'Title is required'}), 400
    ann = PortalAnnouncement(
        isp_id=isp.id,
        title=title,
        type=(data.get('type') or 'info').strip().lower(),
        message=(data.get('message') or '').strip() or None,
        is_active=True,
    )
    expires = (data.get('expires_at') or '').strip()
    if expires:
        try:
            ann.expires_at = datetime.fromisoformat(expires.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid expiry date'}), 400
    db.session.add(ann)
    db.session.commit()
    return jsonify({'message': 'Announcement posted', 'announcement': serialize_announcement(ann)}), 201


@settings_bp.route('/announcements/<int:ann_id>', methods=['PUT'])
@jwt_required()
def update_announcement(ann_id):
    isp, err, status = _current_isp()
    if err:
        return err, status
    ann = PortalAnnouncement.query.get_or_404(ann_id)
    if ann.isp_id != isp.id:
        return jsonify({'error': 'Access denied'}), 403
    data = request.get_json() or {}
    if 'is_active' in data:
        ann.is_active = bool(data['is_active'])
    if 'title' in data and data['title'].strip():
        ann.title = data['title'].strip()
    if 'type' in data:
        ann.type = (data['type'] or 'info').strip().lower()
    if 'message' in data:
        ann.message = (data['message'] or '').strip() or None
    db.session.commit()
    return jsonify({'message': 'Announcement updated', 'announcement': serialize_announcement(ann)}), 200


@settings_bp.route('/announcements/<int:ann_id>', methods=['DELETE'])
@jwt_required()
def delete_announcement(ann_id):
    isp, err, status = _current_isp()
    if err:
        return err, status
    ann = PortalAnnouncement.query.get_or_404(ann_id)
    if ann.isp_id != isp.id:
        return jsonify({'error': 'Access denied'}), 403
    db.session.delete(ann)
    db.session.commit()
    return jsonify({'message': 'Announcement deleted'}), 200


# ---------------------------------------------------------------------------
# Subscription (read-only)
# ---------------------------------------------------------------------------

@settings_bp.route('/subscription', methods=['GET'])
@jwt_required()
def get_subscription():
    isp, err, status = _current_isp()
    if err:
        return err, status

    device_count = len(isp.mikrotik_devices)
    customer_count = len(isp.customers)

    return jsonify({
        'plan': isp.subscription_plan,
        'plan_label': (isp.subscription_plan or 'basic').title(),
        'is_active': isp.is_active,
        'currency': isp.currency or 'KES',
        'started_at': isp.created_at.isoformat() if isp.created_at else None,
        'quotas': {
            'max_devices': isp.max_devices,
            'max_customers': isp.max_customers,
            'device_count': device_count,
            'customer_count': customer_count,
        },
        # Tenant SaaS invoicing is not modelled yet; surface an empty history so
        # the UI renders cleanly and we can wire real billing later.
        'billing_history': [],
    }), 200


# Plan tiers and the device/customer quotas each grants.
SUBSCRIPTION_PLANS = {
    'basic': {'label': 'Basic', 'max_devices': 10, 'max_customers': 100},
    'pro': {'label': 'Pro', 'max_devices': 50, 'max_customers': 1000},
    'enterprise': {'label': 'Enterprise', 'max_devices': 500, 'max_customers': 100000},
}


@settings_bp.route('/subscription', methods=['PUT'])
@jwt_required()
def update_subscription():
    """Change the ISP's subscription tier (admin only) and apply its quotas."""
    isp, err, status = _current_isp()
    if err:
        return err, status
    user = get_current_user()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json() or {}
    plan = (data.get('plan') or '').strip().lower()
    if plan not in SUBSCRIPTION_PLANS:
        return jsonify({'error': 'Invalid plan', 'valid_plans': list(SUBSCRIPTION_PLANS)}), 400

    tier = SUBSCRIPTION_PLANS[plan]
    isp.subscription_plan = plan
    isp.max_devices = tier['max_devices']
    isp.max_customers = tier['max_customers']
    db.session.commit()

    return jsonify({
        'ok': True,
        'message': f"Subscription changed to {tier['label']}",
        'plan': isp.subscription_plan,
        'plan_label': tier['label'],
        'quotas': {'max_devices': isp.max_devices, 'max_customers': isp.max_customers},
    }), 200


@settings_bp.route('/plans', methods=['GET'])
@jwt_required()
def list_subscription_plans():
    """Available subscription tiers (for the plan-change UI)."""
    return jsonify({
        'ok': True,
        'plans': [
            {'key': key, 'label': v['label'],
             'max_devices': v['max_devices'], 'max_customers': v['max_customers']}
            for key, v in SUBSCRIPTION_PLANS.items()
        ],
    }), 200


@settings_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_system_logs():
    """Paginated system activity log (admin only)."""
    from models import SystemLog, User
    user = get_current_user()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 25, type=int)
    level = (request.args.get('level') or '').strip().upper()
    log_type = (request.args.get('type') or '').strip().lower()
    search = (request.args.get('search') or '').strip()

    query = SystemLog.query
    if level in ('INFO', 'WARNING', 'ERROR'):
        query = query.filter(SystemLog.log_level == level)
    if log_type:
        query = query.filter(SystemLog.log_type == log_type)
    if search:
        query = query.filter(SystemLog.log_message.ilike(f'%{search}%'))

    paginated = query.order_by(SystemLog.log_timestamp.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    users = {u.id: u for u in User.query.filter(
        User.id.in_([r.user_id for r in paginated.items if r.user_id])
    ).all()} if paginated.items else {}

    def _row(r):
        u = users.get(r.user_id)
        return {
            'id': r.id,
            'type': r.log_type,
            'message': r.log_message,
            'level': r.log_level,
            'timestamp': r.log_timestamp.isoformat() if r.log_timestamp else None,
            'user': (f'{u.first_name} {u.last_name}'.strip() or u.email) if u else 'system',
        }

    return jsonify({
        'ok': True,
        'logs': [_row(r) for r in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'current_page': page,
    }), 200


# ---------------------------------------------------------------------------
# Hotspot access codes (admin voucher generation)
# ---------------------------------------------------------------------------

@settings_bp.route('/hotspot-codes', methods=['POST'])
@jwt_required()
def create_hotspot_code():
    import secrets
    from models import HotspotAccessCode, ServicePlan

    isp, err, status = _current_isp()
    if err:
        return err, status
    data = request.get_json() or {}
    plan_id = data.get('plan_id')
    if not plan_id:
        return jsonify({'error': 'plan_id is required'}), 400
    plan = ServicePlan.query.filter_by(id=plan_id, isp_id=isp.id, plan_type='hotspot').first()
    if not plan:
        return jsonify({'error': 'Hotspot plan not found'}), 404

    prefix = (isp.hotspot_username_prefix or 'HS').upper()[:6]
    code = (data.get('code') or f'{prefix}{secrets.token_hex(3).upper()}')[:50].upper()
    if HotspotAccessCode.query.filter_by(isp_id=isp.id, code=code).first():
        return jsonify({'error': 'Code already exists'}), 409

    row = HotspotAccessCode(
        isp_id=isp.id,
        plan_id=plan.id,
        device_id=data.get('device_id'),
        code=code,
        status='unused',
        max_uses=int(data.get('max_uses') or 1),
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({'message': 'Access code created', 'code': code, 'id': row.id}), 201


# ---------------------------------------------------------------------------
# Payments  (Settings > Payments)
# ---------------------------------------------------------------------------

def _get_or_create_payment_settings(isp):
    ps = isp.payment_settings
    if ps is None:
        ps = PaymentSettings(isp_id=isp.id)
        db.session.add(ps)
        db.session.commit()
    return ps


def serialize_payments(ps):
    return {
        'collection_route': ps.collection_route or 'paybill',
        'buygoods_till': ps.buygoods_till or '',
        'buygoods_store': ps.buygoods_store or '',
        'paybill_shortcode': ps.paybill_shortcode or '',
        'paybill_account': ps.paybill_account or '',
        'bank_name': ps.bank_name or '',
        'bank_paybill': ps.bank_paybill or '',
        'bank_account': ps.bank_account or '',
        'daraja_env': ps.daraja_env or 'sandbox',
        'daraja_consumer_key': ps.daraja_consumer_key or '',
        'daraja_consumer_secret': decrypt_value(ps.daraja_consumer_secret) or '',
        'daraja_passkey': decrypt_value(ps.daraja_passkey) or '',
        'daraja_shortcode': ps.daraja_shortcode or '',
        'daraja_callback_url': ps.daraja_callback_url or '',
        'method_mpesa': bool(ps.method_mpesa),
        'method_manual': bool(ps.method_manual),
        'method_card': bool(ps.method_card),
        'method_cash': bool(ps.method_cash),
    }


@settings_bp.route('/payments', methods=['GET'])
@jwt_required()
def get_payments():
    isp, err, status = _current_isp()
    if err:
        return err, status
    ps = _get_or_create_payment_settings(isp)
    return jsonify(serialize_payments(ps)), 200


@settings_bp.route('/payments', methods=['PUT'])
@jwt_required()
def update_payments():
    isp, err, status = _current_isp()
    if err:
        return err, status
    ps = _get_or_create_payment_settings(isp)
    data = request.get_json() or {}

    if 'collection_route' in data:
        route = (data.get('collection_route') or 'paybill').strip()
        if route not in ('buygoods', 'paybill', 'bank'):
            return jsonify({'error': 'Invalid collection route'}), 400
        ps.collection_route = route

    plain_fields = (
        'buygoods_till', 'buygoods_store', 'paybill_shortcode', 'paybill_account',
        'bank_name', 'bank_paybill', 'bank_account',
        'daraja_consumer_key', 'daraja_shortcode', 'daraja_callback_url',
    )
    for field in plain_fields:
        if field in data:
            value = data[field]
            setattr(ps, field, (str(value).strip() or None) if value is not None else None)

    if 'daraja_env' in data:
        env = (data.get('daraja_env') or 'sandbox').strip().lower()
        ps.daraja_env = env if env in ('sandbox', 'live') else 'sandbox'

    # Secrets are stored encrypted; an empty value clears them.
    if 'daraja_consumer_secret' in data:
        val = (data.get('daraja_consumer_secret') or '').strip()
        ps.daraja_consumer_secret = encrypt_value(val) if val else None
    if 'daraja_passkey' in data:
        val = (data.get('daraja_passkey') or '').strip()
        ps.daraja_passkey = encrypt_value(val) if val else None

    for field in ('method_mpesa', 'method_manual', 'method_card', 'method_cash'):
        if field in data:
            setattr(ps, field, bool(data[field]))

    db.session.commit()
    return jsonify({'message': 'Payment settings saved', 'payments': serialize_payments(ps)}), 200


# ---------------------------------------------------------------------------
# RADIUS  (Settings > RADIUS)
# ---------------------------------------------------------------------------

def _get_or_create_radius_config(isp):
    rc = isp.radius_config
    if rc is None:
        rc = RadiusConfig(isp_id=isp.id)
        db.session.add(rc)
        db.session.commit()
    return rc


def _sync_radius_clients_conf_safe():
    """Best-effort regen of the FreeRADIUS clients.conf after a RADIUS change.

    Mirrors the device routes: a file-write failure must never fail the API.
    """
    try:
        from services.radius_clients_export import sync_radius_clients_conf
        sync_radius_clients_conf()
    except Exception as exc:
        current_app.logger.warning('Failed to sync RADIUS clients.conf: %s', exc)


def serialize_nas(n):
    return {'id': n.id, 'name': n.name, 'ip': n.ip_address}


def serialize_radius(rc, nas_clients):
    return {
        'enabled': bool(rc.enabled),
        'host': rc.host or '',
        'auth_port': rc.auth_port or 1812,
        'acct_port': rc.acct_port or 1813,
        'shared_secret': decrypt_value(rc.shared_secret) or '',
        'nas_identifier': rc.nas_identifier or '',
        'acct_interim': bool(rc.acct_interim),
        'coa_enabled': bool(rc.coa_enabled),
        'data_usage_enforce': bool(rc.data_usage_enforce),
        'nas_clients': [serialize_nas(n) for n in nas_clients],
    }


@settings_bp.route('/radius', methods=['GET'])
@jwt_required()
def get_radius():
    isp, err, status = _current_isp()
    if err:
        return err, status
    rc = _get_or_create_radius_config(isp)
    nas = RadiusNasClient.query.filter_by(isp_id=isp.id).order_by(RadiusNasClient.id.asc()).all()
    return jsonify(serialize_radius(rc, nas)), 200


@settings_bp.route('/radius', methods=['PUT'])
@jwt_required()
def update_radius():
    isp, err, status = _current_isp()
    if err:
        return err, status
    rc = _get_or_create_radius_config(isp)
    data = request.get_json() or {}

    if 'enabled' in data:
        rc.enabled = bool(data['enabled'])
    if 'host' in data:
        rc.host = (data.get('host') or '').strip() or None
    if 'nas_identifier' in data:
        rc.nas_identifier = (data.get('nas_identifier') or '').strip() or None
    for field in ('auth_port', 'acct_port'):
        if field in data and data[field] not in (None, '', 'null'):
            try:
                setattr(rc, field, int(data[field]))
            except (TypeError, ValueError):
                return jsonify({'error': f'{field} must be a whole number'}), 400
    if 'shared_secret' in data:
        val = (data.get('shared_secret') or '').strip()
        rc.shared_secret = encrypt_value(val) if val else None
    for field in ('acct_interim', 'coa_enabled', 'data_usage_enforce'):
        if field in data:
            setattr(rc, field, bool(data[field]))

    db.session.commit()
    _sync_radius_clients_conf_safe()
    nas = RadiusNasClient.query.filter_by(isp_id=isp.id).order_by(RadiusNasClient.id.asc()).all()
    return jsonify({'message': 'RADIUS settings saved', 'radius': serialize_radius(rc, nas)}), 200


@settings_bp.route('/radius/nas', methods=['POST'])
@jwt_required()
def add_radius_nas():
    isp, err, status = _current_isp()
    if err:
        return err, status
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    ip = (data.get('ip') or data.get('ip_address') or '').strip()
    if not name or not ip:
        return jsonify({'error': 'Name and IP address are required'}), 400
    secret = (data.get('secret') or data.get('shared_secret') or '').strip()
    n = RadiusNasClient(
        isp_id=isp.id,
        name=name[:120],
        ip_address=ip[:64],
        shared_secret=encrypt_value(secret) if secret else None,
    )
    db.session.add(n)
    db.session.commit()
    _sync_radius_clients_conf_safe()
    return jsonify({'message': 'NAS client added', 'nas': serialize_nas(n)}), 201


@settings_bp.route('/radius/nas/<int:nas_id>', methods=['DELETE'])
@jwt_required()
def delete_radius_nas(nas_id):
    isp, err, status = _current_isp()
    if err:
        return err, status
    n = RadiusNasClient.query.get_or_404(nas_id)
    if n.isp_id != isp.id:
        return jsonify({'error': 'Access denied'}), 403
    db.session.delete(n)
    db.session.commit()
    _sync_radius_clients_conf_safe()
    return jsonify({'message': 'NAS client removed'}), 200


# ---------------------------------------------------------------------------
# Integrations  (Settings > Integrations)
# ---------------------------------------------------------------------------

# A config field is treated as a secret (encrypted at rest, masked on read) when
# its name hints at credentials. Keeps the storage format generic per integration.
_SECRET_MASK = '********'
_SECRET_HINTS = ('key', 'secret', 'token', 'password', 'passkey')


def _is_secret_field(name):
    n = (name or '').lower()
    return any(hint in n for hint in _SECRET_HINTS)


def _integration_config(row):
    """Raw stored config (secret values are ciphertext)."""
    try:
        return json.loads(row.config) if row.config else {}
    except (ValueError, TypeError):
        return {}


def _public_integration_config(raw):
    """Config safe to return to the client — secrets masked, never decrypted."""
    out = {}
    for k, v in (raw or {}).items():
        if _is_secret_field(k):
            out[k] = _SECRET_MASK if v else ''
        else:
            out[k] = v
    return out


@settings_bp.route('/integrations', methods=['GET'])
@jwt_required()
def get_integrations():
    isp, err, status = _current_isp()
    if err:
        return err, status
    rows = IntegrationSetting.query.filter_by(isp_id=isp.id).all()
    integrations = [
        {'key': r.key, 'enabled': bool(r.enabled), 'config': _public_integration_config(_integration_config(r))}
        for r in rows
    ]
    return jsonify({'integrations': integrations}), 200


@settings_bp.route('/integrations/<key>', methods=['PUT'])
@jwt_required()
def update_integration(key):
    isp, err, status = _current_isp()
    if err:
        return err, status
    key = (key or '').strip().lower()[:60]
    if not key:
        return jsonify({'error': 'Integration key required'}), 400
    data = request.get_json() or {}
    row = IntegrationSetting.query.filter_by(isp_id=isp.id, key=key).first()
    if row is None:
        row = IntegrationSetting(isp_id=isp.id, key=key)
        db.session.add(row)
    if 'enabled' in data:
        row.enabled = bool(data['enabled'])
    if 'config' in data:
        incoming = data.get('config') or {}
        # Start from existing (keeps ciphertext secrets the client didn't resend),
        # then apply incoming: encrypt new secrets, keep old on blank/mask.
        merged = _integration_config(row)
        for k, v in incoming.items():
            if _is_secret_field(k):
                if v in (None, '', _SECRET_MASK):
                    continue  # leave existing ciphertext untouched
                merged[k] = encrypt_value(str(v))
            else:
                merged[k] = v
        row.config = json.dumps(merged) if merged else None
    db.session.commit()
    return jsonify({
        'message': 'Integration updated',
        'integration': {
            'key': row.key,
            'enabled': bool(row.enabled),
            'config': _public_integration_config(_integration_config(row)),
        },
    }), 200


# ---------------------------------------------------------------------------
# API keys & webhook secret  (Settings > API Keys)
# ---------------------------------------------------------------------------

def _get_or_create_api_setting(isp):
    a = isp.api_setting
    if a is None:
        a = ApiSetting(isp_id=isp.id, webhook_secret=f'whsec_{secrets.token_hex(16)}')
        db.session.add(a)
        db.session.commit()
    elif not a.webhook_secret:
        a.webhook_secret = f'whsec_{secrets.token_hex(16)}'
        db.session.commit()
    return a


def serialize_api_key(k):
    return {
        'id': k.id,
        'name': k.name,
        'key': k.masked,
        'scopes': [s for s in (k.scopes or '').split(',') if s],
        'created': k.created_at.date().isoformat() if k.created_at else None,
        'last_used': k.last_used_at.date().isoformat() if k.last_used_at else None,
    }


@settings_bp.route('/api-keys', methods=['GET'])
@jwt_required()
def get_api_keys():
    isp, err, status = _current_isp()
    if err:
        return err, status
    a = _get_or_create_api_setting(isp)
    keys = ApiKey.query.filter_by(isp_id=isp.id).order_by(ApiKey.created_at.desc()).all()
    return jsonify({
        'keys': [serialize_api_key(k) for k in keys],
        'webhook_secret': a.webhook_secret,
    }), 200


@settings_bp.route('/api-keys', methods=['POST'])
@jwt_required()
def create_api_key():
    isp, err, status = _current_isp()
    if err:
        return err, status
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'Key name is required'}), 400
    scopes = data.get('scopes') or []
    if isinstance(scopes, str):
        scopes = [s.strip() for s in scopes.split(',')]
    valid = {'read', 'write', 'payments', 'webhooks'}
    scopes = [s for s in scopes if s in valid] or ['read']
    token = f'sk_live_{secrets.token_hex(24)}'
    k = ApiKey(isp_id=isp.id, name=name[:120], token=token, scopes=','.join(scopes))
    db.session.add(k)
    db.session.commit()
    payload = serialize_api_key(k)
    payload['token'] = token  # full token, returned only at creation
    return jsonify({'message': 'API key created', 'api_key': payload}), 201


@settings_bp.route('/api-keys/<int:key_id>', methods=['DELETE'])
@jwt_required()
def delete_api_key(key_id):
    isp, err, status = _current_isp()
    if err:
        return err, status
    k = ApiKey.query.get_or_404(key_id)
    if k.isp_id != isp.id:
        return jsonify({'error': 'Access denied'}), 403
    db.session.delete(k)
    db.session.commit()
    return jsonify({'message': 'API key revoked'}), 200


@settings_bp.route('/api-keys/webhook-secret', methods=['POST'])
@jwt_required()
def regenerate_webhook_secret():
    isp, err, status = _current_isp()
    if err:
        return err, status
    a = _get_or_create_api_setting(isp)
    a.webhook_secret = f'whsec_{secrets.token_hex(16)}'
    db.session.commit()
    return jsonify({'message': 'Webhook secret regenerated', 'webhook_secret': a.webhook_secret}), 200
