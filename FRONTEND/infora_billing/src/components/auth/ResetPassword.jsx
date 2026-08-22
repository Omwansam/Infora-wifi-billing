import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Moon, ShieldAlert, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { checkResetToken, submitReset } from '../../services/passwordResetService';
import { MIN_LENGTH, REQUIREMENTS, scorePassword } from '../../lib/passwordStrength';
import LumenLogo from '../brand/LumenLogo';
import AuthBackdrop from '../brand/AuthBackdrop';
import { BRAND } from '../../lib/brand';
import './login.css';

/* -------------------------------------------------------------------------
 * Setting a new password from an emailed link.
 *
 * The token is checked before the form renders, so a stale link says so
 * immediately instead of after someone has typed a password twice. That check
 * returns only a boolean and a masked address — enough for the right person to
 * recognise their own account, useless to anyone else holding the link.
 *
 * Strength feedback reuses lib/passwordStrength, the same meter the account
 * settings page uses, so the bar someone sees here matches the one they will
 * see next time they change it.
 * ---------------------------------------------------------------------- */

function Strength({ password }) {
  const strength = scorePassword(password);
  if (!password) return null;
  return (
    <div className="auth__strength">
      <div className="auth__strength-bars" aria-hidden="true">
        {Array.from({ length: strength.max }, (_, i) => (
          <span
            key={i}
            className="auth__strength-bar"
            style={i < strength.score ? { backgroundColor: strength.color } : undefined}
          />
        ))}
      </div>
      <div className="auth__strength-meta">
        <span style={{ color: strength.color }} role="status">{strength.label}</span>
        <span className="auth__strength-reqs">
          {REQUIREMENTS.map((r) => (
            <span
              key={r.key}
              className={`auth__req-chip ${strength.met[r.key] ? 'is-met' : ''}`}
            >
              {r.label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  const [state, setState] = useState({ checking: true, valid: false, hint: '' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setState({ checking: false, valid: false, hint: '' });
        return;
      }
      const result = await checkResetToken(token);
      if (cancelled) return;
      setState({
        checking: false,
        valid: Boolean(result.ok && result.data?.valid),
        hint: result.data?.email_hint || '',
      });
    })();
    return () => { cancelled = true; };
  }, [token]);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Those two passwords do not match.');
      return;
    }
    setSaving(true);
    const result = await submitReset(token, password, confirm);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      // A rejected password leaves the link usable; an expired one does not.
      if (/no longer valid/i.test(result.error || '')) {
        setState((s) => ({ ...s, valid: false }));
      }
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/login', { replace: true }), 2600);
  }, [token, password, confirm, navigate]);

  const shell = (children) => (
    <div className="auth">
      <AuthBackdrop />
      <button
        type="button"
        className="auth__theme"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <div className="auth__shell">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
          className="auth__card"
        >
          <div className="auth__brand">
            <LumenLogo size="lg" showText subtitle={BRAND.tagline} orientation="vertical" />
          </div>
          {children}
        </motion.div>
        <p className="auth__footer">{BRAND.copyright()}</p>
      </div>
    </div>
  );

  if (state.checking) {
    return shell(
      <div className="auth__centered">
        <Loader2 size={24} className="auth__spin" />
        <p className="auth__subtitle" style={{ marginTop: 12 }}>Checking your link…</p>
      </div>,
    );
  }

  if (done) {
    return shell(
      <>
        <div className="auth__icon-circle">
          <CheckCircle2 size={22} />
        </div>
        <h1 className="auth__title">Password updated</h1>
        <p className="auth__subtitle">
          You can sign in with your new password now. Any device already signed in stays signed in
          until its session expires.
        </p>
        <div className="auth__alt" style={{ marginTop: 20 }}>
          <Link to="/login" className="auth__alt-btn">Go to sign in</Link>
        </div>
      </>,
    );
  }

  if (!state.valid) {
    return shell(
      <>
        <div className="auth__icon-circle auth__icon-circle--warn">
          <ShieldAlert size={22} />
        </div>
        <h1 className="auth__title">This link has expired</h1>
        <p className="auth__subtitle">
          Reset links work once and last 45 minutes. Requesting a new one also cancels any older
          link, so an old email in your inbox will not work either.
        </p>
        <div className="auth__alt" style={{ marginTop: 20 }}>
          <Link to="/forgot-password" className="auth__alt-btn">Request a new link</Link>
          <Link to="/login" className="auth__alt-btn">
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </div>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="auth__title">Choose a new password</h1>
      <p className="auth__subtitle">
        {state.hint ? <>Setting a new password for <strong>{state.hint}</strong>.</> : 'Pick something you do not use anywhere else.'}
      </p>

      <form onSubmit={submit} className="auth__form">
        <div className="auth__field">
          <label htmlFor="password" className="auth__label">
            New password
            <span className="auth__req">*</span>
          </label>
          <div className="auth__control">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              className="auth__input auth__input--padded"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="auth__reveal"
              tabIndex={-1}
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <Strength password={password} />
        </div>

        <div className="auth__field">
          <label htmlFor="confirm" className="auth__label">
            Confirm new password
            <span className="auth__req">*</span>
          </label>
          <input
            id="confirm"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(''); }}
            className="auth__input"
          />
          {confirm && confirm !== password && (
            <p className="auth__error">Those two passwords do not match.</p>
          )}
        </div>

        {error && <p className="auth__error">{error}</p>}

        <button type="submit" disabled={saving} className="auth__submit">
          {saving && <Loader2 size={16} className="auth__spin" />}
          Set new password
        </button>
      </form>
    </>,
  );
}
