import React from 'react';
import ApiKeysSettings from './ApiKeysSettings';
import IntegrationsSettings from './IntegrationsSettings';

/* -------------------------------------------------------------------------
 * Settings > Developer — API tokens and the webhook endpoint together, since
 * the signing secret on the keys panel is what verifies the webhook deliveries
 * configured just below it.
 * ---------------------------------------------------------------------- */

export default function DeveloperSettings() {
  return (
    <div className="space-y-6">
      <ApiKeysSettings />
      <IntegrationsSettings
        only={['webhooks']}
        title="Outbound webhooks"
        description="POST payments, sessions and ticket events to your own endpoint as they happen"
      />
    </div>
  );
}
