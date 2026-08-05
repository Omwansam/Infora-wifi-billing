import React, { useState } from 'react';
import { AlertCircle, ChevronRight, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react';
import { MIN_LENGTH, REQUIREMENTS, scorePassword } from './passwordStrength';

/**
 * Step 5 — set the console password, accept terms, then provision.
 *
 * The meter coaches; only the length floor gates submission, and the server
 * enforces that independently. See passwordStrength.js for why.
 */
export default function Step5Password({
  values,
  submitting,
  error,
  onChange,
  onSubmit,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const strength = scorePassword(values.password);
  const mismatch =
    confirmTouched && values.confirmPassword.length > 0
    && values.password !== values.confirmPassword;

  const canSubmit =
    strength.longEnough
    && values.password === values.confirmPassword
    && values.acceptTerms
    && !submitting;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="onb__title">Secure your account</h1>
      <p className="onb__subtitle">
        Choose a strong password — you&rsquo;ll use it to sign in to your ISP
        console.
      </p>

      {error && (
        <div className="onb__banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-password">
          Password<span className="onb__req">*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="onb-password"
            className="onb__input"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder={`At least ${MIN_LENGTH} characters`}
            value={values.password}
            onChange={(e) => onChange('password', e.target.value)}
            disabled={submitting}
            style={{ paddingRight: 42 }}
            required
          />
          <button
            type="button"
            className="onb__reveal"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>

        {values.password ? (
          <>
            <div className="onb__meter" aria-hidden="true">
              {Array.from({ length: strength.max }, (_, i) => (
                <span
                  key={i}
                  className="onb__meter-seg"
                  style={i < strength.score
                    ? { background: strength.color }
                    : undefined}
                />
              ))}
            </div>
            <div className="onb__strength">
              <span
                className="onb__strength-label"
                style={{ color: strength.color }}
                role="status"
              >
                {strength.label}
              </span>
              <span className="onb__reqs">
                {REQUIREMENTS.map((requirement) => (
                  <span
                    key={requirement.key}
                    className={
                      'onb__req-chip'
                      + (strength.met[requirement.key] ? ' onb__req-chip--met' : '')
                    }
                  >
                    {requirement.label}
                  </span>
                ))}
              </span>
            </div>
          </>
        ) : (
          <p className="onb__hint">
            Use {MIN_LENGTH}+ characters with a mix of letters, numbers &amp; symbols.
          </p>
        )}
      </div>

      <div className="onb__field">
        <label className="onb__label" htmlFor="onb-confirm">
          Confirm password<span className="onb__req">*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="onb-confirm"
            className={`onb__input${mismatch ? ' onb__input--error' : ''}`}
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={values.confirmPassword}
            onChange={(e) => onChange('confirmPassword', e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            disabled={submitting}
            style={{ paddingRight: 42 }}
            required
          />
          <button
            type="button"
            className="onb__reveal"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {mismatch && <p className="onb__error">Passwords do not match.</p>}
      </div>

      <label className="onb__terms" htmlFor="onb-terms">
        <input
          id="onb-terms"
          className="onb__checkbox"
          type="checkbox"
          checked={values.acceptTerms}
          onChange={(e) => onChange('acceptTerms', e.target.checked)}
          disabled={submitting}
        />
        <span>
          I agree to the{' '}
          {/* A lucide glyph, not a "↗" literal — that character has an emoji
              presentation on most platforms and rendered as a coloured tile. */}
          <a href="/terms" target="_blank" rel="noreferrer" className="onb__link onb__link--ext">
            Terms of service<ExternalLink size={12} aria-hidden="true" />
          </a>{' '}
          and{' '}
          <a href="/privacy" target="_blank" rel="noreferrer" className="onb__link onb__link--ext">
            Privacy policy<ExternalLink size={12} aria-hidden="true" />
          </a>.
        </span>
      </label>

      <button type="submit" className="onb__submit" disabled={!canSubmit}>
        {submitting ? (
          <>
            <Loader2 size={17} className="onb__spin" />
            Creating account…
          </>
        ) : (
          <>
            Create account
            <ChevronRight size={17} />
          </>
        )}
      </button>
    </form>
  );
}
