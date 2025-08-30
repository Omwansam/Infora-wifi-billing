# 📧📱 Communication System Setup Guide

This guide provides comprehensive instructions for setting up email and SMS communication systems with support for multiple vendors in the Infora WiFi Billing System.

## 🎯 Overview

The communication system supports multiple email and SMS providers, allowing you to:
- Configure multiple email providers (Gmail, SendGrid, Mailgun, etc.)
- Configure multiple SMS providers (Twilio, Africa's Talking, etc.)
- Create and manage email/SMS campaigns
- Use templates for consistent messaging
- Track delivery statistics and analytics

## 📧 Email Provider Configuration

### Supported Email Providers

#### 1. Gmail SMTP
```env
# Gmail Configuration
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-email@gmail.com
```

**Setup Steps:**
1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the generated password in `MAIL_PASSWORD`

#### 2. SendGrid API
```env
# SendGrid Configuration
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=your-verified-sender@yourdomain.com
```

**Setup Steps:**
1. Create a SendGrid account
2. Verify your sender domain or email address
3. Generate an API key with "Mail Send" permissions
4. Add the API key to your environment variables

#### 3. Mailgun API
```env
# Mailgun Configuration
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-domain.com
MAILGUN_FROM_EMAIL=noreply@your-domain.com
```

**Setup Steps:**
1. Create a Mailgun account
2. Add and verify your domain
3. Generate an API key
4. Configure DNS records as instructed by Mailgun

#### 4. AWS SES
```env
# AWS SES Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_SES_FROM_EMAIL=your-verified-email@yourdomain.com
```

**Setup Steps:**
1. Create an AWS account
2. Set up SES in your preferred region
3. Verify your email address or domain
4. Create IAM user with SES permissions
5. Generate access keys

### Email Provider Ports

| Provider | SMTP Host | SMTP Port | TLS/SSL |
|----------|-----------|-----------|---------|
| Gmail | smtp.gmail.com | 587 | TLS |
| Gmail | smtp.gmail.com | 465 | SSL |
| Outlook | smtp-mail.outlook.com | 587 | TLS |
| Yahoo | smtp.mail.yahoo.com | 587 | TLS |
| Yahoo | smtp.mail.yahoo.com | 465 | SSL |
| SendGrid | smtp.sendgrid.net | 587 | TLS |
| Mailgun | smtp.mailgun.org | 587 | TLS |
| AWS SES | email-smtp.us-east-1.amazonaws.com | 587 | TLS |
| AWS SES | email-smtp.us-east-1.amazonaws.com | 465 | SSL |

## 📱 SMS Provider Configuration

### Supported SMS Providers

#### 1. Twilio
```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

**Setup Steps:**
1. Create a Twilio account
2. Get your Account SID and Auth Token from the dashboard
3. Purchase a phone number
4. Add credentials to environment variables

#### 2. Africa's Talking
```env
# Africa's Talking Configuration
AFRICASTALKING_API_KEY=your-api-key
AFRICASTALKING_USERNAME=your-username
AFRICASTALKING_SENDER_ID=your-sender-id
```

**Setup Steps:**
1. Create an Africa's Talking account
2. Get your API key and username
3. Register a sender ID (for Kenya)
4. Add credentials to environment variables

#### 3. Vonage (formerly Nexmo)
```env
# Vonage Configuration
VONAGE_API_KEY=your-api-key
VONAGE_API_SECRET=your-api-secret
VONAGE_FROM_NUMBER=+1234567890
```

**Setup Steps:**
1. Create a Vonage account
2. Get your API key and secret
3. Purchase a phone number
4. Add credentials to environment variables

#### 4. MessageBird
```env
# MessageBird Configuration
MESSAGEBIRD_API_KEY=your-api-key
MESSAGEBIRD_ORIGINATOR=your-originator
```

**Setup Steps:**
1. Create a MessageBird account
2. Get your API key
3. Set up an originator (sender ID)
4. Add credentials to environment variables

## 🔧 Database Configuration

### 1. Run Database Migrations
```bash
cd backend
flask db upgrade
```

### 2. Seed Default Providers
```bash
flask seed-communication
```

### 3. Verify Database Tables
```sql
-- Check if communication tables exist
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%email%' OR name LIKE '%sms%';
```

## 🚀 Quick Setup Commands

### 1. Install Dependencies
```bash
# Backend dependencies
cd backend
pip install -r requirements.txt

# Additional communication packages
pip install sendgrid twilio africastalking boto3
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 3. Test Configuration
```bash
# Test email configuration
flask test-email

# Test SMS configuration
flask test-sms
```

## 📊 Provider Management

### Adding Email Providers via API

```bash
# Add Gmail SMTP Provider
curl -X POST http://localhost:5000/api/communication/email-providers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gmail SMTP",
    "provider_type": "smtp",
    "host": "smtp.gmail.com",
    "port": 587,
    "username": "your-email@gmail.com",
    "password": "your-app-password",
    "use_tls": true,
    "is_default": true
  }'

# Add SendGrid API Provider
curl -X POST http://localhost:5000/api/communication/email-providers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "SendGrid",
    "provider_type": "api",
    "api_key": "your-sendgrid-api-key",
    "is_default": false
  }'
```

### Adding SMS Providers via API

```bash
# Add Twilio Provider
curl -X POST http://localhost:5000/api/communication/sms-providers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Twilio",
    "provider_type": "api",
    "account_sid": "your-account-sid",
    "auth_token": "your-auth-token",
    "sender_id": "+1234567890",
    "is_default": true
  }'

# Add Africa's Talking Provider
curl -X POST http://localhost:5000/api/communication/sms-providers \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Africa\'s Talking",
    "provider_type": "api",
    "api_key": "your-api-key",
    "sender_id": "INFORA",
    "is_default": false
  }'
```

## 🧪 Testing Providers

### Test Email Provider
```bash
curl -X POST http://localhost:5000/api/communication/email-providers/1/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Test SMS Provider
```bash
curl -X POST http://localhost:5000/api/communication/sms-providers/1/test \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📈 Campaign Management

### Create Email Campaign
```bash
curl -X POST http://localhost:5000/api/communication/email-campaigns \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Welcome Campaign",
    "subject": "Welcome to Infora WiFi",
    "content": "Welcome to our service!",
    "provider_id": 1,
    "campaign_type": "welcome",
    "status": "draft"
  }'
```

### Create SMS Campaign
```bash
curl -X POST http://localhost:5000/api/communication/sms-campaigns \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment Reminder",
    "message": "Your payment is due. Please pay to avoid service interruption.",
    "provider_id": 1,
    "campaign_type": "reminder",
    "status": "draft"
  }'
```

## 🔒 Security Considerations

### 1. Environment Variables
- Never commit API keys to version control
- Use strong, unique passwords for each provider
- Rotate API keys regularly

### 2. Rate Limiting
- Respect provider rate limits
- Implement retry logic with exponential backoff
- Monitor usage to avoid exceeding limits

### 3. Data Protection
- Encrypt sensitive data in the database
- Use HTTPS for all API communications
- Implement proper access controls

## 🐛 Troubleshooting

### Common Email Issues

#### Gmail Authentication Failed
```
Error: SMTPAuthenticationError: (535, b'5.7.8 Username and Password not accepted')
```
**Solution:**
1. Enable 2-Factor Authentication
2. Generate App Password
3. Use App Password instead of regular password

#### SendGrid API Error
```
Error: 401 Unauthorized
```
**Solution:**
1. Verify API key is correct
2. Check API key permissions
3. Ensure sender email is verified

### Common SMS Issues

#### Twilio Authentication Failed
```
Error: 401 Unauthorized
```
**Solution:**
1. Verify Account SID and Auth Token
2. Check if account is active
3. Ensure phone number is purchased

#### Africa's Talking API Error
```
Error: 400 Bad Request
```
**Solution:**
1. Verify API key and username
2. Check sender ID registration
3. Ensure phone numbers are in correct format

## 📞 Support

For additional support:
- Check provider documentation
- Review system logs
- Contact provider support
- Open an issue in the project repository

## 🔄 Updates and Maintenance

### Regular Maintenance Tasks
1. Monitor delivery rates
2. Check provider status pages
3. Update API keys when needed
4. Review and optimize campaigns
5. Backup communication data

### Version Updates
1. Check for provider API changes
2. Update dependencies
3. Test all providers after updates
4. Update documentation

---

**Note:** This guide covers the most common providers. Additional providers can be added by extending the provider classes and implementing their specific APIs.
