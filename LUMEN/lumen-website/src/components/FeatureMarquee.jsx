const ROW_1 = [
  'Remote Mikrotik Management',
  'Automated Payments',
  'Real-Time Reports',
  'Captive Portals',
  'M-Pesa Integration',
  'Voucher Management',
];

const ROW_2 = [
  'Hotspot Support',
  'PPPoE Support',
  'Customer KYC',
  'SMS Campaigns',
  'Multi-Location',
  'Increased Efficiency',
];

function MarqueeRow({ items, reverse = false }) {
  const doubled = [...items, ...items];

  return (
    <div className="relative flex overflow-hidden py-3">
      <div
        className={`flex shrink-0 gap-8 ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'}`}
      >
        {doubled.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-amber-500 to-violet-500" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FeatureMarquee() {
  return (
    <section className="overflow-hidden border-y border-slate-100 bg-slate-50/30 py-4">
      <MarqueeRow items={ROW_1} />
      <MarqueeRow items={ROW_2} reverse />
    </section>
  );
}
