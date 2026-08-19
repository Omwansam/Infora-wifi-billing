import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

class Config:
    # App  Configuration
    SECRET_KEY = os.getenv('SECRET_KEY')
    ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', SECRET_KEY)
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'
    
    
    # Email configuration 
    MAIL_SERVER = os.getenv('MAIL_SERVER')
    MAIL_PORT = int(os.getenv('MAIL_PORT', '587'))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'true').lower() == 'true'
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER')

    #M-Pesa Configuration
    MPESA_CONSUMER_KEY = os.getenv('MPESA_CONSUMER_KEY')
    MPESA_CONSUMER_SECRET = os.getenv('MPESA_CONSUMER_SECRET')
    MPESA_SHORTCODE = os.getenv('MPESA_SHORTCODE')
    MPESA_PASSKEY = os.getenv('MPESA_PASSKEY')
    MPESA_CALLBACK_URL = os.getenv('MPESA_CALLBACK_URL', 'http://localhost:5000/api/payments/mpesa/callback')
    MPESA_ENVIRONMENT = os.getenv('MPESA_ENVIRONMENT', 'sandbox')
    MPESA_TRANSACTION_TYPE = os.getenv('MPESA_TRANSACTION_TYPE', 'CustomerPayBillOnline')
    # The Daraja auth / STK-push base URLs are derived per-request in
    # services/mpesa_service.py from the effective environment (sandbox vs live),
    # which may be overridden per-ISP in Settings > Payments.

    # Subscription expiry (optional background thread; prefer cron: flask enforce-expiry)
    SUBSCRIPTION_ENFORCEMENT_INTERVAL = int(os.getenv('SUBSCRIPTION_ENFORCEMENT_INTERVAL', '0') or '0')
    SUBSCRIPTION_GRACE_HOURS = int(os.getenv('SUBSCRIPTION_GRACE_HOURS', '0') or '0')
    # FUP throttle enforcement (optional background thread; prefer cron: flask enforce-fup)
    FUP_ENFORCEMENT_INTERVAL = int(os.getenv('FUP_ENFORCEMENT_INTERVAL', '0') or '0')
    RADIUS_SECRET = os.getenv('RADIUS_SECRET', 'radius_secret_key')
    FREERADIUS_HOST = os.getenv('FREERADIUS_HOST', '10.0.0.10')
    WIREGUARD_CONFIG_DIR = os.getenv(
        'WIREGUARD_CONFIG_DIR',
        os.path.join(os.path.dirname(os.path.abspath(__file__)), 'wireguard_configs'),
    )
    WIREGUARD_MIKROTIK_AUTO_PUSH = os.getenv('WIREGUARD_MIKROTIK_AUTO_PUSH', 'true').lower() in ('1', 'true', 'yes')
    # Public IP/hostname shown in MikroTik scripts and WireGuard client configs
    PUBLIC_SERVER_HOST = os.getenv('PUBLIC_SERVER_HOST', os.getenv('FREERADIUS_HOST', ''))
    RADIUS_CLIENTS_CONF_PATH = os.getenv(
        'RADIUS_CLIENTS_CONF_PATH',
        os.path.abspath(
            os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                '..',
                '..',
                'config',
                'freeradius',
                'clients.conf',
            )
        ),
    )
    # Management WireGuard tunnel (MikroTik → billing host, distinct from customer VPN)
    WIREGUARD_MGMT_SUBNET = os.getenv('WIREGUARD_MGMT_SUBNET', '10.250.0.0/24')
    WIREGUARD_MGMT_SERVER_IP = os.getenv('WIREGUARD_MGMT_SERVER_IP', '10.250.0.1')
    WIREGUARD_MGMT_PORT = int(os.getenv('WIREGUARD_MGMT_PORT', '51821'))
    WIREGUARD_MGMT_ENDPOINT = os.getenv('WIREGUARD_MGMT_ENDPOINT', os.getenv('PUBLIC_SERVER_HOST', ''))
    # A router on the management tunnel keepalives every 25s and netwatch-pings
    # the server every 60s, so a single failed probe/SSH does NOT mean it's down.
    # Only flip a device OFFLINE after this many seconds with no proven contact
    # (hysteresis) — keeps a live router stuck ONLINE instead of flapping.
    DEVICE_OFFLINE_GRACE_SECONDS = int(os.getenv('DEVICE_OFFLINE_GRACE_SECONDS', '300'))
    # Inbound proof-of-life windows. These are router→server signals, so unlike
    # an outbound probe they still work when the server has no WireGuard
    # endpoint for a NAT'd peer (see services/device_liveness.py).
    DEVICE_RADIUS_EVIDENCE_SECONDS = int(os.getenv('DEVICE_RADIUS_EVIDENCE_SECONDS', '900'))
    DEVICE_PROVISION_EVIDENCE_SECONDS = int(os.getenv('DEVICE_PROVISION_EVIDENCE_SECONDS', '600'))

    # --- Platform subscription (what a tenant ISP pays us) -----------------
    # The console locks when subscription_expires_at + grace passes. Existing
    # tenants have no expiry set and are therefore never locked until one is.
    PLATFORM_VENDOR_NAME = os.getenv('PLATFORM_VENDOR_NAME', 'Lumen')
    PLATFORM_TRIAL_DAYS = int(os.getenv('PLATFORM_TRIAL_DAYS', '14'))
    PLATFORM_BILLING_PERIOD_DAYS = int(os.getenv('PLATFORM_BILLING_PERIOD_DAYS', '30'))
    # Days after expiry before the console actually closes. 0 = lock on expiry.
    PLATFORM_GRACE_DAYS = int(os.getenv('PLATFORM_GRACE_DAYS', '0'))
    # How early the next invoice is raised, so a tenant can pay before lockout.
    PLATFORM_ISSUE_LEAD_DAYS = int(os.getenv('PLATFORM_ISSUE_LEAD_DAYS', '7'))

    # --- TR-069 / CWMP ACS ------------------------------------------------
    # URL the CPE is configured to call home to. Must be reachable from the
    # subscriber network and, in production, served on its own vhost/port
    # (7547 is the IANA CWMP port) — never behind a CDN/WAF, which mangles SOAP.
    TR069_ACS_URL = os.getenv('TR069_ACS_URL', '')
    # Onboarding mode: allow a CPE with unrecognised credentials to register
    # itself (landing in 'pending', where it receives no tasks). Off by default —
    # an ACS is exposed to the whole internet.
    TR069_ALLOW_UNKNOWN = os.getenv('TR069_ALLOW_UNKNOWN', 'false').lower() in ('1', 'true', 'yes')
    # Default PeriodicInformInterval handed to newly seen devices, in seconds.
    # Also the ceiling on how long a queued task waits before delivery.
    TR069_PERIODIC_INFORM_INTERVAL = int(os.getenv('TR069_PERIODIC_INFORM_INTERVAL', '300'))
    # How long CWMP session rows are kept (pruned by data retention).
    TR069_SESSION_RETENTION_DAYS = int(os.getenv('TR069_SESSION_RETENTION_DAYS', '7'))
    # Timezone applied to MikroTik routers during self-provisioning
    ROUTER_TIMEZONE = os.getenv('ROUTER_TIMEZONE', 'Africa/Nairobi')
    # Public base URL the router uses to fetch its provisioning script (HTTPS)
    PROVISION_BASE_URL = os.getenv('PROVISION_BASE_URL', '')
    CORS_ORIGINS = [
        o.strip()
        for o in os.getenv(
            'CORS_ORIGINS',
            'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174',
        ).split(',')
        if o.strip()
    ]
    
    # File upload configuration
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    
    # Pagination
    ITEMS_PER_PAGE = 20