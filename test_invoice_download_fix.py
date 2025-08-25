#!/usr/bin/env python3
"""
Test script to verify invoice download functionality is working
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
INVOICES_URL = f"{BASE_URL}/api/invoices"

def test_invoice_download():
    print("Testing Invoice Download Functionality...")
    
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
    
    # Step 2: Get invoices to find one to test with
    print("\n2. Getting invoices...")
    try:
        response = requests.get(INVOICES_URL, headers=headers)
        if response.status_code == 200:
            data = response.json()
            invoices = data.get('invoices', [])
            if invoices:
                test_invoice = invoices[0]
                invoice_id = test_invoice.get('invoice_id') or test_invoice.get('id')
                invoice_number = test_invoice.get('id')  # This is the invoice_number
                print(f"✅ Found invoice {invoice_id} ({invoice_number}) for testing")
            else:
                print("❌ No invoices found to test with")
                return
        else:
            print(f"❌ Failed to get invoices: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Error getting invoices: {e}")
        return
    
    # Step 3: Test Download Invoice
    print(f"\n3. Testing Download Invoice for invoice {invoice_id}...")
    try:
        response = requests.get(f"{INVOICES_URL}/{invoice_id}/download", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Download invoice successful")
            print(f"   Message: {data.get('message')}")
            print(f"   Download URL: {data.get('download_url')}")
        else:
            print(f"❌ Download invoice failed: {response.text}")
    except Exception as e:
        print(f"❌ Download invoice error: {e}")
    
    # Step 4: Test Generate PDF
    print(f"\n4. Testing Generate PDF for invoice {invoice_id}...")
    try:
        response = requests.get(f"{INVOICES_URL}/{invoice_id}/pdf", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Generate PDF successful")
            print(f"   Content length: {len(response.text)} characters")
            print(f"   Content type: {response.headers.get('Content-Type', 'Unknown')}")
            print(f"   Content preview: {response.text[:200]}...")
            
            # Check if it's valid text content
            if "INVOICE" in response.text and "Invoice Number:" in response.text:
                print("✅ Content appears to be valid invoice text")
            else:
                print("⚠️  Content may not be in expected format")
        else:
            print(f"❌ Generate PDF failed: {response.text}")
    except Exception as e:
        print(f"❌ Generate PDF error: {e}")
    
    print("\n🎉 Invoice download test completed!")

if __name__ == "__main__":
    test_invoice_download()
