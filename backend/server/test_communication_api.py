"""
Test script for communication API endpoints
"""
import requests
import json

BASE_URL = "http://localhost:5000"

def test_email_providers():
    """Test email providers endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/communication/email-providers")
        print(f"Email Providers Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def test_sms_providers():
    """Test SMS providers endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/communication/sms-providers")
        print(f"SMS Providers Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def test_email_templates():
    """Test email templates endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/communication/email-templates")
        print(f"Email Templates Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

def test_sms_templates():
    """Test SMS templates endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/communication/sms-templates")
        print(f"SMS Templates Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    print("Testing Communication API Endpoints...")
    print("=" * 50)
    
    test_email_providers()
    print("-" * 30)
    test_sms_providers()
    print("-" * 30)
    test_email_templates()
    print("-" * 30)
    test_sms_templates()
