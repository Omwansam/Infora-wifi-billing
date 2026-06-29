import React, { useState } from 'react';
import { Ticket, Loader2 } from 'lucide-react';
import PortalShell from './PortalShell';
import { CopyCredential, PortalFadeIn, PortalGlassCard, PortalButton, PortalInput, PortalLabel } from './PortalUI';
import { portalClasses, usePortalTheme } from './PortalThemeContext';
import portalService from '../../services/portalService';

export default function HotspotVoucherPage() {
  return (
    <PortalShell activeTab="voucher">
      {({ config, ispId, routerId }) => (
        <VoucherRedeem config={config} ispId={ispId} routerId={routerId} />
      )}
    </PortalShell>
  );
}

function VoucherRedeem({ config, ispId, routerId }) {
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await portalService.redeemVoucher({ code, phone, ispId, routerId });
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'Invalid voucher');
      return;
    }
    setResult(res.data);
  };

  if (result?.wifi_credentials) {
    return (
      <PortalFadeIn className="mx-auto max-w-lg">
        <PortalGlassCard glow>
          <h2 className={`text-xl font-bold ${cx.text}`}>Voucher activated</h2>
          <p className={`mt-2 text-sm ${cx.textMuted}`}>Use these credentials on the hotspot login page.</p>
          <div className="mt-6 space-y-3">
            <CopyCredential label="Username" value={result.wifi_credentials.username} />
            <CopyCredential label="Password" value={result.wifi_credentials.password} />
          </div>
          {result.expires_at && (
            <p className="mt-4 text-xs" style={{ color: accent }}>
              Valid until {new Date(result.expires_at).toLocaleString()}
            </p>
          )}
        </PortalGlassCard>
      </PortalFadeIn>
    );
  }

  return (
    <PortalFadeIn className="mx-auto max-w-lg">
      <PortalGlassCard>
        <div className="mb-6 flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--portal-accent-soft)' }}
          >
            <Ticket className="h-5 w-5" style={{ color: accent }} />
          </div>
          <div>
            <h2 className={`text-xl font-bold ${cx.text}`}>Redeem voucher</h2>
            <p className={`text-sm ${cx.textMuted}`}>Enter the code from your WiFi card or receipt</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <PortalLabel>Voucher code</PortalLabel>
            <PortalInput
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. CAFE001"
              required
            />
          </div>
          <div>
            <PortalLabel>Phone (optional)</PortalLabel>
            <PortalInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="254700000000"
            />
          </div>
          {error && <p className={`text-sm ${isLight ? 'text-red-600' : 'text-red-300'}`}>{error}</p>}
          <PortalButton type="submit" disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Redeem & connect'}
          </PortalButton>
        </form>
        {config?.support_phone && (
          <p className={`mt-4 text-center text-xs ${cx.textSubtle}`}>
            Need help? Call {config.support_phone}
          </p>
        )}
      </PortalGlassCard>
    </PortalFadeIn>
  );
}
