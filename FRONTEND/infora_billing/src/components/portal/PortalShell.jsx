import React, { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Home, Loader2, Mail, Phone, Router } from 'lucide-react';
import portalService from '../../services/portalService';
import { BRAND, portalCompanyName, sanitizeBrandText } from '../../lib/brand';
import LumenLogo from '../brand/LumenLogo';
import { PortalBackground, PortalFadeIn } from './PortalUI';

export function usePortalContext() {
  const [searchParams] = useSearchParams();
  const ispParam = searchParams.get('isp') || searchParams.get('isp_id');
  const ispId = ispParam ? Number(ispParam) : undefined;
  const query = ispParam ? `?isp=${ispParam}` : '';
  return { ispId, query };
}

const NAV_ITEMS = [
  { id: 'home', label: 'Home', short: 'Home', to: '/portal', icon: Home },
  { id: 'pppoe', label: 'My Account', short: 'Account', to: '/portal/pppoe', icon: Router },
];

export default function PortalShell({ children, activeTab = 'home' }) {
  const { ispId, query } = usePortalContext();
  const location = useLocation();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await portalService.getConfig(ispId);
      if (cancelled) return;
      if (result.success) {
        setConfig(result.data);
        setError('');
      } else {
        setError(result.error || 'Portal unavailable');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ispId]);

  const companyName = portalCompanyName(config);
  const portalTagline = sanitizeBrandText(config?.tagline, BRAND.portalTagline);
  const portalAbout = sanitizeBrandText(config?.about, BRAND.portalAbout);
  const supportEmail = sanitizeBrandText(config?.support_email || config?.email, BRAND.supportEmail);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-white">
      <PortalBackground />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to={`/portal${query}`} className="flex min-w-0 items-center gap-3">
            {config?.logo_url ? (
              <img
                src={config.logo_url}
                alt={companyName}
                className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/15"
              />
            ) : (
              <LumenLogo size="sm" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
                {BRAND.name} · Captive Portal
              </p>
              <h1 className="truncate text-lg font-bold text-white sm:text-xl">{companyName}</h1>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-2xl border border-white/10 bg-black/25 p-1 md:flex">
            {NAV_ITEMS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <Link
                  key={tab.id}
                  to={`${tab.to}${query}`}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'text-white/65 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {(config?.support_phone || config?.phone) && (
              <a
                href={`tel:${config.support_phone || config.phone}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
              >
                <Phone className="h-3.5 w-3.5 text-emerald-300" />
                Call support
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 sm:pb-12 sm:pt-10">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 text-emerald-200">
            <Loader2 className="mb-3 h-8 w-8 animate-spin" />
            <p className="text-sm text-white/50">Preparing your connection portal…</p>
          </div>
        )}

        {!loading && error && (
          <PortalFadeIn>
            <div className="mx-auto max-w-lg rounded-[1.75rem] border border-red-400/25 bg-red-500/10 p-8 text-center">
              <p className="text-lg font-semibold text-red-100">Portal unavailable</p>
              <p className="mt-2 text-sm text-red-100/75">{error}</p>
            </div>
          </PortalFadeIn>
        )}

        {!loading && !error && config && (
          <>
            {children({ config: { ...config, tagline: portalTagline, about: portalAbout, company_name: companyName }, ispId, query })}
            <PortalFadeIn delay={0.2}>
              <footer className="mt-16 rounded-[1.75rem] border border-white/8 bg-black/25 p-8 backdrop-blur-sm">
                <div className="grid gap-8 md:grid-cols-3">
                  <div>
                    <p className="font-semibold text-white">{companyName}</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/55">{portalTagline}</p>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Support</p>
                    <div className="space-y-2 text-sm text-white/70">
                      {(config.support_phone || config.phone) && (
                        <a href={`tel:${config.support_phone || config.phone}`} className="flex items-center gap-2 hover:text-white">
                          <Phone className="h-4 w-4 text-emerald-400" />
                          {config.support_phone || config.phone}
                        </a>
                      )}
                      {supportEmail && (
                        <a href={`mailto:${supportEmail}`} className="flex items-center gap-2 hover:text-white">
                          <Mail className="h-4 w-4 text-amber-400" />
                          {supportEmail}
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Quick links</p>
                    <div className="flex flex-col gap-2 text-sm">
                      {NAV_ITEMS.filter((n) => n.id !== 'home').map((tab) => (
                        <Link
                          key={tab.id}
                          to={`${tab.to}${query}`}
                          className="text-white/65 hover:text-emerald-200"
                        >
                          {tab.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-8 border-t border-white/8 pt-6 text-center text-xs text-white/35">
                  Secure payments via M-Pesa · {BRAND.fullName} © {new Date().getFullYear()}
                </p>
              </footer>
            </PortalFadeIn>
          </>
        )}
      </main>

      {!loading && !error && config && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-slate-950/90 backdrop-blur-xl md:hidden">
          <div className="mx-auto flex max-w-lg justify-around px-2 py-2">
            {NAV_ITEMS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id || location.pathname === tab.to;
              return (
                <Link
                  key={tab.id}
                  to={`${tab.to}${query}`}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium ${
                    active ? 'text-emerald-300' : 'text-white/45'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${active ? 'text-emerald-400' : ''}`} />
                  {tab.short}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
