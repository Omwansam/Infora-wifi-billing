# Communication System Documentation

## Overview

The Infora WiFi Billing System includes a comprehensive communication management system that supports both email and SMS communications. This system allows you to:

- Configure multiple email providers (SMTP and API-based)
- Configure multiple SMS providers (API-based)
- Create and manage email templates
- Create and manage SMS templates
- Send test messages to verify provider configurations
- Track communication statistics

## Email Providers

### Supported Email Providers

1. **SMTP Providers**
   - Gmail SMTP
   - Outlook/Hotmail SMTP
   - Custom SMTP servers
   - Any SMTP-compatible email service

2. **API Providers**
   - SendGrid
   - Mailgun
   - AWS SES
   - Any REST API-based email service

### Email Provider Configuration

#### SMTP Configuration
```json
{
  "name": "Gmail SMTP",
  "provider_type": "smtp",
  "host": "smtp.gmail.com",
  "port": 587,
  "username": "your-email@gmail.com",
  "password": "your-app-password",
  "sender_email": "your-email@gmail.com",
  "use_tls": true,
  "use_ssl": false,
  "is_default": true,
  "daily_limit": 1000
}
```

#### API Configuration
```json
{
  "name": "SendGrid",
  "provider_type": "api",
  "api_key": "your-sendgrid-api-key",
  "sender_email": "your-verified-sender@domain.com",
  "is_default": false,
  "daily_limit": 10000
}
```

### Common SMTP Settings

| Provider | Host | Port | TLS | SSL |
|----------|------|------|-----|-----|
| Gmail | smtp.gmail.com | 587 | Yes | No |
| Gmail | smtp.gmail.com | 465 | No | Yes |
| Outlook | smtp-mail.outlook.com | 587 | Yes | No |
| Yahoo | smtp.mail.yahoo.com | 587 | Yes | No |
| Custom | your-smtp-server.com | 587 | Yes | No |

## SMS Providers

### Supported SMS Providers

1. **Twilio**
2. **Africa's Talking**
3. **Vonage (Nexmo)**
4. **MessageBird**
5. **Any REST API-based SMS service**

### SMS Provider Configuration

#### Twilio Configuration
```json
{
  "name": "Twilio",
  "provider_type": "api",
  "account_sid": "your-account-sid",
  "auth_token": "your-auth-token",
  "sender_id": "+1234567890",
  "is_default": true,
  "daily_limit": 1000,
  "cost_per_sms": 0.0075
}
```

#### Africa's Talking Configuration
```json
{
  "name": "Africa's Talking",
  "provider_type": "api",
  "api_key": "your-api-key",
  "sender_id": "INFORA",
  "is_default": false,
  "daily_limit": 1000,
  "cost_per_sms": 0.0050
}
```

## Email Templates

### Template Variables

Email templates support variable substitution using the `{{variable_name}}` syntax:

#### Available Variables
- `{{customer_name}}` - Customer's full name
- `{{username}}` - Customer's username
- `{{password}}` - Customer's password
- `{{plan_name}}` - Service plan name
- `{{monthly_fee}}` - Monthly service fee
- `{{amount}}` - Payment amount
- `{{due_date}}` - Payment due date
- `{{invoice_number}}` - Invoice number
- `{{mpesa_number}}` - M-Pesa payment number
- `{{bank_details}}` - Bank transfer details
- `{{support_number}}` - Support phone number
- `{{maintenance_date}}` - Maintenance date
- `{{maintenance_time}}` - Maintenance time
- `{{duration}}` - Maintenance duration
- `{{affected_areas}}` - Affected service areas

### Template Types

1. **Welcome Email**
   - Sent when a new customer account is created
   - Includes account credentials and plan details

2. **Payment Reminder**
   - Sent before payment due date
   - Includes payment amount, due date, and payment methods

3. **Service Maintenance**
   - Sent for scheduled maintenance notifications
   - Includes maintenance details and expected duration

