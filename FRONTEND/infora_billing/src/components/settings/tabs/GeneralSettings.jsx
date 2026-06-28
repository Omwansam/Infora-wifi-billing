import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Image as ImageIcon, Globe, Loader2 } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { Card, Field, TextInput, SaveBar, LoadingBlock, PrimaryButton } from '../ui';

export default function GeneralSettings() {
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [domain, setDomain] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await settingsService.getGeneral(getAccessToken());
        setForm(data);
        setDomain(data.custom_domain || '');
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
      await settingsService.saveGeneral(getAccessToken(), {
        isp_name: form.isp_name,
        hotspot_name: form.hotspot_name,
        support_phone: form.support_phone,
        theme_color: form.theme_color,
        website: form.website,
        data_retention_days: form.data_retention_days,
        hotspot_username_prefix: form.hotspot_username_prefix,
        hotspot_password_length: form.hotspot_password_length,
      });
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

  const saveDomain = async () => {
    try {
      setSavingDomain(true);
      await settingsService.saveCustomDomain(getAccessToken(), domain);
      toast.success('Custom domain saved');
    } catch (e) {
      toast.error(e.message || 'Could not save domain');
    } finally {
      setSavingDomain(false);
    }
  };

  if (loading || !form) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <Card title="General & Branding" description="Customize your ISP portal appearance and business details">
        <Field label="Logo" className="mb-6">
          <div className="flex items-center gap-5">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-44 h-28 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-emerald-400 hover:text-emerald-500 transition overflow-hidden bg-gray-50"
            >
              {uploadingLogo ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <>
                  <ImageIcon className="h-6 w-6 mb-1" />
                  <span className="text-xs font-medium">Click to upload logo</span>
                  <span className="text-[10px] text-gray-400">PNG, JPG, SVG (max 2MB)</span>
                </>
              )}
            </div>
            {form.logo_url && (
              <button
                type="button"
                onClick={() => set('logo_url', '')}
                className="text-xs font-medium text-rose-600 hover:text-rose-700"
              >
                Remove
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
          </div>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          <Field label="ISP Name" hint="Shown in the sidebar and portal header">
            <TextInput value={form.isp_name || ''} onChange={(e) => set('isp_name', e.target.value)} />
          </Field>
          <Field label="Hotspot Name" hint="Shown on the captive portal page">
            <TextInput
              value={form.hotspot_name || ''}
              placeholder="WiFi network branding name"
              onChange={(e) => set('hotspot_name', e.target.value)}
            />
          </Field>
          <Field label="Support Phone Number" hint="Displayed on captive portal pages so customers can call for help">
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
          <Field label="Theme Color" hint="Used for buttons and accents across your portal">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.theme_color || '#1BA449'}
                onChange={(e) => set('theme_color', e.target.value)}
                className="h-10 w-12 rounded-lg border border-gray-300 cursor-pointer p-1 bg-white"
              />
              <TextInput
                value={form.theme_color || ''}
                onChange={(e) => set('theme_color', e.target.value)}
                className="max-w-[160px]"
              />
            </div>
          </Field>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase mb-3">Data Retention</p>
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

        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase mb-3">Hotspot Generation Defaults</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            <Field
              label="Username / Voucher Prefix"
              hint="Goes in front of generated usernames & vouchers (e.g. CAFE001). Letters, numbers, _ or -. Leave blank for the default."
            >
              <TextInput
                value={form.hotspot_username_prefix || ''}
                placeholder="e.g. CAFE (default: HS)"
                onChange={(e) => set('hotspot_username_prefix', e.target.value)}
              />
            </Field>
            <Field
              label="Generated Password Length"
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
        </div>

        <div className="mt-6">
          <SaveBar onSave={save} saving={saving} />
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3 mb-4">
          <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Custom Domain</h3>
            <p className="text-sm text-gray-500">Serve your portal on your own web address instead of the default link.</p>
          </div>
        </div>
        {form.current_portal_url && (
          <p className="text-xs text-gray-500 mb-3">
            Customers currently reach you at{' '}
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700">{form.current_portal_url}</span>
          </p>
        )}
        <Field
          label="Your domain"
          hint="A subdomain you own — e.g. wifi.yourcompany.com. No http://, no spaces."
        >
          <div className="flex items-center gap-3">
            <TextInput
              value={domain}
              placeholder="wifi.yourcompany.com"
              onChange={(e) => setDomain(e.target.value)}
            />
            <PrimaryButton onClick={saveDomain} loading={savingDomain} className="shrink-0">Save</PrimaryButton>
          </div>
        </Field>
      </Card>
    </div>
  );
}
