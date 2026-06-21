import { Activity, CheckCircle, Clock, XCircle, Wrench } from 'lucide-react';

const STATUS_CONFIG = {
  online: { label: 'Online', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle },
  offline: { label: 'Offline', className: 'bg-rose-50 text-rose-700 ring-rose-600/20', icon: XCircle },
  maintenance: { label: 'Maintenance', className: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: Wrench },
  decommissioned: { label: 'Decommissioned', className: 'bg-slate-100 text-slate-600 ring-slate-500/20', icon: Clock },
  unknown: { label: 'Unknown', className: 'bg-slate-100 text-slate-600 ring-slate-500/20', icon: Activity },
};

export default function DeviceStatusBadge({ status, size = 'sm' }) {
  const key = (status || 'unknown').toLowerCase();
  const config = STATUS_CONFIG[key] || STATUS_CONFIG.unknown;
  const Icon = config.icon;
  const sizeClass = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center rounded-full font-semibold ring-1 ring-inset ${config.className} ${sizeClass}`}>
      <Icon className={size === 'lg' ? 'h-4 w-4 mr-1.5' : 'h-3 w-3 mr-1'} />
      {config.label}
    </span>
  );
}
