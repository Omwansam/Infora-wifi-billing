import React from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { CreditCard } from 'lucide-react';
import { useChartTheme, tooltipStyle } from '../../../../lib/chartTheme';
import { formatCurrency, formatCurrencyShort } from '../../../../lib/utils';
import { formatPaymentMethod } from '../../../../lib/billingFormatters';
import { EmptyState } from '../parts';

/* -------------------------------------------------------------------------
 * Twelve months of payments, stacked by the gateway they came through.
 *
 * Categorical: the colour is the method's identity, assigned from the console
 * palette in fixed order so M-Pesa keeps its hue when a filter removes cash.
 * Past four methods the tail folds into "Other" rather than inventing hues —
 * the palette's order is its colourblind-safety guarantee and cycling breaks it.
 * ---------------------------------------------------------------------- */

const MAX_SERIES = 4;

export default function PaymentTrendChart({ data }) {
  const theme = useChartTheme();
  const tip = tooltipStyle(theme);
  const points = data?.points || [];
  const methods = data?.methods || [];

  if (!data?.lifetime) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No payments recorded"
        hint="Every completed payment on this account will appear here by month and gateway."
        compact
      />
    );
  }

  const shown = methods.slice(0, MAX_SERIES);
  const folded = methods.slice(MAX_SERIES);

  const rows = points.map((point) => {
    const row = { label: point.label, total: point.total };
    shown.forEach((method) => { row[method] = point.by_method?.[method] || 0; });
    if (folded.length) {
      row.__other = folded.reduce((sum, method) => sum + (point.by_method?.[method] || 0), 0);
    }
    return row;
  });

  const series = [
    ...shown.map((method, index) => ({
      key: method, name: formatPaymentMethod(method), color: theme.palette[index],
    })),
    ...(folded.length
      ? [{ key: '__other', name: 'Other', color: theme.palette[MAX_SERIES] }]
      : []),
  ];

  return (
    <div className="p-5">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: theme.grid }}
          />
          <YAxis
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value) => formatCurrencyShort(value)}
          />
          <Tooltip {...tip} formatter={(value, name) => [formatCurrency(value), name]} />
          {series.length > 1 && (
            <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          )}
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.name}
              stackId="payments"
              fill={entry.color}
              maxBarSize={24}
              stroke={theme.surface}
              strokeWidth={1}
              radius={index === series.length - 1 ? [4, 4, 0, 0] : undefined}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4 dark:border-slate-800">
        <Figure label="Lifetime" value={formatCurrency(data.lifetime)} />
        <Figure label="Avg / month" value={formatCurrency(data.avg_per_month)} />
        <Figure label="Active months" value={`${data.active_months} / ${data.window_months}`} />
        <Figure
          label="Last payment"
          value={data.last_payment ? formatCurrency(data.last_payment.amount) : '—'}
          sub={data.last_payment?.date
            ? new Date(data.last_payment.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
            : null}
        />
      </dl>
    </div>
  );
}

function Figure({ label, value, sub }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">{value}</dd>
      {sub && <dd className="text-xs text-slate-400 dark:text-slate-500">{sub}</dd>}
    </div>
  );
}
