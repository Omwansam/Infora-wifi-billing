import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Router,
  RefreshCw,
  Loader2,
  Search,
  Power,
  Network,
  Wifi,
  Zap,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';
import { useInterfaceRates, formatBps } from '../../hooks/useInterfaceRates';

const PHYSICAL_KINDS = ['ether', 'sfp', 'wlan'];

/**
 * Live port map for a linked MikroTik — model summary, per-port status and
 * throughput, monitor selection, and enable/disable actions. Opened from the
 * routers list ("View details").
 */
export default function DevicePortsPanel({ device, onClose }) {
  const [discovery, setDiscovery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [monitored, setMonitored] = useState([]);
  const [saving, setSaving] = useState(false);
  const [togglingPort, setTogglingPort] = useState(null);
  const [tab, setTab] = useState('active');
  const [query, setQuery] = useState('');

  const interfaces = discovery?.interfaces || [];
  const rates = useInterfaceRates(device?.id, interfaces.length > 0);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      const data = await deviceService.getInterfaces(token, device.id);
      setDiscovery(data);
      const physical = data.interfaces.filter((i) => PHYSICAL_KINDS.includes(i.kind));
      setMonitored(
        data.monitored?.length
          ? data.monitored
          : physical.filter((i) => i.running && !i.disabled).map((i) => i.name)
      );
    } catch (e) {
      setError(e.message || 'Could not read interfaces');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (device?.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device?.id]);

  const toggleMonitored = (name) => {
    setMonitored((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleTogglePort = async (iface, event) => {
    event.stopPropagation();
    if (iface.is_uplink && !iface.disabled) {
      toast.error('The uplink port carries the internet feed — it cannot be disabled');
      return;
    }
    setTogglingPort(iface.name);
    try {
      const token = getAccessToken();
      const updated = await deviceService.toggleInterface(token, device.id, iface.name, !iface.disabled);
      setDiscovery((prev) => ({
        ...prev,
        interfaces: prev.interfaces.map((x) =>
          x.name === iface.name ? { ...x, disabled: updated.disabled } : x
        ),
      }));
      toast.success(`${iface.name} ${updated.disabled ? 'disabled' : 'enabled'}`);
    } catch (e) {
      toast.error(e.message || 'Could not update the port');
    } finally {
      setTogglingPort(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getAccessToken();
      await deviceService.saveMonitoredInterfaces(token, device.id, monitored);
      toast.success('Monitoring selection saved');
    } catch (e) {
      toast.error(e.message || 'Could not save the selection');
    } finally {
      setSaving(false);
    }
  };

  const filtered = interfaces
    .filter((i) => {
      if (tab === 'active') return PHYSICAL_KINDS.includes(i.kind) && i.running && !i.disabled;
      if (tab === 'ether') return i.kind === 'ether';
      if (tab === 'sfp') return i.kind === 'sfp';
      if (tab === 'wlan') return i.kind === 'wlan';
      return true;
    })
    .filter((i) => !query || i.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-3xl max-h-[88vh] overflow-y-auto bg-white rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between gap-3 rounded-t-2xl">
          <div className="flex gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-orange-50 text-orange-700 shrink-0">
              <Router className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 truncate">{device.name} — ports</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {discovery?.device ? (
                  <>
                    {discovery.device.model}
                    {discovery.device.version && <> · RouterOS {discovery.device.version}</>}
                    {discovery.device.architecture && <> · {discovery.device.architecture}</>}
                    {' '}· {discovery.device.ports} ports · {discovery.counts?.active ?? 0} active
                  </>
                ) : (
                  'Reading the router through the tunnel…'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading interfaces…
            </div>
          )}
          {error && !loading && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center justify-between gap-3">
              <span>Could not read interfaces: {error}</span>
              <button type="button" onClick={load} className="font-semibold underline shrink-0">
                Retry
              </button>
            </div>
          )}

          {interfaces.length > 0 && (
            <>
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'active', label: `All active ${discovery?.counts?.active ?? 0}` },
                  { id: 'ether', label: `Ethernet ${discovery?.counts?.ethernet ?? 0}` },
                  { id: 'sfp', label: `SFP ${discovery?.counts?.sfp ?? 0}` },
                  { id: 'wlan', label: `Wireless ${discovery?.counts?.wireless ?? 0}` },
                  { id: 'all', label: 'All' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      tab === t.id
                        ? 'bg-sky-50 border-sky-400 text-sky-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filter interfaces"
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg font-mono text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Port grid */}
              {filtered.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No interfaces match this filter.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2.5">
                  {filtered.map((iface) => {
                    const selected = monitored.includes(iface.name);
                    const Icon = iface.kind === 'wlan' ? Wifi : iface.kind === 'sfp' ? Zap : Network;
                    return (
                      <div
                        key={iface.name}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleMonitored(iface.name)}
                        onKeyDown={(e) => e.key === 'Enter' && toggleMonitored(iface.name)}
                        className={`relative rounded-xl border-2 p-3 cursor-pointer transition-colors text-center ${
                          selected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-slate-300'
                        } ${iface.disabled ? 'opacity-60' : ''}`}
                        title={[iface.mac, iface.speed, iface.comment, iface.is_uplink ? 'uplink / WAN' : null]
                          .filter(Boolean).join(' · ') || iface.name}
                      >
                        <span className={`absolute top-2 right-2 h-2 w-2 rounded-full ${
                          iface.disabled ? 'bg-rose-400' : iface.running ? 'bg-emerald-500' : 'bg-slate-300'
                        }`} />
                        <Icon className={`h-5 w-5 mx-auto ${selected ? 'text-sky-600' : 'text-slate-400'}`} />
                        <p className="font-mono text-[11px] font-semibold text-slate-800 mt-1.5 truncate">
                          {iface.name}
                        </p>
                        {rates[iface.name] && !iface.disabled && (
                          <p className="font-mono text-[9px] text-slate-500 mt-0.5 truncate">
                            ↓{formatBps(rates[iface.name].rx_bps)} ↑{formatBps(rates[iface.name].tx_bps)}
                          </p>
                        )}
                        {iface.is_uplink ? (
                          <p className="text-[9px] uppercase tracking-wide text-orange-500 font-bold mt-0.5">uplink</p>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleTogglePort(iface, e)}
                            disabled={togglingPort === iface.name}
                            className={`mt-0.5 inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                              iface.disabled ? 'text-rose-500 hover:text-rose-700' : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title={iface.disabled ? 'Enable this port' : 'Disable this port'}
                          >
                            {togglingPort === iface.name ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : (
                              <Power className="h-2.5 w-2.5" />
                            )}
                            {iface.disabled ? 'off' : 'on'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">{monitored.length} selected for monitoring</p>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Save monitoring
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
