import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useSession } from '@/contexts/session';
import { IS_LIVE } from '@/services';
import { useAppTheme } from '@/lib/theme';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState('demo@infora.app');
  const [password, setPassword] = useState('demo1234');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-surface dark:bg-night">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Brand header band */}
          <View
            className="bg-brand-600 px-6 pb-10"
            style={{ paddingTop: insets.top + 48 }}>
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <Ionicons name="wifi" size={30} color="#ffffff" />
            </View>
            <Text className="mt-5 text-3xl font-extrabold text-white">Infora Billing</Text>
            <Text className="mt-1.5 text-base text-brand-100">
              ISP & WiFi billing, in your pocket.
            </Text>
          </View>

          <View className="-mt-6 flex-1 rounded-t-3xl bg-surface px-6 pt-8 dark:bg-night">
            <Text className="text-xl font-bold text-ink dark:text-white">Welcome back</Text>
            <Text className="mt-1 text-sm text-ink-muted dark:text-ink-faint">
              Sign in to your operator account to continue.
            </Text>

            {/* Email */}
            <Text className="mb-2 mt-6 text-sm font-semibold text-ink-soft dark:text-ink-faint">
              Email address
            </Text>
            <View className="h-14 flex-row items-center rounded-xl border border-line bg-surface-muted px-4 dark:border-night-line dark:bg-night-card">
              <Ionicons name="mail-outline" size={20} color={theme.textFaint} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@company.com"
                placeholderTextColor={theme.textFaint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                className="ml-3 flex-1 text-base text-ink dark:text-white"
              />
            </View>

            {/* Password */}
            <Text className="mb-2 mt-4 text-sm font-semibold text-ink-soft dark:text-ink-faint">
              Password
            </Text>
            <View className="h-14 flex-row items-center rounded-xl border border-line bg-surface-muted px-4 dark:border-night-line dark:bg-night-card">
              <Ionicons name="lock-closed-outline" size={20} color={theme.textFaint} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={theme.textFaint}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                className="ml-3 flex-1 text-base text-ink dark:text-white"
              />
              <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={theme.textFaint}
                />
              </Pressable>
            </View>

            <Pressable className="mt-3 self-end" hitSlop={8}>
              <Text className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                Forgot password?
              </Text>
            </Pressable>

            {error ? (
              <View className="mt-4 flex-row items-center rounded-xl bg-danger/10 px-3 py-2.5">
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text className="ml-2 flex-1 text-sm font-medium text-danger">{error}</Text>
              </View>
            ) : null}

            <View className="mt-6">
              <Button label="Sign in" size="lg" loading={loading} onPress={handleSignIn} />
            </View>

            {!IS_LIVE ? (
              <View className="mt-3 flex-row items-center justify-center">
                <Ionicons name="flask-outline" size={13} color={theme.textFaint} />
                <Text className="ml-1.5 text-xs text-ink-faint">
                  Demo mode — any credentials work. Set EXPO_PUBLIC_API_URL to go live.
                </Text>
              </View>
            ) : null}

            <View className="mt-6 flex-row items-center">
              <View className="h-px flex-1 bg-line dark:bg-night-line" />
              <Text className="mx-3 text-xs font-medium text-ink-faint">OR</Text>
              <View className="h-px flex-1 bg-line dark:bg-night-line" />
            </View>

            <Pressable
              onPress={handleSignIn}
              className="mt-5 h-14 flex-row items-center justify-center rounded-xl border border-line active:bg-surface-sunken dark:border-night-line dark:active:bg-night-raised">
              <Ionicons name="finger-print" size={20} color={theme.tint} />
              <Text className="ml-2 text-base font-semibold text-ink dark:text-white">
                Use biometrics
              </Text>
            </Pressable>

            <View className="mt-8 flex-row justify-center pb-6">
              <Text className="text-sm text-ink-muted dark:text-ink-faint">New operator? </Text>
              <Pressable hitSlop={8}>
                <Text className="text-sm font-bold text-brand-600 dark:text-brand-400">
                  Request access
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
