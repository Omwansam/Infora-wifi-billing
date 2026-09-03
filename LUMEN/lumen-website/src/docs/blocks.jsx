import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Pages are arrays of typed blocks rather than MDX or HTML strings.
 *
 * One source of truth then drives four things that would otherwise drift apart:
 * the rendered page, the "Copy page" markdown, the on-this-page table of
 * contents, and the search index. Adding MDX would mean a build plugin and a
 * runtime parser to get the same result, and neither serializes cleanly back to
 * markdown — which is the whole point of the copy button.
 */

/** GitHub-style heading id, so anchors survive a title edit predictably. */
export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

// Inline markdown: **bold**, `code`, and [label](href). Deliberately tiny —
// this is the subset worth authoring in, and each token maps to one element.
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

export function Inline({ text }) {
  if (!text) return null;
  const parts = String(text).split(INLINE).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900 dark:text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-violet-700 dark:border-slate-700 dark:bg-slate-800 dark:text-violet-300">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      const cls = 'font-medium text-violet-600 underline decoration-violet-300 underline-offset-2 hover:text-violet-700 dark:text-violet-400 dark:decoration-violet-700 dark:hover:text-violet-300';
      // Router links for in-app paths, a real anchor for anything external.
      return href.startsWith('/')
        ? <Link key={i} to={href} className={cls}>{label}</Link>
        : <a key={i} href={href} target="_blank" rel="noreferrer" className={cls}>{label}</a>;
    }
    return <span key={i}>{part}</span>;
  });
}

/* ---------------------------------------------------------------- code ---- */

// A deliberately language-agnostic pass: comments, strings and numbers only.
// It lifts a wall of monospace without pulling in a highlighter, and because it
// never guesses at keywords it cannot mis-colour a language it does not know.
function highlight(code) {
  const out = [];
  const pattern = /(#[^\n]*|\/\/[^\n]*)|('[^'\n]*'|"[^"\n]*")|(\b\d+(?:\.\d+)?\b)/g;
  let last = 0;
  let match;
  while ((match = pattern.exec(code)) !== null) {
    if (match.index > last) out.push({ text: code.slice(last, match.index) });
    const kind = match[1] ? 'comment' : match[2] ? 'string' : 'number';
    out.push({ text: match[0], kind });
    last = match.index + match[0].length;
  }
  if (last < code.length) out.push({ text: code.slice(last) });
  return out;
}

const TOKEN_CLS = {
  comment: 'text-slate-500 italic',
  string: 'text-emerald-300',
  number: 'text-amber-300',
};

function CodeBlock({ block }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked — the text is selectable anyway */ }
  };
  return (
    <figure className="group not-prose my-6 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
      <figcaption className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-400">
          {block.title || block.lang || 'text'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed"><code className="font-mono text-slate-200">
        {highlight(block.code).map((token, i) => (
          <span key={i} className={token.kind ? TOKEN_CLS[token.kind] : undefined}>{token.text}</span>
        ))}
      </code></pre>
    </figure>
  );
}

/* ------------------------------------------------------------ callouts ---- */

