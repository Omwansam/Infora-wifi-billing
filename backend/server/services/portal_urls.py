"""Build public captive-portal URLs (used by router provisioning + SMS templates).

The billing API (Flask) and the captive portal SPA (React/Vite) may run on
different origins in local development:

  - API:      http://localhost:5000
  - Portal:   http://localhost:5173/portal

In production they usually share one public hostname behind nginx.

Use ``portal_frontend_base_url()`` / ``portal_entry_url()`` for customer-facing
portal links. Use ``public_base_url()`` for API-served assets (logos, etc.).
"""
import os
from urllib.parse import urlencode, urlparse


def _env_base(*var_names):
    for var in var_names:
        base = (os.environ.get(var) or '').strip().rstrip('/')
        if base:
            return base
    return ''


def portal_frontend_base_url(isp=None):
    """Origin where the React captive portal SPA is hosted."""
    if isp is not None and getattr(isp, 'custom_domain', None):
        domain = isp.custom_domain.strip().rstrip('/')
        if domain:
            return domain if '://' in domain else f'https://{domain}'

    explicit = _env_base('PORTAL_BASE_URL')
    if explicit:
        return explicit

    is_dev = os.getenv('FLASK_ENV', 'development').lower() in ('development', 'dev')

    # Production (or staging): one public hostname serves API + SPA.
    shared = _env_base('PUBLIC_BASE_URL', 'PROVISION_BASE_URL')
    if shared:
        if is_dev:
            parsed = urlparse(shared if '://' in shared else f'http://{shared}')
            api_ports = {5000, 5080, 8000}
            local_hosts = {'localhost', '127.0.0.1'}
            if not (parsed.hostname in local_hosts and (parsed.port in api_ports or parsed.port is None)):
                return shared
        else:
            return shared

    if is_dev:
        return 'http://localhost:5173'

    return ''


def public_base_url():
    """Origin for browser-reachable API assets (uploaded logos, etc.)."""
    base = _env_base('PUBLIC_BASE_URL', 'PROVISION_BASE_URL')
    if base:
        return base
    if os.getenv('FLASK_ENV', 'development').lower() in ('development', 'dev'):
        return 'http://localhost:5000'
    return ''


def _isp_for_portal(isp_id):
    if not isp_id:
        return None
    try:
        from models import ISP
        return ISP.query.get(isp_id)
    except Exception:
        return None


def portal_entry_url(isp_id=None, router_id=None, tab=None, isp=None):
    """Absolute URL customers open from the captive network."""
    isp_obj = isp if isp is not None else _isp_for_portal(isp_id)
    base = portal_frontend_base_url(isp_obj)
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

    for base in (portal_frontend_base_url(isp), public_base_url()):
        if base:
            parsed = urlparse(base if '://' in base else f'https://{base}')
            if parsed.hostname:
                hosts.add(parsed.hostname.lower())

    if isp and getattr(isp, 'custom_domain', None):
        domain = isp.custom_domain.strip().lower().replace('https://', '').replace('http://', '').strip('/')
        if domain:
            hosts.add(domain.split('/')[0])

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
