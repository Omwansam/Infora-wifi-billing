/**
 * Self-serve ISP signup — the client for /api/onboarding.
 *
 * Mirrors FRONTEND/infora_billing/src/services/onboardingService.js, including
 * its return shape: every call resolves to `{ ok, data, error, fields }` and
 * never throws. `error` is always a string that can go straight in front of a
 * person; `fields` carries the flags the backend sends *alongside* an error
 * (`resend_in`, `attempts_left`, `suggestion`, `email_in_use`, `locked`,
 * `expired`) which the steps react to rather than merely report.
 *
 * This is not the same thing as POST /api/auth/register. That endpoint creates
 * a `User` with no `isp_id`, and every console screen resolves its data through
 * `current_user.isp_id` — an account made that way cannot use the product. The
 * wizard is the only path that provisions a real tenant. See ONBOARDING.md.
 */
import { ENDPOINTS, IS_LIVE } from './config';
import { publicRequest } from './http';
import * as demo from './onboarding-demo';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

export interface OnboardingResult<T = Record<string, any>> {
  ok: boolean;
  data: T | null;
  status: number;
  error: string | null;
  /** Extra flags the backend sent, whether the call succeeded or not. */
  fields: Record<string, any>;
}

export interface Country {
  code: string;
  name: string;
  dial_code: string;
  timezone: string;
  currency: string;
}

/** Normalise the HTTP envelope into `{ ok, data, error, status, fields }`. */
function unwrap<T>(res: {
  success: boolean;
  status: number;
  data?: any;
  error?: string;
}): OnboardingResult<T> {
  if (!res.success) {
    // A 4xx from this API carries its detail in the *body*, which rawRequest
    // has already reduced to `error`. Keep any structured flags that came with
    // it so the caller can still see `resend_in` / `attempts_left`.
    const body = (res.data ?? {}) as Record<string, any>;
    const { success: _s, error: _e, ...fields } = body;
    return {
      ok: false,
      data: null,
      status: res.status || 0,
      error: res.error || GENERIC_ERROR,
      fields,
    };
  }

  const data = (res.data ?? {}) as Record<string, any>;
  // The backend answers 200 with `success: false` in a couple of advisory
  // cases; treat that as a failure too rather than letting it through.
  if (data.success === false) {
    const { success: _s, error, ...fields } = data;
    return { ok: false, data: data as T, status: res.status, error: error || GENERIC_ERROR, fields };
  }
  return { ok: true, data: data as T, status: res.status, error: null, fields: data };
}

function post<T>(path: string, body: Record<string, any>): Promise<OnboardingResult<T>> {
  return publicRequest<T>(path, { method: 'POST', body }).then(unwrap<T>);
}

function get<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<OnboardingResult<T>> {
  return publicRequest<T>(path, { method: 'GET', params }).then(unwrap<T>);
}

/* --- Reference data ---------------------------------------------------- */

export interface CountriesPayload {
  countries: Country[];
  default_country: string;
  referral_sources: string[];
  base_domain: string;
  min_password_length: number;
}

/** Country / dial-code / timezone / currency table, plus referral options. */
export const fetchCountries = (): Promise<OnboardingResult<CountriesPayload>> =>
  IS_LIVE ? get(ENDPOINTS.onboardingCountries) : demo.fetchCountries();

/** Geo-defaulted country, timezone and currency for step 4. */
export const fetchLocale = (): Promise<
  OnboardingResult<{ country: string; timezone: string; currency: string; detected: boolean }>
> => (IS_LIVE ? get(ENDPOINTS.onboardingLocale) : demo.fetchLocale());

/* --- Step 1: identity --------------------------------------------------- */

export interface StartPayload {
  token: string;
  whatsapp: string;
  whatsapp_masked: string;
  expires_in: number;
  resend_in: number;
  attempts_left: number;
  sends_left: number;
  /** Dev-only: the code itself, when there is no real WhatsApp provider. */
  dev_code?: string;
}

