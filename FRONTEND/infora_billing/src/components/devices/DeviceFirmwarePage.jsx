import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, RefreshCw, Router, Shield, AlertTriangle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { formatDate } from '../../lib/utils';
import deviceService from '../../services/deviceService';
import { useMikrotikDevices } from '../../hooks/useMikrotikDevices';
import DevicesLayout from './DevicesLayout';
import DeviceStatusBadge from './DeviceStatusBadge';

export default function DeviceFirmwarePage() {
  const { devices, loading, loadDevices } = useMikrotikDevices();
  const [actionId, setActionId] = useState(null);

  const fleetSummary = useMemo(
    () => ({
      total: devices.length,
      online: devices.filter((d) => d.status === 'online').length,
      needsAttention: devices.filter((d) => d.status !== 'online').length,
    }),
    [devices]
  );

  const handleFirmwareUpdate = async (device) => {
    if (!window.confirm(`Queue firmware update for "${device.name}"? The device may reboot.`)) return;
    try {
      setActionId(device.id);
      const token = getAccessToken();
      await deviceService.updateDeviceFirmware(token, device.id);
      toast.success(`Firmware update queued for ${device.name}`);
    } catch (error) {
      toast.error(error.message || 'Update failed');
    } finally {
      setActionId(null);
    }
  };

  const handleSync = async (device) => {
    try {
      setActionId(device.id);
      const token = getAccessToken();
      await deviceService.syncDevice(token, device.id);
      toast.success('Device synced — version info refreshed');
      loadDevices();
    } catch (error) {
      toast.error(error.message || 'Sync failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <DevicesLayout
      title="Firmware Updates"
      subtitle="Check versions and queue RouterOS upgrades across your fleet"
      action={
        <button
          onClick={loadDevices}
          disabled={loading}
          className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 self-start"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Fleet
        </button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { title: 'Fleet Size', value: fleetSummary.total, icon: Router, accent: 'from-slate-600 to-slate-800' },
          { title: 'Online & Updatable', value: fleetSummary.online, icon: Shield, accent: 'from-emerald-500 to-teal-600' },
          { title: 'Needs Attention', value: fleetSummary.needsAttention, icon: AlertTriangle, accent: 'from-amber-500 to-orange-600' },
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

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-6 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-semibold">Schedule upgrades during maintenance windows</p>
          <p className="mt-1 text-amber-800">
            Firmware updates may briefly interrupt connectivity. Ensure backups are current before upgrading.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-600 border-t-transparent mx-auto" />
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <Router className="h-12 w-12 text-slate-300 mx-auto" />
          <p className="mt-4 text-slate-600">Link Mikrotik devices to manage firmware</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {devices.map((device, index) => (
            <motion.div
              key={device.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{device.name}</h3>
                  <p className="text-sm text-slate-500">{device.model} · {device.ip}</p>
                </div>
                <DeviceStatusBadge status={device.status} />
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm mb-5">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-slate-500 text-xs">Reported Version</dt>
                  <dd className="font-mono font-medium text-slate-900 mt-0.5">
                    {device.notes?.includes('version') ? device.notes : 'Sync to refresh'}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-slate-500 text-xs">Last Sync</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">
                    {device.lastSynced ? formatDate(device.lastSynced) : 'Never'}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                <button
                  onClick={() => handleSync(device)}
                  disabled={actionId === device.id}
                  className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-1.5 ${actionId === device.id ? 'animate-spin' : ''}`} />
                  Sync Version
                </button>
                <button
                  onClick={() => handleFirmwareUpdate(device)}
                  disabled={actionId === device.id || device.status !== 'online'}
                  className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:opacity-50"
                >
                  <Upload className="h-4 w-4 mr-1.5" />
                  Queue Update
                </button>
                {device.status === 'online' && (
                  <span className="inline-flex items-center ml-auto text-xs text-emerald-600 font-medium">
                    <Zap className="h-3.5 w-3.5 mr-1" />
                    Ready
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </DevicesLayout>
  );
}
