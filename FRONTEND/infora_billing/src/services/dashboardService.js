import { API_ENDPOINTS } from '../config/api';
import { getAccessToken } from '../utils/authToken';
import { authenticatedApiCall } from '../utils/api';

const EMPTY_RADIUS = {
  upload_bytes: 0,
  download_bytes: 0,
  unique_users: 0,
  sessions: 0,
  live_sessions: 0,
};

const EMPTY_SUBSCRIBER = {
  total: 0,
  active: 0,
  expired: 0,
  suspended: 0,
  new_month: 0,
  live_sessions: 0,
};

/** Normalize API payload so the UI works with current and legacy dashboard responses. */
export function normalizeDashboardStats(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const summary = raw.summary || {};
  const revenuePeriods = raw.revenue_periods || {
    today: summary.today_payments ?? raw.today_payments ?? 0,
    yesterday: 0,
    this_week: 0,
    this_month: summary.monthly_payments ?? raw.monthly_payments ?? 0,
    last_month: 0,
    this_year: summary.total_revenue ?? raw.total_revenue ?? 0,
  };

  const radiusPeriods = raw.radius_periods || {
    today: { ...EMPTY_RADIUS },
    week: { ...EMPTY_RADIUS },
    month: { ...EMPTY_RADIUS },
    last_month: { ...EMPTY_RADIUS },
    all: { ...EMPTY_RADIUS },
  };

  const subscribers = raw.subscribers || {
    pppoe: {
      ...EMPTY_SUBSCRIBER,
      total: summary.pppoe_customers ?? 0,
    },
    hotspot: {
      ...EMPTY_SUBSCRIBER,
      total: summary.hotspot_customers ?? 0,
    },
  };

  return {
    ...raw,
    summary,
    revenue_periods: revenuePeriods,
    revenue_by_type: raw.revenue_by_type || { pppoe: 0, hotspot: 0 },
    revenue_data: raw.revenue_data || [],
    subscribers,
    hotspot_activity: raw.hotspot_activity || {
      today: 0,
      yesterday: 0,
      this_week: 0,
      this_month: 0,
      sales_today: 0,
    },
    radius_periods: radiusPeriods,
    top_data_users: raw.top_data_users || [],
    sms_usage: raw.sms_usage || { sent: 0, failed: 0, balance: 0 },
    sms_daily: raw.sms_daily || [],
    hotspot_hourly: raw.hotspot_hourly || [],
    devices: raw.devices || [],
    routers: raw.routers || raw.devices || [],
    operations: raw.operations || {
      expenses: 0,
      payouts: summary.monthly_payments ?? raw.monthly_payments ?? 0,
      invoices_due: summary.pending_invoices ?? 0,
      invoices_due_amount: summary.pending_invoice_amount ?? 0,
      sms_sent: 0,
      sms_failed: 0,
      campaigns: 0,
      open_tickets: summary.open_tickets ?? 0,
    },
    organization: raw.organization || {
      name: 'Lumen',
      tagline: 'Internet Service Provider',
      country: 'KE',
      currency: 'KES',
      routers: summary.total_devices ?? 0,
      packages: summary.active_plans ?? raw.active_plans ?? 0,
      modules: ['PPPoE', 'Hotspot', 'WireGuard'],
    },
    active_sessions: raw.active_sessions ?? raw.session_counts?.all ?? 0,
    session_counts: raw.session_counts || {
      all: raw.active_sessions ?? 0,
      pppoe: 0,
      hotspot: 0,
    },
    top_data_users_by_period: raw.top_data_users_by_period || {},
    roadmap: raw.roadmap || [],
    alerts: raw.alerts || [],
    generated_at: raw.generated_at || new Date().toISOString(),
  };
}

export async function getDashboardStats({ routerId } = {}) {
  const params = new URLSearchParams();
  if (routerId && routerId !== 'all') {
    params.set('router_id', String(routerId));
  }
  const endpoint = params.toString()
    ? `${API_ENDPOINTS.DASHBOARD_STATS}?${params}`
    : API_ENDPOINTS.DASHBOARD_STATS;

  const result = await authenticatedApiCall(
    endpoint,
    getAccessToken(),
    { method: 'GET' }
  );

  if (!result.success) {
    throw new Error(result.error || 'Failed to load dashboard stats');
  }

  return normalizeDashboardStats(result.data);
}
