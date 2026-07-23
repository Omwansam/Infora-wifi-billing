import React, { useEffect, useState } from 'react';
import {
  Loader2, Network, Play, ShieldCheck, RefreshCw, AlertTriangle, Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';

const PORT_ROLES = [
  { value: 'skip', label: '— Skip —' },
  { value: 'hotspot', label: 'Hotspot' },
  { value: 'pppoe', label: 'PPPoE' },
  { value: 'both', label: 'Both (Hotspot + PPPoE)' },
];

/**
 * Seed per-interface roles from a device's stored service_config. Prefers the
 * new `port_roles` map; falls back to the legacy {pppoe, hotspot, bridge_ports}
 * shape so previously-configured devices show sensible roles.
 */
function seedRoles(initial) {
  if (initial?.port_roles && typeof initial.port_roles === 'object') {
    return { ...initial.port_roles };
  }
  const ports = initial?.bridge_ports || [];
  const role = initial?.pppoe && initial?.hotspot ? 'both'
    : initial?.pppoe ? 'pppoe'
      : initial?.hotspot ? 'hotspot' : 'both';
  return Object.fromEntries(ports.map((p) => [p, role]));
}

/**
 * Inline "Configure Services" panel for the device detail page. Assigns each
 * ethernet port a role (Hotspot / PPPoE / Both / Skip) and pushes the config
 * via the existing configure-services endpoint. Payload:
 * { port_roles, anti_sharing, subnet }.
 */
export default function ConfigureServicesPanel({ deviceId, initial, onApplied }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interfaces, setInterfaces] = useState([]);

  const [portRoles, setPortRoles] = useState(() => seedRoles(initial));
  const [antiSharing, setAntiSharing] = useState(initial?.anti_sharing ?? false);
  const [subnet, setSubnet] = useState(initial?.subnet || '172.31.0.0/16');

  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await deviceService.getInterfaces(getAccessToken(), deviceId);
      const ethers = (data.interfaces || []).filter((i) => i.kind === 'ether');
      setInterfaces(ethers);
      // Default any non-uplink ether without a stored role to "both".
      setPortRoles((prev) => {
        const next = { ...prev };
        ethers.filter((i) => !i.is_uplink).forEach((i) => {
          if (!next[i.name]) next[i.name] = 'both';
        });
        return next;
      });
    } catch (e) {
      setError(e.message || 'Could not read interfaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [deviceId]);

  const setRole = (name, role) => setPortRoles((prev) => ({ ...prev, [name]: role }));
  const anyHotspot = Object.values(portRoles).some((r) => r === 'hotspot' || r === 'both');

  const apply = async () => {
    const roles = Object.fromEntries(
      Object.entries(portRoles).filter(([, r]) => r && r !== 'skip')
    );
    if (Object.keys(roles).length === 0) return toast.error('Assign at least one port to Hotspot, PPPoE, or Both');
    setApplying(true);
    setResult(null);
    try {
      const res = await deviceService.configureServices(getAccessToken(), deviceId, {
        port_roles: roles, anti_sharing: anyHotspot && antiSharing, subnet,
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

  const assignable = interfaces.filter((i) => !i.is_uplink);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Configure Services</h3>
          <p className="text-sm text-slate-500">Assign each port a role, then apply to the router.</p>
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

      <p className="mb-2 text-xs text-slate-500">
        <strong>Hotspot</strong> joins the captive-portal bridge · <strong>PPPoE</strong> runs a dial-up server on that port (no DHCP) · <strong>Both</strong> allows either.
      </p>
      {interfaces.some((i) => i.is_uplink) && (
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
          <Info className="h-3.5 w-3.5" /> The uplink / WAN port is hidden — it is never assigned to a service.
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Reading interfaces…</div>
      ) : assignable.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">No assignable ethernet interfaces{error ? ' (router unreachable)' : ''}.</p>
      ) : (
        <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          <div className="hidden sm:flex items-center px-4 py-2 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <span className="flex-1">Interface</span>
            <span className="w-24">Status</span>
            <span className="w-56">Assign to</span>
          </div>
          {assignable.map((iface) => {
            const role = portRoles[iface.name] || 'skip';
            const active = iface.running && !iface.disabled;
            return (
              <div key={iface.name} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Network className="h-4 w-4 text-slate-400 shrink-0" />
                  <span className="font-mono font-medium text-slate-800">{iface.name}</span>
                </div>
                <div className="w-24 flex items-center gap-1.5 text-xs shrink-0">
                  <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  <span className="text-slate-500">{iface.disabled ? 'Disabled' : iface.running ? 'Active' : 'Inactive'}</span>
                </div>
                <select
                  value={role}
                  onChange={(e) => setRole(iface.name, e.target.value)}
                  className="sm:w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
                >
                  {PORT_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

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
        {anyHotspot && (
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
          {result.summary
            ? JSON.stringify(result.summary, null, 2)
            : (result.error || (result.success ? 'Applied successfully.' : 'No output returned.'))}
        </pre>
      )}
    </div>
  );
}
