import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Gauge,
  Loader2,
  Package,
  RefreshCw,
  Router,
  Search,
  ShieldAlert,
  Timer,
  TrendingDown,
  Users,
  Wifi,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getFupMonitor } from '../../services/fupService';
import { formatBytes } from '../../lib/networkUtils';
import { customerInitials } from '../../lib/billingFormatters';

const REFRESH_SECONDS = 60;

const STATUS_FILTERS = [
  { key: 'all', label: 'All accounts' },
  { key: 'fup_enabled', label: 'FUP enabled' },
  { key: 'warning', label: 'Approaching' },
  { key: 'throttled', label: 'Throttled' },
  { key: 'exceeded', label: 'Over limit' },
];

const TYPE_FILTERS = [
  { key: 'all', label: 'All', icon: Users },
  { key: 'pppoe', label: 'PPPoE', icon: Router },
  { key: 'hotspot', label: 'Hotspot', icon: Wifi },
];

const RESET_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function KpiCard({ icon: Icon, label, value, sub, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
    amber: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20',
    rose: 'border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/20',
    violet: 'border-violet-200 bg-violet-50/60 dark:border-violet-900/50 dark:bg-violet-950/20',
    emerald: 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20',
  };
  const iconTones = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        <div className={`rounded-xl p-2.5 ${iconTones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    normal: {
      label: 'Normal',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/30 dark:text-emerald-300',
    },
    warning: {
      label: 'Approaching',
      className: 'bg-amber-50 text-amber-800 ring-amber-600/15 dark:bg-amber-950/30 dark:text-amber-300',
    },
    exceeded: {
      label: 'Over limit',
      className: 'bg-orange-50 text-orange-800 ring-orange-600/15 dark:bg-orange-950/30 dark:text-orange-300',
    },
    throttled: {
      label: 'Throttled',
      className: 'bg-rose-50 text-rose-800 ring-rose-600/15 dark:bg-rose-950/30 dark:text-rose-300',
    },
    unlimited: {
      label: 'Unlimited',
      className: 'bg-slate-100 text-slate-600 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-300',
    },
  };
  const item = config[status] || config.normal;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${item.className}`}>
      {item.label}
    </span>
  );
}

