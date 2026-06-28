import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Router,
  Wifi,
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
import ClientConnectionBadge from './ClientConnectionBadge';
import toast from 'react-hot-toast';

const TYPE_META = {
  pppoe: {
    label: 'PPPoE',
    description: 'Monthly dial-up subscription',
    icon: Router,
    ring: 'ring-violet-500 border-violet-500',
    bg: 'bg-violet-50',
    iconBg: 'bg-violet-500',
  },
  hotspot: {
    label: 'Hotspot',
    description: 'Captive portal / voucher',
    icon: Wifi,
    ring: 'ring-amber-400 border-amber-400',
    bg: 'bg-amber-50',
    iconBg: 'bg-amber-500',
  },
};

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', hint: 'Connected — internet access enabled' },
  { value: 'pending', label: 'Pending', hint: 'Not yet provisioned on RADIUS' },
  { value: 'suspended', label: 'Suspended', hint: 'Disconnected — no internet access' },
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

export default function ClientEdit() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [plans, setPlans] = useState([]);
  const [client, setClient] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    service_plan_id: '',
    status: 'active',
    balance: '',
    device_count: '1',
  });
  const [initialStatus, setInitialStatus] = useState('active');

  useEffect(() => {
    loadClient();
  }, [customerId]);

  const connectionType = client?.connection_type || 'pppoe';
  const typeMeta = TYPE_META[connectionType] || TYPE_META.pppoe;

  const loadClient = async () => {
    try {
      setLoading(true);
      const result = await customerService.getCustomer(customerId);
      if (!result.success) {
        toast.error(result.error || 'Failed to load client');
        navigate('/clients');
        return;
      }
      const c = result.data;
      setClient(c);
      setForm({
        name: c.name || '',
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || '',
        service_plan_id: c.service_plan_id ? String(c.service_plan_id) : '',
        status: c.status || 'active',
        balance: c.balance != null ? String(c.balance) : '0',
        device_count: c.device_count != null ? String(c.device_count) : '1',
      });
      setInitialStatus(c.status || 'active');

      const planType = c.connection_type === 'hotspot' ? 'hotspot' : 'pppoe';
      const plansRes = await getActivePlans({ plan_type: planType });
      if (plansRes.success) setPlans(plansRes.data.plans || []);
    } catch {
      toast.error('Failed to load client');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = useMemo(
    () => plans.find((p) => String(p.id) === form.service_plan_id),
    [plans, form.service_plan_id]
  );
  const mbps = parseSpeedMbps(selectedPlan?.speed);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const onInput = (e) => {
    const { name, value } = e.target;
    setField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { status, ...rest } = form;
      const payload = {
        name: rest.name,
        email: rest.email,
        phone: rest.phone,
        address: rest.address,
        service_plan_id: rest.service_plan_id ? Number(rest.service_plan_id) : undefined,
        balance: parseFloat(rest.balance) || 0,
        device_count: parseInt(rest.device_count, 10) || 1,
      };

      if (status !== initialStatus && (status === 'active' || status === 'suspended')) {
        const statusResult = await customerService.updateCustomerStatus(customerId, status);
        if (!statusResult.success) {
          toast.error(statusResult.error || 'Failed to update access status');
          return;
        }
      } else if (status !== initialStatus) {
        payload.status = status;
      }

      const result = await customerService.updateCustomer(customerId, payload);
      if (result.success) {
        toast.success('Client updated');
        navigate(`/clients/${customerId}`);
      } else {
        toast.error(result.error || 'Failed to update client');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const TypeIcon = typeMeta.icon;

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link
            to={`/clients/${customerId}`}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to client
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Subscribers</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Edit Client</h1>
              <p className="text-slate-600 mt-1">Update subscriber details, package, and account status.</p>
            </div>
            {client && (
              <div className="flex items-center gap-3">
                <ClientConnectionBadge
                  connected={client.status === 'active'}
                  status={client.status}
                />
                <span className="text-sm text-slate-500">#{client.id}</span>
              </div>
            )}
          </div>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          {/* Connection type (read-only) */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader
              title="Connection type"
              subtitle="Connection type is set at creation and cannot be changed here."
            />
            <div className="max-w-sm">
              <div
                className={`flex items-start gap-3 p-4 rounded-xl border-2 ${typeMeta.bg} ${typeMeta.ring} ring-2`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${typeMeta.iconBg}`}
                >
                  <TypeIcon className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-semibold text-slate-900 text-sm block">{typeMeta.label}</span>
                  <span className="text-xs text-slate-500 mt-0.5 block">{typeMeta.description}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Client details */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader title="Client details" subtitle="Contact and login information." />
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
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <FieldLabel required>
                  {connectionType === 'pppoe' ? 'Email (PPPoE username)' : 'Email'}
                </FieldLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    name="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={onInput}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                {connectionType === 'pppoe' && (
                  <p className="text-xs text-slate-500 mt-2">Changing email updates the RADIUS login username.</p>
                )}
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Installation address</FieldLabel>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    name="address"
                    value={form.address}
                    onChange={onInput}
                    placeholder="Optional"
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Package */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader
              title="Package"
              subtitle="Changing the package re-provisions RADIUS rate limits for this client."
            />
            {plans.length === 0 ? (
              <p className="text-sm text-slate-500">No active packages available for this connection type.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {plans.map((plan) => {
                  const selected = String(plan.id) === form.service_plan_id;
                  const Icon = connectionType === 'hotspot' ? Wifi : Router;
                  const accent = connectionType === 'hotspot' ? 'amber' : 'violet';
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setField('service_plan_id', String(plan.id))}
                      className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? accent === 'amber'
                            ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400'
                            : 'bg-violet-50 border-violet-500 ring-2 ring-violet-500'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg text-white mb-3 ${
                          selected
                            ? accent === 'amber'
                              ? 'bg-amber-500'
                              : 'bg-violet-500'
                            : 'bg-slate-300'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-slate-900 text-sm line-clamp-1">{plan.name}</span>
                      <span className="text-xs text-slate-500 mt-1">{plan.speed}</span>
                      <span className="text-sm font-bold text-slate-900 mt-2">
                        {formatCurrency(plan.price)}
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
                    {mbps}M / {mbps}M — from &ldquo;{selectedPlan.name}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Account & billing */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
            <SectionHeader title="Account & billing" subtitle="Access status and billing fields." />
            <div className="space-y-6">
              <div>
                <FieldLabel required>Account status</FieldLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STATUS_OPTIONS.map((opt) => {
                    const selected = form.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setField('status', opt.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="font-semibold text-sm text-slate-900 block">{opt.label}</span>
                        <span className="text-xs text-slate-500 mt-1 block">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
                <div>
                  <FieldLabel>Account balance</FieldLabel>
                  <div className="flex rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                    <span className="inline-flex items-center px-4 bg-slate-50 text-sm font-medium text-slate-500 border-r border-slate-200">
                      KES
                    </span>
                    <input
                      type="number"
                      name="balance"
                      step="0.01"
                      value={form.balance}
                      onChange={onInput}
                      className="flex-1 px-4 py-3 border-0 focus:ring-0 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>Devices allowed</FieldLabel>
                  <input
                    type="number"
                    name="device_count"
                    min="1"
                    max="20"
                    value={form.device_count}
                    onChange={onInput}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-slate-500 mt-2">Simultaneous sessions per user.</p>
                </div>
              </div>
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pb-4">
            <Link
              to={`/clients/${customerId}`}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
