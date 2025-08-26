#!/usr/bin/env python3
"""
Database Seeder for Infora WiFi Billing System
This script populates the database with mock data for development and testing.

Usage:
    python seed.py

Features:
    - Creates admin and staff user accounts
    - Populates service plans with Kenyan Shilling (KES) pricing
    - Adds sample customers with realistic data
    - Creates invoices, payments, and billing history
    - Sets up network infrastructure (Mikrotik devices, zones)
    - Adds support tickets and system settings
    - Includes vouchers and promotional codes

Currency: All prices are in Kenyan Shillings (KES)
"""

import os
import sys
from datetime import datetime, timedelta

from flask import Flask
from extensions import db
from config import Config
from models import (
    User, Customer, ServicePlan, Invoice, InvoiceItem, Payment, 
    MikrotikDevice, Ticket, TicketMessage, CustomerDevice, 
    CustomerNote, CustomerDocument, Notification, Voucher,
    Transaction, SystemLog, RevenueData, RadiusSession,
    RadiusCheck, RadiusReply, RadiusGroup, RadiusUserGroup,
    NetworkInfrastructure, NetworkZone, BillingCycle, TaxRate,
    Discount, InvoiceDiscount, AuditLog, BackupSchedule, SystemSetting,
    CustomerStatus, InvoiceStatus, PaymentStatus, VoucherStatus,
    DeviceStatus, InfrastructureStatus, TicketStatus, TicketPriority,
    CustomerNoteType, NotificationPriority
)
from werkzeug.security import generate_password_hash

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))



