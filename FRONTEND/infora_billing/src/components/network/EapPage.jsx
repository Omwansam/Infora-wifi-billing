import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, RefreshCw, Key, Trash2, Edit, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAccessToken } from '../../utils/authToken';
import { unwrapList } from '../../lib/networkUtils';
import eapService from '../../services/eapService';
import NetworkLayout from './NetworkLayout';
import ActiveBadge from './ActiveBadge';

const FORM = { name: '', eap_method: 'PEAP', phase2_method: 'MSCHAPv2', outer_identity: '', notes: '' };
const EAP_METHODS = ['EAP-TLS', 'PEAP', 'EAP-TTLS', 'EAP-FAST', 'EAP-MD5', 'EAP-MSCHAPv2'];

export default function EapPage() {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(FORM);
  const [actionId, setActionId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const res = await eapService.getEAPProfiles(token);
      setProfiles(unwrapList(res));
    } catch {
      toast.error('Failed to load EAP profiles');
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(
    () => profiles.filter((p) => p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.eap_method?.toLowerCase().includes(searchTerm.toLowerCase())),
    [profiles, searchTerm]
  );

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      if (editing) {
        await eapService.updateEAPProfile(token, editing.id, form);
        toast.success('Profile updated');
      } else {
        await eapService.createEAPProfile(token, form);
        toast.success('Profile created');
      }
      setShowForm(false);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Save failed');
    }
  };

  const handleDelete = async (profile) => {
    if (!window.confirm(`Remove EAP profile "${profile.name}"?`)) return;
    try {
      const token = getAccessToken();
      await eapService.deleteEAPProfile(token, profile.id);
      toast.success('Profile removed');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Delete failed');
    }
  };

  const handleTest = async (profileId) => {
    try {
      setActionId(profileId);
      const token = getAccessToken();
      const res = await eapService.testEAPProfile(token, profileId);
      toast.success(res.message || 'Profile validation completed');
    } catch (error) {
      toast.error(error.message || 'Test failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <NetworkLayout
      title="EAP Profiles"
      subtitle="WiFi authentication methods for enterprise networks"
      action={
        <div className="flex gap-3 self-start">
          <button onClick={loadData} disabled={loading} className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => { setEditing(null); setForm(FORM); setShowForm(true); }} className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600">
            <Plus className="h-4 w-4 mr-2" />
            Add Profile
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { title: 'Profiles', value: profiles.length, accent: 'from-violet-500 to-purple-600' },
          { title: 'PEAP / TTLS', value: profiles.filter((p) => ['PEAP', 'EAP-TTLS'].includes(p.eap_method)).length, accent: 'from-indigo-500 to-violet-600' },
          { title: 'TLS', value: profiles.filter((p) => p.eap_method === 'EAP-TLS').length, accent: 'from-emerald-500 to-teal-600' },
        ].map((stat, index) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
            <p className="text-sm text-slate-500">{stat.title}</p>
            <p className="text-2xl font-bold mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Search EAP profiles..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl" />
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-600 border-t-transparent mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200"><Key className="h-12 w-12 text-slate-300 mx-auto" /><p className="mt-4 text-slate-600">No EAP profiles configured</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filtered.map((profile, index) => (
            <motion.div key={profile.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{profile.name}</h3>
                  <p className="text-sm text-slate-500">{profile.eap_method}{profile.phase2_method ? ` · ${profile.phase2_method}` : ''}</p>
                </div>
                <ActiveBadge active={profile.is_active} />
              </div>
              {profile.notes && <p className="text-sm text-slate-600 mb-4">{profile.notes}</p>}
              <div className="flex gap-2 pt-4 border-t border-slate-100">
                <button onClick={() => handleTest(profile.id)} disabled={actionId === profile.id} className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700"><Zap className="h-3.5 w-3.5 mr-1" />Validate</button>
                <button onClick={() => { setEditing(profile); setForm({ ...FORM, ...profile }); setShowForm(true); }} className="p-2 rounded-lg hover:bg-slate-100"><Edit className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(profile)} className="p-2 rounded-lg hover:bg-rose-50 text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
            <motion.form initial={{ scale: 0.96 }} animate={{ scale: 1 }} onSubmit={handleSave} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold">{editing ? 'Edit Profile' : 'Add EAP Profile'}</h2><button type="button" onClick={() => setShowForm(false)}><X className="h-5 w-5" /></button></div>
              <div className="space-y-3">
                <input required placeholder="Profile name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <select value={form.eap_method} onChange={(e) => setForm((p) => ({ ...p, eap_method: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl">
                  {EAP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input placeholder="Phase 2 method" value={form.phase2_method} onChange={(e) => setForm((p) => ({ ...p, phase2_method: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" />
                <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2.5 border rounded-xl" rows={2} />
              </div>
              <button type="submit" className="w-full mt-6 py-2.5 rounded-xl bg-violet-600 text-white font-semibold">Save Profile</button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </NetworkLayout>
  );
}
