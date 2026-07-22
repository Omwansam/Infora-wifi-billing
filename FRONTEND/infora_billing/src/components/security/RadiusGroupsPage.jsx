import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader2, RefreshCw, Gauge, Users, Database, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import radiusService from '../../services/radiusService';
import { getAccessToken } from '../../utils/authToken';
import { formatBytes } from '../../lib/networkUtils';

export default function RadiusGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await radiusService.getRadiusGroups(getAccessToken());
      const data = res?.data ?? res;
      setGroups(data?.groups || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load RADIUS groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-violet-100 p-3 dark:bg-violet-950/50"><ShieldCheck className="h-6 w-6 text-violet-600 dark:text-violet-300" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">RADIUS Groups</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Policy groups (one per plan) and their reply attributes.</p>
            </div>
          </div>
          <button onClick={load} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-4 w-4" />Refresh</button>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            No RADIUS groups yet. Groups are created automatically when a plan is provisioned.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const cap = g.data_cap ? formatBytes(Number(g.data_cap)) : null;
              return (
                <motion.div key={g.groupname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-950/50"><Package className="h-4 w-4 text-violet-600 dark:text-violet-300" /></div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{g.plan_name}</h3>
                        <p className="font-mono text-xs text-slate-400">{g.groupname}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"><Users className="h-3 w-3" />{g.member_count}</span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><Gauge className="h-3.5 w-3.5" />Rate limit</span><span className="font-mono text-slate-800 dark:text-slate-200">{g.rate_limit || '—'}</span></div>
                    <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><Database className="h-3.5 w-3.5" />Data cap</span><span className="font-mono text-slate-800 dark:text-slate-200">{cap || 'Unlimited'}</span></div>
                  </div>
                  {g.plan_id && (
                    <Link to="/plans" className="mt-4 inline-block text-xs font-semibold text-violet-600 hover:text-violet-700">Manage plan →</Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
