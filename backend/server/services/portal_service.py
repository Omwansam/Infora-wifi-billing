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
from services.radius_provisioning import (
    get_customer_radius_password,
    radius_username,
    set_customer_radius_password,
)


def normalize_phone(phone):
    digits = re.sub(r'\D', '', str(phone or ''))
    if digits.startswith('0'):
        digits = '254' + digits[1:]
    elif digits.startswith('7') or digits.startswith('1'):
        digits = '254' + digits
    elif not digits.startswith('254'):
        digits = '254' + digits
    return digits


def hotspot_portal_email(phone):
    return f'{normalize_phone(phone)}@hotspot.portal'


def get_default_isp(isp_id=None):
    if isp_id:
        isp = ISP.query.filter_by(id=isp_id, is_active=True).first()
        if isp:
            return isp
    return ISP.query.filter_by(is_active=True).first()


def get_portal_settings():
    rows = SystemSetting.query.filter_by(category='portal').all()
    return {row.key: row.value for row in rows}


def get_portal_config(isp_id=None):
    isp = get_default_isp(isp_id)
    if not isp:
        return None

    settings = get_portal_settings()
    company_name = sanitize_brand_text(isp.company_name, BRAND_COMPANY)
    isp_display_name = sanitize_brand_text(isp.name, BRAND_NAME)
    return {
        'isp_id': isp.id,
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
        'support_phone': settings.get('portal_support_phone', isp.phone),
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
    }


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
    email = hotspot_portal_email(phone)
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
        set_customer_radius_password(customer)
        db.session.add(customer)
        db.session.flush()
    else:
        customer.service_plan_id = plan.id
        customer.package = plan.name
        customer.connection_type = 'hotspot'
        if not customer.radius_password_encrypted:
            set_customer_radius_password(customer)

    return customer


def initiate_portal_payment(customer, plan, isp, phone, invoice=None):
    if not invoice:
        invoice = _create_invoice(customer, plan, isp)

    try:
        stk = initiate_stk_push(
            phone,
            float(plan.price),
            invoice.invoice_number,
            'WiFi Portal — Lumen',
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


def purchase_hotspot_package(isp_id, plan_id, phone, full_name=None):
    isp = get_default_isp(isp_id)
    if not isp:
        return None, 'ISP not found'

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


def plan_subscription_end(plan, from_time=None):
    from_time = from_time or datetime.utcnow()
    if plan.plan_type == 'hotspot':
        hours = plan.duration_hours or 24
        return from_time + timedelta(hours=hours)
    days = plan.billing_cycle_days or 30
    return from_time + timedelta(days=days)
