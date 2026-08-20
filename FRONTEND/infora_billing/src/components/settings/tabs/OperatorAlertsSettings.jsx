import React from 'react';
import { BellRing } from 'lucide-react';
import NotificationsSettings from './NotificationsSettings';
import IntegrationsSettings from './IntegrationsSettings';
import { Note } from '../ui';

/* -------------------------------------------------------------------------
 * Settings > Operator alerts.
 *
 * The one notification group that is not addressed to a subscriber: router
 * health, sent to whoever runs the network. Paired with the Telegram bot,
 * because a router going down at 2am is not an email you will read.
 * ---------------------------------------------------------------------- */

export default function OperatorAlertsSettings() {
  return (
    <div className="space-y-6">
      <Note icon={BellRing} title="These go to your team, not your subscribers" tone="info">
        <p className="mt-1">
          Everything below is addressed to the people running the network. Subscriber-facing
          receipts and reminders live under Message templates.
        </p>
      </Note>

      <NotificationsSettings only={['router_health']} intro={false} />

      <IntegrationsSettings
        only={['telegram']}
        title="Where alerts land"
        description="Connect a channel that somebody actually watches out of hours"
      />
    </div>
  );
}
