import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, Router as RouterIcon, Trash2, Megaphone } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Field, TextInput, Textarea, PrimaryButton, Toggle, LoadingBlock } from '../ui';

const THEME_PREVIEW = {
  clean: { bg: '#ffffff', accent: '#1BA449', text: '#0f172a', border: true },
  dark: { bg: '#0f172a', accent: '#22c55e', text: '#e2e8f0' },
  gradient: { bg: 'linear-gradient(135deg,#6d28d9,#a855f7)', accent: '#c084fc', text: '#ffffff' },
  neon: { bg: '#0a0a0f', accent: '#ec4899', text: '#fbcfe8' },
  ocean: { bg: 'linear-gradient(135deg,#0c4a6e,#0369a1)', accent: '#22d3ee', text: '#e0f2fe' },
  sunset: { bg: 'linear-gradient(135deg,#ea580c,#f59e0b)', accent: '#fde68a', text: '#fff7ed' },
  forest: { bg: '#dcfce7', accent: '#16a34a', text: '#14532d' },
  slate: { bg: '#f1f5f9', accent: '#475569', text: '#0f172a' },
  rose: { bg: '#fff1f2', accent: '#e11d48', text: '#881337' },
  midnight: { bg: 'linear-gradient(135deg,#0b1220,#1e293b)', accent: '#38bdf8', text: '#e2e8f0' },
};

