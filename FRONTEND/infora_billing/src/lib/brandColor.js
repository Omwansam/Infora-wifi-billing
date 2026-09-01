/**
 * ISP brand colour -> CSS custom properties.
 *
 * Each ISP picks a `theme_color` (Settings > General, default #1BA449). Until
 * now that value only tinted the captive-portal preview; the console itself
 * hard-coded indigo/sky, so a tenant who chose their own colour still saw a blue
 * dashboard.
 *
 * The colour is published as HSL *channel triplets* rather than finished colours
 * so Tailwind arbitrary values can add their own alpha, exactly like the shadcn
 * tokens already in index.css:
 *
 *     hsl(var(--brand))            solid
 *     hsl(var(--brand) / 0.15)     tinted
 *
 * Derived stops keep the original gradient's shape (a deeper start running to a
 * lighter, slightly hue-shifted end) so any brand colour reads as the same
 * design rather than a flat block.
 */

export const DEFAULT_BRAND = '#1BA449';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** #rgb / #rrggbb -> {h, s, l} with s/l as percentages. Null when unparseable. */
export function hexToHsl(hex) {
  if (typeof hex !== 'string') return null;
  let v = hex.trim().replace(/^#/, '');
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(v)) return null;

  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const triplet = ({ h, s, l }) => `${h} ${s}% ${l}%`;

/**
 * WCAG relative luminance (0 = black, 1 = white).
 *
 * HSL lightness is NOT a stand-in for this. Pure yellow is l=50% yet is one of
 * the brightest colours there is — judging by lightness put white text on a
 * pale-yellow brand and made the card unreadable.
 */
export function relativeLuminance(hex) {
  let v = String(hex || '').trim().replace(/^#/, '');
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(v)) return 0;
  const chan = (i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
}

/**
 * Above this luminance the brand is light enough that dark text is required.
 *
 * Deliberately not "whichever contrasts better": by raw WCAG ratio even a
 * mid-tone green prefers black, but white-on-brand is the convention every
 * button in this console already follows, and flipping mid-tones to black text
 * looks broken. So keep white until the colour is genuinely light — pale
 * yellows, pastels — where white would actually be unreadable.
 */
const LIGHT_BRAND_LUMINANCE = 0.45;

/**
 * The full token set for one brand colour.
 *
 * `--brand-contrast` is picked from lightness, not hardcoded to white: a tenant
 * who chooses a pale yellow would otherwise get white text on a near-white
 * button and the card would be unreadable.
 */
export function brandTokens(hex) {
  const valid = hexToHsl(hex) ? hex : DEFAULT_BRAND;
  const base = hexToHsl(valid);
  const lum = relativeLuminance(valid);
  const strong = { h: base.h, s: clamp(base.s + 4, 0, 100), l: clamp(base.l - 8, 8, 92) };
  // The end stop leans a little toward the next hue, which is what gave the
  // original indigo->sky ramp its depth.
  const soft = { h: (base.h + 18) % 360, s: clamp(base.s + 6, 0, 100), l: clamp(base.l + 12, 12, 94) };
  return {
    '--brand': triplet(base),
    '--brand-strong': triplet(strong),
    '--brand-soft': triplet(soft),
    '--brand-contrast': lum > LIGHT_BRAND_LUMINANCE ? '222 47% 11%' : '0 0% 100%',
  };
}

/** Write the tokens onto :root. Safe to call repeatedly. */
export function applyBrandColor(hex) {
  if (typeof document === 'undefined') return;
  const tokens = brandTokens(hex);
  const root = document.documentElement;
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v));
}
