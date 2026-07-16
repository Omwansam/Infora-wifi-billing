const NAV_ITEMS = ['Dashboard', 'Clients', 'Billing', 'Plans', 'Network', 'Tickets'];

const STAT_CARDS = [
  { label: 'Revenue this month', value: 'KES 842,500', delta: '+12.4%', color: 'from-amber-500 to-orange-500' },
  { label: 'Online now', value: '1,284', delta: '+38', color: 'from-cyan-500 to-blue-500' },
  { label: 'Collection rate', value: '96.2%', delta: '+1.1%', color: 'from-emerald-500 to-teal-500' },
  { label: 'Routers online', value: '12 / 13', delta: '', color: 'from-violet-500 to-purple-500' },
];

const PAYMENTS = [
  { name: 'Grace Wanjiku', plan: 'Home Plus 10 Mbps', amount: 'KES 2,500', ref: 'SFH3K2LQ9X' },
  { name: 'Brian Otieno', plan: 'Daily Unlimited', amount: 'KES 50', ref: 'SFH8T4WM2A' },
  { name: 'Mercy Achieng', plan: 'Family Stream 20 Mbps', amount: 'KES 3,500', ref: 'SFH1P9RC5D' },
];

export default function DashboardMockup({ className = '' }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-violet-500/10 ${className}`}
    >
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="mx-auto flex h-6 w-56 items-center justify-center rounded-md bg-white px-3 text-[10px] text-slate-400">
          🔒 demo.ruirufactorymabati.com
        </div>
      </div>

      <div className="flex">
        {/* sidebar */}
        <aside className="hidden w-36 shrink-0 border-r border-slate-800 bg-slate-900 p-3 sm:block">
          <div className="mb-4 flex items-center gap-2 px-1">
            <span className="h-5 w-5 rounded-md bg-gradient-to-br from-amber-400 to-violet-500" />
            <span className="text-[11px] font-bold text-white">Lumen</span>
          </div>
          {NAV_ITEMS.map((item, i) => (
            <div
              key={item}
              className={`mb-1 rounded-lg px-2.5 py-1.5 text-[10px] font-medium ${
                i === 0
                  ? 'bg-gradient-to-r from-amber-500/20 to-violet-500/20 text-white'
                  : 'text-slate-400'
              }`}
            >
              {item}
            </div>
          ))}
        </aside>

        {/* main panel */}
        <main className="flex-1 bg-slate-50/60 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">Dashboard</p>
              <p className="text-[9px] text-slate-400">Karibu tena — here's your network today</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">
              ● All systems live
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STAT_CARDS.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[9px] font-medium text-slate-400">{stat.label}</p>
                <p
                  className={`mt-1 bg-gradient-to-r ${stat.color} bg-clip-text text-sm font-bold text-transparent sm:text-base`}
                >
                  {stat.value}
                </p>
                {stat.delta && (
                  <p className="mt-0.5 text-[9px] font-semibold text-emerald-500">{stat.delta} vs last month</p>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            {/* revenue chart */}
            <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-600">Revenue — last 12 months</p>
                <span className="text-[9px] text-slate-400">PPPoE ▪ Hotspot</span>
              </div>
              <div className="flex h-24 items-end gap-1">
                {[40, 55, 45, 70, 60, 85, 75, 90, 80, 95, 88, 100].map((h, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col justify-end gap-px">
                    <div
                      className="rounded-t bg-gradient-to-t from-violet-500 to-violet-400 opacity-90"
                      style={{ height: `${h * 0.65}%` }}
                    />
                    <div className="rounded-b-sm bg-amber-400/80" style={{ height: `${h * 0.3}%` }} />
                  </div>
                ))}
              </div>
            </div>

            {/* M-Pesa feed */}
            <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-600">Live M-Pesa payments</p>
                <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              </div>
              <div className="space-y-2">
                {PAYMENTS.map((p) => (
                  <div key={p.ref} className="flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[8px] font-bold text-emerald-700">
                      M
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[9px] font-semibold text-slate-700">{p.name}</p>
                      <p className="truncate text-[8px] text-slate-400">{p.plan} · {p.ref}</p>
                    </div>
                    <span className="text-[9px] font-bold text-emerald-600">{p.amount}</span>
                  </div>
                ))}
                <div className="rounded-lg bg-emerald-50 px-2 py-1.5 text-center text-[8px] font-medium text-emerald-700">
                  ✓ Auto-reconciled &amp; activated in RADIUS
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
