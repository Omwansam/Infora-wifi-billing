import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  RefreshCw,
  Router,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  Loader2,
} from 'lucide-react';
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
  const [checkResults, setCheckResults] = useState({}); // deviceId -> {installed, latest, update_available}
  const [upgradeLog, setUpgradeLog] = useState(null); // { device, log }

  const fleetSummary = useMemo(() => {
    const updatable = devices.filter((d) => {
      const r = checkResults[d.id];
      return r?.update_available || (d.firmwareLatest && d.osVersion && d.firmwareLatest !== d.osVersion);
    }).length;
    return {
      total: devices.length,
      online: devices.filter((d) => d.status === 'online').length,
      updatesAvailable: updatable,
    };
  }, [devices, checkResults]);

  const getVersions = (device) => {
    const r = checkResults[device.id] || {};
    const installed = r.installed || device.osVersion || null;
    const latest = r.latest || device.firmwareLatest || null;
    const updateAvailable = r.update_available || (latest && installed && latest !== installed);
    return { installed, latest, updateAvailable };
  };

  const handleCheck = async (device) => {
    try {
      setActionId(device.id);
      const token = getAccessToken();
      const res = await deviceService.checkFirmware(token, device.id);
      setCheckResults((prev) => ({ ...prev, [device.id]: res }));
      toast.success(
        res.update_available
          ? `Update available: ${res.latest}`
          : `Up to date (${res.installed || 'unknown'})`
      );
      loadDevices();
    } catch (error) {
      toast.error(error.message || 'Firmware check failed');
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

  const handleUpgrade = async (device) => {
    if (!window.confirm(`Upgrade RouterOS on "${device.name}"? The device will download the new version and REBOOT, briefly dropping connectivity.`)) return;
    try {
      setActionId(device.id);
      const token = getAccessToken();
      const res = await deviceService.upgradeFirmware(token, device.id);
      setUpgradeLog({ device, log: res.log || [] });
      if (res.success) toast.success(`${device.name} is upgrading and will reboot`);
      else toast.error('Upgrade reported errors — see log');
      loadDevices();
    } catch (error) {
      toast.error(error.message || 'Upgrade failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <DevicesLayout
      title="Firmware Updates"
      subtitle="Check versions and roll out RouterOS upgrades across your fleet"
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
          { title: 'Online', value: fleetSummary.online, icon: Shield, accent: 'from-emerald-500 to-teal-600' },
          { title: 'Updates Available', value: fleetSummary.updatesAvailable, icon: AlertTriangle, accent: 'from-amber-500 to-orange-600' },
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
            Upgrades download a new RouterOS image and reboot the router. Take a configuration backup first.
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
          {devices.map((device, index) => {
            const { installed, latest, updateAvailable } = getVersions(device);
            const busy = actionId === device.id;
            return (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{device.name}</h3>
                    <p className="text-sm text-slate-500 truncate">{device.model} · {device.ip}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {updateAvailable && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-600/20">
                        Update
                      </span>
                    )}
                    <DeviceStatusBadge status={device.status} />
                  </div>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-sm mb-5">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="text-slate-500 text-xs">Installed Version</dt>
                    <dd className="font-mono font-medium text-slate-900 mt-0.5">{installed || 'Check to detect'}</dd>
                  </div>
                  <div className={`rounded-xl p-3 ${updateAvailable ? 'bg-amber-50' : 'bg-slate-50'}`}>
                    <dt className="text-slate-500 text-xs">Latest Available</dt>
                    <dd className={`font-mono font-medium mt-0.5 ${updateAvailable ? 'text-amber-700' : 'text-slate-900'}`}>
                      {latest || '—'}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
                  <button
                    onClick={() => handleCheck(device)}
                    disabled={busy || device.status !== 'online'}
                    className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Search className="h-4 w-4 mr-1.5" />}
                    Check
                  </button>
                  <button
                    onClick={() => handleSync(device)}
                    disabled={busy}
                    className="inline-flex items-center px-3 py-2 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${busy ? 'animate-spin' : ''}`} />
                    Sync
                  </button>
                  <button
                    onClick={() => handleUpgrade(device)}
                    disabled={busy || device.status !== 'online'}
                    className={`inline-flex items-center px-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
                      updateAvailable
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700'
                        : 'bg-slate-400 hover:bg-slate-500'
                    }`}
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Upgrade &amp; Reboot
                  </button>
                  <span className="ml-auto text-xs text-slate-400 self-center">
                    Synced {device.lastSynced ? formatDate(device.lastSynced) : 'never'}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {upgradeLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setUpgradeLog(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Upgrade — {upgradeLog.device.name}</h3>
              <button onClick={() => setUpgradeLog(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="rounded-xl bg-slate-900 p-4 max-h-72 overflow-y-auto font-mono text-xs space-y-1">
                {upgradeLog.log.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    {entry.status === 'ok' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span className={entry.status === 'ok' ? 'text-slate-300' : 'text-rose-300'}>
                      <span className="text-slate-500">[{entry.step}]</span> {entry.detail}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                The router reboots to apply the upgrade. Click <strong>Sync</strong> once it&apos;s back online to confirm the new version.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </DevicesLayout>
  );
}
