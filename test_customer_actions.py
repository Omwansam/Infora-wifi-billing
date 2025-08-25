#!/usr/bin/env python3
"""
Test script to verify customer actions (view, edit, delete)
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
CUSTOMERS_URL = f"{BASE_URL}/api/customers"

def test_customer_actions():
    print("Testing Customer Actions (View, Edit, Delete)...")
    
    # Step 1: Login to get token
    print("\n1. Logging in...")
    login_data = {
        "email": "admin@infora.com",
        "password": "admin123"
    }
    
    try:
        login_response = requests.post(LOGIN_URL, json=login_data)
        if login_response.status_code == 200:
            token = login_response.json()['access_token']
            print("✅ Login successful")
        else:
            print(f"❌ Login failed: {login_response.status_code}")
            print(login_response.text)
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Step 2: Create a test customer
    print("\n2. Creating test customer...")
    customer_data = {
        "name": "Action Test Customer",
        "email": "action.test@example.com",
        "phone": "+254700123459",
        "address": "123 Action Test Street, Nairobi",
        "package": "Premium WiFi",
        "status": "active",
        "balance": 2500.00,
        "usage_percentage": 60,
        "device_count": 2
    }
    
    try:
        response = requests.post(CUSTOMERS_URL, json=customer_data, headers=headers)
        if response.status_code == 201:
            created_customer = response.json()['customer']
            customer_id = created_customer['id']
            print(f"✅ Created test customer with ID: {customer_id}")
        else:
            print(f"❌ Failed to create test customer: {response.text}")
            return
    except Exception as e:
        print(f"❌ Customer creation error: {e}")
        return
    
    # Step 3: Test GET customer (View action)
    print(f"\n3. Testing GET /api/customers/{customer_id} (View action)...")
    try:
        response = requests.get(f"{CUSTOMERS_URL}/{customer_id}", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            customer = response.json()
            print("✅ Get customer successful")
            print(f"   Customer name: {customer.get('name')}")
            print(f"   Customer email: {customer.get('email')}")
            print(f"   Customer balance: {customer.get('balance')}")
        else:
            print(f"❌ Get customer failed: {response.text}")
    except Exception as e:
        print(f"❌ Get customer error: {e}")
    
    # Step 4: Test PUT customer (Edit action)
    print(f"\n4. Testing PUT /api/customers/{customer_id} (Edit action)...")
    update_data = {
        "name": "Updated Action Test Customer",
        "email": "updated.action.test@example.com",
        "phone": "+254700123460",
        "address": "456 Updated Action Test Street, Mombasa",
        "package": "Business WiFi",
        "status": "active",
        "balance": 3000.00,
        "usage_percentage": 75,
        "device_count": 3
    }
    
    try:
        response = requests.put(f"{CUSTOMERS_URL}/{customer_id}", json=update_data, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            updated_customer = response.json()['customer']
            print("✅ Update customer successful")
            print(f"   Updated name: {updated_customer.get('name')}")
            print(f"   Updated email: {updated_customer.get('email')}")
            print(f"   Updated balance: {updated_customer.get('balance')}")
            print(f"   Updated package: {updated_customer.get('package')}")
        else:
            print(f"❌ Update customer failed: {response.text}")
    except Exception as e:
        print(f"❌ Update customer error: {e}")
    
    # Step 5: Verify the update by getting the customer again
    print(f"\n5. Verifying update by getting customer again...")
    try:
        response = requests.get(f"{CUSTOMERS_URL}/{customer_id}", headers=headers)
        if response.status_code == 200:
            customer = response.json()
            print("✅ Verification successful")
            print(f"   Current name: {customer.get('name')}")
            print(f"   Current email: {customer.get('email')}")
            print(f"   Current balance: {customer.get('balance')}")
        else:
            print(f"❌ Verification failed: {response.text}")
    except Exception as e:
        print(f"❌ Verification error: {e}")
    
    # Step 6: Test DELETE customer (Delete action)
    print(f"\n6. Testing DELETE /api/customers/{customer_id} (Delete action)...")
    try:
        response = requests.delete(f"{CUSTOMERS_URL}/{customer_id}", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Delete customer successful")
        else:
            print(f"❌ Delete customer failed: {response.text}")
    except Exception as e:
        print(f"❌ Delete customer error: {e}")
    
    # Step 7: Verify deletion by trying to get the customer
    print(f"\n7. Verifying deletion by trying to get deleted customer...")
    try:
        response = requests.get(f"{CUSTOMERS_URL}/{customer_id}", headers=headers)
        if response.status_code == 404:
            print("✅ Deletion verification successful - Customer not found (404)")
        else:
            print(f"❌ Deletion verification failed - Customer still exists: {response.status_code}")
    except Exception as e:
        print(f"❌ Deletion verification error: {e}")
    
    print("\n🎉 Customer actions test completed!")

if __name__ == "__main__":
    test_customer_actions()
