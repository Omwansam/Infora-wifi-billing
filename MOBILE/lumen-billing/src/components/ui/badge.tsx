import { Text, View } from 'react-native';
import { humanize } from '@/lib/format';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const TONES: Record<Tone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  brand: 'bg-brand-600/10 text-brand-600 dark:text-brand-400',
  neutral: 'bg-slate-500/10 text-ink-muted dark:text-ink-faint',
};

const DOT_TONES: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  brand: 'bg-brand-600',
  neutral: 'bg-ink-faint',
};

// Maps domain statuses to a tone.
const STATUS_TONE: Record<string, Tone> = {
  active: 'success',
  online: 'success',
  completed: 'success',
  paid: 'success',
  verified: 'success',
  resolved: 'success',
  won: 'success',
  pending: 'warning',
  suspended: 'warning',
  in_progress: 'info',
  open: 'info',
  overdue: 'danger',
  failed: 'danger',
  rejected: 'danger',
  expired: 'danger',
  offline: 'danger',
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
  used: 'neutral',
  draft: 'neutral',
  closed: 'neutral',
  inactive: 'neutral',
};

export function toneFor(status: string): Tone {
  return STATUS_TONE[status.toLowerCase()] ?? 'neutral';
}

interface BadgeProps {
  label: string;
  tone?: Tone;
  /** When true, `label` is treated as a status and both tone + text derive from it. */
  status?: boolean;
  dot?: boolean;
  className?: string;
}

export function Badge({ label, tone, status, dot, className = '' }: BadgeProps) {
  const resolvedTone = tone ?? (status ? toneFor(label) : 'neutral');
  const text = status ? humanize(label) : label;
  return (
    <View
      className={`flex-row items-center self-start rounded-full px-2.5 py-1 ${TONES[resolvedTone]} ${className}`}>
      {dot ? <View className={`mr-1.5 h-1.5 w-1.5 rounded-full ${DOT_TONES[resolvedTone]}`} /> : null}
      <Text className={`text-xs font-semibold ${TONES[resolvedTone]}`}>{text}</Text>
    </View>
  );
}
