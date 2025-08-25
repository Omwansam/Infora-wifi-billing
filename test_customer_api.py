#!/usr/bin/env python3
"""
Quick test script to verify customer API endpoints
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
CUSTOMERS_URL = f"{BASE_URL}/api/customers"

def test_customer_api():
    print("Testing Customer API...")
    
    # Step 1: Login
    print("\n1. Logging in...")
    login_data = {
        "email": "admin@infora.com",
        "password": "admin123"
    }
    
    try:
        login_response = requests.post(LOGIN_URL, json=login_data)
        print(f"Login status: {login_response.status_code}")
        if login_response.status_code == 200:
            token = login_response.json()['access_token']
            print("✅ Login successful")
        else:
            print(f"❌ Login failed: {login_response.text}")
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Step 2: Test customers endpoint
    print("\n2. Testing GET /api/customers...")
    try:
        response = requests.get(CUSTOMERS_URL, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"URL: {response.url}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Get customers successful")
            print(f"   Total customers: {data.get('total', 0)}")
            print(f"   Customers returned: {len(data.get('customers', []))}")
        else:
            print(f"❌ Get customers failed: {response.text}")
    except Exception as e:
        print(f"❌ Get customers error: {e}")
    
    # Step 3: Test customers endpoint with trailing slash
    print("\n3. Testing GET /api/customers/...")
    try:
        response = requests.get(f"{CUSTOMERS_URL}/", headers=headers)
        print(f"Status: {response.status_code}")
        print(f"URL: {response.url}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Get customers (with slash) successful")
            print(f"   Total customers: {data.get('total', 0)}")
        else:
            print(f"❌ Get customers (with slash) failed: {response.text}")
    except Exception as e:
        print(f"❌ Get customers (with slash) error: {e}")
    
    # Step 4: Test stats endpoint
    print("\n4. Testing GET /api/customers/stats...")
    try:
        response = requests.get(f"{CUSTOMERS_URL}/stats", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Get stats successful")
            print(f"   Total customers: {data.get('total_customers', 0)}")
        else:
            print(f"❌ Get stats failed: {response.text}")
    except Exception as e:
        print(f"❌ Get stats error: {e}")

if __name__ == "__main__":
    test_customer_api()
