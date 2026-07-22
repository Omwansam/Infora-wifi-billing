import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ShieldCheck, ShieldOff, Loader2, Copy, Download, CheckCircle, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { twoFactorService } from '../../services/twoFactorService';

export default function TwoFactorAuthPage() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [stage, setStage] = useState('idle'); // idle | setup | done
  const [setupData, setSetupData] = useState(null);
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [disablePw, setDisablePw] = useState('');
  const [showDisable, setShowDisable] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const r = await twoFactorService.getStatus();
      if (r.success) { setEnabled(r.data?.enabled); setRemaining(r.data?.backup_codes_remaining || 0); }
    } finally { setLoading(false); }
  };
  useEffect(() => { loadStatus(); }, []);

  const startSetup = async () => {
    setBusy(true);
    try {
      const r = await twoFactorService.setup();
      if (r.success) { setSetupData(r.data); setStage('setup'); setCode(''); }
      else toast.error(r.error || r.data?.error || 'Could not start setup');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const verify = async () => {
    if (code.trim().length < 6) { toast.error('Enter the 6-digit code'); return; }
    setBusy(true);
    try {
      const r = await twoFactorService.verify(code.trim());
      if (r.success) {
        setBackupCodes(r.data?.backup_codes || []);
        setStage('done'); setEnabled(true);
        toast.success('Two-factor authentication enabled');
      } else toast.error(r.error || r.data?.error || 'Invalid code');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const disable = async () => {
    if (!disablePw) { toast.error('Enter your password'); return; }
    setBusy(true);
    try {
      const r = await twoFactorService.disable(disablePw);
      if (r.success) {
        toast.success('Two-factor authentication disabled');
        setEnabled(false); setStage('idle'); setShowDisable(false); setDisablePw(''); setBackupCodes([]);
        loadStatus();
      } else toast.error(r.error || r.data?.error || 'Disable failed');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const copyCodes = () => { navigator.clipboard.writeText(backupCodes.join('\n')).then(() => toast.success('Backup codes copied')); };
  const downloadCodes = () => {
    const blob = new Blob([`Infora Billing — 2FA backup codes\n\n${backupCodes.join('\n')}\n`], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'infora-2fa-backup-codes.txt'; a.click(); URL.revokeObjectURL(a.href);
  };

  const card = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900';

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto max-w-2xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-indigo-100 p-3 dark:bg-indigo-950/50"><Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-300" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Two-Factor Authentication</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Add a second step to your sign-in with an authenticator app.</p>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>
        ) : (
          <div className="space-y-5">
            {/* Status */}
            <div className={card}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {enabled ? <ShieldCheck className="h-6 w-6 text-emerald-500" /> : <ShieldOff className="h-6 w-6 text-slate-400" />}
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{enabled ? 'Enabled' : 'Not enabled'}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{enabled ? `${remaining} backup codes remaining` : 'Your account is protected by password only'}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{enabled ? 'On' : 'Off'}</span>
              </div>

              {!enabled && stage === 'idle' && (
                <button onClick={startSetup} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}Enable 2FA
                </button>
              )}
              {enabled && !showDisable && stage !== 'done' && (
                <button onClick={() => setShowDisable(true)} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">
                  <ShieldOff className="h-4 w-4" />Disable 2FA
                </button>
              )}
            </div>

            {/* Setup flow */}
            {stage === 'setup' && setupData && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={card}>
                <h2 className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">Scan the QR code</h2>
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Open Google Authenticator, Authy, or 1Password and scan this code.</p>
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                  <img src={setupData.qr_code} alt="2FA QR code" className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Or enter this key manually</p>
                    <code className="mt-1 block break-all rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200">{setupData.secret}</code>
                    <label className="mb-1 mt-4 block text-xs font-semibold text-slate-500 dark:text-slate-400">Enter the 6-digit code</label>
                    <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" placeholder="123456" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono tracking-[0.3em] text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    <div className="mt-4 flex gap-2">
                      <button onClick={verify} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}Verify &amp; enable</button>
                      <button onClick={() => setStage('idle')} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Backup codes */}
            {stage === 'done' && backupCodes.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={card}>
                <div className="mb-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><KeyRound className="h-5 w-5" /><h2 className="text-lg font-semibold">Save your backup codes</h2></div>
                <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">Each code works once if you lose your authenticator. Store them somewhere safe — they won&apos;t be shown again.</p>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50 sm:grid-cols-2">
                  {backupCodes.map((c) => <code key={c} className="font-mono text-sm text-slate-800 dark:text-slate-200">{c}</code>)}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={copyCodes} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Copy className="h-4 w-4" />Copy</button>
                  <button onClick={downloadCodes} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"><Download className="h-4 w-4" />Download</button>
                  <button onClick={() => { setStage('idle'); loadStatus(); }} className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Done</button>
                </div>
              </motion.div>
            )}

            {/* Disable confirm */}
            {showDisable && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={card}>
                <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Confirm your password to disable 2FA</h2>
                <input type="password" value={disablePw} onChange={(e) => setDisablePw(e.target.value)} placeholder="Current password" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <div className="mt-4 flex gap-2">
                  <button onClick={disable} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}Disable 2FA</button>
                  <button onClick={() => { setShowDisable(false); setDisablePw(''); }} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
