import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}

export function EmptyState({ icon = 'file-tray-outline', title, message }: EmptyStateProps) {
  return (
    <View className="items-center justify-center px-6 py-16">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-surface-sunken dark:bg-night-raised">
        <Ionicons name={icon} size={30} color="#94a3b8" />
      </View>
      <Text className="text-base font-bold text-ink dark:text-white">{title}</Text>
      {message ? (
        <Text className="mt-1 max-w-xs text-center text-sm text-ink-muted dark:text-ink-faint">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
