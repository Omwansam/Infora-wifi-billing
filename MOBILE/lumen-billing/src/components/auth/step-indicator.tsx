/**
 * The 1–5 progress pips, with an optional back affordance.
 *
 * `onBack` is omitted rather than disabled on step 1 — there is nowhere to go
 * back to, and a dead control reads as broken. Same rule the console's wizard
 * follows.
 */
import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { AuthPalette } from '@/lib/auth-theme';

export const TOTAL_STEPS = 5;

export function StepIndicator({
  palette,
  current,
  onBack,
  disabled,
}: {
  palette: AuthPalette;
  current: number;
  onBack?: () => void;
  disabled?: boolean;
}) {
  const steps = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${current} of ${TOTAL_STEPS}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 22 }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          disabled={disabled}
          hitSlop={8}
          accessibilityRole="button"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            marginRight: 6,
            opacity: disabled ? 0.5 : 1,
          }}>
          <Ionicons name="chevron-back" size={15} color={palette.textDim} />
          <Text style={{ color: palette.textDim, fontSize: 13, fontWeight: '600' }}>Back</Text>
        </Pressable>
      ) : null}

      {steps.map((step) => {
        const done = step < current;
        const active = step === current;
        return (
          <Fragment key={step}>
            {step > 1 ? (
              <View
                style={{
                  flex: 1,
                  height: 1.5,
                  borderRadius: 999,
                  backgroundColor: done || active ? palette.accent : palette.line,
                }}
              />
            ) : null}
            <View
              style={{
                height: 26,
                width: 26,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: active ? 1.5 : 0,
                borderColor: palette.accent,
                backgroundColor: done
                  ? palette.accent
                  : active
                    ? palette.accentSoft
                    : palette.lineSoft,
              }}>
              {done ? (
                <Ionicons name="checkmark" size={14} color={palette.onAccent} />
              ) : (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: active ? palette.accent : palette.textFaint,
                  }}>
                  {step}
                </Text>
              )}
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}
