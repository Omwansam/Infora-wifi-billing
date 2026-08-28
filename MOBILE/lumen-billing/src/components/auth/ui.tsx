/**
 * Form primitives shared by sign-in and the signup wizard.
 *
 * Every one of them takes the `AuthPalette` for the scope it is rendering in
 * rather than reading a theme itself, so the same control is emerald on the
 * sign-in card and amber inside the wizard without a single conditional. That
 * mirrors how the web build scopes `--auth-*` and `--onb-*`: the palette is a
 * property of the page, not of the button.
 */
import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { mono, type AuthPalette } from '@/lib/auth-theme';

/* --- Card --------------------------------------------------------------- */

export function AuthCard({
  palette,
  children,
  maxWidth = 440,
}: {
  palette: AuthPalette;
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <View
      style={{
        width: '100%',
        maxWidth,
        alignSelf: 'center',
        backgroundColor: palette.card,
        borderColor: palette.line,
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 22,
        paddingTop: 26,
        paddingBottom: 24,
        // Elevation reads as depth on Android; iOS gets the soft drop shadow
        // the web card has.
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOpacity: palette.scheme === 'dark' ? 0.5 : 0.12,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 18 },
          },
          android: { elevation: 8 },
          default: {},
        }),
      }}>
      {children}
    </View>
  );
}

/* --- Headings ----------------------------------------------------------- */

export function AuthBadge({
  palette,
  icon,
  label,
}: {
  palette: AuthPalette;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: palette.accentSoft,
        marginBottom: 12,
      }}>
      <Ionicons name={icon} size={13} color={palette.accentHi} />
      <Text
        style={{
          color: palette.accentHi,
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 1,
        }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function AuthTitle({
  palette,
  children,
  align = 'center',
}: {
  palette: AuthPalette;
  children: ReactNode;
  align?: 'center' | 'left';
}) {
  return (
    <Text
      style={{
        color: palette.text,
        fontSize: 26,
        fontWeight: '800',
        letterSpacing: -0.6,
        textAlign: align,
      }}>
      {children}
    </Text>
  );
}

export function AuthSubtitle({
  palette,
  children,
  align = 'center',
}: {
  palette: AuthPalette;
  children: ReactNode;
  align?: 'center' | 'left';
}) {
  return (
    <Text
      style={{
        color: palette.textDim,
        fontSize: 14,
        lineHeight: 21,
        textAlign: align,
        marginTop: 8,
      }}>
      {children}
    </Text>
  );
}

/* --- Fields ------------------------------------------------------------- */

export function Field({
  palette,
  label,
  required,
  trailing,
  hint,
  error,
  children,
}: {
  palette: AuthPalette;
  label: string;
  required?: boolean;
  /** Rendered opposite the label — "Forgot password?" and friends. */
  trailing?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 7 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
        <Text style={{ color: palette.text, fontSize: 13, fontWeight: '600' }}>
          {label}
          {required ? <Text style={{ color: palette.err }}> *</Text> : null}
        </Text>
        {trailing}
      </View>
      {children}
      {error ? (
        <Text style={{ color: palette.err, fontSize: 12.5, lineHeight: 18 }}>{error}</Text>
      ) : hint ? (
        typeof hint === 'string' ? (
          <Text style={{ color: palette.textFaint, fontSize: 12.5, lineHeight: 18 }}>{hint}</Text>
        ) : (
          hint
        )
      ) : null}
    </View>
  );
}

interface AuthInputProps extends TextInputProps {
  palette: AuthPalette;
  /** Leaves room on the right for a reveal button or a status icon. */
  padded?: boolean;
  invalid?: boolean;
}

export const AuthInput = forwardRef<TextInput, AuthInputProps>(function AuthInput(
  { palette, padded, invalid, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const borderColor = invalid ? palette.err : focused ? palette.accent : palette.line;
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={palette.textFaint}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        {
          height: 50,
          borderWidth: 1,
          borderColor,
          borderRadius: 12,
          backgroundColor: palette.inset,
          paddingHorizontal: 14,
          paddingRight: padded ? 46 : 14,
          fontSize: 15,
          color: palette.text,
        },
        // The web input gets a 3px focus ring; a coloured border plus a soft
        // glow is the native equivalent that survives both platforms.
        focused && !invalid
          ? Platform.select({
              ios: {
                shadowColor: palette.accent,
                shadowOpacity: 0.35,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 0 },
              },
              default: {},
            })
          : null,
        style,
      ]}
      {...rest}
    />
  );
});

/** The reveal / status control that sits inside a `padded` input. */
export function InputAdornment({
  palette,
  icon,
  onPress,
  label,
  color,
}: {
  palette: AuthPalette;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  label?: string;
  color?: string;
}) {
  const content = (
    <Ionicons name={icon} size={18} color={color ?? palette.textFaint} />
  );
  return (
    <View style={{ position: 'absolute', right: 6, top: 0, bottom: 0, justifyContent: 'center' }}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={{ padding: 8 }}>
          {content}
        </Pressable>
      ) : (
        <View style={{ padding: 8 }}>{content}</View>
      )}
    </View>
  );
}

/**
 * The 6-digit code field.
 *
 * Spaced and centred in monospace for the same reason the web one is: a
 * transposed digit has to be obvious before you press the button.
 */
