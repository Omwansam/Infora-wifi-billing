"""Captive portal business logic for hotspot guests and PPPoE renewals."""
import re
import secrets
import uuid
from datetime import datetime, timedelta

from sqlalchemy import or_

from extensions import db
from models import (
    Customer,
    CustomerStatus,
    ISP,
    Invoice,
    InvoiceStatus,
    Payment,
    PaymentStatus,
    RadCheck,
    ServicePlan,
    SystemSetting,
)
from services.brand_constants import (
    BRAND_COMPANY,
    BRAND_NAME,
    BRAND_PORTAL_ABOUT,
    BRAND_PORTAL_TAGLINE,
    BRAND_SUPPORT_EMAIL,
    BRAND_WEBSITE,
    sanitize_brand_text,
)
from services.mpesa_service import MpesaError, initiate_stk_push
from services.payment_processor import create_pending_mpesa_payment
from services.hotspot_credentials import (
    generate_hotspot_password,
    hotspot_login_email,
    hotspot_portal_email,
    normalize_phone,
)
from services.radius_provisioning import (
    get_customer_radius_password,
    radius_username,
)


def get_default_isp(isp_id=None):
    if isp_id:
        isp = ISP.query.filter_by(id=isp_id, is_active=True).first()
        if isp:
            return isp
    return ISP.query.filter_by(is_active=True).first()


def get_portal_settings():
    rows = SystemSetting.query.filter_by(category='portal').all()
    return {row.key: row.value for row in rows}


def get_portal_config(isp_id=None, router_id=None):
    isp = get_default_isp(isp_id)
    if not isp:
        return None

    from models import MikrotikDevice
    from services.portal_urls import portal_entry_url

    device = None
    theme = getattr(isp, 'default_portal_theme', None) or 'clean'
    if router_id:
        device = MikrotikDevice.query.filter_by(id=router_id, isp_id=isp.id).first()
        if device and device.portal_theme:
            theme = device.portal_theme

    settings = get_portal_settings()
    company_name = sanitize_brand_text(isp.company_name, BRAND_COMPANY)
    isp_display_name = sanitize_brand_text(isp.name, BRAND_NAME)
    support_phone = getattr(isp, 'support_phone', None) or settings.get('portal_support_phone', isp.phone)
    return {
        'isp_id': isp.id,
        'router_id': device.id if device else router_id,
        'company_name': company_name,
        'name': isp_display_name,
        'tagline': sanitize_brand_text(
            settings.get('portal_tagline'),
            BRAND_PORTAL_TAGLINE,
        ),
        'about': sanitize_brand_text(
            settings.get(
                'portal_about',
                (
                    f'{company_name} delivers reliable WiFi and home broadband across Kenya. '
                    'Choose a hotspot bundle for instant access, or renew your PPPoE package to stay online.'
                ),
            ),
            BRAND_PORTAL_ABOUT,
        ),
        'phone': isp.phone,
        'email': sanitize_brand_text(isp.email, BRAND_SUPPORT_EMAIL),
        'website': isp.website or BRAND_WEBSITE,
        'logo_url': isp.logo_url,
        'support_phone': support_phone,
        'support_email': sanitize_brand_text(
            settings.get('portal_support_email', isp.email),
            BRAND_SUPPORT_EMAIL,
        ),
        'hotspot_welcome': settings.get(
            'portal_hotspot_welcome',
            'Pick a WiFi package, pay with M-Pesa, and start browsing immediately.',
        ),
        'pppoe_welcome': settings.get(
            'portal_pppoe_welcome',
            'Enter your account to check your package status or renew when your plan has ended.',
        ),
        'hotspot_name': getattr(isp, 'hotspot_name', None) or isp_display_name,
        'theme_color': getattr(isp, 'theme_color', None) or '#1BA449',
        'portal_theme': theme,
        'default_theme': getattr(isp, 'default_portal_theme', None) or 'clean',
        'after_login_redirect_url': getattr(isp, 'after_login_redirect_url', None) or 'https://www.google.com',
        'announcements': _live_announcements(isp.id),
        'modules': {
            'hotspot_enabled': bool(getattr(isp, 'hotspot_enabled', True)),
            'pppoe_enabled': bool(getattr(isp, 'pppoe_enabled', True)),
            'reseller_enabled': bool(getattr(isp, 'reseller_enabled', False)),
        },
        'portal_url': portal_entry_url(isp.id, device.id if device else router_id, isp=isp),
    }


