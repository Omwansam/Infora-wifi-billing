import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Search, SearchX, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { SETTINGS_GROUPS, findItem, resolveTab, searchItems } from './nav';
import { DetailHeader } from './ui';
import { ChromeContext } from './chrome';

import GeneralSettings from './tabs/GeneralSettings';
import DomainSettings from './tabs/DomainSettings';
import ModulesSettings from './tabs/ModulesSettings';
import PppoeSettings from './tabs/PppoeSettings';
import HotspotSettings from './tabs/HotspotSettings';
import RadiusSettings from './tabs/RadiusSettings';
import PaymentsSettings from './tabs/PaymentsSettings';
import IntegrationsSettings from './tabs/IntegrationsSettings';
import WhatsAppSettings from './tabs/WhatsAppSettings';
import EmailSettings from './tabs/EmailSettings';
import CommunicationsSettings from './tabs/CommunicationsSettings';
import NotificationsSettings from './tabs/NotificationsSettings';
import LoyaltySettings from './tabs/LoyaltySettings';
import OperatorAlertsSettings from './tabs/OperatorAlertsSettings';
import AiAssistantSettings from './tabs/AiAssistantSettings';
import DeveloperSettings from './tabs/DeveloperSettings';
import AccountSettings from './tabs/AccountSettings';
import SubscriptionSettings from './tabs/SubscriptionSettings';

/* -------------------------------------------------------------------------
 * Settings.
 *
 * Twenty-odd panels do not fit in a row of pills, and the old tab strip had
 * stopped saying anything about how the settings relate to each other. This is
 * a rail instead: grouped, searchable, one panel at a time, with a header that
 * states what the panel is for before the first control appears.
 *
 * The active panel lives in `?tab=` so Overview's setup checklist and any
 * bookmark can land on an exact panel. Renamed ids are resolved in nav.js
 * rather than broken.
 * ---------------------------------------------------------------------- */

function panelFor(id, { admin, go }) {
  switch (id) {
    case 'branding': return <GeneralSettings section="branding" />;
    case 'domain': return <DomainSettings />;
    case 'modules': return <ModulesSettings isAdmin={admin} />;
    case 'pppoe': return <PppoeSettings isAdmin={admin} onNavigate={go} />;
    case 'hotspot': return <HotspotSettings isAdmin={admin} />;
    case 'radius': return <RadiusSettings />;
    case 'payments': return <PaymentsSettings />;
    case 'sms': return <CommunicationsSettings />;
    case 'email': return <EmailSettings />;
    case 'whatsapp': return <WhatsAppSettings />;
    case 'templates': return <NotificationsSettings exclude={['router_health']} />;
    case 'loyalty': return <LoyaltySettings />;
    case 'alerts': return <OperatorAlertsSettings />;
    case 'ai': return <AiAssistantSettings />;
    case 'developer': return <DeveloperSettings />;
    case 'integrations': return <IntegrationsSettings onNavigate={go} />;
    case 'profile': return <AccountSettings section="profile" />;
    case 'security': return <AccountSettings section="security" />;
    case 'subscription': return <SubscriptionSettings />;
    default: return <GeneralSettings section="branding" />;
  }
}

/** One row in the rail. The active background is shared via layoutId so it
 *  slides between entries instead of blinking on and off. */
