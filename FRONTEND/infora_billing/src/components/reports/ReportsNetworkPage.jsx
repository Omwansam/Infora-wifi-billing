import React, { useCallback, useEffect, useState } from 'react';
import { Network, Database, Radio, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { getReport } from '../../services/reportsService';
import { useChartTheme, tooltipStyle } from '../../lib/chartTheme';
import ReportLayout, { KpiCard, ChartCard, useDateRange, downloadCsv } from './reportShared';

const gb = (b) => (b / 1024 ** 3).toFixed(2);

export default function ReportsNetworkPage() {
  const range = useDateRange();
  const [data, setData] = useState({ kpis: {}, top_users: [], traffic_trend: [] });
  const [loading, setLoading] = useState(true);
  const t = useChartTheme();
  const tip = tooltipStyle(t);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReport('network', { from: range.from, to: range.to });
      if (res.success) setData(res.data?.data || {});
      else toast.error(res.error || 'Failed to load network report');
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const { kpis = {}, top_users: topUsers = [], traffic_trend: trend = [] } = data;
  const topRows = topUsers.map((u) => ({ username: u.username, gb: Number(gb(u.bytes)) }));

  return (
    <ReportLayout icon={Network} title="Network Report" subtitle="Traffic, sessions, and heaviest users." tone="cyan"
      range={range} onRefresh={load} loading={loading} onExport={() => downloadCsv('network-top-users.csv', topRows)}>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Database} label="Total data" value={loading ? '—' : `${kpis.total_gb ?? 0} GB`} tone="violet" />
        <KpiCard icon={Radio} label="Active sessions" value={loading ? '—' : (kpis.active_sessions ?? 0)} tone="emerald" />
        <KpiCard icon={Users} label="Total sessions" value={loading ? '—' : (kpis.total_sessions ?? 0)} tone="blue" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Traffic by month (GB)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: t.grid }} />
              <YAxis tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip {...tip} formatter={(v) => [`${v} GB`, 'Traffic']} />
              <Bar dataKey="gb" fill={t.primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top users by traffic (GB)">
          {topRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No usage in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topRows} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} horizontal={false} />
                <XAxis type="number" tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="username" tick={{ fill: t.axis, fontSize: 10 }} tickLine={false} axisLine={false} width={120} />
                <Tooltip {...tip} formatter={(v) => [`${v} GB`, 'Traffic']} />
                <Bar dataKey="gb" fill={t.palette[2]} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </ReportLayout>
  );
}
