import { DASHBOARD } from '@/data/mock';
import type { DashboardData } from '@/data/types';
import { ENDPOINTS, IS_LIVE } from './config';
import { http } from './http';

/** Raw dashboard payload (subset) — see backend routes/dashboard.py. */
interface DashboardDTO {
  summary?: Record<string, number>;
  revenue_periods?: Record<string, number>;
  revenue_by_type?: { pppoe?: number; hotspot?: number };
  revenue_data?: { label?: string; month?: string; revenue?: number; amount?: number }[];
  top_data_users?: {
    username?: string;
    customer_name?: string;
    plan_name?: string;
    total_bytes?: number;
  }[];
  session_counts?: { all?: number };
  active_sessions?: number;
  alerts?: { id?: number; type?: string; title?: string; message?: string; created_at?: string }[];
  finance?: {
    total_revenue?: number;
    total_expenses?: number;
    net_profit?: number;
    monthly_recurring_revenue?: number;
    arpu?: number;
  };
}

function mapDashboard(raw: DashboardDTO): DashboardData {
  const s = raw.summary ?? {};
  const rp = raw.revenue_periods ?? {};
  const onlineNow = raw.session_counts?.all ?? raw.active_sessions ?? 0;
  const totalRevenue = s.total_revenue ?? 0;

  return {
    summary: {
      totalCustomers: s.total_customers ?? 0,
      activeCustomers: s.active_customers ?? 0,
      pppoeCustomers: s.pppoe_customers ?? 0,
      hotspotCustomers: s.hotspot_customers ?? 0,
      totalRevenue,
      monthlyPayments: s.monthly_payments ?? 0,
      todayPayments: s.today_payments ?? rp.today ?? 0,
      openTickets: s.open_tickets ?? 0,
      onlineDevices: s.online_devices ?? 0,
      totalDevices: s.total_devices ?? 0,
      onlineNow,
    },
    revenuePeriods: {
      today: rp.today ?? 0,
      thisWeek: rp.this_week ?? 0,
      thisMonth: rp.this_month ?? s.monthly_payments ?? 0,
      lastMonth: rp.last_month ?? 0,
    },
    revenueByType: {
      pppoe: raw.revenue_by_type?.pppoe ?? 0,
      hotspot: raw.revenue_by_type?.hotspot ?? 0,
    },
    revenueTrend: (raw.revenue_data ?? []).slice(-7).map((d) => ({
      label: d.label ?? d.month ?? '',
      value: d.revenue ?? d.amount ?? 0,
    })),
    finance: {
      totalRevenue: raw.finance?.total_revenue ?? totalRevenue,
      totalExpenses: raw.finance?.total_expenses ?? 0,
      netProfit: raw.finance?.net_profit ?? totalRevenue,
      mrr: raw.finance?.monthly_recurring_revenue ?? 0,
      arpu: raw.finance?.arpu ?? 0,
    },
    topDataUsers: (raw.top_data_users ?? []).slice(0, 6).map((u) => ({
      username: u.username ?? '',
      customerName: u.customer_name ?? '',
      planName: u.plan_name ?? '',
      totalBytes: u.total_bytes ?? 0,
    })),
    alerts: (raw.alerts ?? []).map((a, i) => ({
      id: a.id ?? i + 1,
      type: a.type === 'warning' ? 'warning' : 'info',
      title: a.title ?? '',
      message: a.message ?? '',
      at: a.created_at ?? new Date().toISOString(),
    })),
  };
}

export async function getDashboard(routerId?: string): Promise<DashboardData> {
  if (!IS_LIVE) return DASHBOARD;
  const raw = await http.get<DashboardDTO>(ENDPOINTS.dashboardStats, {
    router_id: routerId && routerId !== 'all' ? routerId : undefined,
  });
  return mapDashboard(raw);
}
