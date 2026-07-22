import React, { useCallback, useEffect, useState } from 'react';
import { Server, Wifi, WifiOff, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { getReport } from '../../services/reportsService';
import { useChartTheme, tooltipStyle } from '../../lib/chartTheme';
import ReportLayout, { KpiCard, ChartCard, downloadCsv } from './reportShared';

export default function ReportsDevicesPage() {
  const [data, setData] = useState({ kpis: {}, by_status: [], devices: [] });
  const [loading, setLoading] = useState(true);
  const t = useChartTheme();
  const tip = tooltipStyle(t);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReport('devices');
      if (res.success) setData(res.data?.data || {});
      else toast.error(res.error || 'Failed to load device report');
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const { kpis = {}, by_status: byStatus = [], devices = [] } = data;

  return (
    <ReportLayout icon={Server} title="Device Report" subtitle="Fleet status and resource summary." tone="blue"
      onRefresh={load} loading={loading} onExport={() => downloadCsv('devices.csv', devices)}>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard icon={Server} label="Total" value={loading ? '—' : (kpis.total ?? 0)} tone="blue" />
        <KpiCard icon={Wifi} label="Online" value={loading ? '—' : (kpis.online ?? 0)} tone="emerald" />
        <KpiCard icon={WifiOff} label="Offline" value={loading ? '—' : (kpis.offline ?? 0)} tone="rose" />
        <KpiCard icon={Cpu} label="Avg CPU" value={loading ? '—' : (kpis.avg_cpu != null ? `${kpis.avg_cpu}%` : '—')} tone="violet" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Devices by status">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byStatus} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="status" tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: t.grid }} />
              <YAxis allowDecimals={false} tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip {...tip} formatter={(v) => [v, 'Devices']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
                {byStatus.map((_, i) => <Cell key={i} fill={t.palette[i % t.palette.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Devices">
          <div className="max-h-[260px] overflow-y-auto">
            {devices.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">No devices.</p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {devices.map((d) => (
                    <tr key={d.id}>
                      <td className="py-2 pr-2"><p className="font-medium text-slate-800 dark:text-slate-200">{d.name}</p><p className="font-mono text-xs text-slate-400">{d.ip}</p></td>
                      <td className="py-2 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${d.status === 'online' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{d.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </ChartCard>
      </div>
    </ReportLayout>
  );
}
