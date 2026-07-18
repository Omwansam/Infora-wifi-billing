import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Show a back chevron (defaults to true for stacked detail screens). */
  back?: boolean;
  right?: ReactNode;
}

/** Compact top bar for pushed/detail screens. */
export function PageHeader({ title, subtitle, back = true, right }: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  return (
    <View
      className="border-b border-line bg-surface px-4 pb-3 dark:border-night-line dark:bg-night-card"
      style={{ paddingTop: insets.top + 6 }}>
      <View className="flex-row items-center">
        {back ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={10}
            className="mr-2 h-9 w-9 items-center justify-center rounded-full active:bg-surface-sunken dark:active:bg-night-raised">
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
        ) : null}
        <View className="flex-1">
          <Text className="text-lg font-bold text-ink dark:text-white" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-[13px] text-ink-muted dark:text-ink-faint" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View className="ml-2">{right}</View> : null}
      </View>
    </View>
  );
}

interface LargeHeaderProps {
  greeting?: string;
  title: string;
  right?: ReactNode;
}

/** Large title header for top-level tab screens (no back button). */
export function LargeHeader({ greeting, title, right }: LargeHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View className="px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          {greeting ? (
            <Text className="text-sm font-medium text-ink-muted dark:text-ink-faint">{greeting}</Text>
          ) : null}
          <Text className="text-[26px] font-extrabold tracking-tight text-ink dark:text-white">
            {title}
          </Text>
        </View>
        {right ? <View className="ml-2">{right}</View> : null}
      </View>
    </View>
  );
}
