import React, { useState } from 'react';
import { Download, Loader2, QrCode, Search, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '../../lib/utils';
import portalService from '../../services/portalService';
import PortalShell from './PortalShell';
import { PortalFadeIn, PortalGlassCard, PortalSectionHeader } from './PortalUI';

function formatBytes(n) {
  if (!n) return '0 B';
  let v = Number(n);
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
  return `${v.toFixed(1)} ${units[i]}`;
}

export default function WireGuardPortalPage() {
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);
  const [qrUrl, setQrUrl] = useState(null);

  return (
    <PortalShell activeTab="wireguard">
      {({ ispId }) => (
        <div className="mx-auto max-w-2xl space-y-8">
          <PortalFadeIn>
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white">WireGuard VPN</h2>
              <p className="mt-2 text-white/60">Look up your account to download config or scan QR on mobile.</p>
            </div>
          </PortalFadeIn>

          <PortalGlassCard>
            <PortalSectionHeader title="Account lookup" subtitle="Use the email registered on your VPN plan." />
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoading(true);
                setError('');
                setQrUrl(null);
                const result = await portalService.lookupWireguard({ account: account.trim(), ispId });
                setLoading(false);
                if (result.success) {
                  setStatus(result.data);
                } else {
                  setStatus(null);
                  setError(result.error || 'Not found');
                }
              }}
            >
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="your@email.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/40"
              />
              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full rounded-xl bg-indigo-500 py-3 font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : 'Look up'}
              </button>
            </form>
            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
          </PortalGlassCard>

          {status?.peer && (
            <PortalFadeIn>
              <PortalGlassCard>
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="h-6 w-6 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-white">{status.full_name}</p>
                    <p className="text-sm text-white/60">{status.package}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm text-white/80 mb-6">
                  <div><dt className="text-white/50">VPN IP</dt><dd className="font-mono">{status.peer.assigned_ip}</dd></div>
                  <div><dt className="text-white/50">Expires</dt><dd>{status.subscription_end ? formatDate(status.subscription_end) : '—'}</dd></div>
                  <div><dt className="text-white/50">Downloaded</dt><dd>{formatBytes(status.peer.rx_bytes)}</dd></div>
                  <div><dt className="text-white/50">Uploaded</dt><dd>{formatBytes(status.peer.tx_bytes)}</dd></div>
                  <div className="col-span-2"><dt className="text-white/50">Last handshake</dt><dd>{status.peer.last_handshake ? formatDate(status.peer.last_handshake) : 'Never'}</dd></div>
                </dl>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await portalService.downloadWireguardConfig({ account, ispId });
                      if (!res.success) toast.error(res.error);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-white hover:bg-white/15"
                  >
                    <Download className="h-4 w-4" /> Download .conf
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await portalService.fetchWireguardQrcode({ account, ispId });
                      if (res.success) setQrUrl(res.url);
                      else toast.error(res.error);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500/80 px-4 py-2.5 text-white hover:bg-indigo-500"
                  >
                    <QrCode className="h-4 w-4" /> Show QR code
                  </button>
                </div>
                {qrUrl && (
                  <div className="mt-6 flex justify-center">
                    <img src={qrUrl} alt="WireGuard QR" className="rounded-xl bg-white p-3 max-w-xs" />
                  </div>
                )}
              </PortalGlassCard>
            </PortalFadeIn>
          )}
        </div>
      )}
    </PortalShell>
  );
}
