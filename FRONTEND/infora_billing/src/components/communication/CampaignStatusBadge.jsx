import { CheckCircle, Clock, PauseCircle, Send } from 'lucide-react';

const STATUS_CONFIG = {
  Active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: Send },
  Completed: { label: 'Completed', className: 'bg-blue-50 text-blue-700 ring-blue-600/20', icon: CheckCircle },
  Scheduled: { label: 'Scheduled', className: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: Clock },
  Paused: { label: 'Paused', className: 'bg-rose-50 text-rose-700 ring-rose-600/20', icon: PauseCircle },
};

export default function CampaignStatusBadge({ status, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Scheduled;
  const Icon = config.icon;
  const sizeClass = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset ${config.className} ${sizeClass}`}>
      <Icon className={size === 'lg' ? 'h-4 w-4 mr-1.5' : 'h-3 w-3 mr-1'} />
      {config.label}
    </span>
  );
}
