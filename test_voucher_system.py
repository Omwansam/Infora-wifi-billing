#!/usr/bin/env python3
"""
Test script for the voucher system
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
VOUCHERS_URL = f"{BASE_URL}/api/vouchers"

def test_voucher_system():
    print("🧪 Testing Voucher System...")
    
    # Test 1: Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/api/test")
        if response.status_code == 200:
            print("✅ Server is running")
        else:
            print("❌ Server is not responding correctly")
            return
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to server. Make sure the Flask server is running.")
        return
    
    # Test 2: Login to get JWT token
    login_data = {
        "email": "admin1@infora.com",
        "password": "admin123"
    }
    
    try:
        response = requests.post(LOGIN_URL, json=login_data)
        if response.status_code == 200:
            token = response.json().get('access_token')
            print("✅ Login successful")
        else:
            print(f"❌ Login failed: {response.status_code}")
            print(response.text)
            return
    except Exception as e:
        print(f"❌ Login error: {e}")
        return
    
    # Set up headers for authenticated requests
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Test 3: Get vouchers
    try:
        response = requests.get(VOUCHERS_URL, headers=headers)
        if response.status_code == 200:
            vouchers = response.json()
            print(f"✅ Retrieved {len(vouchers.get('vouchers', []))} vouchers")
        else:
            print(f"❌ Failed to get vouchers: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Error getting vouchers: {e}")
    
    # Test 4: Get voucher stats
    try:
        response = requests.get(f"{VOUCHERS_URL}/stats", headers=headers)
        if response.status_code == 200:
            stats = response.json()
            print(f"✅ Retrieved voucher stats: {stats}")
        else:
            print(f"❌ Failed to get stats: {response.status_code}")
    except Exception as e:
        print(f"❌ Error getting stats: {e}")
    
    # Test 5: Create a test voucher
    test_voucher = {
        "voucher_type": "percentage",
        "voucher_value": 15.0,
        "expiry_date": (datetime.now() + timedelta(days=30)).isoformat(),
        "max_usage": 5,
        "is_active": True
    }
    
    try:
        response = requests.post(VOUCHERS_URL, json=test_voucher, headers=headers)
        if response.status_code == 201:
            created_voucher = response.json()
            print(f"✅ Created test voucher: {created_voucher.get('voucher', {}).get('voucher_code')}")
            
            # Test 6: Validate the voucher (public endpoint)
            voucher_code = created_voucher.get('voucher', {}).get('voucher_code')
            if voucher_code:
                validate_data = {"voucher_code": voucher_code}
                response = requests.post(f"{VOUCHERS_URL}/validate", json=validate_data)
                if response.status_code == 200:
                    validation = response.json()
                    if validation.get('valid'):
                        print(f"✅ Voucher validation successful: {voucher_code}")
                    else:
                        print(f"❌ Voucher validation failed: {validation.get('message')}")
                else:
                    print(f"❌ Validation request failed: {response.status_code}")
        else:
            print(f"❌ Failed to create voucher: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"❌ Error creating voucher: {e}")
    
    print("\n🎉 Voucher system test completed!")

if __name__ == "__main__":
    test_voucher_system()
