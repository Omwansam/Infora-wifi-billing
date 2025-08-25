# Customer System Troubleshooting Guide

This guide helps you fix issues with the customer management system.

## Issue: "Failed to load customers" Error

### Step 1: Check Backend Server

1. **Start the backend server**:
   ```bash
   cd backend/server
   python app.py
   ```

2. **Verify the server is running**:
   - Open http://localhost:5000/api/test in your browser
   - Should return: `{"message": "Backend is working!"}`

3. **Check customer count**:
   - Open http://localhost:5000/api/test/customers in your browser
   - Should return: `{"message": "Database has X customers"}`

### Step 2: Add Test Data (if no customers exist)

If the database has 0 customers, add test data:

```bash
python add_test_customers.py
```

This will add 5 test customers to the database.

### Step 3: Test Customer Routes

Run the test script to verify all customer routes work:

```bash
python test_customer_routes.py
```

### Step 4: Check CORS Configuration

The backend should have proper CORS configuration in `backend/server/app.py`:

```python
CORS(app, 
     origins=['http://localhost:5173', 'http://127.0.0.1:5173'],
     supports_credentials=True,
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     allow_headers=['Content-Type', 'Authorization'])
```

### Step 5: Check Frontend Authentication

1. **Verify you're logged in**:
   - Check browser console for authentication errors
   - Ensure you're logged in with valid credentials

2. **Check token storage**:
   - Open browser DevTools → Application → Local Storage
   - Look for `infora_user` key
   - Should contain user data with `access_token`

### Step 6: Debug Frontend API Calls

1. **Open browser DevTools** → Console
2. **Navigate to Customers page**
3. **Check console logs** for:
   - API request details
   - Response data
   - Error messages

### Step 7: Common Issues and Solutions

#### Issue 1: CORS Errors (404 on OPTIONS requests)
**Symptoms**: Browser console shows CORS errors
**Solution**: Restart the backend server after CORS changes

#### Issue 2: Authentication Errors (401 Unauthorized)
**Symptoms**: API calls return 401 status
**Solution**: 
- Log out and log back in
- Check if token is expired
- Verify token is being sent in Authorization header

#### Issue 3: Database Connection Issues
**Symptoms**: Backend errors about database connection
**Solution**:
- Check if database is running
- Verify database configuration in `backend/server/config.py`
- Run database migrations if needed

#### Issue 4: No Customers Found
**Symptoms**: Page shows "No customers found"
**Solution**:
- Run `python add_test_customers.py` to add test data
- Check if database has customers: `http://localhost:5000/api/test/customers`

### Step 8: Manual Testing

Test the API endpoints manually:

1. **Login to get token**:
   ```bash
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "admin@infora.com", "password": "admin123"}'
   ```

2. **Get customers** (replace TOKEN with actual token):
   ```bash
   curl -X GET http://localhost:5000/api/customers \
     -H "Authorization: Bearer TOKEN"
   ```

3. **Get customer stats**:
   ```bash
   curl -X GET http://localhost:5000/api/customers/stats \
     -H "Authorization: Bearer TOKEN"
   ```

### Step 9: Frontend Debugging

1. **Check Network tab** in browser DevTools:
   - Look for failed requests
   - Check request headers (Authorization)
   - Check response status codes

2. **Check Console tab** for JavaScript errors:
   - Look for API call errors
   - Check for authentication issues
   - Verify data parsing

### Step 10: Backend Debugging

The backend now includes debug logging. Check the terminal where the backend is running for:

- Request received messages
- Query parameters
- Database query results
- Response data

### Step 11: Database Verification

1. **Check if customers exist**:
   ```python
   from backend.server.app import app
   from backend.server.models import Customer
   
   with app.app_context():
       count = Customer.query.count()
       print(f"Total customers: {count}")
       
       customers = Customer.query.all()
       for customer in customers:
           print(f"- {customer.full_name} ({customer.email})")
   ```

2. **Check customer status**:
   ```python
   from backend.server.models import CustomerStatus
   
   with app.app_context():
       active = Customer.query.filter_by(status=CustomerStatus.ACTIVE).count()
       suspended = Customer.query.filter_by(status=CustomerStatus.SUSPENDED).count()
       pending = Customer.query.filter_by(status=CustomerStatus.PENDING).count()
       
       print(f"Active: {active}, Suspended: {suspended}, Pending: {pending}")
   ```

## Quick Fix Checklist

- [ ] Backend server is running on port 5000
- [ ] Database has customers (run `python add_test_customers.py` if needed)
- [ ] CORS is properly configured
- [ ] User is logged in with valid token
- [ ] Token is being sent in API requests
- [ ] No JavaScript errors in browser console
- [ ] Network requests are successful (200 status)

## Still Having Issues?

If you're still experiencing problems:

1. **Check the backend logs** for detailed error messages
2. **Check the browser console** for frontend errors
3. **Verify all files are saved** and servers are restarted
4. **Test with the provided test scripts** to isolate the issue

The system includes comprehensive logging to help identify where the problem occurs.
