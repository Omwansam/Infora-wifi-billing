import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertTriangle, ArrowLeft, Clock, Power, RefreshCw, RotateCcw, Save, Signal, Wifi,
} from 'lucide-react';

import PageShell from '../layout/PageShell';
import cpeService from '../../services/cpeService';
import { getAccessToken } from '../../utils/authToken';
import { useConfirm } from '../../contexts/ConfirmContext';

const TASK_TONE = {
  queued: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  done: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
};

const OPTICAL_HELP = {
  good: 'Healthy signal.',
  marginal: 'Signal is weak — schedule a check before it fails.',
  critical: 'Signal is failing. Check the fibre run and clean the connectors.',
  too_strong: 'Signal is too strong — the ONT may be too close to the splitter.',
};

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-slate-900 dark:text-white">{value || '—'}</dd>
    </div>
  );
}

export default function CpeDetailPage() {
  const { id } = useParams();
  const confirm = useConfirm();
  const [device, setDevice] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [wifi, setWifi] = useState({ wifi_ssid: '', wifi_password: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      const [detail, taskList] = await Promise.all([
        cpeService.getCpe(token, id),
        cpeService.listTasks(token, id),
      ]);
      setDevice(detail);
      setTasks(taskList?.tasks || []);
      setWifi({ wifi_ssid: detail?.ssid || '', wifi_password: '' });
    } catch (error) {
      toast.error(error.message || 'Failed to load CPE');
      setDevice(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Every action below queues work. The toast deliberately repeats the backend's
  // delivery note instead of saying "done" — nothing has been applied yet.
  const runAction = async (fn, fallbackMessage) => {
    setBusy(true);
    try {
      const result = await fn(getAccessToken());
      toast.success(result?.delivery?.note || fallbackMessage);
      await load();
    } catch (error) {
      toast.error(error.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveWifi = () => {
    const fields = {};
    if (wifi.wifi_ssid && wifi.wifi_ssid !== device.ssid) fields.wifi_ssid = wifi.wifi_ssid;
    if (wifi.wifi_password) fields.wifi_password = wifi.wifi_password;
    if (Object.keys(fields).length === 0) {
      toast('Nothing changed');
      return;
    }
    runAction((t) => cpeService.setSettings(t, id, fields), 'WiFi change queued');
  };

  const handleReboot = async () => {
    const ok = await confirm({
      title: 'Reboot this CPE?',
      message: `${device.serial_number} will restart, dropping the subscriber's connection for a minute or two. It applies the next time the device checks in.`,
      confirmText: 'Queue reboot',
    });
    if (ok) runAction((t) => cpeService.rebootCpe(t, id), 'Reboot queued');
  };

  const handleFactoryReset = async () => {
    const ok = await confirm({
      title: 'Factory reset this CPE?',
      message: `${device.serial_number} will be wiped to defaults. On many models this also clears the ACS URL, which can strand the device until someone visits the premises. This cannot be undone.`,
      confirmText: 'Queue factory reset',
      destructive: true,
    });
    if (ok) {
      runAction((t) => cpeService.factoryResetCpe(t, id, device.serial_number),
        'Factory reset queued');
    }
  };

  if (loading) return <PageShell><div className="py-16 text-center text-slate-500">Loading…</div></PageShell>;
  if (!device) return <PageShell><div className="py-16 text-center text-slate-500">CPE not found.</div></PageShell>;

  const supported = device.profile?.supported_fields || [];
  const canSetWifi = supported.includes('wifi_ssid') || supported.includes('wifi_password');
  const pendingTasks = tasks.filter((t) => ['queued', 'sent'].includes(t.status)).length;

  return (
    <PageShell>
      <Link to="/devices/cpe" className="mb-4 inline-flex items-center text-sm text-slate-500 hover:text-orange-600">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to CPE
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {device.serial_number || device.serial_key}
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            {device.manufacturer} {device.product_class} · {device.profile?.label || 'Unknown profile'}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
              device.online ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${device.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {device.online ? 'Online' : 'Offline'}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
              {device.status}
            </span>
            {device.customer_id && (
              <Link to={`/clients/${device.customer_id}`} className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 hover:bg-blue-200">
                {device.customer_name}
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runAction((t) => cpeService.refreshCpe(t, id), 'Refresh queued')}
            disabled={busy || device.status !== 'active'}
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleReboot}
            disabled={busy || device.status !== 'active'}
            className="inline-flex items-center rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            <Power className="mr-2 h-4 w-4" /> Reboot
          </button>
          <button
            onClick={handleFactoryReset}
            disabled={busy || device.status !== 'active'}
            className="inline-flex items-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Factory reset
          </button>
        </div>
      </div>

      {pendingTasks > 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div className="text-sm text-blue-900 dark:text-blue-200">
            <p className="font-semibold">{pendingTasks} change{pendingTasks === 1 ? '' : 's'} waiting to be delivered</p>
            <p className="mt-0.5">
              The ACS cannot reach a CPE on demand — queued work is handed over the next time
              this device checks in (every {device.periodic_inform_interval}s).
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Optical — the diagnostic that matters most on FTTH */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Signal className="h-4 w-4 text-orange-600" /> Optical signal
            </h2>
            {device.rx_power_dbm === null || device.rx_power_dbm === undefined ? (
              <p className="text-sm text-slate-500">
                No optical reading. This device either is not a GPON ONT, or its profile
                does not expose optical power.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Receive (Rx)</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{device.rx_power_dbm} <span className="text-lg">dBm</span></p>
                </div>
                {device.tx_power_dbm !== null && device.tx_power_dbm !== undefined && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Transmit (Tx)</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{device.tx_power_dbm} <span className="text-lg">dBm</span></p>
                  </div>
                )}
                <div className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                  device.optical_health === 'good'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-amber-50 text-amber-800'}`}>
                  {device.optical_health !== 'good' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{OPTICAL_HELP[device.optical_health] || ''}</span>
                </div>
              </div>
            )}
          </section>

          {/* WiFi control */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Wifi className="h-4 w-4 text-orange-600" /> WiFi
            </h2>
            {!canSetWifi ? (
              <p className="text-sm text-slate-500">
                This device&apos;s profile ({device.profile?.label}) does not expose WiFi settings.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Network name (SSID)</label>
                  <input
                    value={wifi.wifi_ssid}
                    onChange={(e) => setWifi((w) => ({ ...w, wifi_ssid: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    New password <span className="font-normal text-slate-400">(leave blank to keep)</span>
                  </label>
                  <input
                    type="password"
                    value={wifi.wifi_password}
                    onChange={(e) => setWifi((w) => ({ ...w, wifi_password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <button
                  onClick={handleSaveWifi}
                  disabled={busy || device.status !== 'active'}
                  className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  <Save className="mr-2 h-4 w-4" /> Queue WiFi change
                </button>
              </div>
            )}
          </section>

          {/* Task history */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Task history</h2>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-500">No tasks yet.</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 15).map((task) => (
                  <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-900 dark:text-white">{task.kind.replace(/_/g, ' ')}</span>
                      {task.fault_string && (
                        <p className="truncate text-xs text-red-600">{task.fault_string}</p>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TASK_TONE[task.status] || TASK_TONE.queued}`}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Device</h2>
            <dl className="space-y-3">
              <Field label="Serial" value={device.serial_number} />
              <Field label="OUI" value={device.oui} />
              <Field label="Product class" value={device.product_class} />
              <Field label="Software" value={device.software_version} />
              <Field label="Hardware" value={device.hardware_version} />
              <Field label="Data model" value={device.data_model_root} />
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Connection</h2>
            <dl className="space-y-3">
              <Field label="WAN IP" value={device.wan_ip} />
              <Field label="Source IP" value={device.peer_ip} />
              <Field label="PPPoE login" value={device.pppoe_username} />
              <Field label="Connected clients" value={device.connected_clients} />
              <Field label="Informs seen" value={device.inform_count} />
              <Field label="Last event" value={device.last_inform_event} />
            </dl>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
