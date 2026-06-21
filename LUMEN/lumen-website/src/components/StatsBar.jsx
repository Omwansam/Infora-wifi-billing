import { useWebsite } from '../contexts/WebsiteContext';
import Reveal from './Reveal';

export default function StatsBar() {
  const { stats, loading } = useWebsite();

  return (
    <section className="border-y border-slate-200 bg-white py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 sm:px-6 md:grid-cols-4 lg:px-8">
        {stats.map((stat, i) => (
          <Reveal key={stat.label} delay={i * 80} className="text-center">
            <p className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              <span className="bg-gradient-to-r from-amber-500 to-violet-600 bg-clip-text text-transparent">
                {loading ? '…' : stat.value}
              </span>
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500">{stat.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
