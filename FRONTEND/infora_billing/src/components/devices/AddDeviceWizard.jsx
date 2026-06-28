import React, { useState } from 'react';
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
  Copy,
  Info,
  Download,
  KeyRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';
import {
  getRadiusServerHost,
  MIKROTIK_API_COMMANDS,
} from '../../lib/mikrotikProvision';

const STEPS = [
  {
    id: 1,
    title: 'Connection',
    subtitle: 'Router identity & NAS IP',
    icon: Wifi,
  },
  {
    id: 2,
    title: 'RADIUS Setup',
    subtitle: 'Provisioning commands for the router',
    icon: Shield,
  },
  {
    id: 3,
    title: 'Services',
    subtitle: 'PPPoE / Hotspot & register',
    icon: Settings2,
  },
];

const emptyForm = {
  device_name: '',
  device_ip: '',
  device_model: '',
  location: '',
  isp_id: '',
  username: 'admin',
  password: '',
  api_key: '',
  api_port: 8728,
  notes: '',
  services: {
    pppoe: true,
    hotspot: false,
  },
  management_wg_enabled: false,
};

export default function AddDeviceWizard({ isps = [], onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [createdDevice, setCreatedDevice] = useState(null);
  const [showApiFields, setShowApiFields] = useState(false);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    isp_id: isps[0] ? String(isps[0].id) : '',
  }));

  const selectedIsp = isps.find((isp) => String(isp.id) === String(form.isp_id));

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleServiceChange = (service, checked) => {
    setForm((prev) => ({
      ...prev,
      services: { ...prev.services, [service]: checked },
    }));
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!form.device_name.trim()) {
        toast.error('Enter a device name (identity)');
        return false;
      }
      if (!form.device_ip.trim()) {
        toast.error('Enter the router IP — this becomes the NAS IP in FreeRADIUS');
        return false;
      }
      if (!form.device_model.trim()) {
        toast.error('Enter the device model');
        return false;
      }
      if (!form.location.trim()) {
        toast.error('Enter the device location');
        return false;
      }
      if (isps.length > 0 && !form.isp_id) {
        toast.error('Select an ISP');
        return false;
      }
    }

    if (currentStep === 2) {
      if (!form.services.pppoe && !form.services.hotspot) {
        toast.error('Select at least one service (PPPoE or Hotspot) for RADIUS');
        return false;
      }
    }

    if (currentStep === 3) {
      if (!form.username.trim()) {
        toast.error('Enter the router admin username');
        return false;
      }
      if (!form.password) {
        toast.error('Enter the router admin password (for API monitoring)');
        return false;
      }
    }

    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const goBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const buildNotes = () => {
    const services = [];
    if (form.services.pppoe) services.push('PPPoE');
    if (form.services.hotspot) services.push('Hotspot');
    const serviceLine = `Services: ${services.join(', ')}`;
    return form.notes.trim() ? `${serviceLine}\n${form.notes.trim()}` : serviceLine;
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setSubmitting(true);
    try {
      const token = getAccessToken();
      const payload = {
        device_name: form.device_name.trim(),
        device_ip: form.device_ip.trim(),
        device_model: form.device_model.trim(),
        username: form.username.trim(),
        password: form.password,
        api_key: form.api_key.trim() || undefined,
        api_port: Number(form.api_port) || 8728,
        location: form.location.trim(),
        notes: buildNotes(),
      };
      if (form.isp_id) {
        payload.isp_id = Number(form.isp_id);
      }
      payload.management_wg_enabled = Boolean(form.management_wg_enabled);

      const created = await deviceService.createDevice(token, payload);
      const deviceId = created.device?.id || created.id;
      toast.success('Device registered');
      if (deviceId) {
        setCreatedDevice({ id: deviceId, name: form.device_name.trim() });
      } else {
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadRadiusScript = async () => {
    if (!createdDevice) return;
    try {
      const token = getAccessToken();
      if (form.management_wg_enabled) {
        await deviceService.downloadManagementTunnelScript(token, createdDevice.id, createdDevice.name);
        toast.success('Management tunnel script downloaded');
      }
      await deviceService.downloadRadiusScript(token, createdDevice.id, createdDevice.name);
      toast.success('RADIUS script downloaded — import on MikroTik');
    } catch (e) {
      toast.error(e.message || 'Download failed');
    }
  };

  const finishWizard = () => {
    onSuccess?.();
    onClose();
  };

  if (createdDevice) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8"
        >
          <div className="text-center mb-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold text-slate-900 mt-4">Router registered</h2>
            <p className="text-sm text-slate-600 mt-2">
              Import the script on <strong>{createdDevice.name}</strong> to point PPPoE/Hotspot at FreeRADIUS.
            </p>
          </div>
          <ol className="text-sm text-slate-600 text-left space-y-2 mb-6 list-decimal list-inside">
            {form.management_wg_enabled && (
              <li>Import the <strong>management tunnel</strong> .rsc first (NAT / remote routers)</li>
            )}
            <li>Download the <strong>RADIUS .rsc</strong> file (includes your real ISP secret)</li>
            <li>On MikroTik: <code className="text-xs bg-slate-100 px-1 rounded">/import file-name=...</code></li>
            <li>Test PPPoE login with a provisioned customer email</li>
          </ol>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={downloadRadiusScript}
              className="w-full inline-flex items-center justify-center py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download RADIUS .rsc
            </button>
            <button
              type="button"
              onClick={finishWizard}
              className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-medium"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Link a Mikrotik Device</h2>
              <p className="text-sm text-gray-500 mt-1">
                Step {step} of {STEPS.length} — {STEPS[step - 1].subtitle}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-lg p-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center">
            {STEPS.map((item, index) => {
              const Icon = item.icon;
              const isActive = step === item.id;
              const isComplete = step > item.id;

              return (
                <React.Fragment key={item.id}>
                  <div className="flex items-center min-w-0">
                    <div
                      className={`flex items-center justify-center w-9 h-9 rounded-full border-2 shrink-0 transition-colors ${
                        isComplete
                          ? 'bg-green-500 border-green-500 text-white'
                          : isActive
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <div className="ml-3 hidden sm:block min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isActive ? 'text-indigo-600' : isComplete ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {item.title}
                      </p>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-3 sm:mx-4 ${step > item.id ? 'bg-green-500' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex gap-3">
                  <Router className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">NAS registration</p>
                    <p className="text-sm text-blue-700 mt-1">
                      The <strong>IP / Hostname</strong> must match what FreeRADIUS sees as this router&apos;s NAS address ({' '}
                      <code className="text-xs">nasipaddress</code> in accounting).
                    </p>
                  </div>
                </div>

                {isps.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">ISP</label>
                    <select
                      value={form.isp_id}
                      onChange={(e) => handleChange('isp_id', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      {isps.map((isp) => (
                        <option key={isp.id} value={isp.id}>{isp.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Mikrotik Identity</label>
                  <input
                    type="text"
                    value={form.device_name}
                    onChange={(e) => handleChange('device_name', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Shop-Router-1"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">NAS IP / Hostname *</label>
                    <input
                      type="text"
                      value={form.device_ip}
                      onChange={(e) => handleChange('device_ip', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="192.168.88.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Model</label>
                    <input
                      type="text"
                      value={form.device_model}
                      onChange={(e) => handleChange('device_model', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="RB4011"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Location / Site</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Main Office, Nairobi"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4">
                  <div className="flex gap-3 min-w-0">
                    <Shield className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-indigo-900">RADIUS provisioning</p>
                      <p className="text-sm text-indigo-800 mt-1">
                        After registering the router, download the <strong>.rsc</strong> file from the confirmation
                        screen. It contains your real ISP RADIUS secret — do not copy placeholder commands manually.
                      </p>
                      <p className="text-xs text-indigo-700 mt-2">
                        FreeRADIUS server: <span className="font-mono font-semibold">{getRadiusServerHost()}</span>
                        {form.management_wg_enabled && (
                          <> · RADIUS via management tunnel: <span className="font-mono">10.250.0.1</span></>
                        )}
                        {selectedIsp && (
                          <> · ISP: <strong>{selectedIsp.name}</strong></>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${
                  form.management_wg_enabled ? 'border-violet-500 bg-violet-50' : 'border-gray-200'
                }`}>
                  <input
                    type="checkbox"
                    checked={form.management_wg_enabled}
                    onChange={(e) => handleChange('management_wg_enabled', e.target.checked)}
                    className="mt-1 h-4 w-4 text-violet-600 rounded"
                  />
                  <div>
                    <p className="font-medium text-gray-900">Management WireGuard tunnel</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      For routers behind NAT — tunnel RADIUS over 10.250.0.0/24 instead of public UDP
                    </p>
                  </div>
                </label>

                <div>
                  <p className="text-sm font-medium text-gray-900 mb-3">Services to provision</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${
                      form.services.pppoe ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={form.services.pppoe}
                        onChange={(e) => handleServiceChange('pppoe', e.target.checked)}
                        className="mt-1 h-4 w-4 text-indigo-600 rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900">PPPoE</p>
                        <p className="text-xs text-gray-500 mt-0.5">/ppp aaa use-radius=yes</p>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer ${
                      form.services.hotspot ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={form.services.hotspot}
                        onChange={(e) => handleServiceChange('hotspot', e.target.checked)}
                        className="mt-1 h-4 w-4 text-indigo-600 rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Hotspot</p>
                        <p className="text-xs text-gray-500 mt-0.5">Hotspot profile use-radius=yes</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-sm text-amber-900">
                  <Info className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                  NAS IP <strong>{form.device_ip || '—'}</strong> must be listed in FreeRADIUS{' '}
                  <code className="text-xs">clients.conf</code> with the same shared secret as the router.
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4 flex gap-3">
                  <KeyRound className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">API access (monitoring only)</p>
                    <p className="text-sm text-emerald-800 mt-1">
                      Used to sync stats from the router — <strong>not</strong> for customer PPPoE auth (that is RADIUS).
                    </p>
                    <pre className="mt-2 text-xs bg-emerald-900 text-emerald-50 rounded-lg p-2 overflow-x-auto">{MIKROTIK_API_COMMANDS}</pre>
                    <button
                      type="button"
                      onClick={() => copyText(MIKROTIK_API_COMMANDS, 'API commands')}
                      className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                    >
                      Copy API enable commands
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Router admin username *</label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => handleChange('username', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Router admin password *</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowApiFields(!showApiFields)}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  {showApiFields ? '− Hide' : '+ Show'} optional API key & port
                </button>

                {showApiFields && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key (optional)</label>
                      <input
                        type="text"
                        value={form.api_key}
                        onChange={(e) => handleChange('api_key', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">API Port</label>
                      <input
                        type="number"
                        value={form.api_port}
                        onChange={(e) => handleChange('api_port', e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
                        min="1"
                        max="65535"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg"
                    placeholder="VLAN, interface name, etc."
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
                  <p className="font-semibold text-gray-900 mb-2">Summary</p>
                  <dl className="grid grid-cols-2 gap-2">
                    <dt className="text-gray-500">NAS IP</dt>
                    <dd className="font-mono font-medium">{form.device_ip || '—'}</dd>
                    <dt className="text-gray-500">RADIUS server</dt>
                    <dd className="font-mono text-xs">{getRadiusServerHost()}</dd>
                    <dt className="text-gray-500">Services</dt>
                    <dd>
                      {[form.services.pppoe && 'PPPoE', form.services.hotspot && 'Hotspot'].filter(Boolean).join(', ') || '—'}
                    </dd>
                  </dl>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={step === 1 ? onClose : goBack}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={submitting}
          >
            {step === 1 ? 'Cancel' : (<><ChevronLeft className="h-4 w-4 mr-1" />Back</>)}
          </button>

          {step < STEPS.length ? (
            <button type="button" onClick={goNext} className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
              Next step
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Register & get .rsc'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
