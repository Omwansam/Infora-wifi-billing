import { BRAND } from '../lib/brand';
import Reveal from './Reveal';
import LumenLogo from './LumenLogo';

const PACKAGES = [
  { name: '1 Hour', price: 'KES 20', speed: '5 Mbps' },
  { name: 'Daily', price: 'KES 50', speed: '10 Mbps', popular: true },
  { name: 'Weekly', price: 'KES 250', speed: '15 Mbps' },
];

export default function PortalPreview() {
  return (
    <section className="overflow-hidden bg-gradient-to-b from-slate-50 to-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
              Branded Captive Portal
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Monetize Your WiFi Instantly
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Give customers a professional login experience with your logo, colors, and packages.
              Accept M-Pesa payments, sell vouchers, and activate access in seconds — no manual
              intervention needed.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Fully customizable branding',
                'M-Pesa STK Push checkout',
                'Voucher & account login',
                'Mobile-first responsive design',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <a
              href={BRAND.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 hover:text-violet-700"
            >
              Open live portal preview
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </Reveal>

          <Reveal delay={150} direction="left">
            <div className="relative mx-auto max-w-sm">
              <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-br from-amber-400/30 to-violet-500/30 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border-4 border-slate-800 bg-slate-900 shadow-2xl">
                <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
                  <span className="text-[10px] text-slate-400">9:41</span>
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-slate-600" />
                    <span className="h-2 w-2 rounded-full bg-slate-600" />
                  </div>
                </div>

                <div className="bg-gradient-to-b from-slate-900 via-slate-800 to-violet-950 p-5">
                  <div className="mb-5 flex justify-center">
                    <LumenLogo size={40} showText subtitle="Hotspot" theme="dark" />
                  </div>
                  <p className="mb-4 text-center text-xs text-slate-400">
                    Choose a package to get online
                  </p>

                  <div className="space-y-2">
                    {PACKAGES.map((pkg) => (
                      <div
                        key={pkg.name}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                          pkg.popular
                            ? 'border-amber-500/50 bg-amber-500/10'
                            : 'border-slate-700 bg-slate-800/50'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{pkg.name}</p>
                          <p className="text-[10px] text-slate-400">{pkg.speed}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-amber-400">{pkg.price}</p>
                          {pkg.popular && (
                            <span className="text-[9px] font-medium text-amber-500/80">Popular</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-amber-500 to-violet-600 py-3 text-sm font-semibold text-white"
                  >
                    Pay with M-Pesa
                  </button>
                  <p className="mt-3 text-center text-[10px] text-slate-500">
                    Already have a voucher?{' '}
                    <span className="text-cyan-400">Enter code</span>
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
