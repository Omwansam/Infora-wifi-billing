# Infora WiFi Billing - ISP System

A production-ready ISP billing system that integrates Flask, SQLAlchemy, and FreeRADIUS for MikroTik authentication with multi-tenant support.

## 🎯 System Overview

### Workflow
1. **Customers connect via MikroTik** (PPPoE/Hotspot)
2. **MikroTik authenticates users** against FreeRADIUS
3. **FreeRADIUS uses SQL tables** (radcheck, radreply, radacct) for AAA
4. **Flask backend manages** those SQL tables with SQLAlchemy models
5. **Billing logic**: active subscriptions are provisioned, expired ones are suspended
6. **Admin can create, update, suspend, and delete** customers/plans from Flask routes

## 🚀 Features

### ✅ Core Functionality
- **Multi-tenant ISP support** with complete isolation
- **Customer management** with automatic RADIUS provisioning
- **Service plan management** with bandwidth/data limits
- **Real-time billing** with subscription tracking
- **Usage reporting** from RADIUS accounting data
- **MikroTik integration** with device management

### ✅ RADIUS Integration
- **Automatic provisioning** of customers in FreeRADIUS tables
- **Dynamic attribute management** (bandwidth limits, static IPs, timeouts)
- **Session tracking** and accounting
- **Multi-device support** with NAS identification

### ✅ API Endpoints
- **Customer CRUD** with RADIUS sync
- **Service plan management**
- **Usage reporting** from radacct
- **RADIUS authentication** endpoints
- **Multi-tenant isolation**

## 📋 API Endpoints

### Customer Management
```
GET    /api/billing/customers          # List customers with pagination
POST   /api/billing/customers          # Create customer + RADIUS provisioning
PUT    /api/billing/customers/<id>     # Update customer
DELETE /api/billing/customers/<id>     # Delete customer + RADIUS cleanup
POST   /api/billing/customers/<id>/suspend    # Suspend customer
POST   /api/billing/customers/<id>/activate   # Activate customer
```

### Service Plans
```
GET    /api/billing/plans              # List service plans
POST   /api/billing/plans              # Create service plan
PUT    /api/billing/plans/<id>         # Update service plan
DELETE /api/billing/plans/<id>         # Delete service plan
```

### Usage Reporting
```
GET    /api/billing/reports/usage/<username>  # Get usage report
GET    /api/billing/radius/status             # RADIUS status
```

### RADIUS Authentication
```
POST   /api/radius-api/auth            # RADIUS authentication
POST   /api/radius-api/accounting      # RADIUS accounting
```

## 🗄️ Database Models

### FreeRADIUS Tables
- **`radcheck`** - User authentication (username/password)
- **`radreply`** - User reply attributes (bandwidth, IP, timeouts)
- **`radacct`** - Accounting records (sessions, usage)
- **`radusergroup`** - User-group associations
- **`radgroupcheck`** - Group authentication rules
- **`radgroupreply`** - Group reply attributes

### Business Tables
- **`customers`** - Customer information
- **`service_plans`** - Service plan definitions
- **`isps`** - Multi-tenant ISP management
- **`mikrotik_devices`** - MikroTik device management

## 🔧 Configuration

### FreeRADIUS SQL Configuration
```sql
-- Example radcheck entry
INSERT INTO radcheck (username, attribute, op, value, isp_id, customer_id) 
VALUES ('customer@example.com', 'Cleartext-Password', '==', 'hashed_password', 1, 1);

-- Example radreply entry for bandwidth limit
INSERT INTO radreply (username, attribute, op, value, isp_id, customer_id)
VALUES ('customer@example.com', 'Mikrotik-Rate-Limit', '=', '1048576/1048576', 1, 1);
```

### MikroTik Attributes
- **`Mikrotik-Rate-Limit`** - Bandwidth limit (bytes/sec)
- **`Mikrotik-Data-Limit`** - Data usage limit (bytes)
- **`Framed-IP-Address`** - Static IP assignment
- **`Session-Timeout`** - Session timeout (seconds)
- **`Idle-Timeout`** - Idle timeout (seconds)

## 🛠️ Installation & Setup

### 1. Start the System
```bash
# Start all services
docker-compose up -d

# Initialize database
docker-compose exec flask_app flask initdb
```

