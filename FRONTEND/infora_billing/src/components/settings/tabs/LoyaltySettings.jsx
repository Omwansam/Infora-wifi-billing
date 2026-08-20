import React, { useMemo, useState } from 'react';
import { Gift } from 'lucide-react';
import { Card, Field, TextInput, Select, ToggleRow, NotWired, UnavailableSave } from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Loyalty points — design only.
 *
 * No points ledger exists: no balance column, no accrual hook on payment, no
 * redemption path at renewal. The worked example below is computed live from
 * the numbers in the form purely so the rules read unambiguously — an operator
 * should be able to see what "1 point per 10" actually costs them before
 * anyone builds it.
 * ---------------------------------------------------------------------- */

export default function LoyaltySettings() {
  const [scheme, setScheme] = useState(false);
  const [rules, setRules] = useState({
    earnPer: 10,
    pointsEarned: 1,
    pointValue: 1,
    minRedeem: 50,
    expiryMonths: 12,
    roundTo: 'floor',
  });

  const set = (k, v) => setRules((r) => ({ ...r, [k]: v }));

  // A month of a 1,500/= subscriber, so the rates have something to bite on.
  const example = useMemo(() => {
    const spend = 1500;
    const per = Number(rules.earnPer) || 1;
    const earned = Number(rules.pointsEarned) || 0;
    const raw = (spend / per) * earned;
    const points = rules.roundTo === 'floor' ? Math.floor(raw) : Math.round(raw);
    const worth = points * (Number(rules.pointValue) || 0);
    return { spend, points, worth, redeemable: points >= (Number(rules.minRedeem) || 0) };
  }, [rules]);

  return (
    <div className="space-y-6">
      <NotWired>
        Nothing on this panel saves. There is no points ledger in the database, no accrual when a
        payment lands and no redemption step at renewal — this is the rule set the feature would
        need, not a live scheme. The worked example updates as you type so the rates can be argued
        about before they are built.
      </NotWired>

      <div className="space-y-6">
          <Card
            title="Programme"
            description="Enable or disable the loyalty programme for all subscribers on this workspace."
            action={
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                <Gift className="h-[18px] w-[18px]" />
              </span>
            }
          >
            <ToggleRow
              label="Enable loyalty points"
              description="Points accrue on every successful payment, not on invoices raised."
              checked={scheme}
              onChange={setScheme}
              onLabel="Enabled"
              offLabel="Disabled"
            />
          </Card>

          <Card title="Earning" description="What a subscriber gets back for paying you">
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="Points earned" hint="How many points one qualifying chunk of spend is worth.">
                <TextInput
                  type="number"
                  min={1}
                  value={rules.pointsEarned}
                  onChange={(e) => set('pointsEarned', e.target.value)}
                />
              </Field>
              <Field label="Per amount spent" hint="The chunk of spend, in your billing currency.">
                <TextInput
                  type="number"
                  min={1}
                  value={rules.earnPer}
                  onChange={(e) => set('earnPer', e.target.value)}
                />
              </Field>
              <Field label="Rounding" hint="What happens to a part-earned point.">
                <Select value={rules.roundTo} onChange={(e) => set('roundTo', e.target.value)}>
                  <option value="floor">Round down — never over-award</option>
                  <option value="nearest">Round to nearest</option>
                </Select>
              </Field>
              <Field label="Points expire after (months)" hint="Leave blank for points that never expire.">
                <TextInput
                  type="number"
                  min={1}
                  value={rules.expiryMonths}
                  onChange={(e) => set('expiryMonths', e.target.value)}
                />
              </Field>
            </div>
          </Card>

          <Card title="Redeeming" description="What a point is worth on the way back out">
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="One point is worth" hint="Discount applied against a renewal.">
                <TextInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={rules.pointValue}
                  onChange={(e) => set('pointValue', e.target.value)}
                />
              </Field>
              <Field label="Minimum balance to redeem" hint="Stops one-shilling redemptions.">
                <TextInput
                  type="number"
                  min={0}
                  value={rules.minRedeem}
                  onChange={(e) => set('minRedeem', e.target.value)}
                />
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
                off their next renewal — that is{' '}
                {example.spend > 0 ? ((example.worth / example.spend) * 100).toFixed(1) : '0.0'}% of
                what they paid you.{' '}
                {example.redeemable
                  ? 'They can redeem after a single month.'
                  : `They must save up to ${rules.minRedeem} points before redeeming.`}
              </p>
            </div>

            <div className="mt-6">
              <UnavailableSave />
            </div>
          </Card>
      </div>
    </div>
  );
}