function ThemeCard({ theme, selected, onSelect }) {
  const p = THEME_PREVIEW[theme.key] || THEME_PREVIEW.clean;
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.key)}
      className={`text-left rounded-xl overflow-hidden border-2 transition ${
        selected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="relative h-28 p-3" style={{ background: p.bg }}>
        {selected && (
          <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
            <Check className="h-3 w-3" />
          </span>
        )}
        <p className="text-xs font-bold" style={{ color: p.text }}>ISP Name</p>
        <p className="text-[9px] mb-2" style={{ color: p.text, opacity: 0.7 }}>Fast internet</p>
        <div className="space-y-1.5">
          <div className="rounded px-2 py-1" style={{ background: p.border ? '#f8fafc' : 'rgba(255,255,255,0.12)' }}>
            <span className="text-[9px] font-semibold" style={{ color: p.text }}>Basic — 2,000</span>
          </div>
          <div className="rounded py-1 text-center text-[9px] font-bold" style={{ background: p.accent, color: p.bg === '#ffffff' ? '#fff' : '#0b0b0b' }}>
            Pay with Mobile Money
          </div>
        </div>
      </div>
      <div className="px-3 py-2 bg-white">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{theme.name}</span>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{theme.badge}</span>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{theme.description}</p>
      </div>
    </button>
  );
}

export default function CaptivePortalSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingTheme, setSavingTheme] = useState(false);
  const [redirect, setRedirect] = useState('');
  const [savingRedirect, setSavingRedirect] = useState(false);
  const [ann, setAnn] = useState({ title: '', type: 'info', expires_at: '', message: '' });
  const [postingAnn, setPostingAnn] = useState(false);

  const load = async () => {
    try {
      const res = await settingsService.getPortal(getAccessToken());
      setData(res);
      setRedirect(res.after_login_redirect_url || '');
    } catch (e) {
      toast.error(e.message || 'Failed to load portal settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectTheme = async (key) => {
    const prev = data.default_portal_theme;
    setData((d) => ({ ...d, default_portal_theme: key }));
    setSavingTheme(true);
    try {
      await settingsService.savePortal(getAccessToken(), { default_portal_theme: key });
      toast.success('Default theme saved');
    } catch (e) {
      setData((d) => ({ ...d, default_portal_theme: prev }));
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingTheme(false);
    }
  };

  const setRouterTheme = async (deviceId, theme) => {
    setData((d) => ({
      ...d,
      routers: d.routers.map((r) => (r.id === deviceId ? { ...r, theme } : r)),
    }));
    try {
      await settingsService.setRouterTheme(getAccessToken(), deviceId, theme);
      toast.success('Router theme saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    }
  };

  const saveRedirect = async () => {
    try {
      setSavingRedirect(true);
      await settingsService.savePortal(getAccessToken(), { after_login_redirect_url: redirect });
      toast.success('Redirect URL saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingRedirect(false);
    }
  };

  const postAnnouncement = async () => {
    if (!ann.title.trim()) return toast.error('Title is required');
    try {
      setPostingAnn(true);
      await settingsService.createAnnouncement(getAccessToken(), ann);
      setAnn({ title: '', type: 'info', expires_at: '', message: '' });
      toast.success('Announcement posted');
      load();
    } catch (e) {
      toast.error(e.message || 'Could not post');
    } finally {
      setPostingAnn(false);
    }
  };

  const toggleAnnouncement = async (a) => {
    try {
      await settingsService.updateAnnouncement(getAccessToken(), a.id, { is_active: !a.is_active });
      load();
    } catch (e) {
      toast.error(e.message || 'Update failed');
    }
  };

  const deleteAnnouncement = async (id) => {
    try {
      await settingsService.deleteAnnouncement(getAccessToken(), id);
      load();
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    toast.success('Portal URL copied');
  };

  if (loading || !data) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <Card
        title="Default Portal Theme"
        description="Applies to all routers unless a specific theme is assigned"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {data.themes.map((t) => (
            <ThemeCard
              key={t.key}
              theme={t}
              selected={data.default_portal_theme === t.key}
              onSelect={selectTheme}
            />
          ))}
        </div>
        {savingTheme && <p className="mt-3 text-xs text-gray-400">Saving…</p>}
      </Card>

      <Card title="Router Portal Assignment" description="Assign a different portal theme per router and copy the hotspot login URL.">
        {data.routers.length === 0 ? (
          <p className="text-sm text-gray-500">No routers linked yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
                  <th className="pb-3 font-semibold">Router</th>
                  <th className="pb-3 font-semibold">Portal URL</th>
                  <th className="pb-3 font-semibold">Theme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.routers.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                          <RouterIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{r.name}</p>
                          {r.ip && <p className="text-xs text-gray-400">{r.ip}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2 max-w-md">
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded truncate">{r.portal_url}</span>
                        <button onClick={() => copy(r.portal_url)} className="text-gray-400 hover:text-gray-700 shrink-0">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3">
                      <select
                        value={r.theme}
                        onChange={(e) => setRouterTheme(r.id, e.target.value)}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
                      >
                        {data.themes.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.name}{t.key === data.default_portal_theme ? ' (Default)' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Portal Announcements" description="Banners shown to customers at the top of your portal page">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Title" className="md:col-span-1">
            <TextInput value={ann.title} placeholder="e.g. Maintenance tonight 10pm" onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
          </Field>
          <Field label="Type">
            <select
              value={ann.type}
              onChange={(e) => setAnn({ ...ann, type: e.target.value })}
              className="block w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
          </Field>
          <Field label="Expires">
            <TextInput type="datetime-local" value={ann.expires_at} onChange={(e) => setAnn({ ...ann, expires_at: e.target.value })} />
          </Field>
        </div>
        <Field label="Message (optional)" className="mt-4">
          <Textarea rows={2} value={ann.message} placeholder="Additional details..." onChange={(e) => setAnn({ ...ann, message: e.target.value })} />
        </Field>
        <div className="mt-4">
          <PrimaryButton onClick={postAnnouncement} loading={postingAnn}>
            <Megaphone className="h-4 w-4" /> Post Announcement
          </PrimaryButton>
        </div>

        {data.announcements.length > 0 && (
          <div className="mt-6 space-y-3">
            {data.announcements.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">{a.type}</span>
                    {!a.is_live && <span className="text-[10px] font-medium text-gray-400">{a.is_active ? 'Expired' : 'Off'}</span>}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-1">{a.title}</p>
                  {a.message && <p className="text-xs text-gray-500">{a.message}</p>}
                  {a.expires_at && <p className="text-[11px] text-gray-400 mt-0.5">Expires {new Date(a.expires_at).toLocaleString()}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Toggle checked={a.is_active} onChange={() => toggleAnnouncement(a)} />
                  <button onClick={() => deleteAnnouncement(a.id)} className="text-gray-400 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="After-Login Redirect URL" description="Where customers land after paying and connecting. Defaults to google.com.">
        <div className="flex items-center gap-3">
          <TextInput value={redirect} placeholder="https://www.google.com" onChange={(e) => setRedirect(e.target.value)} />
          <PrimaryButton onClick={saveRedirect} loading={savingRedirect} className="shrink-0">Save</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
