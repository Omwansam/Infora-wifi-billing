import React, { useState, useEffect, useRef } from 'react';
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
  Search,
  Power,
  Network,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';
import { getRadiusServerHost } from '../../lib/mikrotikProvision';
import { useInterfaceRates, formatBps } from '../../hooks/useInterfaceRates';

const STEPS = [
  { id: 1, title: 'Identity', caption: 'Name your router', icon: Wifi },
  { id: 2, title: 'Provision', caption: 'Run the command', icon: Shield },
  { id: 3, title: 'Ports', caption: 'Discover & monitor', icon: Cable },
  { id: 4, title: 'Services', caption: 'PPPoE / Hotspot', icon: Settings2 },
  { id: 5, title: 'Done', caption: 'Live & summary', icon: CheckCircle2 },
];

const PHYSICAL_KINDS = ['ether', 'sfp', 'wlan'];

const SUBNET_RE = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;
const DEFAULT_SUBNET = '172.31.0.0/16';

// Per-interface service role options (Step 4).
const PORT_ROLES = [
  { value: 'skip', label: '— Skip —' },
  { value: 'hotspot', label: 'Hotspot' },
  { value: 'pppoe', label: 'PPPoE' },
  { value: 'both', label: 'Both (Hotspot + PPPoE)' },
];

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
  const [copiedOnce, setCopiedOnce] = useState(false);
  const [selfCheckOpen, setSelfCheckOpen] = useState(false);
  const [rerunningCheck, setRerunningCheck] = useState(false);
  const [tunnelStalled, setTunnelStalled] = useState(false);
  const tunnelWaitStartRef = useRef(null);

  // Step 3 — ports (interface discovery)
  const [discovery, setDiscovery] = useState(null);
  const [loadingIfaces, setLoadingIfaces] = useState(false);
  const [ifaceError, setIfaceError] = useState(null);
  const [monitored, setMonitored] = useState([]);
  const [portTab, setPortTab] = useState('active');
  const [portQuery, setPortQuery] = useState('');
  const [togglingPort, setTogglingPort] = useState(null);
  const [savingPorts, setSavingPorts] = useState(false);

  // Step 4 — services (per-interface roles: { ether2: 'hotspot'|'pppoe'|'both'|'skip' })
  const [serviceForm, setServiceForm] = useState({
    port_roles: {},
    anti_sharing: false,
    subnet: DEFAULT_SUBNET,
  });
  const [useCustomSubnet, setUseCustomSubnet] = useState(false);
  const [configuring, setConfiguring] = useState(false);

  // Step 5 — result
  const [configResult, setConfigResult] = useState(null);

  const showIspPicker = isps.length > 1;
  const selectedIsp = isps.find((isp) => String(isp.id) === String(form.isp_id));
  const isOnline = Boolean(provisionStatus?.online);
  const stages = provisionStatus?.stages;
  const allInterfaces = discovery?.interfaces || [];
  const etherInterfaces = allInterfaces.filter((i) => i.kind === 'ether');

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const handleServiceChange = (field, value) =>
    setServiceForm((prev) => ({ ...prev, [field]: value }));

  // --- Step 2 polling: staged provisioning progress ---
  useEffect(() => {
    if (step !== 2 || !createdDevice) return undefined;
    let active = true;
    const poll = async () => {
      try {
        const token = getAccessToken();
        const status = await deviceService.getProvisionStatus(token, createdDevice.id);
        if (!active) return;
        setProvisionStatus(status);
        // Detect a stalled dial-back: the script has been fetched but the
        // WireGuard handshake never completes. This is almost always a server
        // firewall / port-forwarding issue (UDP 51821 not reaching the tunnel),
        // so surface an actionable hint instead of spinning forever.
        const s = status?.stages;
        const waitingOnTunnel =
          s?.script_fetched?.done &&
          s?.tunnel_up?.applicable !== false &&
          !s?.tunnel_up?.done;
        if (waitingOnTunnel) {
          if (!tunnelWaitStartRef.current) tunnelWaitStartRef.current = Date.now();
          else if (Date.now() - tunnelWaitStartRef.current > 150000) setTunnelStalled(true);
        } else {
          tunnelWaitStartRef.current = null;
          setTunnelStalled(false);
        }
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

  // --- Step 3: full interface discovery for the port map ---
  const loadDiscovery = async (force = false) => {
    if (!createdDevice || (discovery && !force)) return;
    setLoadingIfaces(true);
    setIfaceError(null);
    try {
      const token = getAccessToken();
      const data = await deviceService.getInterfaces(token, createdDevice.id);
      setDiscovery(data);
      const physical = data.interfaces.filter((i) => PHYSICAL_KINDS.includes(i.kind));
      setMonitored(
        data.monitored?.length
          ? data.monitored
          : physical.filter((i) => i.running && !i.disabled).map((i) => i.name)
      );
      setServiceForm((prev) => ({
        ...prev,
        // Default every non-uplink ethernet port to "both" (parity with the old
        // behaviour where all LAN ports ran both services) unless already chosen.
        port_roles: Object.fromEntries(
          data.interfaces
            .filter((i) => i.kind === 'ether' && !i.is_uplink)
            .map((i) => [i.name, prev.port_roles[i.name] || 'both'])
        ),
      }));
    } catch (e) {
      setIfaceError(e.message || 'Could not read interfaces');
    } finally {
      setLoadingIfaces(false);
    }
  };

  useEffect(() => {
    if (step === 3 && createdDevice && !discovery) loadDiscovery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, createdDevice]);

  // Live per-port throughput while the port map is on screen
  const portRates = useInterfaceRates(
    createdDevice?.id,
    step === 3 && allInterfaces.length > 0
  );

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
      setCopiedOnce(true);
      toast.success('Command copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const rerunSelfCheck = async () => {
    if (!createdDevice || rerunningCheck) return;
    setRerunningCheck(true);
    try {
      const token = getAccessToken();
      const result = await deviceService.runSelfCheck(token, createdDevice.id);
      setProvisionStatus((prev) =>
        prev
          ? { ...prev, stages: { ...prev.stages, self_check: { done: true, ...result } } }
          : prev
      );
      (result.ok ? toast.success : toast.error)(
        `Self-check: ${result.passed}/${result.total} checks passed`
      );
    } catch (e) {
      toast.error(e.message || 'Self-check failed');
    } finally {
      setRerunningCheck(false);
    }
  };

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
      const updated = await deviceService.toggleInterface(
        token, createdDevice.id, iface.name, !iface.disabled
      );
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

  const handleSavePorts = async () => {
    if (!createdDevice) return setStep(4);
    setSavingPorts(true);
    try {
      const token = getAccessToken();
      await deviceService.saveMonitoredInterfaces(token, createdDevice.id, monitored);
      setStep(4);
    } catch (e) {
      toast.error(e.message || 'Could not save the port selection');
    } finally {
      setSavingPorts(false);
    }
  };

  const setPortRole = (name, role) =>
    setServiceForm((prev) => ({ ...prev, port_roles: { ...prev.port_roles, [name]: role } }));

  const anyHotspotRole = Object.values(serviceForm.port_roles).some((r) => r === 'hotspot' || r === 'both');

  const handleApplyServices = async () => {
    const roles = Object.fromEntries(
      Object.entries(serviceForm.port_roles).filter(([, r]) => r && r !== 'skip')
    );
    if (Object.keys(roles).length === 0) {
      toast.error('Assign at least one port to Hotspot, PPPoE, or Both');
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
        port_roles: roles,
        anti_sharing: anyHotspotRole && serviceForm.anti_sharing,
        subnet,
      };
      const res = await deviceService.configureServices(token, createdDevice.id, opts);
      setConfigResult(res);
      setStep(5);
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
    else if (step === 5) finishWizard();
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

                  {/* Live provisioning checklist */}
                  {(() => {
                    const selfCheck = stages?.self_check;
                    const tunnelApplicable = stages ? stages.tunnel_up?.applicable !== false : true;
                    const checklist = [
                      {
                        id: 'copy',
                        title: 'Copy the one-shot provisioning command',
                        desc: 'Click the copy button above — the command is copied to your clipboard.',
                        done: copiedOnce || Boolean(stages?.script_fetched?.done),
                      },
                      {
                        id: 'fetch',
                        title: 'Paste in Winbox → New Terminal',
                        desc: stages?.script_fetched?.done
                          ? `Script fetched ${stages.script_fetched.count}× — provisioning started.`
                          : "Waiting for the script to start. We're listening for the first fetch.",
                        done: Boolean(stages?.script_fetched?.done),
                      },
                      ...(tunnelApplicable ? [{
                        id: 'tunnel',
                        title: 'WireGuard tunnel established',
                        desc: stages?.tunnel_up?.done
                          ? `Your MikroTik dialed back through the encrypted tunnel. ${stages.tunnel_up.detail}`
                          : 'Waiting for the router to dial back through the encrypted tunnel.',
                        done: Boolean(stages?.tunnel_up?.done),
                      }] : []),
                      {
                        id: 'reach',
                        title: 'Device online and reachable',
                        desc: stages?.reachable?.done
                          ? `${stages.reachable.detail} — two-way connectivity confirmed.`
                          : 'First reply confirms two-way connectivity.',
                        done: Boolean(stages?.reachable?.done),
                      },
                      {
                        id: 'check',
                        title: 'Configuration self-check',
                        desc: selfCheck?.done
                          ? (selfCheck.ok
                            ? `All ${selfCheck.total} checks passed — the router is configured exactly as expected.`
                            : `${selfCheck.passed}/${selfCheck.total} checks passed — review the failing items below.`)
                          : 'Verifies every artifact on the router once it is reachable.',
                        done: Boolean(selfCheck?.done && selfCheck?.ok),
                        warn: Boolean(selfCheck?.done && !selfCheck?.ok),
                      },
                    ];
                    const firstPending = checklist.findIndex((c) => !c.done && !c.warn);
                    return (
                      <div className="rounded-xl border-2 border-gray-200 bg-white p-5">
                        <div className="flex items-center justify-between mb-4">
                          <p className={`text-xs font-bold uppercase tracking-wider ${
                            provisionStatus?.complete ? 'text-emerald-600' : 'text-gray-400'
                          }`}>
                            <span className={`inline-block h-2 w-2 rounded-full mr-2 ${
                              provisionStatus?.complete ? 'bg-emerald-500' : 'bg-gray-300 animate-pulse'
                            }`} />
                            {provisionStatus?.complete ? 'Provisioning complete' : 'Provisioning in progress'}
                          </p>
                          {provisionStatus?.complete && (
                            <p className="text-xs font-medium text-gray-500">Click Next to pick ports</p>
                          )}
                        </div>
                        <ol className="space-y-0">
                          {checklist.map((item, idx) => (
                            <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                              {idx < checklist.length - 1 && (
                                <span className={`absolute left-[13px] top-7 bottom-0 w-0.5 ${
                                  item.done ? 'bg-emerald-300' : 'bg-gray-200'
                                }`} />
                              )}
                              <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${
                                item.done
                                  ? 'bg-emerald-500 text-white'
                                  : item.warn
                                    ? 'bg-amber-100 text-amber-600 border-2 border-amber-400'
                                    : idx === firstPending
                                      ? 'bg-white border-2 border-orange-400'
                                      : 'bg-gray-100 border-2 border-gray-200'
                              }`}>
                                {item.done ? (
                                  <Check className="h-4 w-4" />
                                ) : item.warn ? (
                                  <X className="h-4 w-4" />
                                ) : idx === firstPending ? (
                                  <Loader2 className="h-3.5 w-3.5 text-orange-500 animate-spin" />
                                ) : (
                                  <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                                )}
                              </span>
                              <div className="min-w-0 pt-0.5">
                                <p className={`text-sm font-semibold ${
                                  item.done ? 'text-gray-900' : item.warn ? 'text-amber-800' : 'text-gray-500'
                                }`}>
                                  {item.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>

                                {/* Stalled dial-back diagnostic */}
                                {item.id === 'tunnel' && !item.done && tunnelStalled && (
                                  <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
                                    <p className="font-semibold">
                                      The router is sending WireGuard handshakes but the server hasn&apos;t answered yet.
                                    </p>
                                    <p className="mt-1 text-amber-700">
                                      On the router, <span className="font-medium">wg-mgmt</span> will show Tx increasing
                                      with Rx 0&nbsp;B. That means UDP&nbsp;51821 is not reaching the WireGuard service on the
                                      billing server — check the server firewall (allow and forward UDP&nbsp;51821 to the
                                      WireGuard container) and any cloud-provider firewall. You can also continue anyway
                                      and finish the port map once connectivity is restored.
                                    </p>
                                  </div>
                                )}

                                {/* Self-check detail rows */}
                                {item.id === 'check' && selfCheck?.done && (
                                  <div className="mt-2 space-y-2">
                                    <button
                                      type="button"
                                      onClick={() => setSelfCheckOpen((v) => !v)}
                                      className="text-xs font-medium text-orange-600 hover:text-orange-700"
                                    >
                                      {selfCheckOpen ? 'Hide checks' : `Show ${selfCheck.total} checks`}
                                    </button>
                                    {selfCheckOpen && (
                                      <ul className="space-y-1">
                                        {(selfCheck.checks || []).map((c) => (
                                          <li key={c.id} className="flex items-start gap-1.5 text-xs">
                                            {c.ok ? (
                                              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-px" />
                                            ) : (
                                              <X className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-px" />
                                            )}
                                            <span className={c.ok ? 'text-gray-600' : 'text-rose-600 font-medium'}>
                                              {c.label}
                                              {!c.ok && c.detail ? ` — ${c.detail}` : ''}
                                            </span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <button
                                      type="button"
                                      onClick={rerunSelfCheck}
                                      disabled={rerunningCheck}
                                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 underline hover:text-gray-800 disabled:opacity-50"
                                    >
                                      {rerunningCheck && <Loader2 className="h-3 w-3 animate-spin" />}
                                      Re-run self-check
                                    </button>
                                  </div>
                                )}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </div>
                    );
                  })()}
                </motion.div>
              )}

              {/* ---------------- STEP 3: PORTS (interface discovery) ---------------- */}
              {step === 3 && (
                <motion.div key="step-3" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-sky-600 mb-1">Interface discovery</p>
                    <p className="text-base font-semibold text-gray-900">Choose what to monitor</p>
                    <p className="text-sm text-gray-500">
                      We read the router through the private tunnel, identify its model, and map the
                      live interfaces. Select only the ports that matter operationally.
                    </p>
                  </div>

                  {/* Tunnel banner */}
                  {createdDevice?.management_wg_ip || provisionStatus?.management_wg_ip ? (
                    <div className={`rounded-lg border px-4 py-2.5 text-sm flex items-center gap-2 ${
                      provisionStatus?.stages?.tunnel_up?.done
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-gray-50 border-gray-200 text-gray-600'
                    }`}>
                      <Check className="h-4 w-4 shrink-0" />
                      <span className="font-mono text-xs">
                        wg-mgmt is present · {provisionStatus?.management_wg_ip || vpnAddress} ·{' '}
                        {provisionStatus?.stages?.tunnel_up?.done ? 'running' : 'standby'}
                      </span>
                    </div>
                  ) : null}

                  {/* Device summary card */}
                  {discovery?.device && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center gap-4">
                      <div className="flex items-center justify-center h-11 w-11 rounded-lg bg-white border border-gray-200 text-gray-600 shrink-0">
                        <Router className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {discovery.device.model || createdDevice?.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {discovery.device.version && <>RouterOS {discovery.device.version}</>}
                          {discovery.device.architecture && <> · {discovery.device.architecture}</>}
                          {' '}· {discovery.device.ports} ports
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-emerald-600">
                          {discovery.counts?.active ?? 0} active
                        </p>
                        <p className="text-xs text-gray-400">of {discovery.counts?.physical ?? 0}</p>
                      </div>
                    </div>
                  )}

                  {loadingIfaces && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" /> Reading interfaces through the tunnel…
                    </div>
                  )}
                  {ifaceError && !loadingIfaces && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-center justify-between gap-3">
                      <span>Could not read interfaces yet: {ifaceError}</span>
                      <button
                        type="button"
                        onClick={() => loadDiscovery(true)}
                        className="inline-flex items-center gap-1 font-semibold text-amber-900 underline shrink-0"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </button>
                    </div>
                  )}

                  {allInterfaces.length > 0 && (
                    <>
                      {/* Filter tabs + search */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mr-1">Select</span>
                        {[
                          { id: 'active', label: `All active ${discovery?.counts?.active ?? 0}` },
                          { id: 'ether', label: `Ethernet ${discovery?.counts?.ethernet ?? 0}` },
                          { id: 'sfp', label: `SFP ${discovery?.counts?.sfp ?? 0}` },
                          { id: 'wlan', label: `Wireless ${discovery?.counts?.wireless ?? 0}` },
                          { id: 'all', label: 'All' },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setPortTab(tab.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              portTab === tab.id
                                ? 'bg-sky-50 border-sky-400 text-sky-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setPortTab('active'); setPortQuery(''); }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-white border-gray-200 text-gray-400 hover:text-gray-600"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          value={portQuery}
                          onChange={(e) => setPortQuery(e.target.value)}
                          placeholder="Filter interfaces"
                          className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        />
                      </div>

                      {/* Port map */}
                      {(() => {
                        const filtered = allInterfaces
                          .filter((i) => {
                            if (portTab === 'active') return PHYSICAL_KINDS.includes(i.kind) && i.running && !i.disabled;
                            if (portTab === 'ether') return i.kind === 'ether';
                            if (portTab === 'sfp') return i.kind === 'sfp';
                            if (portTab === 'wlan') return i.kind === 'wlan';
                            return true;
                          })
                          .filter((i) => !portQuery || i.name.toLowerCase().includes(portQuery.toLowerCase()));
                        if (filtered.length === 0) {
                          return <p className="text-xs text-gray-400 py-4 text-center">No interfaces match this filter.</p>;
                        }
                        return (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Port map</p>
                              <p className="text-xs text-gray-500">
                                {monitored.length} selected for monitoring
                              </p>
                            </div>
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
                                      selected
                                        ? 'border-sky-500 bg-sky-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                    } ${iface.disabled ? 'opacity-60' : ''}`}
                                    title={[
                                      iface.mac,
                                      iface.speed,
                                      iface.comment,
                                      iface.is_uplink ? 'uplink / WAN' : null,
                                    ].filter(Boolean).join(' · ') || iface.name}
                                  >
                                    <span className={`absolute top-2 right-2 h-2 w-2 rounded-full ${
                                      iface.disabled ? 'bg-rose-400' : iface.running ? 'bg-emerald-500' : 'bg-gray-300'
                                    }`} />
                                    <Icon className={`h-5 w-5 mx-auto ${selected ? 'text-sky-600' : 'text-gray-400'}`} />
                                    <p className="font-mono text-[11px] font-semibold text-gray-800 mt-1.5 truncate">
                                      {iface.name}
                                    </p>
                                    {portRates[iface.name] && !iface.disabled && (
                                      <p className="font-mono text-[9px] text-gray-500 mt-0.5 truncate">
                                        ↓{formatBps(portRates[iface.name].rx_bps)} ↑{formatBps(portRates[iface.name].tx_bps)}
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
                                          iface.disabled ? 'text-rose-500 hover:text-rose-700' : 'text-gray-400 hover:text-gray-600'
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
                          </div>
                        );
                      })()}
                    </>
                  )}
                </motion.div>
              )}

              {/* ---------------- STEP 4: SERVICES ---------------- */}
              {step === 4 && (
                <motion.div key="step-4" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-base font-semibold text-gray-900 flex items-center gap-1.5">
                        <Cable className="h-4 w-4 text-gray-500" /> Bridge &amp; service assignment
                      </p>
                      {loadingIfaces && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
                    </div>
                    <p className="text-sm text-gray-500 mb-3">
                      Assign each port a role: <strong>Hotspot</strong> joins the captive-portal bridge,
                      {' '}<strong>PPPoE</strong> runs a dial-up server on that port (no DHCP),
                      {' '}<strong>Both</strong> allows either.
                    </p>

                    {etherInterfaces.some((i) => i.is_uplink) && (
                      <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-800 mb-3">
                        <Info className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                        The <strong>uplink / WAN</strong> port (internet feed) is hidden — it is never assigned to a service.
                      </div>
                    )}

                    {ifaceError ? (
                      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500">
                        Interfaces will be read once the router is online. You can still apply config — the uplink is left untouched.
                      </div>
                    ) : etherInterfaces.filter((i) => !i.is_uplink).length === 0 && !loadingIfaces ? (
                      <p className="text-xs text-gray-400">No assignable ethernet interfaces detected yet.</p>
                    ) : (
                      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                        <div className="hidden sm:flex items-center px-4 py-2 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          <span className="flex-1">Interface</span>
                          <span className="w-24">Status</span>
                          <span className="w-56">Assign to</span>
                        </div>
                        {etherInterfaces.filter((i) => !i.is_uplink).map((iface) => {
                          const role = serviceForm.port_roles[iface.name] || 'skip';
                          const active = iface.running && !iface.disabled;
                          return (
                            <div key={iface.name} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Network className="h-4 w-4 text-gray-400 shrink-0" />
                                <span className="font-mono font-medium text-gray-800">{iface.name}</span>
                              </div>
                              <div className="w-24 flex items-center gap-1.5 text-xs shrink-0">
                                <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                <span className="text-gray-500">{iface.disabled ? 'Disabled' : iface.running ? 'Active' : 'Inactive'}</span>
                              </div>
                              <select
                                value={role}
                                onChange={(e) => setPortRole(iface.name, e.target.value)}
                                className="sm:w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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

                    {anyHotspotRole && (
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

              {/* ---------------- STEP 5: DONE ---------------- */}
              {step === 5 && (
                <motion.div key="step-5" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} className="space-y-5">
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
            {step === 5 ? (
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
                      {isOnline ? 'Pick ports' : 'Continue anyway'}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </button>
                  </div>
                )}

                {step === 3 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(4)}
                      className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePorts}
                      disabled={savingPorts || loadingIfaces}
                      className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 shadow-sm disabled:opacity-50"
                    >
                      {savingPorts ? (
                        <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Saving…</>
                      ) : (
                        <>Continue to services<ChevronRight className="h-4 w-4 ml-1" /></>
                      )}
                    </button>
                  </div>
                )}

                {step === 4 && (
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
