import { API_ENDPOINTS } from '../config/api';
import { getAccessToken } from '../utils/authToken';
import { authenticatedApiCall } from '../utils/api';

export async function getDashboardStats() {
  const result = await authenticatedApiCall(
    API_ENDPOINTS.DASHBOARD_STATS,
    getAccessToken(),
    { method: 'GET' }
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to load dashboard stats');
  }

  return result.data;
}
