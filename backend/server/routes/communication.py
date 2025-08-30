from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models import (
    EmailProvider, SmsProvider, EmailCampaign, SmsCampaign,
    EmailCampaignRecipient, SmsCampaignRecipient, EmailTemplate, SmsTemplate,
    User, ISP, Customer
)
from datetime import datetime, timedelta
import smtplib
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json

communication_bp = Blueprint('communication', __name__, url_prefix='/api/communication')

def get_current_user_isp():
    """Get current user and their ISP context"""
    try:
        identity = get_jwt_identity()
        if isinstance(identity, dict):
            email = identity.get('email')
        else:
            email = identity
        
        if not email:
            return None, None

        user = User.query.filter_by(email=email).first()
        if not user:
            return None, None
        
        isp = None
        if user.isp_id:
            isp = ISP.query.get(user.isp_id)
        
        return user, isp
    except Exception as e:
        print(f"Error in get_current_user_isp: {e}")
        return None, None

# =========================
#   Email Provider Routes
# =========================

@communication_bp.route('/email-providers', methods=['GET'])
@jwt_required()
def get_email_providers():
    """Get all email providers"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role == 'admin':
            providers = EmailProvider.query.all()
        else:
            if not isp:
                return jsonify({'error': 'User not associated with any ISP'}), 403
            providers = EmailProvider.query.filter_by(isp_id=isp.id).all()
        
        return jsonify({
            'success': True,
            'data': [{
                'id': p.id,
                'name': p.name,
                'provider_type': p.provider_type,
                'host': p.host,
                'port': p.port,
                'username': p.username,
                'sender_email': p.sender_email,
                'is_default': p.is_default,
                'daily_limit': p.daily_limit,
                'current_day_sent': p.current_day_sent or 0,
                'created_at': p.created_at.isoformat() if p.created_at else None,
                'updated_at': p.updated_at.isoformat() if p.updated_at else None
            } for p in providers]
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get email providers: {str(e)}'}), 500

@communication_bp.route('/email-providers', methods=['POST'])
@jwt_required()
def create_email_provider():
    """Create new email provider"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'provider_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Create provider
        provider = EmailProvider(
            name=data['name'],
            provider_type=data['provider_type'],
            host=data.get('host'),
            port=data.get('port'),
            username=data.get('username'),
            password=data.get('password'),
            api_key=data.get('api_key'),
            api_secret=data.get('api_secret'),
            domain=data.get('domain'),
            sender_email=data.get('sender_email'),
            use_tls=data.get('use_tls', True),
            use_ssl=data.get('use_ssl', False),
            is_default=data.get('is_default', False),
            daily_limit=data.get('daily_limit', 1000),
            monthly_limit=data.get('monthly_limit', 30000),
            isp_id=isp.id if isp else None
        )
        
        # If this is set as default, unset others
        if provider.is_default:
            EmailProvider.query.filter_by(isp_id=isp.id if isp else None).update({'is_default': False})
        
        db.session.add(provider)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'data': {
                'id': provider.id,
                'name': provider.name,
                'provider_type': provider.provider_type,
                'is_default': provider.is_default
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create email provider: {str(e)}'}), 500

@communication_bp.route('/email-providers/<int:provider_id>', methods=['PUT'])
@jwt_required()
def update_email_provider(provider_id):
    """Update email provider"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        provider = EmailProvider.query.get_or_404(provider_id)
        
        # Check permissions
        if current_user.role != 'admin' and provider.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Update fields
        for field in ['name', 'provider_type', 'host', 'port', 'username', 'password', 
                     'api_key', 'api_secret', 'domain', 'sender_email', 'use_tls', 
                     'use_ssl', 'is_default', 'daily_limit', 'monthly_limit']:
            if field in data:
                setattr(provider, field, data[field])
        
        # If this is set as default, unset others
        if provider.is_default:
            EmailProvider.query.filter_by(isp_id=isp.id if isp else None).update({'is_default': False})
            provider.is_default = True
        
        provider.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Email provider updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update email provider: {str(e)}'}), 500

@communication_bp.route('/email-providers/<int:provider_id>', methods=['DELETE'])
@jwt_required()
def delete_email_provider(provider_id):
    """Delete email provider"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        provider = EmailProvider.query.get_or_404(provider_id)
        
        # Check permissions
        if current_user.role != 'admin' and provider.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        db.session.delete(provider)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Email provider deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete email provider: {str(e)}'}), 500

# =========================
#   SMS Provider Routes
# =========================

@communication_bp.route('/sms-providers', methods=['GET'])
@jwt_required()
def get_sms_providers():
    """Get all SMS providers"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        providers = SmsProvider.query.filter_by(is_active=True).all()
        
        return jsonify({
            'success': True,
            'data': [{
                'id': p.id,
                'name': p.name,
                'provider_type': p.provider_type,
                'sender_id': p.sender_id,
                'webhook_url': p.webhook_url,
                'is_default': p.is_default,
                'daily_limit': p.daily_limit,
                'monthly_limit': p.monthly_limit,
                'cost_per_sms': float(p.cost_per_sms) if p.cost_per_sms else 0.0,
                'current_day_sent': p.current_day_sent or 0,
                'created_at': p.created_at.isoformat() if p.created_at else None
            } for p in providers]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get SMS providers: {str(e)}'}), 500

@communication_bp.route('/sms-providers', methods=['POST'])
@jwt_required()
def create_sms_provider():
    """Create a new SMS provider"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        required_fields = ['name', 'provider_type']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate provider type
        if data['provider_type'] not in ['api', 'smpp']:
            return jsonify({'error': 'Provider type must be "api" or "smpp"'}), 400
        
        # If setting as default, unset other defaults
        if data.get('is_default', False):
            SmsProvider.query.filter_by(is_default=True).update({'is_default': False})
        
        provider = SmsProvider(
            name=data['name'],
            provider_type=data['provider_type'],
            api_key=data.get('api_key'),
            api_secret=data.get('api_secret'),
            account_sid=data.get('account_sid'),
            auth_token=data.get('auth_token'),
            sender_id=data.get('sender_id'),
            webhook_url=data.get('webhook_url'),
            is_default=data.get('is_default', False),
            daily_limit=data.get('daily_limit', 1000),
            monthly_limit=data.get('monthly_limit', 30000),
            cost_per_sms=data.get('cost_per_sms', 0.0)
        )
        
        db.session.add(provider)
        db.session.commit()
        
        return jsonify({
            'message': 'SMS provider created successfully',
            'provider': {
                'id': provider.id,
                'name': provider.name,
                'provider_type': provider.provider_type
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create SMS provider: {str(e)}'}), 500

@communication_bp.route('/sms-providers/<int:provider_id>', methods=['PUT'])
@jwt_required()
def update_sms_provider(provider_id):
    """Update SMS provider"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        provider = SmsProvider.query.get_or_404(provider_id)
        data = request.get_json()
        
        # Update fields
        for field in ['name', 'provider_type', 'api_key', 'api_secret', 'account_sid', 
                     'auth_token', 'sender_id', 'webhook_url', 'is_default', 'daily_limit', 
                     'monthly_limit', 'cost_per_sms']:
            if field in data:
                setattr(provider, field, data[field])
        
        # If setting as default, unset other defaults
        if provider.is_default:
            SmsProvider.query.filter(SmsProvider.id != provider_id).update({'is_default': False})
        
        provider.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'SMS provider updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update SMS provider: {str(e)}'}), 500

@communication_bp.route('/sms-providers/<int:provider_id>', methods=['DELETE'])
@jwt_required()
def delete_sms_provider(provider_id):
    """Delete SMS provider"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        if current_user.role != 'admin':
            return jsonify({'error': 'Access denied'}), 403
        
        provider = SmsProvider.query.get_or_404(provider_id)
        db.session.delete(provider)
        db.session.commit()
        
        return jsonify({'message': 'SMS provider deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete SMS provider: {str(e)}'}), 500

@communication_bp.route('/sms-providers/<int:provider_id>/test', methods=['POST'])
@jwt_required()
def test_sms_provider(provider_id):
    """Test SMS provider connection"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        provider = SmsProvider.query.get_or_404(provider_id)
        
        # Test connection based on provider type
        if provider.provider_type == 'api':
            if provider.name.lower() == 'twilio':
                # Test Twilio API
                url = f"https://api.twilio.com/2010-04-01/Accounts/{provider.account_sid}/Messages.json"
                auth = (provider.account_sid, provider.auth_token)
                response = requests.get(url, auth=auth)
                
                if response.status_code == 200:
                    return jsonify({'message': 'Twilio API connection successful'}), 200
                else:
                    return jsonify({'error': f'Twilio API connection failed: {response.text}'}), 400
            
            elif provider.name.lower() == 'africastalking':
                # Test Africa's Talking API
                headers = {
                    'apiKey': provider.api_key,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
                response = requests.get('https://api.africastalking.com/version1/user', headers=headers)
                
                if response.status_code == 200:
                    return jsonify({'message': 'Africa\'s Talking API connection successful'}), 200
                else:
                    return jsonify({'error': f'Africa\'s Talking API connection failed: {response.text}'}), 400
        
        return jsonify({'error': 'Unsupported provider type for testing'}), 400
        
    except Exception as e:
        return jsonify({'error': f'Failed to test provider: {str(e)}'}), 500

@communication_bp.route('/sms-providers/<int:provider_id>/send-test', methods=['POST'])
@jwt_required()
def send_test_sms(provider_id):
    """Send test SMS using provider"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        provider = SmsProvider.query.get_or_404(provider_id)
        data = request.get_json()
        
        recipient_phone = data.get('recipient_phone')
        message = data.get('message', 'Test SMS from Infora WiFi billing system.')
        
        if not recipient_phone:
            return jsonify({'error': 'Recipient phone number is required'}), 400
        
        # Send SMS based on provider type
        if provider.provider_type == 'api':
            if provider.name.lower() == 'twilio':
                # Send via Twilio
                url = f"https://api.twilio.com/2010-04-01/Accounts/{provider.account_sid}/Messages.json"
                auth = (provider.account_sid, provider.auth_token)
                payload = {
                    'To': recipient_phone,
                    'From': provider.sender_id or provider.account_sid,
                    'Body': message
                }
                response = requests.post(url, auth=auth, data=payload)
                
                if response.status_code == 201:
                    return jsonify({'message': 'Test SMS sent successfully via Twilio'}), 200
                else:
                    return jsonify({'error': f'Failed to send SMS via Twilio: {response.text}'}), 400
            
            elif provider.name.lower() == 'africastalking':
                # Send via Africa's Talking
                url = 'https://api.africastalking.com/version1/messaging'
                headers = {
                    'apiKey': provider.api_key,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
                payload = {
                    'username': provider.username or 'sandbox',
                    'to': recipient_phone,
                    'message': message,
                    'from': provider.sender_id or 'AFRICASTALKING'
                }
                response = requests.post(url, headers=headers, data=payload)
                
                if response.status_code == 201:
                    return jsonify({'message': 'Test SMS sent successfully via Africa\'s Talking'}), 200
                else:
                    return jsonify({'error': f'Failed to send SMS via Africa\'s Talking: {response.text}'}), 400
        
        return jsonify({'error': 'Unsupported provider type for sending SMS'}), 400
        
    except Exception as e:
        return jsonify({'error': f'Failed to send test SMS: {str(e)}'}), 500

# =========================
#   Email Campaign Routes
# =========================

@communication_bp.route('/email-campaigns', methods=['GET'])
@jwt_required()
def get_email_campaigns():
    """Get all email campaigns"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        campaign_type = request.args.get('campaign_type')
        
        query = EmailCampaign.query
        
        # Apply filters
        if status:
            query = query.filter_by(status=status)
        if campaign_type:
            query = query.filter_by(campaign_type=campaign_type)
        
        # Filter by ISP if not admin
        if current_user.role != 'admin' and isp:
            query = query.filter_by(isp_id=isp.id)
        
        campaigns = query.order_by(EmailCampaign.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'campaigns': [{
                'id': c.id,
                'name': c.name,
                'subject': c.subject,
                'status': c.status,
                'campaign_type': c.campaign_type,
                'scheduled_at': c.scheduled_at.isoformat() if c.scheduled_at else None,
                'sent_at': c.sent_at.isoformat() if c.sent_at else None,
                'total_recipients': c.total_recipients,
                'sent_count': c.sent_count,
                'delivered_count': c.delivered_count,
                'opened_count': c.opened_count,
                'clicked_count': c.clicked_count,
                'failed_count': c.failed_count,
                'provider': {
                    'id': c.provider.id,
                    'name': c.provider.name
                } if c.provider else None,
                'created_at': c.created_at.isoformat() if c.created_at else None
            } for c in campaigns.items],
            'total': campaigns.total,
            'pages': campaigns.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get email campaigns: {str(e)}'}), 500

@communication_bp.route('/email-campaigns', methods=['POST'])
@jwt_required()
def create_email_campaign():
    """Create a new email campaign"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        required_fields = ['name', 'subject', 'content', 'provider_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate provider exists
        provider = EmailProvider.query.get(data['provider_id'])
        if not provider:
            return jsonify({'error': 'Email provider not found'}), 404
        
        campaign = EmailCampaign(
            name=data['name'],
            subject=data['subject'],
            content=data['content'],
            html_content=data.get('html_content'),
            provider_id=data['provider_id'],
            status=data.get('status', 'draft'),
            campaign_type=data.get('campaign_type', 'newsletter'),
            scheduled_at=datetime.fromisoformat(data['scheduled_at'].replace('Z', '+00:00')) if data.get('scheduled_at') else None,
            created_by=current_user.id,
            isp_id=isp.id if isp else None
        )
        
        db.session.add(campaign)
        db.session.commit()
        
        return jsonify({
            'message': 'Email campaign created successfully',
            'campaign': {
                'id': campaign.id,
                'name': campaign.name,
                'status': campaign.status
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create email campaign: {str(e)}'}), 500

@communication_bp.route('/email-campaigns/<int:campaign_id>', methods=['PUT'])
@jwt_required()
def update_email_campaign(campaign_id):
    """Update email campaign"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        campaign = EmailCampaign.query.get_or_404(campaign_id)
        
        # Check permissions
        if current_user.role != 'admin' and campaign.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Update fields
        for field in ['name', 'subject', 'content', 'html_content', 'status', 'campaign_type', 'scheduled_at']:
            if field in data:
                if field == 'scheduled_at' and data[field]:
                    setattr(campaign, field, datetime.fromisoformat(data[field].replace('Z', '+00:00')))
                else:
                    setattr(campaign, field, data[field])
        
        campaign.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Email campaign updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update email campaign: {str(e)}'}), 500

@communication_bp.route('/email-campaigns/<int:campaign_id>', methods=['DELETE'])
@jwt_required()
def delete_email_campaign(campaign_id):
    """Delete email campaign"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        campaign = EmailCampaign.query.get_or_404(campaign_id)
        
        # Check permissions
        if current_user.role != 'admin' and campaign.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        db.session.delete(campaign)
        db.session.commit()
        
        return jsonify({'message': 'Email campaign deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete email campaign: {str(e)}'}), 500

# =========================
#   SMS Campaign Routes
# =========================

@communication_bp.route('/sms-campaigns', methods=['GET'])
@jwt_required()
def get_sms_campaigns():
    """Get all SMS campaigns"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        status = request.args.get('status')
        campaign_type = request.args.get('campaign_type')
        
        query = SmsCampaign.query
        
        # Apply filters
        if status:
            query = query.filter_by(status=status)
        if campaign_type:
            query = query.filter_by(campaign_type=campaign_type)
        
        # Filter by ISP if not admin
        if current_user.role != 'admin' and isp:
            query = query.filter_by(isp_id=isp.id)
        
        campaigns = query.order_by(SmsCampaign.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return jsonify({
            'campaigns': [{
                'id': c.id,
                'name': c.name,
                'message': c.message,
                'status': c.status,
                'campaign_type': c.campaign_type,
                'scheduled_at': c.scheduled_at.isoformat() if c.scheduled_at else None,
                'sent_at': c.sent_at.isoformat() if c.sent_at else None,
                'total_recipients': c.total_recipients,
                'sent_count': c.sent_count,
                'delivered_count': c.delivered_count,
                'failed_count': c.failed_count,
                'provider': {
                    'id': c.provider.id,
                    'name': c.provider.name
                } if c.provider else None,
                'created_at': c.created_at.isoformat() if c.created_at else None
            } for c in campaigns.items],
            'total': campaigns.total,
            'pages': campaigns.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get SMS campaigns: {str(e)}'}), 500

@communication_bp.route('/sms-campaigns', methods=['POST'])
@jwt_required()
def create_sms_campaign():
    """Create a new SMS campaign"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        required_fields = ['name', 'message', 'provider_id']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Validate provider exists
        provider = SmsProvider.query.get(data['provider_id'])
        if not provider:
            return jsonify({'error': 'SMS provider not found'}), 404
        
        campaign = SmsCampaign(
            name=data['name'],
            message=data['message'],
            provider_id=data['provider_id'],
            status=data.get('status', 'draft'),
            campaign_type=data.get('campaign_type', 'notification'),
            scheduled_at=datetime.fromisoformat(data['scheduled_at'].replace('Z', '+00:00')) if data.get('scheduled_at') else None,
            created_by=current_user.id,
            isp_id=isp.id if isp else None
        )
        
        db.session.add(campaign)
        db.session.commit()
        
        return jsonify({
            'message': 'SMS campaign created successfully',
            'campaign': {
                'id': campaign.id,
                'name': campaign.name,
                'status': campaign.status
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create SMS campaign: {str(e)}'}), 500

@communication_bp.route('/sms-campaigns/<int:campaign_id>', methods=['PUT'])
@jwt_required()
def update_sms_campaign(campaign_id):
    """Update SMS campaign"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        campaign = SmsCampaign.query.get_or_404(campaign_id)
        
        # Check permissions
        if current_user.role != 'admin' and campaign.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Update fields
        for field in ['name', 'message', 'status', 'campaign_type', 'scheduled_at']:
            if field in data:
                if field == 'scheduled_at' and data[field]:
                    setattr(campaign, field, datetime.fromisoformat(data[field].replace('Z', '+00:00')))
                else:
                    setattr(campaign, field, data[field])
        
        campaign.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'SMS campaign updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update SMS campaign: {str(e)}'}), 500

@communication_bp.route('/sms-campaigns/<int:campaign_id>', methods=['DELETE'])
@jwt_required()
def delete_sms_campaign(campaign_id):
    """Delete SMS campaign"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        campaign = SmsCampaign.query.get_or_404(campaign_id)
        
        # Check permissions
        if current_user.role != 'admin' and campaign.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        db.session.delete(campaign)
        db.session.commit()
        
        return jsonify({'message': 'SMS campaign deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete SMS campaign: {str(e)}'}), 500

# =========================
#   Template Routes
# =========================

@communication_bp.route('/email-templates', methods=['GET'])
@jwt_required()
def get_email_templates():
    """Get all email templates"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        templates = EmailTemplate.query.filter_by(is_active=True).all()
        
        return jsonify({
            'success': True,
            'data': [{
                'id': t.id,
                'name': t.name,
                'subject': t.subject,
                'content': t.content,
                'html_content': t.html_content,
                'template_type': t.template_type,
                'created_at': t.created_at.isoformat() if t.created_at else None
            } for t in templates]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get email templates: {str(e)}'}), 500

@communication_bp.route('/email-templates', methods=['POST'])
@jwt_required()
def create_email_template():
    """Create new email template"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'subject', 'content']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Create template
        template = EmailTemplate(
            name=data['name'],
            subject=data['subject'],
            content=data['content'],
            html_content=data.get('html_content'),
            template_type=data.get('template_type', 'custom'),
            is_active=data.get('is_active', True),
            created_by=current_user.id,
            isp_id=isp.id if isp else None
        )
        
        db.session.add(template)
        db.session.commit()
        
        return jsonify({
            'message': 'Email template created successfully',
            'template': {
                'id': template.id,
                'name': template.name,
                'template_type': template.template_type
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create email template: {str(e)}'}), 500

@communication_bp.route('/email-templates/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_email_template(template_id):
    """Update email template"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        template = EmailTemplate.query.get_or_404(template_id)
        
        # Check permissions
        if current_user.role != 'admin' and template.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Update fields
        for field in ['name', 'subject', 'content', 'html_content', 'template_type', 'is_active']:
            if field in data:
                setattr(template, field, data[field])
        
        template.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Email template updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update email template: {str(e)}'}), 500

@communication_bp.route('/email-templates/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_email_template(template_id):
    """Delete email template"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        template = EmailTemplate.query.get_or_404(template_id)
        
        # Check permissions
        if current_user.role != 'admin' and template.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        db.session.delete(template)
        db.session.commit()
        
        return jsonify({'message': 'Email template deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete email template: {str(e)}'}), 500

@communication_bp.route('/sms-templates', methods=['GET'])
@jwt_required()
def get_sms_templates():
    """Get all SMS templates"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        templates = SmsTemplate.query.filter_by(is_active=True).all()
        
        return jsonify({
            'success': True,
            'data': [{
                'id': t.id,
                'name': t.name,
                'message': t.message,
                'template_type': t.template_type,
                'created_at': t.created_at.isoformat() if t.created_at else None
            } for t in templates]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get SMS templates: {str(e)}'}), 500

@communication_bp.route('/sms-templates', methods=['POST'])
@jwt_required()
def create_sms_template():
    """Create new SMS template"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'message']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        # Create template
        template = SmsTemplate(
            name=data['name'],
            message=data['message'],
            template_type=data.get('template_type', 'custom'),
            is_active=data.get('is_active', True),
            created_by=current_user.id,
            isp_id=isp.id if isp else None
        )
        
        db.session.add(template)
        db.session.commit()
        
        return jsonify({
            'message': 'SMS template created successfully',
            'template': {
                'id': template.id,
                'name': template.name,
                'template_type': template.template_type
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create SMS template: {str(e)}'}), 500

@communication_bp.route('/sms-templates/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_sms_template(template_id):
    """Update SMS template"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        template = SmsTemplate.query.get_or_404(template_id)
        
        # Check permissions
        if current_user.role != 'admin' and template.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Update fields
        for field in ['name', 'message', 'template_type', 'is_active']:
            if field in data:
                setattr(template, field, data[field])
        
        template.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'SMS template updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update SMS template: {str(e)}'}), 500

@communication_bp.route('/sms-templates/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_sms_template(template_id):
    """Delete SMS template"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        template = SmsTemplate.query.get_or_404(template_id)
        
        # Check permissions
        if current_user.role != 'admin' and template.isp_id != (isp.id if isp else None):
            return jsonify({'error': 'Access denied'}), 403
        
        db.session.delete(template)
        db.session.commit()
        
        return jsonify({'message': 'SMS template deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete SMS template: {str(e)}'}), 500

# =========================
#   Statistics Routes
# =========================

@communication_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_communication_stats():
    """Get communication statistics"""
    try:
        current_user, isp = get_current_user_isp()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Email stats
        email_campaigns = EmailCampaign.query
        if current_user.role != 'admin' and isp:
            email_campaigns = email_campaigns.filter_by(isp_id=isp.id)
        
        total_email_campaigns = email_campaigns.count()
        active_email_campaigns = email_campaigns.filter_by(status='active').count()
        total_email_sent = db.session.query(db.func.sum(EmailCampaign.sent_count)).scalar() or 0
        total_email_delivered = db.session.query(db.func.sum(EmailCampaign.delivered_count)).scalar() or 0
        
        # SMS stats
        sms_campaigns = SmsCampaign.query
        if current_user.role != 'admin' and isp:
            sms_campaigns = sms_campaigns.filter_by(isp_id=isp.id)
        
        total_sms_campaigns = sms_campaigns.count()
        active_sms_campaigns = sms_campaigns.filter_by(status='active').count()
        total_sms_sent = db.session.query(db.func.sum(SmsCampaign.sent_count)).scalar() or 0
        total_sms_delivered = db.session.query(db.func.sum(SmsCampaign.delivered_count)).scalar() or 0
        
        return jsonify({
            'email': {
                'total_campaigns': total_email_campaigns,
                'active_campaigns': active_email_campaigns,
                'total_sent': total_email_sent,
                'total_delivered': total_email_delivered,
                'delivery_rate': round((total_email_delivered / total_email_sent * 100) if total_email_sent > 0 else 0, 2)
            },
            'sms': {
                'total_campaigns': total_sms_campaigns,
                'active_campaigns': active_sms_campaigns,
                'total_sent': total_sms_sent,
                'total_delivered': total_sms_delivered,
                'delivery_rate': round((total_sms_delivered / total_sms_sent * 100) if total_sms_sent > 0 else 0, 2)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get communication stats: {str(e)}'}), 500
