import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bug, Lightbulb, Send, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { supportService } from '../../services/supportService';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const STATUS_BADGE = {
  open: 'bg-amber-50 text-amber-800 ring-amber-600/15 dark:bg-amber-950/30 dark:text-amber-300',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-950/30 dark:text-blue-300',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/30 dark:text-emerald-300',
  closed: 'bg-slate-100 text-slate-500 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-400',
};
const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };

export default function BugReportPage() {
  const [form, setForm] = useState({ type: 'bug', subject: '', priority: 'medium', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await supportService.listRequests({ per_page: 50 });
      if (result.success) setRequests(result.data?.requests || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const myReports = useMemo(() => requests.filter((r) => r.type === 'bug' || r.type === 'feature'), [requests]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) { toast.error('Subject and description are required'); return; }
    setSubmitting(true);
    try {
      const result = await supportService.createRequest(form);
      if (result.success) {
        toast.success(form.type === 'bug' ? 'Bug report submitted' : 'Feature request submitted');
        setForm({ type: form.type, subject: '', priority: 'medium', message: '' });
        load();
      } else toast.error(result.error || result.data?.error || 'Submit failed');
    } catch (err) { toast.error(err.message || 'Submit failed'); } finally { setSubmitting(false); }
  };

  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-3 dark:bg-violet-950/50"><Bug className="h-6 w-6 text-violet-600 dark:text-violet-300" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Features &amp; Bug Reports</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Report a problem or suggest an improvement.</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <motion.form initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} onSubmit={submit} className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">New report</h2>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {[{ v: 'bug', label: 'Bug', Icon: Bug }, { v: 'feature', label: 'Feature', Icon: Lightbulb }].map(({ v, label, Icon }) => (
                <button key={v} type="button" onClick={() => setForm({ ...form, type: v })} className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${form.type === v ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}><Icon className="h-4 w-4" />{label}</button>
              ))}
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Subject</label>
                <input className={field} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Short summary" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Priority</label>
                <select className={field} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Description</label>
                <textarea rows={5} className={field} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="What happened, or what would you like?" />
              </div>
              <button type="submit" disabled={submitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Submit report
              </button>
            </div>
          </motion.form>

          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Your reports</h2>
              <button onClick={load} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><RefreshCw className="h-4 w-4" /></button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>
            ) : myReports.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">You haven&apos;t submitted any reports yet.</p>
            ) : (
              <div className="space-y-3">
                {myReports.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold ${r.type === 'bug' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'}`}>{r.type}</span>
                          <h3 className="truncate font-medium text-slate-900 dark:text-white">{r.subject}</h3>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{r.message}</p>
                        <p className="mt-1 text-xs text-slate-400">Priority: {r.priority} · {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_BADGE[r.status] || STATUS_BADGE.open}`}>{STATUS_LABEL[r.status] || r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
