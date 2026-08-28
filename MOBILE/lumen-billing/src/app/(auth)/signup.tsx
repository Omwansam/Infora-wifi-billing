/**
 * Self-serve ISP signup — the five wizard steps plus the provisioning poll.
 *
 * This is the same flow as the console's `/signup`, against the same public
 * `/api/onboarding` endpoints, and it is deliberately *not* built on
 * `POST /api/auth/register`. That endpoint makes a `User` with no `isp_id`, and
 * every console screen resolves its data through `current_user.isp_id`, so the
 * account it produces cannot use the product. See ONBOARDING.md §1.
 *
 * The wizard's position lives on the server. This screen holds an opaque token
 * and echoes it back; each endpoint re-reads the row and re-checks what has
 * actually been proven, which is what stops the OTP from being decorative. The
 * token is kept in component state and nowhere else — an abandoned signup
 * should not outlive the app session, the same call the web wizard makes about
 * the tab.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { LumenLogo } from '@/components/auth/logo';
import { PickerField, type PickerOption } from '@/components/auth/picker';
import { ProvisioningView } from '@/components/auth/provisioning';
import { AuthShell } from '@/components/auth/shell';
import { StepIndicator } from '@/components/auth/step-indicator';
import {
  AuthCard,
  AuthInput,
  AuthLink,
  AuthNotice,
  AuthSubmit,
  AuthSubtitle,
  AuthTitle,
  Checkbox,
  CodeInput,
  Field,
  InputAdornment,
} from '@/components/auth/ui';
import { useThemeMode } from '@/contexts/theme-mode';
import { authPalette, mono } from '@/lib/auth-theme';
import { MIN_LENGTH, REQUIREMENTS, scorePassword } from '@/lib/password-strength';
import { IS_LIVE } from '@/services';
import * as onboarding from '@/services/onboarding';
import type { Country, ProvisioningTask } from '@/services/onboarding';

const CURRENCY_LABELS: Record<string, string> = {
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

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

/**
 * The last answer `/slug-check` gave, tagged with the query that produced it.
 *
 * "Checking" is derived from that tag rather than stored, so there is no
 * setState in the effect body clearing it — and the field can never show a
 * verdict that belongs to a slug the user has already typed past.
 */
interface SlugState {
  query: string;
  slug: string;
  available: boolean | null;
  message: string;
  accountAddress: string;
  suggestion?: string;
}

const EMPTY_SLUG: SlugState = {
  query: '',
  slug: '',
  available: null,
  message: '',
  accountAddress: '',
};

