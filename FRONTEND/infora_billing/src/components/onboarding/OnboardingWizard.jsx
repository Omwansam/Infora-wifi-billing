import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import OnboardingLayout from './OnboardingLayout';
import StepIndicator from './StepIndicator';
import Step1Identity from './Step1Identity';
import Step2Verify from './Step2Verify';
import Step3Account from './Step3Account';
import Step4Locale from './Step4Locale';
import Step5Password from './Step5Password';
import ProvisioningScreen from './ProvisioningScreen';
import {
  claimAccount,
  changeNumber,
  completeSignup,
  fetchCountries,
  fetchLocale,
  fetchSession,
  resendCode,
  saveProfile,
  startSignup,
  verifyCode,
} from '../../services/onboardingService';

/**
 * Session key. The token is the only thing worth persisting — every other
 * field is re-read from the server on resume. sessionStorage rather than
 * localStorage: an abandoned signup should not outlive the tab.
 */
const TOKEN_KEY = 'onboarding_token';

/** Currency labels for the step-4 select, keyed by the codes the API returns. */
const CURRENCY_LABELS = {
  KES: 'Kenyan Shilling (Ksh)', UGX: 'Ugandan Shilling (USh)',
  TZS: 'Tanzanian Shilling (TSh)', RWF: 'Rwandan Franc (FRw)',
  BIF: 'Burundian Franc (FBu)', SSP: 'South Sudanese Pound (£)',
  ETB: 'Ethiopian Birr (Br)', SOS: 'Somali Shilling (Sh)',
  NGN: 'Nigerian Naira (₦)', GHS: 'Ghanaian Cedi (₵)',
  ZAR: 'South African Rand (R)', ZMW: 'Zambian Kwacha (ZK)',
  MWK: 'Malawian Kwacha (MK)', MZN: 'Mozambican Metical (MT)',
  BWP: 'Botswana Pula (P)', NAD: 'Namibian Dollar (N$)',
  XAF: 'Central African CFA Franc (FCFA)', XOF: 'West African CFA Franc (CFA)',
  EGP: 'Egyptian Pound (E£)', MAD: 'Moroccan Dirham (DH)',
  GBP: 'Pound Sterling (£)', USD: 'US Dollar ($)', CAD: 'Canadian Dollar (C$)',
  INR: 'Indian Rupee (₹)', PKR: 'Pakistani Rupee (₨)',
  BDT: 'Bangladeshi Taka (৳)', AED: 'UAE Dirham (د.إ)',
  PHP: 'Philippine Peso (₱)', IDR: 'Indonesian Rupiah (Rp)',
  BRL: 'Brazilian Real (R$)', AUD: 'Australian Dollar (A$)',
};

const EMPTY = {
  fullName: '', email: '', whatsapp: '', country: 'KE',
  ispName: '', slug: '',
  timezone: '', currency: '', referralSource: '',
  password: '', confirmPassword: '', acceptTerms: false,
};

