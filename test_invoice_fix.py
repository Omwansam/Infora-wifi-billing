#!/usr/bin/env python3
"""
Test script to verify invoice API functionality after CORS fixes
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
INVOICES_URL = f"{BASE_URL}/api/invoices"

def test_invoice_api():
    print("Testing Invoice API Functionality After CORS Fixes...")
    
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
    
    # Step 2: Test OPTIONS request (CORS preflight)
    print("\n2. Testing OPTIONS /api/invoices (CORS preflight)...")
    try:
        response = requests.options(INVOICES_URL)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ OPTIONS request successful")
            print(f"   CORS headers: {dict(response.headers)}")
        else:
            print(f"❌ OPTIONS request failed: {response.text}")
    except Exception as e:
        print(f"❌ OPTIONS request error: {e}")
    
    # Step 3: Test GET invoices
    print("\n3. Testing GET /api/invoices...")
    try:
        response = requests.get(INVOICES_URL, headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Get invoices successful")
            print(f"   Total invoices: {data.get('total', 0)}")
            print(f"   Current page: {data.get('current_page', 0)}")
            print(f"   Invoices returned: {len(data.get('invoices', []))}")
            
            # Show first invoice structure if available
            if data.get('invoices'):
                first_invoice = data['invoices'][0]
                print(f"   First invoice structure:")
                print(f"     ID: {first_invoice.get('id')}")
                print(f"     Customer: {first_invoice.get('customerName')}")
                print(f"     Amount: {first_invoice.get('amount')}")
                print(f"     Status: {first_invoice.get('status')}")
        else:
            print(f"❌ Get invoices failed: {response.text}")
    except Exception as e:
        print(f"❌ Get invoices error: {e}")
    
    # Step 4: Test GET invoice stats
    print("\n4. Testing GET /api/invoices/stats...")
    try:
        response = requests.get(f"{INVOICES_URL}/stats", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Get invoice stats successful")
            print(f"   Total invoices: {data.get('total_invoices', 0)}")
            print(f"   Pending invoices: {data.get('pending_invoices', 0)}")
            print(f"   Paid invoices: {data.get('paid_invoices', 0)}")
            print(f"   Overdue invoices: {data.get('overdue_invoices', 0)}")
            print(f"   Total amount: {data.get('total_amount', 0)}")
        else:
            print(f"❌ Get invoice stats failed: {response.text}")
    except Exception as e:
        print(f"❌ Get invoice stats error: {e}")
    
    # Step 5: Test GET pending invoices
    print("\n5. Testing GET /api/invoices/pending...")
    try:
        response = requests.get(f"{INVOICES_URL}/pending", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Get pending invoices successful")
            print(f"   Pending invoices: {data.get('total', 0)}")
        else:
            print(f"❌ Get pending invoices failed: {response.text}")
    except Exception as e:
        print(f"❌ Get pending invoices error: {e}")
    
    # Step 6: Test GET overdue invoices
    print("\n6. Testing GET /api/invoices/overdue...")
    try:
        response = requests.get(f"{INVOICES_URL}/overdue", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Get overdue invoices successful")
            print(f"   Overdue invoices: {data.get('total', 0)}")
        else:
            print(f"❌ Get overdue invoices failed: {response.text}")
    except Exception as e:
        print(f"❌ Get overdue invoices error: {e}")
    
    # Step 7: Test search functionality
    print("\n7. Testing search functionality...")
    try:
        response = requests.get(f"{INVOICES_URL}?search=test", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Search functionality working")
            print(f"   Search results: {data.get('total', 0)}")
        else:
            print(f"❌ Search failed: {response.text}")
    except Exception as e:
        print(f"❌ Search error: {e}")
    
    print("\n🎉 Invoice API test completed!")

if __name__ == "__main__":
    test_invoice_api()
