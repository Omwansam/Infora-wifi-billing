import { useEffect, useState } from 'react';

/**
 * Scroll-spy over the rendered headings.
 *
 * IntersectionObserver alone picks whichever heading happens to be intersecting,
 * which flickers between two when a short section straddles the viewport. This
 * tracks every heading's position instead and picks the last one above the
 * reading line, so the highlight only ever moves in the direction you scroll.
 */
export default function DocsToc({ items }) {
  const [activeId, setActiveId] = useState(items[0]?.id);

  useEffect(() => {
    if (!items.length) return undefined;
    const onScroll = () => {
      const line = 120; // just under the sticky header
      let current = items[0]?.id;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= line) current = item.id;
      }
      // At the very bottom the last heading may never cross the line.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        current = items[items.length - 1].id;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [items]);

  if (items.length < 2) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-3.5 w-3.5 text-slate-400">
          <path d="M4 6h16M4 12h10M4 18h13" />
        </svg>
        On this page
      </p>
      <ul className="space-y-0.5 border-l border-slate-200 dark:border-slate-800">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`-ml-px block border-l py-1 text-[13px] leading-snug transition ${
                item.depth === 3 ? 'pl-6' : 'pl-4'
              } ${
                activeId === item.id
                  ? 'border-violet-500 font-medium text-violet-700 dark:text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
