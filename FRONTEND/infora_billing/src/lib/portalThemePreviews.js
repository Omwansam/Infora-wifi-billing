/**
 * Visual metadata for captive portal theme presets.
 * Used by Settings preview cards and the public portal theme resolver.
 */
export const PORTAL_THEME_BACKGROUNDS = {
  clean: { bg: '#f8fafc', text: '#0f172a', isLight: true },
  dark: { bg: '#0f172a', text: '#e2e8f0', isLight: false },
  gradient: { bg: 'linear-gradient(135deg,#4c1d95,#7c3aed)', text: '#ffffff', isLight: false },
  neon: { bg: '#0a0a0f', text: '#fbcfe8', isLight: false },
  ocean: { bg: 'linear-gradient(135deg,#0c4a6e,#0369a1)', text: '#e0f2fe', isLight: false },
  sunset: { bg: 'linear-gradient(135deg,#ea580c,#f59e0b)', text: '#fff7ed', isLight: false },
  forest: { bg: '#ecfdf5', text: '#14532d', isLight: true },
  slate: { bg: '#f1f5f9', text: '#0f172a', isLight: true },
  rose: { bg: '#fff1f2', text: '#881337', isLight: true },
  midnight: { bg: 'linear-gradient(135deg,#0b1220,#1e293b)', text: '#e2e8f0', isLight: false },
};

export function themeBackground(key) {
  return PORTAL_THEME_BACKGROUNDS[key] || PORTAL_THEME_BACKGROUNDS.clean;
}