function UsageBar({ pct, status }) {
  const width = Math.min(100, Math.max(0, pct || 0));
  const barColor =
    status === 'throttled' || status === 'exceeded'
      ? 'bg-rose-500'
      : status === 'warning'
        ? 'bg-amber-500'
        : 'bg-indigo-500';

  return (
    <div className="w-full min-w-[120px]">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-200">{width}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  const isHotspot = type === 'hotspot';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
        isHotspot
          ? 'bg-amber-50 text-amber-800 ring-amber-600/15'
          : 'bg-blue-50 text-blue-700 ring-blue-600/15'
      }`}
    >
      {isHotspot ? <Wifi className="h-3 w-3" /> : <Router className="h-3 w-3" />}
      {isHotspot ? 'Hotspot' : 'PPPoE'}
    </span>
  );
}

export default function FupMonitorPage() {
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusTab, setStatusTab] = useState('all');
  const [typeTab, setTypeTab] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (silent = false) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);
        if (!silent) setError(null);

        const data = await getFupMonitor({
          connectionType: typeTab,
          status: statusTab,
          search: search || undefined,
        });
        setAccounts(data.accounts);
        setSummary(data.summary);
        setLastUpdated(data.generated_at ? new Date(data.generated_at) : new Date());
        setError(null);
      } catch (err) {
        const message = err.message || 'Failed to load FUP monitor';
        setError(message);
        if (!silent) toast.error(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setCountdown(REFRESH_SECONDS);
      }
    },
    [typeTab, statusTab, search]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          load(true);
          return REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), searchInput ? 350 : 0);
    return () => clearTimeout(t);
  }, [searchInput]);

  const refreshProgress = ((REFRESH_SECONDS - countdown) / REFRESH_SECONDS) * 100;
  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const emptyMessage = useMemo(() => {
    if (search) return 'No accounts match your search. Try a different name, email, or package.';
    if (statusTab === 'throttled') return 'No subscribers are currently throttled. Usage is within fair-use limits.';
    if (statusTab === 'warning') return 'No accounts are approaching their FUP threshold yet.';
    if (statusTab === 'exceeded') return 'No accounts have exceeded their data cap for this reset period.';
    return 'Enable Fair Usage Policy on a package and assign subscribers to see monitored accounts here.';
  }, [search, statusTab]);

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                Fair Usage Policy
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">FUP Monitor</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-600/20 dark:bg-violet-950/40 dark:text-violet-300">
                  <Gauge className="h-3.5 w-3.5" />
                  Live usage
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-slate-600 dark:text-slate-400">
                Track throttled users and FUP-enabled accounts. Usage is calculated from RADIUS accounting
                against each plan&apos;s threshold and reset cycle.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/plans"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Package className="h-4 w-4" />
                Manage packages
              </Link>
              <button
                type="button"
                onClick={() => load(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
              >
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className="h-1 rounded-full bg-violet-500 transition-all duration-1000"
              style={{ width: `${refreshProgress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">
            Auto-refresh in {countdown}s · Last updated {updatedLabel}
          </p>
        </motion.div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            icon={Users}
            label="Monitored"
            value={summary.total_monitored ?? '—'}
            sub="FUP or data-capped plans"
            tone="violet"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Approaching"
            value={summary.approaching ?? 0}
            sub="≥ 80% of threshold"
            tone="amber"
          />
          <KpiCard
            icon={ShieldAlert}
            label="Throttled"
            value={summary.throttled ?? 0}
            sub="FUP limit exceeded"
            tone="rose"
          />
          <KpiCard
            icon={TrendingDown}
            label="Over limit"
            value={summary.exceeded ?? 0}
            sub="Including non-FUP caps"
            tone="rose"
          />
          <KpiCard
            icon={Activity}
            label="Online now"
            value={summary.online ?? 0}
            sub={`${summary.fup_enabled_plans ?? 0} FUP-enabled packages`}
            tone="emerald"
          />
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusTab(tab.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    statusTab === tab.key
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search client or package…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            {TYPE_FILTERS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTypeTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    typeTab === tab.key
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {error && !loading && accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-4 rounded-2xl bg-rose-50 p-4 dark:bg-rose-950/30">
                <ShieldAlert className="h-8 w-8 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Could not load FUP data</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{error}</p>
              <button
                type="button"
                onClick={() => load()}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading FUP accounts…
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
              <div className="mb-4 rounded-2xl bg-violet-50 p-4 dark:bg-violet-950/30">
                <Gauge className="h-8 w-8 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">No accounts to show</h3>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
              <Link
                to="/plans"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
              >
                <Zap className="h-4 w-4" />
                Configure FUP on a package
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Package</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">Reset</th>
                    <th className="px-4 py-3">Throttle speed</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {accounts.map((account) => {
                    const usedLabel = formatBytes(account.bytes_used || 0);
                    const limitLabel = account.threshold_bytes
                      ? formatBytes(account.threshold_bytes)
                      : 'Unlimited';

                    return (
                      <tr key={account.customer_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                                {customerInitials(account.name)}
                              </div>
                              {account.is_online && (
                                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-slate-900" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900 dark:text-white">{account.name}</p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                <TypeBadge type={account.connection_type} />
                                <span className="truncate text-xs text-slate-400">{account.email}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{account.plan_name}</p>
                          {account.fup_enabled && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                              <Gauge className="h-3 w-3" />
                              FUP enabled
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[200px]">
                            <p className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                              {usedLabel}
                              <span className="text-slate-400"> / {limitLabel}</span>
                            </p>
                            <UsageBar pct={account.usage_pct} status={account.status} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            <Timer className="h-3 w-3" />
                            {RESET_LABELS[account.fup_reset_cycle] || 'Monthly'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {account.fup_throttled_speed || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={account.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/clients/${account.customer_id}`}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
