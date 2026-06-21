const PARTNERS = [
  'SwiftNet ISP',
  'Connect Kenya',
  'Urban WiFi',
  'FiberLink',
  'NetWave',
  'SkyConnect',
];

export default function TrustedBy() {
  return (
    <section className="border-y border-slate-100 bg-slate-50/50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-sm font-medium text-slate-500">
          Trusted by growing ISPs across Kenya and beyond
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {PARTNERS.map((name) => (
            <span
              key={name}
              className="text-sm font-semibold tracking-wide text-slate-400 transition hover:text-slate-600"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
