import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, ChevronDown, Loader2, MessageSquarePlus, Send, Sparkles, Trash2, X,
} from 'lucide-react';
import { getAccessToken } from '../../utils/authToken';
import settingsService from '../../services/settingsService';
import { BRAND } from '../../lib/brand';

/* -------------------------------------------------------------------------
 * The network copilot.
 *
 * A right-hand drawer over /api/settings/ai/ask. The backend already resolves
 * which provider and key answer (the tenant's own or the platform's) and hands
 * the model a snapshot of this operator's figures, so this component only has
 * to own the conversation.
 *
 * Threads live in localStorage, not on the server. That is a deliberate v1
 * limit with a real consequence — history does not follow you to another
 * machine — and it is said out loud in the History menu rather than left for
 * someone to discover when they switch laptops. Moving it server-side is a
 * table and two routes whenever that trade stops being worth it.
 *
 * The panel is rendered whatever the AI settings say. When the assistant is
 * off or unconfigured it explains which, and links to the panel that fixes it;
 * hiding the button instead would make "where did the assistant go" a support
 * question.
 * ---------------------------------------------------------------------- */

const STORE_KEY = 'lumen-copilot-threads';
const MAX_THREADS = 20;
// The API is given the last 10 turns; keeping the same ceiling here means the
// transcript on screen is the transcript the model saw.
const HISTORY_TURNS = 10;

const SUGGESTIONS = [
  'How many subscribers are past expiry?',
  'How much did we collect this week?',
  'Which routers are offline right now?',
  'How do I issue a hotspot voucher?',
];

function loadThreads() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];   // private mode, cleared storage, or a shape we no longer read
  }
}

function saveThreads(threads) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(threads.slice(0, MAX_THREADS)));
  } catch {
    /* storage unavailable — the thread still works for this session */
  }
}

function threadTitle(messages) {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New chat';
  return first.content.length > 48 ? `${first.content.slice(0, 48)}…` : first.content;
}