### 2. Create ISP and Service Plans
```bash
# Create ISP (via API or database)
curl -X POST http://localhost:5000/api/isps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My ISP",
    "company_name": "My ISP Company",
    "email": "admin@myisp.com",
    "api_key": "auto-generated",
    "radius_secret": "auto-generated"
  }'

# Create service plan
curl -X POST http://localhost:5000/api/billing/plans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Basic Plan",
    "description": "Basic internet plan",
    "price": 29.99,
    "bandwidth_limit": 10,
    "data_limit": 100,
    "session_timeout": 1440
  }'
```

### 3. Create Customer
```bash
curl -X POST http://localhost:5000/api/billing/customers \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "service_plan_id": 1,
    "password": "customer123"
  }'
```

## 🧪 Testing

### Run the Test Suite
```bash
python test_isp_billing.py
```

### Manual Testing
```bash
# Test RADIUS authentication
curl -X POST http://localhost:5000/api/radius-api/auth \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john@example.com",
    "password": "customer123",
    "nas_ip": "192.168.1.1"
  }'

# Get usage report
curl -X GET http://localhost:5000/api/billing/reports/usage/john@example.com \
  -H "Authorization: Bearer <your-token>"
```

## 📊 Usage Examples

### Customer Creation with RADIUS Provisioning
```python
# When a customer is created:
# 1. Customer record is created in 'customers' table
# 2. RadCheck entry is created for authentication
# 3. RadReply entries are created for plan attributes
# 4. RadUserGroup entry links customer to plan group

customer = Customer(
    full_name="John Doe",
    email="john@example.com",
    password_hash=hash_password("customer123"),
    service_plan_id=1,
    isp_id=1,
    status='active'
)

# Automatically creates:
# - radcheck: john@example.com == hashed_password
# - radreply: john@example.com Mikrotik-Rate-Limit = 1048576/1048576
# - radreply: john@example.com Session-Timeout = 86400
# - radusergroup: john@example.com -> plan_1
```

### Customer Suspension
```python
# When a customer is suspended:
# 1. Customer status is set to 'suspended'
# 2. All RADIUS entries are marked inactive
# 3. Customer cannot authenticate

customer.status = 'suspended'
# Automatically deactivates all radcheck, radreply, radusergroup entries
```

### Usage Reporting
```python
# Usage data is collected from radacct table:
# - Session start/stop times
# - Bytes in/out
# - IP addresses
# - Device information

usage_data = RadAcct.query.filter_by(username="john@example.com").all()
total_bytes = sum(record.acctinputoctets + record.acctoutputoctets for record in usage_data)
```

## 🔒 Security Features

### Multi-tenant Isolation
- **ISP-level data isolation** - Each ISP only sees their own data
- **User role-based access** - Admin vs ISP user permissions
- **Secure password handling** - MD5 hashing for RADIUS compatibility

### RADIUS Security
- **Unique RADIUS secrets** per ISP
- **Session tracking** with unique session IDs
- **Accounting data** for audit trails

## 🚀 Production Deployment

### Environment Variables
```bash
DATABASE_URL=postgresql://user:password@host/database
JWT_SECRET_KEY=your-super-secret-jwt-key
RADIUS_SECRET=your-radius-secret
```

### FreeRADIUS Configuration
```bash
# Copy SQL configuration
cp config/freeradius/sql.conf /etc/freeradius/3.0/mods-available/

# Enable SQL module
ln -s /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/

# Restart FreeRADIUS
systemctl restart freeradius
```

### MikroTik Configuration
```
# PPPoE Server
/ppp profile add name=isp_profile rate-limit=1M/1M
/ppp secret add name=customer@example.com password=customer123 profile=isp_profile

# Hotspot
/ip hotspot user add name=customer@example.com password=customer123 profile=isp_profile
```

## 📝 API Response Format

All endpoints return JSON responses:
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

1. **Customer cannot authenticate**
   - Check if customer is active in database
   - Verify RADIUS entries exist and are active
   - Check FreeRADIUS logs: `tail -f /var/log/freeradius/radius.log`

2. **Bandwidth limits not applied**
   - Verify Mikrotik-Rate-Limit attribute in radreply table
   - Check MikroTik configuration
   - Ensure plan has bandwidth_limit set

3. **Usage data not showing**
   - Check if accounting is enabled in FreeRADIUS
   - Verify radacct table has entries
   - Check session tracking

### Logs
```bash
# Flask application logs
docker-compose logs flask_app

# FreeRADIUS logs
docker-compose logs freeradius

# Database logs
docker-compose logs postgres
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

**Note**: This system is designed for production ISP use. Ensure proper security measures are in place before deploying to production environments.
