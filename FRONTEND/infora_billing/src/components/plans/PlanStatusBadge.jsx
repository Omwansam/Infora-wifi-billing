import { CheckCircle, Star, XCircle } from 'lucide-react';

const STATUS_CONFIG = {
  active: { label: 'Active', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle },
  inactive: { label: 'Inactive', className: 'bg-slate-100 text-slate-700 ring-slate-600/20', icon: XCircle },
  popular: { label: 'Popular', className: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: Star },
};

export default function PlanStatusBadge({ status, size = 'sm' }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const Icon = config.icon;
  const sizeClass = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset ${config.className} ${sizeClass}`}>
      <Icon className={size === 'lg' ? 'h-4 w-4 mr-1.5' : 'h-3 w-3 mr-1'} />
      {config.label}
    </span>
  );
}
