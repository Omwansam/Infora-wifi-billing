#!/usr/bin/env python3
"""
Test script to check backend connectivity and voucher endpoints
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"

def test_backend_connection():
    print("🧪 Testing Backend Connection...")
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/api/test")
        print(f"✅ Server response status: {response.status_code}")
        print(f"✅ Server response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Backend server is running")
        else:
            print("❌ Backend server is not responding correctly")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure the Flask server is running on http://localhost:5000")
        return False
    except Exception as e:
        print(f"❌ Error connecting to server: {e}")
        return False
    
    # Test 2: Check voucher endpoints (without authentication)
    try:
        response = requests.get(f"{BASE_URL}/api/vouchers/")
        print(f"✅ Vouchers endpoint status: {response.status_code}")
        print(f"✅ Vouchers endpoint response: {response.text[:200]}...")
        
        if response.status_code == 401:
            print("✅ Vouchers endpoint exists (requires authentication)")
        elif response.status_code == 200:
            print("✅ Vouchers endpoint accessible")
        else:
            print(f"❌ Vouchers endpoint returned unexpected status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing vouchers endpoint: {e}")
    
    # Test 3: Check voucher stats endpoint
    try:
        response = requests.get(f"{BASE_URL}/api/vouchers/stats")
        print(f"✅ Voucher stats endpoint status: {response.status_code}")
        print(f"✅ Voucher stats endpoint response: {response.text[:200]}...")
        
        if response.status_code == 401:
            print("✅ Voucher stats endpoint exists (requires authentication)")
        elif response.status_code == 200:
            print("✅ Voucher stats endpoint accessible")
        else:
            print(f"❌ Voucher stats endpoint returned unexpected status: {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing voucher stats endpoint: {e}")
    
    return True

if __name__ == "__main__":
    test_backend_connection()
