import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Store, Smartphone, Landmark, Search, ChevronDown, Check, Info,
  ShieldCheck, Eye, EyeOff, Banknote, CreditCard, Wallet,
} from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Field, TextInput, Toggle, PrimaryButton, SaveBar, LoadingBlock } from '../ui';

// Kenyan bank / SACCO M-Pesa paybills (for the "Bank / SACCO" collection route)
const BANKS = [
  { name: 'KCB Bank', paybill: '522522' },
  { name: 'Equity Bank', paybill: '247247' },
  { name: 'Co-operative Bank', paybill: '400200' },
  { name: 'Rafiki Micro Finance', paybill: '802200' },
  { name: 'Citi Bank', paybill: '100229' },
  { name: 'Vision Fund Kenya', paybill: '200555' },
  { name: 'Musoni Microfinance', paybill: '514000' },
  { name: 'Kenya Women Finance Trust (KWFT)', paybill: '101200' },
  { name: 'Guaranty Trust Bank', paybill: '910200' },
  { name: 'Family Bank', paybill: '222111' },
  { name: 'NCBA Bank', paybill: '880100' },
  { name: 'Absa Bank Kenya', paybill: '303030' },
  { name: 'Stanbic Bank', paybill: '600100' },
  { name: 'Diamond Trust Bank (DTB)', paybill: '516600' },
  { name: 'I&M Bank', paybill: '542542' },
  { name: 'Sidian Bank', paybill: '111999' },
  { name: 'Gulf African Bank', paybill: '985050' },
  { name: 'National Bank of Kenya', paybill: '625625' },
  { name: 'HFC (Housing Finance)', paybill: '100400' },
  { name: 'Faulu Microfinance', paybill: '328272' },
  { name: 'Postbank', paybill: '200999' },
];

const ROUTES = [
  { id: 'buygoods', name: 'Buy Goods', sub: 'Till number', icon: Store },
  { id: 'paybill', name: 'M-Pesa Paybill', sub: 'Paybill shortcode', icon: Smartphone },
  { id: 'bank', name: 'Bank / SACCO', sub: 'Bank paybill', icon: Landmark },
];

function BankPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const filtered = BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(query.toLowerCase()) ||
      b.paybill.includes(query.trim()),
  );

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-left text-sm text-gray-900 outline-none transition hover:border-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? (
            <>
              <span className="font-medium">{value.name}</span>
              <span className="text-gray-400"> — Paybill: {value.paybill}</span>
            </>
          ) : (
            'Select bank or SACCO'
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type bank name or paybill…"
                className="w-full rounded-lg border-2 border-emerald-500 bg-white py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto pb-1">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400">No banks match “{query}”.</p>
            ) : (
              filtered.map((b) => {
                const active = value?.paybill === b.paybill;
                return (
                  <button
                    key={b.paybill}
                    type="button"
                    onClick={() => {
                      onChange(b);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition hover:bg-emerald-50 ${
                      active ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-gray-900">
                      {active && <Check className="h-4 w-4 text-emerald-600" />}
                      {b.name}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-gray-400">{b.paybill}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PAYMENT_METHODS = [
  { key: 'mpesa', name: 'M-Pesa (STK Push)', desc: 'Customers pay directly from the captive portal via STK push.', icon: Smartphone, iconClass: 'bg-emerald-50 text-emerald-600' },
  { key: 'manual', name: 'Manual M-Pesa', desc: 'Accept Paybill / Buy Goods payments confirmed by transaction code.', icon: Wallet, iconClass: 'bg-teal-50 text-teal-600' },
  { key: 'card', name: 'Card payments', desc: 'Visa / Mastercard checkout via your payment processor.', icon: CreditCard, iconClass: 'bg-indigo-50 text-indigo-600' },
  { key: 'cash', name: 'Cash / Agent', desc: 'Record over-the-counter or agent-collected payments manually.', icon: Banknote, iconClass: 'bg-amber-50 text-amber-600' },
];

export default function PaymentsSettings() {
  const [loading, setLoading] = useState(true);
  const [route, setRoute] = useState('paybill');
  const [buyGoods, setBuyGoods] = useState({ till: '', store: '' });
  const [paybill, setPaybill] = useState({ shortcode: '', account: '' });
  const [bank, setBank] = useState(BANKS[0]);
  const [bankAccount, setBankAccount] = useState('');
  const [savingCollection, setSavingCollection] = useState(false);

  const [daraja, setDaraja] = useState({
    env: 'sandbox', consumerKey: '', consumerSecret: '', passkey: '', shortcode: '', callbackUrl: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [savingDaraja, setSavingDaraja] = useState(false);

  const [methods, setMethods] = useState({ mpesa: true, manual: true, card: false, cash: true });

  useEffect(() => {
    (async () => {
      try {
        const d = await settingsService.getPayments(getAccessToken());
        setRoute(d.collection_route || 'paybill');
        setBuyGoods({ till: d.buygoods_till || '', store: d.buygoods_store || '' });
        setPaybill({ shortcode: d.paybill_shortcode || '', account: d.paybill_account || '' });
        setBank(
          BANKS.find((b) => b.paybill === d.bank_paybill) ||
            (d.bank_name ? { name: d.bank_name, paybill: d.bank_paybill || '' } : BANKS[0]),
        );
        setBankAccount(d.bank_account || '');
        setDaraja({
          env: d.daraja_env || 'sandbox',
          consumerKey: d.daraja_consumer_key || '',
          consumerSecret: d.daraja_consumer_secret || '',
          passkey: d.daraja_passkey || '',
          shortcode: d.daraja_shortcode || '',
          callbackUrl: d.daraja_callback_url || '',
        });
        setMethods({
          mpesa: !!d.method_mpesa, manual: !!d.method_manual,
          card: !!d.method_card, cash: !!d.method_cash,
        });
      } catch (e) {
        toast.error(e.message || 'Failed to load payment settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const configured =
    (route === 'buygoods' && buyGoods.till.trim()) ||
    (route === 'paybill' && paybill.shortcode.trim()) ||
    (route === 'bank' && !!bank);

  const saveCollection = async () => {
    setSavingCollection(true);
    try {
      await settingsService.savePayments(getAccessToken(), {
        collection_route: route,
        buygoods_till: buyGoods.till,
        buygoods_store: buyGoods.store,
        paybill_shortcode: paybill.shortcode,
        paybill_account: paybill.account,
        bank_name: bank?.name || '',
        bank_paybill: bank?.paybill || '',
        bank_account: bankAccount,
      });
      toast.success('Payment collection saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingCollection(false);
    }
  };

  const saveDaraja = async () => {
    if (!daraja.consumerKey.trim() || !daraja.consumerSecret.trim()) {
      return toast.error('Consumer key and secret are required');
    }
    setSavingDaraja(true);
    try {
      await settingsService.savePayments(getAccessToken(), {
        daraja_env: daraja.env,
        daraja_consumer_key: daraja.consumerKey,
        daraja_consumer_secret: daraja.consumerSecret,
        daraja_passkey: daraja.passkey,
        daraja_shortcode: daraja.shortcode,
        daraja_callback_url: daraja.callbackUrl,
      });
      toast.success('M-Pesa API credentials saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingDaraja(false);
    }
  };

  const toggleMethod = async (key, value) => {
    const prev = methods;
    setMethods((m) => ({ ...m, [key]: value }));
    try {
      await settingsService.savePayments(getAccessToken(), { [`method_${key}`]: value });
    } catch (e) {
      setMethods(prev);
      toast.error(e.message || 'Update failed');
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      {/* Payment collection route */}
      <Card>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-bold tracking-wide text-white">
              M-PESA
            </span>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Payment Collection</h3>
              <p className="mt-0.5 text-sm text-gray-500">Where should customers' money go when they pay?</p>
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${
              configured ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${configured ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            {configured ? 'Configured' : 'Not set'}
          </span>
        </div>

        {/* Segmented route selector */}
        <div className="grid grid-cols-1 gap-2 rounded-xl bg-gray-100 p-1.5 sm:grid-cols-3">
          {ROUTES.map((r) => {
            const on = route === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRoute(r.id)}
                className={`flex flex-col items-center rounded-lg px-4 py-3 text-center transition ${
                  on ? 'bg-white shadow-sm ring-1 ring-gray-200' : 'hover:bg-white/60'
                }`}
              >
                <span className={`text-sm font-semibold ${on ? 'text-gray-900' : 'text-gray-600'}`}>{r.name}</span>
                <span className="mt-0.5 text-xs text-gray-400">{r.sub}</span>
              </button>
            );
          })}
        </div>

        {/* Route-specific fields */}
        <div className="mt-6">
          {route === 'buygoods' && (
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="Till Number" hint="Your M-Pesa Buy Goods till number">
                <TextInput
                  value={buyGoods.till}
                  placeholder="e.g. 5203847"
                  onChange={(e) => setBuyGoods({ ...buyGoods, till: e.target.value })}
                />
              </Field>
              <Field label="Store Number" hint="Head office / store number (optional)">
                <TextInput
                  value={buyGoods.store}
                  placeholder="e.g. 4102938"
                  onChange={(e) => setBuyGoods({ ...buyGoods, store: e.target.value })}
                />
              </Field>
            </div>
          )}

          {route === 'paybill' && (
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
              <Field label="Paybill Shortcode" hint="Your M-Pesa Paybill business number">
                <TextInput
                  value={paybill.shortcode}
                  placeholder="e.g. 174379"
                  onChange={(e) => setPaybill({ ...paybill, shortcode: e.target.value })}
                />
              </Field>
              <Field label="Account Number Reference" hint="What customers put as the account (e.g. their phone number)">
                <TextInput
                  value={paybill.account}
                  placeholder="e.g. account or phone"
                  onChange={(e) => setPaybill({ ...paybill, account: e.target.value })}
                />
              </Field>
            </div>
          )}

          {route === 'bank' && (
            <div className="space-y-5">
              <Field
                label="Bank"
                hint="Search the bank or SACCO whose paybill collects your funds. The paybill number is filled automatically."
              >
                <BankPicker value={bank} onChange={setBank} />
              </Field>
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <Field label="Paybill">
                  <TextInput value={bank?.paybill || ''} readOnly className="bg-gray-50 font-mono" />
                </Field>
                <Field label="Account Number" hint="Your bank account number that receives settlements">
                  <TextInput
                    value={bankAccount}
                    placeholder="e.g. 0112233445566"
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-100 pt-5">
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <Info className="h-3.5 w-3.5" />
            Only one collection route is active at a time.
          </p>
          <SaveBar onSave={saveCollection} saving={savingCollection} />
        </div>
      </Card>

      {/* M-Pesa Daraja API credentials */}
      <Card
        title="M-Pesa Daraja API"
        description="Credentials for automated STK push. Get these from the Safaricom Daraja developer portal."
        action={
          <div className="inline-flex rounded-lg bg-gray-100 p-1 text-xs font-medium">
            {['sandbox', 'live'].map((env) => (
              <button
                key={env}
                type="button"
                onClick={() => setDaraja({ ...daraja, env })}
                className={`rounded-md px-3 py-1.5 capitalize transition ${
                  daraja.env === env ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {env}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="Consumer Key">
            <TextInput
              value={daraja.consumerKey}
              placeholder="Daraja consumer key"
              onChange={(e) => setDaraja({ ...daraja, consumerKey: e.target.value })}
            />
          </Field>
          <Field label="Consumer Secret">
            <div className="relative">
              <TextInput
                type={showSecret ? 'text' : 'password'}
                value={daraja.consumerSecret}
                placeholder="Daraja consumer secret"
                className="pr-10"
                onChange={(e) => setDaraja({ ...daraja, consumerSecret: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
          <Field label="Business Shortcode" hint="Paybill or till used for STK push">
            <TextInput
              value={daraja.shortcode}
              placeholder="e.g. 174379"
              onChange={(e) => setDaraja({ ...daraja, shortcode: e.target.value })}
            />
          </Field>
          <Field label="Passkey" hint="Lipa na M-Pesa Online passkey">
            <TextInput
              value={daraja.passkey}
              placeholder="STK passkey"
              onChange={(e) => setDaraja({ ...daraja, passkey: e.target.value })}
            />
          </Field>
          <Field label="Callback URL" className="md:col-span-2" hint="Safaricom posts payment confirmations here">
            <TextInput
              value={daraja.callbackUrl}
              placeholder="https://yourdomain.com/api/mpesa/callback"
              onChange={(e) => setDaraja({ ...daraja, callbackUrl: e.target.value })}
            />
          </Field>
        </div>

        <div className="mt-5 flex items-start gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Credentials are encrypted at rest. Use sandbox keys while testing, then switch to live before go-live.</span>
        </div>

        <div className="mt-6">
          <SaveBar onSave={saveDaraja} saving={savingDaraja} label="Save credentials" />
        </div>
      </Card>

      {/* Accepted payment methods */}
      <Card title="Accepted payment methods" description="Turn payment options on or off across the portal and dashboard">
        <div className="divide-y divide-gray-100">
          {PAYMENT_METHODS.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.key} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${m.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">{m.name}</p>
                  <p className="text-sm text-gray-500">{m.desc}</p>
                </div>
                <Toggle checked={methods[m.key]} onChange={(v) => toggleMethod(m.key, v)} />
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
