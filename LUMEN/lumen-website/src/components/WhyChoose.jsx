import { Link } from 'react-router-dom';
import { BRAND } from '../lib/brand';
import DashboardMockup from './DashboardMockup';

export default function WhyChoose() {
  return (
    <section className="overflow-hidden bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">
              Make the Switch
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Why Choose Lumen Billing?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-400">
              Transform your ISP business with a billing system that grows with you. Our transparent
              pay-as-you-grow model combined with enterprise-grade features makes Lumen the smart
              choice for Internet Providers of all sizes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/signup"
                className="rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-violet-600 px-8 py-3.5 text-center text-sm font-semibold text-white shadow-xl shadow-orange-500/30 transition hover:shadow-orange-500/50"
              >
                Get Started — Free
              </Link>
              <a
                href={BRAND.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-slate-600 px-8 py-3.5 text-center text-sm font-semibold text-white transition hover:border-slate-400"
              >
                View Live Demo
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-amber-500/20 to-violet-500/20 blur-2xl" />
            <DashboardMockup className="relative scale-95 opacity-95 lg:scale-100" />
          </div>
        </div>
      </div>
    </section>
  );
}
