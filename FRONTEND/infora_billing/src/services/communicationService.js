import { apiCall } from '../utils/api';
import { getAuthToken } from '../lib/authUtils';
import { API_ENDPOINTS } from '../config/api';

const communicationService = {
  // =========================
  //   Email Provider Methods
  // =========================

  // Get all email providers
  async getEmailProviders() {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.EMAIL_PROVIDERS, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching email providers:', error);
      throw error;
    }
  },

  // Create new email provider
  async createEmailProvider(providerData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.EMAIL_PROVIDERS, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error creating email provider:', error);
      throw error;
    }
  },

  // Test email provider connection
  async testEmailProvider(providerId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.EMAIL_PROVIDERS}/${providerId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error testing email provider:', error);
      throw error;
    }
  },

  // Update email provider
  async updateEmailProvider(providerId, providerData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.EMAIL_PROVIDERS}/${providerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating email provider:', error);
      throw error;
    }
  },

  // Delete email provider
  async deleteEmailProvider(providerId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.EMAIL_PROVIDERS}/${providerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting email provider:', error);
      throw error;
    }
  },

  // =========================
  //   SMS Provider Methods
  // =========================

  // Get all SMS providers
  async getSmsProviders() {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.SMS_PROVIDERS, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching SMS providers:', error);
      throw error;
    }
  },

  // Create new SMS provider
  async createSmsProvider(providerData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.SMS_PROVIDERS, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error creating SMS provider:', error);
      throw error;
    }
  },

  // Test SMS provider connection
  async testSmsProvider(providerId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.SMS_PROVIDERS}/${providerId}/test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error testing SMS provider:', error);
      throw error;
    }
  },

  // Update SMS provider
  async updateSmsProvider(providerId, providerData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.SMS_PROVIDERS}/${providerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating SMS provider:', error);
      throw error;
    }
  },

  // Delete SMS provider
  async deleteSmsProvider(providerId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.SMS_PROVIDERS}/${providerId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting SMS provider:', error);
      throw error;
    }
  },

  // =========================
  //   Email Campaign Methods
  // =========================

  // Get all email campaigns with pagination and filtering
  async getEmailCampaigns(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page);
      if (params.per_page) queryParams.append('per_page', params.per_page);
      if (params.status) queryParams.append('status', params.status);
      if (params.campaign_type) queryParams.append('campaign_type', params.campaign_type);
      
      const url = `${API_ENDPOINTS.EMAIL_CAMPAIGNS}?${queryParams.toString()}`;
      const token = getAuthToken();
      const response = await apiCall(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching email campaigns:', error);
      throw error;
    }
  },

  // Create new email campaign
  async createEmailCampaign(campaignData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.EMAIL_CAMPAIGNS, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(campaignData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error creating email campaign:', error);
      throw error;
    }
  },

  // Update email campaign
  async updateEmailCampaign(campaignId, campaignData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.EMAIL_CAMPAIGNS}/${campaignId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(campaignData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating email campaign:', error);
      throw error;
    }
  },

  // Delete email campaign
  async deleteEmailCampaign(campaignId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.EMAIL_CAMPAIGNS}/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting email campaign:', error);
      throw error;
    }
  },

  // =========================
  //   SMS Campaign Methods
  // =========================

  // Get all SMS campaigns with pagination and filtering
  async getSmsCampaigns(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page);
      if (params.per_page) queryParams.append('per_page', params.per_page);
      if (params.status) queryParams.append('status', params.status);
      if (params.campaign_type) queryParams.append('campaign_type', params.campaign_type);
      
      const url = `${API_ENDPOINTS.SMS_CAMPAIGNS}?${queryParams.toString()}`;
      const token = getAuthToken();
      const response = await apiCall(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching SMS campaigns:', error);
      throw error;
    }
  },

  // Create new SMS campaign
  async createSmsCampaign(campaignData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.SMS_CAMPAIGNS, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(campaignData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error creating SMS campaign:', error);
      throw error;
    }
  },

  // Update SMS campaign
  async updateSmsCampaign(campaignId, campaignData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.SMS_CAMPAIGNS}/${campaignId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(campaignData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating SMS campaign:', error);
      throw error;
    }
  },

  // Delete SMS campaign
  async deleteSmsCampaign(campaignId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.SMS_CAMPAIGNS}/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting SMS campaign:', error);
      throw error;
    }
  },

  // =========================
  //   Template Methods
  // =========================

  // Get all email templates
  async getEmailTemplates() {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.EMAIL_TEMPLATES, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching email templates:', error);
      throw error;
    }
  },

  // Create new email template
  async createEmailTemplate(templateData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.EMAIL_TEMPLATES, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error creating email template:', error);
      throw error;
    }
  },

  // Update email template
  async updateEmailTemplate(templateId, templateData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.EMAIL_TEMPLATES}/${templateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating email template:', error);
      throw error;
    }
  },

  // Delete email template
  async deleteEmailTemplate(templateId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.EMAIL_TEMPLATES}/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting email template:', error);
      throw error;
    }
  },

  // Get all SMS templates
  async getSmsTemplates() {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.SMS_TEMPLATES, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching SMS templates:', error);
      throw error;
    }
  },

  // Create new SMS template
  async createSmsTemplate(templateData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.SMS_TEMPLATES, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error creating SMS template:', error);
      throw error;
    }
  },

  // Update SMS template
  async updateSmsTemplate(templateId, templateData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.SMS_TEMPLATES}/${templateId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error updating SMS template:', error);
      throw error;
    }
  },

  // Delete SMS template
  async deleteSmsTemplate(templateId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.SMS_TEMPLATES}/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error deleting SMS template:', error);
      throw error;
    }
  },

  // =========================
  //   Statistics Methods
  // =========================

  // Get communication statistics
  async getCommunicationStats() {
    try {
      const token = getAuthToken();
      const response = await apiCall(API_ENDPOINTS.COMMUNICATION_STATS, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching communication stats:', error);
      throw error;
    }
  },

  // =========================
  //   Utility Methods
  // =========================

  // Send test email
  async sendTestEmail(providerId, recipientEmail, subject, content) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.EMAIL_PROVIDERS}/${providerId}/send-test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          subject: subject,
          content: content
        })
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error sending test email:', error);
      throw error;
    }
  },

  // Send test SMS
  async sendTestSms(providerId, recipientPhone, message) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`${API_ENDPOINTS.SMS_PROVIDERS}/${providerId}/send-test`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient_phone: recipientPhone,
          message: message
        })
      });

      if (!response.success) {
        throw new Error(response.error);
      }

      return response.data;
    } catch (error) {
      console.error('Error sending test SMS:', error);
      throw error;
    }
  },

  // Process template variables
  processTemplate(template, variables) {
    let processed = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, variables[key] || '');
    });
    return processed;
  },

  // Validate email format
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Validate phone number format
  validatePhone(phone) {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  },

  // Format phone number
  formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    } else if (cleaned.length >= 10) {
      return `+${cleaned}`;
    }
    return phone;
  }
};

export default communicationService;
