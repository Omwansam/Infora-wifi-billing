import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronRight, Loader2, X } from 'lucide-react';
import { checkSlug } from '../../services/onboardingService';

const DEBOUNCE_MS = 400;

/**
 * Step 3 — the permanent account address.
 *
 * The slug is derived server-side from the name, so the preview always shows
 * exactly what would be claimed rather than a client-side guess that could
 * disagree. The check is debounced because it fires on every keystroke, and its
 * result is advisory only — `/account` re-checks, and provisioning claims the
 * name atomically.
 */
export default function Step3Account({
  values,
  baseDomain,
  submitting,
  error,
  onChange,
  onSubmit,
}) {
  const [check, setCheck] = useState({ state: 'idle', slug: '', message: '' });
  const requestId = useRef(0);

  const name = values.ispName;

  useEffect(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setCheck({ state: 'idle', slug: '', message: '' });
      return undefined;
    }

    setCheck((c) => ({ ...c, state: 'checking' }));
    const id = ++requestId.current;

    const timer = setTimeout(async () => {
      const result = await checkSlug({ name: trimmed });
      // A slower earlier request must not overwrite a newer answer.
      if (id !== requestId.current) return;

      if (!result.ok) {
        setCheck({ state: 'error', slug: '', message: result.error });
        return;
      }
      const { slug, available, message, suggestion } = result.data;
      setCheck({
        state: available ? 'available' : 'taken',
        slug,
        message,
        suggestion,
      });
      onChange('slug', available ? slug : '');
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = check.state === 'available' && !submitting;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit(check.slug);
  };

  const previewSlug = check.slug || 'yourname';
  const slugClass =
    check.state === 'available' ? ' onb__slug--ok'
      : check.state === 'taken' ? ' onb__slug--bad'
        : '';

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="onb__title">Name your account</h1>
      <p className="onb__subtitle">
        Your ISP name becomes your permanent account address (a subdomain) —
        pick something short and memorable. We&rsquo;ll strip spaces and
        punctuation.
      </p>

      {error && (
        <div className="onb__banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-isp">
          ISP / company name<span className="onb__req">*</span>
        </label>
        <input
          id="onb-isp"
          className="onb__input"
          type="text"
          autoComplete="organization"
          placeholder="Your ISP / company name"
          value={values.ispName}
          onChange={(e) => onChange('ispName', e.target.value)}
          disabled={submitting}
          maxLength={100}
          required
        />

        <div className={`onb__slug${slugClass}`} aria-live="polite">
          <span className="onb__slug-value">{previewSlug}</span>
          <span>.{baseDomain}</span>
          <span className="onb__slug-mark">
            {check.state === 'checking' && (
              <Loader2 size={15} className="onb__spin" />
            )}
            {check.state === 'available' && (
              <Check size={16} color="var(--onb-accent)" strokeWidth={3} />
            )}
            {check.state === 'taken' && (
              <X size={16} color="var(--onb-err)" strokeWidth={3} />
            )}
          </span>
        </div>

        {check.state === 'available' && (
          <p className="onb__ok-text">{check.message}</p>
        )}
        {(check.state === 'taken' || check.state === 'error') && (
          <p className="onb__error">
            {check.message}
            {check.suggestion && ` Try “${check.suggestion}”.`}
          </p>
        )}
      </div>

      <button type="submit" className="onb__submit" disabled={!canSubmit}>
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
