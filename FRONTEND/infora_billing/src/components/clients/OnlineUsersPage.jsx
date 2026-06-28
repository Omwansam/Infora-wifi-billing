import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Router,
  Wifi,
  Search,
  RefreshCw,
  Eye,
  Unplug,
  Loader2,
  ArrowLeft,
  Radio,
  Timer,
  Activity,
  Server,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { formatBytes, formatDuration } from '../../lib/networkUtils';
import { customerInitials } from '../../lib/billingFormatters';
import { formatDateTime } from '../../lib/utils';
import toast from 'react-hot-toast';

const REFRESH_SECONDS = 30;

const TYPE_FILTERS = [
  { key: 'all', label: 'All', icon: Users },
  { key: 'pppoe', label: 'PPPoE', icon: Router },
  { key: 'hotspot', label: 'Hotspot', icon: Wifi },
];

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

function InlineStat({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-600',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
  };
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`h-4 w-4 shrink-0 ${tones[tone]}`} />
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold tabular-nums ${tones[tone]}`}>{value}</span>
    </div>
  );
}

export default function OnlineUsersPage() {
  const [sessions, setSessions] = useState([]);
  const [counts, setCounts] = useState({ all: 0, pppoe: 0, hotspot: 0 });
  const [routers, setRouters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeTab, setTypeTab] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [routerId, setRouterId] = useState('');
  const [countdown, setCountdown] = useState(REFRESH_SECONDS);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [actionId, setActionId] = useState(null);

  const loadSessions = useCallback(
    async (silent = false) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);

        const result = await customerService.getActiveSessions({
          connection_type: typeTab,
          search: search || undefined,
          router_id: routerId || undefined,
        });

        if (result.success) {
          const payload = result.data?.data ?? result.data ?? {};
          setSessions(payload.sessions || []);
          setCounts(payload.counts || { all: 0, pppoe: 0, hotspot: 0 });
          setRouters(payload.routers || []);
          setLastUpdated(new Date());
        } else {
          toast.error(result.error || 'Failed to load online users');
        }
      } catch {
        toast.error('Failed to load online users');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setCountdown(REFRESH_SECONDS);
      }
    },
    [typeTab, search, routerId]
  );

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadSessions(true);
          return REFRESH_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [loadSessions]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), searchInput ? 350 : 0);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleDisconnect = async (session) => {
    if (!session.customer_id) {
      toast.error('No linked client account for this session');
      return;
    }
    try {
      setActionId(session.id);
      const result = await customerService.disconnectClient(session.customer_id);
      if (result.success) {
        toast.success('User dropped from network');
        loadSessions(true);
      } else {
        toast.error(result.error || 'Disconnect failed');
      }
    } catch (e) {
      toast.error(e.message || 'Disconnect failed');
    } finally {
      setActionId(null);
    }
  };

  const totalTraffic = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.bytes_in || 0) + (s.bytes_out || 0), 0),
    [sessions]
  );

  const refreshProgress = ((REFRESH_SECONDS - countdown) / REFRESH_SECONDS) * 100;

  const emptyMessage = useMemo(() => {
    if (search || routerId) return 'Try clearing filters or searching with a different term.';
    if (typeTab === 'pppoe') return 'No PPPoE dial-up sessions are open in RADIUS accounting right now.';
    if (typeTab === 'hotspot') return 'No captive portal sessions are active at the moment.';
    return 'When subscribers authenticate through RADIUS, their live sessions will show up here.';
  }, [search, routerId, typeTab]);

  const updatedLabel = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  const activeRouterName = routers.find((r) => String(r.id) === String(routerId))?.name;

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link
            to="/clients"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clients
          </Link>

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Subscribers</p>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <h1 className="text-3xl font-bold text-slate-900">Online Users</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              </div>
              <p className="text-slate-600 mt-1.5 max-w-2xl">
                RADIUS accounting sessions — authenticated users currently on the network.
              </p>
            </div>

            <button
              type="button"
              onClick={() => loadSessions(true)}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-sm disabled:opacity-50 self-start"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Sync now
            </button>
          </div>

          {/* Inline stats — not cards */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-4 rounded-xl bg-white border border-slate-200 shadow-sm">
            <InlineStat icon={Activity} label="Connected" value={loading ? '—' : counts.all} tone="emerald" />
            <span className="hidden sm:block w-px h-4 bg-slate-200" />
            <InlineStat icon={Router} label="PPPoE" value={loading ? '—' : counts.pppoe} tone="blue" />
            <span className="hidden sm:block w-px h-4 bg-slate-200" />
            <InlineStat icon={Wifi} label="Hotspot" value={loading ? '—' : counts.hotspot} tone="amber" />
            <span className="hidden md:block w-px h-4 bg-slate-200" />
            <InlineStat
              icon={Radio}
              label="Traffic"
              value={loading ? '—' : formatBytes(totalTraffic)}
              tone="slate"
            />
            <span className="hidden md:block w-px h-4 bg-slate-200" />
            <InlineStat icon={Server} label="Routers" value={routers.length} tone="slate" />
            <span className="hidden lg:block w-px h-4 bg-slate-200" />
            <div className="flex items-center gap-2 text-xs text-slate-400 ml-auto">
              <span>Updated {updatedLabel}</span>
              <span>·</span>
              <span>Sync in {countdown}s</span>
            </div>
          </div>

          <div className="mt-3 h-0.5 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-1000 ease-linear"
              style={{ width: `${refreshProgress}%` }}
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          {/* Tabs + filters */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-4 pt-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-1">
              {TYPE_FILTERS.map((tab) => {
                const Icon = tab.icon;
                const active = typeTab === tab.key;
                const count =
                  tab.key === 'all' ? counts.all : tab.key === 'pppoe' ? counts.pppoe : counts.hotspot;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTypeTab(tab.key)}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        active ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pb-4 lg:pb-0 lg:py-3">
              <div className="relative sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Login, IP, MAC…"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={routerId}
                onChange={(e) => setRouterId(e.target.value)}
                className="sm:w-44 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All routers</option>
                {routers.map((router) => (
                  <option key={router.id} value={router.id}>
                    {router.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filter chips */}
          {(search || routerId) && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-blue-50/60 border-b border-blue-100 text-xs">
              <span className="font-medium text-blue-800">Filtered:</span>
              {search && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-blue-700 ring-1 ring-blue-200">
                  &ldquo;{search}&rdquo;
                </span>
              )}
              {routerId && activeRouterName && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-blue-700 ring-1 ring-blue-200">
                  {activeRouterName}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setRouterId('');
                }}
                className="ml-1 font-semibold text-blue-600 hover:text-blue-800"
              >
                Clear
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500">Reading RADIUS accounting…</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-16 px-6">
              <div className="mx-auto max-w-md text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-5">
                  <Timer className="h-7 w-7 text-slate-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Nobody online</h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">{emptyMessage}</p>
                <Link
                  to="/clients"
                  className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Users className="h-4 w-4" />
                  Manage subscribers
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80">
                    {['User', 'Type', 'IP address', 'MAC', 'Router', 'Started', 'Uptime', 'Traffic', ''].map(
                      (col) => (
                        <th
                          key={col || 'actions'}
                          className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 ${
                            col === '' ? 'text-right' : ''
                          }`}
                        >
                          {col}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((session) => {
                    const displayName = session.customer_name || session.username;
                    const isHotspot = session.connection_type === 'hotspot';
                    const avatarClass = isHotspot
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-700';
                    const totalBytes = (session.bytes_in || 0) + (session.bytes_out || 0);

                    return (
                      <tr key={session.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3 min-w-[180px]">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${avatarClass}`}
                            >
                              {customerInitials(displayName)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{displayName}</p>
                              <p className="text-xs font-mono text-slate-500 truncate">{session.username}</p>
                              {session.plan_name && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{session.plan_name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <TypeBadge type={session.connection_type} />
                        </td>
                        <td className="px-4 py-3.5 font-mono text-sm text-slate-800">
                          {session.ip_address || '—'}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-600 max-w-[120px] truncate">
                          {session.mac_address || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-700 max-w-[120px] truncate">
                          {session.router_name || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                          {session.session_start ? formatDateTime(session.session_start) : '—'}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-700 tabular-nums whitespace-nowrap">
                          {formatDuration(session.duration_seconds)}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-medium text-slate-800 tabular-nums">
                            {formatBytes(totalBytes)}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 tabular-nums">
                            ↓{formatBytes(session.bytes_in)} ↑{formatBytes(session.bytes_out)}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            {session.customer_id && (
                              <Link
                                to={`/clients/${session.customer_id}`}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                title="View profile"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            )}
                            {session.customer_id && (
                              <button
                                type="button"
                                onClick={() => handleDisconnect(session)}
                                disabled={actionId === session.id}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                                title="Drop session"
                              >
                                {actionId === session.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Unplug className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
              <span>
                {sessions.length > 0 ? (
                  <>
                    <strong className="font-semibold text-slate-700">{sessions.length}</strong> open{' '}
                    {sessions.length === 1 ? 'session' : 'sessions'}
                    {typeTab !== 'all' && ` · ${TYPE_FILTERS.find((t) => t.key === typeTab)?.label} only`}
                  </>
                ) : (
                  'No open sessions'
                )}
              </span>
              <span>FreeRADIUS radacct · refreshes every 30s</span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