function NavItem({ item, active, onSelect, railId }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={active ? 'page' : undefined}
      className="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
    >
      {active && (
        <motion.span
          layoutId={`${railId}-active`}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
          className="absolute inset-0 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
        />
      )}
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
          active
            ? 'bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300'
            : 'bg-slate-100 text-slate-500 dark:bg-slate-800/70 dark:text-slate-400'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span
          className={`block truncate text-sm font-semibold ${
            active
              ? 'text-slate-900 dark:text-slate-100'
              : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {item.name}
        </span>
        <span className="block truncate text-xs text-slate-400 dark:text-slate-500">{item.sub}</span>
      </span>
    </button>
  );
}

function SearchBox({ value, onChange, inputRef }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Find a setting…"
        aria-label="Find a setting"
        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** The rail body: grouped when idle, one flat result list while searching. */
function NavBody({ query, active, onSelect, railId }) {
  const results = useMemo(() => searchItems(query), [query]);

  if (results) {
    if (!results.length) {
      return (
        <div className="px-3 py-10 text-center">
          <SearchX className="mx-auto h-6 w-6 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
            Nothing matches “{query}”.
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-0.5">
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
          {results.length} result{results.length === 1 ? '' : 's'}
        </p>
        {results.map((item) => (
          <NavItem key={item.id} item={item} active={item.id === active} onSelect={onSelect} railId={railId} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {SETTINGS_GROUPS.map((group) => (
        <div key={group.label} className="space-y-0.5">
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            {group.label}
          </p>
          {group.items.map((item) => (
            <NavItem key={item.id} item={item} active={item.id === active} onSelect={onSelect} railId={railId} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** "Your <accent>." — the accent word is coloured, the rest is not. */
function PageHeading({ item }) {
  const [before, after = ''] = item.title.split(item.accent);
  return (
    <header className="mb-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
        Settings
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        {before}
        <span className="text-emerald-600 dark:text-emerald-400">{item.accent}</span>
        {after}.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {item.lead}
      </p>
      <div className="mt-7 border-t border-slate-200 dark:border-slate-800" />
    </header>
  );
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const active = useMemo(() => resolveTab(searchParams.get('tab')), [searchParams]);
  const item = useMemo(() => findItem(active), [active]);

  const [query, setQuery] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [chrome, setChromeState] = useState(null);
  const searchRef = useRef(null);
  const mainRef = useRef(null);

  const { isAdmin } = useAuth();
  const admin = typeof isAdmin === 'function' ? isAdmin() : false;

  const go = useCallback(
    (id) => {
      if (!id) return;
      const next = resolveTab(id);
      setSearchParams({ tab: next }, { replace: true });
      setMobileNavOpen(false);
      setQuery('');
    },
    [setSearchParams],
  );

  // The panel pane is its own scroll container now, so switching panels resets
  // *it* rather than the window — otherwise you land halfway down a new panel
  // after scrolling to the bottom of the last one.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [active]);

  /* Chrome is tagged with the tab that set it, and only rendered while that tab
     is still the active one.
     Clearing it from an effect here does not work: child effects run before
     parent effects, so a panel that claims the header during its own mount
     would have the claim wiped immediately afterwards — which is exactly what
     happened to a deep link straight into a WhatsApp provider. Tagging is
     ordering-independent, so stale chrome is ignored rather than raced. */
  const activeRef = useRef(active);
  activeRef.current = active;
  const setChrome = useCallback(
    (next) => setChromeState(next ? { ...next, tab: activeRef.current } : null),
    [],
  );
  const chromeValue = useMemo(() => ({ setChrome }), [setChrome]);

  // ⌘K / Ctrl-K focuses the rail search, which is where anyone who cannot find
  // a setting is going to reach first.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMobileNavOpen(true);
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    /* Locked to the viewport: the header above is sticky and 60px + 1px of
       border tall, so this fills exactly what is left. `overflow-hidden` stops
       the window scrolling at all — the rail and the panel each own their own
       scrollbar, which is what keeps the rail in place while a long panel like
       Message templates runs past the fold. */
    <div className="flex h-[calc(100dvh-61px)] overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* --- Rail (desktop) --- */}
      <aside className="hidden w-[19rem] shrink-0 flex-col border-r border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/40 lg:flex">
        <div className="shrink-0 px-4 pb-3 pt-4">
          <SearchBox value={query} onChange={setQuery} inputRef={searchRef} />
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          <NavBody query={query} active={active} onSelect={go} railId="rail-desktop" />
        </nav>
      </aside>

      {/* --- Panel pane: the only part that scrolls --- */}
      <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          {/* --- Rail (mobile): a disclosure above the panel --- */}
          <div className="mb-6 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-expanded={mobileNavOpen}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300">
                <item.icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.name}
                </span>
                <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                  {item.sub}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                  mobileNavOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {mobileNavOpen && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                <SearchBox value={query} onChange={setQuery} />
                <nav className="mt-4 max-h-[55vh] overflow-y-auto">
                  <NavBody query={query} active={active} onSelect={go} railId="rail-mobile" />
                </nav>
              </div>
            )}
          </div>

          <ChromeContext.Provider value={chromeValue}>
            {chrome && chrome.tab === active ? (
              <DetailHeader {...chrome} />
            ) : (
              <PageHeading item={item} />
            )}
            {panelFor(active, { admin, go })}
          </ChromeContext.Provider>
        </div>
      </main>
    </div>
  );
}
