import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from '../../hooks/usePagination';
import { cn } from '../../lib/utils';

/* -------------------------------------------------------------------------
 * The footer every paginated table in the console shares.
 *
 * Left: where you are in the result set, in rows rather than pages, because
 * "51–100 of 1,284" is the thing an operator actually reads off a subscriber
 * list. Right: how many rows to show, then the pages themselves.
 *
 * Below `sm` the numbered pages collapse to "Page 3 of 26" with arrows — the
 * numbers are the first thing to go, since first/prev/next/last still reach
 * every page.
 * ---------------------------------------------------------------------- */

const ICON_BUTTON = 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 '
  + 'text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 '
  + 'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500 '
  + 'dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 '
  + 'dark:disabled:hover:bg-transparent dark:disabled:hover:text-slate-400';

const PAGE_BUTTON = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium '
  + 'transition-colors';

const PAGE_BUTTON_IDLE = 'border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 '
  + 'dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100';

const PAGE_BUTTON_CURRENT = 'border border-emerald-600 bg-emerald-600 text-white shadow-sm '
  + 'dark:border-emerald-500 dark:bg-emerald-500 dark:text-emerald-950';

function range(start, end) {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}

/**
 * First and last page always visible, a window of `siblings` either side of the
 * current page, ellipses across the gaps. Never more than `siblings * 2 + 5`
 * slots, so the bar cannot grow with the result set.
 */
export function paginationRange(page, pageCount, siblings = 1) {
  const slots = siblings * 2 + 5;
  if (pageCount <= slots) return range(1, pageCount);

  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, pageCount);
  const gapLeft = left > 2;
  const gapRight = right < pageCount - 1;

  if (!gapLeft && gapRight) return [...range(1, 3 + siblings * 2), 'gap-right', pageCount];
  if (gapLeft && !gapRight) return [1, 'gap-left', ...range(pageCount - (2 + siblings * 2), pageCount)];
  return [1, 'gap-left', ...range(left, right), 'gap-right', pageCount];
}

function pluralise(noun, count) {
  if (count === 1) return noun;
  if (/(s|x|z|ch|sh)$/i.test(noun)) return `${noun}es`;
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

export default function TablePagination({
  page,
  pageCount,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  /** Singular noun for the rows — "subscriber", "invoice", "session". */
  noun = 'row',
  /** Override when the plural is not regular, e.g. noun="device" plural="devices". */
  nounPlural,
  /** Unfiltered count, when the table is showing a filtered subset of what it loaded. */
  filteredFrom,
  loading = false,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  /** The hairline that separates the bar from the rows above it. Turn it off
   *  when the bar stands alone rather than sitting under a table. */
  divider = true,
  className = '',
}) {
  const safePageCount = Math.max(1, pageCount || 1);
  const safePage = Math.min(Math.max(1, page || 1), safePageCount);
  const label = total === 1 ? noun : (nounPlural || pluralise(noun, total));

  // An empty table says so in its own empty state; a second "No rows" here
  // would just be noise under it.
  if (!loading && !total) return null;

  const firstRow = total ? (safePage - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(safePage * pageSize, total);
  const showPages = safePageCount > 1;
  // A single page shorter than the smallest option has nothing to resize to.
  const showPageSize = typeof onPageSizeChange === 'function'
    && (showPages || total > Math.min(...pageSizeOptions));

  const goTo = (next) => {
    const target = Math.min(Math.max(1, next), safePageCount);
    if (target !== safePage) onPageChange(target);
  };

  return (
    <div
      // cn() merges through tailwind-merge, so a caller passing px-0 or py-2
      // actually replaces the default rather than fighting it in the cascade.
      className={cn(
        'flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between',
        divider && 'border-t border-slate-100 dark:border-slate-800',
        className,
      )}
      aria-busy={loading || undefined}
    >
      <p className={`text-sm text-slate-600 transition-opacity dark:text-slate-400 ${loading ? 'opacity-50' : ''}`}>
        {total ? (
          <>
            Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{firstRow.toLocaleString()}</span>
            –<span className="font-semibold text-slate-900 dark:text-slate-100">{lastRow.toLocaleString()}</span>
            {' of '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{total.toLocaleString()}</span>
            {` ${label}`}
            {typeof filteredFrom === 'number' && (
              <span className="text-slate-400 dark:text-slate-500">{` (filtered from ${filteredFrom.toLocaleString()})`}</span>
            )}
          </>
        ) : (
          `Loading ${nounPlural || pluralise(noun, 2)}…`
        )}
      </p>

      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {showPageSize && (
          <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        )}

        {showPages && (
          <nav aria-label="Pagination" className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={safePage <= 1}
              aria-label="First page"
              className={`hidden sm:inline-flex ${ICON_BUTTON}`}
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(safePage - 1)}
              disabled={safePage <= 1}
              aria-label="Previous page"
              className={ICON_BUTTON}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-2 text-sm font-medium text-slate-600 dark:text-slate-400 sm:hidden">
              Page {safePage} of {safePageCount}
            </span>

            <div className="hidden items-center gap-1 sm:flex">
              {paginationRange(safePage, safePageCount).map((slot) => (
                typeof slot === 'number' ? (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => goTo(slot)}
                    aria-label={`Page ${slot}`}
                    aria-current={slot === safePage ? 'page' : undefined}
                    className={`${PAGE_BUTTON} ${slot === safePage ? PAGE_BUTTON_CURRENT : PAGE_BUTTON_IDLE}`}
                  >
                    {slot}
                  </button>
                ) : (
                  <span key={slot} aria-hidden="true" className="px-1 text-sm text-slate-400 dark:text-slate-600">…</span>
                )
              ))}
            </div>

            <button
              type="button"
              onClick={() => goTo(safePage + 1)}
              disabled={safePage >= safePageCount}
              aria-label="Next page"
              className={ICON_BUTTON}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(safePageCount)}
              disabled={safePage >= safePageCount}
              aria-label="Last page"
              className={`hidden sm:inline-flex ${ICON_BUTTON}`}
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
