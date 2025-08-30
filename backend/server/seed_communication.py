#!/usr/bin/env python3
"""
Seed script for communication providers and templates
"""

from app import app
from extensions import db
from models import (
    EmailProvider, SmsProvider, EmailTemplate, SmsTemplate,
    User, ISP
)
from datetime import datetime

def seed_email_providers():
    """Seed default email providers"""
    print("🌱 Seeding email providers...")
    
    providers_data = [
        {
            'name': 'Gmail SMTP',
            'provider_type': 'smtp',
            'host': 'smtp.gmail.com',
            'port': 587,
            'username': 'your-email@gmail.com',
            'password': 'your-app-password',
            'use_tls': True,
            'use_ssl': False,
            'is_default': True,
            'daily_limit': 1000,
            'monthly_limit': 30000
        },
        {
            'name': 'SendGrid',
            'provider_type': 'api',
            'api_key': 'your-sendgrid-api-key',
            'is_default': False,
            'daily_limit': 10000,
            'monthly_limit': 100000
        },
        {
            'name': 'Mailgun',
            'provider_type': 'api',
            'api_key': 'your-mailgun-api-key',
            'domain': 'your-domain.com',
            'is_default': False,
            'daily_limit': 5000,
            'monthly_limit': 50000
        }
    ]
    
    for provider_data in providers_data:
        existing_provider = EmailProvider.query.filter_by(name=provider_data['name']).first()
        if not existing_provider:
            provider = EmailProvider(**provider_data)
            db.session.add(provider)
            print(f"  ✓ Created email provider: {provider_data['name']}")
        else:
            print(f"  ℹ Email provider already exists: {provider_data['name']}")
    
    db.session.commit()
    print("✅ Email providers seeded successfully!")

def seed_sms_providers():
    """Seed default SMS providers"""
    print("🌱 Seeding SMS providers...")
    
    providers_data = [
        {
            'name': 'Twilio',
            'provider_type': 'api',
            'account_sid': 'your-account-sid',
            'auth_token': 'your-auth-token',
            'sender_id': '+1234567890',
            'is_default': True,
            'daily_limit': 1000,
            'monthly_limit': 30000,
            'cost_per_sms': 0.0075
        },
        {
            'name': 'Africa\'s Talking',
            'provider_type': 'api',
            'api_key': 'your-api-key',
            'sender_id': 'INFORA',
            'is_default': False,
            'daily_limit': 1000,
            'monthly_limit': 30000,
            'cost_per_sms': 0.0050
        },
        {
            'name': 'Vonage',
            'provider_type': 'api',
            'api_key': 'your-api-key',
            'api_secret': 'your-api-secret',
            'sender_id': '+1234567890',
            'is_default': False,
            'daily_limit': 1000,
            'monthly_limit': 30000,
            'cost_per_sms': 0.0080
        }
    ]
    
    for provider_data in providers_data:
        existing_provider = SmsProvider.query.filter_by(name=provider_data['name']).first()
        if not existing_provider:
            provider = SmsProvider(**provider_data)
            db.session.add(provider)
            print(f"  ✓ Created SMS provider: {provider_data['name']}")
        else:
            print(f"  ℹ SMS provider already exists: {provider_data['name']}")
    
    db.session.commit()
    print("✅ SMS providers seeded successfully!")

