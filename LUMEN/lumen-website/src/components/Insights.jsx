const INSIGHTS = [
  {
    title: 'Real-Time Insights',
    description:
      'Monitor billing performance in real time. Track payment processing, revenue streams, and subscription metrics to optimize your ISP billing effectiveness.',
    stats: [
      { label: 'Today', value: 'KES 48,200' },
      { label: 'This Week', value: 'KES 312K' },
      { label: 'Growth', value: '+18%' },
    ],
  },
  {
    title: 'Actionable Data',
    description:
      'Harness analytics to optimize revenue cycles, automate workflows, and make data-driven decisions about pricing and service packages.',
    stats: [
      { label: 'Active Subs', value: '1,284' },
      { label: 'Churn Rate', value: '2.1%' },
      { label: 'ARPU', value: 'KES 1,850' },
    ],
  },
];

export default function Insights() {
  return (
    <section id="features" className="bg-slate-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">Comprehensive Insights</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Purpose-Built for ISPs
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Track customer engagement and make data-driven decisions to grow your business.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {INSIGHTS.map((item) => (
            <div
              key={item.title}
              className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/50"
            >
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-slate-400">{item.description}</p>
              </div>
              <div className="border-t border-slate-700/50 bg-slate-800/80 p-6">
                <div className="grid grid-cols-3 gap-4">
                  {item.stats.map((stat) => (
                    <div key={stat.label} className="text-center">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-lg font-bold text-amber-400">{stat.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex h-20 items-end gap-1">
                  {[30, 45, 35, 60, 50, 75, 65, 80, 70, 90, 85, 95].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-violet-600 to-amber-400"
                      style={{ height: `${h}%`, opacity: 0.7 + i * 0.02 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
