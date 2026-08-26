import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Wifi,
  Activity,
  Users,
  RefreshCw,
  Eye,
  Trash2,
  Router,
  Zap,
  Download,
  AlertTriangle,
  Terminal,
  Copy,
  Check,
  X,
  LayoutGrid,
  List,
  Settings,
  Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_ENDPOINTS, getAuthHeaders } from '../../config/api';
import { getAccessToken } from '../../utils/authToken';
import { bandwidthLabel, bandwidthTone } from '../../lib/deviceUtils';
import Sparkline from '../ui/Sparkline';
import DeviceArt from './DeviceArt';
import { formatDate, formatRelativeTime } from '../../lib/utils';
import deviceService from '../../services/deviceService';
import { useMikrotikDevices } from '../../hooks/useMikrotikDevices';
import { useConfirm } from '../../contexts/ConfirmContext';
import DevicesLayout from './DevicesLayout';
import DeviceStatusBadge from './DeviceStatusBadge';
import AddDeviceWizard from './AddDeviceWizard';
import TablePagination from '../ui/TablePagination';
import { useClientPagination } from '../../hooks/usePagination';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'maintenance', label: 'Maintenance' },
];

export default function MikrotikPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { devices, stats, loading, loadDevices } = useMikrotikDevices();
  const [isps, setIsps] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWizard, setShowWizard] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [deploymentIssues, setDeploymentIssues] = useState([]);
  const [provisionModal, setProvisionModal] = useState(null);
  const [copied, setCopied] = useState(false);
  // Card grid or table. Remembered, because which one an operator wants depends
  // on fleet size and that does not change between visits.
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem('infora.devicesView') === 'table' ? 'table' : 'cards';
    } catch {
      return 'cards';
    }
  });
  const [trends, setTrends] = useState({ devices: {}, fleet: [] });
  // The panel on each card alternates between the throughput trend and a
  // picture of the hardware. A timer would swap it out from under whoever is
  // reading it, so the operator flips it and the choice sticks.
  const [cardPanel, setCardPanel] = useState(() => {
    try {
      return localStorage.getItem('infora.devicePanel') === 'art' ? 'art' : 'chart';
    } catch {
      return 'chart';
    }
  });

  const setPanel = (next) => {
    setCardPanel(next);
    try {
      localStorage.setItem('infora.devicePanel', next);
    } catch { /* private window — preference just won't persist */ }
  };

  const setViewMode = (next) => {
    setView(next);
    try {
      localStorage.setItem('infora.devicesView', next);
    } catch { /* private window — the preference just won't persist */ }
  };

  useEffect(() => {
    const loadIsps = async () => {
      try {
        const token = getAccessToken();
        const response = await fetch(`${API_ENDPOINTS.ISPS}?per_page=100`, {
          headers: getAuthHeaders(token),
        });
        const data = await response.json();
        if (response.ok) setIsps(data.isps || []);
      } catch {
        setIsps([]);
      }
    };
    loadIsps();
  }, []);

  // Trend series for every card plus the fleet total, in one request. Refreshed
  // on the poll cadence rather than on every render.
  useEffect(() => {
    let cancelled = false;
    const loadTrends = async () => {
      try {
        const data = await deviceService.getFleetTrends(getAccessToken(), { hours: 6, points: 24 });
        if (!cancelled) setTrends(data || { devices: {}, fleet: [] });
      } catch {
        if (!cancelled) setTrends({ devices: {}, fleet: [] });
      }
    };
    loadTrends();
    const timer = setInterval(loadTrends, 300000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [devices.length]);

  useEffect(() => {
    const loadDeploymentHealth = async () => {
      try {
        const result = await deviceService.getDeploymentHealth();
        setDeploymentIssues(result.data?.issues || []);
      } catch {
        setDeploymentIssues([]);
      }
    };
    loadDeploymentHealth();
  }, [devices.length]);

  const filteredDevices = useMemo(
    () =>
      devices.filter((device) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          device.name.toLowerCase().includes(q) ||
          device.ip.includes(searchTerm) ||
          (device.model || '').toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [devices, searchTerm, statusFilter]
  );

  const { pageItems, paginationProps } = useClientPagination(filteredDevices, {
    storageKey: 'mikrotik-devices',
    defaultPageSize: 25,
    resetOn: [searchTerm, statusFilter],
    filteredFrom: devices.length,
  });

  const statsCards = useMemo(
    () => [
      {
        title: 'Total Routers',
        value: stats.total_devices ?? devices.length,
        subtitle: `${stats.active_devices ?? 0} active in inventory`,
        icon: Router,
        accent: 'from-orange-500 to-amber-600',
      },
      {
        title: 'Online',
        value: stats.online_devices ?? devices.filter((d) => d.status === 'online').length,
        subtitle: `${stats.offline_devices ?? 0} offline`,
        icon: Wifi,
        accent: 'from-emerald-500 to-teal-600',
      },
      {
        title: 'Connected Clients',
        value: stats.total_clients ?? devices.reduce((sum, d) => sum + d.clients, 0),
        subtitle: 'Across all Mikrotik nodes',
        icon: Users,
        accent: 'from-indigo-500 to-violet-600',
      },
      {
        title: 'Bandwidth Load',
        value: bandwidthLabel(stats.total_bandwidth_mb ?? 0),
        subtitle: 'Aggregate snapshot',
        icon: Activity,
        accent: 'from-cyan-500 to-blue-600',
        // The one card where the trend earns its place: a throughput figure on
        // its own cannot say whether the network is ramping up or winding down.
        trend: trends.fleet,
      },
    ],
    [stats, devices, trends]
  );

  const handleSync = async (deviceId) => {
    try {
      setActionId(deviceId);
      const token = getAccessToken();
      const result = await deviceService.syncDevice(token, deviceId);
      // Report what actually happened. The sync route answers 200 for an
      // unreachable router too (so the UI shows status instead of throwing),
      // so success is not implied by the request completing.
      if (result?.busy) {
        toast('Router is busy with another operation — try again shortly');
      } else if (result?.reachable === false) {
        toast.error(result.error || 'Device is unreachable');
      } else if (result?.sync_details?.stats_stale) {
        toast.success('Device is online (stats unavailable this round)');
      } else {
        toast.success('Device synced');
      }
      await loadDevices();
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setActionId(null);
    }
  };

  const handleDownloadRadius = async (device) => {
    try {
      setActionId(device.id);
      const token = getAccessToken();
      if (device.management_wg_enabled) {
        await deviceService.downloadManagementTunnelScript(token, device.id, device.name);
      }
      await deviceService.downloadRadiusScript(token, device.id, device.name);
      toast.success('RADIUS script downloaded — import on MikroTik');
    } catch (error) {
      toast.error(error.message || 'Download failed');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (device) => {
    const ok = await confirm({
      title: 'Remove device?',
      message: `"${device.name}" will be removed from inventory along with its provisioning link. This cannot be undone.`,
      confirmLabel: 'Remove device',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      setActionId(device.id);
      const token = getAccessToken();
      await deviceService.deleteDevice(token, device.id);
      toast.success('Device removed');
      loadDevices();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    } finally {
      setActionId(null);
    }
  };

  const handleQuickProvision = async (device) => {
    try {
      setActionId(device.id);
      const token = getAccessToken();
      const result = await deviceService.generateProvisionToken(token, device.id);
      setProvisionModal({
        device,
        oneLiner: result.one_liner,
        expiresAt: result.expires_at,
        warning: result.warning,
      });
      setCopied(false);
      if (result.warning) toast.error(result.warning, { duration: 6000 });
    } catch (error) {
      toast.error(error.message || 'Could not generate provisioning command');
    } finally {
      setActionId(null);
    }
  };

  const handleCopyOneLiner = async () => {
    if (!provisionModal?.oneLiner) return;
    try {
      await navigator.clipboard.writeText(provisionModal.oneLiner);
      setCopied(true);
      toast.success('Command copied');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Copy failed — select and copy manually');
    }
  };

  const handleRevokeProvision = async (device) => {
    const ok = await confirm({
      title: 'Revoke provisioning token?',
      message: `The current provisioning command for "${device.name}" will stop working. You'll need to generate a new one to link the router.`,
      confirmLabel: 'Revoke token',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const token = getAccessToken();
      await deviceService.revokeProvisionToken(token, device.id);
      toast.success('Provisioning token revoked');
      setProvisionModal(null);
    } catch (error) {
      toast.error(error.message || 'Revoke failed');
    }
  };

  if (showWizard) {
    return (
      <AddDeviceWizard
        isps={isps}
        onClose={() => setShowWizard(false)}
        onSuccess={() => {
          setShowWizard(false);
          loadDevices();
        }}
      />
    );
  }

  return (
    <DevicesLayout
      title="Mikrotik Routers"
      subtitle="Link, monitor, and manage RouterOS devices"
      action={
        <div className="flex gap-3 self-start">
          <button
            onClick={loadDevices}
            disabled={loading}
            className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Link Mikrotik
          </button>
        </div>
      }
    >
      {deploymentIssues.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Deployment checklist</p>
              <ul className="mt-2 text-sm text-amber-800 list-disc list-inside space-y-1">
                {deploymentIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statsCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.accent}`} />
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.title}</p>
                {/* Proportional figures: tabular-nums pads every digit to the
                    width of a zero, which reads loose at display size. */}
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              </div>
              <div className={`shrink-0 rounded-xl bg-gradient-to-br p-2.5 text-white ${stat.accent}`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>

            {stat.trend ? (
              <div className="mt-3">
                <Sparkline
                  values={stat.trend}
                  height={38}
                  ariaLabel={`${stat.title} over the last 6 hours`}
                />
              </div>
            ) : null}

            {/* mt-auto so the caption sits on the same baseline whether or not
                the card carries a trend — otherwise the one with a sparkline
                pushes its caption down and the row reads as ragged. */}
            <p className="mt-auto pt-2 text-xs text-slate-500 dark:text-slate-400">{stat.subtitle}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, IP, or model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium ${
                  statusFilter === tab.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <div className="ml-auto flex rounded-full border border-slate-200 p-0.5 dark:border-slate-700">
              {[
                { key: 'cards', Icon: LayoutGrid, label: 'Card view' },
                { key: 'table', Icon: List, label: 'Table view' },
              ].map(({ key, Icon, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setViewMode(key)}
                  aria-pressed={view === key}
                  title={label}
                  className={`rounded-full p-2 transition-colors ${
                    view === key
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-600 border-t-transparent mx-auto" />
        </div>
      ) : filteredDevices.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Router className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="mt-4 text-lg font-semibold text-slate-900">No Mikrotik devices found</h3>
          <button
            onClick={() => setShowWizard(true)}
            className="mt-4 inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Link your first router
          </button>
        </div>
      ) : (
        <div>
        {view === 'table' ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Device</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">IP Address</th>
                    <th className="px-5 py-3 text-right font-semibold">Clients</th>
                    <th className="px-5 py-3 font-semibold">Bandwidth</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pageItems.map((device) => {
                    const trend = trends.devices?.[String(device.id)];
                    return (
                      <tr
                        key={device.id}
                        className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                        onClick={() => navigate(`/devices/mikrotik/${device.id}`)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {/* The hardware, not a generic router glyph: in a long
                                list the silhouette is what lets you find the box
                                you are thinking of before you read the name. */}
                            <DeviceArt
                              model={device.model}
                              offline={device.status !== 'online'}
                              className="h-7 w-12 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900 dark:text-white">{device.name}</p>
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{device.model}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5"><DeviceStatusBadge status={device.status} /></td>
                        <td className="px-5 py-3.5 font-mono text-slate-700 dark:text-slate-300">{device.ip}</td>
                        {/* tabular-nums here and not on the cards: these are
                            columns of numbers that have to line up. */}
                        <td className="px-5 py-3.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {device.clients ?? 0}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className={`shrink-0 tabular-nums font-semibold ${bandwidthTone(device.bandwidth)}`}>
                              {bandwidthLabel(device.bandwidth)}
                            </span>
                            <span className="hidden w-20 shrink-0 lg:block">
                              <Sparkline
                                values={trend?.spark || []}
                                height={22}
                                area={false}
                                strokeWidth={1.5}
                                placeholder={false}
                                ariaLabel={`${device.name} throughput trend`}
                              />
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => handleQuickProvision(device)}
                              disabled={actionId === device.id}
                              title="Quick provision (one-line command)"
                              className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-500/15"
                            >
                              <Terminal className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleSync(device.id)}
                              disabled={actionId === device.id}
                              title="Sync device"
                              className="rounded-lg p-2 text-slate-500 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-orange-500/15 dark:hover:text-orange-300"
                            >
                              <RefreshCw className={`h-4 w-4 ${actionId === device.id ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              onClick={() => navigate(`/devices/mikrotik/${device.id}`)}
                              title="View device"
                              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination {...paginationProps} loading={loading} noun="router" />
          </div>
        ) : (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {pageItems.map((device, index) => {
            const trend = trends.devices?.[String(device.id)];
            return (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${
                device.status === 'online' ? 'border-emerald-200' : 'border-slate-200'
              }`}
            >
              <div className={`h-1 ${device.status === 'online' ? 'bg-emerald-500' : device.status === 'maintenance' ? 'bg-amber-500' : 'bg-rose-400'}`} />
              <div className="p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="shrink-0 rounded-xl bg-orange-50 p-2.5 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
                      <Router className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-2 truncate font-bold text-slate-900 dark:text-white">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            device.status === 'online' ? 'bg-emerald-500'
                              : device.status === 'maintenance' ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          aria-hidden="true"
                        />
                        {device.name}
                      </h3>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {device.model} · <span className="font-mono">{device.ip}</span>
                      </p>
                    </div>
                  </div>
                  {/* Availability, not just "is it up right now": a router that
                      flaps hourly and one that has never dropped both read
                      "Online" in a snapshot. The dot above still carries the
                      live state, so this is the second channel, not a
                      replacement. */}
                  {/* Colour tracks the live state, not the percentage: a router
                      that is up right now reads green even if it had a bad
                      month, and the figure beside it still tells you it did. */}
                  {trend?.uptime_percent != null ? (
                    <span
                      title={`${device.status === 'online' ? 'Online' : device.status} · ${trend.uptime_percent}% availability over the last 30 days`}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${
                        device.status === 'online'
                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/25'
                          : device.status === 'maintenance'
                            ? 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25'
                            : 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/25'
                      }`}
                    >
                      {trend.uptime_percent}% UPTIME
                    </span>
                  ) : (
                    <DeviceStatusBadge status={device.status} />
                  )}
                </div>

                <div className="relative mb-4 overflow-hidden rounded-xl bg-slate-50 px-3 pt-3 dark:bg-slate-800/40">
                  <button
                    type="button"
                    onClick={() => setPanel(cardPanel === 'chart' ? 'art' : 'chart')}
                    title={cardPanel === 'chart' ? 'Show the hardware' : 'Show the throughput trend'}
                    aria-label={cardPanel === 'chart' ? 'Show the hardware' : 'Show the throughput trend'}
                    className="absolute right-1.5 top-1.5 z-10 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
                  >
                    {cardPanel === 'chart' ? <ImageIcon className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                  </button>

                  <div className="flex items-baseline justify-between gap-2 pr-7">
                    <span className={`text-lg font-bold ${bandwidthTone(device.bandwidth)}`}>
                      {bandwidthLabel(device.bandwidth)}
                    </span>
                    <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {cardPanel === 'chart' ? 'Current uplink' : device.model || 'RouterOS'}
                    </span>
                  </div>

                  {cardPanel === 'chart' ? (
                    <Sparkline
                      values={trend?.spark || []}
                      height={44}
                      ariaLabel={`${device.name} uplink throughput over the last 6 hours`}
                    />
                  ) : (
                    // Taller than the sparkline it replaces: a 44px strip is
                    // enough for a trend line and not enough to recognise a
                    // chassis, which is the whole point of showing one.
                    <DeviceArt
                      model={device.model}
                      offline={device.status !== 'online'}
                      className="h-[68px] w-full py-1"
                      title={`${device.model || 'RouterOS device'} — ${device.name}`}
                    />
                  )}
                </div>

                <dl className="mb-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['CPU', trend?.cpu != null ? `${Math.round(trend.cpu)}%` : '—'],
                    ['MEM', trend?.memory != null ? `${Math.round(trend.memory)}%` : '—'],
                    ['CLIENTS', device.clients ?? 0],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-slate-800/40">
                      <dd className="text-base font-bold text-slate-900 dark:text-white">{value}</dd>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        {label}
                      </dt>
                    </div>
                  ))}
                </dl>

                <p className="mb-4 truncate text-xs text-slate-400 dark:text-slate-500">
                  Last poll: {device.lastSynced ? formatRelativeTime(device.lastSynced) : 'never'}
                  {device.location ? ` · ${device.location}` : ''}
                  {device.ispName ? ` · ${device.ispName}` : ''}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleSync(device.id)}
                      disabled={actionId === device.id}
                      className="p-2 rounded-lg text-slate-500 hover:text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                      title="Sync device"
                    >
                      <RefreshCw className={`h-4 w-4 ${actionId === device.id ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => handleDownloadRadius(device)}
                      disabled={actionId === device.id}
                      className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                      title="Download RADIUS .rsc script"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleQuickProvision(device)}
                      disabled={actionId === device.id}
                      className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                      title="Quick provision (one-line command)"
                    >
                      <Terminal className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/devices/mikrotik/${device.id}`)}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                      title="View device"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(device)}
                      disabled={actionId === device.id}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                      title="Remove device"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleSync(device.id)}
                    disabled={actionId === device.id}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                  >
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Sync
                  </button>
                </div>
              </div>
            </motion.div>
            );
          })}
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <TablePagination {...paginationProps} loading={loading} noun="router" divider={false} />
        </div>
        </>
        )}
        </div>
      )}

      {provisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
              <div className="flex gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
                  <Terminal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Quick provision — {provisionModal.device.name}</h3>
                  <p className="text-sm text-slate-500">
                    Paste this single command into the router's terminal (Winbox/SSH).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProvisionModal(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="relative">
                <pre className="bg-slate-900 text-emerald-200 text-xs rounded-xl p-4 pr-12 overflow-x-auto whitespace-pre-wrap break-all font-mono">
{provisionModal.oneLiner}
                </pre>
                <button
                  onClick={handleCopyOneLiner}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
                  title="Copy command"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>

              {provisionModal.warning && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">
                  {provisionModal.warning}
                </div>
              )}

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                <p className="font-semibold">Before running:</p>
                <ul className="mt-1 list-disc list-inside space-y-0.5">
                  <li>The router needs internet access (the command pings 8.8.8.8 first).</li>
                  <li>The script downloads, imports, then deletes itself — your RADIUS secret is not left on disk.</li>
                  <li>Re-running is safe; it is idempotent (removes old entries before adding).</li>
                </ul>
              </div>

              <p className="text-xs text-slate-500">
                {provisionModal.expiresAt
                  ? `This command expires ${formatDate(provisionModal.expiresAt)}.`
                  : 'This command stays valid until you rotate or revoke the token.'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 p-5 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => handleRevokeProvision(provisionModal.device)}
                className="text-sm font-medium text-rose-600 hover:text-rose-700"
              >
                Revoke token
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuickProvision(provisionModal.device)}
                  className="px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white hover:bg-slate-50"
                >
                  Rotate token
                </button>
                <button
                  onClick={handleCopyOneLiner}
                  className="inline-flex items-center px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                  {copied ? 'Copied' : 'Copy command'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </DevicesLayout>
  );
}
