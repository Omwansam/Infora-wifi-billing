import { ScrollView, Text, View } from 'react-native';
import { Pressable } from 'react-native';

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Horizontally scrolling pill filter — used on list screens. */
export function FilterChips({ options, value, onChange, className = '' }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 16 }}
      className={className}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`flex-row items-center rounded-full border px-3.5 py-2 ${
              active
                ? 'border-brand-600 bg-brand-600'
                : 'border-line bg-surface dark:border-night-line dark:bg-night-card'
            }`}>
            <Text
              className={`text-sm font-semibold ${
                active ? 'text-white' : 'text-ink-soft dark:text-ink-faint'
              }`}>
              {opt.label}
            </Text>
            {opt.count !== undefined ? (
              <View
                className={`ml-1.5 rounded-full px-1.5 ${
                  active ? 'bg-white/25' : 'bg-surface-sunken dark:bg-night-raised'
                }`}>
                <Text
                  className={`text-xs font-bold ${
                    active ? 'text-white' : 'text-ink-muted dark:text-ink-faint'
                  }`}>
                  {opt.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

interface SegmentedProps {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
}

/** Fixed-width segmented control (2–3 options) for compact toggles. */
export function Segmented({ options, value, onChange }: SegmentedProps) {
  return (
    <View className="flex-row rounded-xl bg-surface-sunken p-1 dark:bg-night-raised">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            className={`flex-1 items-center rounded-lg py-2 ${
              active ? 'bg-surface dark:bg-night-card' : ''
            }`}>
            <Text
              className={`text-sm font-semibold ${
                active ? 'text-ink dark:text-white' : 'text-ink-muted dark:text-ink-faint'
              }`}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
