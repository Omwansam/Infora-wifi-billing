import { Link } from 'react-router-dom';
import { useBrand } from '../contexts/WebsiteContext';
import Reveal from './Reveal';

const ROWS = [
  ['Automatic M-Pesa STK Push with instant activation', true, 'partial', false],
  ['MikroTik provisioning scripts generated for you', true, 'partial', false],
  ['Hotspot + PPPoE + Static IP on one dashboard', true, true, false],
  ['Built-in RADIUS (AAA) — no third-party server', true, false, false],
  ['Secure WireGuard management tunnel to every router', true, false, false],
  ['Branded captive portal + customer self-care portal', true, 'partial', false],
  ['Customer KYC & document verification workflow', true, false, false],
  ['SMS + email + WhatsApp payment reminders', true, true, false],
  ['Finance suite: expenses, leads & profitability reports', true, false, false],
  ['Live RADIUS session & data-usage monitoring', true, 'partial', false],
];

function Cell({ value }) {
  if (value === true) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
        <svg className="h-4 w-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </span>
    );
  }
  if (value === 'partial') {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
        Partial
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  );
}

export default function Comparison() {
  const brand = useBrand();
  return (
    <section id="compare" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
            Why ISPs Switch to Lumen
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            More than a billing system
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Most platforms stop at invoices. Lumen runs your whole WISP — billing,
            network, payments and customer care — from a single dashboard.
          </p>
        </Reveal>

        <Reveal className="mt-14" delay={100}>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[640px] border-collapse bg-white text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Capability</th>
                  <th className="px-4 py-4 text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-violet-600 px-4 py-1.5 text-sm font-bold text-white">
                      Lumen
                    </span>
                  </th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-slate-500">
                    Typical billing platforms
                  </th>
                  <th className="px-4 py-4 text-center text-sm font-semibold text-slate-500">
                    Spreadsheets &amp; manual M-Pesa
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([feature, lumen, others, manual], i) => (
                  <tr
                    key={feature}
                    className={`border-b border-slate-100 last:border-0 ${i % 2 ? 'bg-slate-50/40' : ''}`}
                  >
                    <td className="px-6 py-3.5 text-sm text-slate-700">{feature}</td>
                    <td className="px-4 py-3.5 text-center"><Cell value={lumen} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={others} /></td>
                    <td className="px-4 py-3.5 text-center"><Cell value={manual} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row" delay={150}>
          <a
            href={brand.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-full border border-slate-300 bg-white px-8 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-600 sm:w-auto"
          >
            Explore the live demo — no signup
          </a>
          <Link
            to="/signup"
            className="w-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-violet-600 px-8 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-orange-500/40 sm:w-auto"
          >
            Start free 14-day trial
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