def seed_email_templates():
    """Seed default email templates"""
    print("🌱 Seeding email templates...")
    
    templates_data = [
        {
            'name': 'Welcome Email',
            'subject': 'Welcome to Infora WiFi - Your Account is Ready!',
            'content': '''Dear {{customer_name}},

Welcome to Infora WiFi! Your account has been successfully created and is now active.

Account Details:
- Username: {{username}}
- Plan: {{plan_name}}
- Monthly Fee: {{monthly_fee}}

You can now connect to our WiFi network using your credentials. If you have any questions or need assistance, please don't hesitate to contact our support team.

Thank you for choosing Infora WiFi!

Best regards,
The Infora Team''',
            'html_content': '''<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
        .highlight { background-color: #e9ecef; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to Infora WiFi!</h1>
    </div>
    <div class="content">
        <p>Dear {{customer_name}},</p>
        <p>Welcome to Infora WiFi! Your account has been successfully created and is now active.</p>
        
        <div class="highlight">
            <h3>Account Details:</h3>
            <ul>
                <li><strong>Username:</strong> {{username}}</li>
                <li><strong>Plan:</strong> {{plan_name}}</li>
                <li><strong>Monthly Fee:</strong> {{monthly_fee}}</li>
            </ul>
        </div>
        
        <p>You can now connect to our WiFi network using your credentials. If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        <p>Thank you for choosing Infora WiFi!</p>
        <p>Best regards,<br>The Infora Team</p>
    </div>
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>''',
            'template_type': 'welcome'
        },
        {
            'name': 'Payment Reminder',
            'subject': 'Payment Due - Infora WiFi Service',
            'content': '''Dear {{customer_name}},

This is a friendly reminder that your payment of {{amount}} is due on {{due_date}}.

Payment Details:
- Invoice Number: {{invoice_number}}
- Amount Due: {{amount}}
- Due Date: {{due_date}}

To avoid service interruption, please make your payment before the due date. You can pay through:
- M-Pesa: {{mpesa_number}}
- Bank Transfer: {{bank_details}}
- Cash at our office

If you have already made the payment, please disregard this message.

Thank you for your prompt attention to this matter.

Best regards,
The Infora Team''',
            'html_content': '''<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #ffc107; color: #333; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
        .highlight { background-color: #fff3cd; padding: 10px; border-radius: 5px; border-left: 4px solid #ffc107; }
        .payment-methods { background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Payment Reminder</h1>
    </div>
    <div class="content">
        <p>Dear {{customer_name}},</p>
        <p>This is a friendly reminder that your payment of <strong>{{amount}}</strong> is due on <strong>{{due_date}}</strong>.</p>
        
        <div class="highlight">
            <h3>Payment Details:</h3>
            <ul>
                <li><strong>Invoice Number:</strong> {{invoice_number}}</li>
                <li><strong>Amount Due:</strong> {{amount}}</li>
                <li><strong>Due Date:</strong> {{due_date}}</li>
            </ul>
        </div>
        
        <div class="payment-methods">
            <h3>Payment Methods:</h3>
            <ul>
                <li><strong>M-Pesa:</strong> {{mpesa_number}}</li>
                <li><strong>Bank Transfer:</strong> {{bank_details}}</li>
                <li><strong>Cash:</strong> At our office</li>
            </ul>
        </div>
        
        <p>To avoid service interruption, please make your payment before the due date.</p>
        <p>If you have already made the payment, please disregard this message.</p>
        <p>Thank you for your prompt attention to this matter.</p>
        <p>Best regards,<br>The Infora Team</p>
    </div>
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>''',
            'template_type': 'reminder'
        },
        {
            'name': 'Service Maintenance',
            'subject': 'Scheduled Maintenance - Service Interruption Notice',
            'content': '''Dear {{customer_name}},

We would like to inform you about scheduled maintenance that will affect your WiFi service.

Maintenance Details:
- Date: {{maintenance_date}}
- Time: {{maintenance_time}}
- Duration: {{duration}}
- Affected Areas: {{affected_areas}}

During this maintenance window, you may experience temporary service interruptions. We apologize for any inconvenience this may cause.

We will send you a notification once the maintenance is complete and service is restored.

If you have any questions, please contact our support team.

Thank you for your understanding.

Best regards,
The Infora Team''',
            'html_content': '''<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background-color: #17a2b8; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
        .highlight { background-color: #d1ecf1; padding: 10px; border-radius: 5px; border-left: 4px solid #17a2b8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Scheduled Maintenance Notice</h1>
    </div>
    <div class="content">
        <p>Dear {{customer_name}},</p>
        <p>We would like to inform you about scheduled maintenance that will affect your WiFi service.</p>
        
        <div class="highlight">
            <h3>Maintenance Details:</h3>
            <ul>
                <li><strong>Date:</strong> {{maintenance_date}}</li>
                <li><strong>Time:</strong> {{maintenance_time}}</li>
                <li><strong>Duration:</strong> {{duration}}</li>
                <li><strong>Affected Areas:</strong> {{affected_areas}}</li>
            </ul>
        </div>
        
        <p>During this maintenance window, you may experience temporary service interruptions. We apologize for any inconvenience this may cause.</p>
        <p>We will send you a notification once the maintenance is complete and service is restored.</p>
        <p>If you have any questions, please contact our support team.</p>
        <p>Thank you for your understanding.</p>
        <p>Best regards,<br>The Infora Team</p>
    </div>
    <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
    </div>
</body>
</html>''',
            'template_type': 'maintenance'
        }
    ]
    
    # Get admin user for template creation
    admin_user = User.query.filter_by(role='admin').first()
    if not admin_user:
        print("  ⚠ No admin user found. Creating templates without creator.")
        admin_user_id = 1
    else:
        admin_user_id = admin_user.id
    
    for template_data in templates_data:
        existing_template = EmailTemplate.query.filter_by(name=template_data['name']).first()
        if not existing_template:
            template = EmailTemplate(
                name=template_data['name'],
                subject=template_data['subject'],
                content=template_data['content'],
                html_content=template_data['html_content'],
                template_type=template_data['template_type'],
                created_by=admin_user_id
            )
            db.session.add(template)
            print(f"  ✓ Created email template: {template_data['name']}")
        else:
            print(f"  ℹ Email template already exists: {template_data['name']}")
    
    db.session.commit()
    print("✅ Email templates seeded successfully!")

