/**
 * Password strength scoring for the signup meter.
 *
 * A straight port of FRONTEND/infora_billing/src/lib/passwordStrength.js, so
 * the bar someone sees on the phone is the bar they see in the browser and in
 * account settings. Same caveat too: this is coaching, not an entropy
 * estimator, and only the length floor is enforced — by the server, in
 * `MIN_PASSWORD_LENGTH`. Blocking submission on a subjective score punishes
 * exactly the people using a password manager.
 */

export const MIN_LENGTH = 10;

export interface Requirement {
  key: string;
  label: string;
  test: (password: string) => boolean;
}

export const REQUIREMENTS: Requirement[] = [
  { key: 'length', label: `${MIN_LENGTH}+ chars`, test: (p) => p.length >= MIN_LENGTH },
  { key: 'case', label: 'aA', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: 'digit', label: '123', test: (p) => /\d/.test(p) },
  { key: 'symbol', label: '#$%', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const LEVELS = [
  { label: 'Too short', color: '#ef4444' },
  { label: 'Weak', color: '#ef4444' },
  { label: 'Fair', color: '#f59e0b' },
  { label: 'Good', color: '#84cc16' },
  { label: 'Strong', color: '#22c55e' },
  { label: 'Excellent', color: '#22c55e' },
];

export interface PasswordScore {
  score: number;
  max: number;
  label: string;
  color: string;
  met: Record<string, boolean>;
  longEnough: boolean;
}

export function scorePassword(password: string): PasswordScore {
  const value = password || '';
  const met: Record<string, boolean> = {};
  let score = 0;

  REQUIREMENTS.forEach((requirement) => {
    const passed = requirement.test(value);
    met[requirement.key] = passed;
    if (passed) score += 1;
  });

  // A genuinely long passphrase earns the top segment without needing symbols.
  if (value.length >= 16) score += 1;

  const longEnough = value.length >= MIN_LENGTH;
  // Never flatter a password that cannot even be submitted.
  const effective = longEnough ? Math.min(score, LEVELS.length - 1) : 0;

  return {
    score: effective,
    max: LEVELS.length - 1,
    label: value ? LEVELS[effective].label : '',
    color: LEVELS[effective].color,
    met,
    longEnough,
  };
}
