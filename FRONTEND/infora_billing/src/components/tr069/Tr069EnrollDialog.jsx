import React, { useState } from 'react';
import { AlertTriangle, Check, Copy, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import cpeService from '../../services/cpeService';
import { getAccessToken } from '../../utils/authToken';

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';

function Secret({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-900 dark:text-slate-100">{value}</code>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              toast.error('Clipboard unavailable — select the text instead');
            }
          }}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

/**
 * Pre-register a CPE so it arrives already claimed instead of landing in the
 * pending queue. The password comes back exactly once — the backend stores only
 * an encrypted copy — so the result view is a hand-off screen, not a receipt.
 */
export default function Tr069EnrollDialog({ onClose, onEnrolled }) {
  const [form, setForm] = useState({
    serial_number: '',
    manufacturer: '',
    oui: '',
    product_class: '',
    cwmp_username: '',
    cwmp_password: '',
  });
  const [saving, setSaving] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    if (!form.serial_number.trim()) {
      toast.error('Serial number is required');
      return;
    }
    setSaving(true);
    try {
      const result = await cpeService.enroll(getAccessToken(), {
        serial_number: form.serial_number.trim(),
        manufacturer: form.manufacturer.trim() || undefined,
        oui: form.oui.trim() || undefined,
        product_class: form.product_class.trim() || undefined,
        cwmp_username: form.cwmp_username.trim() || undefined,
        cwmp_password: form.cwmp_password || undefined,
      });
      setCredentials(result?.credentials || null);
      onEnrolled?.(result?.cpe);
      toast.success('CPE enrolled');
    } catch (error) {
      toast.error(error.message || 'Enrolment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl dark:border dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {credentials ? 'CPE enrolled' : 'Enrol a CPE'}
          </h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {credentials ? (
          <div className="space-y-4 px-6 py-5">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Copy these now. The password is stored encrypted and is never shown again —
                if it is lost the device has to be re-enrolled.
              </p>
            </div>
            <Secret label="ACS URL" value={credentials.acs_url} />
            <Secret label="Username" value={credentials.username} />
            <Secret label="Password" value={credentials.password} />
            <p className="text-xs text-slate-500">
              Set these on the device under TR-069 / CWMP, with a periodic inform interval of{' '}
              {credentials.periodic_inform_interval}s. It arrives active, skipping the approval queue.
            </p>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Register the device before it ships so the installer can configure it at the bench.
            </p>
            <div>
              <label className={labelCls}>Serial number *</label>
              <input value={form.serial_number} onChange={set('serial_number')} className={inputCls} placeholder="48575443XXXXXXXX" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Manufacturer</label>
                <input value={form.manufacturer} onChange={set('manufacturer')} className={inputCls} placeholder="Huawei" />
              </div>
              <div>
                <label className={labelCls}>Product class</label>
                <input value={form.product_class} onChange={set('product_class')} className={inputCls} placeholder="HG8145V5" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>OUI</label>
                <input value={form.oui} onChange={set('oui')} className={inputCls} placeholder="00259E" />
              </div>
              <div>
                <label className={labelCls}>CWMP username</label>
                <input value={form.cwmp_username} onChange={set('cwmp_username')} className={inputCls} placeholder="auto" />
              </div>
            </div>
            <div>
              <label className={labelCls}>CWMP password</label>
              <input
                type="password"
                value={form.cwmp_password}
                onChange={set('cwmp_password')}
                className={inputCls}
                placeholder="Leave blank to generate a strong one"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enrol device
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
