import React from 'react';
import { accentForeground, buildAccentCssVars } from '../../lib/portalColor';
import { themeBackground } from '../../lib/portalThemePreviews';

/**
 * Miniature live preview of the captive portal as customers will see it.
 * Reflects the selected layout theme + brand accent color from settings.
 */
export default function PortalLivePreview({
  themeKey = 'clean',
  accentColor = '#1BA449',
  hotspotName = 'My WiFi',
  logoUrl = null,
}) {
  const meta = themeBackground(themeKey);
  const accentFg = accentForeground(accentColor);
  const vars = buildAccentCssVars(accentColor);
  const displayName = hotspotName || 'My WiFi';

  const cardBg = meta.isLight ? '#ffffff' : 'rgba(255,255,255,0.06)';
  const cardBorder = meta.isLight ? '#e2e8f0' : 'rgba(255,255,255,0.12)';
  const muted = meta.isLight ? '#64748b' : 'rgba(255,255,255,0.6)';
  const navBg = meta.isLight ? '#f1f5f9' : 'rgba(0,0,0,0.3)';

  return (
    <div
      className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm"
      style={{ ...vars, background: meta.bg, color: meta.text }}
    >
      {/* Header */}
      <div
        className="border-b px-4 py-3"
        style={{ borderColor: cardBorder, background: meta.isLight ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.25)' }}
      >
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
              style={{ backgroundColor: accentColor, color: accentFg }}
            >
              {displayName[0]}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{displayName}</p>
            <p className="truncate text-[10px]" style={{ color: muted }}>
              Fast, reliable internet
            </p>
          </div>
        </div>
        <div className="mt-2.5 inline-flex gap-1 rounded-lg p-0.5" style={{ background: navBg }}>
          {['Buy', 'Voucher', 'Login'].map((tab, i) => (
            <span
              key={tab}
              className="rounded-md px-2.5 py-1 text-[10px] font-medium"
              style={
                i === 0
                  ? { backgroundColor: accentColor, color: accentFg }
                  : { color: muted }
              }
            >
              {tab}
            </span>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="space-y-3 p-4">
        <div
          className="rounded-xl border p-3"
          style={{ background: cardBg, borderColor: cardBorder }}
        >
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: 'var(--portal-accent-soft)', color: accentColor }}
          >
            Pay with M-Pesa
          </span>
          <p className="mt-2 text-xs font-bold">WiFi packages</p>
          <p className="text-[10px]" style={{ color: muted }}>
            Pick a bundle and pay with M-Pesa
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { name: '1 Hour', price: 'KES 10' },
            { name: '1 Day', price: 'KES 50', popular: true },
          ].map((plan) => (
            <div
              key={plan.name}
              className="rounded-xl border p-2.5"
              style={{
                background: cardBg,
                borderColor: plan.popular ? accentColor : cardBorder,
                boxShadow: plan.popular ? `0 8px 20px -12px var(--portal-accent-glow)` : undefined,
              }}
            >
              <p className="text-[10px] font-semibold">{plan.name}</p>
              <p className="mt-1 text-xs font-bold">{plan.price}</p>
              <div
                className="mt-2 rounded-lg py-1 text-center text-[9px] font-semibold"
                style={{
                  backgroundColor: plan.popular ? accentColor : 'var(--portal-accent-soft)',
                  color: plan.popular ? accentFg : accentColor,
                }}
              >
                Buy
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
