import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2, Download, Play, Info, AlertTriangle, Power, RotateCcw,
  CheckCircle2, Plus, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';

// The switch — each mode explains what it does (§15.5 of LOAD_BALANCING_FAILOVER.md).
const MODES = [
  { value: 'off', label: 'Off — single WAN', short: 'One uplink',
    blurb: 'One uplink, exactly as today. No multi-WAN routing is applied.' },
  { value: 'failover', label: 'Failover only', short: 'Hot standby',
    blurb: 'The standby lines are hot spares — they only carry traffic when the line above them is down. The moment it comes back, traffic returns to it automatically. No sharing, just protection.' },
  { value: 'load_balance', label: 'Load balance', short: 'Add up bandwidth',
    blurb: 'Every line shares traffic to add up bandwidth. Balancing is per-connection, so a payment / bank / HTTPS session never swaps line mid-stream. If one line drops, the rest carry everyone at reduced speed. (One single download can’t exceed one line’s speed — many users is where it wins.)' },
  { value: 'app_steer', label: 'App steering', short: 'Named apps → second line',
    blurb: 'Named apps — WhatsApp, Facebook, Instagram (Meta’s network, matched by destination) — and any steered subscribers ride the non-primary lines; everything else rides the primary. If a steer line drops, that traffic quietly rejoins the primary and nobody notices. Use it to send social traffic down a cheaper line.' },
];
const WAN_TYPES = [
  { value: 'dhcp', label: 'DHCP (auto gateway)' },
  { value: 'static', label: 'Static IP' },
  { value: 'pppoe', label: 'PPPoE dial-up' },
];

// Both mirror services/load_balancing.py. Past MAX_LINES the ceiling is the
// router, not the software: PCC forces FastTrack off, so every packet takes the
// firewall path and CPU becomes the limit.
const MAX_LINES = 5;
const MIN_LINES = 2;
// One per line, and they must differ — the router judges each line's health by
// whether that line's own probe answers.
const DEFAULT_PROBES = ['8.8.8.8', '1.0.0.1', '9.9.9.9', '208.67.222.222', '64.6.64.6'];
const FALLBACK_PORTS = ['ether1', 'ether2', 'ether3', 'ether4', 'ether5'];

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

const blankLine = (id, overrides = {}) => ({
  id,
  label: '',
  port: '',
  type: 'dhcp',
  ip: '',
  gateway: '',
  weight: 1,
  probe: '',
  ...overrides,
});

/** The two lines a router starts with when nothing is stored yet. */
const starterLines = () => [
  blankLine('wan1', { port: 'ether1', probe: DEFAULT_PROBES[0] }),
  blankLine('wan2', { port: 'ether3', probe: DEFAULT_PROBES[1] }),
];

/**
 * The editable lines held in a stored wan_config, or null if it carries none.
 *
 * Two shapes reach us and both have to keep working: `lines` from anything
 * applied since the multi-line change, and `wan1`/`wan2` + positional
 * `probe_hosts` from every router configured before it. Nothing rewrites a
 * stored config, so a device keeps the shape it was saved with until its next
 * successful apply — the legacy branch is permanent, not a migration window.
 */
function linesFromConfig(config) {
  if (Array.isArray(config?.lines) && config.lines.length) {
    return config.lines.map((line, index) => blankLine(line.id || `wan${index + 1}`, {
      ...line,
      label: line.label || '',
      ip: line.ip || '',
      gateway: line.gateway || '',
      probe: line.probe || DEFAULT_PROBES[index] || '',
    }));
  }
  const probes = config?.probe_hosts || [];
  const legacy = ['wan1', 'wan2'].map((key, index) => {
    const wan = config?.[key];
    return wan ? blankLine(key, { ...wan, probe: probes[index] || DEFAULT_PROBES[index] }) : null;
  });
  return legacy.every(Boolean) ? legacy : null;
}

/** Lowest free wanN. Reusing a removed line's id is fine; renumbering a kept one is not. */
function nextLineId(lines) {
  const used = new Set(lines.map((l) => l.id));
  for (let n = 1; n <= MAX_LINES + lines.length; n += 1) {
    if (!used.has(`wan${n}`)) return `wan${n}`;
  }
  return `wan${lines.length + 1}`;
}

const firstUnused = (candidates, taken) => candidates.find((c) => !taken.has(c)) || '';

