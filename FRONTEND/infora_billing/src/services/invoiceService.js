import { API_ENDPOINTS } from '../config/api';
import { apiCall, authenticatedApiCall, authenticatedApiCallText } from '../utils/api';

// Helper function to get token from localStorage
const getToken = () => {
  try {
    const userData = localStorage.getItem('infora_user');
    if (userData) {
      const user = JSON.parse(userData);
      return user.access_token;
    }
    return null;
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const invoiceService = {
  // Get all invoices with pagination and filtering
  async getInvoices(params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.status) queryParams.append('status', params.status);
    if (params.customer_id) queryParams.append('customer_id', params.customer_id);
    if (params.search) queryParams.append('search', params.search);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    
    const url = `${API_ENDPOINTS.INVOICES}?${queryParams.toString()}`;
    return authenticatedApiCall(url, getToken());
  },

  // Get specific invoice by ID
  async getInvoice(invoiceId) {
    const url = `${API_ENDPOINTS.INVOICES}/${invoiceId}`;
    return authenticatedApiCall(url, getToken());
  },

  // Create new invoice
  async createInvoice(invoiceData) {
    const url = API_ENDPOINTS.INVOICES;
    return authenticatedApiCall(url, getToken(), {
      method: 'POST',
      body: JSON.stringify(invoiceData)
    });
  },

  // Update invoice
  async updateInvoice(invoiceId, invoiceData) {
    const url = `${API_ENDPOINTS.INVOICES}/${invoiceId}`;
    return authenticatedApiCall(url, getToken(), {
      method: 'PUT',
      body: JSON.stringify(invoiceData)
    });
  },

  // Delete invoice
  async deleteInvoice(invoiceId) {
    const url = `${API_ENDPOINTS.INVOICES}/${invoiceId}`;
    return authenticatedApiCall(url, getToken(), {
      method: 'DELETE'
    });
  },

  // Update invoice status
  async updateInvoiceStatus(invoiceId, status) {
    const url = `${API_ENDPOINTS.INVOICES}/${invoiceId}/status`;
    return authenticatedApiCall(url, getToken(), {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Get invoice payments
  async getInvoicePayments(invoiceId, params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    
    const url = `${API_ENDPOINTS.INVOICES}/${invoiceId}/payments?${queryParams.toString()}`;
    return authenticatedApiCall(url, getToken());
  },

  // Get pending invoices
  async getPendingInvoices(params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    
    const url = `${API_ENDPOINTS.INVOICES}/pending?${queryParams.toString()}`;
    return authenticatedApiCall(url, getToken());
  },

  // Get overdue invoices
  async getOverdueInvoices(params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    
    const url = `${API_ENDPOINTS.INVOICES}/overdue?${queryParams.toString()}`;
    return authenticatedApiCall(url, getToken());
  },

  // Get invoice statistics
  async getInvoiceStats() {
    const url = `${API_ENDPOINTS.INVOICES}/stats`;
    return authenticatedApiCall(url, getToken());
  },

  // Generate bulk invoices
  async generateBulkInvoices(bulkData) {
    const url = `${API_ENDPOINTS.INVOICES}/generate-bulk`;
    return authenticatedApiCall(url, getToken(), {
      method: 'POST',
      body: JSON.stringify(bulkData)
    });
  },

  // Send invoice reminder
  async sendInvoiceReminder(invoiceId) {
    const url = `${API_ENDPOINTS.INVOICES}/${invoiceId}/send-reminder`;
    return authenticatedApiCall(url, getToken(), {
      method: 'POST'
    });
  },

  // Download invoice
  async downloadInvoice(invoiceId) {
    const url = `${API_ENDPOINTS.INVOICES}/${invoiceId}/download`;
    return authenticatedApiCall(url, getToken());
  },

  // Generate invoice PDF
  async generateInvoicePDF(invoiceId) {
    const url = `${API_ENDPOINTS.INVOICES}/${invoiceId}/pdf`;
    return authenticatedApiCallText(url, getToken());
  }
};
