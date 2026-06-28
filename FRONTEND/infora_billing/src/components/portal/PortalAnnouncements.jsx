import React from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import { PortalFadeIn } from './PortalUI';

const TYPE_STYLES = {
  info: { bg: 'bg-blue-500/15 border-blue-400/30 text-blue-100', Icon: Info },
  warning: { bg: 'bg-amber-500/15 border-amber-400/30 text-amber-100', Icon: AlertTriangle },
  success: { bg: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100', Icon: CheckCircle2 },
  error: { bg: 'bg-red-500/15 border-red-400/30 text-red-100', Icon: XCircle },
};

export default function PortalAnnouncements({ announcements = [] }) {
  if (!announcements.length) return null;
  return (
    <div className="mb-6 space-y-2">
      {announcements.map((a) => {
        const style = TYPE_STYLES[a.type] || TYPE_STYLES.info;
        const Icon = style.Icon;
        return (
          <PortalFadeIn key={a.id}>
            <div className={`flex gap-3 rounded-xl border px-4 py-3 ${style.bg}`}>
              <Icon className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{a.title}</p>
                {a.message && <p className="mt-0.5 text-sm opacity-85">{a.message}</p>}
              </div>
            </div>
          </PortalFadeIn>
        );
      })}
    </div>
  );
}
