import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Router, Search, Signal, Wifi,
} from 'lucide-react';

import DevicesLayout from './DevicesLayout';
import cpeService from '../../services/cpeService';
import { getAccessToken } from '../../utils/authToken';

// Optical receive power classification. These thresholds are what a field tech
// actually acts on: below -27 dBm the fibre or a connector is failing, and that
// single number resolves most "internet is slow" calls without a site visit.
const OPTICAL = {
  good: { label: 'Good', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  marginal: { label: 'Marginal', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  critical: { label: 'Critical', className: 'bg-red-50 text-red-700 border-red-200' },
  too_strong: { label: 'Too strong', className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

function StatCard({ icon: Icon, label, value, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-600 bg-slate-100',
    emerald: 'text-emerald-600 bg-emerald-100',
    amber: 'text-amber-600 bg-amber-100',
    red: 'text-red-600 bg-red-100',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}

function OpticalBadge({ health, dbm }) {
  if (!health || dbm === null || dbm === undefined) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const meta = OPTICAL[health] || OPTICAL.good;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      <Signal className="h-3 w-3" />
      {dbm} dBm
    </span>
  );
}

function formatUptime(seconds) {
  if (!seconds && seconds !== 0) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

function relativeTime(iso) {
  if (!iso) return 'never';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function CpePage() {
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const [list, statsData] = await Promise.all([
        cpeService.listCpe(token, { status, search }),
        cpeService.getStats(token),
      ]);
      setDevices(list?.cpe || []);
      setStats(statsData || null);
    } catch (error) {
      toast.error(error.message || 'Failed to load CPE');
      setDevices([]);
      // Leave stats blank rather than showing a stale count next to a failed list.
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [status, search]);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (device) => {
    try {
      setActionId(device.id);
      await cpeService.approveCpe(getAccessToken(), device.id);
      toast.success(`${device.serial_number} approved`);
      await load();
    } catch (error) {
      toast.error(error.message || 'Approve failed');
    } finally {
      setActionId(null);
    }
  };

  const handleRefresh = async (device) => {
    try {
      setActionId(device.id);
      const result = await cpeService.refreshCpe(getAccessToken(), device.id);
      // Queued, not applied — say so, or the operator will think it failed when
      // the values do not change immediately.
      toast.success(result?.delivery?.note || 'Refresh queued');
    } catch (error) {
      toast.error(error.message || 'Refresh failed');
    } finally {
      setActionId(null);
    }
  };

  const pendingCount = stats?.pending || 0;

  return (
    <DevicesLayout
      title="Customer CPE"
      subtitle="TR-069 managed ONTs and routers at subscriber premises"
      action={(
        <button
          onClick={load}
          className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Reload
        </button>
      )}
    >
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard icon={Router} label="Total" value={stats?.total} />
        <StatCard icon={CheckCircle2} label="Active" value={stats?.active} tone="emerald" />
        <StatCard icon={Activity} label="Online" value={stats?.online} tone="emerald" />
        <StatCard icon={Clock} label="Pending" value={stats?.pending} tone="amber" />
        <StatCard icon={AlertTriangle} label="Optical issues" value={stats?.optical_degraded} tone="red" />
      </div>

      {pendingCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900 dark:text-amber-200">
            <p className="font-semibold">{pendingCount} device{pendingCount === 1 ? '' : 's'} awaiting approval</p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300">
              A pending CPE has contacted the ACS but is issued no configuration until approved.
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search serial, SSID or PPPoE login…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500">Loading CPE…</div>
      ) : devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center dark:border-slate-700">
          <Router className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">No CPE yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Devices appear here once they reach the ACS. Point a CPE at your ACS URL,
            or pre-enrol one so it arrives already claimed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Subscriber</th>
                <th className="px-4 py-3">Optical</th>
                <th className="px-4 py-3">WiFi</th>
                <th className="px-4 py-3">Uptime</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {devices.map((device) => (
                <motion.tr
                  key={device.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-4 py-3">
                    <Link to={`/devices/cpe/${device.id}`} className="font-semibold text-slate-900 hover:text-orange-600 dark:text-white">
                      {device.serial_number || device.serial_key}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{device.manufacturer || 'Unknown'} {device.product_class || ''}</span>
                      <span className={`inline-flex h-1.5 w-1.5 rounded-full ${device.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      <span>{device.online ? 'Online' : 'Offline'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {device.customer_id ? (
                      <Link to={`/clients/${device.customer_id}`} className="text-slate-900 hover:text-orange-600 dark:text-white">
                        {device.customer_name}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">Unlinked</span>
                    )}
                    {device.pppoe_username && (
                      <div className="text-xs text-slate-500">{device.pppoe_username}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <OpticalBadge health={device.optical_health} dbm={device.rx_power_dbm} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Wifi className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">{device.ssid || '—'}</span>
                    </div>
                    {device.connected_clients !== null && (
                      <div className="text-xs text-slate-500">{device.connected_clients} clients</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {formatUptime(device.uptime_seconds)}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {relativeTime(device.last_inform_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {device.status === 'pending' ? (
                        <button
                          onClick={() => handleApprove(device)}
                          disabled={actionId === device.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleRefresh(device)}
                          disabled={actionId === device.id}
                          className="rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50"
                          title="Queue a parameter refresh"
                        >
                          <RefreshCw className={`h-4 w-4 ${actionId === device.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <Link
                        to={`/devices/cpe/${device.id}`}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Details
                      </Link>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DevicesLayout>
  );
}
