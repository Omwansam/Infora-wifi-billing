import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class DeviceService {
  constructor() {
    this.baseURL = API_ENDPOINTS.DEVICES;
  }

  async getDevices(token, params = {}) {
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
      console.error('Error fetching devices:', error);
      throw error;
    }
  }

  async getDevice(token, deviceId) {
    try {
      const response = await fetch(`${this.baseURL}/${deviceId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching device:', error);
      throw error;
    }
  }

  async createDevice(token, deviceData) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(deviceData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating device:', error);
      throw error;
    }
  }

  async updateDevice(token, deviceId, deviceData) {
    try {
      const response = await fetch(`${this.baseURL}/${deviceId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(deviceData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating device:', error);
      throw error;
    }
  }

  async deleteDevice(token, deviceId) {
    try {
      const response = await fetch(`${this.baseURL}/${deviceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting device:', error);
      throw error;
    }
  }

  async getDeviceStats(token) {
    try {
      const response = await fetch(API_ENDPOINTS.DEVICE_STATS, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching device stats:', error);
      throw error;
    }
  }

  async connectDevice(token, deviceId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEVICE_CONNECT}/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error connecting to device:', error);
      throw error;
    }
  }

  async disconnectDevice(token, deviceId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEVICE_DISCONNECT}/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error disconnecting from device:', error);
      throw error;
    }
  }

  async syncDevice(token, deviceId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEVICE_SYNC}/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error syncing device:', error);
      throw error;
    }
  }

  async backupDevice(token, deviceId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEVICE_BACKUP}/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error backing up device:', error);
      throw error;
    }
  }

  async rebootDevice(token, deviceId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEVICE_REBOOT}/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error rebooting device:', error);
      throw error;
    }
  }

  async updateDeviceFirmware(token, deviceId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.DEVICE_UPDATE}/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating device firmware:', error);
      throw error;
    }
  }
}

export default new DeviceService();
