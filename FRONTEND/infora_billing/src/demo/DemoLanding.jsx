import { Link } from 'react-router-dom';
import {
  Wifi,
  Zap,
  ArrowRight,
  PhoneCall,
  Router,
  ShieldCheck,
  Clock,
  Check,
  Gauge,
  Headphones,
  Signal,
  MapPin,
  Mail,
} from 'lucide-react';
import { MARKETING_URL } from './config';
import { LumenMark } from '../components/brand/LumenLogo';

/**
 * Public landing page for the demo subdomain — styled like the customer-facing
 * website of the fictional ISP that "runs" this sandbox. Visitors arrive here,
 * then sign in to the admin portal with the pre-filled demo account.
 *
 * Uses the Lumen brand palette (amber → orange → violet, with cyan accents)
 * so it reads as part of the same product as the rest of the app.
 */
const ISP_NAME = 'Lumen Demo ISP';

const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'Plans', href: '#plans' },
  { label: 'Why Us', href: '#why' },
  { label: 'Contact', href: '#contact' },
];

const STATS = [
  { value: '99.9%', label: 'Network uptime' },
  { value: '12k+', label: 'Homes connected' },
  { value: '24/7', label: 'Local support' },
];

/** Sample monthly plans — mirrors the demo's seeded PPPoE packages. */
const PLANS = [
  {
    name: 'Home Basic',
    price: '1,500',
    speed: '5 Mbps',
    blurb: 'Perfect for browsing, email and light streaming.',
    features: ['Unlimited data', 'Free installation', 'WhatsApp support'],
  },
  {
    name: 'Home Plus',
    price: '2,500',
    speed: '10 Mbps',
    blurb: 'Our most popular plan for busy households.',
    features: ['Unlimited data', 'HD streaming', 'Priority support'],
    popular: true,
  },
  {
    name: 'Family Stream',
    price: '3,500',
    speed: '20 Mbps',
    blurb: 'Multiple devices, 4K streaming and gaming.',
    features: ['Unlimited data', '4K streaming', 'Free router'],
  },
  {
    name: 'Business Pro',
    price: '6,500',
    speed: '40 Mbps',
    blurb: 'Dedicated bandwidth for teams and offices.',
    features: ['Dedicated line', 'Static IP', 'SLA guarantee'],
  },
];

const WHY_US = [
  { icon: Clock, title: '99.9% Uptime', text: 'An always-on network you can rely on, day and night.' },
  { icon: Router, title: 'Modern Network', text: 'Carrier-grade MikroTik infrastructure across every zone.' },
  { icon: ShieldCheck, title: 'Secure & Fair', text: 'Transparent billing with no hidden fees, ever.' },
  { icon: Gauge, title: 'Real Speeds', text: 'Consistent bandwidth — the speed you pay for, delivered.' },
  { icon: Headphones, title: 'Local Support', text: 'A friendly team on WhatsApp and phone whenever you need us.' },
  { icon: Signal, title: 'Wide Coverage', text: 'Growing hotspot and fibre footprint across the region.' },
];

const GRADIENT = 'bg-gradient-to-r from-amber-500 via-orange-500 to-violet-600';
const GRADIENT_TEXT =
  'bg-gradient-to-r from-amber-600 via-orange-500 to-violet-600 bg-clip-text text-transparent';

