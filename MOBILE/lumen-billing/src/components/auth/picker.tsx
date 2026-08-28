/**
 * A field that opens a sheet to choose one option.
 *
 * React Native has no `<select>`, and the wizard needs four of them (country
 * twice, currency, timezone, referral source). A modal list is the honest
 * mobile equivalent: the trigger looks exactly like the text inputs beside it,
 * so a form of mixed controls still reads as one form.
 *
 * The search box appears only past a threshold — a 33-row country list needs
 * one, an 8-row referral list does not, and an empty search field on a short
 * list is just another thing to look at.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AuthPalette } from '@/lib/auth-theme';

export interface PickerOption {
  value: string;
  label: string;
  /** Right-aligned secondary text — a dial code, a currency, an offset. */
  meta?: string;
}

const SEARCH_THRESHOLD = 12;

export function PickerField({
  palette,
  value,
  options,
  placeholder,
  title,
  onSelect,
  leading,
  invalid,
  disabled,
}: {
  palette: AuthPalette;
  value?: string;
  options: PickerOption[];
  placeholder: string;
  title: string;
  onSelect: (value: string) => void;
  /** Text shown before the label — a flag-ish country code, for instance. */
  leading?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.meta ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  return (
    <>
      <Pressable
        onPress={() => {
          if (disabled) return;
          setQuery('');
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={disabled}
        style={({ pressed }) => ({
          height: 50,
          borderWidth: 1,
          borderColor: invalid ? palette.err : pressed ? palette.accent : palette.line,
          borderRadius: 12,
          backgroundColor: palette.inset,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          opacity: disabled ? 0.6 : 1,
        })}>
        {leading ? (
          <Text style={{ color: palette.textDim, fontSize: 15, fontWeight: '600' }}>{leading}</Text>
        ) : null}
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 15,
            color: selected ? palette.text : palette.textFaint,
          }}>
          {selected?.label ?? placeholder}
        </Text>
        {selected?.meta ? (
          <Text style={{ color: palette.textDim, fontSize: 13 }}>{selected.meta}</Text>
        ) : null}
        <Ionicons name="chevron-down" size={16} color={palette.textFaint} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}
        />
        <View
          style={{
            maxHeight: '72%',
            backgroundColor: palette.card,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderTopWidth: 1,
            borderColor: palette.line,
            paddingBottom: insets.bottom + 8,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 18,
              paddingTop: 16,
              paddingBottom: 12,
            }}>
            <Text style={{ color: palette.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={palette.textDim} />
            </Pressable>
          </View>

          {options.length > SEARCH_THRESHOLD ? (
            <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  height: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: palette.line,
                  backgroundColor: palette.inset,
                  paddingHorizontal: 12,
                }}>
                <Ionicons name="search" size={16} color={palette.textFaint} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search"
                  placeholderTextColor={palette.textFaint}
                  autoCorrect={false}
                  style={{ flex: 1, color: palette.text, fontSize: 15 }}
                />
              </View>
            </View>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => (
              <View style={{ height: 1, backgroundColor: palette.lineSoft, marginLeft: 18 }} />
            )}
            ListEmptyComponent={
              <Text
                style={{
                  color: palette.textFaint,
                  fontSize: 14,
                  textAlign: 'center',
                  paddingVertical: 28,
                }}>
                Nothing matches “{query}”.
              </Text>
            }
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.value);
                    setOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 18,
                    paddingVertical: 14,
                    backgroundColor: pressed ? palette.lineSoft : 'transparent',
                  })}>
                  <Text
                    style={{
                      flex: 1,
                      color: active ? palette.accent : palette.text,
                      fontSize: 15,
                      fontWeight: active ? '700' : '500',
                    }}>
                    {item.label}
                  </Text>
                  {item.meta ? (
                    <Text style={{ color: palette.textDim, fontSize: 13.5 }}>{item.meta}</Text>
                  ) : null}
                  {active ? (
                    <Ionicons name="checkmark" size={17} color={palette.accent} />
                  ) : null}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </>
  );
}
