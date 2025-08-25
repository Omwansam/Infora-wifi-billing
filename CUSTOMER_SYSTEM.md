# Customer Management System

This document explains how the customer management system works in the Infora WiFi Billing application, including the backend routes and frontend components.

## Overview

The customer system provides comprehensive customer management functionality including:
- Customer CRUD operations
- Customer statistics and analytics
- Search and filtering capabilities
- Pagination support
- Status management
- Balance and usage tracking

## Backend Implementation

### Customer Model

The `Customer` model is defined in `backend/server/models.py` with the following key fields:

```python
class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(15), nullable=False)
    address = db.Column(db.String(255), nullable=True)
    status = db.Column(db.Enum(CustomerStatus), default=CustomerStatus.ACTIVE)
    join_date = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    balance = db.Column(db.Numeric(10, 2), default=0.00)
    package = db.Column(db.String(50), nullable=False)
    usage_percentage = db.Column(db.Integer, default=0)
    device_count = db.Column(db.Integer, default=0)
    last_payment_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
```

### Customer Status Enum

```python
class CustomerStatus(Enum):
    ACTIVE = 'active'
    SUSPENDED = 'suspended'
    PENDING = 'pending'
```

### API Routes

All customer routes are defined in `backend/server/routes/customers.py` and are prefixed with `/api/customers`.

#### 1. Get All Customers
- **Endpoint**: `GET /api/customers`
- **Query Parameters**:
  - `page` (int): Page number (default: 1)
  - `per_page` (int): Items per page (default: 20)
  - `search` (string): Search term for name, email, or phone
  - `status` (string): Filter by status (active, suspended, pending)
  - `sort_by` (string): Sort field (default: created_at)
  - `sort_order` (string): Sort order (asc, desc, default: desc)

**Response**:
```json
{
  "customers": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+254700123456",
      "address": "123 Main St",
      "status": "active",
      "join_date": "2024-01-15T00:00:00",
      "balance": 0.0,
      "package": "Basic WiFi",
      "usage_percentage": 75,
      "device_count": 2,
      "last_payment_date": "2024-03-01T00:00:00",
      "created_at": "2024-01-15T00:00:00",
      "updated_at": "2024-03-01T00:00:00",
      "service_plan_id": 1,
      "service_plan": {
        "id": 1,
        "name": "Basic WiFi",
        "speed": "10 Mbps",
        "price": 5000.0
      }
    }
  ],
  "total": 100,
  "pages": 5,
  "current_page": 1,
  "per_page": 20
}
```

#### 2. Get Customer by ID
- **Endpoint**: `GET /api/customers/{customer_id}`
- **Response**: Single customer object

