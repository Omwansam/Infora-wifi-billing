#!/usr/bin/env python3
"""
Test script to verify enhanced customer statistics API
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
CUSTOMERS_URL = f"{BASE_URL}/api/customers"
STATS_URL = f"{BASE_URL}/api/customers/stats"

def test_enhanced_stats():
    print("Testing Enhanced Customer Statistics API...")
    
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
    
    # Step 2: Test enhanced stats endpoint
    print("\n2. Testing GET /api/customers/stats...")
    try:
        response = requests.get(STATS_URL, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Get enhanced stats successful")
            print(f"   Total customers: {data.get('total_customers', 0)}")
            print(f"   Active customers: {data.get('active_customers', 0)}")
            print(f"   Suspended customers: {data.get('suspended_customers', 0)}")
            print(f"   Pending customers: {data.get('pending_customers', 0)}")
            print(f"   Average balance: {data.get('average_balance', 0)}")
            print(f"   Total balance: {data.get('total_balance', 0)}")
            print(f"   Customers with balance: {data.get('customers_with_balance', 0)}")
            print(f"   Average usage: {data.get('average_usage', 0)}%")
            
            # Check if new fields are present
            if 'total_balance' in data:
                print("✅ New field 'total_balance' present")
            else:
                print("❌ New field 'total_balance' missing")
                
            if 'customers_with_balance' in data:
                print("✅ New field 'customers_with_balance' present")
            else:
                print("❌ New field 'customers_with_balance' missing")
                
            if 'average_usage' in data:
                print("✅ New field 'average_usage' present")
            else:
                print("❌ New field 'average_usage' missing")
                
        else:
            print(f"❌ Get enhanced stats failed: {response.text}")
    except Exception as e:
        print(f"❌ Get enhanced stats error: {e}")
    
    # Step 3: Test creating a customer to see stats update
    print("\n3. Testing customer creation to verify stats update...")
    customer_data = {
        "name": "Stats Test Customer",
        "email": "stats.test@example.com",
        "phone": "+254700123458",
        "address": "789 Stats Test Street, Nairobi",
        "package": "Premium WiFi",
        "status": "active",
        "balance": 5000.00,
        "usage_percentage": 75,
        "device_count": 3
    }
    
    try:
        response = requests.post(CUSTOMERS_URL, json=customer_data, headers=headers)
        if response.status_code == 201:
            print("✅ Created test customer successfully")
            
            # Get updated stats
            print("\n4. Getting updated stats after customer creation...")
            stats_response = requests.get(STATS_URL, headers=headers)
            if stats_response.status_code == 200:
                updated_data = stats_response.json()
                print("✅ Updated stats retrieved")
                print(f"   New total customers: {updated_data.get('total_customers', 0)}")
                print(f"   New total balance: {updated_data.get('total_balance', 0)}")
                print(f"   New customers with balance: {updated_data.get('customers_with_balance', 0)}")
            else:
                print(f"❌ Failed to get updated stats: {stats_response.text}")
        else:
            print(f"❌ Failed to create test customer: {response.text}")
    except Exception as e:
        print(f"❌ Customer creation error: {e}")

if __name__ == "__main__":
    test_enhanced_stats()
