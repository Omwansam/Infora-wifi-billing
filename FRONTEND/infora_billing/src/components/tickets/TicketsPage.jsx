import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Plus, MessageSquare, AlertCircle, Clock, TrendingUp, Loader2,
  ChevronRight, Inbox, RefreshCw,
} from 'lucide-react';
import { ticketService } from '../../services/ticketService';
import { formatDate } from '../../lib/utils';
import { StatusBadge, PriorityBadge, STATUS_META, PRIORITY_META, STATUS_OPTIONS, PRIORITY_OPTIONS } from './ticketMeta';
import CreateTicketModal from './CreateTicketModal';
import TicketDrawer from './TicketDrawer';

function StatCard({ label, value, icon: Icon, tone }) {
  const tones = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-300',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-300',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300',
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
    </div>
  );
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, pending: 0, resolution_rate: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [priority, setPriority] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const debounce = useRef(null);

  const loadStats = useCallback(() => {
    ticketService.getStats().then(setStats).catch(() => {});
  }, []);

  const loadTickets = useCallback(() => {
    setLoading(true);
    const params = { per_page: 100 };
    if (search.trim()) params.search = search.trim();
    if (status !== 'all') params.status = status;
    if (priority !== 'all') params.priority = priority;
    ticketService.getTickets(params)
      .then((d) => setTickets(d.tickets || []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, [search, status, priority]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(loadTickets, search ? 300 : 0);
    return () => clearTimeout(debounce.current);
  }, [loadTickets, search]);

  const refresh = () => { loadTickets(); loadStats(); };

  const selectCls = 'rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Support tickets</h1>
            <p className="mt-1 text-sm text-slate-500">Track and resolve customer issues in one thread.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="rounded-lg border border-slate-200 p-2.5 text-slate-500 hover:bg-white dark:border-slate-800 dark:hover:bg-slate-900" title="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm">
              <Plus className="h-4 w-4" />New ticket
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total tickets" value={stats.total} icon={MessageSquare} tone="blue" />
          <StatCard label="Open" value={stats.open} icon={AlertCircle} tone="rose" />
          <StatCard label="Pending / in progress" value={stats.pending} icon={Clock} tone="amber" />
          <StatCard label="Resolution rate" value={`${stats.resolution_rate ?? 0}%`} icon={TrendingUp} tone="emerald" />
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by number, subject or customer…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
            <option value="all">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Loading tickets…</div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Inbox className="h-8 w-8 text-slate-300" />
              <p className="font-medium text-slate-700 dark:text-slate-200">No tickets found</p>
              <p className="text-sm text-slate-400">{search || status !== 'all' || priority !== 'all' ? 'Try clearing the filters.' : 'Create the first ticket to get started.'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {tickets.map((t) => (
                <li key={t.ticket_id}>
                  <button onClick={() => setActiveId(t.ticket_id)} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${(PRIORITY_META[t.priority] || PRIORITY_META.medium).dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-slate-900 dark:text-slate-100">{t.subject}</span>
                        <span className="font-mono text-[11px] text-slate-400">{t.id}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span className="truncate">{t.customerName}</span>
                        <span className="text-slate-300">·</span>
                        <span className="capitalize">{t.category}</span>
                        {t.messageCount > 0 && (<><span className="text-slate-300">·</span><span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t.messageCount}</span></>)}
                      </div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      <PriorityBadge priority={t.priority} />
                      <StatusBadge status={t.status} />
                    </div>
                    <span className="hidden shrink-0 text-xs text-slate-400 md:block">{formatDate(t.createdAt)}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {!loading && tickets.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">Showing {tickets.length} ticket{tickets.length === 1 ? '' : 's'}.</p>
        )}
      </div>

      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={refresh} />}
      {activeId && <TicketDrawer ticketId={activeId} onClose={() => setActiveId(null)} onChanged={refresh} />}
    </div>
  );
}
