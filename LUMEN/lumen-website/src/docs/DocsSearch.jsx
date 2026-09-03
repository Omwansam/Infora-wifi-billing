import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FLAT } from './nav';
import { PAGES } from './content';
import { plainText } from './blocks';

/**
 * The index is built once from the same block source the pages render from, so
 * it can never describe a page that no longer says that. It is small enough
 * (tens of pages) that a scored substring scan beats shipping a search library.
 */
function buildIndex() {
  return FLAT.map((entry) => {
    const page = PAGES[entry.slug];
    if (!page) return null;
    const headings = (page.blocks || [])
      .filter((b) => b.t === 'h2' || b.t === 'h3')
      .map((b) => b.text);
    return {
      slug: entry.slug,
      title: page.title || entry.title,
      group: entry.group,
      description: page.description || '',
      headings,
      body: plainText(page.blocks).join(' · '),
    };
  }).filter(Boolean);
}

function score(entry, query) {
  const q = query.toLowerCase();
  const title = entry.title.toLowerCase();
  if (title === q) return 1000;
  if (title.startsWith(q)) return 500;
  if (title.includes(q)) return 300;
  if (entry.description.toLowerCase().includes(q)) return 160;
  if (entry.headings.some((h) => h.toLowerCase().includes(q))) return 120;
  if (entry.body.toLowerCase().includes(q)) return 50;
  return 0;
}

/** The matched run plus a little of the text either side, for the result row. */
function excerpt(entry, query) {
  const hay = `${entry.description} ${entry.body}`.trim();
  const at = hay.toLowerCase().indexOf(query.toLowerCase());
  if (at === -1) return entry.description.slice(0, 120);
  const start = Math.max(0, at - 40);
  return `${start > 0 ? '…' : ''}${hay.slice(start, at + query.length + 90).trim()}…`;
}

function Highlight({ text, query }) {
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  if (!query || at === -1) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-violet-100 px-0.5 text-violet-800 dark:bg-violet-500/30 dark:text-violet-100">
        {text.slice(at, at + query.length)}
      </mark>
      {text.slice(at + query.length)}
    </>
  );
}

export default function DocsSearch({ open, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const index = useMemo(buildIndex, []);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return index.slice(0, 8).map((entry) => ({ entry, s: 0 }));
    return index
      .map((entry) => ({ entry, s: score(entry, q) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.entry.title.localeCompare(b.entry.title))
      .slice(0, 12);
  }, [query, index]);

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery('');
    // The dialog mounts hidden-then-shown; focus on the next frame or Safari
    // drops it and the user types into the page behind.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const go = useCallback((slug) => {
    onClose();
    navigate(`/docs/${slug}`);
  }, [navigate, onClose]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active].entry.slug); }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search documentation">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 shrink-0 text-slate-400">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search the documentation…"
            className="min-w-0 flex-1 bg-transparent py-4 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
          />
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400 dark:border-slate-700">
            ESC
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              No pages match “{query}”.
            </p>
          ) : (
            results.map(({ entry }, i) => (
              <button
                key={entry.slug}
                type="button"
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(entry.slug)}
                className={`block w-full rounded-lg px-3 py-2.5 text-left transition ${
                  i === active ? 'bg-violet-50 dark:bg-violet-500/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    <Highlight text={entry.title} query={query.trim()} />
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-slate-400">{entry.group}</span>
                </div>
                {query.trim() && (
                  <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    <Highlight text={excerpt(entry, query.trim())} query={query.trim()} />
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-400 dark:border-slate-800">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span className="ml-auto">{results.length} result{results.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}
