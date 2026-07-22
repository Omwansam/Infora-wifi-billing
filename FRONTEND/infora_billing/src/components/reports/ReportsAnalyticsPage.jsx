import React, { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Users, DollarSign, Gauge, Database, Server } from 'lucide-react';
import toast from 'react-hot-toast';
import { getReport } from '../../services/reportsService';
import { formatCurrency } from '../../lib/utils';
import ReportLayout, { KpiCard, useDateRange } from './reportShared';

export default function ReportsAnalyticsPage() {
  const range = useDateRange();
  const [kpis, setKpis] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReport('analytics', { from: range.from, to: range.to });
      if (res.success) setKpis(res.data?.data?.kpis || {});
      else toast.error(res.error || 'Failed to load analytics');
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  return (
    <ReportLayout icon={TrendingUp} title="Performance Analytics" subtitle="Key business and network metrics at a glance." tone="amber"
      range={range} onRefresh={load} loading={loading}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard icon={Users} label="Active subscribers" value={loading ? '—' : (kpis.active_subscribers ?? 0)} tone="blue" />
        <KpiCard icon={DollarSign} label="MRR" value={loading ? '—' : formatCurrency(kpis.mrr || 0)} sub="Monthly recurring revenue" tone="emerald" />
        <KpiCard icon={Gauge} label="ARPU" value={loading ? '—' : formatCurrency(kpis.arpu || 0)} sub="Avg revenue per user" tone="violet" />
        <KpiCard icon={Database} label="Data (range)" value={loading ? '—' : `${kpis.total_gb ?? 0} GB`} tone="amber" />
        <KpiCard icon={Server} label="Devices online" value={loading ? '—' : (kpis.devices_online ?? 0)} tone="slate" />
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">Metrics computed live from customers, billing, and RADIUS accounting for the selected range.</p>
    </ReportLayout>
  );
}
