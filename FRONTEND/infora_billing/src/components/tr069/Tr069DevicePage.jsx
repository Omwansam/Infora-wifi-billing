import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Activity, AlertTriangle, Ban, Clock, Cpu, Gauge, ListTree, Loader2, Power,
  RefreshCw, RotateCcw, Save, Search, Terminal, Users, Wifi,
} from 'lucide-react';

import PageShell from '../layout/PageShell';
import Tr069Layout from './Tr069Layout';
import {
  OpticalGauge, OPTICAL_HELP, OPTICAL_TONE, absoluteTime, formatUptime, relativeTime,
} from './tr069Meta';
import cpeService from '../../services/cpeService';
import { getAccessToken } from '../../utils/authToken';
import { useConfirm } from '../../contexts/ConfirmContext';
import TablePagination from '../ui/TablePagination';
import { useClientPagination } from '../../hooks/usePagination';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Gauge },
  { key: 'wifi', label: 'WiFi', icon: Wifi },
  { key: 'tasks', label: 'Tasks', icon: Clock },
  { key: 'sessions', label: 'Sessions', icon: Terminal },
  { key: 'parameters', label: 'Parameters', icon: ListTree },
];

const TASK_TONE = {
  queued: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  expired: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
};

const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

function Card({ title, icon: Icon, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {title && (
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          {Icon && <Icon className="h-4 w-4 text-indigo-500" />}
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function Field({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 truncate text-sm text-slate-900 dark:text-white ${mono ? 'font-mono' : ''}`}>
        {value === null || value === undefined || value === '' ? '—' : value}
      </dd>
    </div>
  );
}

export default function Tr069DevicePage() {
  const { id } = useParams();
  const confirm = useConfirm();
  const [device, setDevice] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [sessions, setSessions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('overview');
  const [wifi, setWifi] = useState({ wifi_ssid: '', wifi_password: '' });
  const [paramFilter, setParamFilter] = useState('');

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
      toast.error(error.message || 'Failed to load this CPE');
      setDevice(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Session history is only worth a request when someone opens that tab.
  useEffect(() => {
    if (tab !== 'sessions' || sessions !== null) return;
    cpeService.listSessions(getAccessToken(), id)
      .then((data) => setSessions(data?.sessions || []))
      .catch((error) => {
        toast.error(error.message || 'Failed to load sessions');
        setSessions([]);
      });
  }, [tab, sessions, id]);

  // Every write below queues work. The toast repeats the backend's delivery
  // note rather than claiming success — nothing is applied until the CPE calls in.
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
      runAction((t) => cpeService.factoryResetCpe(t, id, device.serial_number), 'Factory reset queued');
    }
  };

  const handleCancelTask = async (task) => {
    try {
      setBusy(true);
      await cpeService.cancelTask(getAccessToken(), task.id);
      toast.success('Task cancelled');
      const taskList = await cpeService.listTasks(getAccessToken(), id);
      setTasks(taskList?.tasks || []);
    } catch (error) {
      toast.error(error.message || 'Could not cancel the task');
    } finally {
      setBusy(false);
    }
  };

  const parameters = useMemo(() => {
    const entries = Object.entries(device?.parameters || {});
    const needle = paramFilter.trim().toLowerCase();
    return entries
      .filter(([key, value]) => !needle || key.toLowerCase().includes(needle) || String(value).toLowerCase().includes(needle))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [device, paramFilter]);

  // Both pagers have to sit above the loading early-return below.
  const sessionPager = useClientPagination(sessions, {
    storageKey: 'tr069-sessions',
    defaultPageSize: 25,
  });
  const paramPager = useClientPagination(parameters, {
    storageKey: 'tr069-parameters',
    defaultPageSize: 50,
    resetOn: [paramFilter],
  });

  const pendingTasks = tasks.filter((t) => ['queued', 'sent'].includes(t.status)).length;

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading device…
        </div>
      </PageShell>
    );
  }

  if (!device) {
    return (
      <PageShell>
        <div className="py-20 text-center">
          <Cpu className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">CPE not found</p>
          <Link to="/tr069" className="mt-2 inline-block text-sm text-indigo-600 hover:underline">Back to the ACS</Link>
        </div>
      </PageShell>
    );
  }

  const supported = device.profile?.supported_fields || [];
  const canSetWifi = supported.includes('wifi_ssid') || supported.includes('wifi_password');
  const inactive = device.status !== 'active';
  const opticalTone = OPTICAL_TONE[device.optical_health] || OPTICAL_TONE.good;

  return (
    <Tr069Layout
      backTo="/tr069"
      backLabel="All CPE"
      title={device.serial_number || device.serial_key}
      subtitle={`${device.manufacturer || 'Unknown vendor'} ${device.product_class || ''} · ${device.profile?.label || 'no matching profile'}`}
      chips={[
        { value: device.online ? 'Online' : 'Offline', label: '', icon: Activity, tone: device.online ? 'text-emerald-400' : 'text-slate-500' },
        { value: device.status, label: '', icon: Cpu },
        { value: `${device.periodic_inform_interval}s`, label: 'inform interval', icon: Clock, tone: 'text-cyan-300' },
        ...(device.customer_name ? [{ value: device.customer_name, label: '', icon: Users }] : []),
      ]}
      action={(
        <>
          <button
            onClick={() => runAction((t) => cpeService.refreshCpe(t, id), 'Refresh queued')}
            disabled={busy || inactive}
            className="inline-flex items-center rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/15 hover:bg-white/20 disabled:opacity-40"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleReboot}
            disabled={busy || inactive}
            className="inline-flex items-center rounded-lg bg-amber-500/15 px-3 py-2 text-sm font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-500/25 disabled:opacity-40"
          >
            <Power className="mr-2 h-4 w-4" /> Reboot
          </button>
          <button
            onClick={handleFactoryReset}
            disabled={busy || inactive}
            className="inline-flex items-center rounded-lg bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-200 ring-1 ring-inset ring-red-400/30 hover:bg-red-500/25 disabled:opacity-40"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Factory reset
          </button>
        </>
      )}
    >
      {pendingTasks > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div className="text-sm text-blue-900 dark:text-blue-200">
            <p className="font-semibold">{pendingTasks} change{pendingTasks === 1 ? '' : 's'} waiting to be delivered</p>
            <p className="mt-0.5">
              The ACS cannot reach a CPE on demand — queued work is handed over the next time this
              device checks in (every {device.periodic_inform_interval}s).
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 scrollbar-none dark:border-slate-800 dark:bg-slate-900">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.key === 'tasks' && pendingTasks > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${tab === t.key ? 'bg-white/20' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'}`}>
                {pendingTasks}
              </span>
            )}
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        {tab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-3">
            <Card title="Optical receive power" icon={Gauge} className="lg:col-span-2">
              {device.rx_power_dbm === null || device.rx_power_dbm === undefined ? (
                <p className="text-sm text-slate-500">
                  No optical reading. This device either is not a GPON ONT, or its profile does not
                  expose optical power.
                </p>
              ) : (
                <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end">
                  <div className="flex flex-col items-center">
                    <OpticalGauge dbm={device.rx_power_dbm} health={device.optical_health} />
                    <p className={`font-mono text-3xl font-bold tabular-nums ${opticalTone.text}`}>{device.rx_power_dbm}</p>
                    <p className="text-xs text-slate-400">dBm received</p>
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${opticalTone.chip}`}>
                      {device.optical_health !== 'good' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                      <span>{OPTICAL_HELP[device.optical_health] || ''}</span>
                    </div>
                    {device.tx_power_dbm !== null && device.tx_power_dbm !== undefined && (
                      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">Transmit (Tx)</p>
                        <p className="font-mono text-xl font-bold text-slate-900 dark:text-white">{device.tx_power_dbm} dBm</p>
                      </div>
                    )}
                    {device.parameters_at && (
                      <p className="text-xs text-slate-400">Read {relativeTime(device.parameters_at)}</p>
                    )}
                  </div>
                </div>
              )}
            </Card>

            <Card title="Live" icon={Activity}>
              <dl className="space-y-3">
                <Field label="Uptime" value={formatUptime(device.uptime_seconds)} />
                <Field label="Connected clients" value={device.connected_clients} />
                <Field label="Last inform" value={`${relativeTime(device.last_inform_at)}`} />
                <Field label="Last event" value={device.last_inform_event} mono />
                <Field label="Informs seen" value={device.inform_count} />
                <Field label="Last boot" value={device.last_boot_at ? relativeTime(device.last_boot_at) : '—'} />
              </dl>
            </Card>

            <Card title="Identity" icon={Cpu} className="lg:col-span-2">
              <dl className="grid gap-4 sm:grid-cols-3">
                <Field label="Serial" value={device.serial_number} mono />
                <Field label="OUI" value={device.oui} mono />
                <Field label="Product class" value={device.product_class} />
                <Field label="Manufacturer" value={device.manufacturer} />
                <Field label="Software" value={device.software_version} mono />
                <Field label="Hardware" value={device.hardware_version} mono />
                <Field label="Data model" value={device.data_model_root} mono />
                <Field label="Profile" value={device.profile?.label} />
                <Field label="Enrolled" value={absoluteTime(device.created_at)} />
              </dl>
            </Card>

            <Card title="Connection" icon={Wifi}>
              <dl className="space-y-3">
                <Field label="WAN IP" value={device.wan_ip} mono />
                <Field label="Source IP" value={device.peer_ip} mono />
                <Field label="PPPoE login" value={device.pppoe_username} mono />
                <Field label="SSID" value={device.ssid} />
                <Field
                  label="Subscriber"
                  value={device.customer_id ? (
                    <Link to={`/clients/${device.customer_id}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
                      {device.customer_name}
                    </Link>
                  ) : 'Unlinked'}
                />
              </dl>
            </Card>
          </div>
        )}

        {tab === 'wifi' && (
          <Card title="WiFi" icon={Wifi} className="max-w-2xl">
            {!canSetWifi ? (
              <p className="text-sm text-slate-500">
                This device&apos;s profile ({device.profile?.label || 'unknown'}) does not expose WiFi settings.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Network name (SSID)
                  </label>
                  <input
                    value={wifi.wifi_ssid}
                    onChange={(e) => setWifi((w) => ({ ...w, wifi_ssid: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    New password <span className="font-normal normal-case tracking-normal text-slate-400">(leave blank to keep)</span>
                  </label>
                  <input
                    type="password"
                    value={wifi.wifi_password}
                    onChange={(e) => setWifi((w) => ({ ...w, wifi_password: e.target.value }))}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveWifi}
                    disabled={busy || inactive}
                    className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Save className="mr-2 h-4 w-4" /> Queue WiFi change
                  </button>
                  <p className="text-xs text-slate-400">
                    Delivered on the next inform, in about {device.periodic_inform_interval}s.
                  </p>
                </div>
                <p className="border-t border-slate-100 pt-3 text-xs text-slate-400 dark:border-slate-800">
                  This profile can control: {supported.join(', ')}
                </p>
              </div>
            )}
          </Card>
        )}

        {tab === 'tasks' && (
          <Card title="Task queue" icon={Clock}>
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-500">No tasks have been queued for this device.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TASK_TONE[task.status] || TASK_TONE.queued}`}>
                      {task.status}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium capitalize text-slate-900 dark:text-white">
                        {task.kind.replace(/_/g, ' ')}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        Queued {relativeTime(task.created_at)}
                        {task.delivered_at && ` · delivered ${relativeTime(task.delivered_at)}`}
                        {task.attempts > 1 && ` · ${task.attempts} attempts`}
                      </p>
                      {task.fault_string && (
                        <p className="truncate text-xs text-red-600 dark:text-red-400">
                          {task.fault_code ? `${task.fault_code}: ` : ''}{task.fault_string}
                        </p>
                      )}
                    </div>
                    {['queued', 'sent'].includes(task.status) && (
                      <button
                        onClick={() => handleCancelTask(task)}
                        disabled={busy}
                        className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                      >
                        <Ban className="mr-1 h-3.5 w-3.5" /> Cancel
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {tab === 'sessions' && (
          <Card title="CWMP sessions" icon={Terminal}>
            <p className="mb-4 text-xs text-slate-500">
              Each row is a session the device opened against the ACS — the only window in which
              queued work can be delivered.
            </p>
            {sessions === null ? (
              <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading sessions…
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-slate-500">This device has not opened a session yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                    <tr>
                      <th className="py-2 pr-4">Started</th>
                      <th className="py-2 pr-4">Source IP</th>
                      <th className="py-2 pr-4">Events</th>
                      <th className="py-2 pr-4 text-right">RPCs</th>
                      <th className="py-2 pr-4 text-right">Faults</th>
                      <th className="py-2 text-right">Ended</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sessionPager.pageItems.map((session) => (
                      <tr key={session.id}>
                        <td className="py-2 pr-4 text-slate-900 dark:text-white" title={absoluteTime(session.started_at)}>
                          {relativeTime(session.started_at)}
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs text-slate-600 dark:text-slate-400">{session.peer_ip || '—'}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-slate-600 dark:text-slate-400">{session.events || '—'}</td>
                        <td className="py-2 pr-4 text-right tabular-nums text-slate-600 dark:text-slate-400">{session.rpc_count}</td>
                        <td className={`py-2 pr-4 text-right tabular-nums ${session.fault_count > 0 ? 'font-semibold text-red-600' : 'text-slate-600 dark:text-slate-400'}`}>
                          {session.fault_count}
                        </td>
                        <td className="py-2 text-right text-xs text-slate-500">
                          {session.ended_at ? relativeTime(session.ended_at) : 'open'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <TablePagination {...sessionPager.paginationProps} noun="session" divider={false} className="px-0" />
          </Card>
        )}

        {tab === 'parameters' && (
          <Card title="Last parameter read" icon={ListTree}>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative sm:w-80">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={paramFilter}
                  onChange={(e) => setParamFilter(e.target.value)}
                  placeholder="Filter parameters…"
                  className={`${inputCls} pl-9`}
                />
              </div>
              <p className="text-xs text-slate-400">
                {device.parameters_at ? `Read ${relativeTime(device.parameters_at)}` : 'Never read'}
              </p>
            </div>
            {parameters.length === 0 ? (
              <p className="text-sm text-slate-500">
                {Object.keys(device.parameters || {}).length === 0
                  ? 'No parameters stored yet — queue a refresh and they appear after the next inform.'
                  : 'Nothing matches that filter.'}
              </p>
            ) : (
              <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-100 dark:border-slate-800">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paramPager.pageItems.map(([key, value]) => (
                      <tr key={key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="w-1/2 break-all px-3 py-2 font-mono text-slate-500">{key}</td>
                        <td className="break-all px-3 py-2 font-mono text-slate-900 dark:text-white">{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <TablePagination {...paramPager.paginationProps} noun="parameter" divider={false} className="px-0" />
          </Card>
        )}
      </motion.div>
    </Tr069Layout>
  );
}
