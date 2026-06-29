import React from 'react';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import { PortalFadeIn } from './PortalUI';
import { usePortalTheme } from './PortalThemeContext';

function classesFor(type, isLight) {
  if (type === 'success') {
    return {
      style: {
        backgroundColor: 'var(--portal-accent-soft)',
        borderColor: 'var(--portal-accent-ring)',
        color: 'var(--portal-accent)',
      },
      Icon: CheckCircle2,
    };
  }
  if (type === 'warning') {
    return {
      className: isLight
        ? 'bg-amber-50 border-amber-200 text-amber-900'
        : 'bg-amber-500/15 border-amber-400/30 text-amber-100',
      Icon: AlertTriangle,
    };
  }
  if (type === 'error') {
    return {
      className: isLight
        ? 'bg-red-50 border-red-200 text-red-900'
        : 'bg-red-500/15 border-red-400/30 text-red-100',
      Icon: XCircle,
    };
  }
  return {
    className: isLight
      ? 'bg-blue-50 border-blue-200 text-blue-900'
      : 'bg-blue-500/15 border-blue-400/30 text-blue-100',
    Icon: Info,
  };
}

export default function PortalAnnouncements({ announcements = [] }) {
  const { isLight } = usePortalTheme();
  if (!announcements.length) return null;

  return (
    <div className="mb-6 space-y-2">
      {announcements.map((a) => {
        const { className, style, Icon } = classesFor(a.type, isLight);
        return (
          <PortalFadeIn key={a.id}>
            <div
              className={`flex gap-3 rounded-xl border px-4 py-3 ${className || ''}`}
              style={style}
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{a.title}</p>
                {a.message && <p className="mt-0.5 text-sm opacity-85">{a.message}</p>}
              </div>
            </div>
          </PortalFadeIn>
        );
      })}
    </div>
  );
}
