import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class BillingService {
  constructor() {
    this.baseURL = API_ENDPOINTS.BILLING_SUBSCRIPTIONS;
  }

  // Billing Subscriptions
  async getSubscriptions(token, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `${this.baseURL}?${queryParams}` : this.baseURL;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      throw error;
    }
  }

  async getSubscription(token, subscriptionId) {
    try {
      const response = await fetch(`${this.baseURL}/${subscriptionId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      throw error;
    }
  }

  async createSubscription(token, subscriptionData) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(subscriptionData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    }
  }

  async updateSubscription(token, subscriptionId, subscriptionData) {
    try {
      const response = await fetch(`${this.baseURL}/${subscriptionId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(subscriptionData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(token, subscriptionId) {
    try {
      const response = await fetch(`${this.baseURL}/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  // Billing Payments
  async getPayments(token, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `${API_ENDPOINTS.BILLING_PAYMENTS}?${queryParams}` : API_ENDPOINTS.BILLING_PAYMENTS;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }
  }

  async getPayment(token, paymentId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.BILLING_PAYMENTS}/${paymentId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  }

  async createPayment(token, paymentData) {
    try {
      const response = await fetch(API_ENDPOINTS.BILLING_PAYMENTS, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  }

  async updatePayment(token, paymentId, paymentData) {
    try {
      const response = await fetch(`${API_ENDPOINTS.BILLING_PAYMENTS}/${paymentId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating payment:', error);
      throw error;
    }
  }

  async refundPayment(token, paymentId, refundData = {}) {
    try {
      const response = await fetch(`${API_ENDPOINTS.BILLING_PAYMENTS}/${paymentId}/refund`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(refundData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error refunding payment:', error);
      throw error;
    }
  }

  // Billing Transactions
  async getTransactions(token, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `${API_ENDPOINTS.BILLING_TRANSACTIONS}?${queryParams}` : API_ENDPOINTS.BILLING_TRANSACTIONS;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async getTransaction(token, transactionId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.BILLING_TRANSACTIONS}/${transactionId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      throw error;
    }
  }

  // Billing Reports
  async getBillingReports(token, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `${API_ENDPOINTS.BILLING_REPORTS}?${queryParams}` : API_ENDPOINTS.BILLING_REPORTS;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching billing reports:', error);
      throw error;
    }
  }

  async generateBillingReport(token, reportData) {
    try {
      const response = await fetch(API_ENDPOINTS.BILLING_REPORTS, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating billing report:', error);
      throw error;
    }
  }

  async downloadBillingReport(token, reportId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.BILLING_REPORTS}/${reportId}/download`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error downloading billing report:', error);
      throw error;
    }
  }

  // Billing Vouchers
  async getVouchers(token, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `${API_ENDPOINTS.BILLING_VOUCHERS}?${queryParams}` : API_ENDPOINTS.BILLING_VOUCHERS;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      throw error;
    }
  }

  async getVoucher(token, voucherId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.BILLING_VOUCHERS}/${voucherId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching voucher:', error);
      throw error;
    }
  }

  async createVoucher(token, voucherData) {
    try {
      const response = await fetch(API_ENDPOINTS.BILLING_VOUCHERS, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(voucherData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating voucher:', error);
      throw error;
    }
  }

  async updateVoucher(token, voucherId, voucherData) {
    try {
      const response = await fetch(`${API_ENDPOINTS.BILLING_VOUCHERS}/${voucherId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(voucherData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating voucher:', error);
      throw error;
    }
  }

  async deleteVoucher(token, voucherId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.BILLING_VOUCHERS}/${voucherId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting voucher:', error);
      throw error;
    }
  }

  async bulkCreateVouchers(token, voucherData) {
    try {
      const response = await fetch(`${API_ENDPOINTS.BILLING_VOUCHERS}/bulk`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(voucherData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error bulk creating vouchers:', error);
      throw error;
    }
  }

  // Billing Statistics
  async getBillingStats(token, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `${this.baseURL}/stats?${queryParams}` : `${this.baseURL}/stats`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching billing stats:', error);
      throw error;
    }
  }
}

export default new BillingService();