4. **Custom**
   - User-defined templates for specific use cases

### Example Email Templates

#### Welcome Email Template
```html
Subject: Welcome to Infora WiFi - Your Account is Ready!

Dear {{customer_name}},

Welcome to Infora WiFi! Your account has been successfully created and is now active.

Account Details:
- Username: {{username}}
- Password: {{password}}
- Plan: {{plan_name}}
- Monthly Fee: {{monthly_fee}}

You can now connect to our WiFi network using your credentials. If you have any questions or need assistance, please don't hesitate to contact our support team.

Thank you for choosing Infora WiFi!

Best regards,
The Infora Team
```

#### Payment Reminder Template
```html
Subject: Payment Due - Infora WiFi Service

Dear {{customer_name}},

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
The Infora Team
```

## SMS Templates

### Template Variables

SMS templates support the same variable substitution as email templates:

#### Available Variables
- `{{customer_name}}` - Customer's name
- `{{username}}` - Customer's username
- `{{password}}` - Customer's password
- `{{amount}}` - Payment amount
- `{{due_date}}` - Payment due date
- `{{mpesa_number}}` - M-Pesa payment number
- `{{support_number}}` - Support phone number
- `{{alert_message}}` - Service alert message
- `{{resolution_time}}` - Expected resolution time
- `{{transaction_id}}` - Payment transaction ID
- `{{expiry_date}}` - Service expiry date
- `{{maintenance_date}}` - Maintenance date
- `{{maintenance_time}}` - Maintenance time
- `{{duration}}` - Maintenance duration

### Template Types

1. **Welcome SMS**
   - Sent when a new customer account is created
   - Includes account credentials

2. **Payment Reminder**
   - Sent before payment due date
   - Includes payment amount and due date

3. **Service Alert**
   - Sent for service issues or maintenance
   - Includes alert message and resolution time

4. **Payment Confirmation**
   - Sent after successful payment
   - Includes payment details and service status

5. **Maintenance Notice**
   - Sent for scheduled maintenance
   - Includes maintenance details

### Example SMS Templates

#### Welcome SMS Template
```
Welcome to Infora WiFi! Your account is now active. Username: {{username}}, Password: {{password}}. For support call {{support_number}}.
```

#### Payment Reminder Template
```
Hi {{customer_name}}, your payment of {{amount}} is due on {{due_date}}. Pay via M-Pesa {{mpesa_number}} to avoid service interruption.
```

#### Service Alert Template
```
Infora WiFi: {{alert_message}}. Expected resolution: {{resolution_time}}. We apologize for any inconvenience.
```

## API Endpoints

### Email Providers

- `GET /api/communication/email-providers` - Get all email providers
- `POST /api/communication/email-providers` - Create new email provider
- `PUT /api/communication/email-providers/{id}` - Update email provider
- `DELETE /api/communication/email-providers/{id}` - Delete email provider

### SMS Providers

- `GET /api/communication/sms-providers` - Get all SMS providers
- `POST /api/communication/sms-providers` - Create new SMS provider
- `PUT /api/communication/sms-providers/{id}` - Update SMS provider
- `DELETE /api/communication/sms-providers/{id}` - Delete SMS provider
- `POST /api/communication/sms-providers/{id}/test` - Test SMS provider

### Email Templates

- `GET /api/communication/email-templates` - Get all email templates
- `POST /api/communication/email-templates` - Create new email template
- `PUT /api/communication/email-templates/{id}` - Update email template
- `DELETE /api/communication/email-templates/{id}` - Delete email template

### SMS Templates

- `GET /api/communication/sms-templates` - Get all SMS templates
- `POST /api/communication/sms-templates` - Create new SMS template
- `PUT /api/communication/sms-templates/{id}` - Update SMS template
- `DELETE /api/communication/sms-templates/{id}` - Delete SMS template

### Campaigns

