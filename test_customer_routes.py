#!/usr/bin/env python3
"""
Simple test script to verify customer routes are working
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
CUSTOMERS_URL = f"{BASE_URL}/api/customers"

def test_customer_routes():
    print("Testing Customer Routes...")
    
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
    
    # Step 2: Test getting customers
    print("\n2. Testing GET /api/customers...")
    try:
        response = requests.get(CUSTOMERS_URL, headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Get customers successful")
            print(f"   Total customers: {data.get('total', 0)}")
            print(f"   Current page: {data.get('current_page', 0)}")
            print(f"   Total pages: {data.get('pages', 0)}")
        else:
            print(f"❌ Get customers failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Get customers error: {e}")
    
    # Step 3: Test getting customer stats
    print("\n3. Testing GET /api/customers/stats...")
    try:
        response = requests.get(f"{CUSTOMERS_URL}/stats", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Get customer stats successful")
            print(f"   Total customers: {data.get('total_customers', 0)}")
            print(f"   Active customers: {data.get('active_customers', 0)}")
            print(f"   Suspended customers: {data.get('suspended_customers', 0)}")
            print(f"   Average balance: {data.get('average_balance', 0)}")
        else:
            print(f"❌ Get customer stats failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Get customer stats error: {e}")
    
    # Step 4: Test creating a customer
    print("\n4. Testing POST /api/customers...")
    customer_data = {
        "name": "Test Customer",
        "email": "test@example.com",
        "phone": "+254700123456",
        "address": "123 Test Street, Nairobi",
        "status": "active",
        "package": "Basic WiFi",
        "balance": 0.00,
        "usage_percentage": 0,
        "device_count": 1
    }
    
    try:
        response = requests.post(CUSTOMERS_URL, json=customer_data, headers=headers)
        if response.status_code == 201:
            data = response.json()
            customer_id = data['customer']['id']
            print(f"✅ Create customer successful")
            print(f"   Customer ID: {customer_id}")
            print(f"   Customer name: {data['customer']['name']}")
            
            # Step 5: Test getting specific customer
            print(f"\n5. Testing GET /api/customers/{customer_id}...")
            response = requests.get(f"{CUSTOMERS_URL}/{customer_id}", headers=headers)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Get specific customer successful")
                print(f"   Customer name: {data['name']}")
                print(f"   Customer email: {data['email']}")
            else:
                print(f"❌ Get specific customer failed: {response.status_code}")
                print(response.text)
            
            # Step 6: Test updating customer
            print(f"\n6. Testing PUT /api/customers/{customer_id}...")
            update_data = {
                "name": "Updated Test Customer",
                "balance": 1000.00
            }
            response = requests.put(f"{CUSTOMERS_URL}/{customer_id}", json=update_data, headers=headers)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Update customer successful")
                print(f"   Updated name: {data['customer']['name']}")
                print(f"   Updated balance: {data['customer']['balance']}")
            else:
                print(f"❌ Update customer failed: {response.status_code}")
                print(response.text)
            
            # Step 7: Test deleting customer
            print(f"\n7. Testing DELETE /api/customers/{customer_id}...")
            response = requests.delete(f"{CUSTOMERS_URL}/{customer_id}", headers=headers)
            if response.status_code == 200:
                print(f"✅ Delete customer successful")
            else:
                print(f"❌ Delete customer failed: {response.status_code}")
                print(response.text)
                
        else:
            print(f"❌ Create customer failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Create customer error: {e}")
    
    print("\n🎉 Customer routes test completed!")

if __name__ == "__main__":
    test_customer_routes()
