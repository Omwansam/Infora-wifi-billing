import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

export const logService = {
  async getLogs(params = {}) {
    const qs = new URLSearchParams();
    if (params.level && params.level !== 'all') qs.append('level', params.level);
    if (params.type && params.type !== 'all') qs.append('type', params.type);
    if (params.search) qs.append('search', params.search);
    if (params.page) qs.append('page', params.page);
    if (params.per_page) qs.append('per_page', params.per_page);
    const url = qs.toString() ? `${API_ENDPOINTS.SETTINGS_LOGS}?${qs}` : API_ENDPOINTS.SETTINGS_LOGS;
    return authenticatedApiCall(url, getAccessToken());
  },
};
