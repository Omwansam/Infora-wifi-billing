import Reveal from './Reveal';

const STEPS = [
  {
    step: '01',
    title: 'Create Your Account',
    description:
      'Sign up in minutes with a 14-day free trial. No credit card required — start configuring your ISP profile right away.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    ),
  },
  {
    step: '02',
    title: 'Connect Your MikroTik',
    description:
      'Add your routers via API. Lumen syncs users, profiles, and bandwidth limits automatically across all locations.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
      />
    ),
  },
  {
    step: '03',
    title: 'Set Up Plans & Payments',
    description:
      'Create hotspot or PPPoE packages, connect M-Pesa and other gateways, and publish your branded captive portal.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
      />
    ),
  },
  {
    step: '04',
    title: 'Start Earning',
    description:
      'Customers pay via M-Pesa or vouchers, get instant access, and you track everything from one real-time dashboard.',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
      />
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Getting Started</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Up and Running in Four Steps
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            From signup to your first paying customer — Lumen makes ISP billing simple.
          </p>
        </Reveal>

        <div className="relative mt-16">
          <div className="absolute top-12 left-0 hidden h-0.5 w-full bg-gradient-to-r from-amber-200 via-violet-200 to-amber-200 lg:block" />

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((item, i) => (
              <Reveal key={item.step} delay={i * 100}>
                <div className="relative rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-violet-200 hover:shadow-lg hover:shadow-violet-500/5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-violet-500/10">
                      <svg
                        className="h-6 w-6 text-violet-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        {item.icon}
                      </svg>
                    </div>
                    <span className="text-2xl font-bold text-slate-200">{item.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