def _live_announcements(isp_id):
    """Active, non-expired portal banners for this ISP (newest first)."""
    try:
        from models import PortalAnnouncement
        rows = (
            PortalAnnouncement.query.filter_by(isp_id=isp_id, is_active=True)
            .order_by(PortalAnnouncement.created_at.desc())
            .all()
        )
        return [
            {
                'id': a.id,
                'title': a.title,
                'type': a.type,
                'message': a.message,
            }
            for a in rows
            if a.is_live()
        ]
    except Exception:
        return []


def serialize_portal_plan(plan):
    return {
        'id': plan.id,
        'name': plan.name,
        'description': plan.description,
        'speed': plan.speed,
        'price': float(plan.price),
        'plan_type': plan.plan_type or 'pppoe',
        'duration_hours': plan.duration_hours,
        'billing_cycle_days': plan.billing_cycle_days or 30,
        'bandwidth_limit': plan.bandwidth_limit,
        'data_limit': plan.data_limit,
        'session_timeout': plan.session_timeout,
        'popular': plan.popular,
        'features': plan.features or {},
        'duration_label': _duration_label(plan),
    }


def _duration_label(plan):
    if plan.plan_type == 'hotspot' and plan.duration_hours:
        if plan.duration_hours < 24:
            return f'{plan.duration_hours} hour(s)'
        days = plan.duration_hours // 24
        return f'{days} day(s)' if plan.duration_hours % 24 == 0 else f'{plan.duration_hours} hours'
    if plan.billing_cycle_days:
        return f'{plan.billing_cycle_days} days'
    return '30 days'


def list_portal_plans(isp_id, plan_type='hotspot'):
    isp = get_default_isp(isp_id)
    if not isp:
        return []

    if plan_type == 'hotspot' and hasattr(isp, 'hotspot_enabled') and isp.hotspot_enabled is False:
        return []
    if plan_type == 'pppoe' and hasattr(isp, 'pppoe_enabled') and isp.pppoe_enabled is False:
        return []

    return ServicePlan.query.filter_by(
        isp_id=isp.id,
        is_active=True,
        plan_type=plan_type,
    ).order_by(ServicePlan.price.asc()).all()


def get_customer_access_state(customer):
    now = datetime.utcnow()
    if customer.status == CustomerStatus.SUSPENDED:
        return {
            'state': 'suspended',
            'has_internet': False,
            'title': 'Service suspended',
            'message': 'Your internet is off because your account is suspended. Pay your package to restore access.',
        }
    if customer.subscription_end and customer.subscription_end.replace(tzinfo=None) < now:
        return {
            'state': 'expired',
            'has_internet': False,
            'title': 'Package expired',
            'message': 'Your monthly package has ended and you no longer have internet. Renew below to continue.',
            'expired_at': customer.subscription_end.isoformat(),
        }
    if customer.status != CustomerStatus.ACTIVE:
        return {
            'state': 'inactive',
            'has_internet': False,
            'title': 'Account inactive',
            'message': 'Your account is not active. Complete payment to enable your connection.',
        }
    return {
        'state': 'active',
        'has_internet': True,
        'title': 'You are online',
        'message': 'Your package is active and internet access is enabled.',
        'expires_at': customer.subscription_end.isoformat() if customer.subscription_end else None,
    }