export const startSignup = (args: {
  fullName: string;
  email: string;
  whatsapp: string;
  country: string;
}): Promise<OnboardingResult<StartPayload>> =>
  IS_LIVE
    ? post(ENDPOINTS.onboardingStart, {
        full_name: args.fullName,
        email: args.email,
        whatsapp: args.whatsapp,
        country: args.country,
      })
    : demo.startSignup(args);

/* --- Step 2: WhatsApp verification -------------------------------------- */

export const resendCode = (token: string): Promise<OnboardingResult<StartPayload>> =>
  IS_LIVE ? post(ENDPOINTS.onboardingResend, { token }) : demo.resendCode(token);

export const changeNumber = (args: {
  token: string;
  whatsapp: string;
  country: string;
}): Promise<OnboardingResult<StartPayload>> =>
  IS_LIVE
    ? post(ENDPOINTS.onboardingChangeNumber, {
        token: args.token,
        whatsapp: args.whatsapp,
        country: args.country,
      })
    : demo.changeNumber(args);

export const verifyCode = (args: {
  token: string;
  code: string;
}): Promise<OnboardingResult<{ step: number; already_verified?: boolean }>> =>
  IS_LIVE
    ? post(ENDPOINTS.onboardingVerify, { token: args.token, code: args.code })
    : demo.verifyCode(args);

/* --- Step 3: account address -------------------------------------------- */

export interface SlugPayload {
  slug: string;
  available: boolean;
  message: string;
  account_address: string;
  suggestion?: string;
}

/** Live availability. Pass `name` to let the server derive the slug. */
export const checkSlug = (args: {
  name?: string;
  slug?: string;
}): Promise<OnboardingResult<SlugPayload>> =>
  IS_LIVE
    ? get(ENDPOINTS.onboardingSlugCheck, args.name ? { name: args.name } : { slug: args.slug })
    : demo.checkSlug(args);

export const claimAccount = (args: {
  token: string;
  ispName: string;
  slug: string;
}): Promise<OnboardingResult<{ step: number; slug: string; account_address: string }>> =>
  IS_LIVE
    ? post(ENDPOINTS.onboardingAccount, {
        token: args.token,
        isp_name: args.ispName,
        slug: args.slug,
      })
    : demo.claimAccount(args);

/* --- Step 4: operating locale ------------------------------------------- */

export const saveProfile = (args: {
  token: string;
  country: string;
  timezone: string;
  currency: string;
  referralSource: string;
}): Promise<OnboardingResult<{ step: number; timezone: string; currency: string }>> =>
  IS_LIVE
    ? post(ENDPOINTS.onboardingProfile, {
        token: args.token,
        country: args.country,
        timezone: args.timezone,
        currency: args.currency,
        referral_source: args.referralSource,
      })
    : demo.saveProfile(args);

/* --- Step 5: password, then provision ----------------------------------- */

export interface ProvisioningTask {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed' | string;
  detail?: string | null;
}

export interface StatusPayload {
  status: 'pending' | 'provisioning' | 'completed' | 'failed' | string;
  step?: number;
  slug: string | null;
  account_address: string | null;
  tasks: ProvisioningTask[];
  error?: string | null;
  elapsed_seconds?: number | null;
}

export const completeSignup = (args: {
  token: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}): Promise<OnboardingResult<StatusPayload>> =>
  IS_LIVE
    ? post(ENDPOINTS.onboardingComplete, {
        token: args.token,
        password: args.password,
        confirm_password: args.confirmPassword,
        accept_terms: args.acceptTerms,
      })
    : demo.completeSignup(args);

/* --- Provisioning poll + resume ----------------------------------------- */

export const fetchStatus = (token: string): Promise<OnboardingResult<StatusPayload>> =>
  IS_LIVE ? get(ENDPOINTS.onboardingStatus, { token }) : demo.fetchStatus(token);

/** Rehydrate the wizard after the app was backgrounded or killed. */
export const fetchSession = (token: string): Promise<OnboardingResult<Record<string, any>>> =>
  IS_LIVE ? get(ENDPOINTS.onboardingSession, { token }) : demo.fetchSession(token);
