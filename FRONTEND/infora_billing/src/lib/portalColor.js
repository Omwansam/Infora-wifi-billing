/**
 * Color utilities for the captive portal.
 *
 * The portal exposes a single `theme_color` (a hex chosen by the ISP admin in
 * Settings → General). Every accent on the portal — buttons, badges, focus
 * rings, "popular" cards, status banners — should track that color. To make
 * this trivial, we derive a small set of CSS custom properties from the hex
 * and set them on the portal root. Children can then reference them via
 * Tailwind arbitrary values (e.g. `bg-[var(--portal-accent)]`).
 */

const FALLBACK = '#1BA449';

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

export function hexToRgb(hex) {
  let value = String(hex || '').trim().replace(/^#/, '');
  if (value.length === 3) {
    value = value.split('').map((c) => c + c).join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return hexToRgb(FALLBACK);
  }
  const num = parseInt(value, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mixWith(hex, mixHex, ratio) {
  const a = hexToRgb(hex);
  const b = hexToRgb(mixHex);
  const r = clampByte(a.r * (1 - ratio) + b.r * ratio);
  const g = clampByte(a.g * (1 - ratio) + b.g * ratio);
  const bl = clampByte(a.b * (1 - ratio) + b.b * ratio);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function lighten(hex, ratio = 0.15) {
  return mixWith(hex, '#ffffff', ratio);
}

export function darken(hex, ratio = 0.15) {
  return mixWith(hex, '#000000', ratio);
}

/** Returns true if the supplied hex is bright enough that white text becomes hard to read. */
export function isHexLight(hex) {
  const { r, g, b } = hexToRgb(hex);
  // Relative luminance (sRGB approximation).
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma > 0.6;
}

/** Text color to use on top of the accent — picks white or near-black for contrast. */
export function accentForeground(hex) {
  return isHexLight(hex) ? '#0f172a' : '#ffffff';
}

/**
 * Build the CSS variable map for a portal accent color.
 *
 * Drop the result into the portal root's `style` attribute so every descendant
 * can use the variables (Tailwind arbitrary values, raw CSS, or inline styles).
 */
export function buildAccentCssVars(hex) {
  const accent = hex || FALLBACK;
  return {
    '--portal-accent': accent,
    '--portal-accent-fg': accentForeground(accent),
    '--portal-accent-hover': darken(accent, 0.08),
    '--portal-accent-strong': darken(accent, 0.15),
    '--portal-accent-soft': rgba(accent, 0.12),
    '--portal-accent-softer': rgba(accent, 0.06),
    '--portal-accent-tint': rgba(accent, 0.2),
    '--portal-accent-ring': rgba(accent, 0.3),
    '--portal-accent-glow': rgba(accent, 0.25),
  };
}
