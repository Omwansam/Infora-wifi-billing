import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity, CheckCircle2, Clock, Cpu, Inbox, LayoutGrid, Link2Off, Loader2, Plus,
  RefreshCw, List, Search, ShieldQuestion, Trash2, Wifi, X,
} from 'lucide-react';

import Tr069Layout from './Tr069Layout';
import Tr069EnrollDialog from './Tr069EnrollDialog';
import { LiveDot, OpticalMeter, formatUptime, relativeTime } from './tr069Meta';
import cpeService from '../../services/cpeService';
import { getAccessToken } from '../../utils/authToken';
import { useConfirm } from '../../contexts/ConfirmContext';
import TablePagination from '../ui/TablePagination';
import { useClientPagination } from '../../hooks/usePagination';

/**
 * Segments are filters, not statuses — "optical issues" cuts across active and
 * pending, and "unlinked" is a data-quality queue. Each carries a predicate so
 * the counts and the filtered view can never drift apart.
 */
const SEGMENTS = [
  { key: 'all', label: 'All devices', icon: Cpu, match: () => true },
  { key: 'pending', label: 'Pending', icon: ShieldQuestion, match: (d) => d.status === 'pending' },
  { key: 'online', label: 'Online', icon: Activity, match: (d) => d.online },
  { key: 'offline', label: 'Offline', icon: Clock, match: (d) => !d.online },
  { key: 'optical', label: 'Optical issues', icon: Wifi, match: (d) => ['marginal', 'critical'].includes(d.optical_health) },
  { key: 'unlinked', label: 'Unlinked', icon: Link2Off, match: (d) => !d.customer_id },
];

const SORTS = {
  recent: { label: 'Last seen', compare: (a, b) => new Date(b.last_inform_at || 0) - new Date(a.last_inform_at || 0) },
  signal: { label: 'Worst signal', compare: (a, b) => (a.rx_power_dbm ?? 99) - (b.rx_power_dbm ?? 99) },
  serial: { label: 'Serial', compare: (a, b) => (a.serial_number || '').localeCompare(b.serial_number || '') },
};

const STATUS_CHIP = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  disabled: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
};

