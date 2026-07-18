import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Card } from '@/components/ui';
import { Divider, IconTile } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page-header';
import { useSession } from '@/contexts/session';
import { palette } from '@/lib/theme';

const ORG = 'Infora Networks · Ruiru';

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bg: string;
  value?: string;
  toggle?: boolean;
  on?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  last?: boolean;
}

function Row({ icon, label, color, bg, value, toggle, on, onToggle, onPress, last }: RowProps) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        disabled={toggle}
        className={`flex-row items-center py-3 ${onPress ? 'active:opacity-60' : ''}`}>
        <IconTile icon={icon} color={color} bg={bg} />
        <Text className="ml-3 flex-1 text-[15px] font-semibold text-ink dark:text-white">
          {label}
        </Text>
        {toggle ? (
          <Switch
            value={on}
            onValueChange={onToggle}
            trackColor={{ true: palette.brand[600], false: palette.slate[300] }}
            thumbColor="#ffffff"
          />
        ) : (
          <View className="flex-row items-center">
            {value ? (
              <Text className="mr-1 text-sm text-ink-muted dark:text-ink-faint">{value}</Text>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={palette.slate[300]} />
          </View>
        )}
      </Pressable>
      {!last ? <Divider /> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme, setColorScheme } = useColorScheme();
  const { user, signOut } = useSession();
  const [notifications, setNotifications] = useState(true);
  const [biometrics, setBiometrics] = useState(true);
  const isDark = colorScheme === 'dark';

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Settings" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Profile */}
        <Card className="flex-row items-center">
          <Avatar name={user?.name ?? 'Operator'} size="lg" />
          <View className="ml-4 flex-1">
            <Text className="text-lg font-extrabold text-ink dark:text-white">
              {user?.name ?? 'Operator'}
            </Text>
            <Text className="text-[13px] text-ink-muted dark:text-ink-faint">
              {user?.email ?? ''}
            </Text>
            <Text className="mt-0.5 text-xs text-ink-faint">{ORG}</Text>
          </View>
        </Card>

        {/* Preferences */}
        <Text className="mb-2 ml-1 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Preferences
        </Text>
        <Card flush className="px-4">
          <Row
            icon="moon"
            label="Dark mode"
            color={palette.violet}
            bg="bg-violet/10"
            toggle
            on={isDark}
            onToggle={(v) => setColorScheme(v ? 'dark' : 'light')}
          />
          <Row
            icon="notifications"
            label="Push notifications"
            color={palette.brand[600]}
            bg="bg-brand-600/10"
            toggle
            on={notifications}
            onToggle={setNotifications}
          />
          <Row
            icon="language"
            label="Language"
            color={palette.info}
            bg="bg-info/10"
            value="English"
            onPress={() => {}}
            last
          />
        </Card>

        {/* Security */}
        <Text className="mb-2 ml-1 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Security
        </Text>
        <Card flush className="px-4">
          <Row
            icon="finger-print"
            label="Biometric unlock"
            color={palette.success}
            bg="bg-success/10"
            toggle
            on={biometrics}
            onToggle={setBiometrics}
          />
          <Row
            icon="shield-checkmark"
            label="Two-factor auth"
            color={palette.warning}
            bg="bg-warning/10"
            value="On"
            onPress={() => {}}
          />
          <Row
            icon="key"
            label="Change password"
            color={palette.slate[500]}
            bg="bg-slate-500/10"
            onPress={() => {}}
            last
          />
        </Card>

        {/* System */}
        <Text className="mb-2 ml-1 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          System
        </Text>
        <Card flush className="px-4">
          <Row
            icon="people"
            label="System users"
            color={palette.brand[600]}
            bg="bg-brand-600/10"
            onPress={() => {}}
          />
          <Row
            icon="document-text"
            label="Audit logs"
            color={palette.violet}
            bg="bg-violet/10"
            onPress={() => {}}
          />
          <Row
            icon="bug"
            label="Report a bug"
            color={palette.danger}
            bg="bg-danger/10"
            onPress={() => {}}
          />
          <Row
            icon="help-buoy"
            label="Contact support"
            color={palette.info}
            bg="bg-info/10"
            onPress={() => {}}
            last
          />
        </Card>

        <Pressable
          onPress={handleSignOut}
          className="mt-6 flex-row items-center justify-center rounded-xl border border-danger/30 bg-danger/5 py-3.5 active:opacity-70">
          <Ionicons name="log-out-outline" size={20} color={palette.danger} />
          <Text className="ml-2 text-base font-bold text-danger">Sign out</Text>
        </Pressable>

        <Text className="mt-6 text-center text-xs text-ink-faint">Infora Billing · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}
