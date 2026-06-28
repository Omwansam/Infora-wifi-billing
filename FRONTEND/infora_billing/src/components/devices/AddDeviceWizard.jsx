import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Shield,
  Settings2,
  CheckCircle2,
  Router,
  Info,
  Download,
  PlayCircle,
  Terminal,
  Copy,
  Check,
  X,
  Loader2,
  Cable,
  Globe,
  Activity,
  RefreshCw,
  Wifi,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';
import { getRadiusServerHost } from '../../lib/mikrotikProvision';

const STEPS = [
  { id: 1, title: 'Identity', caption: 'Name your router', icon: Wifi },
  { id: 2, title: 'Provision', caption: 'Run the command', icon: Shield },
  { id: 3, title: 'Services', caption: 'PPPoE / Hotspot', icon: Settings2 },
  { id: 4, title: 'Done', caption: 'Live & summary', icon: CheckCircle2 },
];

const SUBNET_RE = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;
const DEFAULT_SUBNET = '172.31.0.0/16';

export default function AddDeviceWizard({ isps = [], onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdDevice, setCreatedDevice] = useState(null);
  const [form, setForm] = useState(() => ({
    device_name: '',
    isp_id: isps[0] ? String(isps[0].id) : '',
    notes: '',
  }));

  // Step 2 — provisioning
  const [provisionData, setProvisionData] = useState(null);
  const [provisionStatus, setProvisionStatus] = useState(null);
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
    subnet: DEFAULT_SUBNET,
  });
  const [useCustomSubnet, setUseCustomSubnet] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  // Step 4 — result
  const [configResult, setConfigResult] = useState(null);

  const showIspPicker = isps.length > 1;
  const selectedIsp = isps.find((isp) => String(isp.id) === String(form.isp_id));
  const isOnline = Boolean(provisionStatus?.online);

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

  // Step 1 → register device (auto NAS IP/model) + mint provision token.
  const handleRegisterAndProvision = async () => {
    if (!form.device_name.trim()) {
      toast.error('Enter the MikroTik identity name');
      return;
    }
    if (showIspPicker && !form.isp_id) {
      toast.error('Select an ISP');
      return;
    }
    setSubmitting(true);
    try {
      const token = getAccessToken();
      const payload = {
        device_name: form.device_name.trim(),
        notes: form.notes.trim(),
        management_wg_enabled: true, // tunnel assigns the NAS IP automatically
      };
      if (form.isp_id) payload.isp_id = Number(form.isp_id);

      const created = await deviceService.createDevice(token, payload);
      const device = created.device || created;
      const deviceId = device?.id;
      if (!deviceId) throw new Error('Device created but no id was returned');
      setCreatedDevice({ id: deviceId, name: form.device_name.trim() });

      const prov = await deviceService.generateProvisionToken(token, deviceId);
      setProvisionData(prov);
      if (prov.warning) toast.error(prov.warning, { duration: 6000 });
      toast.success('Router registered — run the command to provision it');
      setStep(2);
    } catch (error) {
      toast.error(error.message || 'Failed to register router');
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
    const subnet = useCustomSubnet ? serviceForm.subnet.trim() : DEFAULT_SUBNET;
    if (!SUBNET_RE.test(subnet)) {
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
        subnet,
      };
      const res = await deviceService.configureServices(token, createdDevice.id, opts);
      setConfigResult(res);
      setStep(4);
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
      await deviceService.downloadManagementTunnelScript(token, createdDevice.id, createdDevice.name);
      await deviceService.downloadRadiusScript(token, createdDevice.id, createdDevice.name);
      toast.success('.rsc files downloaded — import on MikroTik');
    } catch (e) {
      toast.error(e.message || 'Download failed');
    }
  };

  const finishWizard = () => {
    onSuccess?.();
    onClose();
  };

  const headerBack = () => {
    if (step === 1) onClose();
    else if (step === 4) finishWizard();
    else setStep((s) => Math.max(s - 1, 1));
  };

  const vpnAddress = provisionStatus?.host || createdDevice?.management_wg_ip || '—';

  return (
    <div className="w-full min-h-full bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <button
            type="button"
            onClick={headerBack}
            className="mt-1 text-gray-400 hover:text-gray-700 transition-colors"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Link a <span className="text-orange-500">MikroTik</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Register the router, run one command to provision it, then choose its services.
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
            Device configuration
          </p>
          <div className="flex items-center">
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
                            ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                            : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-5 w-5" /> : item.id}
                    </div>
                    <div className="ml-3 hidden sm:block min-w-0">
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
                    <div className={`flex-1 h-0.5 mx-3 sm:mx-4 rounded ${step > item.id ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="p-6 sm:p-8">
            <AnimatePresence mode="wait">
              {/* ---------------- STEP 1: IDENTITY ---------------- */}
              {step === 1 && (
                <motion.div key="step-1" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5 max-w-xl">
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

                  {showIspPicker && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">ISP</label>
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
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                      MikroTik Identity <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Router className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={form.device_name}
                        onChange={(e) => handleChange('device_name', e.target.value)}
                        autoFocus
                        className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder="MikroTik2"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">
                      The identity name of your MikroTik device (<code className="text-xs">System &rsaquo; Identity</code>).
                      We detect the model, NAS IP and version automatically once it&apos;s online.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ---------------- STEP 2: PROVISION ---------------- */}
              {step === 2 && (
                <motion.div key="step-2" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Terminal className="h-4 w-4 text-gray-700" />
                      <p className="text-base font-semibold text-gray-900">Provisioning command</p>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      Open <code className="text-xs">New Terminal</code> in Winbox/WebFig and paste this one-liner.
                      The router fetches a signed script over HTTPS and configures RADIUS + remote access automatically.
                    </p>
                    <div className="relative">
                      <pre className="text-xs bg-slate-900 text-emerald-200 rounded-xl p-4 pr-24 overflow-x-auto whitespace-pre-wrap break-all">
                        {provisionData?.one_liner || 'Generating command…'}
                      </pre>
                      <button
                        type="button"
                        onClick={copyOneLiner}
                        disabled={!provisionData?.one_liner}
                        className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 text-slate-100 text-xs font-medium hover:bg-slate-600 disabled:opacity-50"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? 'Copied' : 'Copy script'}
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
                              {createdDevice?.name} is online at {provisionStatus?.host}
                            </p>
                            <p className="text-xs text-emerald-700">
                              Provisioning detected{provisionStatus?.fetch_count ? ` · script fetched ${provisionStatus.fetch_count}×` : ''}
                              {provisionStatus?.detected?.model ? ` · ${provisionStatus.detected.model}` : ''}. Continue to configure services.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-gray-700">Waiting for the router…</p>
                            <p className="text-xs text-gray-500">
                              Run the command above. This turns green automatically once the router checks in.
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
                <motion.div key="step-3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
                  <div>
                    <p className="text-base font-semibold text-gray-900">Service types</p>
                    <p className="text-sm text-gray-500 mb-3">Choose what this router should run for subscribers.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleServiceChange('pppoe', !serviceForm.pppoe)}
                        className={`text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-colors ${
                          serviceForm.pppoe ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold shrink-0">PPP</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900">PPPoE</p>
                          <p className="text-xs text-gray-500 mt-0.5">Always-on broadband subscribers</p>
                        </div>
                        {serviceForm.pppoe && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleServiceChange('hotspot', !serviceForm.hotspot)}
                        className={`text-left flex items-start gap-3 p-4 rounded-xl border-2 transition-colors ${
                          serviceForm.hotspot ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold shrink-0">HS</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900">Hotspot</p>
                          <p className="text-xs text-gray-500 mt-0.5">Captive portal &amp; vouchers</p>
                        </div>
                        {serviceForm.hotspot && <Check className="h-4 w-4 text-orange-600 shrink-0" />}
                      </button>
                    </div>

                    {serviceForm.hotspot && (
                      <label className={`mt-3 flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${
                        serviceForm.anti_sharing ? 'border-rose-400 bg-rose-50' : 'border-gray-200'
                      }`}>
                        <input
                          type="checkbox"
                          checked={serviceForm.anti_sharing}
                          onChange={(e) => handleServiceChange('anti_sharing', e.target.checked)}
                          className="mt-1 h-4 w-4 text-rose-600 rounded"
                        />
                        <div>
                          <p className="font-medium text-gray-900 text-sm">Enable Hotspot anti-sharing protection</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Normalises TTL to detect and block connection sharing — one user, one connection.
                          </p>
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Bridge ports */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
                        <Cable className="h-4 w-4 text-gray-500" /> Bridge ports
                      </p>
                      {loadingIfaces && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Interfaces that join the infora-bridge for subscriber traffic.</p>

                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800 mb-3">
                      <Info className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                      <strong>Don&apos;t bridge the uplink port.</strong> The first port (usually ether1) is the
                      internet feed — adding it cuts off WAN. Leave it unticked.
                    </div>

                    {ifaceError ? (
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500">
                        Interfaces will be read once the router is online. You can still apply config — the uplink is left untouched.
                      </div>
                    ) : interfaces.length === 0 && !loadingIfaces ? (
                      <p className="text-xs text-gray-400">No ethernet interfaces detected yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {interfaces.map((iface) => {
                          const selected = serviceForm.bridge_ports.includes(iface.name);
                          return (
                            <button
                              type="button"
                              key={iface.name}
                              onClick={() => !iface.is_uplink && toggleBridgePort(iface.name)}
                              disabled={iface.is_uplink}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm transition-colors ${
                                iface.is_uplink
                                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                                  : selected
                                    ? 'border-orange-500 bg-orange-50'
                                    : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                  selected ? 'border-orange-500 bg-orange-500' : 'border-gray-300'
                                }`}>
                                  {selected && <Check className="h-2.5 w-2.5 text-white" />}
                                </span>
                                <span className="font-mono font-medium text-gray-800">{iface.name}</span>
                                {iface.is_uplink && (
                                  <span className="text-[10px] uppercase tracking-wide text-orange-500 font-semibold ml-1">uplink / wan</span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400">
                                {iface.is_uplink ? 'Leave unticked — internet feed' : 'Add to infora-bridge'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Subnet */}
                  <div>
                    <p className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
                      <Globe className="h-4 w-4 text-gray-500" /> Subnet
                    </p>
                    <p className="text-sm text-gray-500 mb-3">
                      Optional custom network for the bridge. Defaults to <code className="text-xs">{DEFAULT_SUBNET}</code>.
                    </p>
                    <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer ${
                      useCustomSubnet ? 'border-orange-500 bg-orange-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={useCustomSubnet}
                        onChange={(e) => setUseCustomSubnet(e.target.checked)}
                        className="h-4 w-4 text-orange-600 rounded"
                      />
                      <span className="text-sm font-medium text-gray-900">Use custom subnet</span>
                    </label>
                    {useCustomSubnet && (
                      <input
                        type="text"
                        value={serviceForm.subnet}
                        onChange={(e) => handleServiceChange('subnet', e.target.value)}
                        className="mt-3 w-full px-3.5 py-2.5 border border-gray-300 rounded-lg font-mono focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        placeholder={DEFAULT_SUBNET}
                      />
                    )}
                  </div>
                </motion.div>
              )}

              {/* ---------------- STEP 4: DONE ---------------- */}
              {step === 4 && (
                <motion.div key="step-4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5">
                  <div className="flex items-center gap-3">
                    {configResult?.success ? (
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    ) : (
                      <Info className="h-8 w-8 text-amber-500" />
                    )}
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {configResult?.success ? 'Router is live' : 'Finished with warnings'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {configResult?.success
                          ? 'Services are configured. Subscribers can authenticate through this NAS.'
                          : 'Configured, but some steps reported errors. Review the log below.'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <dl className="grid grid-cols-[120px_1fr] gap-y-2.5 text-sm">
                      <dt className="text-gray-500">Router</dt>
                      <dd className="font-semibold text-gray-900 text-right sm:text-left">{createdDevice?.name}</dd>
                      <dt className="text-gray-500">VPN address</dt>
                      <dd className="font-mono font-semibold text-gray-900 text-right sm:text-left">{vpnAddress}</dd>
                      <dt className="text-gray-500">Services</dt>
                      <dd className="font-medium text-gray-900 text-right sm:text-left">
                        {configResult?.summary?.services?.join(', ') || '—'}
                      </dd>
                      <dt className="text-gray-500">Ports</dt>
                      <dd className="font-mono text-gray-900 text-right sm:text-left">
                        {configResult?.summary?.ports?.join(', ') || '—'}
                      </dd>
                      <dt className="text-gray-500">Status</dt>
                      <dd className={`font-bold text-right sm:text-left ${configResult?.success ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {configResult?.success ? 'Active' : 'Needs attention'}
                      </dd>
                    </dl>
                  </div>

                  {configResult?.log?.length > 0 && (
                    <div className="rounded-xl bg-slate-900 p-4 max-h-64 overflow-y-auto font-mono text-xs space-y-1">
                      {configResult.log.map((entry, idx) => (
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

                  <button
                    type="button"
                    onClick={downloadScripts}
                    className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
                  >
                    <Download className="h-4 w-4 mr-1.5" />
                    Download .rsc (manual import)
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 sm:px-8 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between">
            {step === 4 ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  All routers
                </button>
                <button
                  type="button"
                  onClick={finishWizard}
                  className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 shadow-sm"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  View routers
                </button>
              </>
            ) : (
              <>
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
                    {submitting ? (<><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Registering…</>) : (<>Next Step<ChevronRight className="h-4 w-4 ml-1" /></>)}
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
