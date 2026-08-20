import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Field, TextInput, SaveBar, LoadingBlock } from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Branding, and the voucher-defaults block reused by Hotspot.
 *
 * Both sections read and write /settings/general, which updates only the keys
 * present in the body — so the form can be split across two panels without
 * either one clobbering the other's fields on save. `section` picks which.
 * ---------------------------------------------------------------------- */

const KEYS = {
  branding: [
    'isp_name', 'hotspot_name', 'support_phone', 'theme_color', 'website',
    'data_retention_days',
  ],
  'hotspot-defaults': ['hotspot_username_prefix', 'hotspot_password_length'],
};

export default function GeneralSettings({ section = 'branding' }) {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        setForm(await settingsService.getGeneral(getAccessToken()));
      } catch (e) {
        toast.error(e.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    try {
      setSaving(true);
      const payload = {};
      for (const key of KEYS[section] || KEYS.branding) payload[key] = form[key];
      await settingsService.saveGeneral(getAccessToken(), payload);
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingLogo(true);
      const res = await settingsService.uploadLogo(getAccessToken(), file);
      set('logo_url', res.logo_url);
      toast.success('Logo uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingLogo(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading || !form) return <LoadingBlock />;

  if (section === 'hotspot-defaults') {
    return (
      <Card
        title="Voucher generation defaults"
        description="Applied whenever the system generates hotspot usernames, vouchers or passwords"
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field
            label="Username / voucher prefix"
            hint="Goes in front of generated usernames & vouchers (e.g. CAFE001). Letters, numbers, _ or -. Leave blank for the default."
          >
            <TextInput
              value={form.hotspot_username_prefix || ''}
              placeholder="e.g. CAFE (default: HS)"
              onChange={(e) => set('hotspot_username_prefix', e.target.value)}
            />
          </Field>
          <Field
            label="Generated password length"
            hint="How many characters generated hotspot/voucher passwords use. Minimum 4. Leave blank to keep the default."
          >
            <TextInput
              type="number"
              min={4}
              value={form.hotspot_password_length ?? ''}
              placeholder="Default (6–8)"
              onChange={(e) => set('hotspot_password_length', e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-6">
          <SaveBar onSave={save} saving={saving} />
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title="Identity"
        description="The name, logo and colour subscribers see on the portal, on receipts and in every message you send"
      >
        <Field label="Logo" className="mb-6">
          <div className="flex items-center gap-5">
            <div
              onClick={() => fileRef.current?.click()}
              className="flex h-28 w-44 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-emerald-400 hover:text-emerald-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-500"
            >
              {uploadingLogo ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <>
                  <ImageIcon className="mb-1 h-6 w-6" />
                  <span className="text-xs font-medium">Click to upload logo</span>
                  <span className="text-[10px] opacity-70">PNG, JPG, SVG (max 2MB)</span>
                </>
              )}
            </div>
            {form.logo_url && (
              <button
                type="button"
                onClick={() => set('logo_url', '')}
                className="text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400"
              >
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
          <Field label="ISP name" hint="Shown in the sidebar and portal header">
            <TextInput value={form.isp_name || ''} onChange={(e) => set('isp_name', e.target.value)} />
          </Field>
          <Field label="Hotspot name" hint="Shown on the captive portal page">
            <TextInput
              value={form.hotspot_name || ''}
              placeholder="WiFi network branding name"
              onChange={(e) => set('hotspot_name', e.target.value)}
            />
          </Field>
          <Field label="Support phone number" hint="Displayed on captive portal pages so customers can call for help">
            <TextInput
              value={form.support_phone || ''}
              placeholder="e.g. +254700000000"
              onChange={(e) => set('support_phone', e.target.value)}
            />
          </Field>
          <Field label="Website">
            <TextInput
              value={form.website || ''}
              placeholder="https://yourcompany.com"
              onChange={(e) => set('website', e.target.value)}
            />
          </Field>
          <Field label="Theme colour" hint="Also editable under Settings → Hotspot with a live preview">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.theme_color || '#1BA449'}
                onChange={(e) => set('theme_color', e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-950"
              />
              <TextInput
                value={form.theme_color || ''}
                onChange={(e) => set('theme_color', e.target.value)}
                className="max-w-[160px]"
              />
            </div>
          </Field>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Data retention
          </p>
          <Field
            label="Auto-delete old data after (days)"
            hint="Automatically clears out old data to keep your account fast and lean. Once set, expired hotspot & PPPoE users and transactions older than this many days are permanently deleted each night. Active users are never affected. Leave blank to keep all data forever. Minimum 7 days."
            className="max-w-sm"
          >
            <TextInput
              type="number"
              min={7}
              value={form.data_retention_days ?? ''}
              placeholder="Leave blank to keep forever"
              onChange={(e) => set('data_retention_days', e.target.value)}
            />
          </Field>
        </div>

        <div className="mt-6">
          <SaveBar onSave={save} saving={saving} />
        </div>
      </Card>
    </div>
  );
}
