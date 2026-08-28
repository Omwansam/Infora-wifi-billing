/**
 * Sign in.
 *
 * One card, three states — password, second factor, password reset — and only
 * one of them is on screen at a time. That is the same call the console makes:
 * once the backend has asked for a code, leaving the email and password inputs
 * sitting there only invites someone to edit them and wonder why nothing
 * happened.
 *
 * Every control here does what it says. The screen this replaces had a
 * "Forgot password?" that did nothing, a "Request access" that did nothing, and
 * a "Use biometrics" button that re-submitted the typed password — there is no
 * biometric credential store in this build, so it was a shortcut that only
 * looked like one. The first two are now wired to real endpoints; the third is
 * gone rather than faked.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { AuthShell } from '@/components/auth/shell';
import { LumenLogo } from '@/components/auth/logo';
import {
  AuthAltButton,
  AuthBadge,
  AuthCard,
  AuthDivider,
  AuthInput,
  AuthLink,
  AuthNotice,
  AuthSubmit,
  AuthSubtitle,
  AuthTitle,
  Checkbox,
  CodeInput,
  Field,
  InputAdornment,
} from '@/components/auth/ui';
import { useSession } from '@/contexts/session';
import { useThemeMode } from '@/contexts/theme-mode';
import { authPalette } from '@/lib/auth-theme';
import { IS_LIVE } from '@/services';
import { requestPasswordReset } from '@/services/auth';

type Mode = 'password' | 'otp' | 'forgot';

const DEMO_EMAIL = 'demo@infora.app';
const DEMO_PASSWORD = 'demo1234';

export default function LoginScreen() {
  const { scheme } = useThemeMode();
  const palette = useMemo(() => authPalette('signin', scheme), [scheme]);
  const { signIn } = useSession();

  const [mode, setMode] = useState<Mode>('password');
  // Demo build: pre-fill the demo account so a visitor just taps "Sign in".
  const [email, setEmail] = useState(IS_LIVE ? '' : DEMO_EMAIL);
  const [password, setPassword] = useState(IS_LIVE ? '' : DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [otp, setOtp] = useState('');
  const [usingBackup, setUsingBackup] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setNotice({ tone: 'error', text: 'Enter both your email and password.' });
      return;
    }
    if (mode === 'otp' && !otp.trim()) {
      setNotice({ tone: 'error', text: 'Enter your verification code.' });
      return;
    }

    setLoading(true);
    setNotice(null);
    try {
      const result = await signIn(
        email.trim(),
        password,
        mode === 'otp' ? otp.trim() : undefined,
        remember,
      );

      if (result.requires2fa) {
        setMode('otp');
        setOtp('');
        return;
      }
      if (!result.ok) {
        setNotice({
          tone: 'error',
          text:
            result.error ??
            (mode === 'otp' ? 'That code was not accepted.' : 'Sign in failed.'),
        });
        return;
      }
      router.replace('/(tabs)');
    } catch {
      // signIn resolves for every expected outcome; anything landing here is a
      // genuine crash in the transport, not a rejected credential.
      setNotice({ tone: 'error', text: 'Network error. Check your connection and try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    const target = resetEmail.trim() || email.trim();
    if (!target || !target.includes('@')) {
      setNotice({ tone: 'error', text: 'Enter the email address on your account.' });
      return;
    }
    setLoading(true);
    setNotice(null);
    const result = await requestPasswordReset(target);
    setLoading(false);
    setNotice({ tone: result.ok ? 'success' : 'error', text: result.message });
  };

  const leaveSubMode = () => {
    setMode('password');
    setOtp('');
    setUsingBackup(false);
    setNotice(null);
  };

  return (
    <AuthShell palette={palette}>
      <AuthCard palette={palette}>
        <View style={{ alignItems: 'center', marginBottom: 22 }}>
          <LumenLogo color={palette.text} subtitleColor={palette.accent} />
        </View>

        {mode === 'otp' ? (
          <>
            <AuthBadge palette={palette} icon="shield-checkmark" label="Two-factor" />
            <AuthTitle palette={palette} align="left">
              Confirm it&apos;s you
            </AuthTitle>
            <AuthSubtitle palette={palette} align="left">
              {usingBackup
                ? 'Enter one of the backup codes you saved when you turned on two-factor.'
                : `Enter the 6-digit code from your authenticator app for ${email.trim()}.`}
            </AuthSubtitle>
          </>
        ) : mode === 'forgot' ? (
          <>
            <AuthBadge palette={palette} icon="key-outline" label="Password reset" />
            <AuthTitle palette={palette} align="left">
              Reset your password
            </AuthTitle>
            <AuthSubtitle palette={palette} align="left">
              We&apos;ll email a link to the address on your operator account. Open it on this
              device to choose a new password.
            </AuthSubtitle>
          </>
        ) : (
          <>
            <AuthTitle palette={palette}>Sign in</AuthTitle>
            <AuthSubtitle palette={palette}>
              Welcome back. Access your operator console.
            </AuthSubtitle>
          </>
        )}

        {!IS_LIVE && mode === 'password' ? (
          <View
            style={{
              marginTop: 18,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: palette.line,
              backgroundColor: palette.lineSoft,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}>
            <Text style={{ color: palette.accentHi, fontSize: 12, fontWeight: '700' }}>
              Demo mode — credentials pre-filled
            </Text>
            <Text style={{ color: palette.textDim, fontSize: 12, marginTop: 4 }}>
              {DEMO_EMAIL} · {DEMO_PASSWORD}
            </Text>
            <Text style={{ color: palette.textFaint, fontSize: 11.5, marginTop: 6, lineHeight: 17 }}>
              Set EXPO_PUBLIC_API_URL to sign in against a real backend.
            </Text>
          </View>
        ) : null}

        <View style={{ marginTop: 22, gap: 16 }}>
          {mode === 'otp' ? (
            <>
              <Field
                palette={palette}
                label={usingBackup ? 'Backup code' : 'Verification code'}
                required>
                <CodeInput
                  palette={palette}
                  value={otp}
                  onChangeText={setOtp}
                  numeric={!usingBackup}
                  maxLength={usingBackup ? 32 : 6}
                  placeholder={usingBackup ? 'xxxx-xxxx' : '000000'}
                  invalid={notice?.tone === 'error'}
                />
              </Field>
              <AuthLink
                palette={palette}
                align="center"
                label={
                  usingBackup
                    ? 'Use your authenticator app instead'
                    : "Can't reach your authenticator? Use a backup code"
                }
                onPress={() => {
                  setUsingBackup((b) => !b);
                  setOtp('');
                  setNotice(null);
                }}
              />
            </>
          ) : mode === 'forgot' ? (
            <Field palette={palette} label="Email address" required>
              <AuthInput
                palette={palette}
                value={resetEmail}
                onChangeText={setResetEmail}
                placeholder="you@operator.net"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                autoFocus
              />
            </Field>
          ) : (
            <>
              <Field palette={palette} label="Email address" required>
                <AuthInput
                  palette={palette}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@operator.net"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </Field>

              <Field
                palette={palette}
                label="Password"
                required
                trailing={
                  <AuthLink
                    palette={palette}
                    label="Forgot password?"
                    onPress={() => {
                      setResetEmail(email);
                      setMode('forgot');
                      setNotice(null);
                    }}
                  />
                }>
                <View>
                  <AuthInput
                    palette={palette}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••••••"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    textContentType="password"
                    onSubmitEditing={handleSignIn}
                    returnKeyType="go"
                    padded
                  />
                  <InputAdornment
                    palette={palette}
                    icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    label={showPassword ? 'Hide password' : 'Show password'}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                </View>
              </Field>

              <Checkbox
                palette={palette}
                checked={remember}
                onToggle={() => setRemember((r) => !r)}>
                <Text style={{ color: palette.textDim, fontSize: 13.5, lineHeight: 20 }}>
                  Keep me signed in
                </Text>
              </Checkbox>
            </>
          )}

          {notice ? (
            <AuthNotice palette={palette} tone={notice.tone}>
              {notice.text}
            </AuthNotice>
          ) : null}

          <AuthSubmit
            palette={palette}
            label={
              mode === 'otp'
                ? 'Verify and sign in'
                : mode === 'forgot'
                  ? 'Email me a reset link'
                  : 'Sign in'
            }
            loading={loading}
            onPress={mode === 'forgot' ? handleReset : handleSignIn}
          />

          {mode !== 'password' ? (
            <AuthLink
              palette={palette}
              align="center"
              label="Back to sign in"
              onPress={leaveSubMode}
            />
          ) : null}
        </View>

        {mode === 'password' ? (
          <View style={{ marginTop: 22, gap: 14 }}>
            <AuthDivider palette={palette} />
            <AuthAltButton
              palette={palette}
              icon="person-add-outline"
              label="Create an operator account"
              onPress={() => router.push('/(auth)/signup')}
            />
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={palette.textFaint}
                style={{ marginTop: 2 }}
              />
              <Text
                style={{
                  flex: 1,
                  color: palette.textFaint,
                  fontSize: 12,
                  lineHeight: 18,
                }}>
                Signing in on a borrowed phone? Untick “Keep me signed in” and the session is
                dropped when the app closes instead of being written to the keychain.
              </Text>
            </View>
          </View>
        ) : null}
      </AuthCard>
    </AuthShell>
  );
}
