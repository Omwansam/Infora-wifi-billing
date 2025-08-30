import { apiCall, authenticatedApiCall } from '../utils/api';
import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

export const mikrotikService = {
  // Get all Mikrotik devices
  getDevices: async (params = {}) => {
    try {
      const token = localStorage.getItem('token');
      const queryString = new URLSearchParams(params).toString();
      const url = `${API_ENDPOINTS.DEVICES}${queryString ? `?${queryString}` : ''}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching devices:', error);
      throw error;
    }
  },

  // Get a single device by ID
  getDevice: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device:', error);
      throw error;
    }
  },

  // Create a new Mikrotik device
  createDevice: async (deviceData) => {
    try {
      const token = localStorage.getItem('token');
      const url = API_ENDPOINTS.DEVICES;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'POST',
        body: JSON.stringify(deviceData)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error creating device:', error);
      throw error;
    }
  },

  // Update an existing device
  updateDevice: async (deviceId, deviceData) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'PUT',
        body: JSON.stringify(deviceData)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error updating device:', error);
      throw error;
    }
  },

  // Delete a device
  deleteDevice: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'DELETE'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error deleting device:', error);
      throw error;
    }
  },

  // Test connection to a Mikrotik device
  testConnection: async (connectionData) => {
    try {
      const url = `${API_ENDPOINTS.DEVICES}/test-connection`;
      
      const response = await apiCall(url, {
        method: 'POST',
        body: JSON.stringify(connectionData)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error testing connection:', error);
      throw error;
    }
  },

  // Get device statistics
  getDeviceStats: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/stats`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device stats:', error);
      throw error;
    }
  },

  // Get device clients
  getDeviceClients: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/clients`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device clients:', error);
      throw error;
    }
  },

  // Sync device with billing system
  syncDevice: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/sync`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'POST'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error syncing device:', error);
      throw error;
    }
  },

  // Get device configuration
  getDeviceConfig: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/config`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device config:', error);
      throw error;
    }
  },

  // Backup device configuration
  backupDevice: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/backup`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'POST'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error backing up device:', error);
      throw error;
    }
  },

  // Restore device configuration
  restoreDevice: async (deviceId, backupData) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/restore`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'POST',
        body: JSON.stringify(backupData)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error restoring device:', error);
      throw error;
    }
  },

  // Get device logs
  getDeviceLogs: async (deviceId, params = {}) => {
    try {
      const token = localStorage.getItem('token');
      const queryString = new URLSearchParams(params).toString();
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/logs${queryString ? `?${queryString}` : ''}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device logs:', error);
      throw error;
    }
  },

  // Get device alerts
  getDeviceAlerts: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/alerts`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device alerts:', error);
      throw error;
    }
  },

  // Configure billing integration for a device
  configureBillingIntegration: async (deviceId, billingConfig) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/billing-config`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'POST',
        body: JSON.stringify(billingConfig)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error configuring billing integration:', error);
      throw error;
    }
  },

  // Get billing integration status
  getBillingIntegrationStatus: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/billing-status`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching billing integration status:', error);
      throw error;
    }
  },

  // Get device performance metrics
  getDeviceMetrics: async (deviceId, timeRange = '24h') => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/metrics?timeRange=${timeRange}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device metrics:', error);
      throw error;
    }
  },

  // Get device bandwidth usage
  getDeviceBandwidth: async (deviceId, timeRange = '24h') => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/bandwidth?timeRange=${timeRange}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device bandwidth:', error);
      throw error;
    }
  },

  // Get device uptime history
  getDeviceUptime: async (deviceId, timeRange = '7d') => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/uptime?timeRange=${timeRange}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device uptime:', error);
      throw error;
    }
  },

  // Get device temperature and hardware info
  getDeviceHardware: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/hardware`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device hardware info:', error);
      throw error;
    }
  },

  // Execute command on device
  executeCommand: async (deviceId, command) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/execute`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'POST',
        body: JSON.stringify({ command })
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error executing command:', error);
      throw error;
    }
  },

  // Get device interfaces
  getDeviceInterfaces: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/interfaces`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device interfaces:', error);
      throw error;
    }
  },

  // Get device routes
  getDeviceRoutes: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/routes`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device routes:', error);
      throw error;
    }
  },

  // Get device firewall rules
  getDeviceFirewall: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/firewall`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device firewall:', error);
      throw error;
    }
  },

  // Get device DHCP leases
  getDeviceDhcpLeases: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/dhcp-leases`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device DHCP leases:', error);
      throw error;
    }
  },

  // Get device DNS settings
  getDeviceDns: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/dns`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device DNS settings:', error);
      throw error;
    }
  },

  // Get device wireless settings
  getDeviceWireless: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/wireless`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device wireless settings:', error);
      throw error;
    }
  },

  // Get device VPN settings
  getDeviceVpn: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/vpn`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device VPN settings:', error);
      throw error;
    }
  },

  // Get device QoS settings
  getDeviceQos: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/qos`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device QoS settings:', error);
      throw error;
    }
  },

  // Get device NAT settings
  getDeviceNat: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/nat`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device NAT settings:', error);
      throw error;
    }
  },

  // Get device bridge settings
  getDeviceBridges: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/bridges`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device bridge settings:', error);
      throw error;
    }
  },

  // Get device VLAN settings
  getDeviceVlans: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/vlans`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device VLAN settings:', error);
      throw error;
    }
  },

  // Get device PPPoE settings
  getDevicePppoe: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/pppoe`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device PPPoE settings:', error);
      throw error;
    }
  },

  // Get device hotspot settings
  getDeviceHotspot: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/hotspot`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device hotspot settings:', error);
      throw error;
    }
  },

  // Get device user manager settings
  getDeviceUserManager: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/user-manager`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device user manager settings:', error);
      throw error;
    }
  },

  // Get device RADIUS settings
  getDeviceRadius: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/radius`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device RADIUS settings:', error);
      throw error;
    }
  },

  // Get device LDAP settings
  getDeviceLdap: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/ldap`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device LDAP settings:', error);
      throw error;
    }
  },

  // Get device SNMP settings
  getDeviceSnmp: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/snmp`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device SNMP settings:', error);
      throw error;
    }
  },

  // Get device NTP settings
  getDeviceNtp: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/ntp`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device NTP settings:', error);
      throw error;
    }
  },

  // Get device system resources
  getDeviceResources: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/resources`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device resources:', error);
      throw error;
    }
  },

  // Get device system health
  getDeviceHealth: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/health`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device health:', error);
      throw error;
    }
  },

  // Get device system information
  getDeviceSystemInfo: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/system-info`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device system info:', error);
      throw error;
    }
  },

  // Get device license information
  getDeviceLicense: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/license`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device license:', error);
      throw error;
    }
  },

  // Get device firmware information
  getDeviceFirmware: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/firmware`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device firmware:', error);
      throw error;
    }
  },

  // Update device firmware
  updateDeviceFirmware: async (deviceId, firmwareData) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/firmware/update`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'POST',
        body: JSON.stringify(firmwareData)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error updating device firmware:', error);
      throw error;
    }
  },

  // Get device backup history
  getDeviceBackups: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/backups`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device backups:', error);
      throw error;
    }
  },

  // Get device monitoring alerts
  getDeviceMonitoringAlerts: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/monitoring-alerts`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device monitoring alerts:', error);
      throw error;
    }
  },

  // Configure device monitoring
  configureDeviceMonitoring: async (deviceId, monitoringConfig) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/monitoring-config`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'POST',
        body: JSON.stringify(monitoringConfig)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error configuring device monitoring:', error);
      throw error;
    }
  },

  // Get device billing data
  getDeviceBillingData: async (deviceId, timeRange = '30d') => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/billing-data?timeRange=${timeRange}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device billing data:', error);
      throw error;
    }
  },

  // Get device revenue data
  getDeviceRevenue: async (deviceId, timeRange = '30d') => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/revenue?timeRange=${timeRange}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device revenue:', error);
      throw error;
    }
  },

  // Get device customer data
  getDeviceCustomers: async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/customers`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device customers:', error);
      throw error;
    }
  },

  // Get device usage statistics
  getDeviceUsageStats: async (deviceId, timeRange = '30d') => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_ENDPOINTS.DEVICES}/${deviceId}/usage-stats?timeRange=${timeRange}`;
      
      const response = await authenticatedApiCall(url, token, {
        method: 'GET'
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching device usage stats:', error);
      throw error;
    }
  }
};

export default mikrotikService;
