from flask import Flask, jsonify, request
from config import Config
from flask_cors import CORS
from extensions import db, migrate, jwt
from models import User, LDAPServer, RadiusClient, SnmpDevice, VPNConfig, EapProfile, RadCheck, RadReply, RadAcct, RadUserGroup, RadGroupCheck, RadGroupReply
from routes.auth import auth_bp
from routes.customers import customers_bp
from routes.subscriber_detail import subscriber_bp
from routes.invoices import invoices_bp
from routes.plans import plans_bp
from routes.devices import devices_bp
from routes.webfig_proxy import webfig_bp
from routes.equipment import equipment_bp
from routes.isps import isps_bp
from routes.ldap import ldap_bp
from routes.radius import radius_bp
from routes.radius_api import radius_api_bp
from routes.radius_routes import radius_routes_bp
from routes.billing import billing_bp
from routes.snmp import snmp_bp
from routes.vpn import vpn_bp
from routes.eap import eap_bp
from routes.tickets import tickets_bp
from routes.dashboard import dashboard_bp
from routes.finance import finance_bp
from routes.kyc import kyc_bp
from routes.payments import payments_bp
from routes.portal import portal_bp
from routes.website import website_bp
from routes.wireguard import wireguard_bp
from routes.monitoring import monitoring_bp
from routes.health import health_bp
from routes.provision import provision_bp
from routes.settings import settings_bp
from routes.support import support_bp
from routes.reports import reports_bp
from routes.imports import imports_bp
from routes.onboarding import onboarding_bp
from routes.tr069 import tr069_bp
from routes.cpe import cpe_bp
from routes.platform import platform_bp
from routes.fiber import fiber_bp
from services.subscription_expiry import enforce_expired_subscriptions
import click
import logging
import warnings
from datetime import datetime

# Only show standard Werkzeug HTTP access logs in the terminal
logging.basicConfig(level=logging.WARNING, format='%(message)s')
logging.getLogger('werkzeug').setLevel(logging.INFO)
for _logger_name in ('flask.app', 'sqlalchemy.engine', 'alembic'):
    logging.getLogger(_logger_name).setLevel(logging.WARNING)
warnings.filterwarnings('ignore', category=DeprecationWarning, module='jwt')

app = Flask(__name__)
app.config.from_object(Config)
app.url_map.strict_slashes = False

