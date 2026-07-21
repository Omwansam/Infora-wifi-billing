import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, RefreshCw, Pencil, Trash2, Router, Wifi, Network, Clock,
  AlertTriangle, Cpu, MemoryStick, HardDrive, ShieldCheck, Globe, Copy,
  Eye, EyeOff, ExternalLink, Download, CheckCircle2, Server, Activity, Settings2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';
import { uptimeLabel } from '../../lib/deviceUtils';
import { formatDate } from '../../lib/utils';
import DeviceStatusBadge from './DeviceStatusBadge';
import ConfigureServicesPanel from './ConfigureServicesPanel';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'resources', label: 'Resource History' },
  { id: 'downtime', label: 'Downtime History' },
  { id: 'configure', label: 'Configure Services' },
];

function fmtBytes(bytes) {
  if (bytes == null) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function barTone(pct) {
  if (pct == null) return 'bg-slate-300';
  if (pct >= 85) return 'bg-rose-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function ResourceRow({ icon: Icon, label, pct, right }) {
  const shown = pct == null ? 0 : Math.min(100, Math.max(0, pct));
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-2 text-slate-600">
          <Icon className="h-4 w-4 text-slate-400" /> {label}
        </span>
        <span className="font-semibold text-slate-900">{right}</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barTone(pct)}`} style={{ width: `${shown}%` }} />
      </div>
    </div>
  );
}

function ServiceRow({ icon: Icon, name, sub, ok }) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{name}</p>
        {sub && <p className="text-xs text-slate-500">{sub}</p>}
      </div>
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ok ? 'text-emerald-600' : 'text-slate-400'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        {ok ? 'Configured' : 'Not set'}
      </span>
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-medium text-slate-900 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone = 'text-slate-400' }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
        <div className="rounded-xl bg-slate-50 p-2">
          <Icon className={`h-5 w-5 ${tone}`} />
        </div>
      </div>
    </div>
  );
}

export default function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [syncing, setSyncing] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const load = async () => {
    try {
      const data = await deviceService.getDevice(getAccessToken(), id);
      setDevice(data);
    } catch (e) {
      toast.error(e.message || 'Failed to load device');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await deviceService.syncDevice(getAccessToken(), id);
      toast.success('Sync started — refreshing…');
      setTimeout(load, 1500);
    } catch (e) {
      toast.error(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Remove ${device.device_name}? This cannot be undone.`)) return;
    try {
      await deviceService.deleteDevice(getAccessToken(), id);
      toast.success('Device removed');
      navigate('/devices/mikrotik', { replace: true });
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  const copy = (text, label = 'Copied') => {
    navigator.clipboard?.writeText(text);
    toast.success(label);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!device) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <Router className="mx-auto h-12 w-12 text-slate-300" />
        <p className="mt-3 font-medium text-slate-900">Device not found</p>
        <button onClick={() => navigate('/devices/mikrotik')} className="mt-4 text-sm font-semibold text-emerald-600 hover:text-emerald-700">
          ← Back to devices
        </button>
      </div>
    );
  }

  const status = device.device_status || 'offline';
  const isOnline = status === 'online';
  const configured = !!device.service_config;
  const svc = device.service_config || {};
  const svcList = Array.isArray(svc.services) ? svc.services : [];
  const hotspotOn = svc.hotspot === true || svcList.includes('Hotspot');
  const pppoeOn = svc.pppoe === true || svcList.includes('PPPoE');
  const vpnOn = !!(device.management_wg_enabled && device.management_wg_ip);
  const wgHost = device.management_wg_ip ? String(device.management_wg_ip).split('/')[0] : device.device_ip;

  const memUsed = device.mem_total != null && device.mem_free != null ? device.mem_total - device.mem_free : null;
  const memPct = device.mem_total ? (memUsed / device.mem_total) * 100 : null;
  const hddUsed = device.hdd_total != null && device.hdd_free != null ? device.hdd_total - device.hdd_free : null;
  const hddPct = device.hdd_total ? (hddUsed / device.hdd_total) * 100 : null;
  const hasResources = device.cpu_load != null || device.mem_total || device.hdd_total;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate('/devices/mikrotik')} className="mt-1 text-slate-400 hover:text-slate-700">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <Router className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{device.device_name}</h1>
                <DeviceStatusBadge status={status} />
                {configured && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    <ShieldCheck className="h-3.5 w-3.5" /> Configured
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-sm text-slate-500">{device.device_ip}:{device.api_port}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={handleRefresh} disabled={syncing} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={() => navigate('/devices/mikrotik')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              <Pencil className="h-4 w-4" /> Edit
            </button>
            <button onClick={handleDelete} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Network} label="PPPoE Users" value={device.pppoe_users ?? 0} sub="active" tone="text-violet-500" />
          <StatCard icon={Wifi} label="Hotspot Users" value={device.client_count ?? 0} sub="active" tone="text-emerald-500" />
          <StatCard icon={Clock} label="Uptime" value={uptimeLabel(device.uptime)} tone="text-amber-500" />
          <StatCard icon={AlertTriangle} label="Downtime (month)" value="None" tone="text-slate-400" />
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                tab === t.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ---- Overview ---- */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Router Details */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-base font-semibold text-slate-900">Router Details</h3>
              <div className="divide-y divide-slate-100">
                <DetailRow label="Identity" value={device.device_name} />
                <DetailRow label="RouterOS Version" value={device.os_version} mono />
                <DetailRow label="Board" value={device.device_model} />
                <DetailRow label="IP Address" value={device.device_ip} mono />
                <DetailRow label="API Port" value={device.api_port} mono />
                <DetailRow label="Last Seen" value={device.last_synced ? formatDate(device.last_synced) : 'Never'} />
                <DetailRow label="Created" value={device.created_at ? formatDate(device.created_at) : '—'} />
              </div>
            </div>

            {/* Services Status */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-2 text-base font-semibold text-slate-900">Services Status</h3>
              <div className="divide-y divide-slate-100">
                <ServiceRow icon={Wifi} name="Hotspot" ok={hotspotOn} />
                <ServiceRow icon={Network} name="PPPoE Server" ok={pppoeOn} />
                <ServiceRow icon={ShieldCheck} name="VPN Tunnel" sub={vpnOn ? `VPN IP: ${wgHost}` : undefined} ok={vpnOn} />
                <ServiceRow icon={Server} name="RADIUS" sub={vpnOn ? 'Linked to VPN tunnel' : undefined} ok={!!device.management_wg_enabled} />
              </div>
            </div>

            {/* Resource Usage */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-base font-semibold text-slate-900">Resource Usage</h3>
              {hasResources ? (
                <div className="space-y-4">
                  <ResourceRow icon={Cpu} label="CPU Load" pct={device.cpu_load} right={device.cpu_load != null ? `${Math.round(device.cpu_load)}%` : '—'} />
                  <ResourceRow icon={MemoryStick} label="Memory" pct={memPct} right={device.mem_total ? `${fmtBytes(memUsed)} / ${fmtBytes(device.mem_total)}` : '—'} />
                  <ResourceRow icon={HardDrive} label="Storage" pct={hddPct} right={device.hdd_total ? `${fmtBytes(hddUsed)} / ${fmtBytes(device.hdd_total)}` : '—'} />
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-slate-400">
                  <Activity className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  Resource data appears after the next successful sync.
                </div>
              )}
            </div>

            {/* WebFig Remote Access */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Globe className="h-5 w-5 text-slate-400" />
                <h3 className="text-base font-semibold text-slate-900">WebFig Remote Access</h3>
              </div>
              {device.management_wg_enabled && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  Reachable only over the platform WireGuard VPN — connect to the tunnel first.
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Host / IP</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-slate-50 px-2 py-1 font-mono text-sm text-slate-700">{wgHost}<span className="text-slate-400"> :80</span></code>
                    <button onClick={() => copy(wgHost, 'Host copied')} className="text-slate-400 hover:text-slate-600"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Username</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-slate-50 px-2 py-1 font-mono text-sm text-slate-700">{device.username}</code>
                    <button onClick={() => copy(device.username, 'Username copied')} className="text-slate-400 hover:text-slate-600"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Password</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="rounded bg-slate-50 px-2 py-1 font-mono text-sm text-slate-500">{showPw ? '(set at provisioning)' : '••••••••'}</code>
                    <button onClick={() => setShowPw((s) => !s)} className="text-slate-400 hover:text-slate-600">{showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                  </div>
                </div>
                <a href={`http://${wgHost}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
                  <ExternalLink className="h-4 w-4" /> Open WebFig
                </a>
              </div>
            </div>

            {/* Remote Access (WireGuard) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-slate-400" />
                  <h3 className="text-base font-semibold text-slate-900">Remote Access (WireGuard tunnel)</h3>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${vpnOn ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${vpnOn ? 'bg-emerald-500' : 'bg-slate-300'}`} /> {vpnOn ? 'Active' : 'Not enabled'}
                </span>
              </div>
              {vpnOn ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Router VPN IP</p>
                      <code className="mt-1 block font-mono text-sm text-slate-800">{wgHost}</code>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tunnel</p>
                      <code className="mt-1 block font-mono text-sm text-slate-800">{device.management_wg_ip}</code>
                    </div>
                  </div>
                  <button
                    onClick={() => deviceService.downloadManagementTunnelScript(getAccessToken(), id, device.device_name).catch((e) => toast.error(e.message))}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <Download className="h-4 w-4" /> Download tunnel script
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">This device has no management WireGuard tunnel. Enable it from the device wizard to reach the router remotely.</p>
              )}
            </div>

            {/* Router Offline troubleshooting */}
            {!isOnline && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 lg:col-span-2">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="text-base font-semibold">Router Offline</h3>
                </div>
                <p className="mt-1 text-sm text-rose-700">Unable to connect to this router. Please check:</p>
                <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-rose-600">
                  <li>The router is powered on and connected to the network</li>
                  <li>The API service is enabled (IP → Services → api)</li>
                  <li>The API port ({device.api_port}) is not blocked by firewall</li>
                  <li>The credentials are correct</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ---- Resource History (empty state) ---- */}
        {tab === 'resources' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Resource History</h3>
            <p className="text-sm text-slate-500">Last 4 hours · polled every 5 minutes</p>
            <div className="flex flex-col items-center py-16 text-center">
              <Cpu className="h-10 w-10 text-slate-200" />
              <p className="mt-3 text-sm font-medium text-slate-600">No resource history yet</p>
              <p className="text-xs text-slate-400">Data will appear after the first successful poll</p>
            </div>
          </div>
        )}

        {/* ---- Downtime History (empty state) ---- */}
        {tab === 'downtime' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Downtime History</h3>
                <p className="text-sm text-slate-500">Last 30 days</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total this month</p>
                <p className="font-semibold text-emerald-600">None</p>
              </div>
            </div>
            <div className="flex flex-col items-center py-16 text-center">
              <Clock className="h-10 w-10 text-slate-200" />
              <p className="mt-3 text-sm font-medium text-slate-600">No downtime recorded</p>
              <p className="text-xs text-slate-400">Outages will be logged here once monitoring records them</p>
            </div>
          </div>
        )}

        {/* ---- Configure Services ---- */}
        {tab === 'configure' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-semibold text-slate-900">Current Configuration</h3>
              </div>
              {configured ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-emerald-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700"><Wifi className="h-3.5 w-3.5" /> Hotspot</span>
                      <span className={`text-[10px] font-bold ${hotspotOn ? 'text-emerald-700' : 'text-slate-400'}`}>{hotspotOn ? 'ON' : 'OFF'}</span>
                    </div>
                    <p className="mt-1 font-mono text-sm text-slate-700">{(svc.bridge_ports || []).join(', ') || '—'}</p>
                    {svc.subnet && <p className="mt-0.5 font-mono text-xs text-slate-400">{svc.subnet}</p>}
                  </div>
                  <div className="rounded-xl bg-violet-50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-700"><Network className="h-3.5 w-3.5" /> PPPoE</span>
                      <span className={`text-[10px] font-bold ${pppoeOn ? 'text-violet-700' : 'text-slate-400'}`}>{pppoeOn ? 'ON' : 'OFF'}</span>
                    </div>
                    <p className="mt-1 font-mono text-sm text-slate-700">{(svc.bridge_ports || []).join(', ') || '—'}</p>
                    {svc.subnet && <p className="mt-0.5 font-mono text-xs text-slate-400">{svc.subnet}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No services configured yet. Use the wizard below to enable PPPoE and/or Hotspot.</p>
              )}
            </div>

            <ConfigureServicesPanel deviceId={id} initial={svc} onApplied={load} />
          </div>
        )}
      </div>
    </div>
  );
}
