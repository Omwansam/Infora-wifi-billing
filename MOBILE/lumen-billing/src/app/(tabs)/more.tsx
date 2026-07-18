import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Avatar, Card, Screen } from '@/components/ui';
import { Divider, IconTile } from '@/components/ui/list-row';
import { LargeHeader } from '@/components/ui/page-header';
import { useSession } from '@/contexts/session';
import { useDashboard, useTickets } from '@/hooks/use-data';
import { palette } from '@/lib/theme';

const ORG = 'Infora Networks · Ruiru';

interface Item {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  color: string;
  bg: string;
  href: string;
  badge?: string;
}

function buildGroups(opts: {
  onlineNow: number;
  onlineDevices: number;
  totalDevices: number;
  openTickets: number;
}): { title: string; items: Item[] }[] {
  return [
    {
      title: 'Operations',
      items: [
        { icon: 'pulse', label: 'Live sessions', sub: `${opts.onlineNow} online`, color: palette.success, bg: 'bg-success/10', href: '/sessions' },
        { icon: 'ticket', label: 'Support tickets', sub: 'Customer issues', color: palette.warning, bg: 'bg-warning/10', href: '/tickets', badge: opts.openTickets ? String(opts.openTickets) : undefined },
        { icon: 'megaphone', label: 'Communication', sub: 'SMS, email, campaigns', color: palette.magenta, bg: 'bg-magenta/10', href: '/communication' },
      ],
    },
    {
      title: 'Network',
      items: [
        { icon: 'hardware-chip', label: 'Devices', sub: `${opts.onlineDevices}/${opts.totalDevices} routers online`, color: palette.violet, bg: 'bg-violet/10', href: '/devices' },
        { icon: 'git-network', label: 'Network & RADIUS', sub: 'ISPs, RADIUS, VPN', color: palette.info, bg: 'bg-info/10', href: '/network' },
      ],
    },
    {
      title: 'Business',
      items: [
        { icon: 'trending-up', label: 'Finance', sub: 'Revenue, expenses, leads', color: palette.success, bg: 'bg-success/10', href: '/finance' },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: 'settings', label: 'Settings', sub: 'Preferences & security', color: palette.slate[500], bg: 'bg-slate-500/10', href: '/settings' },
      ],
    },
  ];
}

function MenuItem({ item, last }: { item: Item; last: boolean }) {
  return (
    <>
      <Pressable
        onPress={() => router.push(item.href)}
        className="flex-row items-center py-3 active:opacity-60">
        <IconTile icon={item.icon} color={item.color} bg={item.bg} />
        <View className="ml-3 flex-1">
          <Text className="text-[15px] font-semibold text-ink dark:text-white">{item.label}</Text>
          {item.sub ? (
            <Text className="mt-0.5 text-[13px] text-ink-muted dark:text-ink-faint">{item.sub}</Text>
          ) : null}
        </View>
        {item.badge ? (
          <View className="mr-2 h-6 min-w-6 items-center justify-center rounded-full bg-danger px-1.5">
            <Text className="text-xs font-bold text-white">{item.badge}</Text>
          </View>
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={palette.slate[300]} />
      </Pressable>
      {!last ? <Divider /> : null}
    </>
  );
}

export default function MoreScreen() {
  const { user, signOut } = useSession();
  const { data: dashboard } = useDashboard();
  const { data: tickets } = useTickets();

  const name = user?.name ?? 'Operator';
  const groups = buildGroups({
    onlineNow: dashboard?.summary.onlineNow ?? 0,
    onlineDevices: dashboard?.summary.onlineDevices ?? 0,
    totalDevices: dashboard?.summary.totalDevices ?? 0,
    openTickets: (tickets ?? []).filter((t) => t.status === 'open').length,
  });

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <Screen>
      <LargeHeader title="More" />

      {/* Profile card */}
      <Card onPress={() => router.push('/settings')} className="mt-2 flex-row items-center">
        <Avatar name={name} size="lg" />
        <View className="ml-4 flex-1">
          <Text className="text-lg font-extrabold text-ink dark:text-white">{name}</Text>
          <Text className="text-[13px] text-ink-muted dark:text-ink-faint">
            {user?.email ?? ''}
          </Text>
          <View className="mt-1.5 flex-row">
            <View className="rounded-full bg-brand-600/10 px-2.5 py-1">
              <Text className="text-[11px] font-bold uppercase text-brand-600 dark:text-brand-400">
                {user?.role ?? 'user'}
              </Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.slate[300]} />
      </Card>

      {groups.map((group) => (
        <View key={group.title} className="mt-6">
          <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {group.title}
          </Text>
          <Card flush className="px-4">
            {group.items.map((item, i) => (
              <MenuItem key={item.label} item={item} last={i === group.items.length - 1} />
            ))}
          </Card>
        </View>
      ))}

      <Pressable
        onPress={handleSignOut}
        className="mt-6 flex-row items-center justify-center rounded-xl border border-danger/30 bg-danger/5 py-3.5 active:opacity-70">
        <Ionicons name="log-out-outline" size={20} color={palette.danger} />
        <Text className="ml-2 text-base font-bold text-danger">Sign out</Text>
      </Pressable>

      <Text className="mt-6 text-center text-xs text-ink-faint">
        Infora Billing · v1.0.0 · {ORG}
      </Text>
    </Screen>
  );
}
