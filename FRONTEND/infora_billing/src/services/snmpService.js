import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class SNMPService {
  constructor() {
    this.baseURL = API_ENDPOINTS.SNMP_DEVICES;
  }

  // SNMP Devices
  async getSNMPDevices(token) {
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
      console.error('Error fetching SNMP devices:', error);
      throw error;
    }
  }

  async getSNMPDevice(token, deviceId) {
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
      console.error('Error fetching SNMP device:', error);
      throw error;
    }
  }

  async createSNMPDevice(token, deviceData) {
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
      console.error('Error creating SNMP device:', error);
      throw error;
    }
  }

  async updateSNMPDevice(token, deviceId, deviceData) {
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
      console.error('Error updating SNMP device:', error);
      throw error;
    }
  }

  async deleteSNMPDevice(token, deviceId) {
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
      console.error('Error deleting SNMP device:', error);
      throw error;
    }
  }

  // SNMP Walk
  async snmpWalk(token, deviceId, oid) {
    try {
      const response = await fetch(`${API_ENDPOINTS.SNMP_WALK}/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ oid }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing SNMP walk:', error);
      throw error;
    }
  }

  // SNMP Get
  async snmpGet(token, deviceId, oid) {
    try {
      const response = await fetch(`${API_ENDPOINTS.SNMP_GET}/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ oid }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing SNMP get:', error);
      throw error;
    }
  }

  // SNMP Set
  async snmpSet(token, deviceId, oid, value, type = 'STRING') {
    try {
      const response = await fetch(`${API_ENDPOINTS.SNMP_SET}/${deviceId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ oid, value, type }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing SNMP set:', error);
      throw error;
    }
  }

  // SNMP Traps
  async getSNMPTraps(token, deviceId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams 
        ? `${API_ENDPOINTS.SNMP_TRAPS}/${deviceId}?${queryParams}` 
        : `${API_ENDPOINTS.SNMP_TRAPS}/${deviceId}`;
      
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
      console.error('Error fetching SNMP traps:', error);
      throw error;
    }
  }

  // SNMP Device Status
  async getSNMPDeviceStatus(token, deviceId) {
    try {
      const response = await fetch(`${this.baseURL}/${deviceId}/status`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching SNMP device status:', error);
      throw error;
    }
  }

  // SNMP Device Statistics
  async getSNMPDeviceStats(token, deviceId) {
    try {
      const response = await fetch(`${this.baseURL}/${deviceId}/stats`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching SNMP device stats:', error);
      throw error;
    }
  }

  // SNMP Test Connection
  async testSNMPConnection(token, deviceId) {
    try {
      const response = await fetch(`${this.baseURL}/${deviceId}/test`, {
        method: 'POST',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error testing SNMP connection:', error);
      throw error;
    }
  }

  // SNMP Bulk Operations
  async snmpBulkWalk(token, deviceId, oid, maxRepetitions = 10) {
    try {
      const response = await fetch(`${this.baseURL}/${deviceId}/bulk-walk`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ oid, max_repetitions: maxRepetitions }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error performing SNMP bulk walk:', error);
      throw error;
    }
  }
}

export default new SNMPService();
