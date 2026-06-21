import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Wifi,
  KeyRound,
  Settings2,
  CheckCircle2,
  Router,
  MapPin,
  Copy,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import deviceService from '../../services/deviceService';

const STEPS = [
  {
    id: 1,
    title: 'Connection',
    subtitle: 'Basic device information',
    icon: Wifi,
  },
  {
    id: 2,
    title: 'API Access',
    subtitle: 'Router credentials & API port',
    icon: KeyRound,
  },
  {
    id: 3,
    title: 'Service Setup',
    subtitle: 'Services & final review',
    icon: Settings2,
  },
];

const emptyForm = {
  device_name: '',
  device_ip: '',
  device_model: '',
  location: '',
  isp_id: '',
  username: '',
  password: '',
  api_key: '',
  api_port: 8728,
  notes: '',
  services: {
    pppoe: false,
    hotspot: false,
  },
};

const MIKROTIK_API_TIP = `/ip service enable api
/ip service set api port=8728 disabled=no`;

export default function AddDeviceWizard({ isps = [], onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    isp_id: isps[0] ? String(isps[0].id) : '',
  }));

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
        toast.error('Enter the device IP address or hostname');
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
      if (!form.username.trim()) {
        toast.error('Enter the router username');
        return false;
      }
      if (!form.password) {
        toast.error('Enter the router password');
        return false;
      }
      if (!form.api_key.trim()) {
        toast.error('Enter the API key');
        return false;
      }
    }

    if (currentStep === 3) {
      if (!form.services.pppoe && !form.services.hotspot) {
        toast.error('Select at least one service type (PPPoE or Hotspot)');
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

  const copyApiTip = async () => {
    try {
      await navigator.clipboard.writeText(MIKROTIK_API_TIP);
      toast.success('API setup commands copied');
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
        api_key: form.api_key.trim(),
        api_port: Number(form.api_port) || 8728,
        location: form.location.trim(),
        notes: buildNotes(),
      };
      if (form.isp_id) {
        payload.isp_id = Number(form.isp_id);
      }

      await deviceService.createDevice(token, payload);
      toast.success('Device registered successfully');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedIsp = isps.find((isp) => String(isp.id) === String(form.isp_id));

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
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
            >
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
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="ml-3 hidden sm:block min-w-0">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isActive ? 'text-blue-600' : isComplete ? 'text-green-600' : 'text-gray-400'
                        }`}
                      >
                        {item.title}
                      </p>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-3 sm:mx-4 ${
                        step > item.id ? 'bg-green-500' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 flex gap-3">
                  <Router className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Connection details</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Use a clear device identity so you can find this router later in reports and monitoring.
                    </p>
                  </div>
                </div>

                {isps.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">ISP</label>
                    <select
                      value={form.isp_id}
                      onChange={(e) => handleChange('isp_id', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {isps.map((isp) => (
                        <option key={isp.id} value={isp.id}>{isp.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Mikrotik Identity
                  </label>
                  <input
                    type="text"
                    value={form.device_name}
                    onChange={(e) => handleChange('device_name', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Shop-Router-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">A friendly name for this router</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      IP / Hostname
                    </label>
                    <input
                      type="text"
                      value={form.device_ip}
                      onChange={(e) => handleChange('device_ip', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="192.168.88.1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Model</label>
                    <input
                      type="text"
                      value={form.device_model}
                      onChange={(e) => handleChange('device_model', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="RB4011"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Location / Site
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={form.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Main Office, Nairobi"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <Info className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-emerald-900">Enable API on the router</p>
                        <p className="text-sm text-emerald-800 mt-1">
                          Run these commands in the Mikrotik terminal before continuing:
                        </p>
                        <pre className="mt-3 text-xs bg-emerald-900 text-emerald-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                          {MIKROTIK_API_TIP}
                        </pre>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={copyApiTip}
                      className="shrink-0 inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copy
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => handleChange('username', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="admin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
                    <input
                      type="text"
                      value={form.api_key}
                      onChange={(e) => handleChange('api_key', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="api_key_001"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">API Port</label>
                    <input
                      type="number"
                      value={form.api_port}
                      onChange={(e) => handleChange('api_port', e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="1"
                      max="65535"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 mb-3">Service types</p>
                  <p className="text-sm text-gray-500 mb-4">
                    Choose which services this router will run. This controls how customers authenticate on the device.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      form.services.pppoe ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={form.services.pppoe}
                        onChange={(e) => handleServiceChange('pppoe', e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">PPPoE</p>
                        <p className="text-sm text-gray-500 mt-0.5">Broadband dial-up authentication</p>
                      </div>
                    </label>
                    <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                      form.services.hotspot ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input
                        type="checkbox"
                        checked={form.services.hotspot}
                        onChange={(e) => handleServiceChange('hotspot', e.target.checked)}
                        className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-medium text-gray-900">Hotspot</p>
                        <p className="text-sm text-gray-500 mt-0.5">Captive portal & voucher access</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Site notes, VLAN details, or interface info..."
                  />
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-900 mb-3">Review configuration</p>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Identity</dt>
                      <dd className="font-medium text-gray-900">{form.device_name || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">IP / Hostname</dt>
                      <dd className="font-medium text-gray-900">{form.device_ip || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Model</dt>
                      <dd className="font-medium text-gray-900">{form.device_model || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Location</dt>
                      <dd className="font-medium text-gray-900">{form.location || '—'}</dd>
                    </div>
                    {selectedIsp && (
                      <div>
                        <dt className="text-gray-500">ISP</dt>
                        <dd className="font-medium text-gray-900">{selectedIsp.name}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-gray-500">Username</dt>
                      <dd className="font-medium text-gray-900">{form.username || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">API Port</dt>
                      <dd className="font-medium text-gray-900">{form.api_port || 8728}</dd>
                    </div>
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
            {step === 1 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </>
            )}
          </button>

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
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
              {submitting ? 'Registering...' : 'Register Device'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
