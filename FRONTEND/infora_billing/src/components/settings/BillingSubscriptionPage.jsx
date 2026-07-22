import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Loader2, Check, Router, Users, Zap, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { subscriptionService } from '../../services/subscriptionService';
import { useAuth } from '../../contexts/AuthContext';

function UsageMeter({ icon: Icon, label, used, max, tone }) {
  const pct = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const bar = pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-2">
        <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{used}<span className="text-base font-medium text-slate-400"> / {max}</span></p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} /></div>
      <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{pct}% of your plan limit used</p>
    </div>
  );
}

export default function BillingSubscriptionPage() {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === true;
  const [sub, setSub] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, planRes] = await Promise.all([
        subscriptionService.getSubscription(),
        subscriptionService.getPlans(),
      ]);
      if (subRes.success) setSub(subRes.data);
      else toast.error(subRes.error || 'Failed to load subscription');
      if (planRes.success) setPlans(planRes.data?.plans || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changePlan = async (planKey) => {
    if (planKey === sub?.plan) return;
    if (!window.confirm(`Change subscription to ${planKey}? This updates your device and customer limits.`)) return;
    setChanging(planKey);
    try {
      const result = await subscriptionService.changePlan(planKey);
      if (result.success) { toast.success(result.data?.message || 'Plan changed'); load(); }
      else toast.error(result.error || result.data?.error || 'Change failed');
    } catch (e) { toast.error(e.message || 'Change failed'); } finally { setChanging(null); }
  };

  const quotas = sub?.quotas || {};

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-3 dark:bg-emerald-950/50"><CreditCard className="h-6 w-6 text-emerald-600 dark:text-emerald-300" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Billing &amp; Subscription</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Your plan tier, limits, and live usage.</p>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading subscription…</div>
        ) : (
          <div className="space-y-6">
            {/* Current plan */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Current plan</p>
                    <div className="mt-1 flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{sub?.plan_label || '—'}</h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${sub?.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>{sub?.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {quotas.max_devices} devices · {quotas.max_customers} customers · {sub?.currency || 'KES'}
                    </p>
                  </div>
                  <ShieldCheck className="h-12 w-12 text-emerald-500/40" />
                </div>
              </div>
            </motion.div>

            {/* Usage meters */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UsageMeter icon={Router} label="Devices" used={quotas.device_count ?? 0} max={quotas.max_devices ?? 0} tone="bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300" />
              <UsageMeter icon={Users} label="Customers" used={quotas.customer_count ?? 0} max={quotas.max_customers ?? 0} tone="bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300" />
            </div>

            {/* Plan tiers */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Available tiers</h2>
              <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">
                {isAdmin ? 'Switch tiers to adjust your device and customer limits.' : 'Contact an admin to change your plan.'}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {plans.map((p) => {
                  const current = p.key === sub?.plan;
                  return (
                    <div key={p.key} className={`rounded-xl border p-5 ${current ? 'border-emerald-500 ring-1 ring-emerald-500/30' : 'border-slate-200 dark:border-slate-700'}`}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{p.label}</h3>
                        {current && <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" />Current</span>}
                      </div>
                      <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                        <li className="flex items-center gap-2"><Router className="h-3.5 w-3.5 text-slate-400" />{p.max_devices} devices</li>
                        <li className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-slate-400" />{p.max_customers.toLocaleString()} customers</li>
                      </ul>
                      {isAdmin && !current && (
                        <button onClick={() => changePlan(p.key)} disabled={changing === p.key} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                          {changing === p.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}Switch
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-xs text-slate-400">Platform billing is managed by your operator. Limits apply immediately when the tier changes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
