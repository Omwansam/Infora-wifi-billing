import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

interface IconTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  bg?: string;
  size?: number;
}

/** Rounded square icon container used in menu + list rows. */
export function IconTile({ icon, color = '#2563eb', bg = 'bg-brand-600/10', size = 20 }: IconTileProps) {
  return (
    <View className={`h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
      <Ionicons name={icon} size={size} color={color} />
    </View>
  );
}

interface ListRowProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  className?: string;
}

/** Generic tappable row: [left] title/subtitle … [right] [chevron]. */
export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  showChevron,
  className = '',
}: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center py-3 ${onPress ? 'active:opacity-60' : ''} ${className}`}>
      {left ? <View className="mr-3">{left}</View> : null}
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-ink dark:text-white" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-[13px] text-ink-muted dark:text-ink-faint" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="ml-3 items-end">{right}</View> : null}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color="#cbd5e1" style={{ marginLeft: 6 }} />
      ) : null}
    </Pressable>
  );
}

/** Thin divider between rows inside a Card. */
export function Divider() {
  return <View className="h-px bg-line dark:bg-night-line" />;
}

interface KeyValueProps {
  label: string;
  value: string;
  valueClassName?: string;
}

/** Label ⟷ value row for detail screens. */
export function KeyValue({ label, value, valueClassName = '' }: KeyValueProps) {
  return (
    <View className="flex-row items-center justify-between py-2.5">
      <Text className="text-sm text-ink-muted dark:text-ink-faint">{label}</Text>
      <Text className={`text-sm font-semibold text-ink dark:text-white ${valueClassName}`}>{value}</Text>
    </View>
  );
}