export default function OnboardingWizard() {
  const [booting, setBooting] = useState(true);
  const [step, setStep] = useState(1);
  const [token, setToken] = useState(null);
  const [values, setValues] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState(null);

  const [countries, setCountries] = useState([]);
  const [referralSources, setReferralSources] = useState([]);
  const [baseDomain, setBaseDomain] = useState('');
  const [otpState, setOtpState] = useState({ expires_in: 0, resend_in: 0, sends_left: 5 });
  const [devCode, setDevCode] = useState(null);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [accountAddress, setAccountAddress] = useState('');
  const [localeDetected, setLocaleDetected] = useState(false);
  // Fields the user changed by hand, so a country switch does not clobber them.
  const [pinned, setPinned] = useState({});

  const setValue = useCallback((key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError(null);
  }, []);

  // --- Boot: reference data, then resume any in-flight signup --------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [countryResult, localeResult] = await Promise.all([
        fetchCountries(),
        fetchLocale(),
      ]);
      if (cancelled) return;

      if (countryResult.ok) {
        setCountries(countryResult.data.countries || []);
        setReferralSources(countryResult.data.referral_sources || []);
        setBaseDomain(countryResult.data.base_domain || '');
      } else {
        setError(countryResult.error);
      }

      const detected = localeResult.ok ? localeResult.data : null;
      if (detected) {
        setLocaleDetected(Boolean(detected.detected));
        setValues((v) => ({
          ...v,
          country: detected.country || v.country,
          timezone: detected.timezone || '',
          currency: detected.currency || '',
        }));
      }

      const saved = sessionStorage.getItem(TOKEN_KEY);
      if (saved) {
        const session = await fetchSession(saved);
        if (cancelled) return;
        if (session.ok) {
          restore(saved, session.data);
        } else {
          // Expired or unknown — drop it rather than stranding the wizard.
          sessionStorage.removeItem(TOKEN_KEY);
        }
      }

      if (!cancelled) setBooting(false);
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const restore = (savedToken, data) => {
    setToken(savedToken);
    setVerifiedPhone(data.whatsapp || '');
    setAccountAddress(data.account_address || '');
    setOtpState({
      expires_in: data.expires_in || 0,
      resend_in: data.resend_in || 0,
      sends_left: data.sends_left ?? 5,
    });
    setValues((v) => ({
      ...v,
      fullName: data.full_name || v.fullName,
      email: data.email || v.email,
      whatsapp: data.whatsapp || v.whatsapp,
      country: data.country || v.country,
      ispName: data.isp_name || v.ispName,
      slug: data.slug || v.slug,
      timezone: data.timezone || v.timezone,
      currency: data.currency || v.currency,
      referralSource: data.referral_source || v.referralSource,
    }));

    if (data.status === 'provisioning' || data.status === 'completed') setStep(6);
    else setStep(Math.min(Math.max(data.step || 1, 1), 5));
  };

  const persistToken = (value) => {
    setToken(value);
    sessionStorage.setItem(TOKEN_KEY, value);
  };

  // --- Step handlers ------------------------------------------------------

  const handleStart = async () => {
    setSubmitting(true);
    setError(null);
    const result = await startSignup({
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      whatsapp: values.whatsapp.trim(),
      country: values.country,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    persistToken(result.data.token);
    setVerifiedPhone(result.data.whatsapp);
    setOtpState(result.data);
    setDevCode(result.data.dev_code || null);
    setStep(2);
  };

  const handleVerify = async (code) => {
    setSubmitting(true);
    setError(null);
    const result = await verifyCode({ token, code });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDevCode(null);
    setStep(3);
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    const result = await resendCode(token);
    setResending(false);

    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setOtpState(result.data);
    setDevCode(result.data.dev_code || null);
    return result.data;
  };

  const handleChangeNumber = async () => {
    // Send them back to step 1 to retype the number; the same signup row is
    // re-targeted on submit, so the wizard keeps its position.
    setStep(1);
    setError(null);
  };

  const handleRetarget = async () => {
    setSubmitting(true);
    setError(null);
    const result = await changeNumber({
      token,
      whatsapp: values.whatsapp.trim(),
      country: values.country,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setVerifiedPhone(result.data.whatsapp);
    setOtpState(result.data);
    setDevCode(result.data.dev_code || null);
    setStep(2);
  };

  const handleAccount = async (slug) => {
    setSubmitting(true);
    setError(null);
    const result = await claimAccount({ token, ispName: values.ispName.trim(), slug });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAccountAddress(result.data.account_address);
    setValue('slug', result.data.slug);
    setStep(4);
  };

  const handleCountryChange = (code) => {
    const country = countries.find((c) => c.code === code);
    setValues((current) => ({
      ...current,
      country: code,
      // Only re-default what the user has not deliberately set.
      timezone: pinned.timezone ? current.timezone : (country?.timezone || current.timezone),
      currency: pinned.currency ? current.currency : (country?.currency || current.currency),
    }));
    setLocaleDetected(false);
    setError(null);
  };

  const handleLocaleChange = (key, value) => {
    setPinned((p) => ({ ...p, [key]: true }));
    setValue(key, value);
  };

  const handleProfile = async () => {
    setSubmitting(true);
    setError(null);
    const result = await saveProfile({
      token,
      country: values.country,
      timezone: values.timezone,
      currency: values.currency,
      referralSource: values.referralSource,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep(5);
  };

  const [provisionTasks, setProvisionTasks] = useState([]);

  const handleComplete = async () => {
    setSubmitting(true);
    setError(null);
    const result = await completeSignup({
      token,
      password: values.password,
      confirmPassword: values.confirmPassword,
      acceptTerms: values.acceptTerms,
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAccountAddress(result.data.account_address || accountAddress);
    setProvisionTasks(result.data.tasks || []);
    // The password never needs to exist in memory again.
    setValues((v) => ({ ...v, password: '', confirmPassword: '' }));
    setStep(6);
  };

  // --- Derived ------------------------------------------------------------

  const timezones = useMemo(() => {
    const fromTable = countries.map((c) => c.timezone);
    const all = new Set([...fromTable, values.timezone].filter(Boolean));
    return Array.from(all).sort();
  }, [countries, values.timezone]);

  const currencies = useMemo(() => {
    const codes = new Set([...countries.map((c) => c.currency), values.currency].filter(Boolean));
    return Array.from(codes)
      .sort()
      .map((code) => ({ code, label: CURRENCY_LABELS[code] || code }));
  }, [countries, values.currency]);

  const goBack = useCallback(() => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  // --- Render -------------------------------------------------------------

  if (booting) {
    return (
      <OnboardingLayout>
        <div style={{ display: 'grid', placeItems: 'center', padding: '48px 0', gap: 14 }}>
          <Loader2 size={26} className="onb__spin" style={{ color: 'var(--onb-accent)' }} />
          <p className="onb__subtitle" style={{ margin: 0 }}>Loading…</p>
        </div>
      </OnboardingLayout>
    );
  }

  if (step === 6) {
    return (
      <OnboardingLayout wide>
        <ProvisioningScreen
          token={token}
          slug={values.slug}
          accountAddress={accountAddress}
          initialTasks={provisionTasks}
          onFinish={() => sessionStorage.removeItem(TOKEN_KEY)}
        />
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout>
      <StepIndicator
        current={step}
        onBack={step > 1 ? goBack : undefined}
        disabled={submitting}
      />

      {step === 1 && (
        <Step1Identity
          values={values}
          countries={countries}
          submitting={submitting}
          error={error}
          onChange={setValue}
          // Once a signup row exists, retyping the number re-targets it rather
          // than starting a second one.
          onSubmit={token ? handleRetarget : handleStart}
        />
      )}

      {step === 2 && (
        <Step2Verify
          phone={verifiedPhone}
          otpState={otpState}
          submitting={submitting}
          resending={resending}
          error={error}
          devCode={devCode}
          onVerify={handleVerify}
          onResend={handleResend}
          onChangeNumber={handleChangeNumber}
        />
      )}

      {step === 3 && (
        <Step3Account
          values={values}
          baseDomain={baseDomain}
          submitting={submitting}
          error={error}
          onChange={setValue}
          onSubmit={handleAccount}
        />
      )}

      {step === 4 && (
        <Step4Locale
          values={{ ...values, whatsapp: verifiedPhone, accountAddress }}
          countries={countries}
          referralSources={referralSources}
          timezones={timezones}
          currencies={currencies}
          detected={localeDetected}
          submitting={submitting}
          error={error}
          onChange={handleLocaleChange}
          onCountryChange={handleCountryChange}
          onSubmit={handleProfile}
        />
      )}

      {step === 5 && (
        <Step5Password
          values={values}
          submitting={submitting}
          error={error}
          onChange={setValue}
          onSubmit={handleComplete}
        />
      )}
    </OnboardingLayout>
  );
}
