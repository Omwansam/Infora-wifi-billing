import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { Card } from './card';

type IconName = keyof typeof Ionicons.glyphMap;

interface StatCardProps {
  label: string;
  value: string;
  icon: IconName;
  /** Tailwind text/bg accent, e.g. "brand", "success". */
  accent?: 'brand' | 'success' | 'warning' | 'danger' | 'violet' | 'info';
  delta?: { value: string; up: boolean };
  onPress?: () => void;
}

const ACCENTS = {
  brand: { bg: 'bg-brand-600/10', fg: '#2563eb' },
  success: { bg: 'bg-success/10', fg: '#10b981' },
  warning: { bg: 'bg-warning/10', fg: '#f59e0b' },
  danger: { bg: 'bg-danger/10', fg: '#ef4444' },
  violet: { bg: 'bg-violet/10', fg: '#6366f1' },
  info: { bg: 'bg-info/10', fg: '#0ea5e9' },
};

export function StatCard({ label, value, icon, accent = 'brand', delta, onPress }: StatCardProps) {
  const a = ACCENTS[accent];
  return (
    <Card onPress={onPress} className="flex-1">
      <View className="mb-3 flex-row items-center justify-between">
        <View className={`h-9 w-9 items-center justify-center rounded-xl ${a.bg}`}>
          <Ionicons name={icon} size={18} color={a.fg} />
        </View>
        {delta ? (
          <View className="flex-row items-center">
            <Ionicons
              name={delta.up ? 'trending-up' : 'trending-down'}
              size={13}
              color={delta.up ? '#10b981' : '#ef4444'}
            />
            <Text
              className={`ml-1 text-xs font-semibold ${delta.up ? 'text-success' : 'text-danger'}`}>
              {delta.value}
            </Text>
          </View>
        ) : null}
      </View>
      <Text className="text-2xl font-extrabold text-ink dark:text-white" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text className="mt-0.5 text-xs font-medium text-ink-muted dark:text-ink-faint" numberOfLines={1}>
        {label}
      </Text>
    </Card>
  );
}
