/**
 * Demo-mode stand-in for /api/onboarding.
 *
 * With no EXPO_PUBLIC_API_URL the whole app runs on seeded data (see
 * services/config.ts). The signup wizard has to keep that promise too —
 * otherwise the first screen a visitor meets is the one dead end in the build.
 *
 * It mirrors the server's *contract*, not its behaviour: the same field names,
 * the same error shapes, the same 6-digit code and resend cooldown, so the
 * screens need no `IS_LIVE` branches of their own. The code is always 123456
 * and is echoed back the way a `log` WhatsApp provider does in development.
 */
import type {
  CountriesPayload,
  Country,
  OnboardingResult,
  ProvisioningTask,
  SlugPayload,
  StartPayload,
  StatusPayload,
} from './onboarding';

const DEMO_CODE = '123456';
const RESEND_COOLDOWN = 30; // seconds
const MAX_ATTEMPTS = 5;

const COUNTRIES: Country[] = [
  { code: 'KE', name: 'Kenya', dial_code: '+254', timezone: 'Africa/Nairobi', currency: 'KES' },
  { code: 'UG', name: 'Uganda', dial_code: '+256', timezone: 'Africa/Kampala', currency: 'UGX' },
  { code: 'TZ', name: 'Tanzania', dial_code: '+255', timezone: 'Africa/Dar_es_Salaam', currency: 'TZS' },
  { code: 'RW', name: 'Rwanda', dial_code: '+250', timezone: 'Africa/Kigali', currency: 'RWF' },
  { code: 'NG', name: 'Nigeria', dial_code: '+234', timezone: 'Africa/Lagos', currency: 'NGN' },
  { code: 'GH', name: 'Ghana', dial_code: '+233', timezone: 'Africa/Accra', currency: 'GHS' },
  { code: 'ZA', name: 'South Africa', dial_code: '+27', timezone: 'Africa/Johannesburg', currency: 'ZAR' },
  { code: 'ZM', name: 'Zambia', dial_code: '+260', timezone: 'Africa/Lusaka', currency: 'ZMW' },
  { code: 'GB', name: 'United Kingdom', dial_code: '+44', timezone: 'Europe/London', currency: 'GBP' },
  { code: 'US', name: 'United States', dial_code: '+1', timezone: 'America/New_York', currency: 'USD' },
  { code: 'IN', name: 'India', dial_code: '+91', timezone: 'Asia/Kolkata', currency: 'INR' },
];

const REFERRAL_SOURCES = [
  'Search engine', 'Social media', 'Friend or colleague', 'Existing customer',
  'Industry event', 'Reseller or partner', 'Advertisement', 'Other',
];

const BASE_DOMAIN = 'lumenbilling.com';
const TAKEN_SLUGS = ['admin', 'app', 'lumen', 'billing', 'support', 'webfig', 'demo'];

interface DemoSignup {
  token: string;
  fullName: string;
  email: string;
  whatsapp: string;
  country: string;
  verified: boolean;
  attempts: number;
  lastSentAt: number;
  sends: number;
  ispName?: string;
  slug?: string;
  status: string;
  tasks: ProvisioningTask[];
  startedAt?: number;
}

const signups = new Map<string, DemoSignup>();

/* --- helpers ------------------------------------------------------------ */

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function ok<T>(data: T, delay = 320): Promise<OnboardingResult<T>> {
  await wait(delay);
  return { ok: true, data, status: 200, error: null, fields: data as any };
}

async function fail<T>(
  error: string,
  status = 400,
  fields: Record<string, any> = {},
): Promise<OnboardingResult<T>> {
  await wait(260);
  return { ok: false, data: null, status, error, fields };
}

const dialFor = (code: string) =>
  COUNTRIES.find((c) => c.code === code)?.dial_code ?? '+254';

