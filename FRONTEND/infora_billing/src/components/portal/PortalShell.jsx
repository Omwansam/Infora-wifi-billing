import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Loader2, Mail, Phone, Router, Ticket, Wifi } from 'lucide-react';
import portalService from '../../services/portalService';
import { portalCompanyName, sanitizeBrandText } from '../../lib/brand';
import { resolvePortalTheme } from '../../lib/portalThemes';
import { PortalThemeProvider, portalClasses } from './PortalThemeContext';
import { PortalBackground, PortalFadeIn } from './PortalUI';
import PortalAnnouncements from './PortalAnnouncements';

export function usePortalContext() {
  const [searchParams] = useSearchParams();
  const ispParam = searchParams.get('isp') || searchParams.get('isp_id');
  const routerParam = searchParams.get('router_id');
  const ispId = ispParam ? Number(ispParam) : undefined;
  const routerId = routerParam ? Number(routerParam) : undefined;
  const parts = [];
  if (ispParam) parts.push(`isp_id=${encodeURIComponent(ispParam)}`);
  if (routerParam) parts.push(`router_id=${encodeURIComponent(routerParam)}`);
  const query = parts.length ? `?${parts.join('&')}` : '';
  return { ispId, routerId, query };
}

function buildNavItems(modules) {
  const items = [{ id: 'home', label: 'Buy', short: 'Buy', to: '/portal', icon: Home }];
  if (modules?.hotspot_enabled !== false) {
    items.push(
      { id: 'voucher', label: 'Voucher', short: 'Voucher', to: '/portal/voucher', icon: Ticket },
      { id: 'wifi', label: 'Login', short: 'Login', to: '/portal/access', icon: Wifi },
    );
  }
  if (modules?.pppoe_enabled !== false) {
    items.push({ id: 'pppoe', label: 'Account', short: 'Account', to: '/portal/pppoe', icon: Router });
  }
  return items;
}

