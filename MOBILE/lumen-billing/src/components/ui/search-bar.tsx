import { Ionicons } from '@expo/vector-icons';
import { Pressable, TextInput, View } from 'react-native';
import { useAppTheme } from '@/lib/theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChangeText, placeholder = 'Search', className = '' }: SearchBarProps) {
  const theme = useAppTheme();
  return (
    <View
      className={`h-12 flex-row items-center rounded-xl border border-line bg-surface px-3 dark:border-night-line dark:bg-night-card ${className}`}>
      <Ionicons name="search" size={18} color={theme.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textFaint}
        className="ml-2 flex-1 text-base text-ink dark:text-white"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={theme.textFaint} />
        </Pressable>
      ) : null}
    </View>
  );
}
