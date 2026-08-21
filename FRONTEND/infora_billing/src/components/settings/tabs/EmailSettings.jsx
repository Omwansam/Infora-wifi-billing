import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Send } from 'lucide-react';
import { getAccessToken } from '../../../utils/authToken';
import settingsService from '../../../services/settingsService';
import { useSettingsChrome } from '../chrome';
import {
  Card, Field, TextInput, Select, ToggleRow, StickySaveBar, StatusPill,
  LoadingBlock, Note, PrimaryButton, TestResult,
} from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Email.
 *
 * The credential half is real: /settings/integrations/smtp encrypts anything
 * whose field name looks like a secret, returns it masked, and treats a blank
 * or still-masked value on save as "keep what is stored". That is why the
 * password field can be left empty without wiping the saved one.
 *
 * The delivery half is wired too: services/mailer.resolve_smtp_config prefers
 * this row over the platform's MAIL_* config, all-or-nothing, so switching
 * Custom SMTP off really does put delivery back on the platform default
 * without anyone having to clear the fields.
 * ---------------------------------------------------------------------- */

const KEY = 'smtp';
const MASK = '********';

const BLANK = {
  host: '', port: '', username: '', password: '',
  encryption: 'tls', from_email: '',
};

export default function EmailSettings() {
  const { setChrome } = useSettingsChrome();

  const [enabled, setEnabled] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await settingsService.getIntegrations(getAccessToken());
        const row = (data.integrations || []).find((i) => i.key === KEY);
        const next = { ...BLANK, ...(row?.config || {}) };
        // A masked secret is a placeholder, not a value — show the field empty
        // so "leave blank to keep existing" is literally true.
        if (next.password === MASK) next.password = '';
        setEnabled(Boolean(row?.enabled));
        setForm(next);
        setBaseline(JSON.stringify({ enabled: Boolean(row?.enabled), form: next }));
      } catch (e) {
        toast.error(e.message || 'Failed to load email settings');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const connected = enabled && Boolean(form.host);

  // The header is the connection's status, so the panel owns it.
  useEffect(() => {
    setChrome({
      icon: Mail,
      iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
      eyebrow: 'Billing & messaging',
      title: 'Email',
      subtitle: 'Send transactional email through your own SMTP server.',
      status: (
        <StatusPill tone={connected ? 'connected' : 'idle'}>
          {connected ? 'Connected' : 'Not connected'}
        </StatusPill>
      ),
    });
    return () => setChrome(null);
  }, [setChrome, connected]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const dirty = useMemo(
    () => baseline !== null && JSON.stringify({ enabled, form }) !== baseline,
    [enabled, form, baseline],
  );

  const reset = useCallback(() => {
    if (!baseline) return;
    const prev = JSON.parse(baseline);
    setEnabled(prev.enabled);
    setForm(prev.form);
  }, [baseline]);

  const save = async () => {
    if (enabled && !form.host.trim()) {
      toast.error('Enter the SMTP host before saving');
      return;
    }
    try {
      setSaving(true);
      // Omitting a blank password leaves the stored ciphertext alone.
      const config = { ...form };
      if (!config.password) delete config.password;
      const res = await settingsService.saveIntegration(getAccessToken(), KEY, { enabled, config });
      const saved = { ...BLANK, ...(res.integration?.config || config) };
      if (saved.password === MASK) saved.password = '';
      setForm(saved);
      setBaseline(JSON.stringify({ enabled, form: saved }));
      toast.success('SMTP settings saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTestResult(null);
    try {
      setTesting(true);
      const res = await settingsService.testIntegration(getAccessToken(), 'smtp', {
        email: testTo.trim(),
      });
      setTestResult({
        ok: true,
        detail: res.message,
        via: `${res.host}${res.source === 'platform' ? ' (platform default)' : ''}`,
      });
    } catch (e) {
      setTestResult({ ok: false, detail: e.message || 'Send failed' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <LoadingBlock />;

  return (
    <div className="space-y-6">
      <Card
        title="SMTP credentials"
        description="Use your own SMTP server. When off, transactional email routes through the platform default."
      >
        <ToggleRow
          label="Custom SMTP"
          description="Stored encrypted against this workspace."
          checked={enabled}
          onChange={setEnabled}
        >
          {enabled && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                <Field label="Host" hint="e.g. smtp.gmail.com">
                  <TextInput
                    value={form.host}
                    placeholder="smtp.yourprovider.com"
                    spellCheck={false}
                    onChange={(e) => set('host', e.target.value)}
                  />
                </Field>
                <Field label="Port" hint="587 with STARTTLS, or 465 with SSL. Not 993 — that one is for reading mail.">
                  <TextInput
                    type="number"
                    value={form.port}
                    placeholder="587"
                    onChange={(e) => set('port', e.target.value)}
                  />
                </Field>
                <Field label="Username">
                  <TextInput
                    value={form.username}
                    placeholder="you@yourdomain.com"
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => set('username', e.target.value)}
                  />
                </Field>
                <Field label="Password" hint="Stored encrypted. Leave blank to keep the existing one.">
                  <div className="relative">
                    <TextInput
                      type={reveal ? 'text' : 'password'}
                      value={form.password}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="pr-10"
                      onChange={(e) => set('password', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((r) => !r)}
                      tabIndex={-1}
                      aria-label={reveal ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
                    >
                      {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Field label="Encryption">
                  <Select value={form.encryption} onChange={(e) => set('encryption', e.target.value)}>
                    <option value="tls">STARTTLS</option>
                    <option value="ssl">SSL/TLS</option>
                    <option value="none">None</option>
                  </Select>
                </Field>
                <Field label="Send from" hint="e.g. hello@acmewifi.co — must be a sender your server accepts.">
                  <TextInput
                    type="email"
                    value={form.from_email}
                    placeholder="noreply@yourdomain.com"
                    spellCheck={false}
                    onChange={(e) => set('from_email', e.target.value)}
                  />
                </Field>
              </div>

              <Note title="This is live once you save" tone="success">
                <p className="mt-1">
                  Receipts, invoices and account email leave through this server as soon as the
                  credentials are saved. Switch Custom SMTP off and delivery goes straight back to
                  the platform default — the fields stay put. Send a test below before trusting it
                  with a real receipt.
                </p>
              </Note>
            </div>
          )}
        </ToggleRow>
      </Card>

      <Card
        title="Test delivery"
        description="Send a one-off email through the credentials that are saved right now."
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Email address" hint="Where the test message is sent." className="flex-1">
              <TextInput
                type="email"
                value={testTo}
                placeholder="you@example.com"
                spellCheck={false}
                onChange={(e) => setTestTo(e.target.value)}
              />
            </Field>
            <PrimaryButton
              onClick={sendTest}
              loading={testing}
              disabled={!testTo.trim()}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
              Send test email
            </PrimaryButton>
          </div>

          {dirty && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              You have unsaved changes — the test uses what is saved, not what is on screen. Save
              first to test the new values.
            </p>
          )}

          <TestResult result={testResult} />
        </div>
      </Card>

      <StickySaveBar dirty={dirty} saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
