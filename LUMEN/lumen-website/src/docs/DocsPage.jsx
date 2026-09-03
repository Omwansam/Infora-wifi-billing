import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Block, tableOfContents } from './blocks';
import { neighbours, BY_SLUG } from './nav';
import { PAGES } from './content';
import CopyPageMenu from './CopyPageMenu';
import DocsToc from './DocsToc';
import { BRAND } from '../lib/brand';

function NotFound({ slug }) {
  return (
    <main className="min-w-0 flex-1 py-16">
      <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">That page does not exist</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        No documentation page is registered for <code className="font-mono text-sm">{slug}</code>.
      </p>
      <Link to="/docs/introduction" className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
        Back to the introduction
      </Link>
    </main>
  );
}

export default function DocsPage({ slug, group }) {
  const page = PAGES[slug];
  const toc = useMemo(() => tableOfContents(page?.blocks), [page]);
  const { prev, next } = neighbours(slug);

  // The tab title is how a reader with ten docs tabs open finds this one.
  useEffect(() => {
    if (!page) return undefined;
    const previous = document.title;
    document.title = `${page.title} — ${BRAND.name} Docs`;
    return () => { document.title = previous; };
  }, [page]);

  // Deep links land before the content paints, so the browser has nothing to
  // scroll to yet. Re-run the jump once this page's blocks are on screen.
  useEffect(() => {
    if (!page || !window.location.hash) return;
    const id = window.location.hash.slice(1);
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
  }, [page]);

  if (!page) return <NotFound slug={slug} />;

  return (
    <>
      {/* The prose is capped for readability but centred in the track between
          the sidebar and the contents rail, so a wide window does not leave
          the column pinned left with a gap beside it. */}
      <main className="min-w-0 flex-1 py-10 lg:px-10">
        <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            {group && <p className="text-[13px] font-semibold text-violet-600 dark:text-violet-400">{group}</p>}
            <h1 className="mt-1.5 text-[2.1rem] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
              {page.title}
            </h1>
          </div>
          <div className="hidden pt-6 sm:block">
            <CopyPageMenu page={{ ...page, slug }} />
          </div>
        </div>

        {page.description && (
          <p className="mt-4 text-[17px] leading-relaxed text-slate-600 dark:text-slate-400">{page.description}</p>
        )}

        <div className="mt-10">
          {(page.blocks || []).map((block, i) => <Block key={i} block={block} />)}
        </div>

        {/* ------------------------------------------------------ prev/next */}
        <nav className="mt-16 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-2 dark:border-slate-800">
          {prev ? (
            <Link to={`/docs/${prev.slug}`} className="group rounded-xl border border-slate-200 p-4 transition hover:border-violet-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-violet-500/50">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Previous</span>
              <span className="mt-1 block text-sm font-semibold text-slate-900 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-400">
                {prev.title}
              </span>
            </Link>
          ) : <span />}
          {next && (
            <Link to={`/docs/${next.slug}`} className="group rounded-xl border border-slate-200 p-4 text-right transition hover:border-violet-300 hover:shadow-sm dark:border-slate-800 dark:hover:border-violet-500/50">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Next</span>
              <span className="mt-1 block text-sm font-semibold text-slate-900 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-400">
                {next.title}
              </span>
            </Link>
          )}
        </nav>

        <p className="mt-10 text-xs text-slate-400">
          Screens, fields and capabilities vary by your role, country, configured services,
          payment gateway and enabled account features.
        </p>
        </div>
      </main>

      {/* ------------------------------------------------------------- toc */}
      <aside className="sticky top-[104px] hidden h-[calc(100vh-104px)] w-60 shrink-0 overflow-y-auto py-10 xl:block">
        <DocsToc items={toc} />
      </aside>
    </>
  );
}

export { NotFound };
