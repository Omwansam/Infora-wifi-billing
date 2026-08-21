import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Banknote, Building2, Copy, CreditCard, ExternalLink, Eye, EyeOff,
  Smartphone, Wallet,
} from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { API_BASE_URL } from '../../../config/api';
import { useSettingsChrome } from '../chrome';
import {
  Card, Field, TextInput, Select, Toggle, StickySaveBar, StatusPill,
  LoadingBlock, NotWired, Note, PrimaryButton, UnavailableSave,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Payments.
 *
 * The backend has exactly one payment integration: M-Pesa Daraja, reached
 * through PaymentSettings.collection_route ∈ {paybill, buygoods, bank} plus
 * optional Daraja credentials. Everything on this grid that is not one of
 * those four shapes has no code at all.
 *
 * Two behaviours here differ from the Email/SMS panels and matter:
 *
 *   · /settings/payments DECRYPTS secrets and returns them in plaintext, so
 *     saved credentials really are shown. The mock's "Saved credentials are
 *     shown below" is accurate for this endpoint alone.
 *   · a blank secret CLEARS it here, unlike the integrations endpoint where
 *     blank means "keep". So this panel must never say "leave blank to keep
 *     existing" — it says the opposite, because that is what happens.
 *
 * Which gateway is "active" is derived rather than stored: there is no
 * `active_gateway` column, only the route and whether Daraja credentials are
 * filled in.
 * ---------------------------------------------------------------------- */

const CAP = {
  stk: 'STK', paybill: 'Paybill', till: 'Till', bank: 'Bank transfer',
  cards: 'Cards', momo: 'Mobile money',
};

const GATEWAYS = [
  {
    id: 'mpesa_api',
    name: 'M-Pesa Paybill / Till Number (API keys)',
    badge: 'M-PESA',
    subtitle: 'M-Pesa · Kenya · automated collection via Daraja',
    mark: 'M', markClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    caps: [CAP.stk, CAP.paybill, CAP.till],
    settlement: 'Instant',
    built: true,
  },
  {
    id: 'paybill_manual',
    name: 'Paybill — without API keys',
    badge: 'M-PESA PAYBILL',
    subtitle: 'M-Pesa · Kenya',
    mark: 'P', markClass: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300',
    caps: [CAP.paybill],
    settlement: 'Confirmed by code',
    built: true,
  },
  {
    id: 'till_manual',
    name: 'Till Number — without API keys',
    badge: 'M-PESA TILL',
    subtitle: 'M-Pesa · Kenya',
    mark: 'T', markClass: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300',
    caps: ['Buy Goods till'],
    settlement: 'Confirmed by code',
    built: true,
  },
  {
    id: 'bank',
    name: 'Bank Account',
    badge: null,
    subtitle: 'Bank transfer',
    mark: <Building2 className="h-5 w-5" />,
    markClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    caps: [CAP.bank],
    settlement: 'To your bank',
    built: true,
  },
  { id: 'dpo', name: 'DPO Pay', subtitle: 'DPO Pay · multi-country', mark: 'D', markClass: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300', caps: [CAP.cards, CAP.momo], settlement: 'To bank' },
  { id: 'kopokopo', name: 'Kopo Kopo', subtitle: 'Kopo Kopo · Kenya', mark: 'K', markClass: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300', caps: ['Mobile money till'], settlement: 'T+1 to bank' },
  { id: 'paypal', name: 'PayPal', subtitle: 'PayPal · global', mark: 'PP', markClass: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300', caps: [CAP.cards, 'PayPal'], settlement: 'To PayPal balance' },
  { id: 'paystack', name: 'Paystack', subtitle: 'Paystack · 14 markets', mark: 'PS', markClass: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300', caps: [CAP.cards, 'MoMo', 'Bank'], settlement: 'T+1 to bank' },
  { id: 'pesapal', name: 'PesaPal', subtitle: 'Pesapal · East Africa', mark: 'PL', markClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300', caps: [CAP.cards, CAP.momo, 'Airtel'], settlement: 'To bank' },
  { id: 'relworx', name: 'Relworx', subtitle: 'Relworx · Uganda', mark: 'R', markClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300', caps: [CAP.momo], settlement: 'To bank' },
];

const PAYMENT_METHODS = [
  { key: 'method_mpesa', name: 'M-Pesa (STK push)', desc: 'Customers pay directly from the captive portal via STK push.', icon: Smartphone, iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' },
  { key: 'method_manual', name: 'Manual M-Pesa', desc: 'Accept Paybill / Buy Goods payments confirmed by transaction code.', icon: Wallet, iconClass: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300' },
  { key: 'method_card', name: 'Card payments', desc: 'Visa / Mastercard checkout via your payment processor.', icon: CreditCard, iconClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' },
  { key: 'method_cash', name: 'Cash / agent', desc: 'Record over-the-counter or agent-collected payments manually.', icon: Banknote, iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
];

const BLANK = {
  collection_route: 'paybill',
  buygoods_till: '', buygoods_store: '',
  paybill_shortcode: '', paybill_account: '',
  bank_name: '', bank_paybill: '', bank_account: '',
  daraja_env: 'sandbox', daraja_consumer_key: '', daraja_consumer_secret: '',
  daraja_passkey: '', daraja_shortcode: '', daraja_callback_url: '',
  method_mpesa: true, method_manual: true, method_card: false, method_cash: true,
};

/** Daraja is "configured" only when all three secrets are present. */
function hasDaraja(f) {
  return Boolean(f.daraja_consumer_key && f.daraja_consumer_secret && f.daraja_passkey);
}

function activeGatewayId(f) {
  if (hasDaraja(f)) return 'mpesa_api';
  if (f.collection_route === 'bank') return 'bank';
  if (f.collection_route === 'buygoods') return 'till_manual';
  return 'paybill_manual';
}

function Mark({ mark, markClass, size = 'h-10 w-10' }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center rounded-xl text-sm font-bold ${markClass}`}>
      {mark}
    </span>
  );
}

function GatewayCard({ gateway, active, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col rounded-2xl border p-5 text-left transition ${
        active
          ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-500/30 dark:border-emerald-500/60 dark:bg-emerald-950/30'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-3">
        <Mark mark={gateway.mark} markClass={gateway.markClass} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {gateway.name}
            </span>
            {gateway.badge && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {gateway.badge}
              </span>
            )}
            {active && <StatusPill tone="connected">Active</StatusPill>}
            {!gateway.built && <StatusPill tone="warn">Not built</StatusPill>}
          </div>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{gateway.subtitle}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {gateway.caps.map((c) => (
          <span
            key={c}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {c}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="text-xs text-slate-400 dark:text-slate-500">{gateway.settlement}</span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          Configure <span aria-hidden="true">›</span>
        </span>
      </div>
    </button>
  );
}

function SecretField({ label, hint, value, onChange, required }) {
  const [reveal, setReveal] = useState(false);
  return (
    <Field label={label} hint={hint} required={required}>
      <div className="relative">
        <TextInput
          type={reveal ? 'text' : 'password'}
          value={value}
          autoComplete="off"
          className="pr-10"
          onChange={onChange}
        />
        <button
          type="button"
          onClick={() => setReveal((r) => !r)}
          tabIndex={-1}
          aria-label={reveal ? 'Hide value' : 'Show value'}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

function CallbackRow({ label, url, available }) {
  const copy = () => {
    navigator.clipboard?.writeText(url);
    toast.success(`${label} copied`);
  };
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p
          className={`mt-1 truncate font-mono text-sm ${
            available
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 line-through dark:text-slate-600'
          }`}
        >
          {url}
        </p>
      </div>
      {available && (
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
        >
          <Copy className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default function PaymentsSettings() {
  const { setChrome } = useSettingsChrome();
  const [form, setForm] = useState(BLANK);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await settingsService.getPayments(getAccessToken());
        const next = { ...BLANK, ...data };
        setForm(next);
        setBaseline(JSON.stringify(next));
      } catch (e) {
        toast.error(e.message || 'Failed to load payment settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = baseline !== null && JSON.stringify(form) !== baseline;
  const activeId = useMemo(() => activeGatewayId(form), [form]);
  const gateway = useMemo(() => GATEWAYS.find((g) => g.id === selectedId) || null, [selectedId]);

  const persist = useCallback(async (payload, message) => {
    try {
      setSaving(true);
      const res = await settingsService.savePayments(getAccessToken(), payload);
      const next = { ...BLANK, ...(res.payments || payload) };
      setForm(next);
      setBaseline(JSON.stringify(next));
      toast.success(message);
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, []);

  const save = () => persist(form, 'Payment settings saved');

  // "Use this gateway" only moves the collection route — the credentials the
  // other gateways already hold are left alone, so switching back is free.
  const activate = (id) => {
    const route = id === 'bank' ? 'bank' : id === 'till_manual' ? 'buygoods' : 'paybill';
    persist({ ...form, collection_route: route }, 'Gateway switched');
  };

  const toggleMethod = (key, value) => {
    const next = { ...form, [key]: value };
    setForm(next);
    persist(next, 'Payment methods updated');
  };

  useEffect(() => {
    if (!gateway) {
      setChrome(null);
      return undefined;
    }
    const isActive = gateway.id === activeId;
    setChrome({
      icon: gateway.mark,
      iconClass: gateway.markClass,
      eyebrow: 'Payment gateway',
      title: gateway.name,
      subtitle: gateway.subtitle,
      status: (
        <StatusPill tone={isActive ? 'connected' : gateway.built ? 'idle' : 'warn'}>
          {isActive ? 'Active' : gateway.built ? 'Not active' : 'Not built'}
        </StatusPill>
      ),
      action:
        gateway.built && !isActive ? (
          <PrimaryButton onClick={() => activate(gateway.id)} loading={saving} className="px-4 py-2">
            Use this gateway
          </PrimaryButton>
        ) : null,
      onBack: () => setSelectedId(null),
      backLabel: 'All gateways',
    });
    return () => setChrome(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway, activeId, saving, setChrome]);

  if (loading) return <LoadingBlock />;

  /* --- Detail: unbuilt gateways ---------------------------------------- */
  if (gateway && !gateway.built) {
    return (
      <div className="space-y-6">
        <NotWired>
          Nothing here saves. {gateway.name} has no integration in this system — the only payment
          code that exists is M-Pesa Daraja. Collecting through {gateway.name} would mean a new
          credential store, a checkout call and a callback handler of its own.
        </NotWired>
        <Card title="What it would collect" description="Capabilities this gateway is used for.">
          <div className="flex flex-wrap gap-2">
            {gateway.caps.map((c) => (
              <span
                key={c}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {c}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Settlement: {gateway.settlement}.
          </p>
          <div className="mt-6">
            <UnavailableSave />
          </div>
        </Card>
      </div>
    );
  }

  /* --- Detail: the four real ones -------------------------------------- */
  if (gateway) {
    const isMpesaApi = gateway.id === 'mpesa_api';
    const callback =
      form.daraja_callback_url || `${API_BASE_URL}/api/payments/mpesa/callback`;

    return (
      <div className="space-y-6">
        <Card
          title="Configuration"
          description="Saved credentials are shown below. Edit a field and save to update it."
        >
          {isMpesaApi ? (
            <div className="space-y-5">
              <Field
                label="Collection method"
                required
                hint="Paybill — the customer pays your paybill and enters an account number. Till — the customer pays your till (Buy Goods). It also decides the Daraja transaction type."
              >
                <Select
                  value={form.collection_route === 'buygoods' ? 'buygoods' : 'paybill'}
                  onChange={(e) => set('collection_route', e.target.value)}
                >
                  <option value="paybill">Paybill</option>
                  <option value="buygoods">Till (Buy Goods)</option>
                </Select>
              </Field>

              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                {form.collection_route === 'buygoods' ? (
                  <>
                    <Field label="Till number" required hint="e.g. 123456">
                      <TextInput value={form.buygoods_till} onChange={(e) => set('buygoods_till', e.target.value)} />
                    </Field>
                    <Field label="Store number" hint="The store behind the till, where Safaricom issued one.">
                      <TextInput value={form.buygoods_store} onChange={(e) => set('buygoods_store', e.target.value)} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Paybill number" required hint="e.g. 123456">
                      <TextInput value={form.paybill_shortcode} onChange={(e) => set('paybill_shortcode', e.target.value)} />
                    </Field>
                    <Field label="Account number" hint="What subscribers type as the account. Usually their own account number.">
                      <TextInput value={form.paybill_account} onChange={(e) => set('paybill_account', e.target.value)} />
                    </Field>
                  </>
                )}

                <Field label="M-Pesa shortcode" required hint="Usually the same as your paybill — this is the one Daraja STK signs with.">
                  <TextInput value={form.daraja_shortcode} onChange={(e) => set('daraja_shortcode', e.target.value)} />
                </Field>
                <Field label="Environment" required hint="Sandbox uses Safaricom's test credentials. Live moves real money.">
                  <Select value={form.daraja_env} onChange={(e) => set('daraja_env', e.target.value)}>
                    <option value="sandbox">Sandbox</option>
                    <option value="live">Live</option>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <SecretField
                  label="Consumer key" required
                  value={form.daraja_consumer_key}
                  onChange={(e) => set('daraja_consumer_key', e.target.value)}
                />
                <SecretField
                  label="Consumer secret" required
                  value={form.daraja_consumer_secret}
                  onChange={(e) => set('daraja_consumer_secret', e.target.value)}
                />
                <SecretField
                  label="Passkey" required
                  hint="For STK push — Safaricom sends it to the email registered in Daraja."
                  value={form.daraja_passkey}
                  onChange={(e) => set('daraja_passkey', e.target.value)}
                />
              </div>

              <Note title="Clearing a field here deletes the credential" tone="warn">
                <p className="mt-1">
                  Unlike the other gateways in Settings, this endpoint stores exactly what you send:
                  emptying a secret and saving <em>removes</em> it rather than keeping the previous
                  value. That is also why the saved values are shown rather than masked.
                </p>
              </Note>
            </div>
          ) : gateway.id === 'bank' ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="Bank name" required>
                <TextInput value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} />
              </Field>
              <Field label="Bank paybill" required hint="The paybill Safaricom lists for your bank.">
                <TextInput value={form.bank_paybill} onChange={(e) => set('bank_paybill', e.target.value)} />
              </Field>
              <Field label="Account number" required hint="Your account at that bank — what subscribers enter as the account.">
                <TextInput value={form.bank_account} onChange={(e) => set('bank_account', e.target.value)} />
              </Field>
            </div>
          ) : gateway.id === 'till_manual' ? (
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="Till number" required hint="e.g. 123456">
                <TextInput value={form.buygoods_till} onChange={(e) => set('buygoods_till', e.target.value)} />
              </Field>
              <Field label="Store number" hint="The store behind the till, where Safaricom issued one.">
                <TextInput value={form.buygoods_store} onChange={(e) => set('buygoods_store', e.target.value)} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="Paybill number" required hint="e.g. 123456">
                <TextInput value={form.paybill_shortcode} onChange={(e) => set('paybill_shortcode', e.target.value)} />
              </Field>
              <Field label="Account number" hint="What subscribers type as the account. Usually their own account number.">
                <TextInput value={form.paybill_account} onChange={(e) => set('paybill_account', e.target.value)} />
              </Field>
            </div>
          )}

          {!isMpesaApi && (
            <div className="mt-5">
              <Note title="No API keys means no automatic confirmation" tone="info">
                <p className="mt-1">
                  Without Daraja credentials nothing tells the system a payment landed — subscribers
                  pay, then someone records the transaction code. Add API keys on the M-Pesa gateway
                  to have renewals confirm themselves.
                </p>
              </Note>
            </div>
          )}
        </Card>

        {isMpesaApi && (
          <Card
            title="Callback URLs"
            description="Register these with Safaricom so payments confirm themselves."
          >
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <CallbackRow label="STK callback" url={callback} available />
              <CallbackRow
                label="C2B validation URL"
                url={`${API_BASE_URL}/api/payments/mpesa/validation`}
                available={false}
              />
              <CallbackRow
                label="C2B confirmation URL"
                url={`${API_BASE_URL}/api/payments/mpesa/confirmation`}
                available={false}
              />
            </div>

            <div className="mt-5 space-y-4">
              <Field
                label="Override STK callback"
                hint="Leave blank to use the URL above. Set it only when Safaricom must reach you on a different host."
              >
                <TextInput
                  value={form.daraja_callback_url}
                  placeholder={callback}
                  spellCheck={false}
                  onChange={(e) => set('daraja_callback_url', e.target.value)}
                />
              </Field>

              <NotWired>
                Only the STK callback exists. The C2B validation and confirmation routes are struck
                through above because they are not implemented, and there is no register-URL call
                either — so a customer paying your paybill directly, outside an STK prompt, is not
                picked up automatically today.
              </NotWired>
            </div>
          </Card>
        )}

        <StickySaveBar
          dirty={dirty}
          saving={saving}
          onSave={save}
          onReset={() => setForm(JSON.parse(baseline))}
        />
      </div>
    );
  }

  /* --- List ------------------------------------------------------------- */
  const builtCount = GATEWAYS.filter((g) => g.built).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          {GATEWAYS.length} gateways listed · {builtCount} built ·{' '}
          <span className="text-emerald-600 dark:text-emerald-400">
            {GATEWAYS.find((g) => g.id === activeId)?.name} active
          </span>
        </p>
        <a
          href="https://www.safaricom.co.ke/business/sme/m-pesa-payment-solutions"
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700 dark:text-emerald-400"
        >
          Need a till number?
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GATEWAYS.map((g) => (
          <GatewayCard
            key={g.id}
            gateway={g}
            active={g.id === activeId}
            onSelect={() => setSelectedId(g.id)}
          />
        ))}
      </div>

      <NotWired>
        Only the four M-Pesa and bank shapes are real — they are the same PaymentSettings row seen
        four ways, so only one can be active at a time. The other six open a summary of what
        building them would involve; none of them can take money today.
      </NotWired>

      <Card
        title="Accepted payment methods"
        description="Turn payment options on or off across the portal and dashboard"
      >
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${m.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{m.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{m.desc}</p>
                </div>
                <Toggle checked={Boolean(form[m.key])} onChange={(v) => toggleMethod(m.key, v)} />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
