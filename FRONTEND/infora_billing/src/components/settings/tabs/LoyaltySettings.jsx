import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Gift } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import {
  Card, Field, TextInput, Select, ToggleRow, StickySaveBar, LoadingBlock, Note,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Loyalty points.
 *
 * Rules only. Balances live in the ledger (services/loyalty.py) so changing a
 * rate here can never rewrite what a subscriber has already earned — which is
 * also why the liability figure below is worth watching: it is what the
 * outstanding balance would cost if everyone redeemed today.
 * ---------------------------------------------------------------------- */

const BLANK = {
  enabled: false, points_earned: 1, earn_per: 10, rounding: 'floor',
  point_value: 1, min_redeem: 50, expiry_months: 12,
};

function Stat({ label, value, tone = 'default' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold tabular-nums ${
          tone === 'warn'
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function LoyaltySettings() {
  const [form, setForm] = useState(BLANK);
  const [baseline, setBaseline] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await settingsService.getLoyalty(getAccessToken());
      const next = { ...BLANK, ...data.settings };
      if (next.expiry_months === null) next.expiry_months = '';
      setForm(next);
      setBaseline(JSON.stringify(next));
      setStats(data.stats);
    } catch (e) {
      toast.error(e.message || 'Failed to load loyalty settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = baseline !== null && JSON.stringify(form) !== baseline;

  // A worked example beats a rate table: 1,500 a month is a real subscriber.
  const example = useMemo(() => {
    const spend = 1500;
    const per = Number(form.earn_per) || 1;
    const earned = Number(form.points_earned) || 0;
    const raw = (spend / per) * earned;
    const points = form.rounding === 'floor' ? Math.floor(raw) : Math.round(raw);
    const worth = points * (Number(form.point_value) || 0);
    return { spend, points, worth, pct: spend ? ((worth / spend) * 100).toFixed(1) : '0.0' };
  }, [form]);

  const save = async () => {
    try {
      setSaving(true);
      const payload = { ...form, expiry_months: form.expiry_months === '' ? null : form.expiry_months };
      const res = await settingsService.saveLoyalty(getAccessToken(), payload);
      const next = { ...BLANK, ...res.settings };
      if (next.expiry_months === null) next.expiry_months = '';
      setForm(next);
      setBaseline(JSON.stringify(next));
      toast.success('Loyalty settings saved');
      load();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <Card
        title="Programme"
        description="Enable or disable the loyalty programme for every subscriber on this workspace."
        action={
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
            <Gift className="h-[18px] w-[18px]" />
          </span>
        }
      >
        <ToggleRow
          label="Enable loyalty points"
          description="Points accrue on every completed payment, not on invoices raised."
          checked={form.enabled}
          onChange={(v) => set('enabled', v)}
          onLabel="Enabled"
          offLabel="Disabled"
        />

        {stats && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Points earned" value={stats.earned.toLocaleString()} />
            <Stat label="Redeemed" value={stats.redeemed.toLocaleString()} />
            <Stat label="Outstanding" value={stats.outstanding.toLocaleString()} />
            <Stat label="Liability" value={stats.liability.toLocaleString()} tone="warn" />
          </div>
        )}
      </Card>

      <Card title="Earning" description="What a subscriber gets back for paying you">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="Points earned" hint="How many points one qualifying chunk of spend is worth.">
            <TextInput type="number" min={0} value={form.points_earned}
                       onChange={(e) => set('points_earned', e.target.value)} />
          </Field>
          <Field label="Per amount spent" hint="The chunk of spend, in your billing currency.">
            <TextInput type="number" min={0.01} step="0.01" value={form.earn_per}
                       onChange={(e) => set('earn_per', e.target.value)} />
          </Field>
          <Field label="Rounding" hint="What happens to a part-earned point.">
            <Select value={form.rounding} onChange={(e) => set('rounding', e.target.value)}>
              <option value="floor">Round down — never over-award</option>
              <option value="nearest">Round to nearest</option>
            </Select>
          </Field>
          <Field label="Points expire after (months)" hint="Leave blank for points that never expire.">
            <TextInput type="number" min={1} value={form.expiry_months}
                       placeholder="Never"
                       onChange={(e) => set('expiry_months', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card title="Redeeming" description="What a point is worth on the way back out">
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="One point is worth" hint="Discount applied against a renewal.">
            <TextInput type="number" min={0} step="0.01" value={form.point_value}
                       onChange={(e) => set('point_value', e.target.value)} />
          </Field>
          <Field label="Minimum balance to redeem" hint="Stops one-shilling redemptions.">
            <TextInput type="number" min={0} value={form.min_redeem}
                       onChange={(e) => set('min_redeem', e.target.value)} />
          </Field>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Worked example
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            A subscriber paying{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {example.spend.toLocaleString()}
            </span>{' '}
            a month earns{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {example.points.toLocaleString()} points
            </span>
            , worth{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {example.worth.toLocaleString()}
            </span>{' '}
            off their next renewal — {example.pct}% of what they paid you.
          </p>
        </div>

        <div className="mt-5">
          <Note title="Redeeming spends the oldest points first" tone="info">
            <p className="mt-1">
              Points expire per batch, so spending the newest first would let old ones lapse while
              a subscriber still shows a balance. Oldest-first is why that cannot happen.
            </p>
          </Note>
        </div>
      </Card>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onReset={() => setForm(JSON.parse(baseline))}
        label="Save rules"
      />
    </div>
  );
}
