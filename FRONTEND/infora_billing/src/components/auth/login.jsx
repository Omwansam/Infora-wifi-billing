import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Moon, ShieldCheck, Sun, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import LumenLogo from '../brand/LumenLogo';
import AuthBackdrop from '../brand/AuthBackdrop';
import { BRAND } from '../../lib/brand';
import { DEMO_MODE, DEMO_CREDENTIALS } from '../../demo/config';
import './login.css';

/* -------------------------------------------------------------------------
 * Sign in.
 *
 * The login logic is unchanged: one `login(email, password, otp)` call, and a
 * `requires_2fa` response flips the card to the code step. What changed is the
 * shape around it.
 *
 * The second factor now gets the whole card rather than an extra field bolted
 * under the password. Once the backend has asked for a code, nothing else on
 * screen is actionable, so leaving the email and password inputs sitting there
 * only invites someone to edit them and wonder why nothing happened.
 *
 * There is no "continue with passkey" here, even though the design it came
 * from has one. We have no WebAuthn credential store, and the authenticator we
 * do have is a *second* factor — it identifies nobody on its own, so it cannot
 * be an alternative to signing in. Presenting it as one would be a button that
 * looks like a shortcut and behaves like a dead end.
 * ---------------------------------------------------------------------- */

export default function LoginPage() {
  // Demo build: pre-fill the demo account so visitors just click "Sign in".
  const [email, setEmail] = useState(DEMO_MODE ? DEMO_CREDENTIALS.email : '');
  const [password, setPassword] = useState(DEMO_MODE ? DEMO_CREDENTIALS.password : '');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [needsOtp, setNeedsOtp] = useState(false);
  const [otp, setOtp] = useState('');
  const [usingBackup, setUsingBackup] = useState(false);

  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
      toast.error('Please enter both email and password');
      setLoading(false);
      return;
    }
    if (needsOtp && !otp.trim()) {
      toast.error('Enter your verification code');
      setLoading(false);
      return;
    }

    try {
      const result = await login(email, password, needsOtp ? otp.trim() : undefined, remember);

      if (result.requires_2fa) {
        setNeedsOtp(true);
        setLoading(false);
        return;
      }

      if (result.success) {
        toast.success('Signed in');
        navigate(result.user.is_admin ? '/' : '/clients', { replace: true });
      } else {
        toast.error(result.error || (needsOtp ? 'That code was not accepted' : 'Login failed'));
      }
    } catch (error) {
      toast.error('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const backToPassword = () => {
    setNeedsOtp(false);
    setOtp('');
    setUsingBackup(false);
  };

  return (
    <div className="auth">
      <AuthBackdrop />

      <button
        type="button"
        className="auth__theme"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Light theme' : 'Dark theme'}
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

          {needsOtp ? (
            <>
              <span className="auth__badge">
                <ShieldCheck size={15} />
                Two-factor
              </span>
              <h1 className="auth__title">Confirm it&apos;s you</h1>
              <p className="auth__subtitle">
                {usingBackup
                  ? 'Enter one of the backup codes you saved when you turned on two-factor.'
                  : `Enter the 6-digit code from your authenticator app for ${email}.`}
              </p>
            </>
          ) : (
            <>
              <h1 className="auth__title">Sign in</h1>
              <p className="auth__subtitle">Welcome back. Access your operator console.</p>
            </>
          )}

          {DEMO_MODE && !needsOtp && (
            <div className="auth__demo">
              <p className="auth__demo-title">Demo account — credentials pre-filled</p>
              <p className="auth__demo-body">
                {DEMO_CREDENTIALS.email} · {DEMO_CREDENTIALS.password}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth__form">
            {needsOtp ? (
              <>
                <div className="auth__field">
                  <label htmlFor="otp" className="auth__label">
                    {usingBackup ? 'Backup code' : 'Verification code'}
                    <span className="auth__req">*</span>
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode={usingBackup ? 'text' : 'numeric'}
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={usingBackup ? 32 : 6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder={usingBackup ? 'xxxx-xxxx' : '000000'}
                    className={`auth__input ${usingBackup ? '' : 'auth__input--code'}`}
                  />
                </div>

                <button
                  type="button"
                  className="auth__link auth__link--block"
                  onClick={() => { setUsingBackup((b) => !b); setOtp(''); }}
                >
                  {usingBackup
                    ? 'Use your authenticator app instead'
                    : "Can't reach your authenticator? Use a backup code"}
                </button>
              </>
            ) : (
              <>
                <div className="auth__field">
                  <label htmlFor="email" className="auth__label">
                    Email or username
                    <span className="auth__req">*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="text"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@operator.net or username"
                    className="auth__input"
                  />
                </div>

                <div className="auth__field">
                  <div className="auth__label-row">
                    <label htmlFor="password" className="auth__label">
                      Password
                      <span className="auth__req">*</span>
                    </label>
                    <Link to="/forgot-password" className="auth__link">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="auth__control">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="auth__input auth__input--padded"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="auth__reveal"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <label className="auth__remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span>Keep me signed in</span>
                </label>
              </>
            )}

            <button type="submit" disabled={loading} className="auth__submit">
              {loading && <Loader2 size={16} className="auth__spin" />}
              {needsOtp ? 'Verify and sign in' : 'Sign in'}
            </button>

            {needsOtp && (
              <button type="button" className="auth__link auth__link--block" onClick={backToPassword}>
                Back to sign in
              </button>
            )}
          </form>

          {!needsOtp && (
            <>
              <div className="auth__divider"><span>or</span></div>
              <div className="auth__alt">
                <Link to="/signup" className="auth__alt-btn">
                  <UserPlus size={16} />
                  Create an operator account
                </Link>
              </div>
              <p className="auth__hint">
                Signing in from a shared machine? Untick “Keep me signed in” and the session
                ends when you close the browser.
              </p>
            </>
          )}
        </motion.div>

        <p className="auth__footer">{BRAND.copyright()}</p>
      </div>
    </div>
  );
}
