import React from 'react';
import ModulesSettings from './ModulesSettings';
import GeneralSettings from './GeneralSettings';
import CaptivePortalSettings from './CaptivePortalSettings';

/* -------------------------------------------------------------------------
 * Settings > Hotspot — the whole voucher-and-captive-portal surface in one
 * place: the module switch, how generated codes are shaped, and the portal
 * itself. These used to be three tabs apart even though nobody configures one
 * without the others.
 * ---------------------------------------------------------------------- */

export default function HotspotSettings({ isAdmin }) {
  return (
    <div className="space-y-6">
      <ModulesSettings
        isAdmin={isAdmin}
        only={['hotspot_enabled']}
        title="Hotspot"
        description="Time-based vouchers and WiFi access codes behind a captive portal"
      />
      <GeneralSettings section="hotspot-defaults" />
      <CaptivePortalSettings />
    </div>
  );
}
