import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* -------------------------------------------------------------------------
 * Table pagination state.
 *
 * Two hooks, one contract. `useServerPagination` is for tables whose endpoint
 * takes `page`/`per_page` and answers with `total`/`pages`; `useClientPagination`
 * is for tables that already hold the whole list in memory and only need it
 * sliced. Both hand back a `paginationProps` object that plugs straight into
 * <TablePagination />, so a page never has to know which kind it is using once
 * the data is loaded.
 * ---------------------------------------------------------------------- */

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const DEFAULT_PAGE_SIZE = 25;
const STORAGE_PREFIX = 'infora.rowsPerPage.';
const EMPTY_LIST = [];

function readStoredPageSize(storageKey, fallback) {
  if (!storageKey) return fallback;
  try {
    const parsed = Number.parseInt(window.localStorage.getItem(STORAGE_PREFIX + storageKey), 10);
    return PAGE_SIZE_OPTIONS.includes(parsed) ? parsed : fallback;
  } catch {
    // Private windows and locked-down browsers throw on access, not on read.
    return fallback;
  }
}

function writeStoredPageSize(storageKey, value) {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + storageKey, String(value));
  } catch {
    /* nothing to do — the preference just will not survive the reload */
  }
}

/**
 * Shared page/page-size state.
 *
 * `resetOn` is the list of filter values that change *what* is being listed —
 * a search term, a status tab, a router filter. When any of them changes, page
 * 4 of the old result set is meaningless, so we go back to page 1. Pass
 * primitives only; the array is compared by its JSON.
 */
function usePageState({ defaultPageSize, storageKey, resetOn }) {
  const [page, setPageRaw] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(
    () => readStoredPageSize(storageKey, defaultPageSize || DEFAULT_PAGE_SIZE),
  );

  const setPage = useCallback((next) => {
    setPageRaw((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      const parsed = Math.floor(Number(value));
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    });
  }, []);

  const setPageSize = useCallback((next) => {
    const parsed = Math.floor(Number(next));
    if (!Number.isFinite(parsed) || parsed < 1) return;
    setPageSizeRaw((current) => {
      if (parsed !== current) writeStoredPageSize(storageKey, parsed);
      return parsed;
    });
    // Row 51 is the first row of page 2 at 50-per-page but sits on page 1 at
    // 100-per-page. Rather than guess which row the operator was looking at,
    // return to the top — the one landing spot that is never surprising.
    setPageRaw(1);
  }, [storageKey]);

  const resetSignature = JSON.stringify(resetOn ?? []);
  const mounted = useRef(false);
  useEffect(() => {
    // Skip the first run: mounting is not a filter change, and resetting here
    // would clobber a page restored from anywhere else.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setPageRaw(1);
  }, [resetSignature]);

  return { page, setPage, pageSize, setPageSize };
}

/**
 * Pagination for a table backed by a paginated endpoint.
 *
 * Feed the response body to `setTotals` after every fetch and include
 * `page`/`pageSize` in the loader's dependencies.
 */
export function useServerPagination(options = {}) {
  const { defaultPageSize, storageKey, resetOn } = options;
  const { page, setPage, pageSize, setPageSize } = usePageState({ defaultPageSize, storageKey, resetOn });
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const setTotals = useCallback((payload) => {
    const body = payload || {};
    const totalValue = Math.max(0, Math.floor(Number(body.total ?? body.total_count ?? 0)) || 0);
    const pagesValue = Math.floor(Number(body.pages ?? body.total_pages ?? 0)) || 0;
    setTotal(totalValue);
    // Not every endpoint reports `pages`; derive it when it is missing.
    setPageCount(pagesValue > 0 ? pagesValue : Math.max(1, Math.ceil(totalValue / pageSize)));
  }, [pageSize]);

  // Deleting the last row of the last page leaves us pointing past the end.
  // Stepping back changes the loader's dependencies, which refetches.
  useEffect(() => {
    if (pageCount >= 1 && page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  const queryParams = useMemo(() => ({ page, per_page: pageSize }), [page, pageSize]);

  const paginationProps = useMemo(() => ({
    page,
    pageCount,
    pageSize,
    total,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
  }), [page, pageCount, pageSize, total, setPage, setPageSize]);

  return { page, setPage, pageSize, setPageSize, total, pageCount, setTotals, queryParams, paginationProps };
}

/**
 * Pagination for a list that is already fully loaded — render `pageItems`
 * instead of the array you passed in.
 */
export function useClientPagination(items, options = {}) {
  const { defaultPageSize, storageKey, resetOn, filteredFrom } = options;
  const list = Array.isArray(items) ? items : EMPTY_LIST;
  const { page, setPage, pageSize, setPageSize } = usePageState({ defaultPageSize, storageKey, resetOn });

  const total = list.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Render from the clamped value in the same pass the list shrank, so the
  // table never flashes empty while the effect below catches state up.
  const safePage = Math.min(Math.max(page, 1), pageCount);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount, setPage]);

  const pageItems = useMemo(
    () => list.slice((safePage - 1) * pageSize, safePage * pageSize),
    [list, safePage, pageSize],
  );

  const paginationProps = useMemo(() => ({
    page: safePage,
    pageCount,
    pageSize,
    total,
    filteredFrom: typeof filteredFrom === 'number' && filteredFrom !== total ? filteredFrom : undefined,
    onPageChange: setPage,
    onPageSizeChange: setPageSize,
  }), [safePage, pageCount, pageSize, total, filteredFrom, setPage, setPageSize]);

  return { pageItems, page: safePage, setPage, pageSize, setPageSize, total, pageCount, paginationProps };
}
