import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
  right?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, onAction, right, className = '' }: SectionHeaderProps) {
  return (
    <View className={`mb-3 flex-row items-center justify-between ${className}`}>
      <Text className="text-base font-bold text-ink dark:text-white">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text className="text-sm font-semibold text-brand-600 dark:text-brand-400">{action}</Text>
        </Pressable>
      ) : (
        right
      )}
    </View>
  );
}
