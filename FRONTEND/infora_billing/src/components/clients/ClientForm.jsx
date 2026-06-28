import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Router,
  Wifi,
  Copy,
  Check,
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { getActivePlans } from '../../services/planService';
import { parseSpeedMbps } from '../../lib/clientUtils';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';

const CONNECTION_TYPES = [
  {
    key: 'pppoe',
    label: 'PPPoE',
    description: 'Monthly dial-up subscription',
    icon: Router,
    selectedRing: 'ring-violet-500 border-violet-500',
    selectedBg: 'bg-violet-50',
    iconBg: 'bg-violet-500',
    enabled: true,
  },
  {
    key: 'hotspot',
    label: 'Hotspot',
    description: 'Captive portal / voucher',
    icon: Wifi,
    selectedRing: 'ring-amber-400 border-amber-400',
    selectedBg: 'bg-amber-50',
    iconBg: 'bg-amber-500',
    enabled: false,
  },
];

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

function SwitchToggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-emerald-500' : 'bg-slate-200'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </label>
  );
}

export default function ClientForm() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    service_plan_id: '',
    connection_type: 'pppoe',
    connect_on_create: true,
  });
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setPlansLoading(true);
    getActivePlans({ plan_type: 'pppoe' })
      .then((res) => {
        if (res.success) {
          const list = res.data.plans || [];
          setPlans(list);
          if (list[0]) setForm((f) => ({ ...f, service_plan_id: String(list[0].id) }));
        }
      })
      .finally(() => setPlansLoading(false));
  }, []);

  const selectedPlan = plans.find((p) => String(p.id) === form.service_plan_id);
  const mbps = parseSpeedMbps(selectedPlan?.speed);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const onInput = (e) => {
    const { name, value, type, checked } = e.target;
    setField(name, type === 'checkbox' ? checked : value);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.service_plan_id) {
      toast.error('Select a package');
      return;
    }
    setLoading(true);
    try {
      const result = await customerService.createCustomer({
        name: form.name,
        email: form.email,
        phone: form.phone,
        address: form.address,
        service_plan_id: Number(form.service_plan_id),
        package: selectedPlan?.name,
        connection_type: 'pppoe',
        status: form.connect_on_create ? 'active' : 'pending',
      });
      if (result.success) {
        const data = result.data;
        const pwd = data.radius_password;
        if (pwd && form.connect_on_create && data.radius_provisioned) {
          setCredentials({
            username: form.email.toLowerCase(),
            password: pwd,
            speed: selectedPlan?.speed,
            plan: selectedPlan?.name,
          });
        } else if (form.connect_on_create && data.radius_provision_reason) {
          toast.error(data.radius_provision_reason);
          navigate('/clients');
        } else if (!form.connect_on_create) {
          toast.success('Client created — RADIUS will provision when you connect');
          navigate('/clients');
        } else {
          toast.success('Client created');
          navigate('/clients');
        }
      } else {
        toast.error(result.error || 'Failed to create client');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCreds = async () => {
    if (!credentials) return;
    await navigator.clipboard.writeText(
      `Username: ${credentials.username}\nPassword: ${credentials.password}`
    );
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (credentials) {
    return (
      <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
        <div className="mx-auto w-full min-w-0 max-w-7xl">
          <div className="max-w-xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
              <div className="p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 mb-4">
                  <Check className="h-6 w-6" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">Client connected</h1>
                <p className="text-sm text-slate-500 mt-1">
                  PPPoE credentials are ready — share with the subscriber.
                </p>
                <dl className="mt-6 space-y-3">
                  {credentials.plan && (
                    <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
                      <dt className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide">
                        Package
                      </dt>
                      <dd className="font-semibold text-slate-900 mt-1">{credentials.plan}</dd>
                    </div>
                  )}
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                    <dt className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Username
                    </dt>
                    <dd className="font-mono text-slate-900 mt-1">{credentials.username}</dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                    <dt className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Password
                    </dt>
                    <dd className="font-mono text-slate-900 mt-1">{credentials.password}</dd>
                  </div>
                  {credentials.speed && (
                    <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                      <dt className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide">
                        Speed
                      </dt>
                      <dd className="font-semibold text-blue-900 mt-1">{credentials.speed}</dd>
                    </div>
                  )}
                </dl>
                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={copyCreds}
                    className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    Copy credentials
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/clients')}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to="/clients"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clients
          </Link>
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Subscribers</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Add Client</h1>
          <p className="text-slate-600 mt-1">
            Create a subscriber account and provision FreeRADIUS at the selected package speed.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={onSubmit}
          className="space-y-8"
        >
          {/* Connection type */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader
              title="Connection type"
              subtitle="Admin provisioning is available for PPPoE. Hotspot clients sign up via the captive portal."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              {CONNECTION_TYPES.map((type) => {
                const Icon = type.icon;
                const selected = form.connection_type === type.key;
                return (
                  <button
                    key={type.key}
                    type="button"
                    disabled={!type.enabled}
                    onClick={() => type.enabled && setField('connection_type', type.key)}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      !type.enabled
                        ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                        : selected
                          ? `${type.selectedBg} ${type.selectedRing} ring-2`
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${
                        selected && type.enabled ? type.iconBg : 'bg-slate-300'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 text-sm block">{type.label}</span>
                      <span className="text-xs text-slate-500 mt-0.5 block">{type.description}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-3 max-w-2xl">
              Hotspot clients are created automatically when users pay on the captive portal.
            </p>
          </section>

          {/* Client details */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader title="Client details" subtitle="Contact and login information for this subscriber." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <FieldLabel required>Full name</FieldLabel>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    name="name"
                    required
                    value={form.name}
                    onChange={onInput}
                    placeholder="Eg. Jane Wanjiku"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <FieldLabel required>Phone</FieldLabel>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    name="phone"
                    required
                    value={form.phone}
                    onChange={onInput}
                    placeholder="Eg. 0712 345 678"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <FieldLabel required>Email (PPPoE username)</FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={onInput}
                    placeholder="subscriber@example.com"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Used as the dial-up login on MikroTik / RADIUS.</p>
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Installation address</FieldLabel>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    name="address"
                    value={form.address}
                    onChange={onInput}
                    placeholder="Optional — estate, building, or GPS note"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Package & provisioning */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader
              title="Package & provisioning"
              subtitle="Choose an active PPPoE package. Rate limits are applied from the package settings."
            />

            {plansLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin mr-2 text-blue-600" />
                Loading packages…
              </div>
            ) : plans.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="font-medium text-slate-900">No active PPPoE packages</p>
                <p className="text-sm text-slate-500 mt-1 mb-4">Create a PPPoE package before adding clients.</p>
                <Link
                  to="/plans/new"
                  className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700"
                >
                  Create package
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {plans.map((plan) => {
                  const selected = String(plan.id) === form.service_plan_id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setField('service_plan_id', String(plan.id))}
                      className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? 'bg-violet-50 border-violet-500 ring-2 ring-violet-500'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500 text-white mb-3">
                        <Router className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-slate-900 text-sm line-clamp-1">{plan.name}</span>
                      <span className="text-xs text-slate-500 mt-1">{plan.speed || plan.speed_display}</span>
                      <span className="text-sm font-bold text-slate-900 mt-2">
                        {formatCurrency(plan.price)}
                        <span className="text-xs font-normal text-slate-500"> /mo</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {mbps && selectedPlan && (
              <div className="mt-5 flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
                <ShieldCheck className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">RADIUS rate limit</p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {mbps}M / {mbps}M upload & download — from package &ldquo;{selectedPlan.name}&rdquo;
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-slate-100">
              <SwitchToggle
                checked={form.connect_on_create}
                onChange={(v) => setField('connect_on_create', v)}
                label={
                  <>
                    <span className="font-medium text-emerald-600">Connect immediately</span>
                    {' — provision RADIUS and enable internet access on create'}
                  </>
                }
              />
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pb-4">
            <Link
              to="/clients"
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || !plans.length || plansLoading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Provisioning…' : 'Create client'}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
