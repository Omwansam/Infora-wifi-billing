import {
  Award,
  CheckCircle,
  Download,
  Gift,
  Globe,
  Headphones,
  Network,
  Router,
  Settings,
  Shield,
  Smartphone,
  Upload,
  Zap,
} from 'lucide-react';

const ICON_MAP = [
  { match: (text) => /speed|mbps|gbps/.test(text), Icon: Zap, className: 'text-sky-500' },
  { match: (text) => /download/.test(text), Icon: Download, className: 'text-emerald-500' },
  { match: (text) => /upload/.test(text), Icon: Upload, className: 'text-violet-500' },
  { match: (text) => /device|unlimited/.test(text), Icon: Smartphone, className: 'text-indigo-500' },
  { match: (text) => /support/.test(text), Icon: Headphones, className: 'text-orange-500' },
  { match: (text) => /data/.test(text), Icon: Globe, className: 'text-cyan-500' },
  { match: (text) => /static ip|ip address/.test(text), Icon: Network, className: 'text-rose-500' },
  { match: (text) => /router/.test(text), Icon: Router, className: 'text-amber-500' },
  { match: (text) => /sla|guarantee/.test(text), Icon: Shield, className: 'text-emerald-600' },
  { match: (text) => /dedicated/.test(text), Icon: Award, className: 'text-pink-500' },
  { match: (text) => /discount|student|senior/.test(text), Icon: Gift, className: 'text-rose-500' },
  { match: (text) => /setup|easy/.test(text), Icon: Settings, className: 'text-slate-500' },
];

export default function PlanFeatureIcon({ feature, size = 'sm' }) {
  const text = String(feature || '').toLowerCase();
  const sizeClass = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const match = ICON_MAP.find((entry) => entry.match(text));
  const Icon = match?.Icon || CheckCircle;
  const className = match?.className || 'text-emerald-500';

  return <Icon className={`${sizeClass} ${className}`} />;
}
