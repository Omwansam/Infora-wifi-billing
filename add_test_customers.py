#!/usr/bin/env python3
"""
Script to add test customers to the database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.server.app import app
from backend.server.models import Customer, CustomerStatus
from backend.server.extensions import db

def add_test_customers():
    with app.app_context():
        # Check if customers already exist
        existing_count = Customer.query.count()
        if existing_count > 0:
            print(f"Database already has {existing_count} customers")
            return
        
        # Create test customers
        test_customers = [
            {
                'full_name': 'John Doe',
                'email': 'john.doe@example.com',
                'phone': '+254700123456',
                'address': '123 Main St, Nairobi',
                'status': CustomerStatus.ACTIVE,
                'package': 'Premium WiFi',
                'balance': 0.00,
                'usage_percentage': 75,
                'device_count': 3
            },
            {
                'full_name': 'Jane Smith',
                'email': 'jane.smith@example.com',
                'phone': '+254700123457',
                'address': '456 Oak Ave, Mombasa',
                'status': CustomerStatus.ACTIVE,
                'package': 'Standard WiFi',
                'balance': 2500.00,
                'usage_percentage': 45,
                'device_count': 2
            },
            {
                'full_name': 'Mike Johnson',
                'email': 'mike.johnson@example.com',
                'phone': '+254700123458',
                'address': '789 Pine Rd, Kisumu',
                'status': CustomerStatus.SUSPENDED,
                'package': 'Basic WiFi',
                'balance': 5000.00,
                'usage_percentage': 0,
                'device_count': 1
            },
            {
                'full_name': 'Sarah Wilson',
                'email': 'sarah.wilson@example.com',
                'phone': '+254700123459',
                'address': '321 Elm St, Nakuru',
                'status': CustomerStatus.ACTIVE,
                'package': 'Premium WiFi',
                'balance': 0.00,
                'usage_percentage': 92,
                'device_count': 4
            },
            {
                'full_name': 'David Brown',
                'email': 'david.brown@example.com',
                'phone': '+254700123460',
                'address': '654 Maple Dr, Eldoret',
                'status': CustomerStatus.PENDING,
                'package': 'Standard WiFi',
                'balance': 7500.00,
                'usage_percentage': 0,
                'device_count': 2
            }
        ]
        
        for customer_data in test_customers:
            customer = Customer(**customer_data)
            db.session.add(customer)
            print(f"Adding customer: {customer_data['full_name']}")
        
        db.session.commit()
        print(f"Successfully added {len(test_customers)} test customers to the database")

if __name__ == "__main__":
    add_test_customers()
