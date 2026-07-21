import React, { useEffect, useState } from 'react';
import {
  Loader2, Wifi, Network, Check, Play, ShieldCheck, RefreshCw, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';

const PHYSICAL = ['ether', 'sfp', 'wlan'];

/**
 * Inline "Configure Services" wizard for the device detail page.
 * Loads the router's interfaces and pushes bridge/PPPoE/Hotspot config via the
 * existing configure-services endpoint. Payload matches the backend exactly:
 * { pppoe, hotspot, anti_sharing, bridge_ports[], subnet }.
 */
export default function ConfigureServicesPanel({ deviceId, initial, onApplied }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interfaces, setInterfaces] = useState([]);

  const [pppoe, setPppoe] = useState(initial?.pppoe ?? true);
  const [hotspot, setHotspot] = useState(initial?.hotspot ?? true);
  const [antiSharing, setAntiSharing] = useState(initial?.anti_sharing ?? false);
  const [bridgePorts, setBridgePorts] = useState(initial?.bridge_ports || []);
  const [subnet, setSubnet] = useState(initial?.subnet || '172.31.0.0/16');

  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await deviceService.getInterfaces(getAccessToken(), deviceId);
      setInterfaces((data.interfaces || []).filter((i) => PHYSICAL.includes(i.kind)));
    } catch (e) {
      setError(e.message || 'Could not read interfaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [deviceId]);

  const togglePort = (name) =>
    setBridgePorts((p) => (p.includes(name) ? p.filter((n) => n !== name) : [...p, name]));

  const apply = async () => {
    if (!pppoe && !hotspot) return toast.error('Enable at least one service');
    if (bridgePorts.length === 0) return toast.error('Select at least one LAN port');
    setApplying(true);
    setResult(null);
    try {
      const res = await deviceService.configureServices(getAccessToken(), deviceId, {
        pppoe, hotspot, anti_sharing: antiSharing, bridge_ports: bridgePorts, subnet,
      });
      setResult(res);
      if (res.success) {
        toast.success('Services applied to the router');
        onApplied?.();
      } else {
        toast.error(res.error || 'Apply completed with issues — see the log');
      }
    } catch (e) {
      toast.error(e.message || 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const ServiceToggle = ({ on, setOn, icon: Icon, title, sub, accent }) => (
    <button
      type="button"
      onClick={() => setOn((v) => !v)}
      className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
        on ? `${accent}` : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <span className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border-2 ${on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'}`}>
        {on && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Icon className="h-4 w-4" /> {title}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{sub}</span>
      </span>
    </button>
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Configure Services</h3>
          <p className="text-sm text-slate-500">Enable PPPoE / Hotspot, pick LAN ports, then apply to the router.</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" title="Reload interfaces">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <span className="inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Could not fetch interfaces: {error}</span>
          <button onClick={load} className="shrink-0 font-semibold underline">Retry</button>
        </div>
      )}

      {/* Step 1 — services */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ServiceToggle on={pppoe} setOn={setPppoe} icon={Network} title="PPPoE Server" sub="Dial-up broadband for home/office clients" accent="border-violet-400 bg-violet-50" />
        <ServiceToggle on={hotspot} setOn={setHotspot} icon={Wifi} title="Hotspot (Captive Portal)" sub="WiFi login portal for prepaid/voucher users" accent="border-emerald-400 bg-emerald-50" />
      </div>

      {/* Step 2 — LAN ports */}
      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">LAN Ports <span className="text-slate-400">(clients plug into these — added to the service bridge)</span></p>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Reading interfaces…</div>
        ) : interfaces.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">No interfaces available{error ? ' (router unreachable)' : ''}.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {interfaces.map((iface) => {
              const on = bridgePorts.includes(iface.name);
              const Icon = iface.kind === 'wlan' ? Wifi : Network;
              return (
                <button
                  key={iface.name}
                  type="button"
                  onClick={() => togglePort(iface.name)}
                  disabled={iface.is_uplink}
                  title={iface.is_uplink ? 'Uplink / WAN — cannot be a LAN port' : iface.name}
                  className={`rounded-xl border-2 p-2.5 text-center transition ${
                    iface.is_uplink ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
                      : on ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <Icon className={`mx-auto h-5 w-5 ${on ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <p className="mt-1 truncate font-mono text-[11px] font-semibold text-slate-800">{iface.name}</p>
                  {iface.is_uplink && <p className="text-[9px] font-bold uppercase tracking-wide text-orange-500">uplink</p>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 3 — options */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Service Subnet</label>
          <input
            value={subnet}
            onChange={(e) => setSubnet(e.target.value)}
            placeholder="172.31.0.0/16"
            className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        {hotspot && (
          <label className="flex cursor-pointer items-center gap-2 self-end rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700">
            <input type="checkbox" checked={antiSharing} onChange={(e) => setAntiSharing(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-emerald-600" />
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-slate-400" /> Anti account-sharing (Hotspot)</span>
          </label>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end border-t border-slate-100 pt-5">
        <button
          onClick={apply}
          disabled={applying || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {applying ? 'Applying…' : 'Apply to router'}
        </button>
      </div>

      {result && (
        <pre className={`mt-4 max-h-56 overflow-auto rounded-lg border p-3 text-[11px] leading-relaxed ${result.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          {result.summary || result.log || result.error || (result.success ? 'Applied successfully.' : 'No output returned.')}
        </pre>
      )}
    </div>
  );
}
