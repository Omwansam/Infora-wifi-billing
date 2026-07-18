import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

const CONTAINER: Record<Variant, string> = {
  primary: 'bg-brand-600 active:bg-brand-700',
  secondary:
    'bg-surface border border-line active:bg-surface-sunken dark:bg-night-card dark:border-night-line',
  ghost: 'active:bg-surface-sunken dark:active:bg-night-raised',
  danger: 'bg-danger/10 active:bg-danger/20',
};
const LABEL: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-ink dark:text-white',
  ghost: 'text-brand-600 dark:text-brand-400',
  danger: 'text-danger',
};
const ICON_COLOR: Record<Variant, string> = {
  primary: '#ffffff',
  secondary: '#0f172a',
  ghost: '#2563eb',
  danger: '#ef4444',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  className = '',
}: ButtonProps) {
  const height = size === 'lg' ? 'h-14' : 'h-12';
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`${height} flex-row items-center justify-center rounded-xl px-5 ${CONTAINER[variant]} ${
        isDisabled ? 'opacity-50' : ''
      } ${className}`}>
      {loading ? (
        <ActivityIndicator color={ICON_COLOR[variant]} />
      ) : (
        <View className="flex-row items-center">
          {icon ? <Ionicons name={icon} size={18} color={ICON_COLOR[variant]} /> : null}
          <Text className={`text-base font-bold ${LABEL[variant]} ${icon ? 'ml-2' : ''}`}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}
