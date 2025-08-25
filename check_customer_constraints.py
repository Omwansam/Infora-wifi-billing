#!/usr/bin/env python3
"""
Script to check customer database constraints and relationships
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.server.app import app
from backend.server.models import Customer, Invoice, Payment, Ticket, Transaction, RevenueData
from backend.server.extensions import db

def check_customer_constraints():
    print("Checking Customer Database Constraints...")
    
    with app.app_context():
        try:
            # Check if customer table exists
            print("1. Checking customer table...")
            customer_count = Customer.query.count()
            print(f"   ✅ Customer table exists with {customer_count} records")
            
            # Check for customers with related data
            print("\n2. Checking customers with related data...")
            
            customers_with_invoices = Customer.query.join(Invoice).distinct().count()
            customers_with_payments = Customer.query.join(Payment).distinct().count()
            customers_with_tickets = Customer.query.join(Ticket).distinct().count()
            customers_with_transactions = Customer.query.join(Transaction).distinct().count()
            customers_with_revenue = Customer.query.join(RevenueData).distinct().count()
            
            print(f"   Customers with invoices: {customers_with_invoices}")
            print(f"   Customers with payments: {customers_with_payments}")
            print(f"   Customers with tickets: {customers_with_tickets}")
            print(f"   Customers with transactions: {customers_with_transactions}")
            print(f"   Customers with revenue data: {customers_with_revenue}")
            
            # Find a customer without related data for testing
            print("\n3. Finding customers without related data...")
            customers_without_relations = []
            
            for customer in Customer.query.all():
                invoice_count = customer.invoices.count()
                payment_count = customer.payments.count()
                ticket_count = customer.tickets.count()
                transaction_count = customer.transactions.count()
                revenue_count = customer.revenue_data.count()
                
                total_relations = invoice_count + payment_count + ticket_count + transaction_count + revenue_count
                
                if total_relations == 0:
                    customers_without_relations.append(customer)
                    print(f"   ✅ Customer {customer.id} ({customer.full_name}) has no related data")
                    break
            
            if not customers_without_relations:
                print("   ⚠️  All customers have related data")
                
                # Show first customer with minimal relations
                first_customer = Customer.query.first()
                if first_customer:
                    print(f"   Testing with customer {first_customer.id} ({first_customer.full_name})")
                    print(f"   Relations: Invoices={first_customer.invoices.count()}, Payments={first_customer.payments.count()}, Tickets={first_customer.tickets.count()}")
            
            # Test database constraints
            print("\n4. Testing database constraints...")
            try:
                # Try to get a customer
                test_customer = Customer.query.first()
                if test_customer:
                    print(f"   ✅ Can query customer: {test_customer.full_name}")
                    
                    # Test relationship access
                    try:
                        invoice_count = test_customer.invoices.count()
                        print(f"   ✅ Can access invoices relationship: {invoice_count} invoices")
                    except Exception as e:
                        print(f"   ❌ Error accessing invoices: {e}")
                    
                    try:
                        payment_count = test_customer.payments.count()
                        print(f"   ✅ Can access payments relationship: {payment_count} payments")
                    except Exception as e:
                        print(f"   ❌ Error accessing payments: {e}")
                    
                    try:
                        ticket_count = test_customer.tickets.count()
                        print(f"   ✅ Can access tickets relationship: {ticket_count} tickets")
                    except Exception as e:
                        print(f"   ❌ Error accessing tickets: {e}")
                    
                else:
                    print("   ⚠️  No customers found in database")
                    
            except Exception as e:
                print(f"   ❌ Error testing database: {e}")
            
            print("\n5. Database constraint check completed!")
            
        except Exception as e:
            print(f"❌ Error during constraint check: {e}")

if __name__ == "__main__":
    check_customer_constraints()
