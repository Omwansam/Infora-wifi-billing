import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Search, Loader2, RefreshCw, Gauge, Clock, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import radiusService from '../../services/radiusService';
import { getAccessToken } from '../../utils/authToken';

export default function RadiusUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await radiusService.getRadiusUsers(getAccessToken(), { page, per_page: 25, search: search || undefined });
      const data = res?.data ?? res;
      setUsers(data?.users || []);
      setPages(data?.pages || 1);
      setTotal(data?.total || 0);
    } catch (e) {
      toast.error(e.message || 'Failed to load RADIUS users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, searchInput ? 350 : 0);
    return () => clearTimeout(t);
  }, [searchInput]);

  const onlineCount = users.filter((u) => u.is_online).length;

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-100 p-3 dark:bg-indigo-950/50"><Users className="h-6 w-6 text-indigo-600 dark:text-indigo-300" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">RADIUS Users</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Authentication accounts provisioned in FreeRADIUS (radcheck).</p>
            </div>
          </div>
          <button onClick={() => load()} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-4 w-4" />Refresh</button>
        </motion.div>

        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search login…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="hidden rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 sm:block">
            <span className="text-slate-500 dark:text-slate-400">Online </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">{onlineCount}</span>
            <span className="text-slate-400"> / {total}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">No RADIUS users found. They are created when a customer is provisioned.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr><th className="px-4 py-3">Login</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Plan / group</th><th className="px-4 py-3">Rate limit</th><th className="px-4 py-3">Expiration</th><th className="px-4 py-3">State</th><th className="px-4 py-3 text-right"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-mono text-slate-800 dark:text-slate-200">{u.username}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{u.customer_name || '—'}</td>
                      <td className="px-4 py-3">{u.plan_name ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"><Gauge className="h-3 w-3" />{u.plan_name}</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">{u.rate_limit || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400"><span className="inline-flex items-center gap-1">{u.expiration ? <><Clock className="h-3 w-3" />{u.expiration}</> : '—'}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_online ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${u.is_online ? 'bg-emerald-500' : 'bg-slate-400'}`} />{u.is_online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{u.customer_id && <Link to={`/clients/${u.customer_id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"><ExternalLink className="h-3.5 w-3.5" />Client</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && users.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span>{total} user{total === 1 ? '' : 's'} · page {page} of {pages}</span>
              <div className="flex gap-1">
                <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-700"><ChevronLeft className="h-4 w-4" /></button>
                <button disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40 dark:border-slate-700"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
