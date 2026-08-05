import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle, ArrowRight, Check, Clock, Eye, EyeOff, KeyRound,
  Mail, ShieldCheck, ShieldAlert, UserCog, X,
} from 'lucide-react';
import { API_ENDPOINTS, getAuthHeaders } from '../../../config/api';
import { getAccessToken } from '../../../utils/authToken';
import { twoFactorService } from '../../../services/twoFactorService';
import { MIN_LENGTH, REQUIREMENTS, scorePassword } from '../../../lib/passwordStrength';
import { Card, Field, TextInput, PrimaryButton, SaveBar, LoadingBlock } from '../ui';

const ROLE_STYLES = {
  admin: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  manager: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  support: 'bg-amber-50 text-amber-700 ring-amber-600/20',
};

function initials(first, last, email) {
  const a = (first || '').trim()[0];
  const b = (last || '').trim()[0];
  if (a || b) return `${a || ''}${b || ''}`.toUpperCase();
  return (email || '?').trim()[0].toUpperCase();
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Password field with its own reveal toggle — one shared toggle exposed every
 *  field at once, including the current password, which is the one worth not
 *  putting on screen. */
function PasswordInput({ value, onChange, placeholder, autoComplete, invalid, id }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`pr-10 ${invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30' : ''}`}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function StrengthMeter({ password }) {
  const strength = scorePassword(password);
  if (!password) return null;

  return (
    <div className="mt-2.5">
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: strength.max }, (_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full bg-gray-200 transition-colors"
            style={i < strength.score ? { backgroundColor: strength.color } : undefined}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: strength.color }} role="status">
          {strength.label}
        </span>
        <span className="flex flex-wrap gap-1">
          {REQUIREMENTS.map((requirement) => (
            <span
              key={requirement.key}
              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ring-1 transition ${
                strength.met[requirement.key]
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                  : 'text-gray-400 ring-gray-200'
              }`}
            >
              {requirement.label}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [twoFactor, setTwoFactor] = useState({ loading: true, enabled: false, remaining: 0 });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API_ENDPOINTS.PROFILE, { headers: getAuthHeaders(getAccessToken()) });
        const data = await res.json();
        if (res.ok && data.user) setProfile(data.user);
        else throw new Error(data.error || 'Failed to load profile');
      } catch (e) {
        toast.error(e.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 2FA status is a separate call and must not block the page: if it fails the
  // card falls back to "unknown" rather than the whole tab erroring.
  useEffect(() => {
    (async () => {
      const result = await twoFactorService.getStatus();
      if (result.success && result.data) {
        setTwoFactor({
          loading: false,
          enabled: Boolean(result.data.enabled),
          remaining: result.data.backup_codes_remaining || 0,
        });
      } else {
        setTwoFactor({ loading: false, enabled: false, remaining: 0, unknown: true });
      }
    })();
  }, []);

  const set = (k, v) => setProfile((p) => ({ ...p, [k]: v }));

  const saveProfile = async () => {
    if (!profile.first_name?.trim() || !profile.last_name?.trim()) {
      return toast.error('First and last name are required');
    }
    try {
      setSavingProfile(true);
      const res = await fetch(API_ENDPOINTS.PROFILE, {
        method: 'PUT',
        headers: getAuthHeaders(getAccessToken()),
        body: JSON.stringify({
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const strength = scorePassword(pw.new_password);
  const mismatch = pw.confirm.length > 0 && pw.new_password !== pw.confirm;
  const matched = pw.confirm.length > 0 && pw.new_password === pw.confirm;
  const sameAsCurrent =
    pw.new_password.length > 0 && pw.new_password === pw.current_password;

  // Mirrors what the server enforces, so the button never invites a request the
  // API is going to refuse.
  const canSubmitPassword =
    pw.current_password.length > 0
    && strength.longEnough
    && pw.new_password === pw.confirm
    && pw.confirm.length > 0
    && !sameAsCurrent;

  const changePassword = async () => {
    if (!canSubmitPassword) return;
    try {
      setSavingPw(true);
      const res = await fetch(API_ENDPOINTS.CHANGE_PASSWORD, {
        method: 'POST',
        headers: getAuthHeaders(getAccessToken()),
        body: JSON.stringify({
          current_password: pw.current_password,
          new_password: pw.new_password,
          confirm_password: pw.confirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Change failed');
      setPw({ current_password: '', new_password: '', confirm: '' });
      toast.success('Password changed');
    } catch (e) {
      toast.error(e.message || 'Change failed');
    } finally {
      setSavingPw(false);
    }
  };

  const roleClass = useMemo(
    () => ROLE_STYLES[(profile?.role || '').toLowerCase()] || 'bg-gray-100 text-gray-600 ring-gray-500/20',
    [profile?.role],
  );

  if (loading || !profile) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      {/* Identity header — who you are signed in as, at a glance. */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-xl font-bold text-white shadow-sm">
            {initials(profile.first_name, profile.last_name, profile.email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-semibold text-gray-900">
                {[profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Your account'}
              </h2>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ${roleClass}`}>
                {profile.role || 'user'}
              </span>
              {profile.is_active === false && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-inset ring-red-600/20">
                  Inactive
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-gray-500">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {profile.email}
            </p>
          </div>
          <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-1 text-xs sm:text-right">
            <dt className="text-gray-400">Last sign-in</dt>
            <dd className="font-medium text-gray-700">{formatDate(profile.last_login)}</dd>
            <dt className="text-gray-400">Member since</dt>
            <dd className="font-medium text-gray-700">{formatDate(profile.created_at)}</dd>
          </dl>
        </div>
      </div>

      <Card
        title="Personal information"
        description="Your account details, used across the dashboard and on outgoing notifications"
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="First name">
            <TextInput
              value={profile.first_name || ''}
              onChange={(e) => set('first_name', e.target.value)}
              autoComplete="given-name"
            />
          </Field>
          <Field label="Last name">
            <TextInput
              value={profile.last_name || ''}
              onChange={(e) => set('last_name', e.target.value)}
              autoComplete="family-name"
            />
          </Field>
          <Field label="Email address" hint="This is also your sign-in address.">
            <TextInput
              type="email"
              value={profile.email || ''}
              onChange={(e) => set('email', e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="Role" hint="Roles are assigned by an administrator.">
            {/* A badge, not a disabled text input — the old version looked like
                a field you could edit but silently could not. */}
            <div className="flex h-[42px] items-center">
              <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ${roleClass}`}>
                <UserCog className="h-4 w-4" />
                <span className="capitalize">{profile.role || 'user'}</span>
              </span>
            </div>
          </Field>
        </div>
        <div className="mt-6">
          <SaveBar onSave={saveProfile} saving={savingProfile} />
        </div>
      </Card>

      <Card
        title="Change password"
        description="Use a strong password you don't use anywhere else"
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field
            label="Current password"
            className="md:col-span-2 md:max-w-[calc(50%-1rem)]"
          >
            <PasswordInput
              id="current-password"
              value={pw.current_password}
              onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
          </Field>

          <Field label="New password">
            <PasswordInput
              id="new-password"
              value={pw.new_password}
              onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
              placeholder={`At least ${MIN_LENGTH} characters`}
              autoComplete="new-password"
              invalid={sameAsCurrent}
            />
            {pw.new_password ? (
              <StrengthMeter password={pw.new_password} />
            ) : (
              <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
                At least {MIN_LENGTH} characters. A long passphrase beats a short
                complicated one.
              </p>
            )}
            {sameAsCurrent && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5" />
                Choose a password different from your current one.
              </p>
            )}
          </Field>

          <Field label="Confirm new password">
            <PasswordInput
              id="confirm-password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              placeholder="Re-enter the new password"
              autoComplete="new-password"
              invalid={mismatch}
            />
            {mismatch && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                <X className="h-3.5 w-3.5" />
                Passwords do not match.
              </p>
            )}
            {matched && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                <Check className="h-3.5 w-3.5" />
                Passwords match.
              </p>
            )}
          </Field>
        </div>

        <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            You&rsquo;ll stay signed in on this device after changing it.
          </p>
          <SaveBar
            onSave={changePassword}
            saving={savingPw}
            disabled={!canSubmitPassword}
            label="Update password"
          />
        </div>
      </Card>

      {/* Two-factor: this used to read "Coming soon" while the feature was fully
          built and reachable at /settings/2fa. It now shows real status. */}
      <Card
        title="Two-factor authentication"
        description="Require a code from your authenticator app in addition to your password"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                twoFactor.enabled
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-amber-50 text-amber-600'
              }`}
            >
              {twoFactor.enabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div>
              {twoFactor.loading ? (
                <p className="text-sm text-gray-500">Checking status…</p>
              ) : twoFactor.unknown ? (
                <>
                  <p className="text-sm font-semibold text-gray-900">Status unavailable</p>
                  <p className="text-sm text-gray-500">
                    Could not reach the server. Open the security page to check.
                  </p>
                </>
              ) : twoFactor.enabled ? (
                <>
                  <p className="text-sm font-semibold text-gray-900">
                    Enabled
                    <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      Protected
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    {twoFactor.remaining} backup code{twoFactor.remaining === 1 ? '' : 's'} remaining.
                    {twoFactor.remaining <= 2 && ' Generate new ones soon.'}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-900">Not enabled</p>
                  <p className="text-sm text-gray-500">
                    Your account is protected by a password alone.
                  </p>
                </>
              )}
            </div>
          </div>

          <Link to="/settings/2fa" className="shrink-0">
            <PrimaryButton
              className={
                twoFactor.enabled
                  ? 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 shadow-sm hover:bg-gray-50'
                  : ''
              }
            >
              <KeyRound className="h-4 w-4" />
              {twoFactor.enabled ? 'Manage' : 'Enable two-factor'}
              <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </Link>
        </div>
      </Card>
    </div>
  );
}
