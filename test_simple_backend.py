#!/usr/bin/env python3
"""
Simple test to check if backend server is running
"""

import requests

def test_simple_backend():
    print("🧪 Testing Simple Backend Connection...")
    
    try:
        # Test the basic test endpoint
        response = requests.get("http://localhost:5000/api/test")
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Backend server is running and accessible")
        else:
            print("❌ Backend server returned unexpected status")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend server")
        print("Please make sure the Flask server is running on http://localhost:5000")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    test_simple_backend()
