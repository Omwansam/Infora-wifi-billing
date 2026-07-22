import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

export const userService = {
  async listUsers(params = {}) {
    const qs = new URLSearchParams();
    if (params.role) qs.append('role', params.role);
    if (params.is_active !== undefined) qs.append('is_active', params.is_active);
    if (params.page) qs.append('page', params.page);
    if (params.per_page) qs.append('per_page', params.per_page);
    const url = qs.toString() ? `${API_ENDPOINTS.USERS}?${qs}` : API_ENDPOINTS.USERS;
    return authenticatedApiCall(url, getAccessToken());
  },

  async createUser(data) {
    return authenticatedApiCall(API_ENDPOINTS.USERS, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateUser(id, data) {
    return authenticatedApiCall(API_ENDPOINTS.authUser(id), getAccessToken(), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id) {
    return authenticatedApiCall(API_ENDPOINTS.authUser(id), getAccessToken(), {
      method: 'DELETE',
    });
  },
};
