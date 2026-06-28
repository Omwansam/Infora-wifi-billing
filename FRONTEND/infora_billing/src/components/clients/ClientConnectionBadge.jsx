import { Wifi, WifiOff } from 'lucide-react';

const STYLES = {
  connected: {
    label: 'Connected',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    icon: Wifi,
    dot: 'bg-emerald-500',
  },
  suspended: {
    label: 'Disconnected',
    className: 'bg-slate-100 text-slate-600 ring-slate-500/15',
    icon: WifiOff,
    dot: 'bg-slate-400',
  },
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    icon: WifiOff,
    dot: 'bg-amber-400',
  },
};

export default function ClientConnectionBadge({ connected, status }) {
  const key = connected ? 'connected' : status === 'pending' ? 'pending' : 'suspended';
  const config = STYLES[key];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${config.className}`}
    >
      {connected ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dot}`} />
        </span>
      ) : (
        <Icon className="h-3 w-3 shrink-0" />
      )}
      {config.label}
    </span>
  );
}