function DeviceCard({ device, busy, onApprove, onRefresh }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/tr069/${device.id}`}
            className="block truncate font-mono text-sm font-semibold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
          >
            {device.serial_number || device.serial_key}
          </Link>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {device.manufacturer || 'Unknown vendor'} {device.product_class || ''}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${STATUS_CHIP[device.status] || STATUS_CHIP.disabled}`}>
          <LiveDot online={device.online} />
          {device.status}
        </span>
      </div>

      <div className="my-4">
        <OpticalMeter dbm={device.rx_power_dbm} health={device.optical_health} />
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <div className="min-w-0">
          <dt className="text-slate-400">SSID</dt>
          <dd className="truncate font-medium text-slate-700 dark:text-slate-200">{device.ssid || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Subscriber</dt>
          <dd className="truncate font-medium text-slate-700 dark:text-slate-200">
            {device.customer_id ? (
              <Link to={`/clients/${device.customer_id}`} className="hover:text-indigo-600">{device.customer_name}</Link>
            ) : (
              <span className="text-slate-400">Unlinked</span>
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Uptime</dt>
          <dd className="truncate font-medium text-slate-700 dark:text-slate-200">{formatUptime(device.uptime_seconds)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-400">Last inform</dt>
          <dd className="truncate font-medium text-slate-700 dark:text-slate-200">{relativeTime(device.last_inform_at)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-center gap-2">
        {device.status === 'pending' ? (
          <button
            onClick={() => onApprove(device)}
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Approve
          </button>
        ) : (
          <button
            onClick={() => onRefresh(device)}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        )}
        <Link
          to={`/tr069/${device.id}`}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          Open
        </Link>
      </div>
    </motion.div>
  );
}

function DeviceRow({ device, busy, onApprove, onRefresh }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
      <td className="px-4 py-3">
        <Link to={`/tr069/${device.id}`} className="font-mono text-sm font-semibold text-slate-900 hover:text-indigo-600 dark:text-white">
          {device.serial_number || device.serial_key}
        </Link>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
          <LiveDot online={device.online} />
          {device.manufacturer || 'Unknown'} {device.product_class || ''}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {device.customer_id ? (
          <Link to={`/clients/${device.customer_id}`} className="text-slate-900 hover:text-indigo-600 dark:text-white">{device.customer_name}</Link>
        ) : (
          <span className="text-xs text-slate-400">Unlinked</span>
        )}
        {device.pppoe_username && <div className="text-xs text-slate-500">{device.pppoe_username}</div>}
      </td>
      <td className="w-48 px-4 py-3">
        <OpticalMeter dbm={device.rx_power_dbm} health={device.optical_health} compact />
      </td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{device.ssid || '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatUptime(device.uptime_seconds)}</td>
      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{relativeTime(device.last_inform_at)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {device.status === 'pending' ? (
            <button
              onClick={() => onApprove(device)}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Approve
            </button>
          ) : (
            <button
              onClick={() => onRefresh(device)}
              disabled={busy}
              className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50 dark:hover:bg-indigo-500/10"
              title="Queue a parameter refresh"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            </button>
          )}
          <Link to={`/tr069/${device.id}`} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Open
          </Link>
        </div>
      </td>
    </tr>
  );
}

export default function Tr069FleetPage() {
  const confirm = useConfirm();
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [view, setView] = useState('grid');
  const [actionId, setActionId] = useState(null);
  const [enrolling, setEnrolling] = useState(false);

  // The list endpoint has no pagination, so it returns the whole fleet either
  // way — filtering here instead of refetching keeps segment counts honest and
  // makes search instant.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const [list, statsData] = await Promise.all([
        cpeService.listCpe(token),
        cpeService.getStats(token),
      ]);
      setDevices(list?.cpe || []);
      setStats(statsData || null);
    } catch (error) {
      toast.error(error.message || 'Failed to load the CPE fleet');
      setDevices([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    // Profiles are static vendor metadata; a failure here must not block the fleet.
    cpeService.listProfiles(getAccessToken())
      .then((data) => setProfiles(data?.profiles || []))
      .catch(() => setProfiles([]));
  }, []);

  const counts = useMemo(() => Object.fromEntries(
    SEGMENTS.map((s) => [s.key, devices.filter(s.match).length]),
  ), [devices]);

  const visible = useMemo(() => {
    const segmentDef = SEGMENTS.find((s) => s.key === segment) || SEGMENTS[0];
    const needle = search.trim().toLowerCase();
    return devices
      .filter(segmentDef.match)
      .filter((d) => !needle || [d.serial_number, d.serial_key, d.ssid, d.pppoe_username, d.customer_name, d.manufacturer, d.product_class]
        .some((field) => (field || '').toLowerCase().includes(needle)))
      .slice()
      .sort(SORTS[sort].compare);
  }, [devices, segment, search, sort]);

  // One pager drives both the grid and the list, so switching view keeps the
  // operator on the same slice of the fleet.
  const { pageItems, paginationProps } = useClientPagination(visible, {
    storageKey: 'tr069-fleet',
    defaultPageSize: 25,
    resetOn: [segment, search, sort],
    filteredFrom: devices.length,
  });

  const pending = useMemo(() => devices.filter((d) => d.status === 'pending'), [devices]);

  const informedLastHour = useMemo(() => devices.filter(
    (d) => d.last_inform_at && Date.now() - new Date(d.last_inform_at).getTime() < 3600_000,
  ).length, [devices]);

  const handleApprove = async (device) => {
    try {
      setActionId(device.id);
      await cpeService.approveCpe(getAccessToken(), device.id);
      toast.success(`${device.serial_number || device.serial_key} approved`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Approve failed');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (device) => {
    const ok = await confirm({
      title: 'Reject this device?',
      message: `${device.serial_number || device.serial_key} will be removed. If it keeps informing it will reappear here as pending.`,
      confirmText: 'Reject',
      destructive: true,
    });
    if (!ok) return;
    try {
      setActionId(device.id);
      await cpeService.deleteCpe(getAccessToken(), device.id);
      toast.success('Device rejected');
      await load();
    } catch (error) {
      toast.error(error.message || 'Reject failed');
    } finally {
      setActionId(null);
    }
  };

  const handleRefresh = async (device) => {
    try {
      setActionId(device.id);
      const result = await cpeService.refreshCpe(getAccessToken(), device.id);
      // Queued, not applied — repeat the backend's wording rather than "done".
      toast.success(result?.delivery?.note || 'Refresh queued');
    } catch (error) {
      toast.error(error.message || 'Refresh failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <Tr069Layout
      title="TR-069 ACS"
      subtitle="Customer premises equipment — GPON ONTs and vendor routers that dial into this server"
      acsUrl={stats?.acs_url}
      chips={[
        { value: stats?.total ?? devices.length, label: 'devices', icon: Cpu },
        { value: stats?.online ?? 0, label: 'online', icon: Activity, tone: 'text-emerald-400' },
        { value: informedLastHour, label: 'informs (1h)', icon: Clock, tone: 'text-cyan-300' },
        ...(stats?.optical_degraded ? [{ value: stats.optical_degraded, label: 'optical issues', icon: Wifi, tone: 'text-red-400' }] : []),
      ]}
      action={(
        <>
          <button
            onClick={() => setEnrolling(true)}
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            <Plus className="mr-2 h-4 w-4" /> Enrol CPE
          </button>
          <button
            onClick={load}
            className="inline-flex items-center rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 hover:bg-white/20"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
          </button>
        </>
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Filter rail — replaces the status dropdown, and shows the shape of the fleet */}
        <aside className="space-y-4">
          <nav className="space-y-1">
            {SEGMENTS.map((s) => {
              const active = segment === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSegment(s.key)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-indigo-600 font-semibold text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <s.icon className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                    {s.label}
                  </span>
                  <span className={`tabular-nums text-xs ${active ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {counts[s.key] ?? 0}
                  </span>
                </button>
              );
            })}
          </nav>

          {profiles.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Models the ACS knows
              </p>
              <ul className="space-y-1.5">
                {profiles.map((profile) => (
                  <li key={profile.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-slate-700 dark:text-slate-300">{profile.label}</span>
                    <span className="shrink-0 tabular-nums text-slate-400" title="Settings this profile can control">
                      {profile.supported_fields.length}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <div className="min-w-0 space-y-4">
          {/* Approval inbox — a queue you work through, not a banner you read */}
          {pending.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5">
              <header className="flex items-center gap-2 border-b border-amber-200 px-4 py-3 dark:border-amber-500/30">
                <Inbox className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  {pending.length} device{pending.length === 1 ? '' : 's'} awaiting approval
                </h2>
                <span className="ml-auto text-xs text-amber-800 dark:text-amber-300">
                  Pending devices reach the ACS but are issued no configuration
                </span>
              </header>
              <ul className="divide-y divide-amber-200/70 dark:divide-amber-500/20">
                {pending.map((device) => (
                  <li key={device.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm font-semibold text-slate-900 dark:text-white">
                        {device.serial_number || device.serial_key}
                      </p>
                      <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                        {device.manufacturer || 'Unknown vendor'} {device.product_class || ''} · from {device.peer_ip || 'unknown IP'} · first seen {relativeTime(device.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApprove(device)}
                      disabled={actionId === device.id}
                      className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionId === device.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(device)}
                      disabled={actionId === device.id}
                      className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Reject
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by serial, SSID, PPPoE login, subscriber or model…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {Object.entries(SORTS).map(([key, def]) => (
                <option key={key} value={key}>{def.label}</option>
              ))}
            </select>
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
              {[{ key: 'grid', icon: LayoutGrid }, { key: 'list', icon: List }].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setView(option.key)}
                  aria-label={`${option.key} view`}
                  className={`rounded-md p-1.5 ${
                    view === option.key
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <option.icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the fleet…
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
              <Cpu className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-semibold text-slate-900 dark:text-white">
                {devices.length === 0 ? 'No CPE has reached the ACS yet' : 'Nothing matches this filter'}
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                {devices.length === 0
                  ? 'Point a device at the ACS URL above and it appears here on its first inform, or enrol one so it arrives already claimed.'
                  : 'Try a different segment or clear the search.'}
              </p>
            </div>
          ) : view === 'grid' ? (
            <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  busy={actionId === device.id}
                  onApprove={handleApprove}
                  onRefresh={handleRefresh}
                />
              ))}
            </motion.div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3">Device</th>
                    <th className="px-4 py-3">Subscriber</th>
                    <th className="px-4 py-3">Optical</th>
                    <th className="px-4 py-3">SSID</th>
                    <th className="px-4 py-3">Uptime</th>
                    <th className="px-4 py-3">Last inform</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pageItems.map((device) => (
                    <DeviceRow
                      key={device.id}
                      device={device}
                      busy={actionId === device.id}
                      onApprove={handleApprove}
                      onRefresh={handleRefresh}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <TablePagination {...paginationProps} loading={loading} noun="device" divider={false} />
          </div>
        </div>
      </div>

      {enrolling && (
        <Tr069EnrollDialog onClose={() => setEnrolling(false)} onEnrolled={load} />
      )}
    </Tr069Layout>
  );
}
