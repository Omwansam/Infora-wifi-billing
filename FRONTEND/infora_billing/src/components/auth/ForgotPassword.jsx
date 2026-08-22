import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, MailCheck, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { requestReset } from '../../services/passwordResetService';
import LumenLogo from '../brand/LumenLogo';
import AuthBackdrop from '../brand/AuthBackdrop';
import { BRAND } from '../../lib/brand';
import './login.css';

/* -------------------------------------------------------------------------
 * "I've forgotten my password."
 *
 * The confirmation screen is the same whether or not the address belongs to an
 * account, because the backend answers the same either way. That is deliberate
 * and it is the whole point: a form that says "no such account" is the
 * cheapest way for someone to find out who has one here.
 *
 * So the wording never promises an email arrived — it says what happens *if*
 * the address is on an account, which is both honest and gives nothing away.
 * ---------------------------------------------------------------------- */

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const { isDark, toggleTheme } = useTheme();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const address = email.trim();
    if (!address || !address.includes('@')) {
      setError('Enter the email address on your account.');
      return;
    }
    setLoading(true);
    const result = await requestReset(address);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  return (
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

          {sent ? (
            <>
              <div className="auth__icon-circle">
                <MailCheck size={22} />
              </div>
              <h1 className="auth__title">Check your inbox</h1>
              <p className="auth__subtitle">
                If <strong>{email.trim()}</strong> belongs to an account, a reset link is on its
                way. It works once, and expires in 45 minutes.
              </p>
              <p className="auth__hint" style={{ marginTop: 18 }}>
                Nothing after a few minutes? Check your spam folder, then try again — requesting a
                new link cancels the previous one.
              </p>
              <div className="auth__alt" style={{ marginTop: 20 }}>
                <Link to="/login" className="auth__alt-btn">
                  <ArrowLeft size={16} />
                  Back to sign in
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="auth__title">Forgot your password?</h1>
              <p className="auth__subtitle">
                Enter the email on your account and we&apos;ll send you a link to set a new one.
              </p>

              <form onSubmit={submit} className="auth__form">
                <div className="auth__field">
                  <label htmlFor="email" className="auth__label">
                    Email address
                    <span className="auth__req">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="you@operator.net"
                    className="auth__input"
                  />
                  {error && <p className="auth__error">{error}</p>}
                </div>

                <button type="submit" disabled={loading} className="auth__submit">
                  {loading && <Loader2 size={16} className="auth__spin" />}
                  Send reset link
                </button>
              </form>

              <div className="auth__divider"><span>or</span></div>
              <div className="auth__alt">
                <Link to="/login" className="auth__alt-btn">
                  <ArrowLeft size={16} />
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </motion.div>

        <p className="auth__footer">{BRAND.copyright()}</p>
      </div>
    </div>
  );
}
