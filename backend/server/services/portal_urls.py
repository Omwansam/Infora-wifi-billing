"""Build public captive-portal URLs (used by router provisioning + SMS templates)."""
import os
from urllib.parse import urlencode, urlparse


def public_base_url():
    for var in ('PUBLIC_BASE_URL', 'PROVISION_BASE_URL'):
        base = (os.environ.get(var) or '').strip().rstrip('/')
        if base:
            return base
    return ''


def portal_entry_url(isp_id, router_id=None, tab=None):
    """Absolute URL customers open from the captive network."""
    base = public_base_url()
    if not base:
        return ''
    params = {}
    if isp_id:
        params['isp_id'] = isp_id
    if router_id:
        params['router_id'] = router_id
    if tab:
        params['tab'] = tab
    qs = f'?{urlencode(params)}' if params else ''
    return f'{base}/portal{qs}'


def portal_hostnames(isp=None):
    """Hostnames to allow in MikroTik walled garden."""
    hosts = set()
    base = public_base_url()
    if isp and getattr(isp, 'custom_domain', None):
        hosts.add(isp.custom_domain.strip().lower())
    if base:
        parsed = urlparse(base if '://' in base else f'https://{base}')
        if parsed.hostname:
            hosts.add(parsed.hostname.lower())
    # Captive detection + payments + DNS
    for h in (
        'connectivitycheck.gstatic.com',
        'www.google.com',
        'clients3.google.com',
        'captive.apple.com',
        'www.msftconnecttest.com',
        'safaricom.co.ke',
        'api.safaricom.co.ke',
        'mpesa.safaricom.co.ke',
    ):
        hosts.add(h)
    return sorted(hosts)
