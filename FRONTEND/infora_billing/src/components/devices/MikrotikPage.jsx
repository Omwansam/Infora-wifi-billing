import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_ENDPOINTS, getAuthHeaders } from '../../config/api';
import { getAccessToken } from '../../utils/authToken';
import { bandwidthLabel, bandwidthTone } from '../../lib/deviceUtils';
import { formatDate } from '../../lib/utils';
import deviceService from '../../services/deviceService';
import { useMikrotikDevices } from '../../hooks/useMikrotikDevices';
import DevicesLayout from './DevicesLayout';
import DeviceStatusBadge from './DeviceStatusBadge';
import AddDeviceWizard from './AddDeviceWizard';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'maintenance', label: 'Maintenance' },
];

export default function MikrotikPage() {
  const { devices, stats, loading, loadDevices } = useMikrotikDevices();
  const [isps, setIsps] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showWizard, setShowWizard] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [deploymentIssues, setDeploymentIssues] = useState([]);
  const [provisionModal, setProvisionModal] = useState(null);
  const [copied, setCopied] = useState(false);

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
        subtitle: 'Aggregate usage snapshot',
        icon: Activity,
        accent: 'from-cyan-500 to-blue-600',
      },
    ],
    [stats, devices]
  );

  const handleSync = async (deviceId) => {
    try {
      setActionId(deviceId);
      const token = getAccessToken();
      await deviceService.syncDevice(token, deviceId);
      toast.success('Device synced');
      loadDevices();
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
    if (!window.confirm(`Remove "${device.name}" from inventory?`)) return;
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
    if (!window.confirm(`Revoke the provisioning token for "${device.name}"? The current command will stop working.`)) return;
    try {
      const token = getAccessToken();
      await deviceService.revokeProvisionToken(token, device.id);
      toast.success('Provisioning token revoked');
      setProvisionModal(null);
    } catch (error) {
      toast.error(error.message || 'Revoke failed');
    }
  };

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
            className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.accent}`} />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                <p className="text-xs text-slate-500 mt-2">{stat.subtitle}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredDevices.map((device, index) => (
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
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-orange-50 text-orange-700 shrink-0">
                      <Router className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{device.name}</h3>
                      <p className="text-sm text-slate-500">{device.model}</p>
                    </div>
                  </div>
                  <DeviceStatusBadge status={device.status} />
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-slate-500 text-xs">IP Address</dt>
                    <dd className="font-mono font-medium text-slate-900 mt-0.5">{device.ip}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-slate-500 text-xs">Clients</dt>
                    <dd className="font-semibold text-slate-900 mt-0.5">{device.clients}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-slate-500 text-xs">Location</dt>
                    <dd className="font-medium text-slate-900 mt-0.5 truncate">{device.location || '—'}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-slate-500 text-xs">Bandwidth</dt>
                    <dd className={`font-semibold mt-0.5 ${bandwidthTone(device.bandwidth)}`}>
                      {bandwidthLabel(device.bandwidth)}
                    </dd>
                  </div>
                </dl>

                <p className="text-xs text-slate-400 mb-4">
                  Last sync: {device.lastSynced ? formatDate(device.lastSynced) : 'Never'}
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
                    <button className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100" title="View details">
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
          ))}
        </div>
      )}

      {showWizard && (
        <AddDeviceWizard
          isps={isps}
          onClose={() => setShowWizard(false)}
          onSuccess={loadDevices}
        />
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
