import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  RefreshCw,
  Wifi,
  WifiOff,
  Wrench,
  Search,
  Router,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { bandwidthLabel, uptimeLabel } from '../../lib/deviceUtils';
import { formatDate } from '../../lib/utils';
import deviceService from '../../services/deviceService';
import { useMikrotikDevices } from '../../hooks/useMikrotikDevices';
import DevicesLayout from './DevicesLayout';
import DeviceStatusBadge from './DeviceStatusBadge';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'maintenance', label: 'Maintenance' },
];

export default function DeviceStatusPage() {
  const { devices, stats, loading, loadDevices } = useMikrotikDevices();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [syncingId, setSyncingId] = useState(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Auto-refresh the fleet view every 30s when enabled.
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = setInterval(() => loadDevices(), 30000);
    return () => clearInterval(id);
  }, [autoRefresh, loadDevices]);

  const handleMaintenance = async (device) => {
    const enable = device.status !== 'maintenance';
    try {
      setSyncingId(device.id);
      const token = getAccessToken();
      await deviceService.setMaintenance(token, device.id, enable);
      toast.success(enable ? 'Marked as maintenance' : 'Maintenance cleared');
      loadDevices();
    } catch (error) {
      toast.error(error.message || 'Failed to update maintenance');
    } finally {
      setSyncingId(null);
    }
  };

  const filtered = useMemo(
    () =>
      devices.filter((device) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          device.name.toLowerCase().includes(q) ||
          device.ip.includes(searchTerm) ||
          (device.location || '').toLowerCase().includes(q);
        const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [devices, searchTerm, statusFilter]
  );

  const summary = useMemo(
    () => ({
      online: devices.filter((d) => d.status === 'online').length,
      offline: devices.filter((d) => d.status === 'offline').length,
      maintenance: devices.filter((d) => d.status === 'maintenance').length,
      totalClients: devices.reduce((sum, d) => sum + d.clients, 0),
    }),
    [devices]
  );

  const handleSync = async (deviceId) => {
    try {
      setSyncingId(deviceId);
      const token = getAccessToken();
      await deviceService.syncDevice(token, deviceId);
      toast.success('Status refresh started');
      loadDevices();
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setSyncingId(null);
    }
  };

  const handleBulkSync = async () => {
    try {
      setBulkSyncing(true);
      const token = getAccessToken();
      await Promise.all(devices.map((d) => deviceService.syncDevice(token, d.id)));
      toast.success('All devices queued for sync');
      loadDevices();
    } catch {
      toast.error('Bulk sync failed');
    } finally {
      setBulkSyncing(false);
    }
  };

  return (
    <DevicesLayout
      title="Device Status"
      subtitle="Real-time connectivity and health across your Mikrotik fleet"
      action={
        <div className="flex gap-3 self-start items-center">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center px-3 py-2.5 rounded-xl text-sm font-medium border ${
              autoRefresh ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500'
            }`}
            title="Toggle 30s auto-refresh"
          >
            <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto {autoRefresh ? 'on' : 'off'}
          </button>
          <button
            onClick={loadDevices}
            disabled={loading}
            className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleBulkSync}
            disabled={bulkSyncing || devices.length === 0}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 disabled:opacity-50"
          >
            <Activity className={`h-4 w-4 mr-2 ${bulkSyncing ? 'animate-pulse' : ''}`} />
            Sync All
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { title: 'Online', value: stats.online_devices ?? summary.online, icon: Wifi, accent: 'from-emerald-500 to-teal-600' },
          { title: 'Offline', value: stats.offline_devices ?? summary.offline, icon: WifiOff, accent: 'from-rose-500 to-red-600' },
          { title: 'Maintenance', value: summary.maintenance, icon: Wrench, accent: 'from-amber-500 to-orange-600' },
          { title: 'Active Clients', value: stats.total_clients ?? summary.totalClients, icon: Activity, accent: 'from-indigo-500 to-violet-600' },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{stat.title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}>
                <stat.icon className="h-5 w-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search devices..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500"
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
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-600 border-t-transparent mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Router className="h-12 w-12 text-slate-300 mx-auto" />
            <p className="mt-4 text-slate-600">No devices match your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-500">
                  <th className="px-5 py-3 font-semibold">Device</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">IP</th>
                  <th className="px-5 py-3 font-semibold">Version</th>
                  <th className="px-5 py-3 font-semibold">Clients</th>
                  <th className="px-5 py-3 font-semibold">Uptime</th>
                  <th className="px-5 py-3 font-semibold">Last Sync</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((device) => (
                  <tr key={device.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900">{device.name}</div>
                      <div className="text-xs text-slate-500">{device.model} · {device.location || 'No location'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <DeviceStatusBadge status={device.status} />
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-700">{device.ip}</td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">{device.osVersion || '—'}</td>
                    <td className="px-5 py-4 font-medium">{device.clients}</td>
                    <td className="px-5 py-4 text-slate-500 text-xs">{uptimeLabel(device.uptime)}</td>
                    <td className="px-5 py-4 text-slate-500">
                      {device.lastSynced ? formatDate(device.lastSynced) : 'Never'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleMaintenance(device)}
                          disabled={syncingId === device.id}
                          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                            device.status === 'maintenance'
                              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                              : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                          }`}
                          title={device.status === 'maintenance' ? 'Clear maintenance' : 'Mark maintenance'}
                        >
                          <Wrench className="h-3.5 w-3.5 mr-1" />
                          {device.status === 'maintenance' ? 'Clear' : 'Maint'}
                        </button>
                        <button
                          onClick={() => handleSync(device.id)}
                          disabled={syncingId === device.id}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncingId === device.id ? 'animate-spin' : ''}`} />
                          Sync
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DevicesLayout>
  );
}
