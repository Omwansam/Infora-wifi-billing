import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

/** Fetch a report by type (billing|network|devices|clients|analytics) with a date range. */
export async function getReport(type, { from, to } = {}) {
  const qs = new URLSearchParams();
  if (from) qs.append('from', from);
  if (to) qs.append('to', to);
  const base = API_ENDPOINTS.reportEndpoint(type);
  const url = qs.toString() ? `${base}?${qs}` : base;
  return authenticatedApiCall(url, getAccessToken());
}

/** Operational alerts for the Monitoring → Alerts page. */
export async function getMonitoringAlerts() {
  return authenticatedApiCall(API_ENDPOINTS.MONITORING_ALERTS, getAccessToken());
}
