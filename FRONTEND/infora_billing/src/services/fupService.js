import { API_ENDPOINTS } from '../config/api';
import { getAccessToken } from '../utils/authToken';
import { authenticatedApiCall } from '../utils/api';

const EMPTY_SUMMARY = {
  total_monitored: 0,
  approaching: 0,
  exceeded: 0,
  throttled: 0,
  online: 0,
  fup_enabled_plans: 0,
};

/** Normalize API payload for the FUP monitor UI. */
export function normalizeFupMonitor(raw) {
  if (!raw || typeof raw !== 'object') {
    return { accounts: [], summary: EMPTY_SUMMARY, generated_at: null };
  }

  const payload = raw.data ?? raw;
  return {
    accounts: payload.accounts || [],
    summary: { ...EMPTY_SUMMARY, ...(payload.summary || {}) },
    generated_at: raw.generated_at || payload.generated_at || null,
  };
}

export async function getFupMonitor({ connectionType = 'all', status = 'all', search } = {}) {
  const params = new URLSearchParams();
  if (connectionType && connectionType !== 'all') {
    params.set('connection_type', connectionType);
  }
  if (status && status !== 'all') {
    params.set('status', status);
  }
  if (search) {
    params.set('search', search);
  }

  const endpoint = params.toString()
    ? `${API_ENDPOINTS.FUP_MONITOR}?${params}`
    : API_ENDPOINTS.FUP_MONITOR;

  const result = await authenticatedApiCall(endpoint, getAccessToken(), { method: 'GET' });
  if (!result.success) {
    throw new Error(result.error || 'Failed to load FUP monitor');
  }

  return normalizeFupMonitor(result.data);
}