#### 3. Create Customer
- **Endpoint**: `POST /api/customers`
- **Required Fields**: `name`, `email`, `phone`
- **Optional Fields**: `address`, `status`, `package`, `balance`, `usage_percentage`, `device_count`

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+254700123456",
  "address": "123 Main St, Nairobi",
  "status": "active",
  "package": "Basic WiFi",
  "balance": 0.00,
  "usage_percentage": 0,
  "device_count": 1
}
```

#### 4. Update Customer
- **Endpoint**: `PUT /api/customers/{customer_id}`
- **Request Body**: Any customer fields to update

#### 5. Delete Customer
- **Endpoint**: `DELETE /api/customers/{customer_id}`
- **Note**: Cannot delete customers with existing invoices, payments, or tickets

#### 6. Update Customer Status
- **Endpoint**: `PUT /api/customers/{customer_id}/status`
- **Request Body**: `{"status": "active|suspended|pending"}`

#### 7. Update Customer Balance
- **Endpoint**: `PUT /api/customers/{customer_id}/balance`
- **Request Body**: `{"balance": 1000.00}`

#### 8. Update Customer Usage
- **Endpoint**: `PUT /api/customers/{customer_id}/usage`
- **Request Body**: `{"usage_percentage": 75, "device_count": 2}`

#### 9. Get Customer Statistics
- **Endpoint**: `GET /api/customers/stats`

**Response**:
```json
{
  "total_customers": 100,
  "active_customers": 85,
  "suspended_customers": 10,
  "pending_customers": 5,
  "average_balance": 2500.0,
  "top_customers_by_balance": [
    {
      "id": 1,
      "name": "John Doe",
      "balance": 10000.0
    }
  ]
}
```

#### 10. Get Customer Invoices
- **Endpoint**: `GET /api/customers/{customer_id}/invoices`
- **Query Parameters**: `page`, `per_page`, `status`

#### 11. Get Customer Payments
- **Endpoint**: `GET /api/customers/{customer_id}/payments`
- **Query Parameters**: `page`, `per_page`, `status`

#### 12. Get Customer Tickets
- **Endpoint**: `GET /api/customers/{customer_id}/tickets`
- **Query Parameters**: `page`, `per_page`, `status`

## Frontend Implementation

### Customer Service

The frontend uses a dedicated service (`frontend/infora_billing/src/services/customerService.js`) to handle all API calls:

```javascript
export const customerService = {
  async getCustomers(params = {}) { /* ... */ },
  async getCustomer(customerId) { /* ... */ },
  async createCustomer(customerData) { /* ... */ },
  async updateCustomer(customerId, customerData) { /* ... */ },
  async deleteCustomer(customerId) { /* ... */ },
  async updateCustomerStatus(customerId, status) { /* ... */ },
  async updateCustomerBalance(customerId, balance) { /* ... */ },
  async updateCustomerUsage(customerId, usageData) { /* ... */ },
  async getCustomerStats() { /* ... */ },
  async getCustomerInvoices(customerId, params = {}) { /* ... */ },
  async getCustomerPayments(customerId, params = {}) { /* ... */ },
  async getCustomerTickets(customerId, params = {}) { /* ... */ }
};
```

### CustomersPage Component

The main customer management page (`frontend/infora_billing/src/components/customers/CustomersPage.jsx`) provides:

- **Real-time Data**: Fetches data from the backend API
- **Search & Filtering**: Search by name, email, phone; filter by status
- **Pagination**: Navigate through large customer lists
- **Statistics Cards**: Display customer metrics
- **Loading States**: Show loading indicators during API calls
- **Error Handling**: Display error messages for failed operations

### Key Features

1. **Responsive Design**: Works on desktop and mobile devices
2. **Real-time Updates**: Data refreshes automatically
3. **Search Functionality**: Instant search across customer fields
4. **Status Management**: Visual status badges and filtering
5. **Pagination**: Efficient handling of large datasets
6. **Statistics Dashboard**: Overview of customer metrics

## Data Flow

1. **Frontend Request**: User interacts with the CustomersPage component
2. **API Call**: CustomerService makes authenticated API calls
3. **Backend Processing**: Flask routes handle the request
4. **Database Query**: SQLAlchemy ORM queries the database
5. **Response**: Serialized data is returned to frontend
6. **UI Update**: React component updates with new data

## Error Handling

### Backend Errors
- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Missing or invalid JWT token
- **404 Not Found**: Customer not found
- **409 Conflict**: Email already exists
- **500 Internal Server Error**: Database or server errors

### Frontend Errors
- **Network Errors**: Connection issues
- **API Errors**: Backend error responses
- **Validation Errors**: Form validation failures

## Security Features

1. **JWT Authentication**: All routes require valid JWT tokens
2. **Input Validation**: Server-side validation of all inputs
3. **SQL Injection Protection**: SQLAlchemy ORM prevents SQL injection
4. **CORS Protection**: Cross-origin requests are properly handled
5. **Data Sanitization**: All data is properly sanitized before database operations

## Testing

Use the provided test script (`test_customer_routes.py`) to verify all customer routes:

```bash
python test_customer_routes.py
```

This script tests:
- Authentication
- Customer CRUD operations
- Statistics endpoints
- Error handling

## Future Enhancements

1. **Bulk Operations**: Import/export customers
2. **Advanced Filtering**: Date ranges, balance ranges
3. **Customer Analytics**: Usage patterns, payment history
4. **Notification System**: Status change notifications
5. **Audit Logging**: Track all customer modifications
6. **Customer Portal**: Self-service customer interface
