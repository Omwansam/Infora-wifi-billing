import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class WireGuardService {
  async listServers(token) {
    const res = await fetch(API_ENDPOINTS.WIREGUARD_SERVERS, {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to load WireGuard servers');
    return res.json();
  }

  async createServer(token, data) {
    const res = await fetch(API_ENDPOINTS.WIREGUARD_SERVERS, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'Create server failed');
    return body;
  }

  async getServerPeers(token, serverId) {
    const res = await fetch(API_ENDPOINTS.wireguardServerPeers(serverId), {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to load peers');
    return res.json();
  }

  async provisionCustomer(token, customerId, serverId = null) {
    const res = await fetch(API_ENDPOINTS.wireguardProvisionCustomer(customerId), {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(serverId ? { server_id: serverId } : {}),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'Provision failed');
    return body;
  }

  async getCustomerPeer(token, customerId) {
    const res = await fetch(API_ENDPOINTS.wireguardCustomerPeer(customerId), {
      headers: getAuthHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to load peer');
    return res.json();
  }

  async deletePeer(token, peerId) {
    const res = await fetch(API_ENDPOINTS.wireguardPeer(peerId), {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'Delete failed');
    return body;
  }

  async syncStats(token) {
    const res = await fetch(API_ENDPOINTS.WIREGUARD_SYNC_STATS, {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
    return res.json();
  }

  async syncPeerMikrotik(token, peerId) {
    const res = await fetch(API_ENDPOINTS.wireguardPeerSyncMikrotik(peerId), {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'MikroTik sync failed');
    return body;
  }

  async syncServerMikrotik(token, serverId) {
    const res = await fetch(API_ENDPOINTS.wireguardServerSyncMikrotik(serverId), {
      method: 'POST',
      headers: getAuthHeaders(token),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'MikroTik sync failed');
    return body;
  }

  downloadConfigUrl(customerId) {
    return API_ENDPOINTS.wireguardCustomerConfig(customerId);
  }

  qrcodeUrl(customerId) {
    return API_ENDPOINTS.wireguardCustomerQrcode(customerId);
  }

  downloadServerConfigUrl(serverId) {
    return API_ENDPOINTS.wireguardServerConfig(serverId);
  }

  downloadMikrotikScriptUrl(serverId) {
    return API_ENDPOINTS.wireguardMikrotikScript(serverId);
  }
}

export default new WireGuardService();
