# Devices API Documentation

## Overview
The Devices API provides endpoints for managing MikroTik devices in the billing system. This includes creating, updating, deleting, and monitoring MikroTik routers and other network devices.

## Base URL
```
http://localhost:5000/api/devices
```

## Authentication
All endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### 1. Get All Devices
**GET** `/api/devices`

Retrieve all MikroTik devices with pagination and filtering.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `per_page` (optional): Items per page (default: 20)
- `status` (optional): Filter by device status (online, offline, maintenance, decommissioned)
- `device_type` (optional): Filter by device model
- `search` (optional): Search in device name, IP, or location

**Response:**
```json
{
  "devices": [
    {
      "id": 1,
      "username": "admin",
      "password": "***",
      "api_key": "test_api_key_1",
      "api_port": 8728,
      "device_name": "Main Router",
      "device_ip": "192.168.1.1",
      "device_model": "RB951G-2HnD",
      "device_status": "online",
      "uptime": 172800,
      "client_count": 25,
      "bandwidth_usage": 5000,
      "location": "Main Office",
      "notes": "Primary router for main office",
      "last_synced": "2024-01-15T10:30:00",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00",
      "updated_at": "2024-01-15T10:30:00",
      "zone_id": null,
      "zone_name": null
    }
  ],
  "total": 1,
  "pages": 1,
  "current_page": 1,
  "per_page": 20
}
```

### 2. Get Specific Device
**GET** `/api/devices/{device_id}`

Retrieve a specific device by ID.

**Response:**
```json
{
  "id": 1,
  "username": "admin",
  "password": "***",
  "api_key": "test_api_key_1",
  "api_port": 8728,
  "device_name": "Main Router",
  "device_ip": "192.168.1.1",
  "device_model": "RB951G-2HnD",
  "device_status": "online",
  "uptime": 172800,
  "client_count": 25,
  "bandwidth_usage": 5000,
  "location": "Main Office",
  "notes": "Primary router for main office",
  "last_synced": "2024-01-15T10:30:00",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00",
  "updated_at": "2024-01-15T10:30:00",
  "zone_id": null,
  "zone_name": null
}
```

### 3. Create Device
**POST** `/api/devices`

Create a new MikroTik device.

**Required Fields:**
- `username`: Device login username
- `password`: Device login password
- `api_key`: MikroTik API key
- `device_name`: Device display name
- `device_ip`: Device IP address
- `device_model`: Device model/type
- `location`: Device location

**Optional Fields:**
- `api_port`: API port (default: 8728)
- `notes`: Additional notes
- `is_active`: Active status (default: true)
- `zone_id`: Network zone ID

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123",
  "api_key": "test_api_key_1",
  "api_port": 8728,
  "device_name": "New Router",
  "device_ip": "192.168.5.1",
  "device_model": "RB450Gx4",
  "location": "Branch Office",
  "notes": "New branch router",
  "is_active": true
}
```

**Response:**
```json
{
  "message": "Device created successfully",
  "device": {
    "id": 2,
    "username": "admin",
    "password": "***",
    "api_key": "test_api_key_1",
    "api_port": 8728,
    "device_name": "New Router",
    "device_ip": "192.168.5.1",
    "device_model": "RB450Gx4",
    "device_status": "online",
    "uptime": 0,
    "client_count": 0,
    "bandwidth_usage": 0,
    "location": "Branch Office",
    "notes": "New branch router",
    "last_synced": null,
    "is_active": true,
    "created_at": "2024-01-15T11:00:00",
    "updated_at": "2024-01-15T11:00:00",
    "zone_id": null,
    "zone_name": null
  }
}
```

### 4. Update Device
**PUT** `/api/devices/{device_id}`

Update an existing device.

**Request Body:** (All fields optional)
```json
{
  "device_name": "Updated Router Name",
  "device_ip": "192.168.1.2",
  "location": "Updated Location",
  "notes": "Updated notes",
  "is_active": false
}
```

**Response:**
```json
{
  "message": "Device updated successfully",
  "device": {
    // Updated device object
  }
}
```

### 5. Delete Device
**DELETE** `/api/devices/{device_id}`

Delete a device.

**Response:**
```json
{
  "message": "Device deleted successfully"
}
```

### 6. Test Connection
**POST** `/api/devices/{device_id}/test-connection`

Test connectivity to a MikroTik device.

**Response:**
```json
{
  "message": "Connection test completed",
  "device": {
    // Device object
  },
  "connection_status": "success",
  "response_time": "45.2ms",
  "details": {
    "api_accessible": true,
    "ssh_accessible": true,
    "uptime": "2 days, 5 hours, 30 minutes",
    "cpu_usage": "15%",
    "memory_usage": "45%"
  }
}
```

### 7. Sync Device
**POST** `/api/devices/{device_id}/sync`

Sync device data from MikroTik (uptime, client count, bandwidth usage).

**Response:**
```json
{
  "message": "Device synced successfully",
  "device": {
    // Updated device object
  },
  "sync_details": {
    "uptime_updated": true,
    "client_count_updated": true,
    "bandwidth_updated": true,
    "sync_timestamp": "2024-01-15T11:30:00"
  }
}
```

### 8. Toggle Device Status
**PUT** `/api/devices/{device_id}/toggle-status`

Toggle the active status of a device.

**Response:**
```json
{
  "message": "Device activated successfully",
  "device": {
    // Updated device object
  }
}
```

### 9. Update Device Status
**PUT** `/api/devices/{device_id}/update-status`

Update the operational status of a device.

**Request Body:**
```json
{
  "status": "maintenance"
}
```

**Status Values:**
- `online`: Device is online and operational
- `offline`: Device is offline
- `maintenance`: Device is under maintenance
- `decommissioned`: Device is decommissioned

**Response:**
```json
{
  "message": "Device status updated to maintenance",
  "device": {
    // Updated device object
  }
}
```

### 10. Get Device Statistics
**GET** `/api/devices/stats`

Get overall device statistics.

**Response:**
```json
{
  "total_devices": 5,
  "active_devices": 4,
  "online_devices": 3,
  "offline_devices": 1,
  "maintenance_devices": 1,
  "total_clients": 125,
  "total_bandwidth_mb": 25000,
  "device_models": [
    {
      "model": "RB951G-2HnD",
      "count": 2
    },
    {
      "model": "hAP ac²",
      "count": 2
    },
    {
      "model": "RB4011iGS+",
      "count": 1
    }
  ]
}
```

### 11. Bulk Sync Devices
**POST** `/api/devices/bulk-sync`

Sync all active devices at once.

**Response:**
```json
{
  "message": "Bulk sync completed",
  "synced_devices": 4,
  "failed_devices": 0,
  "total_devices": 4
}
```

## Error Responses

### 400 Bad Request
```json
{
  "error": "Field validation error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Missing or invalid authentication token"
}
```

### 404 Not Found
```json
{
  "error": "Device not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error message"
}
```

## Device Status Values

- **online**: Device is online and operational
- **offline**: Device is offline or unreachable
- **maintenance**: Device is under maintenance
- **decommissioned**: Device is decommissioned

## Security Notes

- Passwords are hidden in responses (shown as "***")
- All endpoints require JWT authentication
- API keys should be stored securely
- Consider using HTTPS in production

## Testing

Use the provided test scripts:
- `test_devices_api.py`: Basic API connectivity test
- `test_devices_integration.py`: Comprehensive integration test with authentication

## Future Enhancements

- Real MikroTik API integration
- SSH connection support
- Device configuration management
- Automated monitoring and alerts
- Device backup and restore functionality
