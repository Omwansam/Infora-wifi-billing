import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, Send, Trash2, User, Mail, Phone, Lock, CheckCircle2, Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ticketService } from '../../services/ticketService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { STATUS_OPTIONS, PRIORITY_OPTIONS, STATUS_META, PRIORITY_META, PriorityBadge } from './ticketMeta';
import { formatDate } from '../../lib/utils';

const ctrlCls = 'rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export default function TicketDrawer({ ticketId, onClose, onChanged }) {
  const confirm = useConfirm();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const threadRef = useRef(null);

  const load = async () => {
    try {
      const t = await ticketService.getTicket(ticketId);
      setTicket(t);
    } catch (e) {
      toast.error(e.message || 'Could not load ticket');
      onClose();
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ticketId]);
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [ticket?.messages?.length]);

  const patch = async (body) => {
    try {
      const t = await ticketService.updateTicket(ticketId, body);
      setTicket(t); onChanged?.();
    } catch (e) { toast.error(e.message || 'Update failed'); }
  };

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const t = await ticketService.addMessage(ticketId, reply.trim(), internal);
      setTicket(t); setReply(''); onChanged?.();
    } catch (e) { toast.error(e.message || 'Could not send'); }
    finally { setSending(false); }
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Delete ticket', message: 'This permanently removes the ticket and its messages.', confirmLabel: 'Delete', tone: 'danger' });
    if (!ok) return;
    try {
      await ticketService.deleteTicket(ticketId);
      toast.success('Ticket deleted'); onChanged?.(); onClose();
    } catch (e) { toast.error(e.message || 'Delete failed'); }
  };

  const isClosed = ticket && ['resolved', 'closed'].includes(ticket.status);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <AnimatePresence>
        <motion.aside
          initial={{ x: 480 }} animate={{ x: 0 }} exit={{ x: 480 }} transition={{ type: 'tween', duration: 0.22 }}
          onClick={(e) => e.stopPropagation()}
          className="flex h-full w-full max-w-xl flex-col bg-slate-50 shadow-2xl dark:bg-slate-950"
        >
          {loading || !ticket ? (
            <div className="flex flex-1 items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              {/* Header */}
              <div className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <Hash className="h-3.5 w-3.5" /> <span className="font-mono">{ticket.id}</span>
                      <span>· {formatDate(ticket.createdAt)}</span>
                    </div>
                    <h2 className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-slate-100">{ticket.subject}</h2>
                  </div>
                  <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
                </div>

                {/* Customer + controls */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5 font-medium"><User className="h-4 w-4 text-slate-400" />{ticket.customerName}</span>
                  {ticket.customerEmail && <span className="inline-flex items-center gap-1.5 text-slate-500"><Mail className="h-3.5 w-3.5" />{ticket.customerEmail}</span>}
                  {ticket.customerPhone && <span className="inline-flex items-center gap-1.5 text-slate-500"><Phone className="h-3.5 w-3.5" />{ticket.customerPhone}</span>}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status</label>
                  <select value={ticket.status} onChange={(e) => patch({ status: e.target.value })} className={ctrlCls}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                  <label className="ml-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Priority</label>
                  <select value={ticket.priority} onChange={(e) => patch({ priority: e.target.value })} className={ctrlCls}>
                    {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
                  </select>
                  <span className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium capitalize text-slate-500 dark:bg-slate-800 dark:text-slate-400">{ticket.category}</span>
                </div>
              </div>

              {/* Thread */}
              <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
                {(ticket.messages || []).map((m) => (
                  <div key={m.id} className={`rounded-xl border p-3 ${m.is_internal
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                    : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
                      {m.is_internal && <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400"><Lock className="h-3 w-3" />Internal note</span>}
                      <span className="ml-auto">{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{m.message}</p>
                  </div>
                ))}
                {ticket.messages?.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No messages yet.</p>}
              </div>

              {/* Reply + actions */}
              <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                <textarea
                  value={reply} onChange={(e) => setReply(e.target.value)} rows={3}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send(); }}
                  placeholder={internal ? 'Internal note (not shown to the customer)…' : 'Write a reply…  (⌘/Ctrl+Enter to send)'}
                  className={`w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 ${internal
                    ? 'border-amber-300 focus:border-amber-400 dark:border-amber-500/40 dark:bg-slate-900'
                    : 'border-slate-300 focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900'} dark:text-slate-100`}
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                      <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600" />
                      Internal note
                    </label>
                    <button onClick={remove} className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" />Delete</button>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isClosed && (
                      <button onClick={() => patch({ status: 'resolved' })} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-500/10">
                        <CheckCircle2 className="h-3.5 w-3.5" />Resolve
                      </button>
                    )}
                    <button onClick={send} disabled={sending || !reply.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                      {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.aside>
      </AnimatePresence>
    </div>
  );
}
