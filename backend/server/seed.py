#!/usr/bin/env python3
"""
Database Seeder for Lumen WiFi Billing System
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
    RadiusCheck, RadiusReply, RadiusGroup, RadiusUserGroup, RadAcct,
    NetworkInfrastructure, NetworkZone, BillingCycle, TaxRate,
    Discount, InvoiceDiscount, AuditLog, BackupSchedule, SystemSetting,
    ISP,
    LDAPServer, RadiusClient, SnmpDevice, VPNConfig, VPNClient, EapProfile,
    CustomerStatus, InvoiceStatus, PaymentStatus, VoucherStatus,
    DeviceStatus, InfrastructureStatus, TicketStatus, TicketPriority,
    CustomerNoteType, NotificationPriority, KycStatus
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
            'email': 'admin@lumen.app',
            'password': 'admin123',
            'first_name': 'System',
            'last_name': 'Administrator',
            'role': 'admin',
            'is_active': True
        },
        {
            'email': 'superadmin@lumen.app',
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
            'email': 'support@lumen.app',
            'password': 'support123',
            'first_name': 'Support',
            'last_name': 'Team',
            'role': 'support',
            'is_active': True
        },
        {
            'email': 'billing@lumen.app',
            'password': 'billing123',
            'first_name': 'Billing',
            'last_name': 'Team',
            'role': 'billing',
            'is_active': True
        },
        {
            'email': 'tech@lumen.app',
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

def seed_isps():
    """Seed ISPs data"""
    print("🌱 Seeding ISPs...")
    
    isps_data = [
        {
            'name': 'Lumen',
            'company_name': 'Lumen',
            'email': 'admin@lumen.app',
            'phone': '+254700000000',
            'address': 'Nairobi, Kenya',
            'website': 'https://lumen.app',
            'logo_url': 'https://lumen.app/logo.png',
            'is_active': True,
            'subscription_plan': 'enterprise',
            'max_devices': 100,
            'max_customers': 1000,
            'api_key': 'default_api_key_123',
            'radius_secret': 'default_radius_secret_456'
        }
    ]
    
    for isp_data in isps_data:
        existing_isp = ISP.query.filter(
            db.or_(ISP.name == isp_data['name'], ISP.name == 'Default ISP')
        ).first()
        if not existing_isp:
            isp = ISP(
                name=isp_data['name'],
                company_name=isp_data['company_name'],
                email=isp_data['email'],
                phone=isp_data['phone'],
                address=isp_data['address'],
                website=isp_data['website'],
                logo_url=isp_data['logo_url'],
                is_active=isp_data['is_active'],
                subscription_plan=isp_data['subscription_plan'],
                max_devices=isp_data['max_devices'],
                max_customers=isp_data['max_customers'],
                api_key=isp_data['api_key'],
                radius_secret=isp_data['radius_secret'],
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(isp)
            print(f"  ✓ Created ISP: {isp_data['name']}")
        else:
            existing_isp.name = isp_data['name']
            existing_isp.company_name = isp_data['company_name']
            existing_isp.email = isp_data['email']
            existing_isp.website = isp_data['website']
            existing_isp.logo_url = isp_data['logo_url']
            existing_isp.updated_at = datetime.now()
            print(f"  ✓ Updated ISP branding: {isp_data['name']}")
    
    db.session.commit()
    print("✅ ISPs seeded successfully!")

def seed_service_plans():
    """Seed service plans"""
    print("🌱 Seeding service plans...")
    
    # Get the default ISP
    default_isp = ISP.query.filter(
        db.or_(ISP.name == 'Lumen', ISP.name == 'Default ISP')
    ).first()
    if not default_isp:
        print("❌ Error: Lumen ISP not found. Please seed ISPs first.")
        return
    
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
            'name': 'Premium 100Mbps',
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
                plan_type=plan_data.get('plan_type', 'pppoe'),
                billing_cycle_days=plan_data.get('billing_cycle_days', 30),
                duration_hours=plan_data.get('duration_hours'),
                bandwidth_limit=plan_data.get('bandwidth_limit'),
                session_timeout=plan_data.get('session_timeout'),
                isp_id=default_isp.id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(plan)
            print(f"  ✓ Created plan: {plan_data['name']}")
        else:
            print(f"  ℹ Plan already exists: {plan_data['name']}")
    
    db.session.commit()
    print("✅ Service plans seeded successfully!")


def seed_hotspot_plans():
    """Seed captive portal hotspot packages"""
    print("🌱 Seeding hotspot portal packages...")

    default_isp = ISP.query.filter(
        db.or_(ISP.name == 'Lumen', ISP.name == 'Default ISP')
    ).first()
    if not default_isp:
        print("❌ Error: Lumen ISP not found.")
        return

    hotspot_plans = [
        {
            'name': '1 Hour',
            'speed': '2 Mbps',
            'price': 10.00,
            'description': 'Haraka — WhatsApp, email na social media',
            'plan_type': 'hotspot',
            'duration_hours': 1,
            'bandwidth_limit': 2,
            'session_timeout': 60,
            'features': {
                'download_speed': '2 Mbps',
                'access_type': '1 hour',
                'ideal_for': 'Quick browsing',
            },
            'popular': False,
        },
        {
            'name': '3 Hours',
            'speed': '3 Mbps',
            'price': 20.00,
            'description': 'Masaa matatu — browsing na video fupi',
            'plan_type': 'hotspot',
            'duration_hours': 3,
            'bandwidth_limit': 3,
            'session_timeout': 180,
            'features': {
                'download_speed': '3 Mbps',
                'access_type': '3 hours',
                'ideal_for': 'Afternoon session',
            },
            'popular': False,
        },
        {
            'name': '12 Hours',
            'speed': '5 Mbps',
            'price': 30.00,
            'description': 'Usiku hadi asubuhi — streaming na kazi',
            'plan_type': 'hotspot',
            'duration_hours': 12,
            'bandwidth_limit': 5,
            'session_timeout': 720,
            'features': {
                'download_speed': '5 Mbps',
                'access_type': '12 hours',
                'ideal_for': 'Evening bundle',
            },
            'popular': False,
        },
        {
            'name': '24 Hours (Siku)',
            'speed': '5 Mbps',
            'price': 50.00,
            'description': 'Siku nzima — bei bora kwa matumizi ya kila siku',
            'plan_type': 'hotspot',
            'duration_hours': 24,
            'bandwidth_limit': 5,
            'session_timeout': 1440,
            'features': {
                'download_speed': '5 Mbps',
                'access_type': '24 hours',
                'ideal_for': 'Full day access',
            },
            'popular': True,
        },
        {
            'name': '7 Days (Wiki)',
            'speed': '8 Mbps',
            'price': 200.00,
            'description': 'Wiki moja — kwa wageni na wafanyakazi wa muda',
            'plan_type': 'hotspot',
            'duration_hours': 168,
            'bandwidth_limit': 8,
            'session_timeout': 10080,
            'features': {
                'download_speed': '8 Mbps',
                'access_type': '7 days',
                'ideal_for': 'Weekly visitors',
            },
            'popular': False,
        },
        {
            'name': '30 Days (Mwezi)',
            'speed': '10 Mbps',
            'price': 500.00,
            'description': 'Mwezi mzima — bei nafuu kwa matumizi ya mara kwa mara',
            'plan_type': 'hotspot',
            'duration_hours': 720,
            'bandwidth_limit': 10,
            'session_timeout': 43200,
            'features': {
                'download_speed': '10 Mbps',
                'access_type': '30 days',
                'ideal_for': 'Regular hotspot users',
            },
            'popular': False,
        },
    ]

    legacy_names = ['Hotspot 1 Hour', 'Hotspot 24 Hours', 'Hotspot 7 Days']
    for legacy_name in legacy_names:
        legacy = ServicePlan.query.filter_by(name=legacy_name, isp_id=default_isp.id).first()
        if legacy:
            db.session.delete(legacy)
            print(f"  ✓ Removed legacy hotspot plan: {legacy_name}")

    for plan_data in hotspot_plans:
        existing = ServicePlan.query.filter_by(
            name=plan_data['name'],
            isp_id=default_isp.id,
        ).first()
        if existing:
            existing.speed = plan_data['speed']
            existing.price = plan_data['price']
            existing.description = plan_data['description']
            existing.features = plan_data['features']
            existing.popular = plan_data['popular']
            existing.is_active = True
            existing.plan_type = 'hotspot'
            existing.duration_hours = plan_data['duration_hours']
            existing.bandwidth_limit = plan_data['bandwidth_limit']
            existing.session_timeout = plan_data['session_timeout']
            existing.updated_at = datetime.now()
            print(f"  ✓ Updated hotspot plan: {plan_data['name']} — KES {plan_data['price']:.0f}")
        else:
            plan = ServicePlan(
                name=plan_data['name'],
                speed=plan_data['speed'],
                price=plan_data['price'],
                description=plan_data['description'],
                features=plan_data['features'],
                popular=plan_data['popular'],
                is_active=True,
                plan_type='hotspot',
                duration_hours=plan_data['duration_hours'],
                bandwidth_limit=plan_data['bandwidth_limit'],
                session_timeout=plan_data['session_timeout'],
                isp_id=default_isp.id,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            db.session.add(plan)
            print(f"  ✓ Created hotspot plan: {plan_data['name']} — KES {plan_data['price']:.0f}")

    db.session.commit()
    print("✅ Hotspot portal packages seeded successfully!")

def seed_customers():
    """Seed customers"""
    print("🌱 Seeding customers...")
    
    # Get the default ISP
    default_isp = ISP.query.filter(
        db.or_(ISP.name == 'Lumen', ISP.name == 'Default ISP')
    ).first()
    if not default_isp:
        print("❌ Error: Lumen ISP not found. Please seed ISPs first.")
        return
    
    # Get service plans for foreign key relationships
    basic_plan = ServicePlan.query.filter_by(name='Basic 50Mbps').first()
    premium_plan = ServicePlan.query.filter_by(name='Premium 100Mbps').first()
    business_plan = ServicePlan.query.filter_by(name='Business 200Mbps').first()
    
    customers_data = [
        {
            'full_name': 'John Smith',
            'email': 'john.smith@email.com',
            'phone': '+254712345678',
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
            'phone': '+254723456789',
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
            'phone': '+254734567890',
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
            'phone': '+254745678901',
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
            'phone': '+254756789012',
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
                isp_id=default_isp.id,
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
    
    # Get the default ISP
    default_isp = ISP.query.filter(
        db.or_(ISP.name == 'Lumen', ISP.name == 'Default ISP')
    ).first()
    if not default_isp:
        print("❌ Error: Lumen ISP not found. Please seed ISPs first.")
        return
    
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
                    isp_id=default_isp.id,
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


def seed_transactions():
    """Seed transactions from payments"""
    print("🌱 Seeding transactions...")
    payments = Payment.query.all()
    created = 0
    for payment in payments:
        ref = payment.transaction_id or f'TXN-{payment.id:05d}'
        existing = Transaction.query.filter_by(transaction_number=ref).first()
        if not existing:
            txn = Transaction(
                transaction_number=ref,
                transaction_type='payment',
                transaction_amount=payment.amount,
                reference_id=str(payment.invoice_id) if payment.invoice_id else None,
                reference_type='invoice' if payment.invoice_id else 'payment',
                customer_id=payment.customer_id,
                payment_id=payment.id,
                created_at=payment.payment_date or datetime.now(),
            )
            db.session.add(txn)
            created += 1
            print(f"  ✓ Created transaction: {ref}")
    db.session.commit()
    print(f"✅ Transactions seeded successfully! ({created} new)")

def seed_mikrotik_devices():
    """Seed Mikrotik devices"""
    print("🌱 Seeding Mikrotik devices...")
    
    # Get the default ISP
    default_isp = ISP.query.filter(
        db.or_(ISP.name == 'Lumen', ISP.name == 'Default ISP')
    ).first()
    if not default_isp:
        print("❌ Error: Lumen ISP not found. Please seed ISPs first.")
        return
    
    # Create network zones first
    zones_data = [
        {'name': 'Zone A', 'description': 'Downtown Area'},
        {'name': 'Zone B', 'description': 'Suburban Area'},
        {'name': 'Zone C', 'description': 'Industrial Area'}
    ]
    
    zones = {}
    for zone_data in zones_data:
        existing_zone = NetworkZone.query.filter_by(name=zone_data['name']).first()
        if not existing_zone:
            zone = NetworkZone(
                name=zone_data['name'],
                description=zone_data['description'],
                isp_id=default_isp.id,
                created_at=datetime.now(),
                updated_at=datetime.now()
            )
            db.session.add(zone)
            db.session.flush()
            zones[zone_data['name']] = zone
            print(f"  ✓ Created zone: {zone_data['name']}")
        else:
            zones[zone_data['name']] = existing_zone
            print(f"  ℹ Zone already exists: {zone_data['name']}")
    
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
                isp_id=default_isp.id,
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
            'value': 'Lumen',
            'description': 'Company name for the billing system',
            'category': 'general',
            'is_public': True
        },
        {
            'key': 'company_email',
            'value': 'support@lumen.app',
            'description': 'Primary support email address',
            'category': 'contact',
            'is_public': True
        },
        {
            'key': 'company_phone',
            'value': '+254700000000',
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
        },
        {
            'key': 'portal_tagline',
            'value': 'Fast, reliable internet for home and business',
            'description': 'Captive portal headline',
            'category': 'portal',
            'is_public': True
        },
        {
            'key': 'portal_about',
            'value': 'Lumen connects homes and businesses across Kenya with affordable broadband. Pay with M-Pesa and get online in seconds.',
            'description': 'About text on captive portal',
            'category': 'portal',
            'is_public': True
        },
        {
            'key': 'portal_support_phone',
            'value': '+254700000000',
            'description': 'Support phone shown on portal',
            'category': 'portal',
            'is_public': True
        },
        {
            'key': 'portal_support_email',
            'value': 'support@lumen.app',
            'description': 'Support email shown on portal',
            'category': 'portal',
            'is_public': True
        },
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
            existing_setting.value = setting_data['value']
            existing_setting.updated_at = datetime.now()
            print(f"  ✓ Updated setting: {setting_data['key']}")
    
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


def seed_finance_data():
    """Seed finance leads and operating expenses"""
    print("🌱 Seeding finance data...")

    default_isp = ISP.query.filter(
        db.or_(ISP.name == 'Lumen', ISP.name == 'Default ISP')
    ).first()
    basic_plan = ServicePlan.query.filter_by(name='Basic 50Mbps').first()
    premium_plan = ServicePlan.query.filter_by(name='Premium 100Mbps').first()

    if not default_isp:
        print("  ℹ Skipping finance seed — default ISP not found")
        return

    leads_data = [
        {
            'full_name': 'Grace Wanjiku',
            'email': 'grace.wanjiku@email.com',
            'phone': '+254711223344',
            'address': 'Westlands, Nairobi',
            'status': CustomerStatus.PENDING,
            'join_date': datetime.now() - timedelta(days=3),
            'balance': 0.00,
            'package': 'Premium 100Mbps',
            'usage_percentage': 0,
            'device_count': 0,
            'service_plan': premium_plan,
        },
        {
            'full_name': 'Peter Otieno',
            'email': 'peter.otieno@email.com',
            'phone': '+254722334455',
            'address': 'Kilimani, Nairobi',
            'status': CustomerStatus.PENDING,
            'join_date': datetime.now() - timedelta(days=10),
            'balance': 0.00,
            'package': 'Basic 50Mbps',
            'usage_percentage': 0,
            'device_count': 0,
            'service_plan': basic_plan,
        },
        {
            'full_name': 'Amina Hassan',
            'email': 'amina.hassan@email.com',
            'phone': '+254733445566',
            'address': 'Parklands, Nairobi',
            'status': CustomerStatus.PENDING,
            'join_date': datetime.now() - timedelta(days=1),
            'balance': 0.00,
            'package': 'Basic 50Mbps',
            'usage_percentage': 0,
            'device_count': 0,
            'service_plan': basic_plan,
        },
    ]

    for lead_data in leads_data:
        existing = Customer.query.filter_by(email=lead_data['email']).first()
        if existing:
            continue
        customer = Customer(
            full_name=lead_data['full_name'],
            email=lead_data['email'],
            phone=lead_data['phone'],
            address=lead_data['address'],
            status=lead_data['status'],
            join_date=lead_data['join_date'],
            balance=lead_data['balance'],
            package=lead_data['package'],
            usage_percentage=lead_data['usage_percentage'],
            device_count=lead_data['device_count'],
            service_plan_id=lead_data['service_plan'].id if lead_data['service_plan'] else None,
            isp_id=default_isp.id,
            created_at=lead_data['join_date'],
            updated_at=datetime.now(),
        )
        db.session.add(customer)
        print(f"  ✓ Created lead: {lead_data['full_name']}")

    expenses_data = [
        {'amount': 45000.00, 'category': 'operating_expense', 'days_ago': 5},
        {'amount': 125000.00, 'category': 'bandwidth_expense', 'days_ago': 12},
        {'amount': 28000.00, 'category': 'equipment_expense', 'days_ago': 20},
        {'amount': 18500.00, 'category': 'operating_expense', 'days_ago': 2},
        {'amount': 62000.00, 'category': 'staff_expense', 'days_ago': 28},
    ]

    for expense_data in expenses_data:
        expense_date = datetime.now() - timedelta(days=expense_data['days_ago'])
        existing = RevenueData.query.filter_by(
            revenue_type=expense_data['category'],
            revenue_date=expense_date,
        ).first()
        if existing:
            continue
        expense = RevenueData(
            revenue_amount=expense_data['amount'],
            revenue_type=expense_data['category'],
            revenue_date=expense_date,
            created_at=expense_date,
            updated_at=expense_date,
        )
        db.session.add(expense)
        print(f"  ✓ Created expense: {expense_data['category']} — KES {expense_data['amount']:,.0f}")

    db.session.commit()
    print("✅ Finance data seeded successfully!")


def seed_kyc_data():
    """Seed KYC statuses and verification documents"""
    print("🌱 Seeding KYC data...")

    customers = Customer.query.all()
    if not customers:
        print("  ℹ Skipping KYC seed — no customers found")
        return

    kyc_assignments = [
        ('john.smith@email.com', KycStatus.VERIFIED, '12345678', 'verified'),
        ('sarah.j@email.com', KycStatus.UNDER_REVIEW, '23456789', 'under_review'),
        ('mike.w@email.com', KycStatus.REJECTED, '34567890', 'rejected'),
        ('emily.d@email.com', KycStatus.VERIFIED, '45678901', 'verified'),
        ('david.b@email.com', KycStatus.PENDING, None, 'pending'),
    ]

    document_templates = [
        ('national_id', 'national_id_front.pdf', 'ID Front.pdf', 245000, 'approved'),
        ('proof_of_address', 'utility_bill.pdf', 'Utility Bill.pdf', 180000, 'approved'),
        ('selfie', 'selfie_photo.jpg', 'Selfie.jpg', 92000, 'pending'),
    ]

    for email, kyc_status, id_number, doc_status in kyc_assignments:
        customer = Customer.query.filter_by(email=email).first()
        if not customer:
            continue

        customer.id_number = id_number
        customer.kyc_status = kyc_status
        customer.kyc_notes = {
            KycStatus.VERIFIED: 'All required documents approved',
            KycStatus.UNDER_REVIEW: 'Awaiting selfie verification',
            KycStatus.REJECTED: 'ID document expired — resubmit required',
            KycStatus.PENDING: 'Customer has not submitted documents',
        }.get(kyc_status)
        if kyc_status == KycStatus.VERIFIED:
            customer.kyc_verified_at = datetime.now() - timedelta(days=14)

        existing_docs = CustomerDocument.query.filter_by(customer_id=customer.id).count()
        if existing_docs:
            continue

        for index, (doc_type, file_name, original_name, file_size, verification_status) in enumerate(document_templates):
            if kyc_status == KycStatus.PENDING and index > 0:
                break
            if kyc_status == KycStatus.REJECTED and doc_type == 'national_id':
                verification_status = 'rejected'
            if kyc_status == KycStatus.UNDER_REVIEW and doc_type == 'selfie':
                verification_status = 'pending'
            elif kyc_status in (KycStatus.VERIFIED, KycStatus.UNDER_REVIEW) and doc_type in ('national_id', 'proof_of_address'):
                verification_status = 'approved'

            document = CustomerDocument(
                customer_id=customer.id,
                document_type=doc_type,
                file_name=file_name,
                original_file_name=original_name,
                file_size=file_size,
                file_path=f'uploads/kyc/{customer.id}/{file_name}',
                verification_status=verification_status,
                upload_date=datetime.now() - timedelta(days=10 - index),
                created_at=datetime.now() - timedelta(days=10 - index),
                updated_at=datetime.now(),
            )
            db.session.add(document)

        print(f"  ✓ Seeded KYC for {customer.full_name} ({kyc_status.value})")

    db.session.commit()
    print("✅ KYC data seeded successfully!")


def seed_network_data():
    """Seed network infrastructure: RADIUS, LDAP, SNMP, VPN, EAP"""
    print("🌱 Seeding network configuration...")

    if RadiusClient.query.first():
        print("  ℹ Network data already exists, skipping")
        return

    radius_clients = [
        RadiusClient(name='Main NAS', host='192.168.88.1', secret='radius_secret_123', nas_type='mikrotik', shortname='main-nas'),
        RadiusClient(name='Branch NAS', host='192.168.89.1', secret='radius_secret_456', nas_type='mikrotik', shortname='branch-nas'),
    ]
    for client in radius_clients:
        db.session.add(client)

    ldap_servers = [
        LDAPServer(
            name='Corporate LDAP',
            host='ldap.lumen.local',
            port=389,
            use_tls=True,
            bind_dn='cn=admin,dc=lumen,dc=local',
            bind_password='ldap_bind_pass',
            base_dn='dc=lumen,dc=local',
        ),
    ]
    for server in ldap_servers:
        db.session.add(server)

    snmp_devices = [
        SnmpDevice(name='Core Switch', host='192.168.88.2', snmp_version='2c', community='public'),
        SnmpDevice(name='Edge Router', host='192.168.88.1', snmp_version='2c', community='public'),
    ]
    for device in snmp_devices:
        db.session.add(device)

    vpn_config = VPNConfig(
        name='Staff WireGuard',
        vpn_type='wireguard',
        config_blob='[Interface]\nAddress = 10.8.0.1/24',
        server_endpoint='vpn.lumen.app',
        server_port=51820,
        allowed_ips='10.8.0.0/24',
        dns_servers='8.8.8.8,8.8.4.4',
        server_public_key='demo_server_public_key',
        server_private_key='demo_server_private_key',
    )
    db.session.add(vpn_config)
    db.session.flush()

    db.session.add(VPNClient(
        name='Field Tech Laptop',
        vpn_config_id=vpn_config.id,
        client_ip='10.8.0.2',
        config_blob='[Interface]\nAddress = 10.8.0.2/32',
        client_public_key='demo_client_public_key',
        client_private_key='demo_client_private_key',
    ))

    eap_profiles = [
        EapProfile(name='Enterprise WiFi', eap_method='PEAP', phase2_method='MSCHAPv2', notes='Default office SSID auth'),
        EapProfile(name='Guest Portal', eap_method='EAP-TTLS', phase2_method='PAP', notes='Guest network fallback'),
    ]
    for profile in eap_profiles:
        db.session.add(profile)

    default_isp = ISP.query.filter(
        db.or_(ISP.name == 'Lumen', ISP.name == 'Default ISP')
    ).first()
    customers = Customer.query.limit(3).all()
    devices = MikrotikDevice.query.limit(2).all()

    if default_isp and customers and devices:
        for index, customer in enumerate(customers):
            session = RadiusSession(
                session_id=f'sess-demo-{index + 1}',
                username=customer.email.split('@')[0],
                ip_address=f'10.10.0.{10 + index}',
                mac_address=f'AA:BB:CC:DD:EE:0{index}',
                session_start=datetime.utcnow() - timedelta(hours=2 - index),
                bytes_in=1024 * 1024 * (50 + index * 20),
                bytes_out=1024 * 1024 * (10 + index * 5),
                is_active=index < 2,
                isp_id=default_isp.id,
                customer_id=customer.id,
                mikrotik_device_id=devices[index % len(devices)].id,
            )
            db.session.add(session)

    db.session.commit()
    print("✅ Network data seeded successfully!")


def apply_lumen_branding():
    """Normalize legacy Infora naming in ISP and portal settings."""
    from services.brand_constants import (
        BRAND_COMPANY,
        BRAND_NAME,
        BRAND_PORTAL_ABOUT,
        BRAND_PORTAL_TAGLINE,
        BRAND_SUPPORT_EMAIL,
        BRAND_WEBSITE,
        sanitize_brand_text,
    )

    print("🎨 Applying Lumen branding across database records...")

    for isp in ISP.query.all():
        isp.company_name = sanitize_brand_text(isp.company_name, BRAND_COMPANY)
        if isp.name in ('Default ISP', 'Infora WiFi', 'Infora', 'Default Company'):
            isp.name = BRAND_NAME
        if isp.email and 'infora' in isp.email.lower():
            isp.email = isp.email.lower().replace('@infora.com', '@lumen.app')
        if isp.website and 'infora' in isp.website.lower():
            isp.website = BRAND_WEBSITE
        if isp.logo_url and 'infora' in isp.logo_url.lower():
            isp.logo_url = f'{BRAND_WEBSITE}/logo.png'

    portal_defaults = {
        'company_name': BRAND_COMPANY,
        'portal_tagline': BRAND_PORTAL_TAGLINE,
        'portal_about': BRAND_PORTAL_ABOUT,
        'portal_support_email': BRAND_SUPPORT_EMAIL,
    }

    for key, value in portal_defaults.items():
        setting = SystemSetting.query.filter_by(key=key).first()
        if setting:
            setting.value = value
            setting.updated_at = datetime.now()
        else:
            db.session.add(SystemSetting(
                key=key,
                value=value,
                description=f'Lumen branding — {key}',
                category='portal' if key.startswith('portal_') else 'general',
                is_public=True,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ))

    for setting in SystemSetting.query.all():
        if setting.value and isinstance(setting.value, str) and 'infora' in setting.value.lower():
            setting.value = sanitize_brand_text(setting.value, setting.value)
            setting.updated_at = datetime.now()

    db.session.commit()
    print("✅ Lumen branding applied!")


def seed_website_settings():
    """Public settings consumed by the Lumen marketing website."""
    import json

    print("🌱 Seeding website settings...")
    changelog = json.dumps([
        {
            'version': 'v2.4.0',
            'date': 'Jun 2026',
            'tag': 'Latest',
            'title': 'Customer KYC & verification workflow',
            'items': [
                'Document upload and admin review for subscriber onboarding',
                'KYC status badges across customer list and detail views',
                'Automated service hold until verification is complete',
            ],
        },
        {
            'version': 'v2.3.0',
            'date': 'May 2026',
            'tag': 'Feature',
            'title': 'M-Pesa STK Push & payment reconciliation',
            'items': [
                'Real-time M-Pesa payment callbacks with instant activation',
                'Payment status tracking and failed transaction retry',
                'Unified payments ledger across hotspot and PPPoE',
            ],
        },
    ])

    website_settings = [
        ('website_sales_email', 'sales@lumen.app', 'Sales email for marketing site', 'website'),
        ('website_support_email', 'support@lumen.app', 'Support email for marketing site', 'website'),
        ('website_whatsapp', '+254700000000', 'WhatsApp number for marketing site', 'website'),
        ('website_trial_days', '14', 'Free trial length in days', 'website'),
        ('website_tagline', 'Connect. Bill. Grow.', 'Marketing site hero tagline', 'website'),
        ('website_changelog', changelog, 'Public product changelog JSON', 'website'),
    ]

    for key, value, description, category in website_settings:
        existing = SystemSetting.query.filter_by(key=key).first()
        if existing:
            existing.value = value
            existing.is_public = True
            existing.updated_at = datetime.now()
        else:
            db.session.add(SystemSetting(
                key=key,
                value=value,
                description=description,
                category=category,
                is_public=True,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ))

    db.session.commit()
    print("✅ Website settings seeded successfully!")


def seed_fup_monitor_data():
    """Enable FUP on sample plans and seed RADIUS usage for the FUP monitor."""
    print("🌱 Seeding FUP monitor demo data...")

    premium = ServicePlan.query.filter_by(name='Premium 100Mbps').first()
    basic = ServicePlan.query.filter_by(name='Basic 50Mbps').first()
    device = MikrotikDevice.query.filter_by(is_active=True).first()

    if premium:
        features = dict(premium.features or {})
        features.update({
            'fup_enabled': True,
            'fup_threshold_gb': 50,
            'fup_throttled_speed': '2M',
            'fup_reset_cycle': 'monthly',
        })
        premium.features = features
        premium.data_limit = 50

    if basic:
        basic.data_limit = 30
        features = dict(basic.features or {})
        features['data_cap'] = '30 GB'
        basic.features = features

    db.session.flush()

    if RadAcct.query.count() > 0:
        db.session.commit()
        print("  ↳ RADIUS accounting rows already present — updated plan FUP settings only")
        return

    nas_ip = device.device_ip if device else '192.168.1.1'
    device_id = device.id if device else None
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    GB = 1024 ** 3

    demo_sessions = [
        ('john.smith@email.com', 1, 42 * GB, True),
        ('grace.wanjiku@email.com', 6, 52 * GB, False),
        ('sarah.j@email.com', 2, 28 * GB, False),
        ('peter.otieno@email.com', 7, 12 * GB, False),
    ]

    for idx, (email, customer_id, total_bytes, is_live) in enumerate(demo_sessions):
        customer = Customer.query.get(customer_id)
        if not customer:
            continue
        download = int(total_bytes * 0.75)
        upload = int(total_bytes * 0.25)
        session_id = f'fup-demo-{customer_id}-{idx}'
        db.session.add(RadAcct(
            acctsessionid=session_id,
            acctuniqueid=f'uniq-{session_id}',
            username=email.strip().lower(),
            nasipaddress=nas_ip,
            acctstarttime=month_start + timedelta(hours=idx + 1),
            acctstoptime=None if is_live else month_start + timedelta(days=idx + 2),
            acctsessiontime=3600 * (idx + 1),
            acctinputoctets=upload,
            acctoutputoctets=download,
            framedipaddress=f'10.10.0.{10 + idx}',
            isp_id=customer.isp_id,
            customer_id=customer.id,
            mikrotik_device_id=device_id,
        ))

    db.session.commit()
    print("  ↳ FUP plans configured and RADIUS usage records added")


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
            seed_isps()
            seed_service_plans()
            seed_hotspot_plans()
            seed_customers()
            seed_invoices()
            seed_payments()
            seed_transactions()
            seed_mikrotik_devices()
            seed_tickets()
            seed_vouchers()
            seed_finance_data()
            seed_kyc_data()
            seed_network_data()
            seed_fup_monitor_data()
            seed_system_settings()
            apply_lumen_branding()
            seed_website_settings()
            
            print("=" * 50)
            print("✅ Database seeding completed successfully!")
            print("\n📋 Login Credentials:")
            print("  Admin: admin@lumen.app / admin123")
            print("  Super Admin: superadmin@lumen.app / superadmin123")
            print("  Support: support@lumen.app / support123")
            print("  Billing: billing@lumen.app / billing123")
            print("  Technical: tech@lumen.app / tech123")
            
        except Exception as e:
            print(f"❌ Error during seeding: {str(e)}")
            db.session.rollback()
            raise

if __name__ == "__main__":
    import sys

    try:
        if len(sys.argv) > 1 and sys.argv[1] == '--brand-only':
            app = create_app()
            with app.app_context():
                apply_lumen_branding()
                print("Done. Restart Flask if it is running.")
        else:
            main()
    except Exception as e:
        print(f"❌ Error running seeder: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
