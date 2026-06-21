import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, HardDrive, RefreshCw, Router, Clock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { formatDate } from '../../lib/utils';
import deviceService from '../../services/deviceService';
import { useMikrotikDevices } from '../../hooks/useMikrotikDevices';
import DevicesLayout from './DevicesLayout';
import DeviceStatusBadge from './DeviceStatusBadge';

export default function DeviceBackupPage() {
  const { devices, loading, loadDevices } = useMikrotikDevices();
  const [backingUpId, setBackingUpId] = useState(null);
  const [backupLog, setBackupLog] = useState([]);

  const handleBackup = async (device) => {
    try {
      setBackingUpId(device.id);
      const token = getAccessToken();
      const result = await deviceService.backupDevice(token, device.id);
      const entry = {
        id: Date.now(),
        deviceId: device.id,
        deviceName: device.name,
        message: result.message || 'Backup initiated',
        timestamp: new Date().toISOString(),
        status: 'success',
      };
      setBackupLog((prev) => [entry, ...prev]);
      toast.success(`Backup started for ${device.name}`);
    } catch (error) {
      toast.error(error.message || 'Backup failed');
      setBackupLog((prev) => [
        {
          id: Date.now(),
          deviceId: device.id,
          deviceName: device.name,
          message: error.message || 'Backup failed',
          timestamp: new Date().toISOString(),
          status: 'error',
        },
        ...prev,
      ]);
    } finally {
      setBackingUpId(null);
    }
  };

  const handleBackupAll = async () => {
    for (const device of devices) {
      await handleBackup(device);
    }
  };

  return (
    <DevicesLayout
      title="Configuration Backup"
      subtitle="Export and track RouterOS configuration snapshots"
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
            onClick={handleBackupAll}
            disabled={backingUpId !== null || devices.length === 0}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Backup All
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Devices</h2>
          {loading ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-600 border-t-transparent mx-auto" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <Router className="h-12 w-12 text-slate-300 mx-auto" />
              <p className="mt-4 text-slate-600">No devices available for backup</p>
            </div>
          ) : (
            devices.map((device, index) => (
              <motion.div
                key={device.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="flex gap-4 min-w-0">
                  <div className="p-3 rounded-xl bg-violet-50 text-violet-700 shrink-0">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{device.name}</h3>
                      <DeviceStatusBadge status={device.status} />
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {device.ip} · {device.model}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Last sync: {device.lastSynced ? formatDate(device.lastSynced) : 'Never'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleBackup(device)}
                  disabled={backingUpId === device.id}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 shrink-0"
                >
                  <Download className={`h-4 w-4 mr-2 ${backingUpId === device.id ? 'animate-bounce' : ''}`} />
                  {backingUpId === device.id ? 'Backing up…' : 'Run Backup'}
                </button>
              </motion.div>
            ))
          )}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {backupLog.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                Backup history will appear here
              </div>
            ) : (
              backupLog.slice(0, 8).map((entry) => (
                <div key={entry.id} className="p-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2
                      className={`h-4 w-4 mt-0.5 shrink-0 ${entry.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{entry.deviceName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{entry.message}</p>
                      <p className="text-xs text-slate-400 mt-1">{formatDate(entry.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DevicesLayout>
  );
}
