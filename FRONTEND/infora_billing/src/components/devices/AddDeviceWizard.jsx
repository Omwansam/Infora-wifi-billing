import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Wifi,
  Shield,
  Settings2,
  CheckCircle2,
  Router,
  MapPin,
  Info,
  Download,
  PlayCircle,
  Network,
  Terminal,
  Copy,
  Check,
  Loader2,
  Cable,
  Globe,
  Activity,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';
import { getRadiusServerHost } from '../../lib/mikrotikProvision';

const STEPS = [
  { id: 1, title: 'Connection', caption: 'Router identity & NAS IP', icon: Wifi },
  { id: 2, title: 'Provision', caption: 'Run the one-line command', icon: Shield },
  { id: 3, title: 'Services', caption: 'PPPoE / Hotspot & bridge', icon: Settings2 },
];

const emptyForm = {
  device_name: '',
  device_ip: '',
  device_model: '',
  location: '',
  isp_id: '',
  notes: '',
  management_wg_enabled: false,
};

const SUBNET_RE = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;

export default function AddDeviceWizard({ isps = [], onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdDevice, setCreatedDevice] = useState(null);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    isp_id: isps[0] ? String(isps[0].id) : '',
  }));

  // Step 2 — provisioning
  const [provisionData, setProvisionData] = useState(null); // { one_liner, expires_at, warning }
  const [provisionStatus, setProvisionStatus] = useState(null); // { online, host, fetched, fetch_count }
  const [copied, setCopied] = useState(false);

  // Step 3 — services
  const [interfaces, setInterfaces] = useState([]);
  const [loadingIfaces, setLoadingIfaces] = useState(false);
  const [ifaceError, setIfaceError] = useState(null);
  const [serviceForm, setServiceForm] = useState({
    pppoe: true,
    hotspot: false,
    anti_sharing: false,
    bridge_ports: [],
    subnet: '172.31.0.0/16',
  });
  const [configuring, setConfiguring] = useState(false);

  // Done
  const [finished, setFinished] = useState(null); // { configResult, skipped }

  const selectedIsp = isps.find((isp) => String(isp.id) === String(form.isp_id));

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const handleServiceChange = (field, value) =>
    setServiceForm((prev) => ({ ...prev, [field]: value }));

  // --- Step 2 polling: is the router online yet? ---
  useEffect(() => {
    if (step !== 2 || !createdDevice) return undefined;
    let active = true;
    const poll = async () => {
      try {
        const token = getAccessToken();
        const status = await deviceService.getProvisionStatus(token, createdDevice.id);
        if (active) setProvisionStatus(status);
      } catch {
        /* keep polling silently */
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [step, createdDevice]);

  // --- Step 3: load interfaces for the bridge-port picker ---
  useEffect(() => {
    if (step !== 3 || !createdDevice) return undefined;
    let active = true;
    setLoadingIfaces(true);
    setIfaceError(null);
    (async () => {
      try {
        const token = getAccessToken();
        const ifs = await deviceService.getInterfaces(token, createdDevice.id);
        if (!active) return;
        setInterfaces(ifs);
        setServiceForm((prev) => ({
          ...prev,
          bridge_ports: ifs.filter((i) => !i.is_uplink).map((i) => i.name),
        }));
      } catch (e) {
        if (active) setIfaceError(e.message || 'Could not read interfaces');
      } finally {
        if (active) setLoadingIfaces(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [step, createdDevice]);

  const validateStep1 = () => {
    if (!form.device_name.trim()) return toast.error('Enter a device name (identity)') && false;
    if (!form.device_ip.trim()) return toast.error('Enter the router IP — this becomes the NAS IP') && false;
    if (!form.device_model.trim()) return toast.error('Enter the device model') && false;
    if (!form.location.trim()) return toast.error('Enter the device location') && false;
    if (isps.length > 0 && !form.isp_id) return toast.error('Select an ISP') && false;
    return true;
  };

  // Step 1 → register device + mint provision token, advance to Step 2.
  const handleRegisterAndProvision = async () => {
    if (!validateStep1()) return;
    setSubmitting(true);
    try {
      const token = getAccessToken();
      const payload = {
        device_name: form.device_name.trim(),
        device_ip: form.device_ip.trim(),
        device_model: form.device_model.trim(),
        location: form.location.trim(),
        notes: form.notes.trim(),
        management_wg_enabled: Boolean(form.management_wg_enabled),
      };
      if (form.isp_id) payload.isp_id = Number(form.isp_id);

      const created = await deviceService.createDevice(token, payload);
      const deviceId = created.device?.id || created.id;
      if (!deviceId) throw new Error('Device created but no id was returned');
      setCreatedDevice({ id: deviceId, name: form.device_name.trim() });

      const prov = await deviceService.generateProvisionToken(token, deviceId);
      setProvisionData(prov);
      if (prov.warning) toast.error(prov.warning, { duration: 6000 });
      toast.success('Device registered — run the command on your router');
      setStep(2);
    } catch (error) {
      toast.error(error.message || 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  };

  const copyOneLiner = async () => {
    if (!provisionData?.one_liner) return;
    try {
      await navigator.clipboard.writeText(provisionData.one_liner);
      setCopied(true);
      toast.success('Command copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const toggleBridgePort = (name) => {
    setServiceForm((prev) => {
      const set = new Set(prev.bridge_ports);
      if (set.has(name)) set.delete(name);
      else set.add(name);
      return { ...prev, bridge_ports: Array.from(set) };
    });
  };

  const handleApplyServices = async () => {
    if (!serviceForm.pppoe && !serviceForm.hotspot) {
      toast.error('Select at least one service (PPPoE or Hotspot)');
      return;
    }
    if (!SUBNET_RE.test(serviceForm.subnet.trim())) {
      toast.error('Enter a valid subnet, e.g. 172.31.0.0/16');
      return;
    }
    setConfiguring(true);
    try {
      const token = getAccessToken();
      const opts = {
        pppoe: serviceForm.pppoe,
        hotspot: serviceForm.hotspot,
        anti_sharing: serviceForm.hotspot && serviceForm.anti_sharing,
        bridge_ports: serviceForm.bridge_ports,
        subnet: serviceForm.subnet.trim(),
      };
      const res = await deviceService.configureServices(token, createdDevice.id, opts);
      setFinished({ configResult: res, skipped: false });
      if (res.success) toast.success('Services configured');
      else toast.error('Configuration completed with errors — see log');
    } catch (e) {
      toast.error(e.message || 'Failed to configure services');
    } finally {
      setConfiguring(false);
    }
  };

  const downloadScripts = async () => {
    if (!createdDevice) return;
    try {
      const token = getAccessToken();
      if (form.management_wg_enabled) {
        await deviceService.downloadManagementTunnelScript(token, createdDevice.id, createdDevice.name);
        toast.success('Management tunnel script downloaded');
      }
      await deviceService.downloadRadiusScript(token, createdDevice.id, createdDevice.name);
      toast.success('RADIUS .rsc downloaded — import on MikroTik');
    } catch (e) {
      toast.error(e.message || 'Download failed');
    }
  };

  const finishWizard = () => {
    onSuccess?.();
    onClose();
  };

  const isOnline = Boolean(provisionStatus?.online);

  // ---------------- DONE SCREEN ----------------
  if (finished) {
    const { configResult } = finished;
    const summary = configResult?.summary;
    const log = configResult?.log || [];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-hidden flex flex-col"
        >
          <div className="px-8 pt-7 pb-5 text-center border-b border-gray-100">
            {configResult?.success ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            ) : (
              <Info className="h-12 w-12 text-amber-500 mx-auto" />
            )}
            <h2 className="text-xl font-bold text-gray-900 mt-4">
              {configResult?.success ? 'Router is live' : 'Finished with warnings'}
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              <strong>{createdDevice?.name}</strong>{' '}
              {configResult?.success
                ? 'is configured and connected to Infora billing.'
                : 'was configured but some steps reported errors. Review the log below.'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {summary && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                <p className="font-semibold text-gray-900 mb-2">Summary</p>
                <dl className="grid grid-cols-2 gap-y-1.5">
                  <dt className="text-gray-500">Services</dt>
                  <dd className="font-medium">{summary.services?.join(', ') || '—'}</dd>
                  <dt className="text-gray-500">Bridge ports</dt>
                  <dd className="font-mono text-xs">{summary.ports?.join(', ') || '—'}</dd>
                  <dt className="text-gray-500">Subnet</dt>
                  <dd className="font-mono text-xs">{summary.subnet}</dd>
                  <dt className="text-gray-500">Gateway</dt>
                  <dd className="font-mono text-xs">{summary.gateway}</dd>
                  <dt className="text-gray-500">Anti-sharing</dt>
                  <dd>{summary.anti_sharing ? 'Enabled' : 'Off'}</dd>
                </dl>
              </div>
            )}

            {log.length > 0 && (
              <div className="rounded-xl bg-slate-900 p-3 max-h-56 overflow-y-auto font-mono text-xs space-y-1">
                {log.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    {entry.status === 'ok' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <span className={entry.status === 'ok' ? 'text-slate-300' : 'text-rose-300'}>
                      <span className="text-slate-500">[{entry.step}]</span> {entry.detail}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-8 py-4 border-t border-gray-100 flex flex-col gap-3">
            <button
              type="button"
              onClick={downloadScripts}
              className="w-full inline-flex items-center justify-center py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download .rsc (manual import)
            </button>
            <button
              type="button"
              onClick={finishWizard}
              className="w-full py-2.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ---------------- WIZARD ----------------
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        <div className="px-8 pt-7 pb-5 border-b border-gray-100">
          <div className="flex items-start justify-between mb-1.5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Link a MikroTik Device</h2>
              <p className="text-sm text-gray-500 mt-1">
                Register the router, run one command to provision it, then choose its services.
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-lg p-1 -mt-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center mt-6">
            {STEPS.map((item, index) => {
              const isActive = step === item.id;
              const isComplete = step > item.id;
              return (
                <React.Fragment key={item.id}>
                  <div className="flex items-center min-w-0">
                    <div
                      className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold shrink-0 transition-colors ${
                        isComplete
                          ? 'bg-emerald-500 text-white'
                          : isActive
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-5 w-5" /> : item.id}
                    </div>
                    <div className="ml-3 hidden md:block min-w-0">
                      <p
                        className={`text-sm font-semibold leading-tight truncate ${
                          isActive ? 'text-gray-900' : isComplete ? 'text-emerald-600' : 'text-gray-400'
                        }`}
                      >
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-400 leading-tight truncate">{item.caption}</p>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-3 sm:mx-4 ${step > item.id ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {/* ---------------- STEP 1: CONNECTION ---------------- */}
            {step === 1 && (
              <motion.div key="step-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center gap-4">
                  <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-orange-100 text-orange-600 shrink-0">
                    <PlayCircle className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Watch the setup guide</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      How to integrate and link your MikroTik with Infora billing.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3.5 flex gap-2.5">
                  <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    Make sure the router runs the <strong>latest stable RouterOS</strong> version before proceeding.
                    Older versions may cause provisioning issues.
                  </p>
                </div>

                {isps.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">ISP</label>
                    <select
                      value={form.isp_id}
                      onChange={(e) => handleChange('isp_id', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      {isps.map((isp) => (
                        <option key={isp.id} value={isp.id}>{isp.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    MikroTik Identity <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Router className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={form.device_name}
                      onChange={(e) => handleChange('device_name', e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Shop-Router-1"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    The identity name of your MikroTik device (<code className="text-xs">System &rsaquo; Identity</code>).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      NAS IP / Hostname <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Network className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={form.device_ip}
                        onChange={(e) => handleChange('device_ip', e.target.value)}
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="192.168.88.1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Model <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.device_model}
                      onChange={(e) => handleChange('device_model', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="RB4011"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Location / Site <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Main Office, Nairobi"
                    />
                  </div>
                </div>

                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  form.management_wg_enabled ? 'border-violet-500 bg-violet-50' : 'border-gray-200'
                }`}>
                  <input
                    type="checkbox"
                    checked={form.management_wg_enabled}
                    onChange={(e) => handleChange('management_wg_enabled', e.target.checked)}
                    className="mt-1 h-4 w-4 text-violet-600 rounded"
                  />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">Router is behind NAT (management tunnel)</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Builds a WireGuard tunnel so Infora can reach the router for monitoring & live config.
                    </p>
                  </div>
                </label>
              </motion.div>
            )}

            {/* ---------------- STEP 2: PROVISION ---------------- */}
            {step === 2 && (
              <motion.div key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Terminal className="h-4 w-4 text-gray-700" />
                    <p className="text-sm font-semibold text-gray-900">Run this once on the router</p>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    Open <code className="text-xs">New Terminal</code> in Winbox/WebFig and paste the command.
                    It fetches a signed script over HTTPS and configures RADIUS + remote access automatically.
                  </p>
                  <div className="relative">
                    <pre className="text-xs bg-slate-900 text-emerald-200 rounded-lg p-3 pr-12 overflow-x-auto whitespace-pre-wrap break-all">
                      {provisionData?.one_liner || 'Generating command...'}
                    </pre>
                    <button
                      type="button"
                      onClick={copyOneLiner}
                      disabled={!provisionData?.one_liner}
                      className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700 text-slate-100 text-xs hover:bg-slate-600 disabled:opacity-50"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  {provisionData?.warning && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 mt-2">
                      <Info className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                      {provisionData.warning}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {provisionData?.expires_at
                      ? `Command valid until ${new Date(provisionData.expires_at).toLocaleString()}.`
                      : 'Single-use until the router fetches it.'}{' '}
                    RADIUS server: <span className="font-mono">{getRadiusServerHost()}</span>
                    {selectedIsp && <> · ISP: <strong>{selectedIsp.name}</strong></>}
                  </p>
                </div>

                {form.management_wg_enabled && (
                  <div className="rounded-xl bg-violet-50 border border-violet-200 p-3.5 flex items-start justify-between gap-3">
                    <div className="flex gap-2.5 min-w-0">
                      <Shield className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-violet-900">
                        NAT router: import the <strong>management tunnel</strong> .rsc first so Infora can reach it.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadScripts}
                      className="text-xs font-medium text-violet-700 hover:text-violet-900 shrink-0 inline-flex items-center gap-1"
                    >
                      <Download className="h-3.5 w-3.5" /> .rsc
                    </button>
                  </div>
                )}

                {/* Live online status */}
                <div className={`rounded-xl border-2 p-4 transition-colors ${
                  isOnline ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-center gap-3">
                    {isOnline ? (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                    ) : (
                      <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                    )}
                    <div className="min-w-0">
                      {isOnline ? (
                        <>
                          <p className="text-sm font-semibold text-emerald-800">
                            Router is online at {provisionStatus?.host}
                          </p>
                          <p className="text-xs text-emerald-700">
                            Provisioning detected{provisionStatus?.fetch_count ? ` · script fetched ${provisionStatus.fetch_count}×` : ''}. Continue to configure services.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-gray-700">Waiting for the router…</p>
                          <p className="text-xs text-gray-500">
                            Run the command above. This will turn green automatically once the router checks in.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ---------------- STEP 3: SERVICES ---------------- */}
            {step === 3 && (
              <motion.div key="step-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-3">Services</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${
                      serviceForm.pppoe ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={serviceForm.pppoe}
                        onChange={(e) => handleServiceChange('pppoe', e.target.checked)}
                        className="mt-1 h-4 w-4 text-orange-600 rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900">PPPoE</p>
                        <p className="text-xs text-gray-500 mt-0.5">PPPoE server + RADIUS AAA</p>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${
                      serviceForm.hotspot ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={serviceForm.hotspot}
                        onChange={(e) => handleServiceChange('hotspot', e.target.checked)}
                        className="mt-1 h-4 w-4 text-orange-600 rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Hotspot</p>
                        <p className="text-xs text-gray-500 mt-0.5">Captive portal + RADIUS</p>
                      </div>
                    </label>
                  </div>
                </div>

                {serviceForm.hotspot && (
                  <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${
                    serviceForm.anti_sharing ? 'border-rose-400 bg-rose-50' : 'border-gray-200'
                  }`}>
                    <input
                      type="checkbox"
                      checked={serviceForm.anti_sharing}
                      onChange={(e) => handleServiceChange('anti_sharing', e.target.checked)}
                      className="mt-1 h-4 w-4 text-rose-600 rounded"
                    />
                    <div>
                      <p className="font-medium text-gray-900 text-sm">Anti-sharing (TTL)</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Normalises TTL so a single account can&apos;t be shared behind another router.
                      </p>
                    </div>
                  </label>
                )}

                {/* Bridge ports */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                      <Cable className="h-4 w-4 text-gray-500" /> Bridge ports (client-facing)
                    </p>
                    {loadingIfaces && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                  </div>
                  {ifaceError ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800">
                      <Info className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                      Couldn&apos;t read interfaces ({ifaceError}). You can still apply config — the uplink is left untouched.
                    </div>
                  ) : interfaces.length === 0 && !loadingIfaces ? (
                    <p className="text-xs text-gray-400">No ethernet interfaces detected yet.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {interfaces.map((iface) => {
                        const selected = serviceForm.bridge_ports.includes(iface.name);
                        return (
                          <button
                            type="button"
                            key={iface.name}
                            onClick={() => toggleBridgePort(iface.name)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                              selected ? 'border-orange-500 bg-orange-50 text-orange-800' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            <span className="font-mono truncate">{iface.name}</span>
                            {iface.is_uplink ? (
                              <span className="text-[10px] uppercase tracking-wide text-blue-500 ml-1">uplink</span>
                            ) : selected ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5">
                    Selected ports join <code className="text-xs">infora-bridge</code>. Leave the uplink (e.g. ether1) unselected.
                  </p>
                </div>

                {/* Subnet */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Globe className="h-4 w-4 text-gray-500" /> Client subnet (DHCP)
                  </label>
                  <input
                    type="text"
                    value={serviceForm.subnet}
                    onChange={(e) => handleServiceChange('subnet', e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="172.31.0.0/16"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">
                    Gateway becomes the first host; a DHCP pool + server are created on the bridge.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-8 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep((s) => Math.max(s - 1, 1))}
            className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            disabled={submitting || configuring}
          >
            {step === 1 ? 'Cancel' : (<><ChevronLeft className="h-4 w-4 mr-1" />Back</>)}
          </button>

          {step === 1 && (
            <button
              type="button"
              onClick={handleRegisterAndProvision}
              disabled={submitting}
              className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 shadow-sm disabled:opacity-50"
            >
              {submitting ? (<><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Registering…</>) : (<>Register &amp; get command<ChevronRight className="h-4 w-4 ml-1" /></>)}
            </button>
          )}

          {step === 2 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={finishWizard}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className={`inline-flex items-center px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm ${
                  isOnline ? 'text-white bg-orange-500 hover:bg-orange-600' : 'text-orange-700 bg-orange-100 hover:bg-orange-200'
                }`}
              >
                {isOnline ? 'Configure services' : 'Configure anyway'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={handleApplyServices}
              disabled={configuring}
              className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 shadow-sm disabled:opacity-50"
            >
              {configuring ? (<><Activity className="h-4 w-4 mr-1.5 animate-pulse" />Applying…</>) : (<>Apply configuration<RefreshCw className="h-4 w-4 ml-1.5" /></>)}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