export function CodeInput({
  palette,
  value,
  onChangeText,
  invalid,
  maxLength = 6,
  numeric = true,
  placeholder = '000000',
}: {
  palette: AuthPalette;
  value: string;
  onChangeText: (v: string) => void;
  invalid?: boolean;
  maxLength?: number;
  numeric?: boolean;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      autoFocus
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={numeric ? 'number-pad' : 'default'}
      textContentType="oneTimeCode"
      autoComplete={numeric ? 'sms-otp' : 'off'}
      maxLength={maxLength}
      placeholder={placeholder}
      placeholderTextColor={palette.textFaint}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        ...mono,
        height: 62,
        borderWidth: 1,
        borderColor: invalid ? palette.err : focused ? palette.accent : palette.line,
        borderRadius: 12,
        backgroundColor: palette.inset,
        textAlign: 'center',
        fontSize: numeric ? 26 : 18,
        letterSpacing: numeric ? 10 : 2,
        color: palette.text,
      }}
    />
  );
}

/* --- Buttons ------------------------------------------------------------ */

export function AuthSubmit({
  palette,
  label,
  onPress,
  loading,
  disabled,
  icon,
}: {
  palette: AuthPalette;
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const off = disabled || loading;
  // A not-yet-valid form gets a flat, unavailable-looking button rather than a
  // dimmed accent: amber or emerald at half opacity over a near-black card just
  // reads as a muddy version of the real thing.
  const inert = disabled && !loading;
  const fg = inert ? palette.textFaint : palette.onAccent;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      style={({ pressed }) => ({
        height: 50,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: inert ? 1 : 0,
        borderColor: palette.line,
        backgroundColor: inert
          ? palette.lineSoft
          : pressed
            ? palette.accentHi
            : palette.accent,
        opacity: loading ? 0.75 : 1,
      })}>
      {loading ? <ActivityIndicator size="small" color={palette.onAccent} /> : null}
      {!loading && icon ? <Ionicons name={icon} size={17} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 15, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function AuthAltButton({
  palette,
  label,
  icon,
  onPress,
}: {
  palette: AuthPalette;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: pressed ? palette.accent : palette.line,
        backgroundColor: palette.inset,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
      })}>
      {icon ? <Ionicons name={icon} size={17} color={palette.accent} /> : null}
      <Text style={{ color: palette.text, fontSize: 14.5, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function AuthLink({
  palette,
  label,
  onPress,
  align = 'left',
  disabled,
}: {
  palette: AuthPalette;
  label: string;
  onPress: () => void;
  align?: 'left' | 'center';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      style={{ alignSelf: align === 'center' ? 'center' : 'flex-start' }}>
      {({ pressed }) => (
        <Text
          style={{
            color: disabled ? palette.textFaint : pressed ? palette.accentHi : palette.accent,
            fontSize: 13,
            fontWeight: '600',
            textAlign: align,
          }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Checkbox({
  palette,
  checked,
  onToggle,
  children,
}: {
  palette: AuthPalette;
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View
        style={{
          height: 20,
          width: 20,
          borderRadius: 6,
          marginTop: 1,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: checked ? 0 : 1,
          borderColor: palette.line,
          backgroundColor: checked ? palette.accent : palette.inset,
        }}>
        {checked ? <Ionicons name="checkmark" size={14} color={palette.onAccent} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}

/* --- Feedback ----------------------------------------------------------- */

export function AuthNotice({
  palette,
  tone = 'error',
  icon,
  children,
}: {
  palette: AuthPalette;
  tone?: 'error' | 'info' | 'success';
  icon?: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  const color =
    tone === 'error' ? palette.err : tone === 'success' ? palette.ok : palette.accentHi;
  const fallbackIcon =
    tone === 'error' ? 'alert-circle' : tone === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 9,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: `${color}44`,
        backgroundColor: `${color}14`,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}>
      <Ionicons name={icon ?? (fallbackIcon as any)} size={17} color={color} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        {typeof children === 'string' ? (
          <Text style={{ color, fontSize: 13, lineHeight: 19, fontWeight: '500' }}>{children}</Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

export function AuthDivider({ palette, label = 'or' }: { palette: AuthPalette; label?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.line }} />
      <Text style={{ color: palette.textFaint, fontSize: 12.5 }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: palette.line }} />
    </View>
  );
}

export function AuthFooter({ palette }: { palette: AuthPalette }) {
  return (
    <Text
      style={{
        ...mono,
        color: palette.textFaint,
        fontSize: 11,
        letterSpacing: 0.6,
        textAlign: 'center',
      }}>
      {`© ${new Date().getFullYear()} Lumen. All rights reserved.`}
    </Text>
  );
}

/* --- Chrome ------------------------------------------------------------- */

export function ThemeToggle({
  palette,
  scheme,
  onPress,
  top,
}: {
  palette: AuthPalette;
  scheme: 'light' | 'dark';
  onPress: () => void;
  top: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={scheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      hitSlop={8}
      style={({ pressed }) => ({
        position: 'absolute',
        top,
        right: 18,
        zIndex: 3,
        height: 36,
        width: 36,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: pressed ? palette.accent : palette.line,
        backgroundColor: palette.card,
      })}>
      <Ionicons
        name={scheme === 'dark' ? 'sunny-outline' : 'moon-outline'}
        size={17}
        color={palette.textDim}
      />
    </Pressable>
  );
}
