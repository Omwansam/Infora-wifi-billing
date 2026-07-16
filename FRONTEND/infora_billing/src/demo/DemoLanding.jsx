import { Link } from 'react-router-dom';
import { Wifi, Zap, ArrowRight, PhoneCall, Router, ShieldCheck, Clock } from 'lucide-react';
import { MARKETING_URL } from './config';

/**
 * Public landing page for the demo subdomain — styled like the customer-facing
 * website of the fictional ISP that "runs" this sandbox. Visitors arrive here,
 * then sign in to the admin portal with the pre-filled demo account.
 */
const ISP_NAME = 'Lumen Demo ISP';

export default function DemoLanding() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
            <Wifi className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold">{ISP_NAME}</span>
        </div>
        <Link
          to="/login"
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute top-1/2 -right-24 h-80 w-80 rounded-full bg-emerald-100/50 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Internet Service Provider
          </span>
          <h1 className="mt-6 max-w-3xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Fast, reliable <span className="text-emerald-500">internet</span> you can count on
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600">
            {ISP_NAME} delivers seamless connectivity to keep you online.
            Manage your account, view your plans, and stay connected.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Access Your Account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#contact"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <PhoneCall className="h-4 w-4" />
              Contact Us
            </a>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="border-t border-slate-100 bg-slate-50/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Our Services</h2>
            <p className="mt-3 text-slate-600">
              Choose the connectivity solution that works best for you
            </p>
          </div>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Zap className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">PPPoE Broadband</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Dedicated home and business connections with consistent speeds,
                monthly plans, and automatic renewals — reliable bandwidth for
                streaming, work, and gaming.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wifi className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">WiFi Hotspot</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Affordable pay-as-you-go packages at our hotspot zones. Buy a
                voucher with M-Pesa and get online in seconds — hourly, daily,
                or weekly bundles.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 text-center sm:grid-cols-3">
          <div>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Clock className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-semibold">99.9% Uptime</h3>
            <p className="mt-1 text-sm text-slate-600">Always-on network you can rely on</p>
          </div>
          <div>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Router className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-semibold">Modern Network</h3>
            <p className="mt-1 text-sm text-slate-600">Carrier-grade MikroTik infrastructure</p>
          </div>
          <div>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-semibold">Secure & Fair</h3>
            <p className="mt-1 text-sm text-slate-600">Transparent billing, no hidden fees</p>
          </div>
        </div>
      </section>

      {/* Footer / contact */}
      <footer id="contact" className="border-t border-slate-100 bg-slate-50/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">
            {ISP_NAME} · support@demo.lumen.app · 0700 000 000
          </p>
          <p className="text-xs text-slate-500">
            This is a sandbox — a fictional ISP showcasing the Lumen billing platform.{' '}
            <a href={MARKETING_URL} className="font-medium text-emerald-600 hover:text-emerald-700">
              Get Lumen for your ISP →
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
