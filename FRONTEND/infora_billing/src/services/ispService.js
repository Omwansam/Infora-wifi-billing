import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class ISPService {
  constructor() {
    this.baseURL = API_ENDPOINTS.ISPS;
  }

  async getISPs(token, params = {}) {
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
      console.error('Error fetching ISPs:', error);
      throw error;
    }
  }

  async getISP(token, ispId) {
    try {
      const response = await fetch(`${this.baseURL}/${ispId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching ISP:', error);
      throw error;
    }
  }

  async createISP(token, ispData) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(ispData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating ISP:', error);
      throw error;
    }
  }

  async updateISP(token, ispId, ispData) {
    try {
      const response = await fetch(`${this.baseURL}/${ispId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(ispData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating ISP:', error);
      throw error;
    }
  }

  async deleteISP(token, ispId) {
    try {
      const response = await fetch(`${this.baseURL}/${ispId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting ISP:', error);
      throw error;
    }
  }

  async getISPStats(token, ispId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.ISP_STATS}/${ispId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching ISP stats:', error);
      throw error;
    }
  }

  async getISPDevices(token, ispId) {
    try {
      const response = await fetch(`${this.baseURL}/${ispId}/devices`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching ISP devices:', error);
      throw error;
    }
  }

  async getISPCustomers(token, ispId) {
    try {
      const response = await fetch(`${this.baseURL}/${ispId}/customers`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching ISP customers:', error);
      throw error;
    }
  }

  async getISPInvoices(token, ispId) {
    try {
      const response = await fetch(`${this.baseURL}/${ispId}/invoices`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching ISP invoices:', error);
      throw error;
    }
  }
}

export default new ISPService();
