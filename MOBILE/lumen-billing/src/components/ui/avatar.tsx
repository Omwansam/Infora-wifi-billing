import { Text, View } from 'react-native';
import { initials } from '@/lib/format';

// Deterministic accent per name so avatars stay stable and varied.
const ACCENTS = [
  'bg-brand-600',
  'bg-violet',
  'bg-magenta',
  'bg-info',
  'bg-success',
  'bg-warning',
];

function accentFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i)) % ACCENTS.length;
  return ACCENTS[h];
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
}

const SIZES = {
  sm: { box: 'h-9 w-9', text: 'text-xs' },
  md: { box: 'h-11 w-11', text: 'text-sm' },
  lg: { box: 'h-16 w-16', text: 'text-xl' },
};

export function Avatar({ name, size = 'md', online }: AvatarProps) {
  const s = SIZES[size];
  return (
    <View>
      <View className={`${s.box} items-center justify-center rounded-full ${accentFor(name)}`}>
        <Text className={`font-bold text-white ${s.text}`}>{initials(name)}</Text>
      </View>
      {online !== undefined ? (
        <View
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface dark:border-night-card ${
            online ? 'bg-success' : 'bg-ink-faint'
          }`}
        />
      ) : null}
    </View>
  );
}
