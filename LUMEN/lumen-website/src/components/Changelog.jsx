import { useWebsite } from '../contexts/WebsiteContext';
import Reveal from './Reveal';

const TAG_COLORS = {
  Latest: 'bg-violet-100 text-violet-700',
  Feature: 'bg-emerald-100 text-emerald-700',
  Improvement: 'bg-amber-100 text-amber-700',
};

const FALLBACK = [];

export default function Changelog() {
  const { changelog, loading } = useWebsite();
  const entries = changelog?.length ? changelog : [];

  return (
    <section id="changelog" className="bg-slate-900 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-400">Changelog</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Always Getting Better
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Recent updates to the Lumen platform — shipped continuously for ISPs like yours.
          </p>
        </Reveal>

        {loading && !entries.length ? (
          <div className="mt-14 space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-800" />
            ))}
          </div>
        ) : (
          <div className="relative mt-14">
            <div className="absolute top-0 left-4 h-full w-px bg-slate-700 sm:left-6" />
            <div className="space-y-10">
              {entries.map((entry, i) => (
                <Reveal key={entry.version} delay={i * 80}>
                  <div className="relative pl-12 sm:pl-16">
                    <div className="absolute top-1.5 left-2.5 h-3 w-3 rounded-full border-2 border-amber-400 bg-slate-900 sm:left-4.5" />
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-amber-400">
                        {entry.version}
                      </span>
                      <span className="text-sm text-slate-500">{entry.date}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TAG_COLORS[entry.tag] || TAG_COLORS.Feature}`}
                      >
                        {entry.tag}
                      </span>
                    </div>
                    <h3 className="mt-2 text-lg font-semibold">{entry.title}</h3>
                    <ul className="mt-3 space-y-1.5">
                      {entry.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-400" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
