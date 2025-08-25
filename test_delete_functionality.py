#!/usr/bin/env python3
"""
Test script to verify customer delete functionality
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
CUSTOMERS_URL = f"{BASE_URL}/api/customers"

def test_delete_functionality():
    print("Testing Customer Delete Functionality...")
    
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
    
    # Step 2: Get existing customers to see what we have
    print("\n2. Getting existing customers...")
    try:
        response = requests.get(CUSTOMERS_URL, headers=headers)
        if response.status_code == 200:
            data = response.json()
            customers = data.get('customers', [])
            print(f"✅ Found {len(customers)} existing customers")
            
            if len(customers) > 0:
                # Show first few customers
                for i, customer in enumerate(customers[:3]):
                    print(f"   {i+1}. {customer.get('name')} (ID: {customer.get('id')}) - {customer.get('email')}")
            else:
                print("   No customers found")
        else:
            print(f"❌ Failed to get customers: {response.text}")
            return
    except Exception as e:
        print(f"❌ Error getting customers: {e}")
        return
    
    # Step 3: Create a test customer for deletion
    print("\n3. Creating test customer for deletion...")
    customer_data = {
        "name": "Delete Test Customer",
        "email": "delete.test@example.com",
        "phone": "+254700123461",
        "address": "123 Delete Test Street, Nairobi",
        "package": "Basic WiFi",
        "status": "active",
        "balance": 0.00,
        "usage_percentage": 0,
        "device_count": 1
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
    
    # Step 4: Verify the customer exists
    print(f"\n4. Verifying customer {customer_id} exists...")
    try:
        response = requests.get(f"{CUSTOMERS_URL}/{customer_id}", headers=headers)
        if response.status_code == 200:
            customer = response.json()
            print(f"✅ Customer verified: {customer.get('name')} - {customer.get('email')}")
        else:
            print(f"❌ Customer verification failed: {response.text}")
            return
    except Exception as e:
        print(f"❌ Customer verification error: {e}")
        return
    
    # Step 5: Test DELETE customer
    print(f"\n5. Testing DELETE /api/customers/{customer_id}...")
    try:
        response = requests.delete(f"{CUSTOMERS_URL}/{customer_id}", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Delete customer successful")
        else:
            print(f"❌ Delete customer failed")
            return
    except Exception as e:
        print(f"❌ Delete customer error: {e}")
        return
    
    # Step 6: Verify deletion by trying to get the customer
    print(f"\n6. Verifying deletion by trying to get customer {customer_id}...")
    try:
        response = requests.get(f"{CUSTOMERS_URL}/{customer_id}", headers=headers)
        if response.status_code == 404:
            print("✅ Deletion verification successful - Customer not found (404)")
        else:
            print(f"❌ Deletion verification failed - Customer still exists: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Deletion verification error: {e}")
    
    # Step 7: Test deleting a non-existent customer
    print(f"\n7. Testing DELETE on non-existent customer...")
    try:
        response = requests.delete(f"{CUSTOMERS_URL}/99999", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 404:
            print("✅ Correctly returned 404 for non-existent customer")
        else:
            print(f"❌ Unexpected response for non-existent customer: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing non-existent customer: {e}")
    
    print("\n🎉 Delete functionality test completed!")

if __name__ == "__main__":
    test_delete_functionality()