def lookup_pppoe_customer(isp_id, account):
    isp = get_default_isp(isp_id)
    if not isp:
        return None, 'ISP not found'

    account = (account or '').strip().lower()
    if not account:
        return None, 'Account username is required'

    customer = Customer.query.filter(
        Customer.isp_id == isp.id,
        Customer.connection_type == 'pppoe',
        or_(
            Customer.email.ilike(account),
            Customer.phone == account,
            Customer.phone == normalize_phone(account),
        ),
    ).first()

    if not customer:
        rad = RadCheck.query.filter(
            RadCheck.isp_id == isp.id,
            RadCheck.username.ilike(account),
            RadCheck.is_active == True,
        ).first()
        if rad and rad.customer_id:
            customer = Customer.query.get(rad.customer_id)

    if not customer:
        return None, 'Account not found. Check your PPPoE username, email, or phone number.'

    return customer, None


def lookup_wireguard_customer(isp_id, account):
    isp = get_default_isp(isp_id)
    if not isp:
        return None, 'ISP not found'

    account = (account or '').strip().lower()
    if not account:
        return None, 'Email or account is required'

    customer = Customer.query.filter(
        Customer.isp_id == isp.id,
        Customer.connection_type == 'wireguard',
        or_(
            Customer.email.ilike(account),
            Customer.phone == account,
            Customer.phone == normalize_phone(account),
        ),
    ).first()

    if not customer:
        return None, 'WireGuard account not found.'

    return customer, None


def serialize_wireguard_status(customer):
    from models import WireGuardPeer
    from services.wireguard_provisioning import serialize_peer

    access = get_customer_access_state(customer)
    plan = customer.service_plan
    peer = WireGuardPeer.query.filter_by(customer_id=customer.id, is_active=True).first()

    return {
        'customer_id': customer.id,
        'full_name': customer.full_name,
        'email': customer.email,
        'package': plan.name if plan else customer.package,
        'access': access,
        'subscription_end': customer.subscription_end.isoformat() if customer.subscription_end else None,
        'peer': serialize_peer(peer, plan=plan) if peer else None,
    }


def serialize_pppoe_status(customer):
    access = get_customer_access_state(customer)
    plan = customer.service_plan
    amount_due = float(plan.price) if plan else float(customer.balance or 0)

    pending_invoice = Invoice.query.filter_by(
        customer_id=customer.id,
        status=InvoiceStatus.PENDING,
    ).order_by(Invoice.due_date.asc()).first()

    if pending_invoice:
        amount_due = float(pending_invoice.amount)

    return {
        'customer_id': customer.id,
        'full_name': customer.full_name,
        'email': customer.email,
        'phone': customer.phone,
        'package': plan.name if plan else customer.package,
        'plan_id': plan.id if plan else customer.service_plan_id,
        'amount_due': amount_due,
        'access': access,
        'subscription_end': customer.subscription_end.isoformat() if customer.subscription_end else None,
        'needs_payment': not access['has_internet'],
    }


def _create_invoice(customer, plan, isp):
    invoice = Invoice(
        invoice_number=f'INV-PORTAL-{uuid.uuid4().hex[:8].upper()}',
        amount=plan.price,
        status=InvoiceStatus.PENDING,
        due_date=datetime.utcnow(),
        notes=f'Portal purchase — {plan.name}',
        customer_id=customer.id,
        isp_id=isp.id,
    )
    db.session.add(invoice)
    db.session.flush()
    return invoice


def find_or_create_hotspot_customer(isp, plan, phone, full_name=None):
    email = hotspot_login_email(isp, phone)
    phone_norm = normalize_phone(phone)

    customer = Customer.query.filter_by(email=email, isp_id=isp.id).first()
    if not customer:
        customer = Customer(
            full_name=full_name or f'Hotspot Guest {phone_norm[-4:]}',
            email=email,
            phone=phone_norm,
            package=plan.name,
            connection_type='hotspot',
            status=CustomerStatus.PENDING,
            isp_id=isp.id,
            service_plan_id=plan.id,
        )
        from services.radius_provisioning import set_customer_radius_password
        set_customer_radius_password(customer, password=generate_hotspot_password(isp))
        db.session.add(customer)
        db.session.flush()
    else:
        customer.service_plan_id = plan.id
        customer.package = plan.name
        customer.connection_type = 'hotspot'
        if not customer.radius_password_encrypted:
            from services.radius_provisioning import set_customer_radius_password
            set_customer_radius_password(customer, password=generate_hotspot_password(isp))

    return customer


