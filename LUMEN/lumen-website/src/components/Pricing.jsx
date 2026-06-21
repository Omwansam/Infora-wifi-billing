import { Link } from 'react-router-dom';
import Reveal from './Reveal';

const PLANS = [
  {
    name: 'Hotspot Plan',
    popular: true,
    price: '3%',
    unit: 'of Hotspot Revenue',
    features: [
      'Unlimited MikroTiks',
      'No user limit',
      'Remote Winbox management',
      'M-Pesa & multiple gateways',
      'SMS notifications',
      'Email support',
      'Voucher management',
      'Captive portal branding',
    ],
  },
  {
    name: 'PPPoE Plan',
    popular: false,
    price: '$0.25',
    unit: 'user / month',
    features: [
      'Unlimited MikroTiks',
      'Unlimited users',
      'No revenue limit',
      'Automated invoicing',
      'Automated payments',
      'Multiple payment gateways',
      'Real-time notifications',
      'Customer KYC & portal',
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-gradient-to-b from-slate-50 to-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
            Transparent Pricing, No Surprises
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Flexible Plans for All
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Our plans grow with you — we only succeed when you do.
          </p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-4xl gap-8 lg:grid-cols-2">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 100}>
              <div
                className={`relative h-full rounded-2xl border bg-white p-8 shadow-sm ${
                  plan.popular
                    ? 'border-violet-300 shadow-lg shadow-violet-500/10 ring-1 ring-violet-200'
                    : 'border-slate-200'
                }`}
              >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500 to-violet-600 px-4 py-1 text-xs font-semibold text-white">
                  Popular
                </span>
              )}
              <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                <span className="text-sm text-slate-500">{plan.unit}</span>
              </div>
              <Link
                to="/signup"
                className={`mt-6 block w-full rounded-full py-3 text-center text-sm font-semibold transition ${
                  plan.popular
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-violet-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40'
                    : 'border border-slate-300 text-slate-700 hover:border-violet-300 hover:text-violet-600'
                }`}
              >
                Get Started — Free
              </Link>
              <p className="mt-6 text-sm font-medium text-slate-500">What&apos;s included:</p>
              <ul className="mt-3 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              </div>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          We offer a 14-day free trial and dedicated support for all new ISP accounts.
        </p>
      </div>
    </section>
  );
}
