# Multi-Tenant MikroTik Integration

## Overview

This system provides a complete multi-tenant SaaS solution for ISP management with real MikroTik device integration. Each ISP can manage their own MikroTik devices, customers, and billing while maintaining complete data isolation.

## Features

### 🔧 **Real MikroTik Integration**
- **API Connection**: Direct connection to MikroTik devices via API
- **SSH Connection**: Alternative SSH-based connection for devices without API
- **Device Monitoring**: Real-time uptime, client count, bandwidth usage
- **Connection Testing**: Automated connection health checks
- **Device Synchronization**: Sync device data and statistics

### 🏢 **Multi-Tenant Architecture**
- **ISP Isolation**: Complete data separation between ISPs
- **Role-Based Access**: Admin users can manage all ISPs, ISP users only see their data
- **Resource Limits**: Configurable device and customer limits per ISP
- **Subscription Plans**: Different tiers (basic, pro, enterprise)
- **API Keys**: Unique API keys and RADIUS secrets per ISP

### 🔐 **RADIUS Integration**
- **Multi-Tenant Authentication**: Customer authentication tied to specific ISPs
- **Session Tracking**: Monitor customer sessions and usage
- **Accounting**: Track bandwidth usage and session duration
- **Device Mapping**: Route authentication requests to correct ISP devices

## Architecture

### Database Models

#### ISP Model
```python
class ISP(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    company_name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    subscription_plan = db.Column(db.String(50), default='basic')
    max_devices = db.Column(db.Integer, default=10)
    max_customers = db.Column(db.Integer, default=100)
    api_key = db.Column(db.String(100), unique=True, nullable=False)
    radius_secret = db.Column(db.String(100), nullable=True)
```

#### Multi-Tenant Relationships
- **User** → **ISP** (users belong to ISPs)
- **MikrotikDevice** → **ISP** (devices belong to ISPs)
- **Customer** → **ISP** (customers belong to ISPs)
- **Invoice** → **ISP** (invoices belong to ISPs)
- **ServicePlan** → **ISP** (plans belong to ISPs)

### MikroTik Client

The `MikroTikClient` class provides real device connectivity:

```python
from mikrotik_client import MikroTikClient, MikroTikConnectionConfig, ConnectionType

# API Connection
config = MikroTikConnectionConfig(
    host='192.168.1.1',
    port=8728,
    username='admin',
    password='admin123',
    api_key='your_api_key',
    connection_type=ConnectionType.API
)

# SSH Connection
config = MikroTikConnectionConfig(
    host='192.168.1.1',
    port=22,
    username='admin',
    password='admin123',
    connection_type=ConnectionType.SSH
)

with MikroTikClient(config) as client:
    # Test connection
    result = client.test_connection()
    
    # Get device info
    device_info = client.get_device_info()
    
    # Get interface stats
    stats = client.get_interface_stats()
```

### RADIUS Service

The `MultiTenantRadiusService` handles authentication and accounting:

```python
from radius_service import MultiTenantRadiusService

radius_service = MultiTenantRadiusService(db.session)

# Authenticate user
success, result = radius_service.authenticate_user(
    username='customer@example.com',
    password='password123',
    nas_ip='192.168.1.1'
)

# Handle accounting
radius_service.handle_accounting(
    session_id='session_123',
    acct_type='Stop',
    session_time=3600,
    input_octets=1024000,
    output_octets=2048000
)
```

## API Endpoints

### Devices API

#### Get All Devices (Multi-tenant)
```http
GET /api/devices
Authorization: Bearer <jwt_token>
```

**Response**: Only devices belonging to the user's ISP

#### Create Device
```http
POST /api/devices
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123",
  "api_key": "your_api_key",
  "device_name": "Main Router",
  "device_ip": "192.168.1.1",
  "device_model": "RB951G-2HnD",
  "location": "Main Office",
  "notes": "Primary router"
}
```

#### Test Device Connection
```http
POST /api/devices/{device_id}/test-connection
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "connection_type": "api"  // or "ssh"
}
```

#### Sync Device Data
```http
POST /api/devices/{device_id}/sync
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "connection_type": "api"
}
```

### ISPs API

#### Get All ISPs (Admin only)
```http
GET /api/isps
Authorization: Bearer <admin_jwt_token>
```

#### Get ISP Details
```http
GET /api/isps/{isp_id}
Authorization: Bearer <jwt_token>
```

#### Create ISP (Admin only)
```http
POST /api/isps
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json

{
  "name": "New ISP",
  "company_name": "New ISP Company",
  "email": "isp@example.com",
  "subscription_plan": "pro",
  "max_devices": 20,
  "max_customers": 200
}
```