export default function PortalShell({ children, activeTab = 'home' }) {
  const { ispId, routerId, query } = usePortalContext();
  const location = useLocation();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await portalService.getConfig(ispId, routerId);
      if (cancelled) return;
      if (result.success) {
        setConfig(result.data);
        setError('');
      } else {
        setError(result.error || 'Portal unavailable');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ispId, routerId]);

  const themeKey = config?.portal_theme || config?.default_theme || 'clean';
  const theme = resolvePortalTheme(themeKey);
  const isLight = theme.mode === 'light';
  const accent = config?.theme_color || '#1BA449';
  const cx = portalClasses(isLight);
  const navItems = useMemo(() => buildNavItems(config?.modules), [config?.modules]);

  const companyName = portalCompanyName(config);
  const displayName = config?.hotspot_name || companyName;
  const portalTagline = sanitizeBrandText(config?.tagline, '');
  const supportEmail = sanitizeBrandText(config?.support_email || config?.email, '');

  const themeValue = useMemo(() => ({ isLight, accent, theme: themeKey }), [isLight, accent, themeKey]);

  const activeNavClass = isLight
    ? 'bg-emerald-600 text-white shadow-sm'
    : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20';

  return (
    <PortalThemeProvider value={themeValue}>
      <div
        className={`relative min-h-screen overflow-x-hidden ${theme.pageBg}`}
        style={{ '--portal-accent': accent }}
      >
        {!isLight && <PortalBackground />}

        {/* Header */}
        <header className={`sticky top-0 z-40 border-b backdrop-blur-xl ${theme.headerBg}`}>
          <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <Link to={`/portal${query}`} className="flex min-w-0 items-center gap-3">
                {config?.logo_url ? (
                  <img
                    src={config.logo_url}
                    alt={displayName}
                    className={`h-11 w-11 rounded-xl object-contain ${isLight ? 'ring-1 ring-slate-200' : 'ring-1 ring-white/15'}`}
                  />
                ) : (
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white"
                    style={{ backgroundColor: accent }}
                  >
                    {(displayName || 'W')[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className={`truncate text-lg font-bold sm:text-xl ${cx.text}`}>{displayName}</h1>
                  {portalTagline && (
                    <p className={`truncate text-xs ${cx.textMuted}`}>{portalTagline}</p>
                  )}
                </div>
              </Link>

              {(config?.support_phone || config?.phone) && (
                <a
                  href={`tel:${config.support_phone || config.phone}`}
                  className={`hidden shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium sm:inline-flex ${
                    isLight
                      ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      : 'border-white/10 bg-white/5 text-white/75 hover:bg-white/10'
                  }`}
                >
                  <Phone className="h-3.5 w-3.5" style={{ color: accent }} />
                  Help
                </a>
              )}
            </div>

            {/* Tab navigation — Reatech-style pills */}
            {!loading && !error && config && (
              <nav className={`mt-4 inline-flex flex-wrap gap-1 rounded-xl p-1 ${isLight ? 'bg-slate-100' : 'bg-black/25 border border-white/10'}`}>
                {navItems.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <Link
                      key={tab.id}
                      to={`${tab.to}${query}`}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                        active ? activeNavClass : cx.navInactive
                      }`}
                      style={active && isLight ? { backgroundColor: accent } : undefined}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
        </header>

        <main className="relative z-10 mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6 sm:pb-10">
          {loading && (
            <div className={`flex flex-col items-center justify-center py-24 ${cx.textMuted}`}>
              <Loader2 className="mb-3 h-8 w-8 animate-spin" style={{ color: accent }} />
              <p className="text-sm">Loading portal…</p>
            </div>
          )}

          {!loading && error && (
            <PortalFadeIn>
              <div className={`mx-auto max-w-lg rounded-2xl border p-8 text-center ${isLight ? 'border-red-200 bg-red-50 text-red-800' : 'border-red-400/25 bg-red-500/10 text-red-100'}`}>
                <p className="text-lg font-semibold">Portal unavailable</p>
                <p className="mt-2 text-sm opacity-80">{error}</p>
              </div>
            </PortalFadeIn>
          )}

          {!loading && !error && config && (
            <>
              <PortalAnnouncements announcements={config.announcements} />
              {children({
                config: { ...config, tagline: portalTagline, company_name: companyName },
                ispId,
                routerId,
                query,
              })}
            </>
          )}
        </main>

        {/* Mobile bottom nav */}
        {!loading && !error && config && (
          <nav className={`fixed bottom-0 left-0 right-0 z-50 border-t md:hidden ${isLight ? 'border-slate-200 bg-white/95' : 'border-white/10 bg-slate-950/95'} backdrop-blur-xl`}>
            <div className="mx-auto flex max-w-lg justify-around px-1 py-1.5">
              {navItems.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id || location.pathname === tab.to;
                return (
                  <Link
                    key={tab.id}
                    to={`${tab.to}${query}`}
                    className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-medium ${
                      active ? '' : cx.textSubtle
                    }`}
                    style={active ? { color: accent } : undefined}
                  >
                    <Icon className="h-5 w-5" />
                    {tab.short}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}

        {/* Footer */}
        {!loading && !error && config && (
          <footer className={`border-t ${cx.footer}`}>
            <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className={`font-semibold ${cx.text}`}>{displayName}</p>
                  <p className={`mt-1 text-sm ${cx.textMuted}`}>Secure payments via M-Pesa</p>
                </div>
                <div className="space-y-2 text-sm">
                  {(config.support_phone || config.phone) && (
                    <a href={`tel:${config.support_phone || config.phone}`} className={`flex items-center gap-2 ${cx.textMuted} hover:opacity-80`}>
                      <Phone className="h-4 w-4" style={{ color: accent }} />
                      {config.support_phone || config.phone}
                    </a>
                  )}
                  {supportEmail && (
                    <a href={`mailto:${supportEmail}`} className={`flex items-center gap-2 ${cx.textMuted} hover:opacity-80`}>
                      <Mail className="h-4 w-4" style={{ color: accent }} />
                      {supportEmail}
                    </a>
                  )}
                </div>
              </div>
              <p className={`mt-6 border-t pt-4 text-center text-xs ${cx.textSubtle} ${isLight ? 'border-slate-100' : 'border-white/8'}`}>
                © {new Date().getFullYear()} {displayName}
              </p>
            </div>
          </footer>
        )}
      </div>
    </PortalThemeProvider>
  );
}