export default function DemoLanding() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="flex items-center gap-3">
            <LumenMark size="sm" />
            <span className="text-lg font-bold tracking-tight">{ISP_NAME}</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-slate-600 transition hover:text-violet-600"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <Link
            to="/login"
            className={`rounded-lg ${GRADIENT} px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 transition hover:opacity-90`}
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-amber-300/30 blur-3xl" />
          <div className="absolute top-1/3 -right-24 h-80 w-80 rounded-full bg-violet-400/25 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-700">
            <span className="h-2 w-2 rounded-full bg-violet-500" />
            Internet Service Provider
          </span>
          <h1 className="mt-6 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Fast, reliable <span className={GRADIENT_TEXT}>internet</span> you can count on
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600">
            {ISP_NAME} delivers seamless connectivity to keep you online.
            Manage your account, view your plans, and stay connected.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className={`inline-flex items-center gap-2 rounded-lg ${GRADIENT} px-6 py-3.5 text-sm font-semibold text-white shadow-sm shadow-orange-500/25 transition hover:opacity-90`}
            >
              Access Your Account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#plans"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-slate-50"
            >
              View Plans
            </a>
          </div>

          {/* Trust stats */}
          <dl className="mt-16 grid max-w-2xl grid-cols-3 gap-6">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className={`text-3xl font-extrabold sm:text-4xl ${GRADIENT_TEXT}`}>
                  {stat.value}
                </dt>
                <dd className="mt-1 text-sm text-slate-500">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-24 border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Our Services</h2>
            <p className="mt-3 text-slate-600">
              Choose the connectivity solution that works best for you
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
            <div className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-violet-200 hover:shadow-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Zap className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">PPPoE Broadband</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Dedicated home and business connections with consistent speeds,
                monthly plans, and automatic renewals — reliable bandwidth for
                streaming, work, and gaming.
              </p>
              <Link
                to="/portal/pppoe"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 transition group-hover:gap-2.5 hover:text-violet-700"
              >
                Manage your line
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="group rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition hover:border-violet-200 hover:shadow-md">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
                <Wifi className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">WiFi Hotspot</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Affordable pay-as-you-go packages at our hotspot zones. Buy a
                voucher with M-Pesa and get online in seconds — hourly, daily,
                or weekly bundles.
              </p>
              <Link
                to="/portal"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 transition group-hover:gap-2.5 hover:text-violet-700"
              >
                Buy a voucher
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section id="plans" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Home &amp; business plans</h2>
            <p className="mt-3 text-slate-600">
              Unlimited monthly internet — no contracts, cancel anytime.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md ${
                  plan.popular
                    ? 'border-violet-300 ring-1 ring-violet-200'
                    : 'border-slate-200 hover:border-violet-200'
                }`}
              >
                {plan.popular && (
                  <span className={`absolute -top-3 left-6 rounded-full ${GRADIENT} px-3 py-1 text-xs font-semibold text-white shadow-sm`}>
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.blurb}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-sm font-medium text-slate-500">KES</span>
                  <span className="text-4xl font-extrabold tracking-tight">{plan.price}</span>
                  <span className="text-sm text-slate-500">/mo</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-violet-600">{plan.speed}</p>
                <ul className="mt-5 space-y-2.5 border-t border-slate-100 pt-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/login"
                  className={`mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    plan.popular
                      ? `${GRADIENT} text-white shadow-sm shadow-orange-500/25 hover:opacity-90`
                      : 'border border-slate-200 text-slate-700 hover:border-violet-300 hover:bg-slate-50'
                  }`}
                >
                  Get connected
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            Need something occasional?{' '}
            <Link to="/portal" className="font-semibold text-violet-600 hover:text-violet-700">
              Grab a pay-as-you-go WiFi voucher →
            </Link>
          </p>
        </div>
      </section>

      {/* Why us */}
      <section id="why" className="scroll-mt-24 border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Why choose {ISP_NAME}</h2>
            <p className="mt-3 text-slate-600">
              Built for reliability, priced with no surprises.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_US.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-violet-200 hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className={`relative overflow-hidden rounded-3xl ${GRADIENT} px-8 py-14 text-center shadow-lg shadow-orange-500/20`}>
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute -top-10 right-10 h-40 w-40 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-0 left-10 h-40 w-40 rounded-full bg-white blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to get connected?</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/90">
              Sign in to manage your account, pay with M-Pesa, and stay online.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
              >
                Access Your Account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <PhoneCall className="h-4 w-4" />
                Talk to us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer / contact */}
      <footer id="contact" className="scroll-mt-24 border-t border-slate-100 bg-slate-50/60">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-3">
                <LumenMark size="sm" />
                <span className="font-bold tracking-tight">{ISP_NAME}</span>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
                Seamless home and business connectivity, billed simply and
                backed by friendly local support.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Get in touch</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-violet-500" />
                  support@demo.lumen.app
                </li>
                <li className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-violet-500" />
                  0700 000 000
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-violet-500" />
                  Nairobi, Kenya
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Quick links</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <li>
                  <Link to="/login" className="text-slate-600 transition hover:text-violet-600">
                    Sign in
                  </Link>
                </li>
                <li>
                  <a href="#plans" className="text-slate-600 transition hover:text-violet-600">
                    Plans &amp; pricing
                  </a>
                </li>
                <li>
                  <Link to="/portal" className="text-slate-600 transition hover:text-violet-600">
                    Buy a WiFi voucher
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 border-t border-slate-200 pt-8 text-center">
            <p className="text-xs text-slate-500">
              This is a sandbox — a fictional ISP showcasing the Lumen billing platform.{' '}
              <a href={MARKETING_URL} className="font-semibold text-violet-600 hover:text-violet-700">
                Get Lumen for your ISP →
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
