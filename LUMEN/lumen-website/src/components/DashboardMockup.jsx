export default function DashboardMockup({ className = '' }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-violet-500/10 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="mx-auto flex h-6 w-48 items-center rounded-md bg-white px-3 text-[10px] text-slate-400">
          app.lumen.app/dashboard
        </div>
      </div>

      <div className="flex">
        <aside className="hidden w-14 shrink-0 border-r border-slate-100 bg-slate-50/50 p-2 sm:block">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`mb-2 h-8 rounded-lg ${i === 0 ? 'bg-gradient-to-r from-amber-500/20 to-violet-500/20' : 'bg-slate-100'}`}
            />
          ))}
        </aside>

        <main className="flex-1 p-4 sm:p-5">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Revenue', value: 'KES 842K', color: 'from-amber-500 to-orange-500' },
              { label: 'Active Users', value: '1,284', color: 'from-cyan-500 to-blue-500' },
              { label: 'Payments', value: '96%', color: 'from-emerald-500 to-teal-500' },
              { label: 'Devices', value: '12', color: 'from-violet-500 to-purple-500' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[10px] font-medium text-slate-400">{stat.label}</p>
                <p
                  className={`mt-1 bg-gradient-to-r ${stat.color} bg-clip-text text-sm font-bold text-transparent sm:text-base`}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:col-span-3">
              <p className="mb-2 text-[10px] font-semibold text-slate-500">Revenue Overview</p>
              <div className="flex h-24 items-end gap-1">
                {[40, 55, 45, 70, 60, 85, 75, 90, 80, 95, 88, 100].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-to-t from-violet-500 to-amber-400 opacity-80"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:col-span-2">
              <p className="mb-2 text-[10px] font-semibold text-slate-500">Recent Payments</p>
              <div className="space-y-2">
                {['M-Pesa · KES 2,500', 'M-Pesa · KES 1,000', 'Voucher · KES 500'].map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-emerald-100" />
                    <div className="h-2 flex-1 rounded bg-slate-200" />
                    <span className="text-[9px] text-slate-400">{p.split('·')[1]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