def create_app():
    """Create Flask application context"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Initialize extensions
    db.init_app(app)
    
    return app

def seed_users():
    """Seed users and admin accounts"""
    print("🌱 Seeding users and admin accounts...")
    
    # Admin users
    admin_users = [
        {
            'email': 'admin1@infora.com',
            'password': 'admin123',
            'first_name': 'System',
            'last_name': 'Administrator',
            'role': 'admin',
            'is_active': True
        },
        {
            'email': 'superadmin@infora.com',
            'password': 'superadmin123',
            'first_name': 'Super',
            'last_name': 'Admin',
            'role': 'admin',
            'is_active': True
        }
    ]
    
    # Regular users
    regular_users = [
        {
            'email': 'support@infora.com',
            'password': 'support123',
            'first_name': 'Support',
            'last_name': 'Team',
            'role': 'support',
            'is_active': True
        },
        {
            'email': 'billing@infora.com',
            'password': 'billing123',
            'first_name': 'Billing',
            'last_name': 'Team',
            'role': 'billing',
            'is_active': True
        },
        {
            'email': 'tech@infora.com',
            'password': 'tech123',
            'first_name': 'Technical',
            'last_name': 'Team',
            'role': 'technical',
            'is_active': True
        }
    ]
    
    all_users = admin_users + regular_users
    
    for user_data in all_users:
        # Check if user already exists
        existing_user = User.query.filter_by(email=user_data['email']).first()
        if not existing_user:
            user = User(
                email=user_data['email'],
                password_hash=generate_password_hash(user_data['password']),
                first_name=user_data['first_name'],
                last_name=user_data['last_name'],
                role=user_data['role'],
                is_active=user_data['is_active'],
                created_at=datetime.now(),
                updated_at=datetime.now(),
                last_login=datetime.now()
            )
            db.session.add(user)
            print(f"  ✓ Created user: {user_data['email']}")
        else:
            print(f"  ℹ User already exists: {user_data['email']}")
    
    db.session.commit()
    print("✅ Users seeded successfully!")

def seed_service_plans():
    """Seed service plans"""
    print("🌱 Seeding service plans...")
    
    service_plans = [
        {
            'name': 'Basic 50Mbps',
            'speed': '50 Mbps',
            'price': 4999.00,
            'features': {
                'download_speed': '50 Mbps',
                'upload_speed': '10 Mbps',
                'devices': 1,
                'support': 'Basic Support',
                'data_cap': 'Unlimited'
            },
            'popular': False,
            'is_active': True
        },
        {
            'nameflask run: 'Premium 100Mbps',
            'speed': '100 Mbps',
            'price': 7999.00,
            'features': {
                'download_speed': '100 Mbps',
                'upload_speed': '20 Mbps',
                'devices': 5,
                'support': 'Priority Support',
                'data_cap': 'Unlimited'
            },
            'popular': True,
            'is_active': True
        },
        {
            'name': 'Business 200Mbps',
            'speed': '200 Mbps',
            'price': 14999.00,
            'features': {
                'download_speed': '200 Mbps',
                'upload_speed': '50 Mbps',
                'devices': 'Unlimited',
                'support': '24/7 Support',
                'data_cap': 'Unlimited'
            },
            'popular': False,
            'is_active': True
        },
        {
            'name': 'Enterprise 500Mbps',
            'speed': '500 Mbps',
            'price': 29999.00,
            'features': {
                'download_speed': '500 Mbps',
                'upload_speed': '100 Mbps',
                'devices': 'Unlimited',
                'support': '24/7 Support',
                'data_cap': 'Unlimited',
                'static_ip': True,
                'free_router': True,
                'sla_guarantee': True,
                'dedicated_support': True
            },
            'popular': False,
            'is_active': True
        },
        {
            'name': 'Student 25Mbps',
            'speed': '25 Mbps',
            'price': 1999.00,
            'features': {
                'download_speed': '25 Mbps',
                'upload_speed': '5 Mbps',
                'devices': 1,
                'support': 'Basic Support',
                'data_cap': 'Unlimited',
                'student_discount': True
            },
            'popular': False,
            'is_active': True
        },
        {
            'name': 'Senior 25Mbps',
            'speed': '25 Mbps',
            'price': 2499.00,
            'features': {
                'download_speed': '25 Mbps',
                'upload_speed': '5 Mbps',
                'devices': 1,
                'support': 'Basic Support',
                'data_cap': 'Unlimited',
                'senior_discount': True,
                'easy_setup': True
            },
            'popular': False,
            'is_active': True
        }
    ]
    
    for plan_data in service_plans:
        existing_plan = ServicePlan.query.filter_by(name=plan_data['name']).first()
        if not existing_plan:
            plan = ServicePlan(
                name=plan_data['name'],
                speed=plan_data['speed'],
                price=plan_data['price'],
                features=plan_data['features'],
                popular=plan_data['popular'],
                is_active=plan_data['is_active'],
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(plan)
            print(f"  ✓ Created plan: {plan_data['name']}")
        else:
            print(f"  ℹ Plan already exists: {plan_data['name']}")
    
    db.session.commit()
    print("✅ Service plans seeded successfully!")

def seed_customers():
    """Seed customers"""
    print("🌱 Seeding customers...")
    
    # Get service plans for foreign key relationships
    basic_plan = ServicePlan.query.filter_by(name='Basic 50Mbps').first()
    premium_plan = ServicePlan.query.filter_by(name='Premium 100Mbps').first()
    business_plan = ServicePlan.query.filter_by(name='Business 200Mbps').first()
    
    customers_data = [
        {
            'full_name': 'John Smith',
            'email': 'john.smith@email.com',
            'phone': '+1 (555) 123-4567',
            'address': '123 Main St, City, State 12345',
            'status': CustomerStatus.ACTIVE,
            'join_date': datetime(2024, 1, 15),
            'balance': 0.00,
            'package': 'Premium 100Mbps',
            'usage_percentage': 85,
            'device_count': 3,
            'last_payment_date': datetime(2024, 3, 1),
            'service_plan': premium_plan
        },
        {
            'full_name': 'Sarah Johnson',
            'email': 'sarah.j@email.com',
            'phone': '+1 (555) 234-5678',
            'address': '456 Oak Ave, City, State 12345',
            'status': CustomerStatus.ACTIVE,
            'join_date': datetime(2024, 2, 10),
            'balance': 2999.00,
            'package': 'Basic 50Mbps',
            'usage_percentage': 45,
            'device_count': 2,
            'last_payment_date': datetime(2024, 3, 5),
            'service_plan': basic_plan
        },
        {
            'full_name': 'Mike Wilson',
            'email': 'mike.w@email.com',
            'phone': '+1 (555) 345-6789',
            'address': '789 Pine Rd, City, State 12345',
            'status': CustomerStatus.SUSPENDED,
            'join_date': datetime(2023, 11, 20),
            'balance': 8997.00,
            'package': 'Premium 100Mbps',
            'usage_percentage': 0,
            'device_count': 0,
            'last_payment_date': datetime(2024, 2, 15),
            'service_plan': premium_plan
        },
        {
            'full_name': 'Emily Davis',
            'email': 'emily.d@email.com',
            'phone': '+1 (555) 456-7890',
            'address': '321 Elm St, City, State 12345',
            'status': CustomerStatus.ACTIVE,
            'join_date': datetime(2023, 9, 5),
            'balance': 0.00,
            'package': 'Business 200Mbps',
            'usage_percentage': 92,
            'device_count': 8,
            'last_payment_date': datetime(2024, 3, 10),
            'service_plan': business_plan
        },
        {
            'full_name': 'David Brown',
            'email': 'david.b@email.com',
            'phone': '+1 (555) 567-8901',
            'address': '654 Maple Dr, City, State 12345',
            'status': CustomerStatus.ACTIVE,
            'join_date': datetime(2024, 1, 30),
            'balance': 0.00,
            'package': 'Basic 50Mbps',
            'usage_percentage': 30,
            'device_count': 1,
            'last_payment_date': datetime(2024, 3, 8),
            'service_plan': basic_plan
        }
    ]
    
    for customer_data in customers_data:
        existing_customer = Customer.query.filter_by(email=customer_data['email']).first()
        if not existing_customer:
            customer = Customer(
                full_name=customer_data['full_name'],
                email=customer_data['email'],
                phone=customer_data['phone'],
                address=customer_data['address'],
                status=customer_data['status'],
                join_date=customer_data['join_date'],
                balance=customer_data['balance'],
                package=customer_data['package'],
                usage_percentage=customer_data['usage_percentage'],
                device_count=customer_data['device_count'],
                last_payment_date=customer_data['last_payment_date'],
                service_plan_id=customer_data['service_plan'].id if customer_data['service_plan'] else None,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(customer)
            print(f"  ✓ Created customer: {customer_data['full_name']}")
        else:
            print(f"  ℹ Customer already exists: {customer_data['full_name']}")
    
    db.session.commit()
    print("✅ Customers seeded successfully!")

def seed_invoices():
    """Seed invoices and invoice items"""
    print("🌱 Seeding invoices...")
    
    # Get customers for foreign key relationships
    customers = Customer.query.all()
    customer_map = {customer.full_name: customer for customer in customers}
    
    invoices_data = [
        {
            'invoice_number': 'INV-001',
            'customer_name': 'John Smith',
            'amount': 7999.00,
            'status': InvoiceStatus.PAID,
            'due_date': datetime(2024, 3, 1),
            'paid_date': datetime(2024, 3, 1),
            'notes': 'Premium plan monthly subscription',
            'items': [
                {'description': 'Premium 100Mbps Plan', 'quantity': 1, 'unit_price': 7999.00, 'total_price': 7999.00}
            ]
        },
        {
            'invoice_number': 'INV-002',
            'customer_name': 'Sarah Johnson',
            'amount': 4999.00,
            'status': InvoiceStatus.PAID,
            'due_date': datetime(2024, 3, 5),
            'paid_date': datetime(2024, 3, 5),
            'notes': 'Basic plan monthly subscription',
            'items': [
                {'description': 'Basic 50Mbps Plan', 'quantity': 1, 'unit_price': 4999.00, 'total_price': 4999.00}
            ]
        },
        {
            'invoice_number': 'INV-003',
            'customer_name': 'Mike Wilson',
            'amount': 7999.00,
            'status': InvoiceStatus.OVERDUE,
            'due_date': datetime(2024, 2, 15),
            'paid_date': None,
            'notes': 'Premium plan - payment overdue',
            'items': [
                {'description': 'Premium 100Mbps Plan', 'quantity': 1, 'unit_price': 7999.00, 'total_price': 7999.00}
            ]
        },
        {
            'invoice_number': 'INV-004',
            'customer_name': 'Emily Davis',
            'amount': 14999.00,
            'status': InvoiceStatus.PAID,
            'due_date': datetime(2024, 3, 10),
            'paid_date': datetime(2024, 3, 10),
            'notes': 'Business plan monthly subscription',
            'items': [
                {'description': 'Business 200Mbps Plan', 'quantity': 1, 'unit_price': 14999.00, 'total_price': 14999.00}
            ]
        },
        {
            'invoice_number': 'INV-005',
            'customer_name': 'David Brown',
            'amount': 4999.00,
            'status': InvoiceStatus.PAID,
            'due_date': datetime(2024, 3, 8),
            'paid_date': datetime(2024, 3, 8),
            'notes': 'Basic plan monthly subscription',
            'items': [
                {'description': 'Basic 50Mbps Plan', 'quantity': 1, 'unit_price': 4999.00, 'total_price': 4999.00}
            ]
        }
    ]
    
    for invoice_data in invoices_data:
        existing_invoice = Invoice.query.filter_by(invoice_number=invoice_data['invoice_number']).first()
        if not existing_invoice:
            customer = customer_map.get(invoice_data['customer_name'])
            if customer:
                invoice = Invoice(
                    invoice_number=invoice_data['invoice_number'],
                    amount=invoice_data['amount'],
                    status=invoice_data['status'],
                    due_date=invoice_data['due_date'],
                    paid_date=invoice_data['paid_date'],
                    notes=invoice_data['notes'],
                    customer_id=customer.id,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.session.add(invoice)
                db.session.flush()  # Get the invoice ID
                
                # Add invoice items
                for item_data in invoice_data['items']:
                    invoice_item = InvoiceItem(
                        description=item_data['description'],
                        quantity=item_data['quantity'],
                        unit_price=item_data['unit_price'],
                        total_price=item_data['total_price'],
                        invoice_id=invoice.id,
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    db.session.add(invoice_item)
                
                print(f"  ✓ Created invoice: {invoice_data['invoice_number']}")
            else:
                print(f"  ⚠ Customer not found: {invoice_data['customer_name']}")
        else:
            print(f"  ℹ Invoice already exists: {invoice_data['invoice_number']}")
    
    db.session.commit()
    print("✅ Invoices seeded successfully!")

def seed_payments():
    """Seed payments"""
    print("🌱 Seeding payments...")
    
    # Get customers and invoices for foreign key relationships
    customers = Customer.query.all()
    invoices = Invoice.query.all()
    customer_map = {customer.full_name: customer for customer in customers}
    invoice_map = {invoice.invoice_number: invoice for invoice in invoices}
    
    payments_data = [
        {
            'amount': 7999.00,
            'payment_method': 'credit_card',
            'payment_status': PaymentStatus.COMPLETED,
            'transaction_id': 'TXN-001',
            'payment_date': datetime(2024, 3, 1),
            'customer_name': 'John Smith',
            'invoice_number': 'INV-001'
        },
        {
            'amount': 4999.00,
            'payment_method': 'bank_transfer',
            'payment_status': PaymentStatus.COMPLETED,
            'transaction_id': 'TXN-002',
            'payment_date': datetime(2024, 3, 5),
            'customer_name': 'Sarah Johnson',
            'invoice_number': 'INV-002'
        },
        {
            'amount': 14999.00,
            'payment_method': 'credit_card',
            'payment_status': PaymentStatus.COMPLETED,
            'transaction_id': 'TXN-003',
            'payment_date': datetime(2024, 3, 10),
            'customer_name': 'Emily Davis',
            'invoice_number': 'INV-004'
        },
        {
            'amount': 4999.00,
            'payment_method': 'paypal',
            'payment_status': PaymentStatus.COMPLETED,
            'transaction_id': 'TXN-004',
            'payment_date': datetime(2024, 3, 8),
            'customer_name': 'David Brown',
            'invoice_number': 'INV-005'
        }
    ]
    
    for payment_data in payments_data:
        customer = customer_map.get(payment_data['customer_name'])
        invoice = invoice_map.get(payment_data['invoice_number'])
        
        if customer and invoice:
            payment = Payment(
                amount=payment_data['amount'],
                payment_method=payment_data['payment_method'],
                payment_status=payment_data['payment_status'],
                transaction_id=payment_data['transaction_id'],
                payment_date=payment_data['payment_date'],
                customer_id=customer.id,
                invoice_id=invoice.id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(payment)
            print(f"  ✓ Created payment: {payment_data['transaction_id']}")
        else:
            print(f"  ⚠ Customer or invoice not found for payment: {payment_data['transaction_id']}")
    
    db.session.commit()
    print("✅ Payments seeded successfully!")

def seed_mikrotik_devices():
    """Seed Mikrotik devices"""
    print("🌱 Seeding Mikrotik devices...")
    
    # Create network zones first
    zones_data = [
        {'zone_name': 'Zone A', 'zone_description': 'Downtown Area'},
        {'zone_name': 'Zone B', 'zone_description': 'Suburban Area'},
        {'zone_name': 'Zone C', 'zone_description': 'Industrial Area'}
    ]
    
    zones = {}
    for zone_data in zones_data:
        existing_zone = NetworkZone.query.filter_by(zone_name=zone_data['zone_name']).first()
        if not existing_zone:
            zone = NetworkZone(
                zone_name=zone_data['zone_name'],
                zone_description=zone_data['zone_description'],
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(zone)
            db.session.flush()
            zones[zone_data['zone_name']] = zone
            print(f"  ✓ Created zone: {zone_data['zone_name']}")
        else:
            zones[zone_data['zone_name']] = existing_zone
            print(f"  ℹ Zone already exists: {zone_data['zone_name']}")
    
    db.session.commit()
    
    # Create Mikrotik devices
    devices_data = [
        {
            'username': 'admin',
            'password': 'mikrotik123',
            'api_key': 'api_key_001',
            'api_port': 8728,
            'device_name': 'Router-01',
            'device_ip': '192.168.1.1',
            'device_model': 'RB4011iGS+',
            'device_status': DeviceStatus.ONLINE,
            'uptime': 1296000,  # 15 days in seconds
            'client_count': 45,
            'bandwidth_usage': 85,
            'location': 'Downtown',
            'notes': 'Main router for downtown area',
            'zone_name': 'Zone A'
        },
        {
            'username': 'admin',
            'password': 'mikrotik456',
            'api_key': 'api_key_002',
            'api_port': 8728,
            'device_name': 'Router-02',
            'device_ip': '192.168.1.2',
            'device_model': 'hAP ac²',
            'device_status': DeviceStatus.ONLINE,
            'uptime': 691200,  # 8 days in seconds
            'client_count': 23,
            'bandwidth_usage': 60,
            'location': 'Suburban',
            'notes': 'Router for suburban area',
            'zone_name': 'Zone B'
        },
        {
            'username': 'admin',
            'password': 'mikrotik789',
            'api_key': 'api_key_003',
            'api_port': 8728,
            'device_name': 'Router-03',
            'device_ip': '192.168.1.3',
            'device_model': 'RB450Gx4',
            'device_status': DeviceStatus.OFFLINE,
            'uptime': 0,
            'client_count': 0,
            'bandwidth_usage': 0,
            'location': 'Industrial',
            'notes': 'Router for industrial area - currently offline',
            'zone_name': 'Zone C'
        }
    ]
    
    for device_data in devices_data:
        existing_device = MikrotikDevice.query.filter_by(device_name=device_data['device_name']).first()
        if not existing_device:
            zone = zones.get(device_data['zone_name'])
            device = MikrotikDevice(
                username=device_data['username'],
                password=device_data['password'],
                api_key=device_data['api_key'],
                api_port=device_data['api_port'],
                device_name=device_data['device_name'],
                device_ip=device_data['device_ip'],
                device_model=device_data['device_model'],
                device_status=device_data['device_status'],
                uptime=device_data['uptime'],
                client_count=device_data['client_count'],
                bandwidth_usage=device_data['bandwidth_usage'],
                location=device_data['location'],
                notes=device_data['notes'],
                zone_id=zone.id if zone else None,
                is_active=True,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(device)
            print(f"  ✓ Created device: {device_data['device_name']}")
        else:
            print(f"  ℹ Device already exists: {device_data['device_name']}")
    
    db.session.commit()
    print("✅ Mikrotik devices seeded successfully!")

def seed_tickets():
    """Seed support tickets"""
    print("🌱 Seeding support tickets...")
    
    # Get customers for foreign key relationships
    customers = Customer.query.all()
    customer_map = {customer.full_name: customer for customer in customers}
    
    tickets_data = [
        {
            'ticket_number': 'TICKET-001',
            'customer_name': 'John Smith',
            'ticket_subject': 'Slow internet connection',
            'ticket_description': 'My internet connection has been very slow for the past few days. Speed tests show I\'m only getting 20Mbps instead of the promised 100Mbps.',
            'ticket_status': TicketStatus.OPEN,
            'priority': TicketPriority.MEDIUM,
            'category': 'Technical',
            'messages': [
                {
                    'message': 'Hello, I\'m experiencing slow internet speeds. Can you help me troubleshoot this issue?',
                    'is_internal': False
                },
                {
                    'message': 'Thank you for contacting support. We\'ll investigate this issue and get back to you within 24 hours.',
                    'is_internal': False
                }
            ]
        },
        {
            'ticket_number': 'TICKET-002',
            'customer_name': 'Sarah Johnson',
            'ticket_subject': 'Billing inquiry',
            'ticket_description': 'I have a question about my recent bill. There seems to be an extra charge that I don\'t understand.',
            'ticket_status': TicketStatus.RESOLVED,
            'priority': TicketPriority.LOW,
            'category': 'Billing',
            'messages': [
                {
                    'message': 'I noticed an extra charge on my bill this month. Can you explain what this is for?',
                    'is_internal': False
                },
                {
                    'message': 'The extra charge was for a late payment fee. We\'ve waived this fee as a courtesy.',
                    'is_internal': False
                }
            ]
        },
        {
            'ticket_number': 'TICKET-003',
            'customer_name': 'Mike Wilson',
            'ticket_subject': 'Service restoration request',
            'ticket_description': 'My service was suspended due to non-payment. I\'ve made the payment and would like my service restored.',
            'ticket_status': TicketStatus.PENDING,
            'priority': TicketPriority.HIGH,
            'category': 'Billing',
            'messages': [
                {
                    'message': 'I\'ve made the payment for my overdue balance. Please restore my service as soon as possible.',
                    'is_internal': False
                },
                {
                    'message': 'Payment received. Service will be restored within 2 hours.',
                    'is_internal': False
                }
            ]
        }
    ]
    
    for ticket_data in tickets_data:
        existing_ticket = Ticket.query.filter_by(ticket_number=ticket_data['ticket_number']).first()
        if not existing_ticket:
            customer = customer_map.get(ticket_data['customer_name'])
            if customer:
                ticket = Ticket(
                    ticket_number=ticket_data['ticket_number'],
                    ticket_subject=ticket_data['ticket_subject'],
                    ticket_description=ticket_data['ticket_description'],
                    ticket_status=ticket_data['ticket_status'],
                    priority=ticket_data['priority'],
                    category=ticket_data['category'],
                    customer_id=customer.id,
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                db.session.add(ticket)
                db.session.flush()  # Get the ticket ID
                
                # Add ticket messages
                for message_data in ticket_data['messages']:
                    ticket_message = TicketMessage(
                        ticket_id=ticket.id,
                        message=message_data['message'],
                        is_internal=message_data['is_internal'],
                        created_at=datetime.now(),
                        updated_at=datetime.now()
                    )
                    db.session.add(ticket_message)
                
                print(f"  ✓ Created ticket: {ticket_data['ticket_number']}")
            else:
                print(f"  ⚠ Customer not found: {ticket_data['customer_name']}")
        else:
            print(f"  ℹ Ticket already exists: {ticket_data['ticket_number']}")
    
    db.session.commit()
    print("✅ Support tickets seeded successfully!")

def seed_system_settings():
    """Seed system settings"""
    print("🌱 Seeding system settings...")
    
    settings_data = [
        {
            'key': 'company_name',
            'value': 'Infora WiFi',
            'description': 'Company name for the billing system',
            'category': 'general',
            'is_public': True
        },
        {
            'key': 'company_email',
            'value': 'support@infora.com',
            'description': 'Primary support email address',
            'category': 'contact',
            'is_public': True
        },
        {
            'key': 'company_phone',
            'value': '+1 (555) 123-4567',
            'description': 'Primary support phone number',
            'category': 'contact',
            'is_public': True
        },
        {
            'key': 'default_currency',
            'value': 'KES',
            'description': 'Default currency for billing',
            'category': 'billing',
            'is_public': False
        },
        {
            'key': 'late_payment_fee',
            'value': '500.00',
            'description': 'Late payment fee amount',
            'category': 'billing',
            'is_public': False
        },
        {
            'key': 'grace_period_days',
            'value': '7',
            'description': 'Number of days before late payment fee is applied',
            'category': 'billing',
            'is_public': False
        },
        {
            'key': 'maintenance_mode',
            'value': 'false',
            'description': 'Enable maintenance mode',
            'category': 'system',
            'is_public': False
        }
    ]
    
    for setting_data in settings_data:
        existing_setting = SystemSetting.query.filter_by(key=setting_data['key']).first()
        if not existing_setting:
            setting = SystemSetting(
                key=setting_data['key'],
                value=setting_data['value'],
                description=setting_data['description'],
                category=setting_data['category'],
                is_public=setting_data['is_public'],
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(setting)
            print(f"  ✓ Created setting: {setting_data['key']}")
        else:
            print(f"  ℹ Setting already exists: {setting_data['key']}")
    
    db.session.commit()
    print("✅ System settings seeded successfully!")

def seed_vouchers():
    """Seed vouchers"""
    print("🌱 Seeding vouchers...")
    
    vouchers_data = [
        {
            'voucher_code': 'WELCOME10',
            'voucher_type': 'percentage',
            'voucher_value': 10.00,
            'voucher_status': VoucherStatus.ACTIVE,
            'expiry_date': datetime.now() + timedelta(days=30),
            'usage_count': 0,
            'max_usage': 100,
            'is_active': True
        },
        {
            'voucher_code': 'SUMMER20',
            'voucher_type': 'percentage',
            'voucher_value': 20.00,
            'voucher_status': VoucherStatus.ACTIVE,
            'expiry_date': datetime.now() + timedelta(days=60),
            'usage_count': 5,
            'max_usage': 50,
            'is_active': True
        },
        {
            'voucher_code': 'FREEMONTH',
            'voucher_type': 'fixed',
            'voucher_value': 7999.00,  # KES equivalent of free month
            'voucher_status': VoucherStatus.USED,
            'used_by': 'john.smith@email.com',
            'used_at': datetime.now() - timedelta(days=5),
            'expiry_date': datetime.now() + timedelta(days=15),
            'usage_count': 1,
            'max_usage': 1,
            'is_active': False
        }
    ]
    
    for voucher_data in vouchers_data:
        existing_voucher = Voucher.query.filter_by(voucher_code=voucher_data['voucher_code']).first()
        if not existing_voucher:
            voucher = Voucher(
                voucher_code=voucher_data['voucher_code'],
                voucher_type=voucher_data['voucher_type'],
                voucher_value=voucher_data['voucher_value'],
                voucher_status=voucher_data['voucher_status'],
                used_by=voucher_data.get('used_by'),
                used_at=voucher_data.get('used_at'),
                expiry_date=voucher_data['expiry_date'],
                usage_count=voucher_data['usage_count'],
                max_usage=voucher_data['max_usage'],
                is_active=voucher_data['is_active'],
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(voucher)
            print(f"  ✓ Created voucher: {voucher_data['voucher_code']}")
        else:
            print(f"  ℹ Voucher already exists: {voucher_data['voucher_code']}")
    
    db.session.commit()
    print("✅ Vouchers seeded successfully!")

def main():
    """Main seeding function"""
    print("🚀 Starting database seeding...")
    print("=" * 50)
    
    app = create_app()
    
    with app.app_context():
        try:
            # Reset DB (drop & recreate all tables)
            print("🗑️ Dropping all tables...")
            db.drop_all()
            print("📦 Creating fresh tables...")
            db.create_all()


            # Seed data in order of dependencies
            seed_users()
            seed_service_plans()
            seed_customers()
            seed_invoices()
            seed_payments()
            seed_mikrotik_devices()
            seed_tickets()
            seed_vouchers()
            seed_system_settings()
            
            print("=" * 50)
            print("✅ Database seeding completed successfully!")
            print("\n📋 Login Credentials:")
            print("  Admin: admin@infora.com / admin123")
            print("  Super Admin: superadmin@infora.com / superadmin123")
            print("  Support: support@infora.com / support123")
            print("  Billing: billing@infora.com / billing123")
            print("  Technical: tech@infora.com / tech123")
            
        except Exception as e:
            print(f"❌ Error during seeding: {str(e)}")
            db.session.rollback()
            raise

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"❌ Error running seeder: {str(e)}")
        import traceback
        traceback.print_exc()
