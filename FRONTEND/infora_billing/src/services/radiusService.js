import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class RadiusService {
  constructor() {
    this.baseURL = API_ENDPOINTS.RADIUS_CLIENTS;
  }

  // RADIUS Clients
  async getRadiusClients(token) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching RADIUS clients:', error);
      throw error;
    }
  }

  async createRadiusClient(token, clientData) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(clientData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Error creating RADIUS client:', error);
      throw error;
    }
  }

  async updateRadiusClient(token, clientId, clientData) {
    try {
      const response = await fetch(`${this.baseURL}/${clientId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(clientData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating RADIUS client:', error);
      throw error;
    }
  }

  async deleteRadiusClient(token, clientId) {
    try {
      const response = await fetch(`${this.baseURL}/${clientId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting RADIUS client:', error);
      throw error;
    }
  }

  // RADIUS Users
  async getRadiusUsers(token, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `${API_ENDPOINTS.RADIUS_USERS}?${queryParams}` : API_ENDPOINTS.RADIUS_USERS;
      
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
      console.error('Error fetching RADIUS users:', error);
      throw error;
    }
  }

  async createRadiusUser(token, userData) {
    try {
      const response = await fetch(API_ENDPOINTS.RADIUS_USERS, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating RADIUS user:', error);
      throw error;
    }
  }

  async updateRadiusUser(token, userId, userData) {
    try {
      const response = await fetch(`${API_ENDPOINTS.RADIUS_USERS}/${userId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating RADIUS user:', error);
      throw error;
    }
  }

  async deleteRadiusUser(token, userId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.RADIUS_USERS}/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting RADIUS user:', error);
      throw error;
    }
  }

  // RADIUS Groups
  async getRadiusGroups(token) {
    try {
      const response = await fetch(API_ENDPOINTS.RADIUS_GROUPS, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching RADIUS groups:', error);
      throw error;
    }
  }

  async createRadiusGroup(token, groupData) {
    try {
      const response = await fetch(API_ENDPOINTS.RADIUS_GROUPS, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(groupData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating RADIUS group:', error);
      throw error;
    }
  }

  // RADIUS Accounting
  async getRadiusAccounting(token, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams ? `${API_ENDPOINTS.RADIUS_ACCOUNTING}?${queryParams}` : API_ENDPOINTS.RADIUS_ACCOUNTING;
      
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
      console.error('Error fetching RADIUS accounting:', error);
      throw error;
    }
  }

  // RADIUS API
  async getRadiusApiStatus(token) {
    try {
      const response = await fetch(API_ENDPOINTS.RADIUS_API, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching RADIUS API status:', error);
      throw error;
    }
  }

  // RADIUS Routes
  async getRadiusRoutes(token) {
    try {
      const response = await fetch(API_ENDPOINTS.RADIUS_ROUTES, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching RADIUS routes:', error);
      throw error;
    }
  }

  async createRadiusRoute(token, routeData) {
    try {
      const response = await fetch(API_ENDPOINTS.RADIUS_ROUTES, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(routeData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating RADIUS route:', error);
      throw error;
    }
  }

  async getRadiusSessions(token, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams
        ? `${API_ENDPOINTS.RADIUS_ROUTES}/sessions?${queryParams}`
        : `${API_ENDPOINTS.RADIUS_ROUTES}/sessions`;

      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching RADIUS sessions:', error);
      throw error;
    }
  }

  async getRadiusStats(token) {
    try {
      const response = await fetch(`${API_ENDPOINTS.RADIUS_ROUTES}/stats`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching RADIUS stats:', error);
      throw error;
    }
  }

  async terminateRadiusSession(token, sessionId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.RADIUS_ROUTES}/sessions/terminate/${sessionId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Error terminating RADIUS session:', error);
      throw error;
    }
  }

  async testRadiusClient(token, clientId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.RADIUS_TEST}/${clientId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('Error testing RADIUS client:', error);
      throw error;
    }
  }

  /** FreeRADIUS + PostgreSQL integration health from billing API */
  async getBillingRadiusStatus(token) {
    const response = await fetch(API_ENDPOINTS.BILLING_RADIUS_STATUS, {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }
    return data;
  }
}

export default new RadiusService();
