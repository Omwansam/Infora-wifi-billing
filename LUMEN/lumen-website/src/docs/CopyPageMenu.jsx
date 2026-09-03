import { useEffect, useRef, useState } from 'react';
import { toMarkdown } from './blocks';

/**
 * "Copy page" — the page as markdown, for pasting into an LLM or an issue.
 *
 * The dropdown also opens the raw markdown in a new tab. That view is built
 * from a Blob rather than a route so it is genuinely plain text: a reader who
 * wants the source gets the source, not a page that renders it.
 */
export default function CopyPageMenu({ page }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const markdown = () => toMarkdown(page);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard denied — the dropdown's view/download still work */ }
    setOpen(false);
  };

  const viewRaw = () => {
    const url = URL.createObjectURL(new Blob([markdown()], { type: 'text/plain;charset=utf-8' }));
    window.open(url, '_blank', 'noopener');
    // Revoke once the new tab has had a chance to read it.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setOpen(false);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${page.slug || 'page'}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-2 px-3 py-2 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {copied ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-emerald-500">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
          {copied ? 'Copied' : 'Copy page'}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="More copy options"
          aria-expanded={open}
          className="border-l border-slate-200 px-1.5 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <button type="button" onClick={copy} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
            <span className="font-medium">Copy as Markdown</span>
            <span className="block text-[11px] text-slate-400">Paste into an LLM or a ticket</span>
          </button>
          <button type="button" onClick={viewRaw} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
            <span className="font-medium">View as Markdown</span>
            <span className="block text-[11px] text-slate-400">Opens the plain source in a new tab</span>
          </button>
          <button type="button" onClick={download} className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
            <span className="font-medium">Download .md</span>
            <span className="block text-[11px] text-slate-400">Save this page to a file</span>
          </button>
        </div>
      )}
    </div>
  );
}
