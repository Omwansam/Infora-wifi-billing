import { View } from 'react-native';

interface ProgressBarProps {
  /** 0–100 */
  value: number;
  className?: string;
  tone?: 'brand' | 'success' | 'warning' | 'danger';
}

const TONES = {
  brand: 'bg-brand-600',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function ProgressBar({ value, className = '', tone }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  // Auto-escalate color by usage when no explicit tone is given.
  const resolved = tone ?? (pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'brand');
  return (
    <View className={`h-2 overflow-hidden rounded-full bg-surface-sunken dark:bg-night-raised ${className}`}>
      <View className={`h-full rounded-full ${TONES[resolved]}`} style={{ width: `${pct}%` }} />
    </View>
  );
}
