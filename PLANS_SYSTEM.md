# 📋 Service Plans Management System

## 🎯 Overview

The Service Plans Management System allows administrators to create, manage, and track internet service plans for customers. This system provides comprehensive CRUD operations for service plans with features like pricing, speed tiers, and plan features.

## 🏗️ Backend Architecture

### **Database Model: ServicePlan**

```python
class ServicePlan(db.Model):
    __tablename__ = 'service_plans'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    speed = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    features = db.Column(db.JSON, nullable=False)
    popular = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationships
    customers = db.relationship('Customer', back_populates="service_plan")
```

### **Key Features:**
- ✅ **Plan Management**: Create, read, update, delete service plans
- ✅ **Status Control**: Activate/deactivate plans
- ✅ **Popular Plans**: Mark plans as popular for marketing
- ✅ **Feature Lists**: JSON-based feature management
- ✅ **Pricing**: Decimal-based pricing with precision
- ✅ **Customer Relationships**: Track which customers use each plan
- ✅ **Statistics**: Comprehensive plan analytics

## 🔧 API Endpoints

### **Base URL**: `/api/plans`

### **1. Get All Plans**
```http
GET /api/plans?page=1&per_page=20&is_active=true&popular=false&search=basic
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 20)
- `is_active`: Filter by active status (true/false)
- `popular`: Filter by popular status (true/false)
- `search`: Search by plan name

**Response:**
```json
{
  "plans": [
    {
      "id": 1,
      "name": "Basic Plan",
      "speed": "25 Mbps",
      "price": 29.99,
      "features": ["Unlimited Data", "Basic Support"],
      "popular": false,
      "is_active": true,
      "created_at": "2025-08-25T10:00:00",
      "updated_at": "2025-08-25T10:00:00",
      "customers_count": 5
    }
  ],
  "total": 7,
  "pages": 1,
  "current_page": 1,
  "per_page": 20
}
```

### **2. Get Specific Plan**
```http
GET /api/plans/1
```

**Response:**
```json
{
  "id": 1,
  "name": "Basic Plan",
  "speed": "25 Mbps",
  "price": 29.99,
  "features": ["Unlimited Data", "Basic Support"],
  "popular": false,
  "is_active": true,
  "created_at": "2025-08-25T10:00:00",
  "updated_at": "2025-08-25T10:00:00",
  "customers_count": 5
}
```

### **3. Create Plan**
```http
POST /api/plans
Content-Type: application/json

{
  "name": "Premium Plan",
  "speed": "100 Mbps",
  "price": 79.99,
  "features": ["Unlimited Data", "24/7 Support", "Free Installation"],
  "popular": true,
  "is_active": true
}
```

**Required Fields:**
- `name`: Plan name (string)
- `speed`: Internet speed (string)
- `price`: Monthly price (number)

**Optional Fields:**
- `features`: Array of features (default: [])
- `popular`: Popular status (default: false)
- `is_active`: Active status (default: true)

### **4. Update Plan**
```http
PUT /api/plans/1
Content-Type: application/json

{
  "price": 89.99,
  "features": ["Unlimited Data", "24/7 Support", "Free Installation", "Premium Support"]
}
```

### **5. Delete Plan**
```http
DELETE /api/plans/1
```

**Note:** Cannot delete plans with existing customers.

### **6. Toggle Active Status**
```http
PUT /api/plans/1/toggle-active
```

### **7. Toggle Popular Status**
```http
PUT /api/plans/1/toggle-popular
```

### **8. Get Active Plans**
```http
GET /api/plans/active
```

### **9. Get Popular Plans**
```http
GET /api/plans/popular
```

### **10. Get Plan Statistics**
```http
GET /api/plans/stats
```

**Response:**
```json
{
  "total_plans": 7,
  "active_plans": 6,
  "popular_plans": 2,
  "average_price": 89.99,
  "price_range": {
    "min": 19.99,
    "max": 299.99
  },
  "plans_by_price_range": {
    "budget": 3,
    "standard": 2,
    "premium": 2
  }
}
```

### **11. Get Plan Customers**
```http
GET /api/plans/1/customers?page=1&per_page=20
```

### **12. Bulk Update Plans**
```http
PUT /api/plans/bulk-update
Content-Type: application/json

{
  "plan_ids": [1, 2, 3],
  "updates": {
    "is_active": false,
    "popular": true
  }
}
```

## 🛠️ Implementation Details

### **Serialization Function**
```python
def serialize_plan(plan):
    """Serialize plan object to dictionary"""
    try:
        return {
            'id': plan.id,
            'name': plan.name,
            'speed': plan.speed,
            'price': float(plan.price) if plan.price else 0.0,
            'features': plan.features if plan.features else [],
            'popular': plan.popular,
            'is_active': plan.is_active,
            'created_at': plan.created_at.isoformat() if plan.created_at else None,
            'updated_at': plan.updated_at.isoformat() if plan.updated_at else None,
            'customers_count': len(plan.customers) if hasattr(plan, 'customers') else 0
        }
    except Exception as e:
        print(f"Error serializing plan {plan.id}: {e}")
        return {
            'id': plan.id,
            'name': plan.name,
            'speed': plan.speed,
            'price': float(plan.price) if plan.price else 0.0,
            'features': [],
            'popular': False,
            'is_active': True,
            'created_at': None,
            'updated_at': None,
            'customers_count': 0
        }