# Initialize extensions with CORS (production domain via CORS_ORIGINS env)
CORS(app,
     origins=app.config.get('CORS_ORIGINS', [
         'http://localhost:5173',
         'http://127.0.0.1:5173',
     ]),
     supports_credentials=True,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'])

db.init_app(app)
migrate.init_app(app, db)
jwt.init_app(app)


@jwt.invalid_token_loader
def _invalid_token(reason):
    # Legacy tokens (dict `sub`) fail PyJWT >= 2.10 decoding; return 401 instead
    # of the default 422 so clients treat it as "re-authenticate".
    return jsonify({'error': 'Invalid session token. Please log in again.', 'msg': reason}), 401

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(customers_bp)
# Same /api/customers prefix, different concern: the detail page's history,
# time series and account actions. Distinct blueprint name keeps endpoints unique.
app.register_blueprint(subscriber_bp)
app.register_blueprint(invoices_bp)
app.register_blueprint(plans_bp)
app.register_blueprint(devices_bp)
app.register_blueprint(webfig_bp)
app.register_blueprint(equipment_bp)
app.register_blueprint(isps_bp)
app.register_blueprint(ldap_bp)
app.register_blueprint(radius_bp)
app.register_blueprint(radius_api_bp)
app.register_blueprint(radius_routes_bp)
app.register_blueprint(billing_bp)
app.register_blueprint(snmp_bp)
app.register_blueprint(vpn_bp)
app.register_blueprint(eap_bp)
app.register_blueprint(tickets_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(finance_bp)
app.register_blueprint(kyc_bp)
app.register_blueprint(payments_bp)
app.register_blueprint(portal_bp)
app.register_blueprint(website_bp)
app.register_blueprint(wireguard_bp)
app.register_blueprint(monitoring_bp)
app.register_blueprint(health_bp)
app.register_blueprint(provision_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(support_bp)
app.register_blueprint(reports_bp)
app.register_blueprint(imports_bp)
# Public self-serve ISP signup (no JWT — see ONBOARDING.md).
app.register_blueprint(onboarding_bp)
# Device-facing CWMP endpoint (no JWT — CPE authenticate with HTTP Basic).
app.register_blueprint(tr069_bp)
app.register_blueprint(cpe_bp)
app.register_blueprint(platform_bp)
app.register_blueprint(fiber_bp)


def ensure_schema_upgrades():
    """Idempotent column additions — the image ships no Alembic migrations,
    and create_all() never alters existing tables."""
    from sqlalchemy import inspect as sa_inspect, text
    # table -> {column: DDL type}
    table_additions = {
        'mikrotik_devices': {
            'monitored_interfaces': 'TEXT',
            'wan_config': 'TEXT',
            'self_check_result': 'TEXT',
            'self_check_at': 'TIMESTAMP',
            'cpu_load': 'DOUBLE PRECISION',
            'mem_total': 'BIGINT',
            'mem_free': 'BIGINT',
            'hdd_total': 'BIGINT',
            'hdd_free': 'BIGINT',
        },
        'customers': {
            'fup_throttled': 'BOOLEAN DEFAULT FALSE NOT NULL',
            # Premises pin for the fiber map. NULL = not placed yet.
            'latitude': 'DOUBLE PRECISION',
            'longitude': 'DOUBLE PRECISION',
            'geo_source': 'VARCHAR(20)',
            'geo_updated_at': 'TIMESTAMP',
            # Migration/identity: operator login decoupled from email + stable
            # customer-facing account number (see radius_provisioning).
            'radius_login': 'VARCHAR(120)',
            'account_number': 'VARCHAR(40)',
            # Per-account grace after expiry, set from the Change-expiry dialog.
            'grace_period_days': 'INTEGER DEFAULT 0',
            # Operator FUP override window (see services.fup_enforcement).
            'fup_exempt_until': 'TIMESTAMP',
            'fup_override_mode': 'VARCHAR(12)',
            'fup_override_reason': 'TEXT',
            'fup_override_until': 'TIMESTAMP',
            # Auto-resume alarm for a paused subscription.
            'pause_until': 'TIMESTAMP',
        },
        'isps': {
            'account_number_prefix': 'VARCHAR(12)',
            'account_number_seq': 'INTEGER DEFAULT 100000',
            # Self-serve onboarding: permanent account address + operating locale.
            'slug': 'VARCHAR(63)',
            'country': 'VARCHAR(2)',
            'timezone': 'VARCHAR(64)',
            'referral_source': 'VARCHAR(60)',
            'onboarded_at': 'TIMESTAMP',
            # Platform subscription: what this tenant owes us, and when the
            # console locks if they do not pay it.
            'subscription_expires_at': 'TIMESTAMP',
            'subscription_is_trial': 'BOOLEAN DEFAULT TRUE',
            'subscription_amount': 'NUMERIC(12, 2)',
            # Which messaging gateway this tenant sends on. NULL = fall back to
            # the platform's own env-configured route. Credentials live in
            # integration_settings keyed by the same provider id.
            'sms_provider': 'VARCHAR(40)',
            'whatsapp_provider': 'VARCHAR(40)',
            # TR-069 bring-up: while this is in the future, an unknown CPE that
            # informs is allowed to self-register as `pending` instead of being
            # rejected outright. Needed because an installer rarely has the CPE's
            # serial in hand to pre-enrol it. See routes/cpe.py.
            'cpe_enrollment_until': 'TIMESTAMP',
            # Operator automation + AI assistant (Settings).
            'outage_compensation_enabled': 'BOOLEAN DEFAULT FALSE',
            'outage_min_minutes': 'INTEGER DEFAULT 15',
            'sales_digest_enabled': 'BOOLEAN DEFAULT FALSE',
            'sales_digest_frequency': 'VARCHAR(10)',
            'sales_digest_recipients': 'TEXT',
            'sales_digest_last_sent_at': 'TIMESTAMP',
            'ai_enabled': 'BOOLEAN DEFAULT FALSE',
            'ai_provider': 'VARCHAR(20)',
            'ai_model': 'VARCHAR(60)',
        },
        'cpe_devices': {
            # ONT position + which ODB/splitter port it hangs off, so a dimming
            # branch localises to a segment instead of looking like unrelated
            # slow customers.
            'latitude': 'DOUBLE PRECISION',
            'longitude': 'DOUBLE PRECISION',
            'fiber_node_id': 'INTEGER',
        },
        'import_candidates': {
            # Cutover progress + pre-cutover RADIUS verification (§14-15 of
            # ROUTER_SCAN_IMPORT_AND_TAKEOVER.md).
            'cutover_at': 'TIMESTAMP',
            'verify_state': 'VARCHAR(8)',
            'verify_detail': 'TEXT',
            'verified_at': 'TIMESTAMP',
        },
        'users': {
            'two_factor_enabled': 'BOOLEAN DEFAULT FALSE NOT NULL',
            'two_factor_secret': 'TEXT',
            'two_factor_backup_codes': 'TEXT',
            'whatsapp_number': 'VARCHAR(20)',
            'whatsapp_verified_at': 'TIMESTAMP',
            'email_verified_at': 'TIMESTAMP',
        },
    }
    try:
        inspector = sa_inspect(db.engine)
        for table, additions in table_additions.items():
            existing = {col['name'] for col in inspector.get_columns(table)}
            missing = {name: ddl for name, ddl in additions.items() if name not in existing}
            if not missing:
                continue
            with db.engine.begin() as conn:
                for column, ddl in missing.items():
                    conn.execute(text(f'ALTER TABLE {table} ADD COLUMN {column} {ddl}'))
            app.logger.info('Schema upgrade: added %s columns %s', table, ', '.join(missing))

        # Email is now optional (login no longer derives from it). Drop the
        # legacy NOT NULL if it's still there. Idempotent.
        try:
            email_col = next(
                (c for c in inspector.get_columns('customers') if c['name'] == 'email'),
                None,
            )
            if email_col is not None and not email_col.get('nullable', True):
                with db.engine.begin() as conn:
                    conn.execute(text('ALTER TABLE customers ALTER COLUMN email DROP NOT NULL'))
                app.logger.info('Schema upgrade: customers.email is now nullable')
        except Exception as exc:
            app.logger.warning('Schema upgrade (email nullable) skipped: %s', exc)

        # Per-ISP uniqueness for the decoupled login and the account number.
        # Partial unique indexes so many NULLs coexist. IF NOT EXISTS => idempotent.
        with db.engine.begin() as conn:
            conn.execute(text(
                'CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_isp_radius_login '
                'ON customers (isp_id, lower(radius_login)) WHERE radius_login IS NOT NULL'
            ))
            conn.execute(text(
                'CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_isp_account_number '
                'ON customers (isp_id, account_number) WHERE account_number IS NOT NULL'
            ))
            # The tenant account address. This index is not an optimisation —
            # it is what actually settles two signups racing for the same slug,
            # since the availability check at step 3 is only advisory.
            conn.execute(text(
                'CREATE UNIQUE INDEX IF NOT EXISTS uq_isps_slug '
                'ON isps (lower(slug)) WHERE slug IS NOT NULL'
            ))

        # New tables ship without migrations too: create_all() only runs from the
        # `initdb` CLI command, so an existing deployment never grows a table on
        # boot. checkfirst=True makes this a no-op once they exist.
        from models import (
            CpeDevice, CpeFirmware, CpeSession, CpeTask, ImportCandidate, ImportRun,
            CustomerEvent,
            DeviceOutage, DeviceResourceSample,
            FiberCable, FiberNode, FiberSplice,
            OnboardingSignup, PlatformInvoice,
        )
        for model in (ImportRun, ImportCandidate,
                      CpeDevice, CpeTask, CpeSession, CpeFirmware,
                      OnboardingSignup, PlatformInvoice,
                      # The device detail page's two history tabs read these.
                      DeviceOutage, DeviceResourceSample,
                      # The subscriber's lifecycle and package-history tabs.
                      CustomerEvent,
                      # Nodes first: cables and splices reference them.
                      FiberNode, FiberCable, FiberSplice):
            model.__table__.create(bind=db.engine, checkfirst=True)
    except Exception as exc:  # DB may not be ready yet (first boot runs initdb)
        app.logger.warning('Schema upgrade check skipped: %s', exc)


def backfill_account_numbers():
    """Assign account numbers to any customers that predate the column.

    Idempotent: only touches rows where account_number IS NULL, so after the
    first successful run subsequent boots are no-ops.
    """
    try:
        from models import Customer, ISP
        from services.radius_provisioning import ensure_account_number
        pending = Customer.query.filter(Customer.account_number.is_(None)).all()
        if not pending:
            return
        isp_cache = {}
        for customer in pending:
            if not customer.isp_id:
                continue
            isp = isp_cache.get(customer.isp_id)
            if isp is None:
                isp = ISP.query.get(customer.isp_id)
                isp_cache[customer.isp_id] = isp
            if isp is None:
                continue
            ensure_account_number(customer, isp)
        db.session.commit()
        app.logger.info('Backfilled account numbers for %d customers', len(pending))
    except Exception as exc:
        db.session.rollback()
        app.logger.warning('Account-number backfill skipped: %s', exc)


def backfill_isp_slugs():
    """Give pre-onboarding ISPs an account address derived from their name.

    Every tenant created before self-serve signup has slug NULL, which would
    leave them with no account address in the console and no way to reach a
    per-tenant URL later. Derived once, then immutable like any other slug.
    Idempotent: only touches rows where slug IS NULL.
    """
    try:
        from models import ISP
        from services.tenant_slug import suggest_slug

        pending = ISP.query.filter(ISP.slug.is_(None)).all()
        if not pending:
            return
        for isp in pending:
            isp.slug = suggest_slug(isp.name or isp.company_name or f'isp{isp.id}')
            db.session.flush()  # so the next suggest_slug sees this one
        db.session.commit()
        app.logger.info('Backfilled account addresses for %d ISPs', len(pending))
    except Exception as exc:
        db.session.rollback()
        app.logger.warning('ISP slug backfill skipped: %s', exc)


def purge_legacy_radius_accept_rows():
    """Clear ``Auth-Type := Accept`` rows written by earlier builds.

    They accept any password and break MS-CHAPv2 PPPoE dial-in — see
    services.radius_provisioning.ensure_plan_group. Idempotent: a no-op once the
    rows are gone.
    """
    try:
        from services.radius_provisioning import purge_auth_type_accept_rows
        removed = purge_auth_type_accept_rows()
        if removed:
            db.session.commit()
            app.logger.info('Removed %d legacy RADIUS Auth-Type:=Accept rows', removed)
    except Exception as exc:
        db.session.rollback()
        app.logger.warning('RADIUS Auth-Type cleanup skipped: %s', exc)


def purge_demo_accounting_rows():
    """Delete the seeded ``fup-demo-*`` radacct rows.

    One of them was left open, so it read as a permanently-connected subscriber
    in Online users, the dashboard session counts and the FUP monitor. Real
    accounting only ever comes from FreeRADIUS. Idempotent.
    """
    try:
        from models import RadAcct
        removed = RadAcct.query.filter(
            RadAcct.acctsessionid.like('fup-demo-%')
        ).delete(synchronize_session=False)
        if removed:
            db.session.commit()
            app.logger.info('Removed %d demo RADIUS accounting rows', removed)
    except Exception as exc:
        db.session.rollback()
        app.logger.warning('Demo accounting cleanup skipped: %s', exc)


with app.app_context():
    ensure_schema_upgrades()
    backfill_account_numbers()
    backfill_isp_slugs()
    purge_legacy_radius_accept_rows()
    purge_demo_accounting_rows()


@app.before_request
def serve_webfig_when_host_matches():
    """Proxy the whole origin to a router's WebFig on webfig-<id>.* hostnames.

    Registered before the CORS hook so it owns those hosts entirely. Inert for
    every normal request — it returns None unless the Host header is one of ours.
    RouterOS 7's WebFig is full of root-absolute paths and cannot be served under
    a prefix, which is why this is host-based; see routes/webfig_proxy.py.
    """
    from routes.webfig_proxy import webfig_host_dispatch
    return webfig_host_dispatch()


@app.before_request
def handle_api_preflight():
    """Return 200 for CORS preflight on all API routes."""
    if request.method == 'OPTIONS' and request.path.startswith('/api/'):
        return '', 200


# Console routes a tenant keeps even while locked out. Everything here is
# reachable with an expired subscription, so add to it deliberately:
#   - auth, or they could not sign in to see the paywall at all
#   - /api/platform, which *is* the paywall (state, invoices, payment)
#   - support/health/test, so a locked tenant can still ask for help
_PAYWALL_EXEMPT_PREFIXES = (
    '/api/auth',
    '/api/platform',
    '/api/support',
    '/api/health',
    '/api/test',
    '/api/onboarding',
)


@app.before_request
def enforce_platform_subscription():
    """Return 402 on the operator API when the tenant's own bill is unpaid.

    Only the *console* is gated. Unauthenticated traffic — RADIUS, the captive
    portal, provisioning, the TR-069 ACS, the M-Pesa callback — passes straight
    through, because an ISP being late on their platform bill must never knock
    their paying subscribers offline. The lockout is a business lever, not an
    outage.

    Paired with the frontend gate, which redirects to the subscription page;
    this half is what makes it more than a cosmetic block.
    """
    if request.method == 'OPTIONS' or not request.path.startswith('/api/'):
        return None
    if request.path.startswith(_PAYWALL_EXEMPT_PREFIXES):
        return None

    from flask_jwt_extended import verify_jwt_in_request

    try:
        # optional=True: no token means this is not a console request, and the
        # route's own auth (or lack of it) decides. We never turn anonymous
        # traffic away here.
        verified = verify_jwt_in_request(optional=True)
    except Exception:
        return None
    if not verified:
        return None

    try:
        from auth_utils import get_current_user
        from models import ISP
        from services import platform_subscription as sub

        user = get_current_user()
        # An admin with no tenant (platform operator) has no bill to be late on.
        if not user or not getattr(user, 'isp_id', None):
            return None
        isp = ISP.query.get(user.isp_id)
        if isp is None or not sub.is_locked(isp):
            return None

        return jsonify({
            'error': 'Your subscription has expired. Renew to restore access.',
            'code': 'subscription_expired',
            'subscription': sub.subscription_state(isp),
        }), 402
    except Exception as exc:
        # A broken paywall must never take the whole API down with it.
        app.logger.warning('Subscription gate skipped: %s', exc)
        return None

# Test route
@app.route('/api/test')
def test():
    return {'message': 'Backend is working!'}

# Test customer count route
@app.route('/api/test/customers')
def test_customers():
    from models import Customer
    count = Customer.query.count()
    return {'message': f'Database has {count} customers'}

# CLI Commands
@app.cli.command('initdb')
def initdb_command():
    """Initialize the database with tables and sample data."""
    with app.app_context():
        # Create all tables
        db.create_all()
        click.echo('Database tables created successfully.')
        
        # Seed sample data
        seed_sample_data()
        click.echo('Sample data seeded successfully.')

def seed_sample_data():
    """Seed the database with sample network management data."""
    
    # Sample LDAP Server
    ldap_server = LDAPServer(
        name='Corporate LDAP',
        host='ldap.company.com',
        port=389,
        use_ssl=False,
        use_tls=True,
        bind_dn='cn=admin,dc=company,dc=com',
        bind_password='admin_password',
        base_dn='dc=company,dc=com',
        user_search_base='ou=users,dc=company,dc=com',
        user_search_filter='(uid={})',
        group_search_base='ou=groups,dc=company,dc=com',
        group_search_filter='(member={})',
        timeout=10
    )
    db.session.add(ldap_server)
    
    # Sample RADIUS Client
    radius_client = RadiusClient(
        name='Main RADIUS Server',
        host='radius.company.com',
        secret='radius_secret_key',
        auth_port=1812,
        acct_port=1813,
        nas_type='other',
        shortname='radius'
    )
    db.session.add(radius_client)
    
    # Sample SNMP Device
    snmp_device = SnmpDevice(
        name='Core Switch',
        host='192.168.1.1',
        port=161,
        snmp_version='3',
        username='snmp_user',
        auth_protocol='SHA',
        auth_key='auth_key_123',
        priv_protocol='AES',
        priv_key='priv_key_123',
        timeout=3,
        retries=3
    )
    db.session.add(snmp_device)
    
    # Sample VPN Config (WireGuard)
    vpn_config = VPNConfig(
        name='Corporate VPN',
        vpn_type='wireguard',
        config_blob='[Interface]\nPrivateKey = sample_private_key\nAddress = 10.0.0.1/24\nListenPort = 51820',
        server_public_key='sample_public_key',
        server_private_key='sample_private_key',
        server_endpoint='vpn.company.com',
        server_port=51820,
        allowed_ips='10.0.0.1/24',
        dns_servers='8.8.8.8,8.8.4.4',
        mtu=1420
    )
    db.session.add(vpn_config)
    
    # Sample EAP Profile
    eap_profile = EapProfile(
        name='Corporate WiFi',
        eap_method='PEAP',
        ca_cert_path='/etc/ssl/certs/ca-cert.pem',
        server_cert_path='/etc/ssl/certs/server-cert.pem',
        server_key_path='/etc/ssl/private/server-key.pem',
        phase2_method='MSCHAPv2',
        inner_identity='anonymous',
        outer_identity='anonymous',
        notes='Corporate WiFi authentication profile'
    )
    db.session.add(eap_profile)
    
    db.session.commit()

@app.cli.command('seed-network')
def seed_network_command():
    """Seed the database with network management sample data."""
    with app.app_context():
        seed_sample_data()
        click.echo('Network management sample data seeded successfully.')


@app.cli.command('purge-retention')
@click.option('--dry-run', is_flag=True, help='Report counts without deleting')
def purge_retention_command(dry_run):
    """Purge expired hotspot data per ISP retention settings (cron: daily)."""
    from services.data_retention import purge_expired_data
    with app.app_context():
        summary = purge_expired_data(dry_run=dry_run)
        click.echo(f"Retention purge: {summary}")


@app.cli.command('poll-devices')
@click.option('--limit', default=None, type=int, help='Poll at most this many devices')
def poll_devices_command(limit):
    """Sync every due router and record a resource sample (cron: */5 * * * *).

    Only needed when DEVICE_POLL_INTERVAL is 0; otherwise the in-process poller
    already does this and running both just doubles the SSH load.
    """
    from services.device_poller import poll_once
    with app.app_context():
        interval = int(app.config.get('DEVICE_POLL_INTERVAL', 300) or 300)
        summary = poll_once(interval_seconds=interval, limit=limit)
        click.echo(f'Device poll: {summary}')


@app.cli.command('enforce-expiry')
@click.option('--grace-hours', default=0, type=int, help='Grace period after subscription_end')
def enforce_expiry_command(grace_hours):
    """Suspend expired customers and remove RADIUS access (cron: */15 * * * *)."""
    with app.app_context():
        count = enforce_expired_subscriptions(grace_hours=grace_hours)
        click.echo(f'Expired subscriptions enforced: {count} customer(s) suspended.')


@app.cli.command('resume-paused')
def resume_paused_command():
    """Resume paused subscriptions whose auto-resume time has passed."""
    with app.app_context():
        from services.subscription_pause import resume_due_pauses
        count = resume_due_pauses()
        click.echo(f'Paused subscriptions resumed: {count}.')


@app.cli.command('issue-subscription-invoices')
@click.option('--lead-days', default=None, type=int,
              help='Raise the invoice this many days before expiry (default PLATFORM_ISSUE_LEAD_DAYS)')
def issue_subscription_invoices_command(lead_days):
    """Raise the next platform invoice for tenants nearing expiry (cron: daily).

    Idempotent — a tenant with a pending invoice is skipped, so running it
    twice in a day bills nobody twice.
    """
    with app.app_context():
        from services import platform_subscription as sub
        issued = sub.issue_due_invoices(lead_days=lead_days)
        for invoice in issued:
            click.echo(f'{invoice.number}  {invoice.currency} {float(invoice.amount):,.2f}'
                       f'  due {invoice.due_at:%Y-%m-%d}')
        click.echo(f'Platform invoices issued: {len(issued)}.')


@app.cli.command('enforce-fup')
def enforce_fup_command():
    """Throttle over-limit subscribers, restore on reset (cron: */15 * * * *)."""
    from services.fup_enforcement import apply_fup_enforcement
    with app.app_context():
        result = apply_fup_enforcement()
        click.echo(
            f"FUP enforcement: {result['throttled']} throttled, "
            f"{result['restored']} restored."
        )


@app.cli.command('verify-deployment')
def verify_deployment_command():
    """Print MikroTik + WireGuard deployment checklist (run on the server after deploy)."""
    from routes.health import build_deployment_report

    with app.app_context():
        report = build_deployment_report()
        click.echo('=== Infora deployment connectivity ===')
        click.echo(f"Ready: {'YES' if report['ready'] else 'NO'}")
        click.echo(f"FREERADIUS_HOST: {report['config'].get('freeradius_host')}")
        click.echo(f"MikroTik devices: {report['counts'].get('mikrotik_devices')}")
        click.echo(f"WireGuard servers: {report['counts'].get('wireguard_servers')}")
        if report['issues']:
            click.echo('\nIssues:')
            for issue in report['issues']:
                click.echo(f'  - {issue}')
        if report['mikrotik_devices']:
            click.echo('\nMikroTik reachability:')
            for d in report['mikrotik_devices']:
                ok = 'OK' if d['api_reachable'] else 'FAIL'
                click.echo(f"  [{ok}] {d['name']} {d['ip']}:{d['port']} ({d['connection_type']})")
        if report['wireguard_servers']:
            click.echo('\nWireGuard servers:')
            for s in report['wireguard_servers']:
                ep = 'OK' if s['endpoint_ok'] else 'FIX ENDPOINT'
                click.echo(f"  [{ep}] {s['name']} {s['endpoint']}:{s['port']} mode={s['deployment_mode']}")
        click.echo('\nNext: flask generate-radius-clients && restart freeradius')


@app.cli.command('diagnose-device')
@click.argument('device')
def diagnose_device_command(device):
    """Explain why a router shows Offline. DEVICE is an id or a name substring."""
    from models import MikrotikDevice
    from services.device_diagnostics import diagnose_device

    with app.app_context():
        if device.isdigit():
            row = MikrotikDevice.query.get(int(device))
        else:
            row = MikrotikDevice.query.filter(
                MikrotikDevice.device_name.ilike(f'%{device}%')
            ).first()
        if not row:
            click.echo(f'No device matching "{device}"')
            raise SystemExit(1)

        report = diagnose_device(row)
        click.echo(f"=== {report['device_name']} (id={report['device_id']}) ===")
        click.echo(f"Stored status: {report['device_status']}  last_synced: {report['last_synced']}")
        click.echo('')
        for check in report['checks']:
            mark = 'PASS' if check['ok'] else ('warn' if check['severity'] == 'warn' else 'FAIL')
            click.echo(f"  [{mark:4}] {check['label']}")
            if check['detail']:
                click.echo(f"         {check['detail']}")
        click.echo('')
        click.echo(f"Verdict: {report['verdict']}")


@app.cli.command('diagnose-acs')
@click.option('--probe', is_flag=True,
              help='Also fetch the ACS from each router over the tunnel (slow: router '
                   'SSH runs to tens of seconds, but it is the only end-to-end proof).')
def diagnose_acs_command(probe):
    """Explain why a CPE cannot reach the TR-069 ACS."""
    from services.acs_diagnostics import diagnose_acs

    with app.app_context():
        report = diagnose_acs(probe=probe)
        click.echo(f"=== TR-069 ACS ===")
        click.echo(f"ACS URL: {report['acs_url'] or '(unset)'}   CPE known: {report['cpe_count']}")
        if not probe:
            click.echo('(run with --probe to test the path from each router)')
        click.echo('')
        for check in report['checks']:
            if check['ok']:
                mark = 'PASS'
            else:
                # 'info' is an observation, not a fault — printing it as FAIL is
                # what made an empty CPE fleet look like a broken ACS.
                mark = {'warn': 'warn', 'info': 'info'}.get(check['severity'], 'FAIL')
            click.echo(f"  [{mark:4}] {check['label']}")
            if check['detail']:
                click.echo(f"         {check['detail']}")
        click.echo('')
        click.echo(f"Verdict: {report['verdict']}")


@app.cli.command('generate-radius-clients')
@click.option('--output', default=None, help='Write to file (default: config/freeradius/clients.conf)')
def generate_radius_clients_command(output):
    """Export radius_clients + mikrotik_devices to FreeRADIUS clients.conf."""
    import os
    from services.radius_clients_export import generate_clients_conf, sync_radius_clients_conf

    with app.app_context():
        if output:
            content = generate_clients_conf()
            os.makedirs(os.path.dirname(output), exist_ok=True)
            with open(output, 'w', encoding='utf-8') as fh:
                fh.write(content)
            path = output
        else:
            path = sync_radius_clients_conf()
        click.echo(f'Wrote {path}')


@app.cli.command('sync-wireguard-stats')
def sync_wireguard_stats_command():
    """Collect peer rx/tx from wg show and update wireguard_peers (cron)."""
    from services.wireguard_accounting import collect_wireguard_stats

    with app.app_context():
        result = collect_wireguard_stats()
        click.echo(f'WireGuard stats sync: {result}')


def _start_expiry_scheduler(app):
    """Optional in-process expiry enforcement when SUBSCRIPTION_ENFORCEMENT_INTERVAL is set."""
    interval = app.config.get('SUBSCRIPTION_ENFORCEMENT_INTERVAL')
    if not interval:
        return

    import threading
    import time

    def _loop():
        while True:
            time.sleep(int(interval))
            with app.app_context():
                try:
                    enforce_expired_subscriptions(
                        grace_hours=app.config.get('SUBSCRIPTION_GRACE_HOURS', 0)
                    )
                except Exception as exc:
                    app.logger.warning('expiry enforcement failed: %s', exc)
                # Rides the same cadence: a subscription paused "until Friday"
                # that nothing ever un-pauses is a promise the console broke.
                try:
                    from services.subscription_pause import resume_due_pauses
                    resume_due_pauses()
                except Exception as exc:
                    app.logger.warning('auto-resume pass failed: %s', exc)

    thread = threading.Thread(target=_loop, daemon=True, name='subscription-expiry')
    thread.start()


def _start_fup_scheduler(app):
    """Optional in-process FUP throttle enforcement when FUP_ENFORCEMENT_INTERVAL is set."""
    interval = app.config.get('FUP_ENFORCEMENT_INTERVAL')
    if not interval:
        return

    import threading
    import time
    from services.fup_enforcement import apply_fup_enforcement

    def _loop():
        while True:
            time.sleep(int(interval))
            with app.app_context():
                try:
                    apply_fup_enforcement()
                except Exception as exc:
                    app.logger.warning('FUP enforcement failed: %s', exc)

    thread = threading.Thread(target=_loop, daemon=True, name='fup-enforcement')
    thread.start()


@app.route('/portal', defaults={'path': ''})
@app.route('/portal/<path:path>')
def redirect_portal_to_frontend(path):
    """Redirect /portal on the API host to the React SPA (dev: Vite on :5173)."""
    from flask import redirect
    from services.portal_urls import portal_frontend_base_url

    base = portal_frontend_base_url()
    if not base:
        return {'error': 'Portal frontend URL is not configured (set PORTAL_BASE_URL)'}, 404

    target = f'{base}/portal'
    if path:
        target = f'{target}/{path}'
    if request.query_string:
        target = f'{target}?{request.query_string.decode()}'
    return redirect(target, code=302)


_poller_started = False


@app.before_request
def _start_device_poller_once():
    """Start the router poll loop in serving processes only.

    Not at import: `flask db upgrade` and `flask initdb` import this module too,
    and a poller opening SSH sessions during a migration is nobody's intent.
    Not under ``__main__`` either — production execs gunicorn, which never runs
    that block, which is why the expiry and FUP loops below have silently never
    run in prod. The first request is the one moment we know we are serving.

    Each gunicorn worker runs this once; the loop's flock keeps a tick to a
    single worker, so four starts still mean one poll.
    """
    global _poller_started
    if _poller_started:
        return
    _poller_started = True
    try:
        from services.device_poller import start_poller
        start_poller(app)
    except Exception as exc:  # noqa: BLE001 — never break a request over this
        app.logger.warning('Device poller failed to start: %s', exc)


if __name__ == "__main__":
    _start_expiry_scheduler(app)
    _start_fup_scheduler(app)
    app.run(debug=True, port=5000, host='0.0.0.0')