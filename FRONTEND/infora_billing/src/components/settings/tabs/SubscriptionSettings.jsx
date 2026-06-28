import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Clock, Server, Users } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, LoadingBlock } from '../ui';

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function QuotaBar({ icon: Icon, label, used, max }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-700">{label}</span>
        <span className="ml-auto text-sm font-semibold text-gray-900">{used} / {max ?? '∞'}</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SubscriptionSettings() {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setSub(await settingsService.getSubscription(getAccessToken()));
      } catch (e) {
        toast.error(e.message || 'Failed to load subscription');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading || !sub) return <LoadingBlock />;

  const started = sub.started_at ? new Date(sub.started_at).toLocaleDateString() : '—';

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Clock className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900">{sub.plan_label} Plan</h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {sub.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-gray-500">Your current subscription plan and usage</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-gray-100 pt-5">
          <Stat label="Plan Type" value={sub.plan_label} />
          <Stat label="Currency" value={sub.currency} />
          <Stat label="Started" value={started} />
          <Stat label="Status" value={sub.is_active ? 'Active' : 'Inactive'} />
        </div>
      </Card>

      <Card title="Usage & Quotas" description="How much of your plan limits you're currently using">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuotaBar icon={Server} label="Devices" used={sub.quotas.device_count} max={sub.quotas.max_devices} />
          <QuotaBar icon={Users} label="Customers" used={sub.quotas.customer_count} max={sub.quotas.max_customers} />
        </div>
      </Card>

      <Card title="Billing History" description="Your past invoices and payments">
        {sub.billing_history.length === 0 ? (
          <p className="text-sm text-gray-500">
            No billing records yet. Tenant invoicing will appear here once enabled for your account.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
                <th className="pb-3 font-semibold">Period</th>
                <th className="pb-3 font-semibold">Amount</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Due / Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sub.billing_history.map((b, i) => (
                <tr key={i}>
                  <td className="py-3">{b.period}</td>
                  <td className="py-3 font-semibold">{b.amount}</td>
                  <td className="py-3">{b.status}</td>
                  <td className="py-3 text-gray-500">{b.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
