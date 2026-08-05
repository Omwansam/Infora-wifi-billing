/**
 * Password strength scoring for the signup meter.
 *
 * Deliberately not a real entropy estimator (zxcvbn and friends are ~800 KB).
 * This is a coaching aid: it tells someone which of four habits they are
 * missing, and only the length floor is actually enforced — by the server, in
 * `MIN_PASSWORD_LENGTH`. A meter that blocks submission on a subjective score
 * frustrates people using a password manager, whose output often trips naive
 * character-class rules.
 */

export const MIN_LENGTH = 10;

export const REQUIREMENTS = [
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

/**
 * @returns {{score: number, max: number, label: string, color: string,
 *            met: Record<string, boolean>, longEnough: boolean}}
 */
export function scorePassword(password) {
  const value = password || '';
  const met = {};
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
