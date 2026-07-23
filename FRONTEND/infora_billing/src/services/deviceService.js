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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

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

  /** Download MikroTik .rsc script with RADIUS settings for this device */
  async downloadRadiusScript(token, deviceId, deviceName = 'router') {
    const response = await fetch(API_ENDPOINTS.deviceRadiusScript(deviceId), {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `infora-radius-${deviceName.replace(/\s+/g, '-')}.rsc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { ok: true };
  }

  async downloadManagementTunnelScript(token, deviceId, deviceName = 'router') {
    const response = await fetch(API_ENDPOINTS.deviceManagementTunnelScript(deviceId), {
      method: 'GET',
      headers: getAuthHeaders(token),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Download failed (${response.status})`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `infora-mgmt-tunnel-${deviceName.replace(/\s+/g, '-')}.rsc`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return { ok: true };
  }

  async getDeploymentHealth() {
    const response = await fetch(API_ENDPOINTS.HEALTH_DEPLOYMENT);
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, ...data };
  }

  /** Generate or rotate the one-line self-provisioning token for a device */
  async generateProvisionToken(token, deviceId, expiresInHours = null) {
    const body = expiresInHours ? { expires_in_hours: expiresInHours } : {};
    const response = await fetch(API_ENDPOINTS.deviceProvisionToken(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || `Failed (${response.status})`);
    }
    return data;
  }

  /** Revoke a device's self-provisioning token */
  async revokeProvisionToken(token, deviceId) {
    const response = await fetch(API_ENDPOINTS.deviceProvisionToken(deviceId), {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || `Failed (${response.status})`);
    }
    return data;
  }

  /** Poll whether the router pulled its script and is reachable (wizard Step 2) */
  async getProvisionStatus(token, deviceId) {
    const response = await fetch(API_ENDPOINTS.deviceProvisionStatus(deviceId), {
      method: 'GET',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Failed (${response.status})`);
    }
    return data;
  }

  /** Full interface discovery: {interfaces, device, counts, monitored} (wizard Ports step) */
  async getInterfaces(token, deviceId) {
    const response = await fetch(API_ENDPOINTS.deviceInterfaces(deviceId), {
      method: 'GET',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Failed (${response.status})`);
    }
    return {
      interfaces: data.interfaces || [],
      device: data.device || null,
      counts: data.counts || null,
      monitored: data.monitored || [],
    };
  }

  /** Run the on-router configuration self-check ("Re-run self-check") */
  async runSelfCheck(token, deviceId) {
    const response = await fetch(API_ENDPOINTS.deviceSelfCheck(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Self-check failed (${response.status})`);
    }
    return data;
  }

  /** Persist which ports the operator chose to monitor */
  async saveMonitoredInterfaces(token, deviceId, interfaceNames) {
    const response = await fetch(API_ENDPOINTS.deviceMonitorInterfaces(deviceId), {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ interfaces: interfaceNames }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Failed (${response.status})`);
    }
    return data;
  }

  /** Interface byte counters — poll twice and derive per-port rates */
  async getInterfaceTraffic(token, deviceId) {
    const response = await fetch(API_ENDPOINTS.deviceInterfaceTraffic(deviceId), {
      method: 'GET',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Failed (${response.status})`);
    }
    return data;
  }

  /** Enable/disable a router port (uplink is refused server-side) */
  async toggleInterface(token, deviceId, interfaceName, disabled) {
    const response = await fetch(API_ENDPOINTS.deviceToggleInterface(deviceId, interfaceName), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ disabled }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Failed (${response.status})`);
    }
    return data.interface;
  }

  /** Check whether a newer RouterOS version is available (persists versions) */
  async checkFirmware(token, deviceId) {
    const response = await fetch(API_ENDPOINTS.deviceFirmwareCheck(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data;
  }

  /** Trigger a full RouterOS upgrade (install + reboot) */
  async upgradeFirmware(token, deviceId) {
    const response = await fetch(API_ENDPOINTS.deviceFirmwareUpgrade(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 502) throw new Error(data.error || `Failed (${response.status})`);
    return data;
  }

  /** Put a device into / out of maintenance mode */
  async setMaintenance(token, deviceId, maintenance) {
    const response = await fetch(API_ENDPOINTS.deviceMaintenance(deviceId), {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ maintenance }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data;
  }

  /** List stored config backups for a device */
  async listBackups(token, deviceId) {
    const response = await fetch(API_ENDPOINTS.deviceBackups(deviceId), {
      method: 'GET',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data.backups || [];
  }

  /** Create a new config backup (exports + stores on server) */
  async createBackup(token, deviceId) {
    const response = await fetch(API_ENDPOINTS.deviceBackupCreate(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data;
  }

  /** Download a stored backup file (triggers a browser download) */
  async downloadBackup(token, backupId, filename = 'backup.rsc') {
    const response = await fetch(API_ENDPOINTS.deviceBackupDownload(backupId), {
      method: 'GET',
      headers: getAuthHeaders(token),
    });
    if (!response.ok) throw new Error(`Download failed (${response.status})`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  }

  /** Delete a stored backup */
  async deleteBackup(token, backupId) {
    const response = await fetch(API_ENDPOINTS.deviceBackupDelete(backupId), {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data;
  }

  /** Push service config (PPPoE/Hotspot/bridge/subnet) to the router (wizard Step 3) */
  async configureServices(token, deviceId, opts) {
    const response = await fetch(API_ENDPOINTS.deviceConfigureServices(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(opts),
    });
    const data = await response.json().catch(() => ({}));
    // 502 still returns a log we want to show; only throw on hard failures
    if (!response.ok && response.status !== 502) {
      throw new Error(data.error || `Failed (${response.status})`);
    }
    return data;
  }

  /** Generate the dual-WAN .rsc for a (possibly unsaved) wan_config. */
  async loadBalancingScript(token, deviceId, wanConfig) {
    const response = await fetch(API_ENDPOINTS.deviceLoadBalancingScript(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(wanConfig),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data; // { script, remove_script, mode }
  }

  /** Download a .rsc string as a file client-side (used for dual-WAN scripts). */
  downloadRsc(text, filename) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  /** Persist wan_config; push over the tunnel when apply=true. */
  async configureLoadBalancing(token, deviceId, wanConfig, apply = false) {
    const response = await fetch(API_ENDPOINTS.deviceConfigureLoadBalancing(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ wan_config: wanConfig, apply }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 502) {
      throw new Error(data.error || `Failed (${response.status})`);
    }
    return data;
  }

  /** Push the remove-by-comment teardown and mark the device single-WAN. */
  async disableLoadBalancing(token, deviceId, apply = true) {
    const response = await fetch(API_ENDPOINTS.deviceDisableLoadBalancing(deviceId), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ apply }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 502) {
      throw new Error(data.error || `Failed (${response.status})`);
    }
    return data;
  }
}

export default new DeviceService();
