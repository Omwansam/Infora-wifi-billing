import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

export const supportService = {
  async listRequests(params = {}) {
    const qs = new URLSearchParams();
    if (params.type && params.type !== 'all') qs.append('type', params.type);
    if (params.status && params.status !== 'all') qs.append('status', params.status);
    if (params.page) qs.append('page', params.page);
    if (params.per_page) qs.append('per_page', params.per_page);
    const url = qs.toString()
      ? `${API_ENDPOINTS.SUPPORT_REQUESTS}?${qs}`
      : API_ENDPOINTS.SUPPORT_REQUESTS;
    return authenticatedApiCall(url, getAccessToken());
  },

  async createRequest(data) {
    return authenticatedApiCall(API_ENDPOINTS.SUPPORT_REQUESTS, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateRequest(id, data) {
    return authenticatedApiCall(API_ENDPOINTS.supportRequest(id), getAccessToken(), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
