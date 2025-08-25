#!/usr/bin/env python3
"""
Test script to verify CORS and OPTIONS handling
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
CUSTOMERS_URL = f"{BASE_URL}/api/customers"

def test_cors_fix():
    print("Testing CORS and OPTIONS handling...")
    
    # Test 1: OPTIONS request to customers endpoint
    print("\n1. Testing OPTIONS /api/customers...")
    try:
        response = requests.options(CUSTOMERS_URL)
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        if response.status_code == 200:
            print("✅ OPTIONS request successful")
        else:
            print(f"❌ OPTIONS request failed: {response.text}")
    except Exception as e:
        print(f"❌ OPTIONS request error: {e}")
    
    # Test 2: OPTIONS request to customers endpoint with trailing slash
    print("\n2. Testing OPTIONS /api/customers/...")
    try:
        response = requests.options(f"{CUSTOMERS_URL}/")
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        if response.status_code == 200:
            print("✅ OPTIONS request (with slash) successful")
        else:
            print(f"❌ OPTIONS request (with slash) failed: {response.text}")
    except Exception as e:
        print(f"❌ OPTIONS request (with slash) error: {e}")
    
    # Test 3: OPTIONS request to stats endpoint
    print("\n3. Testing OPTIONS /api/customers/stats...")
    try:
        response = requests.options(f"{CUSTOMERS_URL}/stats")
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        if response.status_code == 200:
            print("✅ OPTIONS request to stats successful")
        else:
            print(f"❌ OPTIONS request to stats failed: {response.text}")
    except Exception as e:
        print(f"❌ OPTIONS request to stats error: {e}")
    
    # Test 4: GET request to customers endpoint (should work after OPTIONS)
    print("\n4. Testing GET /api/customers (after OPTIONS)...")
    try:
        response = requests.get(CUSTOMERS_URL)
        print(f"Status: {response.status_code}")
        if response.status_code in [200, 401]:  # 401 is expected without auth
            print("✅ GET request successful (status code as expected)")
        else:
            print(f"❌ GET request failed: {response.text}")
    except Exception as e:
        print(f"❌ GET request error: {e}")

if __name__ == "__main__":
    test_cors_fix()
