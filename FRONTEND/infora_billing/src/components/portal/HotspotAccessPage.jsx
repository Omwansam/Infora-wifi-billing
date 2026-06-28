import React, { useState } from 'react';
import { Clock, Loader2, Wifi } from 'lucide-react';
import PortalShell from './PortalShell';
import { CopyCredential, PortalFadeIn, PortalGlassCard, PortalButton } from './PortalUI';
import portalService from '../../services/portalService';

function formatRemaining(seconds) {
  if (seconds == null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m} minutes left`;
}

export default function HotspotAccessPage() {
  return (
    <PortalShell activeTab="wifi">
      {({ ispId }) => <AccessLookup ispId={ispId} />}
    </PortalShell>
  );
}

function AccessLookup({ ispId }) {
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  const lookup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await portalService.lookupHotspot({ phone: phone || undefined, username: username || undefined, ispId });
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Account not found');
      setStatus(null);
      return;
    }
    setStatus(res.data);
  };

  return (
    <PortalFadeIn className="mx-auto max-w-lg space-y-6">
      <PortalGlassCard>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20">
            <Wifi className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">My WiFi access</h2>
            <p className="text-sm text-white/55">Recover credentials or check time remaining</p>
          </div>
        </div>
        <form onSubmit={lookup} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/45">Phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="254700000000"
              className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
            />
          </div>
          <p className="text-center text-xs text-white/35">or</p>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-white/45">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your hotspot username"
              className="w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <PortalButton type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look up access'}
          </PortalButton>
        </form>
      </PortalGlassCard>

      {status && (
        <PortalGlassCard glow={status.access?.has_internet}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-white">{status.access?.title}</p>
              <p className="mt-1 text-sm text-white/55">{status.access?.message}</p>
              <p className="mt-2 text-sm text-white/70">Package: {status.package}</p>
            </div>
            {status.remaining_seconds != null && status.access?.has_internet && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                <Clock className="h-3.5 w-3.5" />
                {formatRemaining(status.remaining_seconds)}
              </span>
            )}
          </div>
          {status.wifi_credentials && (
            <div className="mt-6 space-y-3">
              <CopyCredential label="Username" value={status.wifi_credentials.username} />
              <CopyCredential label="Password" value={status.wifi_credentials.password} />
            </div>
          )}
          {status.subscription_end && (
            <p className="mt-4 text-xs text-white/40">
              Expires: {new Date(status.subscription_end).toLocaleString()}
            </p>
          )}
        </PortalGlassCard>
      )}
    </PortalFadeIn>
  );
}
