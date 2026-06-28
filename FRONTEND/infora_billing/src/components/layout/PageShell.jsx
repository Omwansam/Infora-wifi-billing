import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Standard responsive page wrapper — use instead of per-page min-h-screen + p-6 shells.
 */
export default function PageShell({
  children,
  className,
  innerClassName,
  maxWidth = 'max-w-7xl',
  spacing,
}) {
  return (
    <div className={cn('min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6', className)}>
      <div className={cn('mx-auto w-full min-w-0', maxWidth, spacing, innerClassName)}>
        {children}
      </div>
    </div>
  );
}

/** Horizontal scroll wrapper for data tables on narrow viewports. */
export function TableScroll({ children, className }) {
  return (
    <div className={cn('table-scroll -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0', className)}>
      {children}
    </div>
  );
}
