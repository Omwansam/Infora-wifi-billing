import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class LDAPService {
  constructor() {
    this.baseURL = API_ENDPOINTS.LDAP_SERVERS;
  }

  // LDAP Servers
  async getLDAPServers(token) {
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
      console.error('Error fetching LDAP servers:', error);
      throw error;
    }
  }

  async getLDAPServer(token, serverId) {
    try {
      const response = await fetch(`${this.baseURL}/${serverId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching LDAP server:', error);
      throw error;
    }
  }

  async createLDAPServer(token, serverData) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating LDAP server:', error);
      throw error;
    }
  }

  async updateLDAPServer(token, serverId, serverData) {
    try {
      const response = await fetch(`${this.baseURL}/${serverId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(serverData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating LDAP server:', error);
      throw error;
    }
  }

  async deleteLDAPServer(token, serverId) {
    try {
      const response = await fetch(`${this.baseURL}/${serverId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting LDAP server:', error);
      throw error;
    }
  }

  // LDAP Test Connection
  async testLDAPConnection(token, serverId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.LDAP_TEST}/${serverId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error testing LDAP connection:', error);
      throw error;
    }
  }

  // LDAP Sync
  async syncLDAPUsers(token, serverId, syncData = {}) {
    try {
      const response = await fetch(`${API_ENDPOINTS.LDAP_SYNC}/${serverId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(syncData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error syncing LDAP users:', error);
      throw error;
    }
  }

  // LDAP Search
  async searchLDAPUsers(token, serverId, searchParams = {}) {
    try {
      const queryParams = new URLSearchParams(searchParams).toString();
      const url = queryParams 
        ? `${this.baseURL}/${serverId}/search?${queryParams}` 
        : `${this.baseURL}/${serverId}/search`;
      
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
      console.error('Error searching LDAP users:', error);
      throw error;
    }
  }

  // LDAP Groups
  async getLDAPGroups(token, serverId) {
    try {
      const response = await fetch(`${this.baseURL}/${serverId}/groups`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching LDAP groups:', error);
      throw error;
    }
  }

  // LDAP Configuration
  async getLDAPConfiguration(token, serverId) {
    try {
      const response = await fetch(`${this.baseURL}/${serverId}/config`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching LDAP configuration:', error);
      throw error;
    }
  }

  async updateLDAPConfiguration(token, serverId, configData) {
    try {
      const response = await fetch(`${this.baseURL}/${serverId}/config`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(configData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating LDAP configuration:', error);
      throw error;
    }
  }
}

export default new LDAPService();
