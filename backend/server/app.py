from flask import Flask
from config import Config
from flask_cors import CORS
from extensions import db, migrate, jwt
from models import User, LDAPServer, RadiusClient, SnmpDevice, VPNConfig, EapProfile, RadCheck, RadReply, RadAcct, RadUserGroup, RadGroupCheck, RadGroupReply
from routes.auth import auth_bp
from routes.customers import customers_bp
from routes.invoices import invoices_bp
from routes.plans import plans_bp
from routes.devices import devices_bp
from routes.isps import isps_bp
from routes.ldap import ldap_bp
from routes.radius import radius_bp
from routes.radius_api import radius_api_bp
from routes.radius_routes import radius_routes_bp
from routes.billing import billing_bp
from routes.snmp import snmp_bp
from routes.vpn import vpn_bp
from routes.eap import eap_bp
from routes.vouchers import vouchers_bp
from routes.communication import communication_bp
import click
from datetime import datetime

app = Flask(__name__)
app.config.from_object(Config)
app.url_map.strict_slashes = False

# Initialize extensions with more permissive CORS
CORS(app,
     origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
     supports_credentials=True,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'])

db.init_app(app)
migrate.init_app(app, db)
jwt.init_app(app)

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(customers_bp)
app.register_blueprint(invoices_bp)
app.register_blueprint(plans_bp)
app.register_blueprint(devices_bp)
app.register_blueprint(isps_bp)
app.register_blueprint(ldap_bp)
app.register_blueprint(radius_bp)
app.register_blueprint(radius_api_bp)
app.register_blueprint(radius_routes_bp)
app.register_blueprint(billing_bp)
app.register_blueprint(snmp_bp)
app.register_blueprint(vpn_bp)
app.register_blueprint(eap_bp)
app.register_blueprint(vouchers_bp)
app.register_blueprint(communication_bp)

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

# Global CORS handler
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:5173')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response

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

@app.cli.command('seed-communication')
def seed_communication_command():
    """Seed the database with communication providers and templates."""
    with app.app_context():
        try:
            # Import and run the seed script
            from seed_communication import main
            main()
        except Exception as e:
            click.echo(f'Error seeding communication data: {e}')

if __name__ == "__main__":
    app.run(debug=True, port=5000, host='0.0.0.0')