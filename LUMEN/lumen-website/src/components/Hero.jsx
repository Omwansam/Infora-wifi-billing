import { Link } from 'react-router-dom';
import { useBrand } from '../contexts/WebsiteContext';
import DashboardMockup from './DashboardMockup';

export default function Hero() {
  const brand = useBrand();
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-amber-50/50 via-white to-white pt-16 pb-20 sm:pt-20 sm:pb-28">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-violet-600">
            {brand.fullName}
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-violet-600 bg-clip-text text-transparent">
              {brand.tagline}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            {brand.description}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {brand.trial_days || 14}-day free trial
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Free technical support
            </span>
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="w-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-violet-600 px-8 py-3.5 text-center text-sm font-semibold text-white shadow-xl shadow-orange-500/30 transition hover:shadow-orange-500/50 sm:w-auto"
            >
              Get Started — Free
            </Link>
            <a
              href={brand.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-full border border-slate-300 bg-white px-8 py-3.5 text-center text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-600 sm:w-auto"
            >
              View Live Demo
            </a>
          </div>
        </div>

        <div id="demo" className="relative mx-auto mt-16 max-w-5xl">
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-violet-500/20 blur-2xl" />
          <DashboardMockup className="relative" />
        </div>
      </div>
    </section>
  );
}
