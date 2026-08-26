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
  AtSign,
  KeyRound,
  HelpCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { getActivePlans } from '../../services/planService';
import { parseSpeedMbps } from '../../lib/clientUtils';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';

/* Only the types the backend can actually provision. A fourth option that
   fails on submit is worse than one that is not offered. */
const CONNECTION_TYPES = [
  { key: 'pppoe', label: 'PPPoE', description: 'fixed-line homes', icon: Router },
  { key: 'hotspot', label: 'Hotspot', description: 'captive portal sign-in', icon: Wifi },
  { key: 'wireguard', label: 'WireGuard', description: 'routed static IP over a tunnel', icon: ShieldCheck },
];

const STATUSES = [
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
];

const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none '
  + 'transition-colors placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 '
  + 'disabled:cursor-not-allowed disabled:opacity-60 '
  + 'dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500';

/** A login has to survive RADIUS and a router config, so keep it boring. */
function sanitiseUsername(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

/** `datetime-local` wants 'YYYY-MM-DDTHH:mm' in *local* time. */
function toLocalInput(date) {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Expiry the package implies, so the field can be pre-filled and still edited. */
function planExpiry(plan) {
  if (!plan) return '';
  const now = new Date();
  if (plan.plan_type === 'hotspot' && plan.duration_hours) {
    now.setHours(now.getHours() + Number(plan.duration_hours));
  } else {
    now.setDate(now.getDate() + Number(plan.billing_cycle_days || 30));
  }
  return toLocalInput(now);
}

function Section({ title, description, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
        <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <div className="space-y-4 p-6">{children}</div>
    </section>
  );
}

/**
 * One labelled control.
 *
 * `required` / `note` / `hint` are separate on purpose: an operator scanning
 * the form needs to know at a glance what will block submission, what is merely
 * advisable, and what the field is for.
 */
function Field({ label, required, note, hint, help, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200">
        {label}
        {required && <span className="ml-1 text-rose-500" aria-hidden="true">*</span>}
        {required && <span className="sr-only"> (required)</span>}
        {note && <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">· {note}</span>}
        {hint && <span className="ml-1.5 text-xs font-normal text-slate-400 dark:text-slate-500">— {hint}</span>}
      </label>
      {children}
      {help && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{help}</p>}
    </div>
  );
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
    username: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    account_number: '',
    address: '',
    service_plan_id: '',
    connection_type: 'pppoe',
    subscription_end: '',
    expiry_touched: false,
    status: 'active',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Packages are per service type, so the list reloads when the type changes —
  // offering a PPPoE package to a hotspot subscriber is a guaranteed 400 from
  // the API, which validates that the two agree.
  useEffect(() => {
    let cancelled = false;
    setPlansLoading(true);
    getActivePlans({ plan_type: form.connection_type })
      .then((res) => {
        if (cancelled) return;
        const list = res.success ? (res.data.plans || []) : [];
        setPlans(list);
        setForm((f) => {
          const stillValid = list.some((p) => String(p.id) === f.service_plan_id);
          const next = stillValid ? f.service_plan_id : (list[0] ? String(list[0].id) : '');
          const plan = list.find((p) => String(p.id) === next);
          return {
            ...f,
            service_plan_id: next,
            // Don't stomp on an expiry the operator typed themselves.
            subscription_end: f.expiry_touched ? f.subscription_end : planExpiry(plan),
          };
        });
      })
      .finally(() => { if (!cancelled) setPlansLoading(false); });
    return () => { cancelled = true; };
  }, [form.connection_type]);

  const selectedPlan = plans.find((p) => String(p.id) === form.service_plan_id);
  const mbps = parseSpeedMbps(selectedPlan?.speed);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const onInput = (e) => {
    const { name, value, type, checked } = e.target;
    setField(name, type === 'checkbox' ? checked : value);
  };

  const displayName = [form.first_name, form.last_name].filter(Boolean).join(' ').trim();
  const initials = [form.first_name, form.last_name]
    .filter(Boolean).map((s) => s.trim()[0]).join('').toUpperCase().slice(0, 2);

  const onTypeChange = (next) => {
    setForm((f) => ({
      ...f,
      connection_type: next,
      // The API refuses an active hotspot subscriber outright — they are created
      // by the portal on payment — so follow it rather than let the operator
      // fill in a form that cannot be submitted.
      status: next === 'hotspot' ? 'suspended' : f.status,
    }));
  };

  const onPlanChange = (e) => {
    const id = e.target.value;
    const plan = plans.find((p) => String(p.id) === id);
    setForm((f) => ({
      ...f,
      service_plan_id: id,
      subscription_end: f.expiry_touched ? f.subscription_end : planExpiry(plan),
    }));
  };

  const generatePassword = () => {
    // Ambiguous glyphs removed: this gets read aloud down a phone line and
    // written on a card, where O/0 and l/1/I are a support call each.
    const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    setField('password', Array.from(bytes, (n) => alphabet[n % alphabet.length]).join(''));
    setShowPassword(true);
  };

  const statusHelp = form.connection_type === 'hotspot'
    ? 'Hotspot subscribers activate on their first payment through the portal.'
    : form.status === 'active'
      ? 'Active — can sign in and connect. RADIUS is provisioned on create.'
      : 'Suspended — the account exists but cannot connect until you activate it.';

  const onSubmit = async (e) => {
    e.preventDefault();
    const login = form.username.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();

    if (!login) { toast.error('Enter a username — it is what they type to sign in'); return; }
    if (!phone) { toast.error('Enter a phone number'); return; }
    if (!form.service_plan_id) { toast.error('Pick a package'); return; }
    if (/[<>]/.test(form.password)) { toast.error('A password cannot contain < or >'); return; }

    // full_name is what the API stores; fall back to the login so the record is
    // never nameless when an operator skips the optional name fields.
    const fullName = displayName || login;

    setLoading(true);
    try {
      const result = await customerService.createCustomer({
        name: fullName,
        email: email || undefined,
        radius_login: login,
        phone,
        address: form.address.trim() || undefined,
        account_number: form.account_number.trim() || undefined,
        service_plan_id: Number(form.service_plan_id),
        package: selectedPlan?.name,
        connection_type: form.connection_type,
        // Hotspot cannot be created active; the API rejects it outright.
        status: form.connection_type === 'hotspot' ? 'pending' : form.status,
        // Sent as local time without a zone; the API reads it as UTC-naive the
        // same way it stores every other timestamp.
        subscription_end: form.subscription_end || '',
        password: form.password.trim() || undefined,
      });
      // apiCall resolves { success: false, error } rather than throwing, so the
      // failure branch has to be explicit or a 400 looks like a silent no-op.
      if (!result.success) {
        toast.error(result.error || 'Failed to create subscriber');
        return;
      }
      const data = result.data;
      const pwd = data.radius_password || form.password.trim();
      const username = data.customer?.radius_username || login.toLowerCase();

      if (pwd && data.radius_provisioned) {
        // Only hand over credentials that actually work — a card shown for an
        // account RADIUS never provisioned is a support call waiting to happen.
        setCredentials({
          username,
          password: pwd,
          account_number: data.customer?.account_number,
          speed: selectedPlan?.speed,
          plan: selectedPlan?.name,
        });
        return;
      }
      if (data.radius_provision_reason) {
        toast.success(`Subscriber created — ${data.radius_provision_reason}`);
      } else if (data.wireguard_provisioned) {
        toast.success('Subscriber created and WireGuard peer provisioned');
      } else {
        toast.success('Subscriber created');
      }
      navigate('/clients');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyCreds = async () => {
    if (!credentials) return;
    const acct = credentials.account_number ? `\nAccount no: ${credentials.account_number}` : '';
    await navigator.clipboard.writeText(
      `Username: ${credentials.username}\nPassword: ${credentials.password}${acct}`
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
                  {credentials.account_number && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
                      <dt className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">
                        Account number (M-Pesa reference)
                      </dt>
                      <dd className="font-mono text-slate-900 mt-1">{credentials.account_number}</dd>
                    </div>
                  )}
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
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to clients
          </Link>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Subscribers <span className="mx-1">—</span> New
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">
            Add a <span className="text-orange-500">subscriber.</span>
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Hotspot users sign up through the portal — this is for the ones you provision by hand.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={onSubmit}
          className="mx-auto max-w-3xl space-y-6"
        >
          {/* Who is being created — an anchor so a long form still has a subject. */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-lg font-bold text-white">
              {initials || <HelpCircle className="h-6 w-6" />}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900 dark:text-white">
                {displayName || 'New subscriber'}
              </p>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                {form.username ? `@${form.username.trim().toLowerCase()}` : 'Fill in the details below'}
              </p>
            </div>
          </div>

          <Section title="Identity" description="Their login name and who they are.">
            <Field
              label="Username"
              required
              hint="what they type to sign in"
              help="No spaces or special characters. This is what they enter when connecting."
            >
              <input
                name="username"
                value={form.username}
                onChange={(e) => setField('username', sanitiseUsername(e.target.value))}
                placeholder="e.g. john.doe"
                autoComplete="off"
                className={`${inputCls} font-mono`}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" note="recommended">
                <input name="first_name" value={form.first_name} onChange={onInput}
                       placeholder="John" className={inputCls} />
              </Field>
              <Field label="Last name" note="recommended">
                <input name="last_name" value={form.last_name} onChange={onInput}
                       placeholder="Doe" className={inputCls} />
              </Field>
            </div>
          </Section>

          <Section title="Contact" description="How you'll reach them about renewals and outages.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Email">
                <input name="email" type="email" value={form.email} onChange={onInput}
                       placeholder="john@example.com" className={inputCls} />
              </Field>
              <Field label="Phone" required>
                <input name="phone" value={form.phone} onChange={onInput}
                       placeholder="+254 7XX XXX XXX" className={inputCls} />
              </Field>
            </div>
            <Field
              label="Account number"
              note="optional"
              help="Shown next to the subscriber's name everywhere; also matched on import. Left blank, one is generated."
            >
              <input name="account_number" value={form.account_number} onChange={onInput}
                     placeholder="A-1024" className={`${inputCls} font-mono`} />
            </Field>
            <Field label="Address" note="optional">
              <input name="address" value={form.address} onChange={onInput}
                     placeholder="Estate, building, or a GPS note" className={inputCls} />
            </Field>
          </Section>

          <Section title="Connection" description="Service type, plan, and when this subscription should end.">
            <Field
              label="User type"
              required
              help="Hotspot signs up through the captive portal after payment; PPPoE is for fixed-line homes."
            >
              <select name="connection_type" value={form.connection_type}
                      onChange={(e) => onTypeChange(e.target.value)} className={inputCls}>
                {CONNECTION_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.label} — {t.description}</option>
                ))}
              </select>
            </Field>

            {form.connection_type === 'hotspot' && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Hotspot subscribers are created by the captive portal once they pay, so this one is
                  saved as <strong>Pending</strong>. It activates on their first payment.
                </span>
              </div>
            )}

            <Field label="Package" required
                   help={plansLoading ? 'Loading packages…' : (plans.length ? 'Sets the speed limit and the renewal period.' : null)}>
              <select name="service_plan_id" value={form.service_plan_id} onChange={onPlanChange}
                      disabled={plansLoading || !plans.length} className={inputCls}>
                <option value="">— Pick a package —</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.speed || '—'} · {formatCurrency(p.price)}
                  </option>
                ))}
              </select>
            </Field>

            {!plansLoading && !plans.length && (
              <div className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  No {CONNECTION_TYPES.find((t) => t.key === form.connection_type)?.label} packages yet —{' '}
                  <Link to="/plans/new" className="font-semibold underline">create one first</Link>.
                </span>
              </div>
            )}

            <Field
              label="Subscription expires"
              note={form.expiry_touched ? 'edited' : 'auto-set from the package · editable'}
              help="When this subscription should end. Clear the field for no expiry."
            >
              <input
                type="datetime-local"
                name="subscription_end"
                value={form.subscription_end}
                onChange={(e) => { setField('subscription_end', e.target.value); setField('expiry_touched', true); }}
                className={inputCls}
              />
            </Field>

            {mbps && selectedPlan && (
              <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-500/20 dark:bg-blue-500/10">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-200">RADIUS rate limit</p>
                  <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                    {mbps}M / {mbps}M up &amp; down — from &ldquo;{selectedPlan.name}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </Section>

          <Section title="Account" description="Status and credentials.">
            <Field label="Status" help={statusHelp}>
              <div className="inline-flex rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                {STATUSES.map((s) => {
                  const disabled = s.key === 'active' && form.connection_type === 'hotspot';
                  return (
                    <button
                      key={s.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => setField('status', s.key)}
                      aria-pressed={form.status === s.key}
                      title={disabled ? 'Hotspot subscribers activate on their first payment' : undefined}
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        form.status === s.key
                          ? 'bg-orange-500 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field
              label="Password"
              required={form.status === 'active'}
              help="Any length, any characters except < and >. Leave blank to generate one."
            >
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={onInput}
                  placeholder="Any length"
                  autoComplete="new-password"
                  className={`${inputCls} pr-20 font-mono`}
                />
                <div className="absolute inset-y-0 right-2 flex items-center gap-0.5">
                  <button type="button" onClick={generatePassword} title="Generate a password"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setShowPassword((v) => !v)}
                          title={showPassword ? 'Hide password' : 'Show password'}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </Field>
          </Section>

          <div className="flex items-center justify-end gap-3 pb-4">
            <Link to="/clients" className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || plansLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Creating…' : 'Create subscriber'}
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