#### Get ISP Statistics
```http
GET /api/isps/{isp_id}/stats
Authorization: Bearer <jwt_token>
```

## Multi-Tenant Security

### Data Isolation
- All queries are filtered by `isp_id`
- Users can only access data from their assigned ISP
- Admin users can access all data
- Cross-ISP access is prevented at the API level

### Authentication Flow
1. Customer attempts to connect via MikroTik device
2. MikroTik sends RADIUS authentication request
3. System identifies customer and their ISP
4. System verifies device belongs to the same ISP
5. Authentication response includes ISP-specific session data

### Resource Limits
- Each ISP has configurable device and customer limits
- API enforces limits during creation operations
- Usage statistics show current utilization

## Installation and Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Database Migration
```bash
flask db upgrade
```

### 3. Create Admin User
```python
from app import app, db
from models import User, ISP

with app.app_context():
    # Create admin user
    admin = User(
        email='admin@example.com',
        password_hash='hashed_password',
        first_name='Admin',
        last_name='User',
        role='admin'
    )
    db.session.add(admin)
    db.session.commit()
```

### 4. Create ISP
```python
with app.app_context():
    isp = ISP(
        name='Test ISP',
        company_name='Test ISP Company',
        email='isp@example.com',
        subscription_plan='pro',
        max_devices=20,
        max_customers=200
    )
    isp.generate_api_key()
    isp.generate_radius_secret()
    db.session.add(isp)
    db.session.commit()
```

## Testing

### Run Multi-Tenant Tests
```bash
python test_multi_tenant.py
```

### Test MikroTik Connection
```bash
python test_devices_integration.py
```

## Configuration

### Environment Variables
```env
# Database
DATABASE_URL=postgresql://user:password@localhost/billing_db

# JWT
JWT_SECRET_KEY=your_jwt_secret

# MikroTik
MIKROTIK_API_PORT=8728
MIKROTIK_SSH_PORT=22
MIKROTIK_TIMEOUT=10

# RADIUS
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
```

### ISP Subscription Plans
- **Basic**: 10 devices, 100 customers
- **Pro**: 20 devices, 200 customers
- **Enterprise**: 50 devices, 500 customers

## Usage Examples

### Adding a MikroTik Device
```python
# Create device for specific ISP
device_data = {
    "username": "admin",
    "password": "admin123",
    "api_key": "your_api_key",
    "device_name": "Branch Router",
    "device_ip": "192.168.2.1",
    "device_model": "hAP ac²",
    "location": "Branch Office",
    "isp_id": 1  # Required for admin users
}

response = requests.post('/api/devices', json=device_data, headers=headers)
```

### Testing Device Connection
```python
# Test API connection
test_data = {"connection_type": "api"}
response = requests.post(f'/api/devices/{device_id}/test-connection', 
                        json=test_data, headers=headers)

# Test SSH connection
test_data = {"connection_type": "ssh"}
response = requests.post(f'/api/devices/{device_id}/test-connection', 
                        json=test_data, headers=headers)
```

### RADIUS Authentication
```python
# Customer authentication
success, result = radius_service.authenticate_user(
    username='customer@example.com',
    password='password123',
    nas_ip='192.168.1.1'
)

if success:
    print(f"Customer authenticated: {result['customer_id']}")
    print(f"ISP: {result['isp_id']}")
    print(f"Session: {result['session_id']}")
else:
    print(f"Authentication failed: {result['error']}")
```

## Troubleshooting

### Common Issues

1. **Connection Timeout**
   - Check device IP and port
   - Verify firewall settings
   - Test network connectivity

2. **Authentication Failed**
   - Verify username/password
   - Check API key (if using API)
   - Ensure device is online

3. **Multi-Tenant Access Denied**
   - Verify user belongs to correct ISP
   - Check device ISP assignment
   - Ensure proper JWT token

4. **RADIUS Issues**
   - Verify RADIUS secret
   - Check customer ISP assignment
   - Ensure device belongs to customer's ISP

### Debug Mode
Enable debug logging in the MikroTik client:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Future Enhancements

- **Real-time Monitoring**: WebSocket connections for live device status
- **Automated Backups**: Device configuration backup and restore
- **Advanced Analytics**: Usage patterns and performance metrics
- **Mobile App**: Native mobile application for device management
- **API Rate Limiting**: Per-ISP API usage limits
- **Multi-Factor Authentication**: Enhanced security for admin access