```

### **Error Handling**
- ✅ **Validation**: Required field validation
- ✅ **Price Validation**: Positive price values only
- ✅ **Relationship Protection**: Cannot delete plans with customers
- ✅ **Database Rollback**: Automatic rollback on errors
- ✅ **Comprehensive Logging**: Detailed error messages

### **CORS Support**
- ✅ **OPTIONS Handlers**: Explicit CORS preflight support
- ✅ **Global CORS**: Configured in app.py
- ✅ **Cross-Origin Requests**: Full browser compatibility

## 📊 Sample Data

### **Basic Plan**
```json
{
  "name": "Basic Plan",
  "speed": "25 Mbps",
  "price": 29.99,
  "features": ["Unlimited Data", "Basic Support", "Email Support"],
  "popular": false,
  "is_active": true
}
```

### **Premium Plan**
```json
{
  "name": "Premium Plan",
  "speed": "100 Mbps",
  "price": 79.99,
  "features": ["Unlimited Data", "24/7 Support", "Free Installation", "Priority Support", "Free Router"],
  "popular": true,
  "is_active": true
}
```

### **Business Plan**
```json
{
  "name": "Business Plan",
  "speed": "200 Mbps",
  "price": 149.99,
  "features": ["Unlimited Data", "24/7 Business Support", "Free Installation", "Static IP", "Free Router", "SLA Guarantee"],
  "popular": false,
  "is_active": true
}
```

## 🧪 Testing

### **Test Scripts**
1. **`test_plans_api.py`**: Comprehensive API testing
2. **`add_test_plans.py`**: Add sample data to database

### **Running Tests**
```bash
# Test the API
python test_plans_api.py

# Add sample data
python add_test_plans.py
```

### **Expected Test Results**
```
✅ Login successful
✅ Found 7 plans
✅ Plan created successfully
✅ Plan retrieved successfully
✅ Plan updated successfully
✅ Plan status toggled successfully
✅ Found 6 active plans
✅ Found 2 popular plans
✅ Plan stats retrieved successfully
✅ Plan deleted successfully
```

## 🔒 Security Features

### **Authentication**
- ✅ **JWT Required**: All endpoints require authentication
- ✅ **Token Validation**: Automatic token verification
- ✅ **Secure Headers**: Proper authorization headers

### **Data Validation**
- ✅ **Input Sanitization**: All inputs validated
- ✅ **SQL Injection Protection**: Parameterized queries
- ✅ **Type Safety**: Proper data type handling

## 🚀 Usage Examples

### **Creating a New Plan**
```python
import requests

# Login to get token
login_response = requests.post('http://localhost:5000/api/auth/login', json={
    'email': 'admin@infora.com',
    'password': 'admin123'
})
token = login_response.json()['access_token']

# Create plan
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
plan_data = {
    'name': 'Gaming Plan',
    'speed': '150 Mbps',
    'price': 99.99,
    'features': ['Unlimited Data', 'Low Latency', 'Gaming Support', 'Free Router'],
    'popular': True,
    'is_active': True
}

response = requests.post('http://localhost:5000/api/plans', headers=headers, json=plan_data)
print(response.json())
```

### **Getting Plan Statistics**
```python
response = requests.get('http://localhost:5000/api/plans/stats', headers=headers)
stats = response.json()
print(f"Total Plans: {stats['total_plans']}")
print(f"Active Plans: {stats['active_plans']}")
print(f"Average Price: ${stats['average_price']}")
```

## 📝 Notes

### **Important Considerations**
1. **Plan Deletion**: Cannot delete plans with existing customers
2. **Price Format**: Prices are stored as Decimal for precision
3. **Features**: Stored as JSON array for flexibility
4. **Relationships**: Plans are linked to customers through foreign keys
5. **Timestamps**: Automatic creation and update timestamps

### **Performance Optimizations**
- ✅ **Pagination**: Efficient data loading
- ✅ **Indexing**: Database indexes on frequently queried fields
- ✅ **Caching**: Consider Redis for frequently accessed data
- ✅ **Query Optimization**: Efficient SQL queries

### **Future Enhancements**
- 🔄 **Plan Templates**: Predefined plan templates
- 🔄 **Pricing Tiers**: Dynamic pricing based on usage
- 🔄 **Plan Migration**: Tools to migrate customers between plans
- 🔄 **Usage Analytics**: Track plan usage patterns
- 🔄 **A/B Testing**: Test different plan configurations

## 🎉 Summary

The Service Plans Management System provides a robust, secure, and scalable solution for managing internet service plans. With comprehensive CRUD operations, advanced filtering, and detailed analytics, it serves as the foundation for customer plan management in the Infora WiFi Billing System.
