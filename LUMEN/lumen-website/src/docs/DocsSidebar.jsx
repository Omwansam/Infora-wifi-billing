import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV, PARENT_OF } from './nav';

const itemCls = ({ isActive }) =>
  `block rounded-lg px-3 py-[7px] text-[13.5px] transition ${
    isActive
      ? 'bg-violet-50 font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
  }`;

function Item({ item, currentSlug, onNavigate }) {
  // A parent opens when it is the current page or holds it, and stays open once
  // the reader opens it by hand.
  const holdsCurrent = PARENT_OF[currentSlug] === item.slug;
  const [open, setOpen] = useState(holdsCurrent || currentSlug === item.slug);
  useEffect(() => {
    if (holdsCurrent) setOpen(true);
  }, [holdsCurrent]);

  if (!item.children) {
    return (
      <li>
        <NavLink to={`/docs/${item.slug}`} className={itemCls} onClick={onNavigate}>
          {item.title}
        </NavLink>
      </li>
    );
  }

  return (
    <li>
      <div className="flex items-center gap-1">
        <NavLink to={`/docs/${item.slug}`} className={({ isActive }) => `flex-1 ${itemCls({ isActive })}`} onClick={onNavigate}>
          {item.title}
        </NavLink>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? `Collapse ${item.title}` : `Expand ${item.title}`}
          aria-expanded={open}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
               className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
      {open && (
        <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-slate-200 pl-2 dark:border-slate-800">
          {item.children.map((child) => (
            <li key={child.slug}>
              <NavLink to={`/docs/${child.slug}`} className={itemCls} onClick={onNavigate}>
                {child.title}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function DocsSidebar({ currentSlug, onNavigate }) {
  return (
    <nav aria-label="Documentation" className="pb-16">
      {NAV.map((section) => (
        <div key={section.group} className="mb-6">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
            {section.group}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <Item key={item.slug} item={item} currentSlug={currentSlug} onNavigate={onNavigate} />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
