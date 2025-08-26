# Infora WiFi Billing - Network Management System

A comprehensive Flask + SQLAlchemy system that integrates **FreeRADIUS + pyrad**, **LDAP (OpenLDAP/AD)**, **SNMPv3 (pysnmp)**, **VPN config management (WireGuard/OpenVPN/IPSec)**, and **EAP profiles** for enterprise network authentication and management.

## 🚀 Features

### 1. **FreeRADIUS + pyrad Integration**
- Configure FreeRADIUS clients (host, secret, ports)
- Send Access-Request packets and receive Access-Accept/Reject responses
- Store RADIUS client configurations in database
- Test RADIUS server connections

### 2. **LDAP (OpenLDAP/Active Directory) Authentication**
- Store LDAP server configurations (host, port, base_dn, bind_dn, etc.)
- Authenticate users against LDAP servers
- Support for SSL/TLS connections
- User and group search functionality
- Test LDAP server connections

### 3. **SNMPv3 using pysnmp**
- Store SNMP device records (host, port, username, auth/priv keys, protocols)
- Perform SNMPv3 GET requests (authPriv recommended)
- Support for SNMPv1, v2c, and v3
- Multiple authentication and privacy protocols
- Store and retrieve SNMP poll results
- Test SNMP device connections

### 4. **VPN Config Management (WireGuard / OpenVPN / IPSec)**
- Create and manage VPN configurations
- Generate WireGuard keypairs using cryptography
- Generate client configurations
- Support for multiple VPN types
- Store server and client configurations

### 5. **EAP (Extensible Authentication Protocol) Profiles**
- Store EAP profiles (EAP-TLS, PEAP, EAP-TTLS, etc.)
- Certificate path management
- Phase 2 authentication methods
- Configuration generation for RADIUS integration

## 📋 API Endpoints

### LDAP Management
- `GET /api/ldap/servers` - Get all LDAP server configurations
- `POST /api/ldap/servers` - Create new LDAP server
- `PUT /api/ldap/servers/<id>` - Update LDAP server
- `DELETE /api/ldap/servers/<id>` - Delete LDAP server
- `POST /api/ldap/auth/<id>` - Authenticate user against LDAP
- `POST /api/ldap/test/<id>` - Test LDAP connection

### RADIUS Management
- `GET /api/radius/clients` - Get all RADIUS client configurations
- `POST /api/radius/clients` - Create new RADIUS client
- `PUT /api/radius/clients/<id>` - Update RADIUS client
- `DELETE /api/radius/clients/<id>` - Delete RADIUS client
- `POST /api/radius/auth/<id>` - Authenticate user against RADIUS
- `POST /api/radius/test/<id>` - Test RADIUS connection

### SNMP Management
- `GET /api/snmp/devices` - Get all SNMP device configurations
- `POST /api/snmp/devices` - Create new SNMP device
- `PUT /api/snmp/devices/<id>` - Update SNMP device
- `DELETE /api/snmp/devices/<id>` - Delete SNMP device
- `GET /api/snmp/get/<id>?oid=<OID>` - Get SNMP value by OID
- `GET /api/snmp/results/<id>` - Get SNMP poll results
- `POST /api/snmp/test/<id>` - Test SNMP connection

### VPN Management
- `GET /api/vpn/configs` - Get all VPN configurations
- `POST /api/vpn/configs` - Create new VPN configuration
- `PUT /api/vpn/configs/<id>` - Update VPN configuration
- `DELETE /api/vpn/configs/<id>` - Delete VPN configuration
- `GET /api/vpn/clients` - Get all VPN clients
- `POST /api/vpn/clients` - Create new VPN client
- `PUT /api/vpn/clients/<id>` - Update VPN client
- `DELETE /api/vpn/clients/<id>` - Delete VPN client
- `POST /api/vpn/generate-keys` - Generate WireGuard keypair
- `GET /api/vpn/configs/<id>/server-config` - Get server configuration
- `GET /api/vpn/clients/<id>/config` - Get client configuration

### EAP Profile Management
- `GET /api/eap/profiles` - Get all EAP profiles
- `POST /api/eap/profiles` - Create new EAP profile
- `PUT /api/eap/profiles/<id>` - Update EAP profile
- `DELETE /api/eap/profiles/<id>` - Delete EAP profile
- `GET /api/eap/profiles/<id>` - Get specific EAP profile
- `GET /api/eap/methods` - Get available EAP methods
- `GET /api/eap/phase2-methods` - Get available Phase 2 methods
- `GET /api/eap/profiles/<id>/config` - Get EAP configuration