def lookup_hotspot_customer(isp_id, phone=None, username=None):
    isp = get_default_isp(isp_id)
    if not isp:
        return None, 'ISP not found'

    account = (username or '').strip().lower()
    if phone:
        email = hotspot_login_email(isp, phone)
        customer = Customer.query.filter_by(email=email, isp_id=isp.id, connection_type='hotspot').first()
        if customer:
            return customer, None
        phone_norm = normalize_phone(phone)
        customer = Customer.query.filter_by(phone=phone_norm, isp_id=isp.id, connection_type='hotspot').first()
        if customer:
            return customer, None

    if account:
        customer = Customer.query.filter(
            Customer.isp_id == isp.id,
            Customer.connection_type == 'hotspot',
            Customer.email.ilike(account),
        ).first()
        if not customer:
            rad = RadCheck.query.filter(
                RadCheck.isp_id == isp.id,
                RadCheck.username.ilike(account),
                RadCheck.is_active == True,
            ).first()
            if rad and rad.customer_id:
                customer = Customer.query.get(rad.customer_id)
        if customer:
            return customer, None

    return None, 'No hotspot account found for that phone or username.'


def serialize_hotspot_status(customer):
    from services.radius_provisioning import get_customer_radius_password, radius_username
    access = get_customer_access_state(customer)
    plan = customer.service_plan
    now = datetime.utcnow()
    remaining = None
    if customer.subscription_end and access['has_internet']:
        delta = customer.subscription_end.replace(tzinfo=None) - now
        remaining = max(0, int(delta.total_seconds()))

    return {
        'customer_id': customer.id,
        'full_name': customer.full_name,
        'phone': customer.phone,
        'package': plan.name if plan else customer.package,
        'access': access,
        'subscription_end': customer.subscription_end.isoformat() if customer.subscription_end else None,
        'remaining_seconds': remaining,
        'wifi_credentials': {
            'username': radius_username(customer),
            'password': get_customer_radius_password(customer),
        } if access['has_internet'] else None,
        'after_login_redirect_url': None,
    }


def redeem_hotspot_voucher(isp_id, code, phone=None, router_id=None):
    from models import HotspotAccessCode, MikrotikDevice
    from services.radius_provisioning import activate_customer_after_payment

    isp = get_default_isp(isp_id)
    if not isp:
        return None, 'ISP not found'
    if hasattr(isp, 'hotspot_enabled') and isp.hotspot_enabled is False:
        return None, 'Hotspot is not enabled for this network'

    code = (code or '').strip().upper()
    if not code:
        return None, 'Voucher code is required'

    voucher = HotspotAccessCode.query.filter_by(isp_id=isp.id, code=code).first()
    if not voucher or not voucher.is_valid():
        return None, 'Invalid or expired voucher code'

    if voucher.device_id and router_id and voucher.device_id != int(router_id):
        return None, 'This voucher is not valid for this location'

    plan = ServicePlan.query.get(voucher.plan_id)
    if not plan or not plan.is_active:
        return None, 'Voucher plan is no longer available'

    phone_norm = normalize_phone(phone) if phone else f'voucher{voucher.id}'
    customer = find_or_create_hotspot_customer(isp, plan, phone_norm, full_name=f'Voucher {code}')
    activate_customer_after_payment(customer, isp, plan=plan, stack_time=True)

    voucher.use_count = (voucher.use_count or 0) + 1
    voucher.used_at = datetime.utcnow()
    voucher.used_by_customer_id = customer.id
    if voucher.use_count >= voucher.max_uses:
        voucher.status = 'used'

    db.session.commit()

    from services.radius_provisioning import get_customer_radius_password, radius_username
    return {
        'wifi_credentials': {
            'username': radius_username(customer),
            'password': get_customer_radius_password(customer),
        },
        'expires_at': customer.subscription_end.isoformat() if customer.subscription_end else None,
        'access': get_customer_access_state(customer),
        'plan': serialize_portal_plan(plan),
    }, None


