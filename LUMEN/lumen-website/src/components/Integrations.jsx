import Reveal from './Reveal';

const INTEGRATIONS = [
  { name: 'MikroTik', desc: 'RouterOS v6 & v7', color: 'from-slate-600 to-slate-800', emoji: '🔧' },
  { name: 'M-Pesa', desc: 'STK Push payments', color: 'from-emerald-500 to-green-600', emoji: '💚' },
  { name: 'RADIUS', desc: 'Auth & accounting', color: 'from-blue-500 to-indigo-600', emoji: '🔐' },
  { name: 'SMS', desc: 'Bulk notifications', color: 'from-cyan-500 to-teal-600', emoji: '💬' },
  { name: 'Captive Portal', desc: 'Branded login pages', color: 'from-violet-500 to-purple-600', emoji: '📱' },
  { name: 'PPPoE', desc: 'Broadband subscribers', color: 'from-amber-500 to-orange-600', emoji: '🌐' },
];

export default function Integrations() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">Integrations</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Lumen Integrates With
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Multiple payment gateways, SMS platforms, and full MikroTik device support — everything
            your ISP needs in one platform.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((item, i) => (
            <Reveal key={item.name} delay={i * 60}>
              <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-500/5">
                <div
                  className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${item.color} text-xl shadow-sm`}
                >
                  {item.emoji}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-slate-500">
          {['Seamless Integration', 'User-Friendly Interface', 'Customizable Solutions', 'Live Oversight'].map(
            (tag) => (
              <span key={tag} className="flex items-center gap-2">
                <svg className="h-4 w-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {tag}
              </span>
            )
          )}
        </Reveal>
      </div>
    </section>
  );
}
