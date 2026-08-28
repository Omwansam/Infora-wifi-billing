/**
 * The page frame both auth screens sit in: backdrop, theme toggle, a scroll
 * view that centres its content until the keyboard makes that impossible, and
 * the copyright line.
 *
 * `flexGrow: 1` + `justifyContent: 'center'` is the combination that gives a
 * short card a vertically centred page and a tall one (the wizard's later
 * steps) a normal scroll, without measuring anything.
 */
import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AuthPalette } from '@/lib/auth-theme';
import { useThemeMode } from '@/contexts/theme-mode';
import { AuthBackdrop } from './backdrop';
import { AuthFooter, ThemeToggle } from './ui';

export function AuthShell({
  palette,
  children,
  showFooter = true,
}: {
  palette: AuthPalette;
  children: ReactNode;
  showFooter?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { scheme, toggle } = useThemeMode();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <StatusBar style={palette.scheme === 'dark' ? 'light' : 'dark'} />
      <AuthBackdrop palette={palette} />
      <ThemeToggle palette={palette} scheme={scheme} onPress={toggle} top={insets.top + 10} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 16,
            paddingTop: insets.top + 56,
            paddingBottom: insets.bottom + 24,
            gap: 18,
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {children}
          {showFooter ? <AuthFooter palette={palette} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
