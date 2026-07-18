import { type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette } from '@/lib/theme';

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a vertical ScrollView (default true). */
  scroll?: boolean;
  className?: string;
  /** Extra bottom padding so content clears the tab bar / gestures. */
  contentClassName?: string;
  /** Enables pull-to-refresh when provided. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

/**
 * Standard page shell: fills the safe area, paints the app background and
 * (optionally) scrolls. Screens compose their own header above this.
 */
export function Screen({
  children,
  scroll = true,
  className = '',
  contentClassName = '',
  onRefresh,
  refreshing = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const body = (
    <View className={`px-4 ${contentClassName}`} style={{ paddingBottom: insets.bottom + 96 }}>
      {children}
    </View>
  );
  return (
    <View className={`flex-1 bg-surface-muted dark:bg-night ${className}`}>
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={palette.brand[600]}
                colors={[palette.brand[600]]}
              />
            ) : undefined
          }>
          {body}
        </ScrollView>
      ) : (
        <View className="flex-1">{body}</View>
      )}
    </View>
  );
}
