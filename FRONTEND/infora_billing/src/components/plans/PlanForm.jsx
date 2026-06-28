import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Wifi,
  Router,
  Gift,
  Layers,
  ChevronDown,
  Zap,
  ShieldCheck,
  Radio,
  Network,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { createPlan, updatePlan, getPlan } from '../../services/planService';

const PACKAGE_TYPES = [
  {
    key: 'hotspot',
    label: 'Hotspot',
    description: 'Captive portal / voucher',
    icon: Wifi,
    selectedRing: 'ring-teal-500 border-teal-500',
    selectedBg: 'bg-teal-50',
    iconBg: 'bg-teal-500',
  },
  {
    key: 'pppoe',
    label: 'PPPoE',
    description: 'Monthly subscription',
    icon: Router,
    selectedRing: 'ring-violet-500 border-violet-500',
    selectedBg: 'bg-violet-50',
    iconBg: 'bg-violet-500',
  },
  {
    key: 'trial',
    label: 'Trial',
    description: 'Free access, no payment',
    icon: Gift,
    selectedRing: 'ring-amber-400 border-amber-400',
    selectedBg: 'bg-amber-50',
    iconBg: 'bg-amber-500',
  },
  {
    key: 'bundle',
    label: 'Bundle',
    description: 'Data + time combo',
    icon: Layers,
    selectedRing: 'ring-blue-500 border-blue-500',
    selectedBg: 'bg-blue-50',
    iconBg: 'bg-blue-500',
  },
];

const HOTSPOT_DURATIONS = [
  { label: '1 hour', hours: 1 },
  { label: '3 hours', hours: 3 },
  { label: '12 hours', hours: 12 },
  { label: '24 hours (1 day)', hours: 24 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
];

const PPPOE_DURATIONS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

function parseMbpsInput(value) {
  if (!value) return null;
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function formatMbpsInput(mbps) {
  if (mbps == null || mbps === '') return '';
  return `${mbps}M`;
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-5">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
      {children}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
  );
}

const FUP_RESET_CYCLES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function AccordionRow({ icon: Icon, iconClass, title, description, open, onToggle, badge, children }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-slate-50/80 transition-colors"
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="text-sm text-slate-500 mt-0.5">{description}</p>
        </div>
        {badge && (
          <span className="shrink-0 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
            {badge}
          </span>
        )}
        <ChevronDown
          className={`h-5 w-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-slate-100">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwitchToggle({ checked, onChange, label, size = 'md' }) {
  const sizes = {
    md: { track: 'h-7 w-12', thumb: 'h-6 w-6', on: 'translate-x-5' },
    lg: { track: 'h-8 w-14', thumb: 'h-7 w-7', on: 'translate-x-6' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative rounded-full transition-colors shrink-0 ${s.track} ${
          checked ? 'bg-emerald-500' : 'bg-slate-200'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow transition-transform ${s.thumb} ${
            checked ? s.on : 'translate-x-0'
          }`}
        />
      </button>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  );
}

function ActiveToggle({ checked, onChange }) {
  return (
    <SwitchToggle
      checked={checked}
      onChange={onChange}
      label={
        <>
          <span className="font-medium text-emerald-600">Active</span>
          {' — visible to clients and resellers'}
        </>
      }
    />
  );
}

function FieldHint({ children }) {
  return <p className="text-xs text-slate-500 mt-2 leading-relaxed">{children}</p>;
}

