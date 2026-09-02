import React from 'react';
import {
  Activity, ArrowDown, ArrowUp, BarChart3, Clock, Gauge, Loader2, Radio, RefreshCw, TrendingUp, Wifi,
} from 'lucide-react';
import { Panel, Chip, PanelSkeleton, BLOCK } from '../parts';
import TrafficChart from '../charts/TrafficChart';
import UsageBars from '../charts/UsageBars';
import PaymentTrendChart from '../charts/PaymentTrendChart';
import PeakHours from '../charts/PeakHours';
import { formatBytes } from '../../../../lib/networkUtils';
import { connectionLabel } from './OverviewTab';

function duration(seconds) {
  if (!seconds) return '—';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default function ReportsTab({ reports, loading, onRefresh, refreshing }) {
  if (loading) {
    return (
      <div className="space-y-5">
        <Panel title="Live from router"><PanelSkeleton rows={4} /></Panel>
        <Panel title="Traffic"><PanelSkeleton rows={5} /></Panel>
      </div>
    );
  }

  const live = reports?.live || {};

  return (
    <div className="space-y-5">
      <Panel
        icon={Radio}
        title="Live from router"
        subtitle={live.online
          ? `Online for ${duration(live.uptime_seconds)}${live.ip_address ? ` · ${live.ip_address}` : ''}`
          : live.last_activity
            ? `Offline · last seen ${new Date(live.last_activity).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
            : 'Offline · no sessions on record'}
        action={
          <div className="flex items-center gap-2">
            {live.online
              ? <Chip icon={Wifi} tone="good">Live</Chip>
              : <Chip tone="neutral">Idle</Chip>}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {refreshing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <Meter
            icon={ArrowDown}
            label="Download"
            value={live.avg_down_mbps}
            cap={live.plan_down_mbps}
            bytes={live.session_down_bytes}
            online={live.online}
          />
          <Meter
            icon={ArrowUp}
            label="Upload"
            value={live.avg_up_mbps}
            cap={live.plan_up_mbps}
            bytes={live.session_up_bytes}
            online={live.online}
          />
        </div>

        <dl className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
          <Cell icon={Clock} label="Session up" value={live.online ? duration(live.uptime_seconds) : '—'}
                sub={live.online ? 'since last reconnect' : 'not connected'} />
          <Cell icon={Activity} label="This session"
                value={live.online ? formatBytes((live.session_down_bytes || 0) + (live.session_up_bytes || 0)) : '—'}
                sub={live.online ? `${formatBytes(live.session_down_bytes)} down` : 'no live session'} />
          <Cell icon={TrendingUp} label="This month"
                value={formatBytes(reports?.daily_usage?.total_bytes || 0)}
                sub={`peak ${reports?.daily_usage?.peak_bytes ? formatBytes(reports.daily_usage.peak_bytes) : '—'} in a day`} />
          <Cell icon={Wifi} label="Connection"
                value={connectionLabel(live.connection_type)}
                /* Falls back to the last known NAS: "no NAS recorded" was shown
                   for every offline subscriber, which is who gets looked up. */
                sub={live.nas_ip
                  ? `via ${live.nas_ip}`
                  : (reports?.throughput?.sessions ? 'via last known router' : 'no NAS recorded')} />
        </dl>
      </Panel>

      {reports?.throughput?.sessions > 0 && (
        <Panel
          icon={Gauge}
          title="Speed delivered"
          subtitle={`Measured across ${reports.throughput.sessions} session${reports.throughput.sessions === 1 ? '' : 's'} in the last ${reports.throughput.days} days`}
        >
          <dl className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4 dark:bg-slate-800">
            <Cell icon={ArrowDown} label="Best download"
                  value={`${reports.throughput.peak_down_mbps} Mbps`}
                  sub={reports.throughput.plan_down_mbps
                    ? `plan is ${reports.throughput.plan_down_mbps} Mbps` : 'no plan speed set'} />
            <Cell icon={ArrowUp} label="Best upload"
                  value={`${reports.throughput.peak_up_mbps} Mbps`}
                  sub={reports.throughput.plan_up_mbps
                    ? `plan is ${reports.throughput.plan_up_mbps} Mbps` : 'no plan speed set'} />
            <Cell icon={TrendingUp} label="Proven at least"
                  value={reports.throughput.achieved_percent !== null
                    ? `${reports.throughput.achieved_percent}%` : '—'}
                  sub="of plan speed" />
            <Cell icon={Activity} label="Average"
                  value={`${reports.throughput.avg_down_mbps} Mbps`}
                  sub="across all accounted time" />
          </dl>
          {/* An average over accounted traffic is not a speed test. A light user
              looks slow without anything being wrong, so say what the number is
              rather than letting it be read as a diagnosis. */}
          {/* This measures demand, not capacity, so it can only ever prove a
              floor. Saying so in the panel is the difference between a useful
              number and one that gets a healthy line escalated. */}
          <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Measured from RADIUS accounting, not a speed test. It shows the fastest this
            line has been <em>observed</em> running, so a low figure usually means light
            use rather than a slow connection — it proves what the line reached, never
            what it is capable of. A high figure rules the network out; a low one rules
            nothing in.
          </p>
        </Panel>
      )}

      <Panel icon={Activity} title="Last 24 hours" subtitle="Hourly download and upload">
        <TrafficChart data={reports?.traffic_24h} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel icon={BarChart3} title="Payment trend" subtitle="Monthly payments by gateway · last 12 months">
          <PaymentTrendChart data={reports?.payment_trend} />
        </Panel>
        <Panel icon={Activity} title="Data usage" subtitle="Daily traffic · this month so far">
          <UsageBars data={reports?.daily_usage} />
        </Panel>
      </div>

      <Panel icon={Clock} title="Peak usage hours" subtitle="Average traffic by hour of day · last 30 days">
        <PeakHours data={reports?.peak_hours} />
      </Panel>
    </div>
  );
}

/**
 * Average throughput for the live session against the plan's cap.
 *
 * Labelled "average", never "current": RADIUS gives cumulative octets and a
 * session duration, so this is total ÷ time. Calling it a speedometer would
 * claim an instantaneous reading the protocol never sends.
 */
function Meter({ icon: Icon, label, value, cap, bytes, online }) {
  const mbps = online ? (value || 0) : 0;
  const percent = cap ? Math.min(100, (mbps / cap) * 100) : 0;

  return (
    <div className={`${BLOCK} p-4`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {cap ? `cap ${cap} Mbps` : 'no cap set'}
        </span>
      </div>

      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {mbps.toFixed(1)}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">Mbps average</span>
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span>{online ? `${formatBytes(bytes)} this session` : 'no live session'}</span>
        <span>{cap ? `${Math.round(percent)}% of plan` : '—'}</span>
      </div>
    </div>
  );
}

function Cell({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white px-5 py-4 dark:bg-slate-900">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </dt>
      <dd className="mt-1 truncate text-lg font-semibold text-slate-900 dark:text-white">{value}</dd>
      <dd className="truncate text-xs text-slate-400 dark:text-slate-500">{sub}</dd>
    </div>
  );
}
