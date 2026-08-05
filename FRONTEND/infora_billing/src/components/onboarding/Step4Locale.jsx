import React from 'react';
import { AlertCircle, Check, ChevronRight, Loader2, Lock, Phone } from 'lucide-react';

/**
 * Step 4 — where the ISP operates.
 *
 * The summary card at the top is not decoration: this is the first screen that
 * shows all three identifiers together, and the account address is about to
 * become permanent. Anything wrong here is cheap to fix now and expensive later,
 * so it is shown before the remaining fields rather than after.
 *
 * Changing the country re-defaults timezone and currency, but only those the
 * user has not already touched — silently overwriting a deliberate choice is
 * worse than a stale default.
 */
export default function Step4Locale({
  values,
  countries,
  referralSources,
  timezones,
  currencies,
  detected,
  submitting,
  error,
  onChange,
  onCountryChange,
  onSubmit,
}) {
  const canSubmit =
    values.country && values.timezone && values.currency && values.referralSource;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="onb__title">Where you operate</h1>
      <p className="onb__subtitle">
        Set your country, timezone, and billing currency — we&rsquo;ll use these
        as your account&rsquo;s defaults.
      </p>

      {error && (
        <div className="onb__banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="onb__summary">
        <div className="onb__summary-row">
          <span className="onb__summary-icon"><Check size={14} strokeWidth={3} /></span>
          <span className="onb__summary-key">Email</span>
          <span className="onb__summary-val">{values.email}</span>
          <span className="onb__chip onb__chip--ok">VERIFIED</span>
        </div>
        <div className="onb__summary-row">
          <span className="onb__summary-icon"><Phone size={13} /></span>
          <span className="onb__summary-key">WhatsApp</span>
          <span className="onb__summary-val">{values.whatsapp}</span>
          <span className="onb__chip onb__chip--ok">VERIFIED</span>
        </div>
        <div className="onb__summary-row">
          <span className="onb__summary-icon onb__summary-icon--muted">
            <Lock size={13} />
          </span>
          <span className="onb__summary-key">Account</span>
          <span className="onb__summary-val">{values.accountAddress}</span>
          <span className="onb__chip">AUTO</span>
        </div>
      </div>

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-country">
          Country<span className="onb__req">*</span>
        </label>
        <select
          id="onb-country"
          className="onb__select"
          value={values.country}
          onChange={(e) => onCountryChange(e.target.value)}
          disabled={submitting}
          required
        >
          {countries.map((country) => (
            <option key={country.code} value={country.code}>{country.name}</option>
          ))}
        </select>
        <p className="onb__hint">
          {detected
            ? 'Detected from your location — change if you operate elsewhere.'
            : 'Select the country you operate in.'}
        </p>
      </div>

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-tz">
          Timezone<span className="onb__req">*</span>
        </label>
        <select
          id="onb-tz"
          className="onb__select"
          value={values.timezone}
          onChange={(e) => onChange('timezone', e.target.value)}
          disabled={submitting}
          required
        >
          {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-currency">
          Billing currency<span className="onb__req">*</span>
        </label>
        <select
          id="onb-currency"
          className="onb__select"
          value={values.currency}
          onChange={(e) => onChange('currency', e.target.value)}
          disabled={submitting}
          required
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>{c.code} — {c.label}</option>
          ))}
        </select>
      </div>

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-referral">
          How did you hear about us?<span className="onb__req">*</span>
        </label>
        <select
          id="onb-referral"
          className="onb__select"
          value={values.referralSource}
          onChange={(e) => onChange('referralSource', e.target.value)}
          disabled={submitting}
          required
        >
          <option value="" disabled>Select an option</option>
          {referralSources.map((source) => (
            <option key={source} value={source}>{source}</option>
          ))}
        </select>
      </div>

      <button type="submit" className="onb__submit" disabled={!canSubmit || submitting}>
        {submitting ? (
          <>
            <Loader2 size={17} className="onb__spin" />
            Saving…
          </>
        ) : (
          <>
            Continue
            <ChevronRight size={17} />
          </>
        )}
      </button>
    </form>
  );
}
