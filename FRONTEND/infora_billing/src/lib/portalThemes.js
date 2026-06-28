/** Captive portal theme presets (matches Settings > Captive Portal gallery). */
export const PORTAL_THEMES = {
  clean: {
    mode: 'light',
    pageBg: 'bg-slate-50 text-slate-900',
    headerBg: 'bg-white/90 border-slate-200 text-slate-900',
    card: 'border-slate-200 bg-white shadow-sm',
    muted: 'text-slate-500',
    accent: 'emerald',
  },
  dark: {
    mode: 'dark',
    pageBg: 'bg-slate-950 text-white',
    headerBg: 'bg-slate-950/70 border-white/10 text-white',
    card: 'border-white/10 bg-white/[0.04]',
    muted: 'text-white/60',
    accent: 'emerald',
  },
  gradient: { mode: 'dark', pageBg: 'bg-gradient-to-br from-violet-950 via-purple-900 to-slate-950 text-white', headerBg: 'bg-black/30 border-white/10', card: 'border-white/15 bg-white/10', muted: 'text-white/70', accent: 'fuchsia' },
  neon: { mode: 'dark', pageBg: 'bg-[#0a0a0f] text-white', headerBg: 'bg-black/50 border-pink-500/20', card: 'border-pink-500/20 bg-pink-500/5', muted: 'text-pink-100/60', accent: 'pink' },
  ocean: { mode: 'dark', pageBg: 'bg-gradient-to-br from-sky-950 to-cyan-950 text-white', headerBg: 'bg-sky-950/80 border-cyan-500/20', card: 'border-cyan-500/20 bg-cyan-500/5', muted: 'text-cyan-100/70', accent: 'cyan' },
  sunset: { mode: 'dark', pageBg: 'bg-gradient-to-br from-orange-950 to-amber-900 text-white', headerBg: 'bg-orange-950/70 border-orange-400/20', card: 'border-orange-400/20 bg-orange-500/10', muted: 'text-orange-100/70', accent: 'orange' },
  forest: { mode: 'light', pageBg: 'bg-emerald-50 text-emerald-950', headerBg: 'bg-white/90 border-emerald-200', card: 'border-emerald-200 bg-white', muted: 'text-emerald-700/70', accent: 'emerald' },
  slate: { mode: 'light', pageBg: 'bg-slate-100 text-slate-900', headerBg: 'bg-white border-slate-200', card: 'border-slate-200 bg-white', muted: 'text-slate-500', accent: 'slate' },
  rose: { mode: 'light', pageBg: 'bg-rose-50 text-rose-950', headerBg: 'bg-white/90 border-rose-200', card: 'border-rose-200 bg-white', muted: 'text-rose-600/70', accent: 'rose' },
  midnight: { mode: 'dark', pageBg: 'bg-gradient-to-br from-slate-950 to-indigo-950 text-white', headerBg: 'bg-slate-950/80 border-indigo-500/20', card: 'border-indigo-400/20 bg-indigo-500/5', muted: 'text-indigo-100/60', accent: 'indigo' },
};

export function resolvePortalTheme(key) {
  return PORTAL_THEMES[key] || PORTAL_THEMES.clean;
}
