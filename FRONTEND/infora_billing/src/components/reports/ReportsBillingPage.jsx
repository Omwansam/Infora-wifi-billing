import React, { useCallback, useEffect, useState } from 'react';
import { Receipt, Wallet, AlertCircle, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { getReport } from '../../services/reportsService';
import { useChartTheme, tooltipStyle } from '../../lib/chartTheme';
import { formatCurrency } from '../../lib/utils';
import ReportLayout, { KpiCard, ChartCard, useDateRange, downloadCsv } from './reportShared';

export default function ReportsBillingPage() {
  const range = useDateRange();
  const [data, setData] = useState({ kpis: {}, revenue_trend: [], by_method: [] });
  const [loading, setLoading] = useState(true);
  const t = useChartTheme();
  const tip = tooltipStyle(t);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReport('billing', { from: range.from, to: range.to });
      if (res.success) setData(res.data?.data || {});
      else toast.error(res.error || 'Failed to load billing report');
    } catch (e) { toast.error(e.message); } finally { setLoading(false); }
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  const { kpis = {}, revenue_trend: trend = [], by_method: byMethod = [] } = data;

  return (
    <ReportLayout icon={Receipt} title="Billing Report" subtitle="Revenue, payments, and outstanding balances." tone="emerald"
      range={range} onRefresh={load} loading={loading} onExport={() => downloadCsv('billing-revenue.csv', trend)}>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Wallet} label="Revenue (paid)" value={loading ? '—' : formatCurrency(kpis.paid || 0)} tone="emerald" />
        <KpiCard icon={CreditCard} label="Payments received" value={loading ? '—' : formatCurrency(kpis.payments || 0)} tone="blue" />
        <KpiCard icon={AlertCircle} label="Outstanding" value={loading ? '—' : formatCurrency(kpis.outstanding || 0)} tone="rose" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue by month">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.primary} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={t.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: t.grid }} />
              <YAxis tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip {...tip} formatter={(v) => [formatCurrency(v), 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke={t.primary} strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Payments by method">
          {byMethod.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">No payments in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byMethod} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.grid} vertical={false} />
                <XAxis dataKey="method" tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: t.grid }} />
                <YAxis tick={{ fill: t.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
                <Tooltip {...tip} formatter={(v) => [formatCurrency(v), 'Amount']} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={56}>
                  {byMethod.map((_, i) => <Cell key={i} fill={t.palette[i % t.palette.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </ReportLayout>
  );
}
