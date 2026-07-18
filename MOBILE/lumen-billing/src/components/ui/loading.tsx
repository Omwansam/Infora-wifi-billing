import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { palette } from '@/lib/theme';
import { Button } from './button';

export function Loading({ label }: { label?: string }) {
  return (
    <View className="items-center justify-center px-6 py-20">
      <ActivityIndicator size="large" color={palette.brand[600]} />
      {label ? (
        <Text className="mt-3 text-sm text-ink-muted dark:text-ink-faint">{label}</Text>
      ) : null}
    </View>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center justify-center px-6 py-16">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-3xl bg-danger/10">
        <Ionicons name="cloud-offline-outline" size={30} color={palette.danger} />
      </View>
      <Text className="text-base font-bold text-ink dark:text-white">Couldn’t load data</Text>
      <Text className="mt-1 max-w-xs text-center text-sm text-ink-muted dark:text-ink-faint">
        {message ?? 'Something went wrong. Pull to refresh or try again.'}
      </Text>
      {onRetry ? (
        <View className="mt-5">
          <Button label="Try again" icon="refresh" variant="secondary" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
