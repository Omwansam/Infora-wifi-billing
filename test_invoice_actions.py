#!/usr/bin/env python3
"""
Test script to verify all invoice actions (delete, download, send reminder)
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
INVOICES_URL = f"{BASE_URL}/api/invoices"

def test_invoice_actions():
    print("Testing Invoice Actions (Delete, Download, Send Reminder)...")
    
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
                print(f"✅ Found invoice {invoice_id} for testing")
            else:
                print("❌ No invoices found to test with")
                return
        else:
            print(f"❌ Failed to get invoices: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Error getting invoices: {e}")
        return
    
    # Step 3: Test Send Reminder
    print(f"\n3. Testing Send Reminder for invoice {invoice_id}...")
    try:
        response = requests.post(f"{INVOICES_URL}/{invoice_id}/send-reminder", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Send reminder successful")
            print(f"   Message: {data.get('message')}")
        else:
            print(f"❌ Send reminder failed: {response.text}")
    except Exception as e:
        print(f"❌ Send reminder error: {e}")
    
    # Step 4: Test Download Invoice
    print(f"\n4. Testing Download Invoice for invoice {invoice_id}...")
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
    
    # Step 5: Test Generate PDF
    print(f"\n5. Testing Generate PDF for invoice {invoice_id}...")
    try:
        response = requests.get(f"{INVOICES_URL}/{invoice_id}/pdf", headers=headers)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Generate PDF successful")
            print(f"   Content length: {len(response.text)} characters")
            print(f"   Content preview: {response.text[:200]}...")
        else:
            print(f"❌ Generate PDF failed: {response.text}")
    except Exception as e:
        print(f"❌ Generate PDF error: {e}")
    
    # Step 6: Test Delete Invoice (only if we have multiple invoices)
    print(f"\n6. Testing Delete Invoice...")
    try:
        # Get invoices again to check count
        response = requests.get(INVOICES_URL, headers=headers)
        if response.status_code == 200:
            data = response.json()
            total_invoices = data.get('total', 0)
            
            if total_invoices > 1:
                # Delete the test invoice
                response = requests.delete(f"{INVOICES_URL}/{invoice_id}", headers=headers)
                print(f"Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print("✅ Delete invoice successful")
                    print(f"   Message: {data.get('message')}")
                    
                    # Verify deletion
                    response = requests.get(f"{INVOICES_URL}/{invoice_id}", headers=headers)
                    if response.status_code == 404:
                        print("✅ Invoice successfully deleted (404 on get)")
                    else:
                        print("⚠️  Invoice may not have been deleted properly")
                else:
                    print(f"❌ Delete invoice failed: {response.text}")
            else:
                print("⚠️  Skipping delete test (only one invoice available)")
        else:
            print(f"❌ Failed to get invoices for delete test: {response.status_code}")
    except Exception as e:
        print(f"❌ Delete invoice error: {e}")
    
    print("\n🎉 Invoice actions test completed!")

if __name__ == "__main__":
    test_invoice_actions()
