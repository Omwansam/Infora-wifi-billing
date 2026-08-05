import React, { useState } from 'react';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Step 1 — who is signing up, and where to send the code.
 *
 * The country select drives the dial code, so the national number field stays
 * free of the "+254 or 0 or neither?" ambiguity. The server normalises whatever
 * arrives, but showing the prefix means people can see what they are about to
 * confirm.
 */
export default function Step1Identity({
  values,
  countries,
  submitting,
  error,
  onChange,
  onSubmit,
}) {
  const [touched, setTouched] = useState({});

  const canSubmit =
    values.fullName.trim().length >= 2
    && values.email.trim().length > 3
    && values.whatsapp.trim().length >= 6;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    onSubmit();
  };

  const dialCode =
    countries.find((c) => c.code === values.country)?.dial_code || '';

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="onb__title">Manage your ISP business</h1>
      <p className="onb__subtitle">
        Streamline operations, automate billing, and delight your customers —
        start by verifying your WhatsApp number.
      </p>

      {error && (
        <div className="onb__banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-name">
          Full name<span className="onb__req">*</span>
        </label>
        <input
          id="onb-name"
          className="onb__input"
          type="text"
          autoComplete="name"
          placeholder="Your full name"
          value={values.fullName}
          onChange={(e) => onChange('fullName', e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
          disabled={submitting}
          required
        />
        {touched.fullName && values.fullName.trim().length < 2 && (
          <p className="onb__error">Enter your full name.</p>
        )}
      </div>

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-email">
          Email<span className="onb__req">*</span>
        </label>
        <input
          id="onb-email"
          className="onb__input"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          value={values.email}
          onChange={(e) => onChange('email', e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          disabled={submitting}
          required
        />
        <p className="onb__hint">Your sign-in address — no temporary inboxes.</p>
      </div>

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-phone">
          WhatsApp number<span className="onb__req">*</span>
        </label>
        <div className="onb__phone">
          <select
            className="onb__select"
            aria-label="Country dialling code"
            value={values.country}
            onChange={(e) => onChange('country', e.target.value)}
            disabled={submitting}
          >
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.dial_code} {country.code}
              </option>
            ))}
          </select>
          <input
            id="onb-phone"
            className="onb__input"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="7XX XXX XXX"
            value={values.whatsapp}
            onChange={(e) => onChange('whatsapp', e.target.value)}
            disabled={submitting}
            required
          />
        </div>
        <p className="onb__hint">
          We&rsquo;ll send a 6-digit code to this number on WhatsApp
          {dialCode ? ` (${dialCode})` : ''} — it must have an active WhatsApp
          account.
        </p>
      </div>

      <button type="submit" className="onb__submit" disabled={!canSubmit || submitting}>
        {submitting ? (
          <>
            <Loader2 size={17} className="onb__spin" />
            Sending code…
          </>
        ) : (
          <>
            Send WhatsApp code
            <ChevronRight size={17} />
          </>
        )}
      </button>

      <p className="onb__center">
        Already have an account?{' '}
        <Link to="/login" className="onb__link">Sign in</Link>
      </p>
    </form>
  );
}