const CALLOUTS = {
  note: { ring: 'border-sky-200 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10', dot: 'text-sky-600 dark:text-sky-400', label: 'Note' },
  tip: { ring: 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10', dot: 'text-emerald-600 dark:text-emerald-400', label: 'Tip' },
  warning: { ring: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10', dot: 'text-amber-600 dark:text-amber-400', label: 'Warning' },
  danger: { ring: 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10', dot: 'text-rose-600 dark:text-rose-400', label: 'Careful' },
};

const CALLOUT_ICON = {
  note: 'M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  tip: 'M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z',
  warning: 'M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z',
  danger: 'M12 9v4m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z',
};

function Callout({ block }) {
  const style = CALLOUTS[block.kind] || CALLOUTS.note;
  return (
    <div className={`not-prose my-6 flex gap-3 rounded-xl border p-4 ${style.ring}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`mt-0.5 h-5 w-5 shrink-0 ${style.dot}`}>
        <path d={CALLOUT_ICON[block.kind] || CALLOUT_ICON.note} />
      </svg>
      <div className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        <p className="mb-0.5 font-semibold text-slate-900 dark:text-white">{block.title || style.label}</p>
        <Inline text={block.text} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- cards ---- */

const CARD_ICONS = {
  rocket: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  router: 'M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01',
  card: 'M2 5h20v14H2zM2 10h20',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  book: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 016.5 22H20V2H6.5A2.5 2.5 0 004 4.5z',
  chart: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  wrench: 'M14.7 6.3a4 4 0 01-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 015.4-5.4l-2.6 2.6-1.4-1.4z',
};

function Cards({ block }) {
  return (
    <div className={`not-prose my-6 grid gap-4 ${block.cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
      {block.items.map((item) => {
        const inner = (
          <>
            {item.icon && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-violet-600 dark:text-violet-400">
                <path d={CARD_ICONS[item.icon] || CARD_ICONS.book} />
              </svg>
            )}
            <p className="mt-3 text-[15px] font-semibold text-slate-900 dark:text-white">{item.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400"><Inline text={item.text} /></p>
          </>
        );
        const cls = 'block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-violet-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-500/50';
        return item.to
          ? <Link key={item.title} to={item.to} className={cls}>{inner}</Link>
          : <div key={item.title} className={cls}>{inner}</div>;
      })}
    </div>
  );
}

/* --------------------------------------------------------------- steps ---- */

function Steps({ block }) {
  return (
    <ol className="not-prose my-6 space-y-0">
      {block.items.map((item, i) => (
        <li key={item.title} className="relative flex gap-4 pb-6 last:pb-0">
          {i < block.items.length - 1 && (
            <span aria-hidden className="absolute left-[15px] top-9 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />
          )}
          <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-[13px] font-bold text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/15 dark:text-violet-300">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[15px] font-semibold text-slate-900 dark:text-white">{item.title}</p>
            {item.text && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400"><Inline text={item.text} /></p>
            )}
            {item.code && <CodeBlock block={{ code: item.code, lang: item.lang }} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* --------------------------------------------------------------- table ---- */

function TableBlock({ block }) {
  return (
    <div className="not-prose my-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900">
          <tr>
            {block.head.map((cell) => (
              <th key={cell} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {block.rows.map((row, i) => (
            <tr key={i} className="bg-white dark:bg-slate-950/40">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top text-slate-700 dark:text-slate-300">
                  <Inline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------- fields ---- */

function Fields({ block }) {
  return (
    <dl className="not-prose my-6 divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
      {block.items.map((item) => (
        <div key={item.name} className="p-4">
          <dt className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{item.name}</code>
            {item.type && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">{item.type}</span>}
            {item.required && <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">required</span>}
          </dt>
          <dd className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400"><Inline text={item.text} /></dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------ renderer ---- */

export function Block({ block }) {
  switch (block.t) {
    case 'h2':
      return (
        <h2 id={slugify(block.text)} className="group mt-12 scroll-mt-24 text-2xl font-bold tracking-tight text-slate-900 first:mt-0 dark:text-white">
          <a href={`#${slugify(block.text)}`} className="no-underline">
            {block.text}
            <span className="ml-2 text-violet-400 opacity-0 transition group-hover:opacity-100" aria-hidden>#</span>
          </a>
        </h2>
      );
    case 'h3':
      return (
        <h3 id={slugify(block.text)} className="mt-8 scroll-mt-24 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
          {block.text}
        </h3>
      );
    case 'p':
      return <p className="mt-4 leading-[1.75] text-slate-600 dark:text-slate-400"><Inline text={block.text} /></p>;
    case 'ul':
      return (
        <ul className="mt-4 space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-[1.75] text-slate-600 dark:text-slate-400">
              <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
              <span><Inline text={item} /></span>
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="mt-4 space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 leading-[1.75] text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-violet-600 dark:text-violet-400">{i + 1}.</span>
              <span><Inline text={item} /></span>
            </li>
          ))}
        </ol>
      );
    case 'code': return <CodeBlock block={block} />;
    case 'callout': return <Callout block={block} />;
    case 'cards': return <Cards block={block} />;
    case 'steps': return <Steps block={block} />;
    case 'table': return <TableBlock block={block} />;
    case 'fields': return <Fields block={block} />;
    case 'divider': return <hr className="my-10 border-slate-200 dark:border-slate-800" />;
    default: return null;
  }
}

/* --------------------------------------------------- derived views -------- */

/** Headings for the on-this-page rail. */
export function tableOfContents(blocks = []) {
  return blocks
    .filter((b) => b.t === 'h2' || b.t === 'h3')
    .map((b) => ({ id: slugify(b.text), text: b.text, depth: b.t === 'h3' ? 3 : 2 }));
}

/** Flattened prose, for the search index. */
export function plainText(blocks = []) {
  const strip = (s) => String(s || '').replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return blocks.flatMap((b) => {
    switch (b.t) {
      case 'h2': case 'h3': case 'p': return [strip(b.text)];
      case 'ul': case 'ol': return b.items.map(strip);
      case 'callout': return [strip(b.title), strip(b.text)];
      case 'cards': return b.items.flatMap((i) => [i.title, strip(i.text)]);
      case 'steps': return b.items.flatMap((i) => [i.title, strip(i.text)]);
      case 'table': return [...b.head, ...b.rows.flat().map(strip)];
      case 'fields': return b.items.flatMap((i) => [i.name, strip(i.text)]);
      default: return [];
    }
  }).filter(Boolean);
}

/**
 * The page as markdown — what the Copy page button puts on the clipboard.
 * Inline syntax is already markdown, so most blocks pass through untouched.
 */
export function toMarkdown(page) {
  const lines = [`# ${page.title}`, ''];
  if (page.description) lines.push(page.description, '');
  for (const b of page.blocks || []) {
    switch (b.t) {
      case 'h2': lines.push(`## ${b.text}`, ''); break;
      case 'h3': lines.push(`### ${b.text}`, ''); break;
      case 'p': lines.push(b.text, ''); break;
      case 'ul': lines.push(...b.items.map((i) => `- ${i}`), ''); break;
      case 'ol': lines.push(...b.items.map((i, n) => `${n + 1}. ${i}`), ''); break;
      case 'code': lines.push('```' + (b.lang || ''), b.code, '```', ''); break;
      case 'callout': lines.push(`> **${b.title || (CALLOUTS[b.kind] || CALLOUTS.note).label}** — ${b.text}`, ''); break;
      case 'cards': lines.push(...b.items.map((i) => `- **${i.title}** — ${i.text}`), ''); break;
      case 'steps':
        b.items.forEach((i, n) => {
          lines.push(`${n + 1}. **${i.title}**${i.text ? ` — ${i.text}` : ''}`);
          if (i.code) lines.push('', '   ```' + (i.lang || ''), ...i.code.split('\n').map((l) => `   ${l}`), '   ```');
        });
        lines.push('');
        break;
      case 'table':
        lines.push(`| ${b.head.join(' | ')} |`, `| ${b.head.map(() => '---').join(' | ')} |`);
        lines.push(...b.rows.map((r) => `| ${r.join(' | ')} |`), '');
        break;
      case 'fields': lines.push(...b.items.map((i) => `- \`${i.name}\`${i.type ? ` (${i.type})` : ''} — ${i.text}`), ''); break;
      case 'divider': lines.push('---', ''); break;
      default: break;
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
