#!/usr/bin/env python3
"""
Script to add sample invoice data to the database
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.server.app import app
from backend.server.extensions import db
from backend.server.models import Invoice, Customer, InvoiceStatus
from datetime import datetime, timedelta
import uuid

def add_test_invoices():
    with app.app_context():
        # Check if we have customers
        customers = Customer.query.all()
        if not customers:
            print("❌ No customers found. Please add customers first.")
            return
        
        print(f"✅ Found {len(customers)} customers")
        
        # Check if we already have invoices
        existing_invoices = Invoice.query.count()
        if existing_invoices > 0:
            print(f"✅ Database already has {existing_invoices} invoices")
            return
        
        # Create sample invoices
        sample_invoices = []
        
        for i, customer in enumerate(customers[:3]):  # Use first 3 customers
            # Generate invoice number
            invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
            
            # Create invoice with different statuses
            statuses = [InvoiceStatus.PENDING, InvoiceStatus.PAID, InvoiceStatus.OVERDUE]
            status = statuses[i % len(statuses)]
            
            # Calculate dates
            created_date = datetime.now() - timedelta(days=i * 10)
            due_date = created_date + timedelta(days=30)
            paid_date = None
            
            if status == InvoiceStatus.PAID:
                paid_date = due_date - timedelta(days=5)
            
            # Create invoice
            invoice = Invoice(
                invoice_number=invoice_number,
                customer_id=customer.id,
                amount=1000.00 + (i * 500),  # Different amounts
                status=status,
                due_date=due_date,
                paid_date=paid_date,
                notes=f"Sample invoice for {customer.full_name} - Invoice #{i+1}",
                created_at=created_date,
                updated_at=created_date
            )
            
            sample_invoices.append(invoice)
            print(f"   Created invoice {invoice_number} for {customer.full_name} - ${invoice.amount}")
        
        # Add to database
        try:
            db.session.add_all(sample_invoices)
            db.session.commit()
            print(f"✅ Successfully added {len(sample_invoices)} test invoices")
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error adding invoices: {e}")

if __name__ == "__main__":
    add_test_invoices()
