import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Plus, Edit, Trash2, Shield, Search, Loader2, X, UserCheck, UserX, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { userService } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'support', label: 'Support' },
];

const ROLE_BADGE = {
  admin: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-950/30 dark:text-rose-300',
  manager: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-950/30 dark:text-blue-300',
  support: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-950/30 dark:text-emerald-300',
};

function initials(first, last, email) {
  const a = (first || '').trim();
  const b = (last || '').trim();
  if (a || b) return `${a[0] || ''}${b[0] || ''}`.toUpperCase();
  return (email || '?').slice(0, 2).toUpperCase();
}

const EMPTY_FORM = { first_name: '', last_name: '', email: '', role: 'support', password: '', is_active: true };

function UserModal({ open, onClose, onSaved, editing }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(editing);

  useEffect(() => {
    if (open) {
      setForm(editing
        ? { first_name: editing.first_name, last_name: editing.last_name, email: editing.email,
            role: editing.role, password: '', is_active: editing.is_active }
        : EMPTY_FORM);
    }
  }, [open, editing]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error('Name and email are required');
      return;
    }
    if (!isEdit && (!form.password || form.password.length < 6)) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      const payload = { first_name: form.first_name, last_name: form.last_name, email: form.email,
        role: form.role, is_active: form.is_active };
      if (!isEdit) payload.password = form.password;
      const result = isEdit
        ? await userService.updateUser(editing.id, payload)
        : await userService.createUser(payload);
      if (result.success) {
        toast.success(isEdit ? 'User updated' : 'User created');
        onSaved();
        onClose();
      } else {
        toast.error(result.error || result.data?.error || 'Save failed');
      }
    } catch (err) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{isEdit ? 'Edit user' : 'Add user'}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">First name</label>
              <input className={field} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Last name</label>
              <input className={field} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Email</label>
            <input type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Role</label>
              <select className={field} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {!isEdit && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Password</label>
                <input type="text" className={field} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 6 chars" />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
            Active (can sign in)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function SystemUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await userService.listUsers({ per_page: 200 });
      if (result.success) setUsers(result.data?.users || []);
      else toast.error(result.error || 'Failed to load users');
    } catch (e) {
      toast.error(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!term) return true;
      return `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(term);
    });
  }, [users, search, roleFilter]);

  const isSelf = (u) => String(u.id) === String(currentUser?.id);

  const toggleActive = async (u) => {
    if (isSelf(u)) { toast.error("You can't deactivate your own account"); return; }
    setBusyId(u.id);
    try {
      const result = await userService.updateUser(u.id, { is_active: !u.is_active });
      if (result.success) { toast.success(u.is_active ? 'User deactivated' : 'User activated'); load(); }
      else toast.error(result.error || 'Update failed');
    } finally { setBusyId(null); }
  };

  const remove = async (u) => {
    if (isSelf(u)) { toast.error("You can't delete your own account"); return; }
    if (!window.confirm(`Delete ${u.first_name} ${u.last_name}? This cannot be undone.`)) return;
    setBusyId(u.id);
    try {
      const result = await userService.deleteUser(u.id);
      if (result.success) { toast.success('User deleted'); load(); }
      else toast.error(result.error || 'Delete failed');
    } finally { setBusyId(null); }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-3 dark:bg-blue-950/50"><Users className="h-6 w-6 text-blue-600 dark:text-blue-300" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">System Users</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage staff accounts, roles, and access.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="h-4 w-4" /></button>
            <button onClick={() => { setEditing(null); setModalOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"><Plus className="h-4 w-4" />Add user</button>
          </div>
        </motion.div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
          </div>
          <div className="flex gap-1">
            {[{ value: 'all', label: 'All' }, ...ROLES].map((r) => (
              <button key={r.value} onClick={() => setRoleFilter(r.value)} className={`rounded-lg px-3 py-2 text-sm font-medium ${roleFilter === r.value ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{r.label}</button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading users…</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">No users match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last login</th><th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-bold text-white">{initials(u.first_name, u.last_name, u.email)}</div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{u.first_name} {u.last_name}{isSelf(u) && <span className="ml-2 text-xs text-slate-400">(you)</span>}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${ROLE_BADGE[u.role] || ROLE_BADGE.support}`}>{u.role === 'admin' && <Shield className="h-3 w-3" />}{u.role}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                          {u.is_active ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}{u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => toggleActive(u)} disabled={busyId === u.id || isSelf(u)} title={u.is_active ? 'Deactivate' : 'Activate'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800">{busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : u.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}</button>
                          <button onClick={() => { setEditing(u); setModalOpen(true); }} title="Edit" className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => remove(u)} disabled={isSelf(u)} title="Delete" className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-40 dark:hover:bg-rose-950/40"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <UserModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} editing={editing} />
    </div>
  );
}
