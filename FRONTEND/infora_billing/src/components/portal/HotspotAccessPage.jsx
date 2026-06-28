import React, { useState } from 'react';
import { Clock, Loader2, Wifi } from 'lucide-react';
import PortalShell from './PortalShell';
import { CopyCredential, PortalFadeIn, PortalGlassCard, PortalButton, PortalInput, PortalLabel } from './PortalUI';
import { portalClasses, usePortalTheme } from './PortalThemeContext';
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
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);
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
    <PortalFadeIn className="mx-auto max-w-lg space-y-5">
      <PortalGlassCard>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${accent}18` }}>
            <Wifi className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${cx.text}`}>My WiFi access</h2>
            <p className={`text-sm ${cx.textMuted}`}>Recover credentials or check time remaining</p>
          </div>
        </div>
        <form onSubmit={lookup} className="space-y-4">
          <div>
            <PortalLabel>Phone number</PortalLabel>
            <PortalInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="254700000000"
            />
          </div>
          <p className={`text-center text-xs ${cx.textSubtle}`}>or</p>
          <div>
            <PortalLabel>Username</PortalLabel>
            <PortalInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your hotspot username"
            />
          </div>
          {error && <p className={`text-sm ${isLight ? 'text-red-600' : 'text-red-300'}`}>{error}</p>}
          <PortalButton type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Look up access'}
          </PortalButton>
        </form>
      </PortalGlassCard>

      {status && (
        <PortalGlassCard glow={status.access?.has_internet}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={`text-lg font-semibold ${cx.text}`}>{status.access?.title}</p>
              <p className={`mt-1 text-sm ${cx.textMuted}`}>{status.access?.message}</p>
              <p className={`mt-2 text-sm ${cx.text}`}>Package: {status.package}</p>
            </div>
            {status.remaining_seconds != null && status.access?.has_internet && (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${isLight ? 'bg-emerald-50 text-emerald-700' : 'bg-emerald-500/20 text-emerald-200'}`}
              >
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
            <p className={`mt-4 text-xs ${cx.textSubtle}`}>
              Expires: {new Date(status.subscription_end).toLocaleString()}
            </p>
          )}
        </PortalGlassCard>
      )}
    </PortalFadeIn>
  );
}
