import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserCheck, UserX, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { getReport } from '../../services/reportsService';
import { useChartTheme, tooltipStyle } from '../../lib/chartTheme';
import ReportLayout, { KpiCard, ChartCard, useDateRange, downloadCsv } from './reportShared';

export default function ReportsClientsPage() {
  const range = useDateRange();
  const [data, setData] = useState({ kpis: {}, by_type: [], growth: [] });
  const [loading, setLoading] = useState(true);
  const t = useChartTheme();
  const tip = tooltipStyle(t);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReport('clients', { from: range.from, to: range.to });
      if (res.success) setData(res.data?.data || {});
      else toast.error(res.error || 'Failed to load client report');
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const { kpis = {}, by_type: byType = [], growth = [] } = data;

  return (
    <ReportLayout icon={Users} title="Client Report" subtitle="Subscriber base, mix, and growth." tone="violet"
      range={range} onRefresh={load} loading={loading} onExport={() => downloadCsv('client-growth.csv', growth)}>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard icon={Users} label="Total" value={loading ? '—' : (kpis.total ?? 0)} tone="blue" />
        <KpiCard icon={UserCheck} label="Active" value={loading ? '—' : (kpis.active ?? 0)} tone="emerald" />
        <KpiCard icon={UserX} label="Suspended" value={loading ? '—' : (kpis.suspended ?? 0)} tone="rose" />
        <KpiCard icon={Clock} label="Pending" value={loading ? '—' : (kpis.pending ?? 0)} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="New clients by month">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={growth} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: t.grid }} />
              <YAxis allowDecimals={false} tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip {...tip} formatter={(v) => [v, 'New clients']} />
              <Line type="monotone" dataKey="new_clients" stroke={t.primary} strokeWidth={2} dot={{ r: 3, fill: t.primary }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Clients by connection type">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byType} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="type" tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: t.grid }} />
              <YAxis allowDecimals={false} tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip {...tip} formatter={(v) => [v, 'Clients']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {byType.map((_, i) => <Cell key={i} fill={t.palette[i % t.palette.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </ReportLayout>
  );
}
