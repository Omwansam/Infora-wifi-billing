import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class VPNService {
  constructor() {
    this.baseURL = API_ENDPOINTS.VPN_CONFIGS;
  }

  // VPN Configurations
  async getVPNConfigs(token) {
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
      console.error('Error fetching VPN configs:', error);
      throw error;
    }
  }

  async getVPNConfig(token, configId) {
    try {
      const response = await fetch(`${this.baseURL}/${configId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching VPN config:', error);
      throw error;
    }
  }

  async createVPNConfig(token, configData) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(configData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating VPN config:', error);
      throw error;
    }
  }

  async updateVPNConfig(token, configId, configData) {
    try {
      const response = await fetch(`${this.baseURL}/${configId}`, {
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
      console.error('Error updating VPN config:', error);
      throw error;
    }
  }

  async deleteVPNConfig(token, configId) {
    try {
      const response = await fetch(`${this.baseURL}/${configId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting VPN config:', error);
      throw error;
    }
  }

  // VPN Clients
  async getVPNClients(token, configId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.VPN_CLIENTS}/${configId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching VPN clients:', error);
      throw error;
    }
  }

  async createVPNClient(token, configId, clientData) {
    try {
      const response = await fetch(`${API_ENDPOINTS.VPN_CLIENTS}/${configId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(clientData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating VPN client:', error);
      throw error;
    }
  }

  async deleteVPNClient(token, configId, clientId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.VPN_CLIENTS}/${configId}/${clientId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting VPN client:', error);
      throw error;
    }
  }

  // VPN Status
  async getVPNStatus(token, configId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.VPN_STATUS}/${configId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching VPN status:', error);
      throw error;
    }
  }

  // VPN Generate Configuration
  async generateVPNConfig(token, configId, clientData) {
    try {
      const response = await fetch(`${API_ENDPOINTS.VPN_GENERATE}/${configId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(clientData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error generating VPN config:', error);
      throw error;
    }
  }

  // VPN Server Operations
  async startVPNServer(token, configId) {
    try {
      const response = await fetch(`${this.baseURL}/${configId}/start`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error starting VPN server:', error);
      throw error;
    }
  }

  async stopVPNServer(token, configId) {
    try {
      const response = await fetch(`${this.baseURL}/${configId}/stop`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error stopping VPN server:', error);
      throw error;
    }
  }

  async restartVPNServer(token, configId) {
    try {
      const response = await fetch(`${this.baseURL}/${configId}/restart`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error restarting VPN server:', error);
      throw error;
    }
  }

  // VPN Statistics
  async getVPNStats(token, configId) {
    try {
      const response = await fetch(`${this.baseURL}/${configId}/stats`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching VPN stats:', error);
      throw error;
    }
  }

  // VPN Logs
  async getVPNLogs(token, configId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams 
        ? `${this.baseURL}/${configId}/logs?${queryParams}` 
        : `${this.baseURL}/${configId}/logs`;
      
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
      console.error('Error fetching VPN logs:', error);
      throw error;
    }
  }

  // VPN Backup and Restore
  async backupVPNConfig(token, configId) {
    try {
      const response = await fetch(`${this.baseURL}/${configId}/backup`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error backing up VPN config:', error);
      throw error;
    }
  }

  async restoreVPNConfig(token, configId, backupData) {
    try {
      const response = await fetch(`${this.baseURL}/${configId}/restore`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(backupData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error restoring VPN config:', error);
      throw error;
    }
  }
}

export default new VPNService();
