import Reveal from './Reveal';

const TESTIMONIALS = [
  {
    quote:
      'Good service. We have used Lumen for more than a year, and the automations have made our work significantly easier.',
    name: 'Frank',
    role: 'CEO, SwiftNet ISP',
    initials: 'F',
    color: 'from-blue-500 to-cyan-500',
    rating: 5,
  },
  {
    quote:
      'As an ISP business owner, I have been using Lumen billing for over 3 years. It has streamlined my operations and reduced revenue leakages.',
    name: 'Fredrick',
    role: 'Owner, Urban WiFi',
    initials: 'FR',
    color: 'from-amber-500 to-orange-500',
    rating: 5,
  },
  {
    quote:
      'The captive portal and M-Pesa integration alone paid for itself in the first month. Our support tickets dropped by half.',
    name: 'Grace',
    role: 'Operations, FiberLink',
    initials: 'G',
    color: 'from-violet-500 to-purple-500',
    rating: 5,
  },
];

function Stars({ count }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(count)].map((_, i) => (
        <svg key={i} className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function Testimonials() {
  return (
    <section className="bg-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
            Trusted by ISPs Worldwide
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            What Other Internet Providers Say
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Hear from ISPs who have automated their businesses with Lumen.
          </p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 80}>
              <blockquote className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Stars count={t.rating} />
                <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-600">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.color} text-sm font-bold text-white`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </footer>
              </blockquote>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14 text-center">
          <p className="text-sm font-medium text-slate-500">Trusted by</p>
          <p className="mt-2 text-5xl font-bold text-slate-900">
            <span className="bg-gradient-to-r from-amber-500 to-violet-600 bg-clip-text text-transparent">
              500+
            </span>
          </p>
          <p className="mt-1 text-sm text-slate-500">ISPs worldwide</p>
        </Reveal>
      </div>
    </section>
  );
}
