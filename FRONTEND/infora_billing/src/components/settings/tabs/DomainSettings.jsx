import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Copy, Globe, Loader2, XCircle } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { checkSlug } from '../../../services/onboardingService';
import { BRAND } from '../../../lib/brand';
import {
  Card, Section, Field, TextInput, PrimaryButton, GhostButton, LoadingBlock, Note,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Domain.
 *
 * Two addresses can point at a tenant and they behave very differently:
 *
 *   · the account address (`<slug>.<app domain>`) is issued once at signup and
 *     treated as permanent — services/tenant_slug.py explains why. It CAN now
 *     be moved, by an administrator, after acknowledging what breaks: the old
 *     address stops resolving at once, and routers keep serving portal files
 *     from it until each one is re-provisioned. The confirm step is the point.
 *
 *   · the custom domain is a normal editable setting and is fully wired.
 *
 * The panel says which is which rather than presenting two identical-looking
 * fields where only one of them saves.
 * ---------------------------------------------------------------------- */

const SUBDOMAIN = 'subdomain';
const CUSTOM = 'custom';

/** Slug rules mirrored from services/tenant_slug.py so typing feels instant. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function normaliseSlug(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function AddressRow({ url, status, tone = 'success' }) {
  const copy = () => {
    navigator.clipboard?.writeText(url);
    toast.success('Address copied');
  };
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={copy}
        title="Copy address"
        className="group flex min-w-0 items-center gap-2 text-left"
      >
        <span className="truncate font-mono text-sm text-slate-500 dark:text-slate-400">
          https://
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {url.replace(/^https?:\/\//, '')}
          </span>
        </span>
        <Copy className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-slate-500 dark:text-slate-600 dark:group-hover:text-slate-400" />
      </button>
      {status && (
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold ${
            tone === 'success'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {status}
        </span>
      )}
    </div>
  );
}

/** The mock's split field: fixed `https://`, editable label, fixed suffix. */
function AffixInput({ value, onChange, suffix, placeholder, id }) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-950">
      <span className="hidden select-none items-center border-r border-slate-200 bg-slate-50 px-3.5 font-mono text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500 sm:flex">
        https://
      </span>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(normaliseSlug(e.target.value))}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="none"
        className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-600"
      />
      <span className="flex select-none items-center border-l border-slate-200 bg-slate-50 px-3.5 font-mono text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {suffix}
      </span>
    </div>
  );
}

