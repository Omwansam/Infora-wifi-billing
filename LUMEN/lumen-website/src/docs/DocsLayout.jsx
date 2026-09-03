import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LumenLogo from '../components/LumenLogo';
import { APP_URL } from '../lib/brand';
import { BY_SLUG } from './nav';
import DocsSidebar from './DocsSidebar';
import DocsSearch from './DocsSearch';
import ThemeToggle from './ThemeToggle';
import { useTheme } from './useTheme';
import DocsPage from './DocsPage';

export default function DocsLayout() {
  const { slug } = useParams();
  const { theme, toggle } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Ctrl/Cmd+K anywhere, and "/" when the reader is not already typing.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // A route change closes the mobile drawer and returns to the top of the page.
  useEffect(() => {
    setNavOpen(false);
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [slug]);

  const current = BY_SLUG[slug];

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* ---------------------------------------------------------- header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex h-16 max-w-[100rem] items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Lumen home">
            <LumenLogo size="sm" />
            <span className="hidden text-[15px] font-bold tracking-tight sm:block">
              Lumen
              <span className="ml-1.5 font-medium text-slate-400">Docs</span>
            </span>
          </Link>

          {/* The search button is the visual centre of the bar, as in a real docs site. */}
          <div className="mx-auto hidden w-full max-w-md md:block">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-left text-sm text-slate-400 transition hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <span className="flex-1">Search…</span>
              <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden dark:hover:bg-slate-800"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[18px] w-[18px]">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
            </button>
            <ThemeToggle theme={theme} onToggle={toggle} />
            <a
              href={APP_URL}
              className="hidden items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-violet-700 sm:inline-flex"
            >
              Open console
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </a>
          </div>
        </div>

        {/* Tab strip — one product today, but it anchors the header the way the
            reference design does and gives API/changelog somewhere to land. */}
        <div className="mx-auto max-w-[100rem] px-4 sm:px-6">
          <nav className="-mb-px flex gap-6" aria-label="Sections">
            <span className="border-b-2 border-violet-600 pb-2.5 text-[13.5px] font-semibold text-slate-900 dark:text-white">
              Documentation
            </span>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-[100rem] px-4 sm:px-6">
        {/* --------------------------------------------------------- sidebar */}
        <aside className="sticky top-[104px] hidden h-[calc(100vh-104px)] w-64 shrink-0 overflow-y-auto py-8 pr-4 lg:block">
          <DocsSidebar currentSlug={slug} />
        </aside>

        {/* Mobile drawer */}
        {navOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setNavOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-[19rem] max-w-[85vw] flex-col bg-white shadow-xl dark:bg-slate-950">
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
                <span className="text-sm font-bold">Documentation</span>
                <button type="button" onClick={() => setNavOpen(false)} aria-label="Close navigation" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <DocsSidebar currentSlug={slug} onNavigate={() => setNavOpen(false)} />
              </div>
            </div>
          </div>
        )}

        {/* --------------------------------------------------------- content */}
        <DocsPage slug={slug} group={current?.group} />
      </div>

      <DocsSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
