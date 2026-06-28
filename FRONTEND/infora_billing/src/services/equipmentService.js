import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class EquipmentService {
  async list(token, params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== '' && v !== 'all')
    ).toString();
    const url = query ? `${API_ENDPOINTS.EQUIPMENT}?${query}` : API_ENDPOINTS.EQUIPMENT;
    const response = await fetch(url, { method: 'GET', headers: getAuthHeaders(token) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data.equipment || [];
  }

  async stats(token) {
    const response = await fetch(API_ENDPOINTS.EQUIPMENT_STATS, { method: 'GET', headers: getAuthHeaders(token) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data;
  }

  async create(token, payload) {
    const response = await fetch(API_ENDPOINTS.EQUIPMENT, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data.equipment || data;
  }

  async update(token, id, payload) {
    const response = await fetch(API_ENDPOINTS.equipmentItem(id), {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data.equipment || data;
  }

  async remove(token, id) {
    const response = await fetch(API_ENDPOINTS.equipmentItem(id), {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Failed (${response.status})`);
    return data;
  }
}

export default new EquipmentService();
