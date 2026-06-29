import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CreditCard, Lock, Smartphone, Wifi, Zap } from 'lucide-react';
import { BRAND, sanitizeBrandText } from '../../lib/brand';
import PortalShell from './PortalShell';
import HotspotPackagesSection from './HotspotPackagesSection';
import { usePortalTheme, portalClasses } from './PortalThemeContext';
import {
  ExternalLinkButton,
  FaqAccordion,
  HowItWorksSteps,
  PortalBadge,
  PortalFadeIn,
  PortalGlassCard,
} from './PortalUI';

function PortalSection({ title, subtitle, children, delay = 0 }) {
  const { isLight } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <PortalFadeIn delay={delay}>
      <PortalGlassCard>
        <h3 className={`text-base font-semibold ${cx.text}`}>{title}</h3>
        {subtitle && <p className={`mt-1 text-sm ${cx.textMuted}`}>{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </PortalGlassCard>
    </PortalFadeIn>
  );
}

const CONNECT_STEPS = [
  { icon: Wifi, title: 'Choose a package', text: 'Pick hourly, daily, or weekly access.' },
  { icon: Smartphone, title: 'Pay with M-Pesa', text: 'Approve the STK push on your phone.' },
  { icon: Zap, title: 'Get online', text: 'Use your credentials on the hotspot login page.' },
];

function WelcomeBanner({ config, query }) {
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);
  const tagline = config.tagline || 'Welcome — choose a package below to get online.';
  const pppoeEnabled = config.modules?.pppoe_enabled !== false;

  return (
    <PortalFadeIn>
      <div
        className={`relative overflow-hidden rounded-2xl border p-6 sm:p-8 ${
          isLight ? 'border-slate-200 bg-white shadow-sm' : 'border-white/10 bg-white/[0.04]'
        }`}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl"
          style={{ backgroundColor: 'var(--portal-accent-soft)' }}
        />
        <div className="relative">
          <PortalBadge variant="success">You&apos;re connected to {config.name}</PortalBadge>
          <h2 className={`mt-3 text-2xl font-bold leading-tight sm:text-3xl ${cx.text}`}>{tagline}</h2>
          {config.about && (
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${cx.textMuted}`}>{config.about}</p>
          )}
          <div className={`mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs ${cx.textMuted}`}>
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" style={{ color: accent }} />
              M-Pesa payments
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" style={{ color: accent }} />
              Instant activation
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" style={{ color: accent }} />
              Secure checkout
            </span>
          </div>
          {config.website && (
            <div className="mt-4">
              <ExternalLinkButton href={config.website}>Visit our website</ExternalLinkButton>
            </div>
          )}
          {pppoeEnabled && (
            <p className={`mt-4 text-sm ${cx.textMuted}`}>
              Home subscriber?{' '}
              <Link
                to={`/portal/pppoe${query}`}
                className="font-medium hover:underline"
                style={{ color: accent }}
              >
                Check your account →
              </Link>
            </p>
          )}
        </div>
      </div>
    </PortalFadeIn>
  );
}

export default function CaptivePortalPage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#wifi-packages') {
      const timer = setTimeout(() => {
        document.getElementById('wifi-packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  return (
    <PortalShell activeTab="home">
      {({ config, ispId, routerId, query }) => (
        <div className="space-y-10">
          <WelcomeBanner config={config} query={query} />

          <HotspotPackagesSection config={config} ispId={ispId} routerId={routerId} />

          <PortalSection title="How it works" subtitle="Three steps to get browsing." delay={0.08}>
            <HowItWorksSteps steps={CONNECT_STEPS} />
          </PortalSection>

          <PortalSection title="Common questions" delay={0.12}>
            <FaqAccordion
                  items={[
                    {
                      q: 'How do I pay for WiFi?',
                      a: 'Select a package above, enter your M-Pesa number, and approve the STK push. You receive login credentials as soon as payment confirms.',
                    },
                    {
                      q: 'How long does access last?',
                      a: 'Each package shows its duration — for example 1 hour, 24 hours, or 7 days. Access ends automatically when that time is up.',
                    },
                    {
                      q: 'I have a voucher code',
                      a: 'Open the Voucher tab in the menu and enter your code to activate access without paying again.',
                    },
                    {
                      q: 'Who do I contact for help?',
                      a: `Call ${config.support_phone || config.phone || 'support'} or email ${sanitizeBrandText(config.email, BRAND.supportEmail)} if payment succeeds but you still cannot connect.`,
                    },
                  ]}
                />
          </PortalSection>
        </div>
      )}
    </PortalShell>
  );
}
