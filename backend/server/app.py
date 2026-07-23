from flask import Flask, jsonify, request
from config import Config
from flask_cors import CORS
from extensions import db, migrate, jwt
from models import User, LDAPServer, RadiusClient, SnmpDevice, VPNConfig, EapProfile, RadCheck, RadReply, RadAcct, RadUserGroup, RadGroupCheck, RadGroupReply
from routes.auth import auth_bp
from routes.customers import customers_bp
from routes.invoices import invoices_bp
from routes.plans import plans_bp
from routes.devices import devices_bp
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
app.register_blueprint(invoices_bp)
app.register_blueprint(plans_bp)
app.register_blueprint(devices_bp)
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


def ensure_schema_upgrades():
    """Idempotent column additions — the image ships no Alembic migrations,
    and create_all() never alters existing tables."""
    from sqlalchemy import inspect as sa_inspect, text
    # table -> {column: DDL type}
    table_additions = {
        'mikrotik_devices': {
            'monitored_interfaces': 'TEXT',
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
            # Migration/identity: operator login decoupled from email + stable
            # customer-facing account number (see radius_provisioning).
            'radius_login': 'VARCHAR(120)',
            'account_number': 'VARCHAR(40)',
        },
        'isps': {
            'account_number_prefix': 'VARCHAR(12)',
            'account_number_seq': 'INTEGER DEFAULT 100000',
        },
        'users': {
            'two_factor_enabled': 'BOOLEAN DEFAULT FALSE NOT NULL',
            'two_factor_secret': 'TEXT',
            'two_factor_backup_codes': 'TEXT',
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


with app.app_context():
    ensure_schema_upgrades()
    backfill_account_numbers()


@app.before_request
def handle_api_preflight():
    """Return 200 for CORS preflight on all API routes."""
    if request.method == 'OPTIONS' and request.path.startswith('/api/'):
        return '', 200

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


@app.cli.command('enforce-expiry')
@click.option('--grace-hours', default=0, type=int, help='Grace period after subscription_end')
def enforce_expiry_command(grace_hours):
    """Suspend expired customers and remove RADIUS access (cron: */15 * * * *)."""
    with app.app_context():
        count = enforce_expired_subscriptions(grace_hours=grace_hours)
        click.echo(f'Expired subscriptions enforced: {count} customer(s) suspended.')


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


if __name__ == "__main__":
    _start_expiry_scheduler(app)
    _start_fup_scheduler(app)
    app.run(debug=True, port=5000, host='0.0.0.0')