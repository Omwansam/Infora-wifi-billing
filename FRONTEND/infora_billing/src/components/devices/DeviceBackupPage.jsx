import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Download, HardDrive, RefreshCw, Router, Clock, Trash2, Loader2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { formatDate } from '../../lib/utils';
import deviceService from '../../services/deviceService';
import { useMikrotikDevices } from '../../hooks/useMikrotikDevices';
import { useConfirm } from '../../contexts/ConfirmContext';
import DevicesLayout from './DevicesLayout';
import DeviceStatusBadge from './DeviceStatusBadge';

function formatSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DeviceBackupPage() {
  const confirm = useConfirm();
  const { devices, loading, loadDevices } = useMikrotikDevices();
  const [selectedId, setSelectedId] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backingUpId, setBackingUpId] = useState(null);

  const selected = devices.find((d) => d.id === selectedId) || null;

  useEffect(() => {
    if (!selectedId && devices.length > 0) setSelectedId(devices[0].id);
  }, [devices, selectedId]);

  const loadBackups = useCallback(async (deviceId) => {
    if (!deviceId) return;
    try {
      setLoadingBackups(true);
      const token = getAccessToken();
      setBackups(await deviceService.listBackups(token, deviceId));
    } catch (error) {
      toast.error(error.message || 'Could not load backups');
      setBackups([]);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadBackups(selectedId);
  }, [selectedId, loadBackups]);

  const handleBackup = async (device) => {
    try {
      setBackingUpId(device.id);
      const token = getAccessToken();
      await deviceService.createBackup(token, device.id);
      toast.success(`Backup created for ${device.name}`);
      if (device.id === selectedId) loadBackups(device.id);
      loadDevices();
    } catch (error) {
      toast.error(error.message || 'Backup failed');
    } finally {
      setBackingUpId(null);
    }
  };

  const handleDownload = async (backup) => {
    try {
      const token = getAccessToken();
      await deviceService.downloadBackup(token, backup.id, backup.filename);
    } catch (error) {
      toast.error(error.message || 'Download failed');
    }
  };

  const handleDelete = async (backup) => {
    const ok = await confirm({
      title: 'Delete backup?',
      message: `Backup "${backup.filename}" will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete backup',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const token = getAccessToken();
      await deviceService.deleteBackup(token, backup.id);
      toast.success('Backup deleted');
      setBackups((prev) => prev.filter((b) => b.id !== backup.id));
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  return (
    <DevicesLayout
      title="Configuration Backup"
      subtitle="Export, store, and download RouterOS configuration snapshots"
      action={
        <button
          onClick={loadDevices}
          disabled={loading}
          className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 self-start"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Devices */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Devices</h2>
          {loading ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-600 border-t-transparent mx-auto" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <Router className="h-12 w-12 text-slate-300 mx-auto" />
              <p className="mt-4 text-slate-600 text-sm">No devices available for backup</p>
            </div>
          ) : (
            devices.map((device) => (
              <button
                key={device.id}
                onClick={() => setSelectedId(device.id)}
                className={`w-full text-left bg-white rounded-2xl border p-4 shadow-sm transition-colors ${
                  selectedId === device.id ? 'border-violet-500 ring-1 ring-violet-200' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-violet-50 text-violet-700 shrink-0">
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900 truncate">{device.name}</h3>
                      <DeviceStatusBadge status={device.status} />
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{device.ip} · {device.model}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Last backup: {device.lastBackupAt ? formatDate(device.lastBackupAt) : 'Never'}
                    </p>
                  </div>
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); handleBackup(device); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleBackup(device); } }}
                  className="mt-3 w-full inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
                >
                  {backingUpId === device.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  {backingUpId === device.id ? 'Backing up…' : 'Backup now'}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Backup history */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {selected ? `Backups — ${selected.name}` : 'Backups'}
            </h2>
            {loadingBackups && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />}
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            {!selected ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                <Clock className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                Select a device to view its backups
              </div>
            ) : backups.length === 0 && !loadingBackups ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                No backups yet. Click <strong>Backup now</strong> to create the first snapshot.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {backups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{backup.filename}</p>
                        <p className="text-xs text-slate-500">
                          {formatSize(backup.size_bytes)} · {backup.file_format?.toUpperCase()} ·{' '}
                          {backup.created_at ? formatDate(backup.created_at) : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleDownload(backup)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        Download
                      </button>
                      <button
                        onClick={() => handleDelete(backup)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DevicesLayout>
  );
}