export default function SignupScreen() {
  const { scheme } = useThemeMode();
  const palette = useMemo(() => authPalette('signup', scheme), [scheme]);

  // --- Reference data ----------------------------------------------------
  const [booting, setBooting] = useState(true);
  const [countries, setCountries] = useState<Country[]>([]);
  const [referralSources, setReferralSources] = useState<string[]>([]);
  const [baseDomain, setBaseDomain] = useState('');

  // --- Wizard position ---------------------------------------------------
  const [step, setStep] = useState(1);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Step 1 ------------------------------------------------------------
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('KE');
  const [whatsapp, setWhatsapp] = useState('');
  const [emailInUse, setEmailInUse] = useState(false);

  // --- Step 2 ------------------------------------------------------------
  const [code, setCode] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [locked, setLocked] = useState(false);
  const [changingNumber, setChangingNumber] = useState(false);
  const [newNumber, setNewNumber] = useState('');

  // --- Step 3 ------------------------------------------------------------
  const [ispName, setIspName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SlugState>(EMPTY_SLUG);
  const [accountAddress, setAccountAddress] = useState('');

  // --- Step 4 ------------------------------------------------------------
  const [timezone, setTimezone] = useState('');
  const [currency, setCurrency] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [touchedLocale, setTouchedLocale] = useState({ timezone: false, currency: false });

  // --- Step 5 ------------------------------------------------------------
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // --- Provisioning ------------------------------------------------------
  const [tasks, setTasks] = useState<ProvisioningTask[]>([]);
  const [provisionStatus, setProvisionStatus] = useState('provisioning');
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [lostContact, setLostContact] = useState(false);

  /* --- Boot: reference data -------------------------------------------- */

  useEffect(() => {
    let active = true;
    Promise.all([onboarding.fetchCountries(), onboarding.fetchLocale()])
      .then(([table, locale]) => {
        if (!active) return;
        if (table.ok && table.data) {
          setCountries(table.data.countries ?? []);
          setReferralSources(table.data.referral_sources ?? []);
          setBaseDomain(table.data.base_domain ?? '');
          setCountry((c) => c || table.data!.default_country || 'KE');
        } else if (table.error) {
          setError(table.error);
        }
        if (locale.ok && locale.data) {
          setCountry(locale.data.country || 'KE');
          setTimezone(locale.data.timezone || '');
          setCurrency(locale.data.currency || '');
        }
      })
      .finally(() => active && setBooting(false));
    return () => {
      active = false;
    };
  }, []);

  /* --- Step 2: resend cooldown ticker ----------------------------------- */

  useEffect(() => {
    if (step !== 2 || resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [step, resendIn]);

  /* --- Step 3: debounced slug availability ------------------------------ */

  const slugQuery = slugTouched ? slug : slugify(ispName);

  useEffect(() => {
    if (step !== 3 || !slugQuery) return;
    const id = setTimeout(async () => {
      const result = await onboarding.checkSlug({ slug: slugQuery });
      if (!result.ok || !result.data) {
        // A failed check is not a taken name. Record the attempt so the field
        // stops spinning, but claim nothing about availability.
        setSlugState({ ...EMPTY_SLUG, query: slugQuery, slug: slugQuery });
        return;
      }
      setSlugState({
        query: slugQuery,
        slug: result.data.slug,
        available: result.data.available,
        message: result.data.message,
        accountAddress: result.data.account_address,
        suggestion: result.data.suggestion,
      });
    }, 350);
    return () => clearTimeout(id);
  }, [step, slugQuery]);

  /* --- Provisioning poll ------------------------------------------------ */

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (step !== 6 || !token) return;
    let active = true;

    const tick = async () => {
      const result = await onboarding.fetchStatus(token);
      if (!active) return;
      // A dropped poll is not a failed signup — the job keeps running on the
      // server, so keep ticking and say so rather than showing an error.
      if (result.ok && result.data) {
        setLostContact(false);
        setTasks(result.data.tasks ?? []);
        setProvisionStatus(result.data.status);
        setProvisionError(result.data.error ?? null);
        setElapsed(result.data.elapsed_seconds ?? null);
        if (result.data.account_address) setAccountAddress(result.data.account_address);
        if (result.data.status === 'completed' || result.data.status === 'failed') return;
      } else {
        setLostContact(true);
      }
      pollRef.current = setTimeout(tick, 1200);
    };

    tick();
    return () => {
      active = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [step, token]);

  /* --- Derived ---------------------------------------------------------- */

  const countryOptions: PickerOption[] = useMemo(
    () => countries.map((c) => ({ value: c.code, label: c.name, meta: c.dial_code })),
    [countries],
  );

  const timezoneOptions: PickerOption[] = useMemo(() => {
    const all = new Set([...countries.map((c) => c.timezone), timezone].filter(Boolean));
    return Array.from(all)
      .sort()
      .map((tz) => ({ value: tz, label: tz }));
  }, [countries, timezone]);

  const currencyOptions: PickerOption[] = useMemo(() => {
    const codes = new Set([...countries.map((c) => c.currency), currency].filter(Boolean));
    return Array.from(codes)
      .sort()
      .map((c) => ({ value: c, label: CURRENCY_LABELS[c] ?? c, meta: c }));
  }, [countries, currency]);

  const referralOptions: PickerOption[] = useMemo(
    () => referralSources.map((s) => ({ value: s, label: s })),
    [referralSources],
  );

  const dialCode = countries.find((c) => c.code === country)?.dial_code ?? '+254';
  const strength = scorePassword(password);

  // The verdict on screen belongs to the slug currently in the box, or it is
  // still in flight — never to a previous one.
  const slugSettled = Boolean(slugQuery) && slugState.query === slugQuery;
  const slugChecking = Boolean(slugQuery) && !slugSettled;
  const slugAvailable = slugSettled ? slugState.available : null;

  /* --- Actions ---------------------------------------------------------- */

  const goBack = useCallback(() => {
    setError(null);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const applyOtpState = (fields: Record<string, any>) => {
    if (typeof fields.resend_in === 'number') setResendIn(fields.resend_in);
    if (typeof fields.attempts_left === 'number') setAttemptsLeft(fields.attempts_left);
    if (typeof fields.locked === 'boolean') setLocked(fields.locked);
  };

  const submitStep1 = async () => {
    setBusy(true);
    setError(null);
    setEmailInUse(false);
    const result = await onboarding.startSignup({
      fullName: fullName.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim(),
      country,
    });
    setBusy(false);

    if (!result.ok || !result.data) {
      setError(result.error);
      setEmailInUse(Boolean(result.fields.email_in_use));
      return;
    }
    setToken(result.data.token);
    setMaskedPhone(result.data.whatsapp_masked || result.data.whatsapp);
    setDevCode(result.data.dev_code ?? null);
    applyOtpState(result.data as any);
    setLocked(false);
    setCode('');
    setStep(2);
  };

  const submitVerify = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    const result = await onboarding.verifyCode({ token, code: code.trim() });
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      applyOtpState(result.fields);
      if (result.fields.expired) setResendIn(0);
      return;
    }
    setStep(3);
  };

  const handleResend = async () => {
    if (!token || resendIn > 0) return;
    setBusy(true);
    setError(null);
    const result = await onboarding.resendCode(token);
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error);
      applyOtpState(result.fields);
      return;
    }
    setDevCode(result.data.dev_code ?? null);
    applyOtpState(result.data as any);
    setLocked(false);
    setCode('');
  };

  const handleChangeNumber = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    const result = await onboarding.changeNumber({
      token,
      whatsapp: newNumber.trim(),
      country,
    });
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error);
      return;
    }
    setWhatsapp(newNumber.trim());
    setMaskedPhone(result.data.whatsapp_masked || result.data.whatsapp);
    setDevCode(result.data.dev_code ?? null);
    applyOtpState(result.data as any);
    setLocked(false);
    setCode('');
    setChangingNumber(false);
    setNewNumber('');
  };

  const submitStep3 = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    const result = await onboarding.claimAccount({
      token,
      ispName: ispName.trim(),
      slug: slugSettled ? slugState.slug : slugQuery,
    });
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error);
      if (result.fields.suggestion) {
        setSlug(result.fields.suggestion);
        setSlugTouched(true);
      }
      return;
    }
    setSlug(result.data.slug);
    setAccountAddress(result.data.account_address);
    setStep(4);
  };

  const submitStep4 = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    const result = await onboarding.saveProfile({
      token,
      country,
      timezone,
      currency,
      referralSource,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep(5);
  };

  const submitStep5 = async () => {
    if (!token) return;
    setBusy(true);
    setError(null);
    const result = await onboarding.completeSignup({
      token,
      password,
      confirmPassword,
      acceptTerms,
    });
    setBusy(false);
    if (!result.ok || !result.data) {
      setError(result.error);
      return;
    }
    if (result.data.account_address) setAccountAddress(result.data.account_address);
    setTasks(result.data.tasks ?? []);
    setProvisionStatus(result.data.status ?? 'provisioning');
    // The password never needs to exist in memory again.
    setPassword('');
    setConfirmPassword('');
    setStep(6);
  };

  /**
   * Changing the country re-defaults timezone and currency, but only the ones
   * the user has not already touched — silently overwriting a deliberate
   * choice is worse than a stale default.
   */
  const handleCountryChange = (code: string) => {
    setCountry(code);
    const entry = countries.find((c) => c.code === code);
    if (!entry) return;
    if (!touchedLocale.timezone) setTimezone(entry.timezone);
    if (!touchedLocale.currency) setCurrency(entry.currency);
  };

  /* --- Render ----------------------------------------------------------- */

  if (booting) {
    return (
      <AuthShell palette={palette} showFooter={false}>
        <View style={{ alignItems: 'center', gap: 16 }}>
          <LumenLogo color={palette.text} subtitleColor={palette.accent} />
          <ActivityIndicator color={palette.accent} />
        </View>
      </AuthShell>
    );
  }

  const canSubmit = (() => {
    switch (step) {
      case 1:
        return fullName.trim().length >= 2 && email.includes('@') && whatsapp.trim().length >= 6;
      case 2:
        return changingNumber ? newNumber.trim().length >= 6 : code.trim().length >= 4 && !locked;
      case 3:
        return ispName.trim().length >= 2 && slugAvailable === true;
      case 4:
        return Boolean(country && timezone && currency && referralSource);
      case 5:
        return (
          strength.longEnough && password === confirmPassword && acceptTerms
        );
      default:
        return false;
    }
  })();

  return (
    <AuthShell palette={palette}>
      <AuthCard palette={palette} maxWidth={520}>
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <LumenLogo
            size={44}
            orientation="horizontal"
            color={palette.text}
            subtitleColor={palette.accent}
          />
        </View>

        {step <= 5 ? (
          <StepIndicator
            palette={palette}
            current={step}
            onBack={step > 1 ? goBack : undefined}
            disabled={busy}
          />
        ) : null}

        {/* --- Step 1: identity ------------------------------------------ */}
        {step === 1 ? (
          <>
            <AuthTitle palette={palette} align="left">
              Create your operator account
            </AuthTitle>
            <AuthSubtitle palette={palette} align="left">
              We&apos;ll send a verification code to your WhatsApp, then set up your ISP tenant.
            </AuthSubtitle>

            <View style={{ marginTop: 22, gap: 16 }}>
              <Field palette={palette} label="Full name" required>
                <AuthInput
                  palette={palette}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Jane Wanjiru"
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                />
              </Field>

              <Field
                palette={palette}
                label="Work email"
                required
                hint="Your only recovery channel if you lose the phone — use one you own.">
                <AuthInput
                  palette={palette}
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    setEmailInUse(false);
                  }}
                  placeholder="you@operator.net"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  invalid={emailInUse}
                />
              </Field>

              <Field palette={palette} label="Country" required>
                <PickerField
                  palette={palette}
                  title="Select your country"
                  placeholder="Choose a country"
                  value={country}
                  options={countryOptions}
                  onSelect={handleCountryChange}
                />
              </Field>

              <Field
                palette={palette}
                label="WhatsApp number"
                required
                hint={`The code goes to this number on WhatsApp. ${dialCode} is added for you.`}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View
                    style={{
                      height: 50,
                      justifyContent: 'center',
                      paddingHorizontal: 14,
                      borderWidth: 1,
                      borderColor: palette.line,
                      borderRadius: 12,
                      backgroundColor: palette.lineSoft,
                    }}>
                    <Text style={{ ...mono, color: palette.textDim, fontSize: 15 }}>
                      {dialCode}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AuthInput
                      palette={palette}
                      value={whatsapp}
                      onChangeText={setWhatsapp}
                      placeholder="712 345 678"
                      keyboardType="phone-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                    />
                  </View>
                </View>
              </Field>

              {error ? (
                <AuthNotice palette={palette} tone="error">
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: palette.err, fontSize: 13, lineHeight: 19 }}>
                      {error}
                    </Text>
                    {emailInUse ? (
                      <AuthLink
                        palette={palette}
                        label="Go to sign in"
                        onPress={() => router.replace('/(auth)/login')}
                      />
                    ) : null}
                  </View>
                </AuthNotice>
              ) : null}

              <AuthSubmit
                palette={palette}
                label="Send verification code"
                icon="logo-whatsapp"
                loading={busy}
                disabled={!canSubmit}
                onPress={submitStep1}
              />
            </View>
          </>
        ) : null}

        {/* --- Step 2: WhatsApp verification ----------------------------- */}
        {step === 2 ? (
          <>
            <AuthTitle palette={palette} align="left">
              {changingNumber ? 'Use a different number' : 'Check WhatsApp'}
            </AuthTitle>
            <AuthSubtitle palette={palette} align="left">
              {changingNumber
                ? 'We’ll send a fresh code to the new number. The old one stops working.'
                : `We sent a 6-digit code to ${maskedPhone}. It expires in 10 minutes.`}
            </AuthSubtitle>

            <View style={{ marginTop: 22, gap: 16 }}>
              {devCode && !changingNumber ? (
                <AuthNotice palette={palette} tone="info" icon="flask-outline">
                  <Text style={{ color: palette.accentHi, fontSize: 13, lineHeight: 19 }}>
                    {IS_LIVE
                      ? 'No WhatsApp provider is configured, so the code is echoed here: '
                      : 'Demo mode — the code is always: '}
                    <Text style={{ ...mono, fontWeight: '700' }}>{devCode}</Text>
                  </Text>
                </AuthNotice>
              ) : null}

              {changingNumber ? (
                <Field palette={palette} label="New WhatsApp number" required>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View
                      style={{
                        height: 50,
                        justifyContent: 'center',
                        paddingHorizontal: 14,
                        borderWidth: 1,
                        borderColor: palette.line,
                        borderRadius: 12,
                        backgroundColor: palette.lineSoft,
                      }}>
                      <Text style={{ ...mono, color: palette.textDim, fontSize: 15 }}>
                        {dialCode}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <AuthInput
                        palette={palette}
                        value={newNumber}
                        onChangeText={setNewNumber}
                        placeholder="712 345 678"
                        keyboardType="phone-pad"
                        autoFocus
                      />
                    </View>
                  </View>
                </Field>
              ) : (
                <Field
                  palette={palette}
                  label="Verification code"
                  required
                  hint={
                    locked
                      ? undefined
                      : `${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left before you need a new code.`
                  }>
                  <CodeInput
                    palette={palette}
                    value={code}
                    onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
                    invalid={Boolean(error)}
                  />
                </Field>
              )}

              {error ? (
                <AuthNotice palette={palette} tone="error">
                  {error}
                </AuthNotice>
              ) : null}

              <AuthSubmit
                palette={palette}
                label={changingNumber ? 'Send code to this number' : 'Verify and continue'}
                loading={busy}
                disabled={!canSubmit}
                onPress={changingNumber ? handleChangeNumber : submitVerify}
              />

              {changingNumber ? (
                <AuthLink
                  palette={palette}
                  align="center"
                  label="Keep the original number"
                  onPress={() => {
                    setChangingNumber(false);
                    setNewNumber('');
                    setError(null);
                  }}
                />
              ) : (
                <View style={{ gap: 12, alignItems: 'center' }}>
                  <AuthLink
                    palette={palette}
                    align="center"
                    disabled={resendIn > 0 || busy}
                    label={resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend the code'}
                    onPress={handleResend}
                  />
                  <AuthLink
                    palette={palette}
                    align="center"
                    label="Use a different number"
                    onPress={() => {
                      setChangingNumber(true);
                      setNewNumber('');
                      setError(null);
                    }}
                  />
                </View>
              )}
            </View>
          </>
        ) : null}

        {/* --- Step 3: account address ----------------------------------- */}
        {step === 3 ? (
          <>
            <AuthTitle palette={palette} align="left">
              Name your ISP
            </AuthTitle>
            <AuthSubtitle palette={palette} align="left">
              Your account address is issued once and cannot be changed later, so read it before
              you continue.
            </AuthSubtitle>

            <View style={{ marginTop: 22, gap: 16 }}>
              <Field palette={palette} label="ISP or company name" required>
                <AuthInput
                  palette={palette}
                  value={ispName}
                  onChangeText={setIspName}
                  placeholder="Nairobi Fibre Networks"
                  autoCapitalize="words"
                />
              </Field>

              <Field
                palette={palette}
                label="Account address"
                required
                hint={
                  <View style={{ gap: 6 }}>
                    {slugSettled && slugState.accountAddress ? (
                      <Text style={{ ...mono, color: palette.textDim, fontSize: 12.5 }}>
                        {slugState.accountAddress}
                      </Text>
                    ) : baseDomain ? (
                      <Text style={{ ...mono, color: palette.textFaint, fontSize: 12.5 }}>
                        {`your-name.${baseDomain}`}
                      </Text>
                    ) : null}
                    {slugAvailable === false && slugState.message ? (
                      <Text style={{ color: palette.err, fontSize: 12.5 }}>
                        {slugState.message}
                      </Text>
                    ) : null}
                    {slugAvailable === true ? (
                      <Text style={{ color: palette.ok, fontSize: 12.5 }}>Available</Text>
                    ) : null}
                  </View>
                }>
                <View>
                  <AuthInput
                    palette={palette}
                    value={slugTouched ? slug : slugify(ispName)}
                    onChangeText={(v) => {
                      setSlugTouched(true);
                      setSlug(slugify(v));
                    }}
                    placeholder="nairobi-fibre"
                    autoCapitalize="none"
                    autoCorrect={false}
                    padded
                    invalid={slugAvailable === false}
                  />
                  {slugChecking ? (
                    <View
                      style={{
                        position: 'absolute',
                        right: 14,
                        top: 0,
                        bottom: 0,
                        justifyContent: 'center',
                      }}>
                      <ActivityIndicator size="small" color={palette.textFaint} />
                    </View>
                  ) : slugAvailable !== null ? (
                    <InputAdornment
                      palette={palette}
                      icon={slugAvailable ? 'checkmark-circle' : 'close-circle'}
                      color={slugAvailable ? palette.ok : palette.err}
                    />
                  ) : null}
                </View>
              </Field>

              {slugState.suggestion && slugAvailable === false ? (
                <AuthLink
                  palette={palette}
                  label={`Use ${slugState.suggestion} instead`}
                  onPress={() => {
                    setSlugTouched(true);
                    setSlug(slugState.suggestion!);
                  }}
                />
              ) : null}

              {error ? (
                <AuthNotice palette={palette} tone="error">
                  {error}
                </AuthNotice>
              ) : null}

              <AuthSubmit
                palette={palette}
                label="Claim this address"
                loading={busy}
                disabled={!canSubmit}
                onPress={submitStep3}
              />
            </View>
          </>
        ) : null}

        {/* --- Step 4: operating locale ---------------------------------- */}
        {step === 4 ? (
          <>
            <AuthTitle palette={palette} align="left">
              Where you operate
            </AuthTitle>
            <AuthSubtitle palette={palette} align="left">
              Set your country, timezone and billing currency — these become your account&apos;s
              defaults.
            </AuthSubtitle>

            {/* The first screen that shows all three identifiers together, and
                the account address is about to become permanent. Anything wrong
                here is cheap to fix now and expensive later. */}
            <View
              style={{
                marginTop: 18,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: palette.line,
                backgroundColor: palette.lineSoft,
                paddingHorizontal: 14,
                paddingVertical: 4,
              }}>
              {[
                { key: 'Email', value: email.trim(), chip: 'VERIFIED', ok: true },
                { key: 'WhatsApp', value: maskedPhone, chip: 'VERIFIED', ok: true },
                { key: 'Account', value: accountAddress, chip: 'AUTO', ok: false },
              ].map((row) => (
                <View
                  key={row.key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 9,
                  }}>
                  <Ionicons
                    name={row.ok ? 'checkmark-circle' : 'lock-closed'}
                    size={14}
                    color={row.ok ? palette.ok : palette.textFaint}
                  />
                  <Text style={{ color: palette.textFaint, fontSize: 12, width: 66 }}>
                    {row.key}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ ...mono, flex: 1, color: palette.text, fontSize: 12.5 }}>
                    {row.value}
                  </Text>
                  <Text
                    style={{
                      ...mono,
                      fontSize: 9.5,
                      letterSpacing: 0.8,
                      fontWeight: '700',
                      color: row.ok ? palette.ok : palette.textFaint,
                    }}>
                    {row.chip}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ marginTop: 20, gap: 16 }}>
              <Field palette={palette} label="Country" required>
                <PickerField
                  palette={palette}
                  title="Country of operation"
                  placeholder="Choose a country"
                  value={country}
                  options={countryOptions}
                  onSelect={handleCountryChange}
                />
              </Field>

              <Field palette={palette} label="Timezone" required>
                <PickerField
                  palette={palette}
                  title="Timezone"
                  placeholder="Choose a timezone"
                  value={timezone}
                  options={timezoneOptions}
                  onSelect={(v) => {
                    setTimezone(v);
                    setTouchedLocale((t) => ({ ...t, timezone: true }));
                  }}
                />
              </Field>

              <Field
                palette={palette}
                label="Billing currency"
                required
                hint="What your subscribers are invoiced in.">
                <PickerField
                  palette={palette}
                  title="Billing currency"
                  placeholder="Choose a currency"
                  value={currency}
                  options={currencyOptions}
                  onSelect={(v) => {
                    setCurrency(v);
                    setTouchedLocale((t) => ({ ...t, currency: true }));
                  }}
                />
              </Field>

              <Field palette={palette} label="How did you hear about us?" required>
                <PickerField
                  palette={palette}
                  title="How did you hear about us?"
                  placeholder="Pick one"
                  value={referralSource}
                  options={referralOptions}
                  onSelect={setReferralSource}
                />
              </Field>

              {error ? (
                <AuthNotice palette={palette} tone="error">
                  {error}
                </AuthNotice>
              ) : null}

              <AuthSubmit
                palette={palette}
                label="Continue"
                loading={busy}
                disabled={!canSubmit}
                onPress={submitStep4}
              />
            </View>
          </>
        ) : null}

        {/* --- Step 5: password ------------------------------------------ */}
        {step === 5 ? (
          <>
            <AuthTitle palette={palette} align="left">
              Set your password
            </AuthTitle>
            <AuthSubtitle palette={palette} align="left">
              This is the password for {email.trim()} — the admin account on your new tenant.
            </AuthSubtitle>

            <View style={{ marginTop: 22, gap: 16 }}>
              <Field
                palette={palette}
                label="Password"
                required
                hint={
                  password ? (
                    <View style={{ gap: 8, marginTop: 2 }}>
                      <View style={{ flexDirection: 'row', gap: 5 }}>
                        {Array.from({ length: strength.max }, (_, i) => (
                          <View
                            key={i}
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 999,
                              backgroundColor:
                                i < strength.score ? strength.color : palette.line,
                            }}
                          />
                        ))}
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                        }}>
                        <Text
                          style={{ color: strength.color, fontSize: 12, fontWeight: '700' }}>
                          {strength.label}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          {REQUIREMENTS.map((requirement) => {
                            const met = strength.met[requirement.key];
                            return (
                              <Text
                                key={requirement.key}
                                style={{
                                  ...mono,
                                  fontSize: 10,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  borderRadius: 5,
                                  overflow: 'hidden',
                                  borderWidth: 1,
                                  borderColor: met ? `${palette.ok}66` : palette.line,
                                  backgroundColor: met ? `${palette.ok}1a` : 'transparent',
                                  color: met ? palette.ok : palette.textFaint,
                                }}>
                                {requirement.label}
                              </Text>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                  ) : (
                    `At least ${MIN_LENGTH} characters. Length is the only rule we enforce.`
                  )
                }>
                <View>
                  <AuthInput
                    palette={palette}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••••••"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    padded
                  />
                  <InputAdornment
                    palette={palette}
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    label={showPassword ? 'Hide password' : 'Show password'}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                </View>
              </Field>

              <Field
                palette={palette}
                label="Confirm password"
                required
                error={
                  confirmPassword && confirmPassword !== password
                    ? 'Passwords do not match'
                    : null
                }>
                <AuthInput
                  palette={palette}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="••••••••••••"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  invalid={Boolean(confirmPassword) && confirmPassword !== password}
                />
              </Field>

              <Checkbox
                palette={palette}
                checked={acceptTerms}
                onToggle={() => setAcceptTerms((a) => !a)}>
                <Text style={{ color: palette.textDim, fontSize: 13, lineHeight: 19 }}>
                  I accept the terms of service and the privacy policy.
                </Text>
              </Checkbox>

              {error ? (
                <AuthNotice palette={palette} tone="error">
                  {error}
                </AuthNotice>
              ) : null}

              <AuthSubmit
                palette={palette}
                label="Create my account"
                loading={busy}
                disabled={!canSubmit}
                onPress={submitStep5}
              />
            </View>
          </>
        ) : null}

        {/* --- Step 6: provisioning -------------------------------------- */}
        {step === 6 ? (
          <ProvisioningView
            palette={palette}
            tasks={tasks}
            status={provisionStatus}
            slug={slug}
            accountAddress={accountAddress}
            elapsedSeconds={elapsed}
            error={provisionError}
            lostContact={lostContact}
            onSignIn={() => router.replace('/(auth)/login')}
          />
        ) : null}
      </AuthCard>

      {step <= 5 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
          <Text style={{ color: palette.textDim, fontSize: 13.5 }}>Already have an account?</Text>
          <AuthLink
            palette={palette}
            label="Sign in"
            onPress={() => router.replace('/(auth)/login')}
          />
        </View>
      ) : null}
    </AuthShell>
  );
}
