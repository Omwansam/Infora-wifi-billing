import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { apiCall, authenticatedApiCall } from '../utils/api';

// Helper function to get token from localStorage
const getToken = () => {
  const userData = localStorage.getItem('infora_user');
  console.log('User data from localStorage:', userData);
  if (userData) {
    try {
      const user = JSON.parse(userData);
      console.log('Parsed user data:', user);
      console.log('Access token:', user.access_token);
      return user.access_token;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  }
  console.log('No user data found in localStorage');
  return null;
};

export const customerService = {
  // Get all customers with pagination and filtering
  async getCustomers(params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params.sort_order) queryParams.append('sort_order', params.sort_order);
    
    const url = `${API_ENDPOINTS.CUSTOMERS}?${queryParams.toString()}`;
    return authenticatedApiCall(url, getToken());
  },

  // Get a specific customer by ID
  async getCustomer(customerId) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}`;
    return authenticatedApiCall(url, getToken());
  },

  // Create a new customer
  async createCustomer(customerData) {
    return authenticatedApiCall(API_ENDPOINTS.CUSTOMERS, getToken(), {
      method: 'POST',
      body: JSON.stringify(customerData)
    });
  },

  // Update customer information
  async updateCustomer(customerId, customerData) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}`;
    return authenticatedApiCall(url, getToken(), {
      method: 'PUT',
      body: JSON.stringify(customerData)
    });
  },

  // Delete customer
  async deleteCustomer(customerId) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}`;
    return authenticatedApiCall(url, getToken(), {
      method: 'DELETE'
    });
  },

  // Update customer status
  async updateCustomerStatus(customerId, status) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/status`;
    return authenticatedApiCall(url, getToken(), {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Update customer balance
  async updateCustomerBalance(customerId, balance) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/balance`;
    return authenticatedApiCall(url, getToken(), {
      method: 'PUT',
      body: JSON.stringify({ balance })
    });
  },

  // Update customer usage
  async updateCustomerUsage(customerId, usageData) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/usage`;
    return authenticatedApiCall(url, getToken(), {
      method: 'PUT',
      body: JSON.stringify(usageData)
    });
  },

  // Get customer statistics
  async getCustomerStats() {
    const url = `${API_ENDPOINTS.CUSTOMERS}/stats`;
    return authenticatedApiCall(url, getToken());
  },

  // Get customer invoices
  async getCustomerInvoices(customerId, params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.status) queryParams.append('status', params.status);
    
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/invoices?${queryParams.toString()}`;
    return authenticatedApiCall(url, getToken());
  },

  // Get customer payments
  async getCustomerPayments(customerId, params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.status) queryParams.append('status', params.status);
    
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/payments?${queryParams.toString()}`;
    return authenticatedApiCall(url, getToken());
  },

  // Get customer tickets
  async getCustomerTickets(customerId, params = {}) {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.status) queryParams.append('status', params.status);
    
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/tickets?${queryParams.toString()}`;
    return authenticatedApiCall(url, getToken());
  }
};
