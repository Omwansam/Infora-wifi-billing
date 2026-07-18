import { type ReactNode } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: ReactNode;
  /** Removes default inner padding when you need edge-to-edge content. */
  flush?: boolean;
  onPress?: () => void;
  className?: string;
}

const BASE =
  'rounded-2xl border border-line bg-surface dark:border-night-line dark:bg-night-card';

/**
 * Surface container used everywhere. Renders as a Pressable when `onPress` is
 * supplied so lists of cards stay tappable with a subtle press state.
 */
export function Card({ children, flush, onPress, className = '', ...rest }: CardProps) {
  const pad = flush ? '' : 'p-4';
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${BASE} ${pad} active:opacity-70 ${className}`}
        {...rest}>
        {children}
      </Pressable>
    );
  }
  return (
    <View className={`${BASE} ${pad} ${className}`} {...rest}>
      {children}
    </View>
  );
}