- `GET /api/communication/email-campaigns` - Get all email campaigns
- `POST /api/communication/email-campaigns` - Create new email campaign
- `GET /api/communication/sms-campaigns` - Get all SMS campaigns
- `POST /api/communication/sms-campaigns` - Create new SMS campaign

### Statistics

- `GET /api/communication/stats` - Get communication statistics

## Setup Instructions

### 1. Database Migration

Run the database migration to create the communication tables:

```bash
cd backend
flask db migrate -m "Add communication models"
flask db upgrade
```

### 2. Seed Data

Populate the database with default providers and templates:

```bash
cd backend
flask seed-communication
```

### 3. Install Dependencies

Install the required Python packages:

```bash
cd backend
pip install -r requirements.txt
```

### 4. Configure Providers

1. Access the Email Management page in the frontend
2. Click "Add Provider" to configure your email providers
3. Test each provider using the test button
4. Set a default provider for automatic email sending

### 5. Configure SMS Providers

1. Access the SMS Management page in the frontend
2. Click "Add Provider" to configure your SMS providers
3. Test each provider using the test button
4. Set a default provider for automatic SMS sending

## Usage Examples

### Sending an Email

```javascript
// Using the communication service
import communicationService from '../services/communicationService';

// Send a welcome email
const welcomeEmail = {
  template_id: 1,
  recipient_email: 'customer@example.com',
  variables: {
    customer_name: 'John Doe',
    username: 'johndoe',
    password: 'securepass123',
    plan_name: 'Premium Plan',
    monthly_fee: '$29.99'
  }
};

await communicationService.sendEmail(welcomeEmail);
```

### Sending an SMS

```javascript
// Using the communication service
import communicationService from '../services/communicationService';

// Send a payment reminder
const paymentSms = {
  template_id: 2,
  recipient_phone: '+1234567890',
  variables: {
    customer_name: 'John Doe',
    amount: '$29.99',
    due_date: '2024-01-15',
    mpesa_number: '254700000000'
  }
};

await communicationService.sendSms(paymentSms);
```

## Troubleshooting

### Common Issues

1. **SMTP Authentication Failed**
   - Verify username and password
   - Check if 2FA is enabled (use app password for Gmail)
   - Ensure the account allows less secure apps

2. **SMS Provider Test Fails**
   - Verify API credentials
   - Check sender ID configuration
   - Ensure sufficient account balance

3. **Template Variables Not Replaced**
   - Check variable syntax (use `{{variable_name}}`)
   - Ensure all required variables are provided
   - Verify template is active

4. **Daily Limit Exceeded**
   - Check provider daily limits
   - Consider upgrading provider plan
   - Use multiple providers for load balancing

### Provider-Specific Issues

#### Gmail SMTP
- Enable 2FA and generate app password
- Use port 587 with TLS or port 465 with SSL
- Ensure "Less secure app access" is enabled (if not using app password)

#### Twilio SMS
- Verify account SID and auth token
- Check sender ID format (phone number or alphanumeric)
- Ensure sufficient account balance

#### Africa's Talking
- Verify API key
- Check sender ID (alphanumeric only)
- Ensure account is active

## Security Considerations

1. **API Keys and Passwords**
   - Store sensitive credentials securely
   - Use environment variables for production
   - Rotate credentials regularly

2. **Rate Limiting**
   - Implement rate limiting for API endpoints
   - Monitor daily/monthly usage limits
   - Set up alerts for limit thresholds

3. **Data Privacy**
   - Encrypt sensitive customer data
   - Comply with data protection regulations
   - Implement proper access controls

## Monitoring and Analytics

The communication system provides comprehensive analytics:

- Email delivery rates
- SMS delivery rates
- Campaign performance metrics
- Provider usage statistics
- Cost tracking for SMS messages

Access these statistics through the `/api/communication/stats` endpoint or the frontend dashboard.

## Support

For technical support or questions about the communication system:

1. Check the troubleshooting section above
2. Review the API documentation
3. Contact the development team
4. Submit an issue on the project repository
