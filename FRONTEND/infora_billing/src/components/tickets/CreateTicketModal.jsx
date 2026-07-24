import React, { useEffect, useRef, useState } from 'react';
import { X, Search, Loader2, User, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { customerService } from '../../services/customerService';
import { ticketService } from '../../services/ticketService';
import { PRIORITY_OPTIONS, PRIORITY_META } from './ticketMeta';

const CATEGORIES = ['general', 'billing', 'connectivity', 'installation', 'hardware', 'account'];
const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export default function CreateTicketModal({ onClose, onCreated }) {
  const [customer, setCustomer] = useState(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('general');
  const [saving, setSaving] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    if (customer || !q.trim()) { setResults([]); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await customerService.getCustomers({ search: q.trim(), per_page: 8 });
        setResults(res?.data?.customers || res?.customers || res?.data || []);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q, customer]);

  const submit = async () => {
    if (!customer) return toast.error('Pick a customer');
    if (!subject.trim() || !description.trim()) return toast.error('Subject and description are required');
    setSaving(true);
    try {
      const ticket = await ticketService.createTicket({
        customer_id: customer.id, subject: subject.trim(), description: description.trim(), priority, category,
      });
      toast.success('Ticket created');
      onCreated?.(ticket);
      onClose();
    } catch (e) {
      toast.error(e.message || 'Could not create ticket');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl dark:bg-slate-900 dark:border dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">New support ticket</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Customer picker */}
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer</label>
            {customer ? (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
                <span className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                  <User className="h-4 w-4 text-slate-400" /> {customer.name || customer.full_name}
                  <span className="text-slate-400">· {customer.email || customer.phone}</span>
                </span>
                <button onClick={() => { setCustomer(null); setQ(''); }} className="text-xs font-medium text-blue-600 hover:underline">Change</button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email or phone" className={`${inputCls} pl-9`} />
                {(searching || results.length > 0) && (
                  <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                    {searching && <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</div>}
                    {results.map((c) => (
                      <button key={c.id} onClick={() => { setCustomer(c); setResults([]); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="text-slate-800 dark:text-slate-200">{c.name || c.full_name}</span>
                        <span className="ml-auto text-xs text-slate-400">{c.email || c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of the issue" className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What is happening? Steps, error, when it started…" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create ticket
          </button>
        </div>
      </div>
    </div>
  );
}