/**
 * IPv4 only, deliberately. The validator behind this accepts any IP, but the
 * generator writes the probe as `dst-address=<probe>/32`, and a v6 address with
 * a /32 on it is a route RouterOS rejects — so a v6 probe would pass validation
 * and fail on the router. Catching it here is the difference between a red field
 * and a failed push.
 */
const isIPv4 = (value) => /^(\d{1,3}\.){3}\d{1,3}$/.test(value)
  && value.split('.').every((octet) => Number(octet) <= 255 && String(Number(octet)) === octet);

/**
 * One uplink. Hoisted out of the panel on purpose: defined inline it was a new
 * component type on every render, so React unmounted and remounted the whole
 * card each keystroke — which drops focus on the label and probe inputs after
 * a single character.
 */
function WanCard({ line, position, mode, roleLabel, portOptions, canRemove, onChange, onRemove }) {
  const set = (patch) => onChange({ ...line, ...patch });
  // A port that is not in the fetched list (a stored config pointing at a port
  // this router does not have, or a fetch that failed) still has to be an option,
  // or the dropdown shows ether1 while the line is really set to something else.
  const options = line.port && !portOptions.includes(line.port)
    ? [line.port, ...portOptions]
    : portOptions;

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 shrink-0 items-center rounded-md bg-slate-100 px-2 text-[11px] font-bold text-slate-600">
          {line.id.toUpperCase()}
        </span>
        <input
          value={line.label}
          onChange={(e) => set({ label: e.target.value })}
          placeholder={position === 1 ? 'Optional name — e.g. Safaricom fibre' : 'Optional name — e.g. Faiba backup'}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-400 hover:border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
        />
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {roleLabel}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            title={`Remove ${line.id.toUpperCase()}`}
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Port">
          <select value={line.port} onChange={(e) => set({ port: e.target.value })} className={inputCls}>
            {/* A router with fewer free ports than lines leaves this empty, and an
                empty value matches no option — without a placeholder the browser
                displays the first port as though it were chosen. */}
            {!line.port && <option value="">Select a port…</option>}
            {options.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select value={line.type} onChange={(e) => set({ type: e.target.value })} className={inputCls}>
            {WAN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        {line.type === 'static' && (
          <>
            <Field label="IP / CIDR">
              <input value={line.ip} onChange={(e) => set({ ip: e.target.value })} placeholder="100.64.0.2/30" className={`${inputCls} font-mono`} />
            </Field>
            <Field label="Gateway">
              <input value={line.gateway} onChange={(e) => set({ gateway: e.target.value })} placeholder="100.64.0.1" className={`${inputCls} font-mono`} />
            </Field>
          </>
        )}
        <Field label="Probe host" hint="Canary IP tested through this line — unique per line">
          <input value={line.probe} onChange={(e) => set({ probe: e.target.value })} className={`${inputCls} font-mono`} />
        </Field>
        {mode === 'load_balance' && (
          <Field label="Weight" hint="Higher = more traffic (e.g. 30M:10M → 3 and 1)">
            <input type="number" min="1" value={line.weight} onChange={(e) => set({ weight: e.target.value })} className={inputCls} />
          </Field>
        )}
      </div>
    </div>
  );
}

export default function DualWanPanel({ deviceId, device, onApplied }) {
  const initial = device?.wan_config || {};
  const [mode, setMode] = useState(initial.mode || 'off');
  const [lines, setLines] = useState(() => linesFromConfig(initial) || starterLines());
  const [primaryWan, setPrimaryWan] = useState(initial.primary_wan || 'wan1');
  const [subList, setSubList] = useState(initial.subscriber_list || 'ISP2-SUBS');
  const [pinMgmt, setPinMgmt] = useState(initial.pin_management_to || '');

  const [ifaces, setIfaces] = useState([]);
  const [busy, setBusy] = useState('');                 // '', 'download', 'apply', 'disable'
  // Seconds the current push has been running, fed by the job poller.
  const [elapsed, setElapsed] = useState(0);
  // What is actually running on the router, as distinct from what the form is
  // currently showing. The two diverge the moment someone changes the dropdown,
  // and conflating them let the panel claim a method was in force when the apply
  // had failed verification and saved nothing.
  const [liveMode, setLiveMode] = useState(initial.mode || 'off');
  const [liveLines, setLiveLines] = useState(() => (linesFromConfig(initial) || []).length);
  const [result, setResult] = useState(null);

  // The parent refetches the device after a successful apply, so pick the new
  // config up rather than staying on whatever was mounted.
  useEffect(() => {
    const applied = device?.wan_config || {};
    const appliedLines = linesFromConfig(applied);
    setLiveMode(applied.mode || 'off');
    setLiveLines((appliedLines || []).length);
    if (applied.mode) {
      setMode(applied.mode);
      // Only when the config actually carries lines — a stored `mode: off` has
      // none, and overwriting from it would wipe an edit in progress.
      if (appliedLines) setLines(appliedLines);
      if (applied.primary_wan) setPrimaryWan(applied.primary_wan);
      if (applied.subscriber_list) setSubList(applied.subscriber_list);
      if (applied.pin_management_to !== undefined) setPinMgmt(applied.pin_management_to || '');
    }
  }, [device?.wan_config]);

  useEffect(() => {
    deviceService.getInterfaces(getAccessToken(), deviceId)
      .then((d) => setIfaces((d.interfaces || []).filter((i) => i.kind === 'ether')))
      .catch(() => {});
  }, [deviceId]);

  const modeMeta = MODES.find((m) => m.value === mode) || MODES[0];
  const isOn = mode !== 'off';
  const portOptions = ifaces.length ? ifaces.map((i) => i.name) : FALLBACK_PORTS;

  // Both of these name a line by id, so both have to be read against the lines
  // that actually exist. A stale id is not cosmetic: the select would show the
  // first entry while the state held something else, and the server rejects an
  // unknown pin_management_to outright.
  const effectivePrimary = lines.some((l) => l.id === primaryWan) ? primaryWan : (lines[0]?.id || '');
  const effectivePin = lines.some((l) => l.id === pinMgmt) ? pinMgmt : '';

  // Mirrors _role_for() in services/load_balancing.py, so the chip on each card
  // says what the generator will actually make that line do.
  const roleLabelFor = (id) => {
    if (mode === 'load_balance') return 'Carries a share';
    if (mode === 'app_steer') return id === effectivePrimary ? 'Default line' : 'Steer target';
    return id === effectivePrimary ? 'Active' : 'Standby';
  };

  const updateLine = (id, next) => setLines((all) => all.map((l) => (l.id === id ? next : l)));

  const addLine = () => setLines((all) => {
    if (all.length >= MAX_LINES) return all;
    const id = nextLineId(all);
    return [...all, blankLine(id, {
      port: firstUnused(portOptions, new Set(all.map((l) => l.port))),
      probe: firstUnused(DEFAULT_PROBES, new Set(all.map((l) => l.probe))),
    })];
  });

  const removeLine = (id) => {
    if (lines.length <= MIN_LINES) return;
    const kept = lines.filter((l) => l.id !== id);
    setLines(kept);
    // Both name a line by id, so neither may be left pointing at one that is
    // gone — validate_wan_config rejects an unknown pin_management_to outright,
    // and silently reassigns an unknown primary_wan to whatever sorts first.
    if (primaryWan === id) setPrimaryWan(kept[0].id);
    if (pinMgmt === id) setPinMgmt('');
  };

  // Warn about any line whose port is currently a LAN bridge port (service_config).
  const lanPortWarnings = useMemo(() => {
    const roles = device?.service_config?.port_roles || {};
    if (!isOn) return [];
    return lines
      .filter((l) => roles[l.port] && roles[l.port] !== 'skip')
      .map((l) => `${l.port} (${roles[l.port]})`);
  }, [device, lines, isOn]);

  // The same rules validate_wan_config() enforces, checked here so a typo comes
  // back instantly instead of as a 400 after a round trip.
  const problems = useMemo(() => {
    if (!isOn) return [];
    const out = [];
    const ports = lines.map((l) => l.port).filter(Boolean);
    if (ports.length !== lines.length) out.push('Every line needs a port.');
    else if (new Set(ports).size !== ports.length) out.push('Two lines are using the same port — each line needs its own.');

    const probes = lines.map((l) => (l.probe || '').trim()).filter(Boolean);
    if (probes.length !== lines.length) out.push('Every line needs a probe host.');
    else if (new Set(probes).size !== probes.length) {
      out.push('Two lines share a probe host. Each line is judged healthy by whether its own probe answers, so a shared one lets a dead line keep taking traffic.');
    }

    lines.forEach((l) => {
      const name = l.id.toUpperCase();
      const probe = (l.probe || '').trim();
      if (probe && !isIPv4(probe)) out.push(`${name}: “${probe}” is not a valid IPv4 probe host.`);
      if (l.type === 'static' && (!(l.ip || '').trim() || !(l.gateway || '').trim())) {
        out.push(`${name} is a static line — it needs both an IP/CIDR and a gateway.`);
      }
      if (mode === 'load_balance' && (!Number.isFinite(Number(l.weight)) || Number(l.weight) < 1)) {
        out.push(`${name}: weight must be a whole number of 1 or more.`);
      }
    });
    return out;
  }, [lines, isOn, mode]);

  const buildConfig = () => ({
    mode,
    // Position is the failover order: the generator sorts by priority, and the
    // first active line is the one traffic prefers.
    lines: lines.map((l, index) => ({
      id: l.id,
      label: (l.label || '').trim() || null,
      port: l.port,
      type: l.type,
      weight: Number(l.weight) || 1,
      priority: index + 1,
      probe: (l.probe || '').trim(),
      // Carried straight back out. Neither has a control yet, but the router
      // honours an explicit role over the one the mode implies, so re-applying
      // an edited line must not be what quietly erases it.
      ...(l.role ? { role: l.role } : {}),
      ...(l.capacity_mbps ? { capacity_mbps: l.capacity_mbps } : {}),
      ...(l.type === 'static' ? { ip: (l.ip || '').trim(), gateway: (l.gateway || '').trim() } : {}),
    })),
    primary_wan: effectivePrimary,
    subscriber_list: subList,
    pin_management_to: effectivePin || null,
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
    setBusy('apply'); setResult(null); setElapsed(0);
    try {
      // Minutes, not seconds: three SSH sessions against a router that answers
      // in tens of seconds. The elapsed counter is what stops an operator
      // concluding it has hung and clicking again.
      const res = await deviceService.configureLoadBalancing(
        getAccessToken(), deviceId, buildConfig(), true, setElapsed,
      );
      setResult(res);
      // `applied` only means every command ran. `ok` means the router was read
      // back and came up as configured — that is the one worth telling the
      // operator about, and the only one that changes what is live.
      if (res.ok) {
        setLiveMode(res.wan_config?.mode || mode);
        setLiveLines((res.wan_config?.lines || lines).length);
        toast.success(`Multi-WAN applied — ${modeMeta.short} is live on ${lines.length} lines`);
        onApplied?.();
      } else if (res.applied) {
        toast.error(res.error || 'Applied, but the router did not verify — see the log');
      } else {
        toast.error(res.error || 'Apply failed — see the log');
      }
    } catch (e) {
      toast.error(e.message || 'Apply failed');
    } finally { setBusy(''); setElapsed(0); }
  };

  const disable = async () => {
    setBusy('disable'); setResult(null);
    try {
      const res = await deviceService.disableLoadBalancing(getAccessToken(), deviceId, true);
      setResult(res);
      if (res.applied) { toast.success('Multi-WAN removed — back to single WAN'); setMode('off'); onApplied?.(); }
      else toast.error('Disable ran with errors — see the log');
    } catch (e) {
      toast.error(e.message || 'Disable failed');
    } finally { setBusy(''); }
  };

  const liveMeta = MODES.find((m) => m.value === liveMode);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Multi-WAN — Load balancing &amp; failover</h3>
        {liveMode && liveMode !== 'off' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            Live on router: {liveMeta?.short || liveMode.replace('_', ' ')}
            {liveLines > 0 && ` · ${liveLines} lines`}
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            No multi-WAN on this router
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-slate-500">Up to {MAX_LINES} uplinks that share load and cover for each other. Pick a method — the router config is generated for you.</p>

      {/* The switch */}
      <Field label="Method">
        <select value={mode} onChange={(e) => { setMode(e.target.value); setResult(null); }} className={`${inputCls} font-medium`}>
          {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </Field>
      <div className="mt-3 flex gap-2 rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
        <Info className="h-4 w-4 shrink-0 text-indigo-500 mt-0.5" />
        <span>{modeMeta.blurb}</span>
      </div>
      {/* The dropdown is a draft until Apply verifies. Saying which is which stops
          the panel reading as though picking a method had changed the router. */}
      {mode !== liveMode && (
        <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          Not applied yet — the router is still running
          {liveMode === 'off' ? ' a single WAN' : ` ${liveMeta?.short || liveMode}`}.
          Press <strong>Apply now</strong> to change it.
        </p>
      )}

      {isOn && (
        <>
          {lanPortWarnings.length > 0 && (
            <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {lanPortWarnings.join(', ')} {lanPortWarnings.length === 1 ? 'is' : 'are'} currently
                {' '}LAN {lanPortWarnings.length === 1 ? 'port' : 'ports'}. Using {lanPortWarnings.length === 1 ? 'it' : 'them'} as
                an uplink removes {lanPortWarnings.length === 1 ? 'it' : 'them'} from the bridge — {lanPortWarnings.length === 1 ? 'that downstream port goes' : 'those downstream ports go'} away.
                Run <strong>Configure services</strong> first so the LAN bridge exists, then apply multi-WAN.
              </span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {lines.map((line, index) => (
              <WanCard
                key={line.id}
                line={line}
                position={index + 1}
                mode={mode}
                roleLabel={roleLabelFor(line.id)}
                portOptions={portOptions}
                canRemove={lines.length > MIN_LINES}
                onChange={(next) => updateLine(line.id, next)}
                onRemove={() => removeLine(line.id)}
              />
            ))}
            {lines.length < MAX_LINES && (
              <button
                type="button"
                onClick={addLine}
                className="flex min-h-[7rem] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600"
              >
                <Plus className="h-4 w-4" /> Add another line
              </button>
            )}
          </div>
          {lines.length >= MAX_LINES && (
            <p className="mt-2 text-[11px] text-slate-400">
              {MAX_LINES} lines is the ceiling — past that the limit is the router’s CPU, not the config:
              per-connection balancing turns FastTrack off, so every packet takes the firewall path.
            </p>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Primary line" hint="Which line traffic prefers; the rest follow in card order">
              <select value={effectivePrimary} onChange={(e) => setPrimaryWan(e.target.value)} className={inputCls}>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label?.trim() ? `${l.id.toUpperCase()} — ${l.label.trim()}` : l.id.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pin billing tunnel" hint="Keep RADIUS/mgmt on one line (optional)">
              <select value={effectivePin} onChange={(e) => setPinMgmt(e.target.value)} className={inputCls}>
                <option value="">Ride failover (default)</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>Pin to {l.id.toUpperCase()}</option>
                ))}
              </select>
            </Field>
            {mode === 'app_steer' && (
              <Field label="Subscriber steer list" hint="Router address-list RADIUS can fill per customer to push a whole subscriber off the primary. Meta’s app ranges are added automatically.">
                <input value={subList} onChange={(e) => setSubList(e.target.value)} className={`${inputCls} font-mono`} />
              </Field>
            )}
          </div>

          {problems.length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <div className="mb-1 flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Fix these before applying
              </div>
              <ul className="ml-6 list-disc space-y-0.5">
                {problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
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
          title="Remove all multi-WAN config from the router"
        >
          {busy === 'disable' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
          Disable on router
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={download}
            disabled={!!busy || !isOn || problems.length > 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download .rsc
          </button>
          <button
            onClick={apply}
            disabled={!!busy || !isOn || problems.length > 0}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            title="Push over the management tunnel"
          >
            {busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy === 'apply' ? 'Applying…' : 'Apply now'}
          </button>
        </div>
      </div>

      {/* A silent spinner for three minutes reads as a hang, and the operator
          clicks again — which is how a single slow push turned into a queue of
          them. Naming the stage and the elapsed time is the fix. */}
      {busy === 'apply' && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm dark:border-indigo-500/30 dark:bg-indigo-500/10">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span className="font-semibold text-indigo-900 dark:text-indigo-200">
            {elapsed < 25 ? 'Checking the router’s wiring…'
              : elapsed < 90 ? 'Pushing routes, mangle and NAT rules…'
              : 'Reading the configuration back to verify it…'}
          </span>
          <span className="tabular-nums text-indigo-700/80 dark:text-indigo-300/80">
            {elapsed}s elapsed
          </span>
          <span className="w-full text-xs text-indigo-700/70 dark:text-indigo-300/70">
            This runs on the server — it keeps going if you navigate away, and a
            few minutes is normal on a busy router.
          </span>
        </div>
      )}

      {/* A failed push used to strand the router with no default route and no way
          back short of a site visit. The guard undoes it automatically, so say so
          plainly — otherwise the operator's next move is to retry into a router
          that is already repairing itself. */}
      {result && !result.ok && result.rollback_at && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              The router is rolling this back on its own
            </p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300">
              {result.rollback_at} Wait for it to come back before trying again —
              retrying now pushes into a router that is mid-repair.
            </p>
          </div>
        </div>
      )}

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
