/**
 * Self-serve ISP onboarding API.
 *
 * Every function returns the same shape: `{ ok, data, error, status }`.
 *
 * This is deliberate. `apiCall` never throws — on failure it *returns*
 * `{ success: false, error }`. Call sites elsewhere in this codebase check
 * `if (response.success)` and then silently do nothing on the failure branch,
 * so a server error looks identical to a user who simply did not click. In a
 * signup wizard that is fatal: the person sees a dead button and leaves.
 *
 * So the unwrapping happens once, here, and `error` is always a string the UI
 * can put in front of someone. `fields` carries the extra flags the backend
 * sends alongside an error (`resend_in`, `attempts_left`, `suggestion`,
 * `email_in_use`), which the steps use to react rather than just report.
 */
import { API_ENDPOINTS } from '../config/api';
import { apiCall } from '../utils/api';

const GENERIC_ERROR = 'Something went wrong. Please try again.';

/** Normalise an apiCall result into `{ ok, data, error, status, fields }`. */
function unwrap(result) {
  if (!result.success) {
    return {
      ok: false,
      data: null,
      status: result.status || 0,
      error: result.error || GENERIC_ERROR,
      fields: {},
    };
  }

  const data = result.data || {};
  // The backend answers 200 with `success: false` in a couple of advisory
  // cases; treat that as a failure too rather than letting it through.
  if (data.success === false) {
    const { success, error, ...fields } = data;
    return {
      ok: false,
      data,
      status: result.status,
      error: error || GENERIC_ERROR,
      fields,
    };
  }

  return { ok: true, data, status: result.status, error: null, fields: data };
}

function post(endpoint, body) {
  return apiCall(endpoint, { method: 'POST', body: JSON.stringify(body) }).then(unwrap);
}

function get(endpoint) {
  return apiCall(endpoint).then(unwrap);
}

// --- Reference data --------------------------------------------------------

/** Country / dial-code / timezone / currency table, plus referral options. */
export const fetchCountries = () => get(API_ENDPOINTS.ONBOARDING_COUNTRIES);

/** Geo-defaulted country, timezone and currency for step 4. */
export const fetchLocale = () => get(API_ENDPOINTS.ONBOARDING_LOCALE);

// --- Step 1: identity ------------------------------------------------------

export const startSignup = ({ fullName, email, whatsapp, country }) =>
  post(API_ENDPOINTS.ONBOARDING_START, {
    full_name: fullName,
    email,
    whatsapp,
    country,
  });

// --- Step 2: WhatsApp verification -----------------------------------------

export const resendCode = (token) => post(API_ENDPOINTS.ONBOARDING_RESEND, { token });

export const changeNumber = ({ token, whatsapp, country }) =>
  post(API_ENDPOINTS.ONBOARDING_CHANGE_NUMBER, { token, whatsapp, country });

export const verifyCode = ({ token, code }) =>
  post(API_ENDPOINTS.ONBOARDING_VERIFY, { token, code });

// --- Step 3: account address -----------------------------------------------

/** Live availability. Pass `name` to let the server derive the slug. */
export const checkSlug = ({ name, slug }) =>
  get(API_ENDPOINTS.onboardingSlugCheck(name ? { name } : { slug }));

export const claimAccount = ({ token, ispName, slug }) =>
  post(API_ENDPOINTS.ONBOARDING_ACCOUNT, { token, isp_name: ispName, slug });

// --- Step 4: operating locale ----------------------------------------------

export const saveProfile = ({ token, country, timezone, currency, referralSource }) =>
  post(API_ENDPOINTS.ONBOARDING_PROFILE, {
    token,
    country,
    timezone,
    currency,
    referral_source: referralSource,
  });

// --- Step 5: password, then provision --------------------------------------

export const completeSignup = ({ token, password, confirmPassword, acceptTerms }) =>
  post(API_ENDPOINTS.ONBOARDING_COMPLETE, {
    token,
    password,
    confirm_password: confirmPassword,
    accept_terms: acceptTerms,
  });

// --- Provisioning poll + resume --------------------------------------------

export const fetchStatus = (token) => get(API_ENDPOINTS.onboardingStatus(token));

/** Rehydrate the wizard after a page refresh. */
export const fetchSession = (token) => get(API_ENDPOINTS.onboardingSession(token));

export default {
  fetchCountries,
  fetchLocale,
  startSignup,
  resendCode,
  changeNumber,
  verifyCode,
  checkSlug,
  claimAccount,
  saveProfile,
  completeSignup,
  fetchStatus,
  fetchSession,
};
