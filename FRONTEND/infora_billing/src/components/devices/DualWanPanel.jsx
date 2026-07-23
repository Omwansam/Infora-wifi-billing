import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Network, Download, Play, Info, AlertTriangle, Power, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';

// The switch — each mode explains what it does (§15.5 of LOAD_BALANCING_FAILOVER.md).
const MODES = [
  { value: 'off', label: 'Off — single WAN', short: 'One uplink',
    blurb: 'One uplink, exactly as today. No dual-WAN routing is applied.' },
  { value: 'failover', label: 'Failover only', short: 'Hot standby',
    blurb: 'WAN2 is a hot standby — it only carries traffic when WAN1 is down. The moment WAN1 comes back, traffic returns to it automatically. No sharing, just protection.' },
  { value: 'load_balance', label: 'Load balance', short: 'Add up bandwidth',
    blurb: 'Both lines share traffic to add up bandwidth. Balancing is per-connection, so a payment / bank / HTTPS session never swaps line mid-stream. If one line drops, the other carries everyone at reduced speed. (One single download can’t exceed one line’s speed — many users is where it wins.)' },
  { value: 'app_steer', label: 'App steering', short: 'Named apps → WAN2',
    blurb: 'Named apps — WhatsApp, Facebook, Instagram (Meta’s network, matched by destination) — and any steered subscribers ride WAN2; everything else rides WAN1. If WAN2 drops, that traffic quietly rejoins WAN1 and nobody notices. Use it to send social traffic down a cheaper line.' },
];
const WAN_TYPES = [
  { value: 'dhcp', label: 'DHCP (auto gateway)' },
  { value: 'static', label: 'Static IP' },
  { value: 'pppoe', label: 'PPPoE dial-up' },
];

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30';

