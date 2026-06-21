import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  Globe,
  Headphones,
  Router,
  Shield,
  Smartphone,
  Wifi,
  Zap,
} from 'lucide-react';
import { BRAND, sanitizeBrandText } from '../../lib/brand';
import PortalShell from './PortalShell';
import HotspotPackagesSection from './HotspotPackagesSection';
import {
  ExternalLinkButton,
  FaqAccordion,
  HowItWorksSteps,
  PortalBadge,
  PortalFadeIn,
  PortalGlassCard,
  PortalSectionHeader,
  PortalStatStrip,
} from './PortalUI';

const HOTSPOT_STEPS = [
  { icon: Wifi, title: 'Pick a package', text: 'Choose hourly, daily, or weekly WiFi access below.' },
  { icon: Smartphone, title: 'Pay with M-Pesa', text: 'Enter your number — we send an STK push. Confirm with your PIN.' },
  { icon: Zap, title: 'Browse instantly', text: 'Get your login details and connect to the hotspot right away.' },
];

const PPPOE_STEPS = [
  { icon: Router, title: 'Enter your account', text: 'Look up your PPPoE username, email, or registered phone number.' },
  { icon: Shield, title: 'See your status', text: 'We show whether your package is active or if internet has been switched off.' },
  { icon: Smartphone, title: 'Renew online', text: 'Pay your monthly package with M-Pesa and your connection comes back on.' },
];

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

  const scrollToPackages = () => {
    document.getElementById('wifi-packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <PortalShell activeTab="home">
      {({ config, ispId, query }) => (
        <div className="space-y-12 lg:space-y-16">
          <PortalFadeIn>
            <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-500/15 via-teal-500/5 to-transparent p-8 sm:p-10 lg:p-12">
              <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="relative grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
                <div>
                  <PortalBadge variant="success">Connected to {config.name}</PortalBadge>
                  <h2 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.25rem]">
                    {config.tagline}
                  </h2>
                  <p className="mt-5 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
                    {config.about}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={scrollToPackages}
                      className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3.5 text-sm font-semibold text-white shadow-xl shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-teal-400"
                    >
                      View WiFi packages
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <Link
                      to={`/portal/pppoe${query}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Check my account
                    </Link>
                  </div>
                  {config.website && (
                    <div className="mt-4">
                      <ExternalLinkButton href={config.website}>Visit our website</ExternalLinkButton>
                    </div>
                  )}
                </div>

                <PortalGlassCard glow className="relative">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">Why choose us</p>
                  <ul className="mt-5 space-y-4">
                    {[
                      { icon: Zap, title: 'Instant activation', text: 'Hotspot access in under a minute after payment.' },
                      { icon: Shield, title: 'Secure M-Pesa billing', text: 'Official STK push — no sharing card details.' },
                      { icon: Globe, title: 'Reliable coverage', text: 'Built for homes, cafés, estates, and offices.' },
                      { icon: Headphones, title: 'Local support', text: 'Reach our team when you need help getting online.' },
                    ].map(({ icon: Icon, title, text }) => (
                      <li key={title} className="flex gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-400/20">
                          <Icon className="h-4 w-4 text-emerald-300" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{title}</p>
                          <p className="text-sm text-white/50">{text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </PortalGlassCard>
              </div>
            </section>
          </PortalFadeIn>

          <PortalFadeIn delay={0.05}>
            <PortalStatStrip
              items={[
                { value: 'KES 10', label: 'From per hour' },
                { value: 'M-Pesa', label: 'Instant payments' },
                { value: '< 1 min', label: 'Hotspot activation' },
                { value: 'KES 50', label: 'Full day (Siku)' },
              ]}
            />
          </PortalFadeIn>

          <PortalFadeIn delay={0.08}>
            <HotspotPackagesSection config={config} ispId={ispId} />
          </PortalFadeIn>

          <PortalFadeIn delay={0.12}>
            <Link
              to={`/portal/pppoe${query}`}
              className="group block overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.07]"
            >
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                    <Router className="h-7 w-7 text-white/80" />
                  </div>
                  <div>
                    <PortalBadge>Home & business subscribers</PortalBadge>
                    <h3 className="mt-2 text-xl font-bold text-white sm:text-2xl">Already have a PPPoE account?</h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">{config.pppoe_welcome}</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-white/80 transition group-hover:gap-3">
                  Manage my account <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          </PortalFadeIn>

          <PortalFadeIn delay={0.15}>
            <PortalGlassCard>
              <PortalSectionHeader
                eyebrow="How it works"
                title="Get online in three simple steps"
                subtitle="Whether you are a guest on WiFi or a monthly subscriber, paying and connecting is straightforward."
              />
              <div className="grid gap-10 lg:grid-cols-2">
                <div>
                  <p className="mb-4 text-sm font-semibold text-emerald-200">For hotspot guests</p>
                  <HowItWorksSteps steps={HOTSPOT_STEPS} />
                </div>
                <div>
                  <p className="mb-4 text-sm font-semibold text-white/70">For PPPoE customers</p>
                  <HowItWorksSteps steps={PPPOE_STEPS} />
                </div>
              </div>
            </PortalGlassCard>
          </PortalFadeIn>

          <PortalFadeIn delay={0.2}>
            <PortalGlassCard>
              <PortalSectionHeader
                eyebrow="FAQ"
                title="Common questions"
                subtitle="Quick answers before you pay or renew your package."
              />
              <FaqAccordion
                items={[
                  {
                    q: 'How do I pay for WiFi?',
                    a: 'Scroll to the packages section, pick a bundle, enter your M-Pesa number, and approve the STK push on your phone. Once paid, you receive login credentials immediately.',
                  },
                  {
                    q: 'Why is my home internet not working?',
                    a: 'If your monthly PPPoE package has expired or is unpaid, your connection is paused. Open My Account, look up your details, and renew with M-Pesa.',
                  },
                  {
                    q: 'How long does hotspot access last?',
                    a: 'Each package shows its duration — for example 1 hour, 24 hours, or 7 days. Access ends automatically when that time is up.',
                  },
                  {
                    q: 'Who do I contact for help?',
                    a: `Call ${config.support_phone || config.phone || 'our support line'} or email ${sanitizeBrandText(config.email, BRAND.supportEmail)} if payment succeeds but you still cannot connect.`,
                  },
                ]}
              />
            </PortalGlassCard>
          </PortalFadeIn>
        </div>
      )}
    </PortalShell>
  );
}
