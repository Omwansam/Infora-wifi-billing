import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';

const CODE_LENGTH = 6;

/** `611` -> `10m 11s`, `52` -> `52s`. */
function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${String(rest).padStart(2, '0')}s` : `${rest}s`;
}

/**
 * A countdown that ticks locally from a server-supplied starting value.
 *
 * The server is the authority on expiry — it re-checks on `/verify` — so this
 * is purely presentational. Ticking client-side avoids a poll per second just
 * to render a timer.
 */
function useCountdown(initialSeconds) {
  const [remaining, setRemaining] = useState(initialSeconds || 0);

  useEffect(() => { setRemaining(initialSeconds || 0); }, [initialSeconds]);

  useEffect(() => {
    if (remaining <= 0) return undefined;
    const timer = setInterval(() => setRemaining((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining > 0]);  // eslint-disable-line react-hooks/exhaustive-deps

  return [remaining, setRemaining];
}

/**
 * Step 2 — WhatsApp code entry.
 *
 * Six separate boxes, because that is what the design calls for, which means
 * re-implementing behaviour a single input gives free: paste of a whole code,
 * backspace across boxes, and arrow-key movement. Those are handled explicitly
 * below — without them, split-box inputs are notably worse than one field.
 */
export default function Step2Verify({
  phone,
  otpState,
  submitting,
  resending,
  error,
  devCode,
  onVerify,
  onResend,
  onChangeNumber,
}) {
  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(''));
  const inputs = useRef([]);

  const [expiresIn] = useCountdown(otpState.expires_in);
  const [resendIn, setResendIn] = useCountdown(otpState.resend_in);

  const code = digits.join('');
  const complete = code.length === CODE_LENGTH;
  const expired = expiresIn <= 0;

  // A fresh code arrived — clear the boxes so stale digits are not resubmitted.
  useEffect(() => {
    if (resending) return;
    setDigits(Array(CODE_LENGTH).fill(''));
    inputs.current[0]?.focus();
  }, [otpState.sends_left]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const focusAt = useCallback((index) => {
    const target = inputs.current[Math.max(0, Math.min(CODE_LENGTH - 1, index))];
    target?.focus();
    target?.select();
  }, []);

  const writeFrom = useCallback((startIndex, characters) => {
    const clean = characters.replace(/\D/g, '');
    if (!clean) return;
    setDigits((current) => {
      const next = [...current];
      for (let i = 0; i < clean.length && startIndex + i < CODE_LENGTH; i += 1) {
        next[startIndex + i] = clean[i];
      }
      return next;
    });
    focusAt(startIndex + clean.length);
  }, [focusAt]);

  const handleChange = (index) => (event) => {
    const raw = event.target.value;
    // A pasted or autofilled value can land in one box — spread it.
    if (raw.length > 1) {
      writeFrom(index, raw);
      return;
    }
    const digit = raw.replace(/\D/g, '');
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit) focusAt(index + 1);
  };

  const handleKeyDown = (index) => (event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      setDigits((current) => {
        const next = [...current];
        // Clear this box; if already empty, step back and clear that one.
        if (next[index]) next[index] = '';
        else if (index > 0) next[index - 1] = '';
        return next;
      });
      if (!digits[index] && index > 0) focusAt(index - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focusAt(index + 1);
    } else if (event.key === 'Enter' && complete) {
      event.preventDefault();
      onVerify(code);
    }
  };

  const handlePaste = (index) => (event) => {
    event.preventDefault();
    writeFrom(index, event.clipboardData.getData('text'));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!complete || submitting) return;
    onVerify(code);
  };

  const handleResend = async () => {
    const next = await onResend();
    if (next?.resend_in != null) setResendIn(next.resend_in);
  };

  // Group as 3–3, matching the dash in the design.
  const boxes = useMemo(() => digits.map((_, i) => i), [digits]);

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h1 className="onb__title">Check your WhatsApp</h1>
      <p className="onb__subtitle">
        We sent a 6-digit code on WhatsApp to <strong>{phone}</strong>.
        <br />
        <button type="button" className="onb__link" onClick={onChangeNumber}>
          Use a different number
        </button>
      </p>

      {devCode && (
        <div className="onb__banner onb__banner--info">
          <AlertCircle size={16} />
          <span>
            Development mode — no WhatsApp provider configured. Your code is{' '}
            <strong>{devCode}</strong>.
          </span>
        </div>
      )}

      {error && (
        <div className="onb__banner" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="onb__field">
        <div className="onb__code-head">
          <span className="onb__label" style={{ marginBottom: 0 }}>
            Verification code<span className="onb__req">*</span>
          </span>
          <span className={`onb__timer${expired ? ' onb__timer--expired' : ''}`}>
            {expired ? 'Expired' : formatCountdown(expiresIn)}
          </span>
        </div>

        <div className="onb__code">
          {boxes.map((index) => (
            <React.Fragment key={index}>
              {index === CODE_LENGTH / 2 && (
                <span className="onb__code-dash" aria-hidden="true">—</span>
              )}
              <input
                ref={(el) => { inputs.current[index] = el; }}
                className={`onb__code-box${error ? ' onb__code-box--error' : ''}`}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={CODE_LENGTH}
                aria-label={`Digit ${index + 1}`}
                value={digits[index]}
                onChange={handleChange(index)}
                onKeyDown={handleKeyDown(index)}
                onPaste={handlePaste(index)}
                disabled={submitting}
              />
            </React.Fragment>
          ))}
        </div>
      </div>

      <button
        type="submit"
        className="onb__submit"
        disabled={!complete || submitting || expired}
      >
        {submitting ? (
          <>
            <Loader2 size={17} className="onb__spin" />
            Verifying…
          </>
        ) : (
          <>
            Verify code
            <ChevronRight size={17} />
          </>
        )}
      </button>

      <p className="onb__center">
        {resendIn > 0 ? (
          `Resend in ${resendIn}s`
        ) : (
          <button
            type="button"
            className="onb__link"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? 'Sending…' : 'Resend code'}
          </button>
        )}
      </p>

      <p className="onb__note">
        No WhatsApp on this number? Switch to a WhatsApp-enabled number — the
        code can only be delivered on WhatsApp.
      </p>
    </form>
  );
}