export default function DualWanPanel({ deviceId, device, onApplied }) {
  const initial = device?.wan_config || {};
  const [mode, setMode] = useState(initial.mode || 'off');
  const [wan1, setWan1] = useState({ port: 'ether1', type: 'dhcp', ip: '', gateway: '', weight: 1, ...(initial.wan1 || {}) });
  const [wan2, setWan2] = useState({ port: 'ether3', type: 'dhcp', ip: '', gateway: '', weight: 1, ...(initial.wan2 || {}) });
  const [primaryWan, setPrimaryWan] = useState(initial.primary_wan || 'wan1');
  const [probe1, setProbe1] = useState((initial.probe_hosts || [])[0] || '8.8.8.8');
  const [probe2, setProbe2] = useState((initial.probe_hosts || [])[1] || '1.0.0.1');
  const [subList, setSubList] = useState(initial.subscriber_list || 'ISP2-SUBS');
  const [pinMgmt, setPinMgmt] = useState(initial.pin_management_to || '');

  const [ifaces, setIfaces] = useState([]);
  const [busy, setBusy] = useState('');            // '', 'download', 'apply', 'disable'
  const [result, setResult] = useState(null);

  useEffect(() => {
    deviceService.getInterfaces(getAccessToken(), deviceId)
      .then((d) => setIfaces((d.interfaces || []).filter((i) => i.kind === 'ether')))
      .catch(() => {});
  }, [deviceId]);

  const modeMeta = MODES.find((m) => m.value === mode) || MODES[0];
  const isOn = mode !== 'off';

  // Warn if the chosen WAN2 port is currently a LAN bridge port (service_config).
  const wan2LanWarning = useMemo(() => {
    const roles = device?.service_config?.port_roles || {};
    const role = roles[wan2.port];
    return isOn && role && role !== 'skip'
      ? `${wan2.port} is currently a LAN port (${role}). Using it as WAN2 removes it from the bridge — that downstream port goes away.`
      : null;
  }, [device, wan2.port, isOn]);

  const buildConfig = () => ({
    mode,
    wan1: { port: wan1.port, type: wan1.type, weight: Number(wan1.weight) || 1, ...(wan1.type === 'static' ? { ip: wan1.ip, gateway: wan1.gateway } : {}) },
    wan2: { port: wan2.port, type: wan2.type, weight: Number(wan2.weight) || 1, ...(wan2.type === 'static' ? { ip: wan2.ip, gateway: wan2.gateway } : {}) },
    primary_wan: primaryWan,
    probe_hosts: [probe1, probe2],
    subscriber_list: subList,
    pin_management_to: pinMgmt || null,
  });

  const download = async () => {
    setBusy('download');
    try {
      const res = await deviceService.loadBalancingScript(getAccessToken(), deviceId, buildConfig());
      deviceService.downloadRsc(res.script, `infora-dualwan-${(device?.device_name || 'router').replace(/\s+/g, '-')}-${mode}.rsc`);
      toast.success('.rsc downloaded — paste it in the router terminal');
    } catch (e) {
      toast.error(e.message || 'Could not generate the script');
    } finally { setBusy(''); }
  };

  const apply = async () => {
    setBusy('apply'); setResult(null);
    try {
      const res = await deviceService.configureLoadBalancing(getAccessToken(), deviceId, buildConfig(), true);
      setResult(res);
      if (res.applied) { toast.success('Dual-WAN applied to the router'); onApplied?.(); }
      else toast.error('Applied with errors — see the log');
    } catch (e) {
      toast.error(e.message || 'Apply failed');
    } finally { setBusy(''); }
  };

  const disable = async () => {
    setBusy('disable'); setResult(null);
    try {
      const res = await deviceService.disableLoadBalancing(getAccessToken(), deviceId, true);
      setResult(res);
      if (res.applied) { toast.success('Dual-WAN removed — back to single WAN'); setMode('off'); onApplied?.(); }
      else toast.error('Disable ran with errors — see the log');
    } catch (e) {
      toast.error(e.message || 'Disable failed');
    } finally { setBusy(''); }
  };

  const portOptions = ifaces.length
    ? ifaces.map((i) => i.name)
    : ['ether1', 'ether2', 'ether3', 'ether4', 'ether5'];

  const WanCard = ({ title, wan, set, badge }) => (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 items-center rounded-md bg-slate-100 px-2 text-[11px] font-bold text-slate-600">{badge}</span>
        <span className="text-sm font-semibold text-slate-800">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Port">
          <select value={wan.port} onChange={(e) => set({ ...wan, port: e.target.value })} className={inputCls}>
            {portOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select value={wan.type} onChange={(e) => set({ ...wan, type: e.target.value })} className={inputCls}>
            {WAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        {wan.type === 'static' && (
          <>
            <Field label="IP / CIDR"><input value={wan.ip} onChange={(e) => set({ ...wan, ip: e.target.value })} placeholder="100.64.0.2/30" className={`${inputCls} font-mono`} /></Field>
            <Field label="Gateway"><input value={wan.gateway} onChange={(e) => set({ ...wan, gateway: e.target.value })} placeholder="100.64.0.1" className={`${inputCls} font-mono`} /></Field>
          </>
        )}
        {mode === 'load_balance' && (
          <Field label="Weight" hint="Higher = more traffic (e.g. 30M:10M → 3 and 1)">
            <input type="number" min="1" value={wan.weight} onChange={(e) => set({ ...wan, weight: e.target.value })} className={inputCls} />
          </Field>
        )}
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Dual-WAN — Load balancing & failover</h3>
        {initial.mode && initial.mode !== 'off' && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">Currently: {initial.mode.replace('_', ' ')}</span>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500">Two uplinks that share load and cover for each other. Pick a method — the router config is generated for you.</p>

      {/* The switch */}
      <Field label="Method">
        <select value={mode} onChange={(e) => { setMode(e.target.value); setResult(null); }} className={`${inputCls} font-medium`}>
          {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </Field>
      <div className="mt-3 flex gap-2 rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-sm text-indigo-900">
        <Info className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
        <span>{modeMeta.blurb}</span>
      </div>

      {isOn && (
        <>
          {wan2LanWarning && (
            <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> <span>{wan2LanWarning} Run <strong>Configure services</strong> first so the LAN bridge exists, then apply dual-WAN.</span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <WanCard title="WAN 1 (primary line)" wan={wan1} set={setWan1} badge="WAN1" />
            <WanCard title="WAN 2 (second line)" wan={wan2} set={setWan2} badge="WAN2" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Primary WAN" hint="Which line router traffic prefers">
              <select value={primaryWan} onChange={(e) => setPrimaryWan(e.target.value)} className={inputCls}>
                <option value="wan1">WAN1</option>
                <option value="wan2">WAN2</option>
              </select>
            </Field>
            <Field label="WAN1 probe host" hint="Canary IP tested via WAN1">
              <input value={probe1} onChange={(e) => setProbe1(e.target.value)} className={`${inputCls} font-mono`} />
            </Field>
            <Field label="WAN2 probe host" hint="Canary IP tested via WAN2">
              <input value={probe2} onChange={(e) => setProbe2(e.target.value)} className={`${inputCls} font-mono`} />
            </Field>
            <Field label="Pin billing tunnel" hint="Keep RADIUS/mgmt on one line (optional)">
              <select value={pinMgmt} onChange={(e) => setPinMgmt(e.target.value)} className={inputCls}>
                <option value="">Ride failover (default)</option>
                <option value="wan1">Pin to WAN1</option>
                <option value="wan2">Pin to WAN2</option>
              </select>
            </Field>
          </div>

          {mode === 'app_steer' && (
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <Field label="Subscriber steer list" hint="Router address-list RADIUS can fill per customer to push a whole subscriber to WAN2. Meta’s app ranges are added automatically.">
                <input value={subList} onChange={(e) => setSubList(e.target.value)} className={`${inputCls} font-mono max-w-xs`} />
              </Field>
            </div>
          )}
        </>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
        <button
          onClick={disable}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-rose-600 hover:text-rose-700 disabled:opacity-50"
          title="Remove all dual-WAN config from the router"
        >
          {busy === 'disable' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
          Disable on router
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={download}
            disabled={!!busy || !isOn}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download .rsc
          </button>
          <button
            onClick={apply}
            disabled={!!busy || !isOn}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            title="Push over the management tunnel"
          >
            {busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Apply now
          </button>
        </div>
      </div>

      {result?.log && (
        <div className="mt-4 max-h-56 space-y-1 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px]">
          {result.log.map((e, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className={e.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'}>{e.status === 'ok' ? '✓' : '✗'}</span>
              <span className={e.status === 'ok' ? 'text-slate-300' : 'text-rose-300'}>
                <span className="text-slate-500">[{e.step}]</span> {e.detail}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
