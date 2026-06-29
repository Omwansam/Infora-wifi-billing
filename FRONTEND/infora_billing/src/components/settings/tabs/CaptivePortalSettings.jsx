import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Copy, ExternalLink, Router as RouterIcon, Trash2, Megaphone } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { accentForeground } from '../../../lib/portalColor';
import { themeBackground } from '../../../lib/portalThemePreviews';
import { resolvePortalOpenUrl } from '../../../lib/portalUrl';
import PortalLivePreview from '../PortalLivePreview';
import { Card, Field, TextInput, Textarea, PrimaryButton, Toggle, LoadingBlock } from '../ui';

function ThemeCard({ theme, selected, accentColor, onSelect }) {
  const meta = themeBackground(theme.key);
  const accentFg = accentForeground(accentColor);
  const cardBg = meta.isLight ? '#f8fafc' : 'rgba(255,255,255,0.1)';

  return (
    <button
      type="button"
      onClick={() => onSelect(theme.key)}
      className="text-left rounded-xl overflow-hidden border-2 transition"
      style={{
        borderColor: selected ? accentColor : '#e5e7eb',
        boxShadow: selected ? `0 0 0 3px ${accentColor}33` : undefined,
      }}
    >
      <div className="relative h-28 p-3" style={{ background: meta.bg }}>
        {selected && (
          <span
            className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: accentColor, color: accentFg }}
          >
            <Check className="h-3 w-3" />
          </span>
        )}
        <p className="text-xs font-bold" style={{ color: meta.text }}>ISP Name</p>
        <p className="mb-2 text-[9px]" style={{ color: meta.text, opacity: 0.7 }}>Fast internet</p>
        <div className="space-y-1.5">
          <div className="rounded px-2 py-1" style={{ background: cardBg }}>
            <span className="text-[9px] font-semibold" style={{ color: meta.text }}>Basic — 2,000</span>
          </div>
          <div
            className="rounded py-1 text-center text-[9px] font-bold"
            style={{ backgroundColor: accentColor, color: accentFg }}
          >
            Pay with M-Pesa
          </div>
        </div>
      </div>
      <div className="bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{theme.name}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            {theme.badge}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{theme.description}</p>
      </div>
    </button>
  );
}

