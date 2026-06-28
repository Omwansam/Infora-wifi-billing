import React, { createContext, useContext } from 'react';

const PortalThemeContext = createContext({
  isLight: true,
  accent: '#1BA449',
  theme: {},
});

export function PortalThemeProvider({ value, children }) {
  return <PortalThemeContext.Provider value={value}>{children}</PortalThemeContext.Provider>;
}

export function usePortalTheme() {
  return useContext(PortalThemeContext);
}

/** Shared class helpers for light vs dark portal surfaces */
export function portalClasses(isLight) {
  return {
    text: isLight ? 'text-slate-900' : 'text-white',
    textMuted: isLight ? 'text-slate-500' : 'text-white/60',
    textSubtle: isLight ? 'text-slate-400' : 'text-white/45',
    card: isLight
      ? 'rounded-2xl border border-slate-200 bg-white shadow-sm'
      : 'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl',
    cardHover: isLight
      ? 'hover:border-emerald-300 hover:shadow-md'
      : 'hover:border-emerald-400/30 hover:bg-white/[0.06]',
    input: isLight
      ? 'rounded-xl border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
      : 'rounded-xl border border-white/15 bg-black/30 text-white placeholder:text-white/30 focus:border-emerald-400/50',
    navInactive: isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-white/65 hover:bg-white/5',
    footer: isLight ? 'border-slate-200 bg-white' : 'border-white/8 bg-black/25 backdrop-blur-sm',
  };
}