## 🛠️ Installation & Setup

### Prerequisites
- Docker and Docker Compose
- Python 3.8+
- PostgreSQL (if running locally)

### Quick Start with Docker

1. **Clone the repository**
```bash
git clone <repository-url>
cd infora-wifi-billing
```

2. **Start the complete stack**
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5432)
- Flask application (port 5000)
- FreeRADIUS server (ports 1812/1813)
- OpenLDAP server (port 389)
- LDAP Admin UI (port 8080)
- Frontend (port 5173)

3. **Initialize the database**
```bash
docker-compose exec flask_app flask initdb
```

### Manual Setup

1. **Install Python dependencies**
```bash
cd backend
pipenv install
```

2. **Set environment variables**
```bash
export FLASK_APP=server/app.py
export FLASK_ENV=development
export DATABASE_URL=postgresql://user:password@localhost/infora_billing
export JWT_SECRET_KEY=your-secret-key
```

3. **Initialize database**
```bash
flask db upgrade
flask initdb
```

4. **Run the application**
```bash
python server/app.py
```

## 🧪 Testing the System

### Test LDAP Authentication
```bash
curl -X POST http://localhost:5000/api/ldap/auth/1 \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}'
```

### Test RADIUS Authentication
```bash
curl -X POST http://localhost:5000/api/radius/auth/1 \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser", "password": "testpass123"}'
```

### Test SNMP Polling
```bash
curl -X GET "http://localhost:5000/api/snmp/get/1?oid=1.3.6.1.2.1.1.1.0" \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Test VPN Key Generation
```bash
curl -X POST http://localhost:5000/api/vpn/generate-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-jwt-token>" \
  -d '{"type": "wireguard"}'
```

## 📊 Database Models

### LDAPServer
- `name`, `host`, `port`, `use_ssl`, `use_tls`
- `bind_dn`, `bind_password`, `base_dn`
- `user_search_base`, `user_search_filter`
- `group_search_base`, `group_search_filter`

### RadiusClient
- `name`, `host`, `secret`
- `auth_port`, `acct_port`, `nas_type`

### SnmpDevice
- `name`, `host`, `port`, `snmp_version`
- `username`, `auth_protocol`, `auth_key`
- `priv_protocol`, `priv_key`, `context_name`

### VPNConfig
- `name`, `vpn_type`, `config_blob`
- `server_public_key`, `server_private_key`
- `server_endpoint`, `server_port`, `allowed_ips`

### EapProfile
- `name`, `eap_method`, `phase2_method`
- `ca_cert_path`, `server_cert_path`, `server_key_path`
- `client_cert_path`, `client_key_path`

## 🔧 Configuration Files

### FreeRADIUS Configuration
- `config/freeradius/clients.conf` - RADIUS client definitions
- `config/freeradius/users` - User authentication rules

### LDAP Configuration
- `config/ldap/ldif/01-users.ldif` - Sample LDAP users and groups

## 🚀 Production Deployment

### Environment Variables
```bash
DATABASE_URL=postgresql://user:password@host/database
JWT_SECRET_KEY=your-super-secret-jwt-key
RADIUS_SECRET=your-radius-secret
LDAP_BIND_PASSWORD=your-ldap-password
WIREGUARD_SERVER_PUBKEY=your-wireguard-public-key
```

### Security Considerations
- Use strong, unique secrets for each service
- Enable SSL/TLS for all connections
- Implement proper firewall rules
- Use environment variables for sensitive data
- Regular security updates and patches

## 📝 API Response Format

All API endpoints return JSON responses in the following format:

```json
{
  "ok": true/false,
  "message": "Success/error message",
  "data": {
    // Response data
  }
}
```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check PostgreSQL is running
   - Verify connection string
   - Ensure database exists

2. **LDAP Connection Issues**
   - Verify LDAP server is accessible
   - Check bind credentials
   - Test with ldapsearch command

3. **RADIUS Authentication Failures**
   - Verify RADIUS server is running
   - Check client secret matches
   - Test with radtest command

4. **SNMP Timeout Errors**
   - Verify device is reachable
   - Check SNMP credentials
   - Test with snmpwalk command

### Logs
- Flask application logs: `docker-compose logs flask_app`
- FreeRADIUS logs: `docker-compose logs freeradius`
- OpenLDAP logs: `docker-compose logs openldap`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation

---

**Note**: This system is designed for enterprise use. Ensure proper security measures are in place before deploying to production environments.
