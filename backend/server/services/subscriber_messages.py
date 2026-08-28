"""The SMS bodies the subscriber detail page offers to send.

Composed here rather than in the route so the dialog can *preview* exactly what
will go out and the operator can edit it before committing. A preview that is
regenerated differently at send time is worse than no preview at all, so the
same function feeds both, and an edited body is sent verbatim.

Collection details come from ``PaymentSettings`` — the row Settings > Payments
writes. An earlier version read ``isp.mpesa_shortcode``, which is not a field on
ISP, so every payment-details SMS went out reading "pay via M-Pesa Paybill ,
Account <phone>": no paybill, and the subscriber's phone number standing in for
an account number.
"""

from models import PaymentSettings
from services.radius_provisioning import get_customer_radius_password, radius_username

# What the subscriber should quote when paying. The account number is the
# payment reference the M-Pesa callback matches on, so it is the right value
# even when a per-ISP paybill account string is also configured.
def payment_reference(customer):
    return customer.account_number or radius_username(customer) or str(customer.id)


def _settings(customer):
    if not customer.isp_id:
        return None
    return PaymentSettings.query.filter_by(isp_id=customer.isp_id).first()


def collection_details(customer):
    """How this ISP takes money, as (label, lines[]) for a message or a preview."""
    settings = _settings(customer)
    reference = payment_reference(customer)

    if settings is None:
        return 'unconfigured', []

    route = (settings.collection_route or 'paybill').lower()
    if route == 'buygoods' and settings.buygoods_till:
        return 'buygoods', [f'Buy Goods Till {settings.buygoods_till}']
    if route == 'bank' and settings.bank_paybill:
        lines = [f'Bank Paybill {settings.bank_paybill}']
        if settings.bank_account:
            lines.append(f'Bank account {settings.bank_account}')
        lines.append(f'Reference {reference}')
        return 'bank', lines
    if settings.paybill_shortcode:
        return 'paybill', [
            f'Paybill {settings.paybill_shortcode}',
            f'Account {settings.paybill_account or reference}',
        ]
    return 'unconfigured', []


def _isp_name(customer):
    isp = customer.isp
    if not isp:
        return 'your ISP'
    return isp.name or isp.company_name or 'your ISP'


def _first_name(customer):
    return (customer.full_name or '').split(' ')[0] or 'there'


def _amount_due(customer):
    plan = customer.service_plan
    if plan is not None and plan.price is not None:
        return float(plan.price)
    return float(customer.balance or 0)


def payment_details_body(customer):
    """The 'here is how to pay' SMS."""
    plan = customer.service_plan
    amount = _amount_due(customer)
    _route, lines = collection_details(customer)

    opening = f'Hi {_first_name(customer)}, to renew your {_isp_name(customer)} internet'
    if plan is not None:
        opening += f' ({plan.name}'
        if amount:
            opening += f', Ksh {amount:,.0f}'
        opening += ')'
    elif amount:
        opening += f' (Ksh {amount:,.0f})'

    if not lines:
        # No collection route configured: say so plainly rather than sending a
        # message with a blank paybill in it.
        return (f'{opening}, please contact {_isp_name(customer)} for payment '
                f'details. Your account number is {payment_reference(customer)}.')

    return f'{opening}, pay: ' + ', '.join(lines) + '.'


def credentials_body(customer, password=None):
    """The 'here is your login' SMS."""
    password = password or get_customer_radius_password(customer)
    return (
        f'Hi {_first_name(customer)}, your {_isp_name(customer)} internet login — '
        f'username: {radius_username(customer)}, password: {password}. '
        f'Keep them safe.'
    )


def preview(customer, kind):
    """(body, extras) for one message kind, or (None, error) if unavailable."""
    if kind == 'payment_details':
        route, lines = collection_details(customer)
        return payment_details_body(customer), {
            'collection_route': route,
            'collection_lines': lines,
            'reference': payment_reference(customer),
            'amount': _amount_due(customer),
        }

    if kind == 'credentials':
        if customer.connection_type not in ('pppoe', 'hotspot'):
            return None, {'error': 'Only PPPoE and hotspot accounts have connection credentials'}
        password = get_customer_radius_password(customer)
        if not password:
            return None, {'error': 'No password is stored for this account — reset it first'}
        return credentials_body(customer, password), {
            'username': radius_username(customer),
            'password': password,
        }

    return None, {'error': f'Unknown message kind "{kind}"'}