function normalizePhone(raw: string, country: string): string | null {
  const digits = String(raw ?? '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  const dial = dialFor(country).replace('+', '');
  if (digits.startsWith('+')) return digits.length >= 8 ? digits : null;
  const national = digits.replace(/^0+/, '').replace(new RegExp(`^${dial}`), '');
  if (national.length < 6) return null;
  return `+${dial}${national}`;
}

const maskPhone = (e164: string) =>
  e164.length > 6 ? `${e164.slice(0, 4)}•••${e164.slice(-3)}` : e164;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

function otpState(row: DemoSignup) {
  const since = Math.floor((Date.now() - row.lastSentAt) / 1000);
  return {
    expires_in: Math.max(0, 600 - since),
    resend_in: Math.max(0, RESEND_COOLDOWN - since),
    attempts_left: Math.max(0, MAX_ATTEMPTS - row.attempts),
    sends_left: Math.max(0, 5 - row.sends),
  };
}

function resolve(token: string): DemoSignup | null {
  return signups.get(token) ?? null;
}

function initialTasks(): ProvisioningTask[] {
  return [
    { key: 'account_address', label: 'Creating your account address', status: 'pending' },
    { key: 'admin_user', label: 'Creating your admin account', status: 'pending' },
    { key: 'welcome_email', label: 'Sending your welcome email', status: 'pending' },
    { key: 'ready', label: 'Account ready', status: 'pending' },
  ];
}

/* --- reference data ----------------------------------------------------- */

export const fetchCountries = () =>
  ok<CountriesPayload>({
    countries: COUNTRIES,
    default_country: 'KE',
    referral_sources: REFERRAL_SOURCES,
    base_domain: BASE_DOMAIN,
    min_password_length: 10,
  }, 120);

export const fetchLocale = () =>
  ok({ country: 'KE', timezone: 'Africa/Nairobi', currency: 'KES', detected: false }, 120);

/* --- step 1 ------------------------------------------------------------- */

export async function startSignup(args: {
  fullName: string;
  email: string;
  whatsapp: string;
  country: string;
}): Promise<OnboardingResult<StartPayload>> {
  if (args.fullName.trim().length < 2) return fail('Enter your full name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.email.trim())) {
    return fail('Enter a valid email address');
  }
  const phone = normalizePhone(args.whatsapp, args.country);
  if (!phone) return fail('Enter a valid WhatsApp number, e.g. 712 345 678');

  const token = `demo-${Math.random().toString(36).slice(2, 12)}`;
  signups.set(token, {
    token,
    fullName: args.fullName.trim(),
    email: args.email.trim().toLowerCase(),
    whatsapp: phone,
    country: args.country,
    verified: false,
    attempts: 0,
    lastSentAt: Date.now(),
    sends: 1,
    status: 'pending',
    tasks: initialTasks(),
  });

  const row = signups.get(token)!;
  return ok<StartPayload>({
    token,
    whatsapp: phone,
    whatsapp_masked: maskPhone(phone),
    dev_code: DEMO_CODE,
    ...otpState(row),
  });
}

/* --- step 2 ------------------------------------------------------------- */

export async function resendCode(token: string): Promise<OnboardingResult<StartPayload>> {
  const row = resolve(token);
  if (!row) return fail('Your signup session was not found. Start again.', 404);
  const remaining = otpState(row).resend_in;
  if (remaining > 0) {
    return fail(`Please wait ${remaining}s before requesting another code.`, 429, {
      resend_in: remaining,
    });
  }
  row.lastSentAt = Date.now();
  row.sends += 1;
  row.attempts = 0;
  return ok<StartPayload>({
    token,
    whatsapp: row.whatsapp,
    whatsapp_masked: maskPhone(row.whatsapp),
    dev_code: DEMO_CODE,
    ...otpState(row),
  });
}

export async function changeNumber(args: {
  token: string;
  whatsapp: string;
  country: string;
}): Promise<OnboardingResult<StartPayload>> {
  const row = resolve(args.token);
  if (!row) return fail('Your signup session was not found. Start again.', 404);
  const phone = normalizePhone(args.whatsapp, args.country);
  if (!phone) return fail('Enter a valid WhatsApp number, e.g. 712 345 678');

  row.whatsapp = phone;
  row.country = args.country;
  row.sends = 1;
  row.attempts = 0;
  row.lastSentAt = Date.now();
  return ok<StartPayload>({
    token: args.token,
    whatsapp: phone,
    whatsapp_masked: maskPhone(phone),
    dev_code: DEMO_CODE,
    ...otpState(row),
  });
}

export async function verifyCode(args: {
  token: string;
  code: string;
}): Promise<OnboardingResult<{ step: number; already_verified?: boolean }>> {
  const row = resolve(args.token);
  if (!row) return fail('Your signup session was not found. Start again.', 404);
  if (row.verified) return ok({ step: 3, already_verified: true });

  if (row.attempts >= MAX_ATTEMPTS) {
    return fail('Too many incorrect attempts. Request a new code.', 429, { locked: true });
  }
  if (args.code.trim() !== DEMO_CODE) {
    row.attempts += 1;
    const left = Math.max(0, MAX_ATTEMPTS - row.attempts);
    return fail(
      left === 0
        ? 'Incorrect code. Request a new one.'
        : `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`,
      400,
      { attempts_left: left, locked: left === 0 },
    );
  }
  row.verified = true;
  return ok({ step: 3 });
}

/* --- step 3 ------------------------------------------------------------- */

export async function checkSlug(args: {
  name?: string;
  slug?: string;
}): Promise<OnboardingResult<SlugPayload>> {
  const candidate = slugify(args.slug ?? args.name ?? '');
  if (!candidate) {
    return ok<SlugPayload>(
      { slug: '', available: false, message: '', account_address: '' },
      80,
    );
  }
  if (candidate.length < 3) {
    return ok<SlugPayload>(
      {
        slug: candidate,
        available: false,
        message: 'Account addresses need at least 3 characters',
        account_address: `${candidate}.${BASE_DOMAIN}`,
      },
      80,
    );
  }
  const taken = TAKEN_SLUGS.includes(candidate);
  return ok<SlugPayload>(
    {
      slug: candidate,
      available: !taken,
      message: taken ? 'That address is already taken' : 'Available',
      account_address: `${candidate}.${BASE_DOMAIN}`,
      ...(taken ? { suggestion: `${candidate}-net` } : {}),
    },
    140,
  );
}

export async function claimAccount(args: {
  token: string;
  ispName: string;
  slug: string;
}): Promise<OnboardingResult<{ step: number; slug: string; account_address: string }>> {
  const row = resolve(args.token);
  if (!row) return fail('Your signup session was not found. Start again.', 404);
  if (!row.verified) return fail('Verify your WhatsApp number first.', 403);
  if (args.ispName.trim().length < 2) return fail('Enter your ISP or company name');

  const slug = slugify(args.slug || args.ispName);
  if (TAKEN_SLUGS.includes(slug)) {
    return fail('That address is already taken', 409, { suggestion: `${slug}-net` });
  }
  row.ispName = args.ispName.trim();
  row.slug = slug;
  return ok({ step: 4, slug, account_address: `${slug}.${BASE_DOMAIN}` });
}

/* --- step 4 ------------------------------------------------------------- */

export async function saveProfile(args: {
  token: string;
  country: string;
  timezone: string;
  currency: string;
  referralSource: string;
}): Promise<OnboardingResult<{ step: number; timezone: string; currency: string }>> {
  const row = resolve(args.token);
  if (!row) return fail('Your signup session was not found. Start again.', 404);
  if (!args.referralSource) return fail('Tell us how you heard about us');
  row.country = args.country;
  return ok({ step: 5, timezone: args.timezone, currency: args.currency });
}

/* --- step 5 + provisioning poll ----------------------------------------- */

export async function completeSignup(args: {
  token: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}): Promise<OnboardingResult<StatusPayload>> {
  const row = resolve(args.token);
  if (!row) return fail('Your signup session was not found. Start again.', 404);
  if ((args.password || '').length < 10) {
    return fail('Password must be at least 10 characters');
  }
  if (args.password !== args.confirmPassword) return fail('Passwords do not match');
  if (!args.acceptTerms) {
    return fail('Accept the terms of service and privacy policy to continue');
  }

  row.status = 'provisioning';
  row.startedAt = Date.now();
  return ok<StatusPayload>({
    status: 'provisioning',
    slug: row.slug ?? null,
    account_address: row.slug ? `${row.slug}.${BASE_DOMAIN}` : null,
    tasks: row.tasks,
  });
}

export async function fetchStatus(token: string): Promise<OnboardingResult<StatusPayload>> {
  const row = resolve(token);
  if (!row) return fail('Your signup session was not found. Start again.', 404);

  // Drive the task list off elapsed time so the poll behaves like the real one.
  const elapsed = row.startedAt ? (Date.now() - row.startedAt) / 1000 : 0;
  const perTask = 1.4;
  row.tasks = row.tasks.map((task, i) => {
    const startsAt = i * perTask;
    if (elapsed >= startsAt + perTask) return { ...task, status: 'done' };
    if (elapsed >= startsAt) return { ...task, status: 'running' };
    return { ...task, status: 'pending' };
  });
  if (row.tasks.every((t) => t.status === 'done')) row.status = 'completed';

  return ok<StatusPayload>(
    {
      status: row.status,
      slug: row.slug ?? null,
      account_address: row.slug ? `${row.slug}.${BASE_DOMAIN}` : null,
      tasks: row.tasks,
      elapsed_seconds: Math.floor(elapsed),
    },
    60,
  );
}

export async function fetchSession(token: string): Promise<OnboardingResult<Record<string, any>>> {
  const row = resolve(token);
  if (!row) return fail('Your signup session was not found. Start again.', 404);
  return ok({
    token: row.token,
    step: row.verified ? 3 : 2,
    status: row.status,
    full_name: row.fullName,
    email: row.email,
    whatsapp: row.whatsapp,
    whatsapp_masked: maskPhone(row.whatsapp),
    whatsapp_verified: row.verified,
    isp_name: row.ispName ?? null,
    slug: row.slug ?? null,
    country: row.country,
    ...otpState(row),
  });
}