export default function DomainSettings() {
  const [general, setGeneral] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState(SUBDOMAIN);

  const [slug, setSlug] = useState('');
  const [slugState, setSlugState] = useState({ status: 'idle' });

  const [custom, setCustom] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);
  // Two-step on purpose: the first press explains, the second commits.
  const [confirmSlug, setConfirmSlug] = useState(false);
  const [changingSlug, setChangingSlug] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await settingsService.getGeneral(getAccessToken());
        setGeneral(data);
        setSlug(data.slug || '');
        setCustom(data.custom_domain || '');
        if (data.custom_domain) setMode(CUSTOM);
      } catch (e) {
        toast.error(e.message || 'Failed to load domain settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const baseDomain = general?.tenant_base_domain || '';
  const currentSlug = general?.slug || '';

  // The host subscribers actually reach today. A custom domain wins; otherwise
  // it is whatever the portal resolver reports, reduced to its host.
  //
  // Deliberately NOT the account address. That label is permanent but only
  // becomes routable once wildcard DNS lands, and on a deployment where
  // TENANT_BASE_DOMAIN is unset it falls back to the brand website — so
  // trusting it here would print a hostname that resolves nowhere and call it
  // "Active". It is shown below instead, as the label it currently is.
  const activeUrl = useMemo(() => {
    if (!general) return '';
    if (general.custom_domain) return general.custom_domain;
    const raw = general.current_portal_url || '';
    try {
      return new URL(raw).host;
    } catch {
      return raw.replace(/^https?:\/\//, '').split('/')[0];
    }
  }, [general]);

  // Only worth showing when it is not already the address above.
  const accountAddress =
    general?.account_address && general.account_address !== activeUrl
      ? general.account_address
      : null;

  /* --- live availability for the account address ------------------------ */
  const seq = useRef(0);
  useEffect(() => {
    const candidate = slug.trim();
    if (!candidate || candidate === currentSlug) {
      setSlugState({ status: candidate ? 'current' : 'idle' });
      return undefined;
    }
    if (!SLUG_RE.test(candidate) || candidate.length < 3) {
      setSlugState({
        status: 'invalid',
        message: 'Use 3+ letters or numbers, hyphens allowed inside.',
      });
      return undefined;
    }

    setSlugState({ status: 'checking' });
    const ticket = ++seq.current;
    const timer = setTimeout(async () => {
      const result = await checkSlug({ slug: candidate });
      if (ticket !== seq.current) return; // a newer keystroke already won
      if (!result.ok) {
        setSlugState({ status: 'error', message: result.error });
        return;
      }
      setSlugState({
        status: result.data.available ? 'available' : 'taken',
        message: result.data.message,
        address: result.data.account_address,
        suggestion: result.data.suggestion,
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [slug, currentSlug]);

  const saveCustom = useCallback(async () => {
    const value = custom.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (value && (value.includes(' ') || !value.includes('.'))) {
      toast.error('Enter a full hostname, e.g. wifi.yourcompany.com');
      return;
    }
    try {
      setSavingCustom(true);
      const res = await settingsService.saveCustomDomain(getAccessToken(), value);
      setCustom(res.custom_domain || '');
      setGeneral((g) => ({ ...g, custom_domain: res.custom_domain || null }));
      toast.success(value ? 'Custom domain saved' : 'Custom domain removed');
    } catch (e) {
      toast.error(e.message || 'Could not save domain');
    } finally {
      setSavingCustom(false);
    }
  }, [custom]);

  const changeSlug = async () => {
    if (!confirmSlug) {
      setConfirmSlug(true);
      toast('Press again to confirm — the old address stops working immediately.',
            { icon: '⚠️' });
      return;
    }
    try {
      setChangingSlug(true);
      const res = await settingsService.changeSlug(getAccessToken(), {
        slug: slug.trim(), confirm: true,
      });
      setGeneral((g) => ({ ...g, slug: res.slug, account_address: res.account_address }));
      setConfirmSlug(false);
      toast.success(res.message);
      toast(res.warning, { icon: '🛠️', duration: 8000 });
    } catch (e) {
      toast.error(e.message || 'Could not change the account address');
    } finally {
      setChangingSlug(false);
    }
  };

  if (loading || !general) return <LoadingBlock />;

  const previewAddress = slug ? `${slug}.${baseDomain}` : '';

  return (
    <div className="space-y-6">
      <Card title="Domains" description="Manage the addresses that point at this workspace.">
        <div className="space-y-6">
          <Section
            title="Active domain"
            description="Used for captive-portal redirects, admin URLs and subscriber self-serve."
          >
            <AddressRow url={activeUrl} status="Active" />
            {accountAddress && (
              <p className="mt-3 text-xs leading-relaxed text-slate-400 dark:text-slate-500">
                This workspace also holds the permanent account address{' '}
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {accountAddress}
                </span>
                {general.custom_domain
                  ? ' — it keeps working alongside your own domain.'
                  : ' — it is reserved for you, and becomes reachable once wildcard DNS is in place.'}
              </p>
            )}
          </Section>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Change domain
                </h4>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Pick which address subscribers should be sent to.
                </p>
              </div>
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
                {[
                  { value: SUBDOMAIN, label: `${BRAND.name} subdomain` },
                  { value: CUSTOM, label: 'Your own domain' },
                ].map((option) => {
                  const on = option.value === mode;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      aria-pressed={on}
                      className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                        on
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              {mode === SUBDOMAIN ? (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    Your account address sits on{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      .{baseDomain || 'the app domain'}
                    </span>
                    . Check whether a name is free below.
                  </p>

                  <AffixInput
                    id="tenant-slug"
                    value={slug}
                    onChange={setSlug}
                    suffix={`.${baseDomain}`}
                    placeholder="yourcompany"
                  />

                  <SlugStatus state={slugState} address={previewAddress} onPick={setSlug} />

                  <Note title="Changing this breaks the old address immediately" tone="warn">
                    <p className="mt-1">
                      Welcome emails, support threads and any hotspot files already pushed to a
                      router all point at{' '}
                      <span className="font-mono">{currentSlug || 'your current address'}</span>.
                      After a change you must re-run &quot;Configure services&quot; on each hotspot
                      router so it fetches portal files from the new one. Only an administrator
                      can do this.
                    </p>
                  </Note>

                  {slugState.status === 'available' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        Move this workspace to{' '}
                        <span className="font-mono font-semibold">{previewAddress}</span>?
                      </p>
                      <PrimaryButton
                        onClick={changeSlug}
                        loading={changingSlug}
                        className="px-4 py-2"
                      >
                        {confirmSlug ? 'Yes — change it' : 'Change address'}
                      </PrimaryButton>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <Field
                    label="Your domain"
                    hint="A hostname you own and control the DNS for. No http://, no trailing slash. Leave blank to go back to your account address."
                  >
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <TextInput
                        value={custom}
                        placeholder="wifi.yourcompany.com"
                        spellCheck={false}
                        autoCapitalize="none"
                        onChange={(e) => setCustom(e.target.value)}
                      />
                      <PrimaryButton
                        onClick={saveCustom}
                        loading={savingCustom}
                        className="shrink-0"
                      >
                        Save domain
                      </PrimaryButton>
                    </div>
                  </Field>

                  <Note icon={Globe} title="Point it here first" tone="info">
                    <p className="mt-1">
                      Create a <span className="font-mono font-semibold">CNAME</span> record for{' '}
                      <span className="font-mono font-semibold">
                        {custom.trim() || 'wifi.yourcompany.com'}
                      </span>{' '}
                      targeting{' '}
                      <span className="font-mono font-semibold">
                        {general.account_address || baseDomain || 'your account address'}
                      </span>
                      , then save. Until DNS resolves and a certificate is issued, subscribers keep
                      landing on your account address.
                    </p>
                  </Note>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Where this address is used" description="Changing it changes all of these.">
        <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          {[
            ['Captive portal', 'The page a hotspot subscriber lands on before they have paid.'],
            ['Subscriber self-serve', 'Where a customer checks their expiry and renews.'],
            ['Payment callbacks', 'The URL M-Pesa and card gateways post results back to.'],
            ['Links in messages', 'Every renewal link inside an SMS, email or receipt.'],
          ].map(([label, detail]) => (
            <li key={label} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/60"
              />
              <span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{label}</span>
                {' — '}
                <span className="text-slate-500 dark:text-slate-400">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** The mock's one-line verdict under the field, in every state it can be in. */
function SlugStatus({ state, address, onPick }) {
  if (state.status === 'idle') return null;

  const base = 'flex flex-wrap items-center gap-2 font-mono text-sm';

  if (state.status === 'checking') {
    return (
      <p className={`${base} text-slate-400 dark:text-slate-500`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {address} · checking…
      </p>
    );
  }
  if (state.status === 'current') {
    return (
      <p className={`${base} text-slate-500 dark:text-slate-400`}>
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        {address} · already active
      </p>
    );
  }
  if (state.status === 'available') {
    return (
      <p className={`${base} text-emerald-600 dark:text-emerald-400`}>
        <CheckCircle2 className="h-3.5 w-3.5" />
        {address} · available
      </p>
    );
  }
  return (
    <p className={`${base} text-rose-600 dark:text-rose-400`}>
      <XCircle className="h-3.5 w-3.5" />
      <span className="font-sans">{state.message || 'That name cannot be used.'}</span>
      {state.suggestion && (
        <button
          type="button"
          onClick={() => onPick(state.suggestion)}
          className="font-sans font-semibold text-emerald-600 underline underline-offset-2 hover:text-emerald-700 dark:text-emerald-400"
        >
          Try {state.suggestion}
        </button>
      )}
    </p>
  );
}