def initiate_portal_payment(customer, plan, isp, phone, invoice=None):
    if not invoice:
        invoice = _create_invoice(customer, plan, isp)

    try:
        stk = initiate_stk_push(
            phone,
            float(plan.price),
            invoice.invoice_number,
            'WiFi Portal — Lumen',
            isp=isp,
        )
    except MpesaError as exc:
        raise exc

    payment = create_pending_mpesa_payment(
        customer=customer,
        invoice=invoice,
        amount=float(plan.price),
        phone=normalize_phone(phone),
        checkout_request_id=stk.get('CheckoutRequestID'),
        merchant_request_id=stk.get('MerchantRequestID'),
    )
    db.session.commit()

    return {
        'checkout_request_id': stk.get('CheckoutRequestID'),
        'merchant_request_id': stk.get('MerchantRequestID'),
        'customer_message': stk.get('CustomerMessage'),
        'payment_id': payment.id,
        'invoice_id': invoice.id,
        'customer_id': customer.id,
        'amount': float(plan.price),
    }


def purchase_hotspot_package(isp_id, plan_id, phone, full_name=None, router_id=None):
    isp = get_default_isp(isp_id)
    if not isp:
        return None, 'ISP not found'
    if hasattr(isp, 'hotspot_enabled') and isp.hotspot_enabled is False:
        return None, 'Hotspot purchases are not available on this network'

    plan = ServicePlan.query.filter_by(
        id=plan_id,
        isp_id=isp.id,
        is_active=True,
        plan_type='hotspot',
    ).first()
    if not plan:
        return None, 'Hotspot package not found'

    customer = find_or_create_hotspot_customer(isp, plan, phone, full_name)
    try:
        result = initiate_portal_payment(customer, plan, isp, phone)
        result['plan'] = serialize_portal_plan(plan)
        return result, None
    except MpesaError as exc:
        db.session.rollback()
        return None, str(exc)


def renew_pppoe_package(isp_id, account, phone, plan_id=None):
    customer, error = lookup_pppoe_customer(isp_id, account)
    if error:
        return None, error

    isp = get_default_isp(isp_id)
    plan = None
    if plan_id:
        plan = ServicePlan.query.filter_by(id=plan_id, isp_id=isp.id, plan_type='pppoe').first()
    if not plan:
        plan = customer.service_plan
    if not plan:
        return None, 'No PPPoE package found for this account'

    customer.service_plan_id = plan.id
    customer.package = plan.name
    customer.connection_type = 'pppoe'

    try:
        result = initiate_portal_payment(customer, plan, isp, phone)
        result['plan'] = serialize_portal_plan(plan)
        result['access'] = get_customer_access_state(customer)
        return result, None
    except MpesaError as exc:
        db.session.rollback()
        return None, str(exc)


def get_portal_payment_status(checkout_request_id):
    payment = Payment.query.filter_by(mpesa_checkout_request_id=checkout_request_id).first()
    if not payment:
        return None, 'Payment not found'

    customer = payment.customer
    payload = {
        'payment_id': payment.id,
        'status': payment.payment_status.value,
        'amount': float(payment.amount),
        'receipt': payment.mpesa_receipt_number,
        'customer_id': payment.customer_id,
        'invoice_id': payment.invoice_id,
        'connection_type': customer.connection_type if customer else None,
    }

    if payment.payment_status == PaymentStatus.COMPLETED and customer:
        payload['access'] = get_customer_access_state(customer)
        if customer.connection_type == 'hotspot':
            payload['wifi_credentials'] = {
                'username': radius_username(customer),
                'password': get_customer_radius_password(customer),
            }
            payload['expires_at'] = (
                customer.subscription_end.isoformat() if customer.subscription_end else None
            )

    return payload, None


def plan_subscription_end(plan, from_time=None, stack_from=None):
    from services.plan_utils import plan_subscription_end as _end
    return _end(plan, from_time=from_time, stack_from=stack_from)