export default function CaptivePortalSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingTheme, setSavingTheme] = useState(false);
  const [themeColor, setThemeColor] = useState('#1BA449');
  const [savingColor, setSavingColor] = useState(false);
  const [redirect, setRedirect] = useState('');
  const [savingRedirect, setSavingRedirect] = useState(false);
  const [ann, setAnn] = useState({ title: '', type: 'info', expires_at: '', message: '' });
  const [postingAnn, setPostingAnn] = useState(false);

  const load = async () => {
    try {
      const res = await settingsService.getPortal(getAccessToken());
      setData(res);
      setThemeColor(res.theme_color || '#1BA449');
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
      toast.success('Portal layout saved');
    } catch (e) {
      setData((d) => ({ ...d, default_portal_theme: prev }));
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingTheme(false);
    }
  };

  const saveColor = async () => {
    const normalized = themeColor.trim();
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalized)) {
      toast.error('Enter a valid hex color (e.g. #1BA449)');
      return;
    }
    setSavingColor(true);
    try {
      await settingsService.savePortal(getAccessToken(), { theme_color: normalized });
      setData((d) => ({ ...d, theme_color: normalized }));
      setThemeColor(normalized);
      toast.success('Brand color saved — refresh the portal to see it');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingColor(false);
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
      load();
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
    toast.success('Copied to clipboard');
  };

  if (loading || !data) return <LoadingBlock />;

  const previewTheme = data.default_portal_theme || 'clean';
  const accent = themeColor || data.theme_color || '#1BA449';
  const livePortalUrl = resolvePortalOpenUrl(data.preview_portal_url, data.isp_id);

  return (
    <div className="space-y-6">
      {/* Brand color + live preview */}
      <Card
        title="Brand color & live preview"
        description="Your accent color is applied to buttons, tabs, badges, and highlights across the captive portal"
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <Field
              label="Portal accent color"
              hint="Buttons, active tabs, package highlights, and success states use this color"
            >
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setThemeColor(e.target.value)}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-gray-300 bg-white p-1"
                />
                <TextInput
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  placeholder="#1BA449"
                  className="max-w-[140px] font-mono"
                />
                <PrimaryButton onClick={saveColor} loading={savingColor}>
                  Save color
                </PrimaryButton>
              </div>
            </Field>

            <div className="mt-5 flex flex-wrap gap-2">
              {['#1BA449', '#2563eb', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#db2777'].map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => setThemeColor(c)}
                  className="h-8 w-8 rounded-full border-2 border-white shadow ring-1 ring-gray-200 transition hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: accent === c ? `2px solid ${c}` : undefined,
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>

            {livePortalUrl && (
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a
                  href={livePortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                  style={{ color: accent }}
                >
                  <ExternalLink className="h-4 w-4" />
                  Open live portal
                </a>
                <button
                  type="button"
                  onClick={() => copy(livePortalUrl)}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy portal URL
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Preview</p>
            <PortalLivePreview
              themeKey={previewTheme}
              accentColor={accent}
              hotspotName={data.hotspot_name || data.isp_name}
              logoUrl={data.logo_url}
            />
            <p className="mt-2 text-[11px] text-gray-400">
              Preview updates as you change color. Save, then open the live portal to confirm.
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Portal layout"
        description="Background style for the captive portal. Your brand color above applies on top of any layout."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data.themes.map((t) => (
            <ThemeCard
              key={t.key}
              theme={t}
              accentColor={accent}
              selected={data.default_portal_theme === t.key}
              onSelect={selectTheme}
            />
          ))}
        </div>
        {savingTheme && <p className="mt-3 text-xs text-gray-400">Saving…</p>}
      </Card>

      <Card title="Router portal assignment" description="Per-router layout override and hotspot login URL">
        {data.routers.length === 0 ? (
          <p className="text-sm text-gray-500">No routers linked yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <th className="pb-3">Router</th>
                  <th className="pb-3">Portal URL</th>
                  <th className="pb-3">Layout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.routers.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${accent}18`, color: accent }}
                        >
                          <RouterIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{r.name}</p>
                          {r.ip && <p className="text-xs text-gray-400">{r.ip}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex max-w-md items-center gap-2">
                        <span className="truncate rounded bg-gray-100 px-2 py-1 font-mono text-xs">{r.portal_url}</span>
                        <button type="button" onClick={() => copy(resolvePortalOpenUrl(r.portal_url, data.isp_id))} className="shrink-0 text-gray-400 hover:text-gray-700">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3">
                      <select
                        value={r.theme}
                        onChange={(e) => setRouterTheme(r.id, e.target.value)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
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

      <Card title="Portal announcements" description="Banners shown at the top of your captive portal">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Title" className="md:col-span-1">
            <TextInput value={ann.title} placeholder="e.g. Maintenance tonight 10pm" onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
          </Field>
          <Field label="Type">
            <select
              value={ann.type}
              onChange={(e) => setAnn({ ...ann, type: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
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
            <Megaphone className="h-4 w-4" /> Post announcement
          </PrimaryButton>
        </div>

        {data.announcements.length > 0 && (
          <div className="mt-6 space-y-3">
            {data.announcements.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">{a.type}</span>
                    {!a.is_live && <span className="text-[10px] font-medium text-gray-400">{a.is_active ? 'Expired' : 'Off'}</span>}
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{a.title}</p>
                  {a.message && <p className="text-xs text-gray-500">{a.message}</p>}
                  {a.expires_at && <p className="mt-0.5 text-[11px] text-gray-400">Expires {new Date(a.expires_at).toLocaleString()}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Toggle checked={a.is_active} onChange={() => toggleAnnouncement(a)} />
                  <button type="button" onClick={() => deleteAnnouncement(a.id)} className="text-gray-400 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="After-login redirect URL" description="Where customers land after paying and connecting. Defaults to google.com.">
        <div className="flex items-center gap-3">
          <TextInput value={redirect} placeholder="https://www.google.com" onChange={(e) => setRedirect(e.target.value)} />
          <PrimaryButton onClick={saveRedirect} loading={savingRedirect} className="shrink-0">Save</PrimaryButton>
        </div>
      </Card>
    </div>
  );
}