function FairUsagePolicySection({ form, setField, onInput, open, onToggle, standalone = false }) {
  const isConfigured =
    form.fup_enabled && form.fup_threshold_gb && form.fup_throttled_speed?.trim();
  const fieldsDisabled = !form.fup_enabled;
  const inputDisabledClass = fieldsDisabled
    ? 'opacity-50 cursor-not-allowed bg-slate-50'
    : '';

  const card = (
    <div className={`rounded-xl border border-slate-200 bg-white overflow-hidden ${standalone ? 'shadow-sm' : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
          <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-semibold text-[15px] text-slate-900">Fair Usage Policy (FUP)</p>
          <p className="text-sm text-slate-500 mt-0.5 leading-snug">
            Throttle speed after users consume a data threshold
          </p>
        </div>
        {isConfigured && (
          <span className="shrink-0 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
            Configured
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-4 border-t border-slate-100 space-y-5">
              <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                <SwitchToggle
                  size="lg"
                  checked={form.fup_enabled}
                  onChange={(v) => setField('fup_enabled', v)}
                />
                <span className="text-sm font-medium text-slate-800">Enable FUP</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                <div>
                  <FieldLabel required>Data threshold</FieldLabel>
                  <div
                    className={`flex rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-500/20 ${inputDisabledClass}`}
                  >
                    <input
                      type="number"
                      name="fup_threshold_gb"
                      value={form.fup_threshold_gb}
                      onChange={onInput}
                      disabled={fieldsDisabled}
                      min="0"
                      step="0.1"
                      placeholder="e.g., 50"
                      className="flex-1 min-w-0 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border-0 focus:ring-0 bg-transparent disabled:cursor-not-allowed"
                    />
                    <span className="inline-flex items-center px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-l border-slate-200 bg-slate-50">
                      GB
                    </span>
                  </div>
                  <FieldHint>Speed drops after this usage</FieldHint>
                </div>

                <div>
                  <FieldLabel required>Throttled speed</FieldLabel>
                  <input
                    type="text"
                    name="fup_throttled_speed"
                    value={form.fup_throttled_speed}
                    onChange={onInput}
                    disabled={fieldsDisabled}
                    placeholder="e.g., 1M"
                    className={`w-full px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 rounded-lg bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed ${inputDisabledClass}`}
                  />
                  <FieldHint>Speed after threshold is reached</FieldHint>
                </div>

                <div>
                  <FieldLabel>Reset cycle</FieldLabel>
                  <div className="relative">
                    <select
                      name="fup_reset_cycle"
                      value={form.fup_reset_cycle}
                      onChange={onInput}
                      disabled={fieldsDisabled}
                      className={`w-full appearance-none px-3 py-2.5 pr-9 text-sm text-slate-900 border border-slate-200 rounded-lg bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed ${inputDisabledClass}`}
                    >
                      {FUP_RESET_CYCLES.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (!standalone) return card;

  return card;
}

const initialForm = {
  name: '',
  plan_type: 'hotspot',
  duration_hours: '',
  billing_cycle_days: '30',
  upload_speed: '',
  download_speed: '',
  price: '',
  devices: '1',
  is_active: true,
  popular: false,
  burst_speed: '',
  burst_threshold_pct: '80',
  burst_time_seconds: '8',
  fup_enabled: false,
  fup_threshold_gb: '',
  fup_throttled_speed: '',
  fup_reset_cycle: 'monthly',
  router_price_mikrotik: '',
  bundle_total_gb: '',
  session_timeout: '',
  idle_timeout: '',
  static_ip: '',
};

export default function PlanForm() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(planId);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [openSections, setOpenSections] = useState({
    burst: false,
    fup: true,
    router: false,
    advanced: false,
  });

  useEffect(() => {
    if (isEdit) loadPlan();
  }, [planId]);

  const loadPlan = async () => {
    try {
      setLoading(true);
      const response = await getPlan(planId);
      if (!response.success) return;
      const plan = response.data;
      const upload = plan.upload_mbps ?? parseMbpsInput(plan.speed);
      const download = plan.download_mbps ?? plan.bandwidth_limit ?? parseMbpsInput(plan.speed);

      let devices = '1';
      if (Array.isArray(plan.features)) {
        const deviceLine = plan.features.find((f) => /device/i.test(f));
        if (deviceLine) {
          const m = deviceLine.match(/(\d+)/);
          devices = m ? m[1] : deviceLine.toLowerCase().includes('unlimited') ? 'unlimited' : '1';
        }
      }

      const policy = plan.package_policy || {};

      setForm({
        name: plan.name || '',
        plan_type: plan.plan_type || 'pppoe',
        duration_hours: plan.duration_hours ?? '',
        billing_cycle_days: plan.billing_cycle_days ?? '30',
        upload_speed: formatMbpsInput(upload),
        download_speed: formatMbpsInput(download),
        price: plan.price ?? '',
        devices,
        is_active: plan.is_active !== false,
        popular: plan.popular || false,
        burst_speed: policy.burst_speed ? formatMbpsInput(policy.burst_speed) : '',
        burst_threshold_pct: String(policy.burst_threshold_pct ?? '80'),
        burst_time_seconds: String(policy.burst_time_seconds ?? '8'),
        fup_enabled: Boolean(policy.fup_enabled),
        fup_threshold_gb: policy.fup_threshold_gb ?? plan.data_limit ?? '',
        fup_throttled_speed: policy.fup_throttled_speed
          ? String(policy.fup_throttled_speed)
          : '',
        fup_reset_cycle: policy.fup_reset_cycle || 'monthly',
        router_price_mikrotik: policy.router_price_mikrotik ?? '',
        bundle_total_gb:
          plan.plan_type === 'bundle' && plan.data_limit != null ? plan.data_limit : '',
        session_timeout: plan.session_timeout ?? '',
        idle_timeout: plan.idle_timeout ?? '',
        static_ip: plan.static_ip || '',
      });

      if (policy.fup_enabled) {
        setOpenSections((s) => ({ ...s, fup: true }));
      }
    } catch {
      toast.error('Failed to load package');
    } finally {
      setLoading(false);
    }
  };

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const onInput = (e) => {
    const { name, value, type, checked } = e.target;
    setField(name, type === 'checkbox' ? checked : value);
  };

  const handlePlanTypeSelect = (key) => {
    setForm((prev) => ({
      ...prev,
      plan_type: key,
      price: key === 'trial' ? '0' : prev.price === '0' && key !== 'trial' ? '' : prev.price,
      bundle_total_gb: key === 'bundle' ? prev.bundle_total_gb : '',
    }));
  };

  const durationOptions = useMemo(() => {
    if (form.plan_type === 'pppoe') return PPPOE_DURATIONS;
    return HOTSPOT_DURATIONS;
  }, [form.plan_type]);

  const durationValue = useMemo(() => {
    if (form.plan_type === 'pppoe') {
      return String(form.billing_cycle_days || '');
    }
    return String(form.duration_hours || '');
  }, [form.plan_type, form.duration_hours, form.billing_cycle_days]);

  const onDurationChange = (e) => {
    const value = e.target.value;
    if (form.plan_type === 'pppoe') {
      setField('billing_cycle_days', value);
    } else {
      setField('duration_hours', value);
    }
  };

  const buildSpeedLabel = () => {
    const down = parseMbpsInput(form.download_speed);
    const up = parseMbpsInput(form.upload_speed);
    if (down && up && up !== down) return `${up}/${down}M`;
    if (down) return `${down} Mbps`;
    return form.download_speed || '—';
  };

  const buildFeatures = () => {
    const down = parseMbpsInput(form.download_speed);
    const up = parseMbpsInput(form.upload_speed) || down;
    const dataCapGb = form.fup_enabled && form.fup_threshold_gb
      ? Number(form.fup_threshold_gb)
      : null;
    const bundleGb = form.plan_type === 'bundle' && form.bundle_total_gb
      ? Number(form.bundle_total_gb)
      : null;

    const features = {
      download_speed: down ? `${down} Mbps` : form.download_speed,
      upload_speed: up ? `${up} Mbps` : form.upload_speed,
      devices: form.devices === 'unlimited' ? 'Unlimited' : Number(form.devices) || 1,
      data_cap: bundleGb
        ? `${bundleGb} GB`
        : dataCapGb
          ? `${dataCapGb} GB`
          : 'Unlimited',
    };

    if (form.burst_speed) {
      features.burst_speed_mbps = parseMbpsInput(form.burst_speed);
      if (form.burst_threshold_pct) {
        features.burst_threshold_pct = Number(form.burst_threshold_pct);
      }
      if (form.burst_time_seconds) {
        features.burst_time_seconds = Number(form.burst_time_seconds);
      }
    }

    if (form.fup_enabled) {
      features.fup_enabled = true;
      features.fup_threshold_gb = Number(form.fup_threshold_gb);
      features.fup_throttled_speed = form.fup_throttled_speed;
      features.fup_reset_cycle = form.fup_reset_cycle;
    }

    if (form.router_price_mikrotik !== '' && form.router_price_mikrotik != null) {
      features.router_price_mikrotik = Number(form.router_price_mikrotik);
    }

    return features;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Package name is required');
      return;
    }
    const download = parseMbpsInput(form.download_speed);
    if (!download && !form.download_speed.trim()) {
      toast.error('Download speed is required');
      return;
    }
    const price = parseFloat(form.price);
    if (form.plan_type !== 'trial' && (Number.isNaN(price) || price < 0)) {
      toast.error('Valid price is required');
      return;
    }
    if (form.plan_type === 'trial' && Number.isNaN(price)) {
      toast.error('Enter 0 for a free trial');
      return;
    }

    if (form.plan_type === 'bundle' && !form.bundle_total_gb) {
      toast.error('Bundle requires a total data limit (GB)');
      return;
    }

    if (form.fup_enabled) {
      if (!form.fup_threshold_gb || !form.fup_throttled_speed.trim()) {
        toast.error('FUP requires data threshold and throttled speed');
        return;
      }
    }

    const speed =
      download && parseMbpsInput(form.upload_speed)
        ? `${parseMbpsInput(form.upload_speed)}/${download}M`
        : download
          ? `${download} Mbps`
          : form.download_speed;

    try {
      setSaving(true);
      const payload = {
        name: form.name.trim(),
        speed,
        price: form.plan_type === 'trial' ? price || 0 : price,
        plan_type: form.plan_type,
        features: buildFeatures(),
        popular: form.popular,
        is_active: form.is_active,
        bandwidth_limit: download || null,
        data_limit:
          form.plan_type === 'bundle' && form.bundle_total_gb
            ? Number(form.bundle_total_gb)
            : form.fup_enabled && form.fup_threshold_gb
              ? Number(form.fup_threshold_gb)
              : null,
        duration_hours:
          form.plan_type === 'hotspot' || form.plan_type === 'trial' || form.plan_type === 'bundle'
            ? form.duration_hours
              ? Number(form.duration_hours)
              : null
            : null,
        billing_cycle_days:
          form.plan_type === 'pppoe'
            ? Number(form.billing_cycle_days) || 30
            : null,
        session_timeout: form.session_timeout ? Number(form.session_timeout) : null,
        idle_timeout: form.idle_timeout ? Number(form.idle_timeout) : null,
        static_ip: form.static_ip?.trim() || null,
      };

      const response = isEdit ? await updatePlan(planId, payload) : await createPlan(payload);
      if (response.success) {
        toast.success(isEdit ? 'Package updated' : 'Package created');
        navigate('/plans');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save package');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to="/plans"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to packages
          </Link>
          <p className="text-sm font-semibold text-violet-600 uppercase tracking-wider">Pricing</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">
            {isEdit ? 'Edit Package' : 'Create Package'}
          </h1>
          <p className="text-slate-600 mt-1">
            {isEdit
              ? 'Update pricing, speed limits, and availability for this package.'
              : 'Create a new internet package for your clients.'}
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          {/* Basic configuration */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader title="Basic configuration" />
            <div className="space-y-6">
              <div>
                <FieldLabel required>Type of package</FieldLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {PACKAGE_TYPES.map((type) => {
                    const Icon = type.icon;
                    const selected = form.plan_type === type.key;
                    return (
                      <button
                        key={type.key}
                        type="button"
                        onClick={() => handlePlanTypeSelect(type.key)}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? `${type.selectedBg} ${type.selectedRing} ring-2`
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${
                            selected ? type.iconBg : 'bg-slate-300'
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 text-sm block">{type.label}</span>
                          <span className="text-xs text-slate-500 mt-0.5 leading-snug block">{type.description}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {form.plan_type === 'trial' && (
                  <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3">
                    Trial packages are always free — no payment required from users.
                  </p>
                )}
              </div>

              <div>
                <FieldLabel required>Name of package</FieldLabel>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={onInput}
                  placeholder="Eg. 1 Hour Voucher"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
              </div>

              <div>
                <FieldLabel required>Duration</FieldLabel>
                <select
                  value={durationValue}
                  onChange={onDurationChange}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-900 bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                >
                  <option value="">Select duration…</option>
                  {durationOptions.map((opt) => (
                    <option
                      key={opt.hours ?? opt.days}
                      value={String(opt.hours ?? opt.days)}
                    >
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Speed & performance */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader
              title="Speed & performance"
              subtitle={
                form.plan_type === 'bundle'
                  ? 'Set the bundle data cap and bandwidth limits.'
                  : 'Set upload and download caps applied via RADIUS / MikroTik rate limits.'
              }
            />
            {form.plan_type === 'bundle' && (
              <div className="mb-6">
                <FieldLabel required>Total limit (GB)</FieldLabel>
                <div className="flex max-w-xl rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <input
                    type="number"
                    name="bundle_total_gb"
                    value={form.bundle_total_gb}
                    onChange={onInput}
                    min="0"
                    step="0.1"
                    placeholder="Eg. 10"
                    className="flex-1 px-4 py-3 border-0 focus:ring-0 text-slate-900 placeholder:text-slate-400"
                  />
                  <span className="inline-flex items-center px-4 bg-slate-50 text-sm font-semibold text-slate-500 border-l border-slate-200">
                    GB
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">The total data limit of the bundle</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <FieldLabel required>Upload speed</FieldLabel>
                <input
                  type="text"
                  name="upload_speed"
                  value={form.upload_speed}
                  onChange={onInput}
                  placeholder="Eg. 1M"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
                <p className="text-xs text-slate-500 mt-2">Maximum upload speed per second.</p>
              </div>
              <div>
                <FieldLabel required>Download speed</FieldLabel>
                <input
                  type="text"
                  name="download_speed"
                  value={form.download_speed}
                  onChange={onInput}
                  placeholder="Eg. 10M"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                />
                <p className="text-xs text-slate-500 mt-2">Maximum download speed per second.</p>
              </div>
            </div>
            {(form.upload_speed || form.download_speed) && (
              <p className="mt-4 text-sm text-slate-500">
                Preview: <span className="font-medium text-slate-700">{buildSpeedLabel()}</span>
              </p>
            )}
          </section>

          {/* Fair usage policy */}
          <FairUsagePolicySection
            standalone
            form={form}
            setField={setField}
            onInput={onInput}
            open={openSections.fup}
            onToggle={() => setOpenSections((s) => ({ ...s, fup: !s.fup }))}
          />

          {/* Pricing & devices */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader
              title="Pricing & devices"
              subtitle="Set package pricing and device limits."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              {form.plan_type === 'trial' ? (
                <>
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 flex gap-4 h-full">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                      <Gift className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Free Package</p>
                      <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                        Trial packages have no cost — users get access without paying
                      </p>
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Devices</FieldLabel>
                    <input
                      type="text"
                      name="devices"
                      value={form.devices}
                      onChange={onInput}
                      placeholder="1"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    />
                    <p className="text-xs text-slate-500 mt-2">Simultaneous devices allowed per user.</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <FieldLabel required>Price of the package</FieldLabel>
                    <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-violet-500 focus-within:border-violet-500">
                      <span className="inline-flex items-center px-4 bg-slate-50 text-sm font-medium text-slate-500 border-r border-slate-200">
                        KES
                      </span>
                      <input
                        type="number"
                        name="price"
                        value={form.price}
                        onChange={onInput}
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className="flex-1 px-4 py-3 border-0 focus:ring-0"
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel required>Devices</FieldLabel>
                    <input
                      type="text"
                      name="devices"
                      value={form.devices}
                      onChange={onInput}
                      placeholder="1"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    />
                    <p className="text-xs text-slate-500 mt-2">Simultaneous devices allowed per user.</p>
                  </div>
                </>
              )}
            </div>

            <ActiveToggle checked={form.is_active} onChange={(v) => setField('is_active', v)} />

            <div className="mt-8 space-y-3">
              <AccordionRow
                icon={Zap}
                iconClass="bg-violet-100 text-violet-600"
                title="Burst speed"
                description="Allow temporary higher speeds before throttling to the base rate"
                open={openSections.burst}
                onToggle={() => setOpenSections((s) => ({ ...s, burst: !s.burst }))}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <div>
                    <FieldLabel>Burst speed</FieldLabel>
                    <input
                      type="text"
                      name="burst_speed"
                      value={form.burst_speed}
                      onChange={onInput}
                      placeholder="e.g., 20M"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    />
                    <FieldHint>Max burst (e.g., 2× base)</FieldHint>
                  </div>
                  <div>
                    <FieldLabel>Burst threshold (%)</FieldLabel>
                    <input
                      type="number"
                      name="burst_threshold_pct"
                      value={form.burst_threshold_pct}
                      onChange={onInput}
                      min="1"
                      max="100"
                      placeholder="80"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    />
                    <FieldHint>% of base speed avg before capping burst</FieldHint>
                  </div>
                  <div>
                    <FieldLabel>Burst time (seconds)</FieldLabel>
                    <input
                      type="number"
                      name="burst_time_seconds"
                      value={form.burst_time_seconds}
                      onChange={onInput}
                      min="1"
                      placeholder="8"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                    />
                    <FieldHint>Averaging window (e.g., 8 s)</FieldHint>
                  </div>
                </div>
              </AccordionRow>

              <AccordionRow
                icon={Network}
                iconClass="bg-blue-100 text-blue-600"
                title="Router-specific pricing"
                description="Override the price for specific routers — leave blank to use the default price"
                open={openSections.router}
                onToggle={() => setOpenSections((s) => ({ ...s, router: !s.router }))}
              >
                <div className="pt-4">
                  <p className="text-sm text-slate-500 mb-4">
                    Leave blank to use the default package price on that router.
                  </p>
                  <div className="max-w-sm">
                    <FieldLabel>MikroTik</FieldLabel>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                      <span className="inline-flex items-center px-3 bg-slate-50 text-sm font-medium text-slate-500 border-r border-slate-200">
                        KES
                      </span>
                      <input
                        type="number"
                        name="router_price_mikrotik"
                        value={form.router_price_mikrotik}
                        onChange={onInput}
                        min="0"
                        step="0.01"
                        placeholder="0"
                        className="flex-1 px-3 py-2.5 border-0 text-sm focus:ring-0"
                      />
                    </div>
                  </div>
                </div>
              </AccordionRow>

              <AccordionRow
                icon={Radio}
                iconClass="bg-slate-100 text-slate-600"
                title="Advanced RADIUS settings"
                description="Session timeouts, idle disconnect, and optional static IP"
                open={openSections.advanced}
                onToggle={() => setOpenSections((s) => ({ ...s, advanced: !s.advanced }))}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <div>
                    <FieldLabel>Session timeout (min)</FieldLabel>
                    <input
                      type="number"
                      name="session_timeout"
                      value={form.session_timeout}
                      onChange={onInput}
                      min="0"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <FieldLabel>Idle timeout (min)</FieldLabel>
                    <input
                      type="number"
                      name="idle_timeout"
                      value={form.idle_timeout}
                      onChange={onInput}
                      min="0"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <FieldLabel>Static IP</FieldLabel>
                    <input
                      type="text"
                      name="static_ip"
                      value={form.static_ip}
                      onChange={onInput}
                      placeholder="Optional framed IP for PPPoE"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="popular"
                        checked={form.popular}
                        onChange={onInput}
                        className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-sm text-slate-700">Feature on portal and signup</span>
                    </label>
                  </div>
                </div>
              </AccordionRow>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pb-8">
            <button
              type="button"
              onClick={() => navigate('/plans')}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create package'}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