def seed_sms_templates():
    """Seed default SMS templates"""
    print("🌱 Seeding SMS templates...")
    
    templates_data = [
        {
            'name': 'Welcome SMS',
            'message': 'Welcome to Infora WiFi! Your account is now active. Username: {{username}}, Password: {{password}}. For support call {{support_number}}.',
            'template_type': 'welcome'
        },
        {
            'name': 'Payment Reminder',
            'message': 'Hi {{customer_name}}, your payment of {{amount}} is due on {{due_date}}. Pay via M-Pesa {{mpesa_number}} to avoid service interruption.',
            'template_type': 'reminder'
        },
        {
            'name': 'Service Alert',
            'message': 'Infora WiFi: {{alert_message}}. Expected resolution: {{resolution_time}}. We apologize for any inconvenience.',
            'template_type': 'alert'
        },
        {
            'name': 'Payment Confirmation',
            'message': 'Thank you {{customer_name}}! Payment of {{amount}} received. Your service is active until {{expiry_date}}. Ref: {{transaction_id}}',
            'template_type': 'confirmation'
        },
        {
            'name': 'Maintenance Notice',
            'message': 'Infora WiFi: Scheduled maintenance on {{maintenance_date}} from {{maintenance_time}}. Duration: {{duration}}. Service may be interrupted.',
            'template_type': 'maintenance'
        }
    ]
    
    # Get admin user for template creation
    admin_user = User.query.filter_by(role='admin').first()
    if not admin_user:
        print("  ⚠ No admin user found. Creating templates without creator.")
        admin_user_id = 1
    else:
        admin_user_id = admin_user.id
    
    for template_data in templates_data:
        existing_template = SmsTemplate.query.filter_by(name=template_data['name']).first()
        if not existing_template:
            template = SmsTemplate(
                name=template_data['name'],
                message=template_data['message'],
                template_type=template_data['template_type'],
                created_by=admin_user_id
            )
            db.session.add(template)
            print(f"  ✓ Created SMS template: {template_data['name']}")
        else:
            print(f"  ℹ SMS template already exists: {template_data['name']}")
    
    db.session.commit()
    print("✅ SMS templates seeded successfully!")

def main():
    """Main seeding function"""
    print("🚀 Starting communication system seeding...")
    print("=" * 60)
    
    with app.app_context():
        try:
            # Seed communication data
            seed_email_providers()
            seed_sms_providers()
            seed_email_templates()
            seed_sms_templates()
            
            print("=" * 60)
            print("✅ Communication system seeding completed successfully!")
            print("\n📋 Next Steps:")
            print("1. Update provider credentials in the database")
            print("2. Test provider connections")
            print("3. Configure default providers")
            print("4. Start creating campaigns")
            
        except Exception as e:
            print(f"❌ Error during seeding: {e}")
            db.session.rollback()

if __name__ == "__main__":
    main()