function Bubble({ message }) {
  const mine = message.role === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          mine
            ? 'bg-emerald-600 text-white'
            : message.error
              ? 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200'
              : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.meta && (
          <p className="mt-1.5 text-[11px] opacity-60">{message.meta}</p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPick }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
        <Sparkles className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-lg font-bold tracking-tight text-slate-900 dark:text-white">
        Your network{' '}
        <span className="italic text-emerald-600 dark:text-emerald-400">copilot</span>
      </h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Ask about subscribers, revenue, MikroTik issues, or how to use {BRAND.name}.
      </p>
      <div className="mt-5 w-full max-w-xs space-y-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function Unavailable({ reason }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">
        <Sparkles className="h-6 w-6" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
        The assistant is not ready
      </h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {reason}
      </p>
      <Link
        to="/settings?tab=ai"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
      >
        Open AI settings
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

export default function CopilotPanel({ open, onClose }) {
  const [threads, setThreads] = useState(loadThreads);
  // Resume the most recent chat rather than opening blank. Reopening the panel
  // is usually "carry on with what I just asked"; starting fresh is one click
  // on New, whereas recovering a conversation you just lost is not.
  const [activeId, setActiveId] = useState(() => loadThreads()[0]?.id ?? null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ loading: true, ready: false, reason: '' });
  const [historyOpen, setHistoryOpen] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) || null,
    [threads, activeId],
  );
  const messages = active?.messages || [];

  // Check readiness each time the drawer opens — an operator who just saved a
  // key expects it to work without a page reload.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setStatus((s) => ({ ...s, loading: true }));
      try {
        const res = await settingsService.getAi(getAccessToken());
        if (cancelled) return;
        setStatus({
          loading: false,
          ready: Boolean(res.ready && res.enabled),
          reason: !res.enabled
            ? 'It is switched off in Settings.'
            : res.reason || 'No provider is configured yet.',
        });
      } catch (e) {
        if (!cancelled) {
          setStatus({ loading: false, ready: false, reason: e.message || 'Could not reach the server.' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 220);
  }, [open, activeId]);

  // Pin to the newest message as the conversation grows.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && open) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const persist = useCallback((next) => {
    setThreads(next);
    saveThreads(next);
  }, []);

  const startNew = () => {
    setActiveId(null);
    setDraft('');
    setHistoryOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const send = async (text) => {
    const question = (text ?? draft).trim();
    if (!question || sending) return;

    const now = Date.now();
    const id = active?.id || `t${now}`;
    const priorMessages = active?.messages || [];
    const withUser = [...priorMessages, { role: 'user', content: question }];

    // Show the question immediately; the answer lands when it lands.
    const optimistic = threads.some((t) => t.id === id)
      ? threads.map((t) => (t.id === id ? { ...t, messages: withUser, updated: now } : t))
      : [{ id, messages: withUser, updated: now }, ...threads];
    persist(optimistic);
    setActiveId(id);
    setDraft('');
    setSending(true);

    try {
      const res = await settingsService.askAi(getAccessToken(), {
        question,
        // Only completed exchanges are context; the pending question is sent
        // separately, so echoing it here would duplicate it for the model.
        history: priorMessages
          .filter((m) => !m.error)
          .slice(-HISTORY_TURNS)
          .map(({ role, content }) => ({ role, content })),
      });
      const answered = [...withUser, {
        role: 'assistant', content: res.answer,
        meta: `${res.model} · ${res.source === 'tenant' ? 'your key' : 'platform key'}`,
      }];
      persist(threads.some((t) => t.id === id)
        ? optimistic.map((t) => (t.id === id ? { ...t, messages: answered, updated: Date.now() } : t))
        : [{ id, messages: answered, updated: Date.now() }, ...threads]);
    } catch (e) {
      const failed = [...withUser, {
        role: 'assistant', error: true,
        content: e.message || 'The assistant could not answer that.',
      }];
      persist(optimistic.map((t) => (t.id === id ? { ...t, messages: failed } : t)));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    // Enter sends, Shift+Enter is a newline — the convention every chat uses.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-label="Network copilot"
            className="fixed right-0 top-0 z-[61] flex h-[100dvh] w-full max-w-[26rem] flex-col border-l border-slate-200 bg-slate-50 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40 }}
          >
            {/* --- header --- */}
            <header className="relative shrink-0 overflow-hidden border-b border-slate-200 bg-white px-5 pb-4 pt-5 dark:border-slate-800 dark:bg-slate-900">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl"
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
                    — Network copilot
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                      <Sparkles className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                        Assistant
                      </h2>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        Billing, routers, and how-to
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close copilot"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative mt-4 flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((h) => !h)}
                    aria-expanded={historyOpen}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    History
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {historyOpen && (
                    <div className="absolute left-0 top-full z-10 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      {threads.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                          No past chats yet.
                        </p>
                      ) : (
                        <div className="max-h-72 overflow-y-auto">
                          {threads.map((t) => (
                            <div
                              key={t.id}
                              className={`flex items-center gap-2 border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                                t.id === activeId ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : ''
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => { setActiveId(t.id); setHistoryOpen(false); }}
                                className="min-w-0 flex-1 px-3.5 py-2.5 text-left"
                              >
                                <span className="block truncate text-sm text-slate-700 dark:text-slate-200">
                                  {threadTitle(t.messages)}
                                </span>
                                <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                                  {new Date(t.updated).toLocaleString()}
                                </span>
                              </button>
                              <button
                                type="button"
                                aria-label="Delete chat"
                                onClick={() => {
                                  const next = threads.filter((x) => x.id !== t.id);
                                  persist(next);
                                  if (t.id === activeId) setActiveId(null);
                                }}
                                className="mr-2 rounded-md p-1.5 text-slate-300 transition hover:text-rose-600 dark:text-slate-600 dark:hover:text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="border-t border-slate-100 px-3.5 py-2 text-[11px] leading-relaxed text-slate-400 dark:border-slate-800 dark:text-slate-500">
                        Chats are kept in this browser only — they will not follow you to another
                        device.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={startNew}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  New
                </button>
              </div>
            </header>

            {/* --- body --- */}
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
              {status.loading ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !status.ready ? (
                <Unavailable reason={status.reason} />
              ) : messages.length === 0 ? (
                <EmptyState onPick={(s) => send(s)} />
              ) : (
                <div className="space-y-3 px-4 py-5">
                  {messages.map((m, i) => <Bubble key={i} message={m} />)}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Thinking…
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* --- composer --- */}
            {status.ready && (
              <div className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-950">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Ask about your network…"
                    className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => send()}
                    disabled={!draft.trim() || sending}
                    aria-label="Send"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-2 px-1 text-[11px] text-slate-400 dark:text-slate-500">
                  It reads a summary of your figures — it cannot change anything in the account.
                </p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
