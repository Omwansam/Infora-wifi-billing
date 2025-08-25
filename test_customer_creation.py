#!/usr/bin/env python3
"""
Test script to verify customer creation API
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
CUSTOMERS_URL = f"{BASE_URL}/api/customers"

def test_customer_creation():
    print("Testing Customer Creation API...")
    
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
    
    # Step 2: Test creating a customer
    print("\n2. Testing POST /api/customers...")
    customer_data = {
        "name": "Test Customer",
        "email": "test@example.com",
        "phone": "+254700123456",
        "address": "123 Test Street, Nairobi",
        "package": "Basic WiFi",
        "status": "active",
        "balance": 0.00,
        "usage_percentage": 0,
        "device_count": 1
    }
    
    try:
        response = requests.post(CUSTOMERS_URL, json=customer_data, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 201:
            data = response.json()
            print("✅ Create customer successful")
            print(f"   Customer ID: {data.get('customer', {}).get('id')}")
            print(f"   Customer name: {data.get('customer', {}).get('name')}")
        else:
            print(f"❌ Create customer failed")
    except Exception as e:
        print(f"❌ Create customer error: {e}")
    
    # Step 3: Test creating a customer with trailing slash
    print("\n3. Testing POST /api/customers/...")
    customer_data2 = {
        "name": "Test Customer 2",
        "email": "test2@example.com",
        "phone": "+254700123457",
        "address": "456 Test Street, Mombasa",
        "package": "Premium WiFi",
        "status": "active",
        "balance": 0.00,
        "usage_percentage": 0,
        "device_count": 2
    }
    
    try:
        response = requests.post(f"{CUSTOMERS_URL}/", json=customer_data2, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 201:
            data = response.json()
            print("✅ Create customer (with slash) successful")
            print(f"   Customer ID: {data.get('customer', {}).get('id')}")
            print(f"   Customer name: {data.get('customer', {}).get('name')}")
        else:
            print(f"❌ Create customer (with slash) failed")
    except Exception as e:
        print(f"❌ Create customer (with slash) error: {e}")

if __name__ == "__main__":
    test_customer_creation()
