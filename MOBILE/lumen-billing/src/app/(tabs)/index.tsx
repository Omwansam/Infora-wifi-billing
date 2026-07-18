import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Avatar,
  Card,
  ErrorState,
  Loading,
  MiniBarChart,
  Screen,
  SectionHeader,
  SplitBar,
  StatCard,
} from '@/components/ui';
import { useSession } from '@/contexts/session';
import { useDashboard, usePayments } from '@/hooks/use-data';
import { formatBytes, formatCurrency, timeAgo } from '@/lib/format';
import { LargeHeader } from '@/components/ui/page-header';
import { palette } from '@/lib/theme';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'thisWeek', label: 'Week' },
  { value: 'thisMonth', label: 'Month' },
  { value: 'lastMonth', label: 'Last mo.' },
] as const;

const QUICK_ACTIONS = [
  { icon: 'person-add', label: 'Add client', color: palette.brand[600], bg: 'bg-brand-600/10', href: '/clients' },
  { icon: 'cash', label: 'Record payment', color: palette.success, bg: 'bg-success/10', href: '/payments' },
  { icon: 'document-text', label: 'New invoice', color: palette.violet, bg: 'bg-violet/10', href: '/invoices' },
  { icon: 'ticket', label: 'Open ticket', color: palette.warning, bg: 'bg-warning/10', href: '/tickets' },
] as const;

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('today');
  const { user } = useSession();
  const { data, loading, error, refetch } = useDashboard();
  const { data: payments } = usePayments();

  const userName = user?.name ?? 'there';
  const header = (
    <LargeHeader
      greeting={`${greeting()}, ${userName.split(' ')[0]}`}
      title="Dashboard"
      right={
        <View className="flex-row items-center gap-3">
          <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-surface dark:bg-night-card">
            <Ionicons name="notifications-outline" size={22} color={palette.slate[500]} />
            <View className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-danger" />
          </Pressable>
          <Avatar name={userName} size="sm" />
        </View>
      }
    />
  );

  if (!data) {
    return (
      <Screen>
        {header}
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </Screen>
    );
  }

  const s = data.summary;
  const revenueValue = data.revenuePeriods[period];
  const recentPayments = (payments ?? [])
    .filter((p) => p.status === 'completed')
    .slice(0, 4);
  const split = [
    { label: 'PPPoE', value: data.revenueByType.pppoe, color: palette.violet },
    { label: 'Hotspot', value: data.revenueByType.hotspot, color: palette.magenta },
  ];

  return (
    <Screen onRefresh={refetch} refreshing={loading}>
      {header}

      {/* Revenue hero */}
      <Card className="mt-2 overflow-hidden bg-brand-600" flush>
        <View className="p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-brand-100">Collections</Text>
            <View className="flex-row items-center rounded-full bg-white/15 px-2.5 py-1">
              <View className="mr-1.5 h-1.5 w-1.5 rounded-full bg-white" />
              <Text className="text-xs font-semibold text-white">M-Pesa live</Text>
            </View>
          </View>
          <Text className="mt-2 text-4xl font-extrabold text-white">
            {formatCurrency(revenueValue)}
          </Text>
          <Text className="mt-1 text-sm text-brand-100">
            {formatCurrency(s.todayPayments)} received today · {s.onlineNow} online now
          </Text>

          {/* period switch */}
          <View className="mt-4 flex-row rounded-xl bg-white/10 p-1">
            {PERIODS.map((p) => {
              const active = p.value === period;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setPeriod(p.value)}
                  className={`flex-1 items-center rounded-lg py-1.5 ${active ? 'bg-white' : ''}`}>
                  <Text
                    className={`text-xs font-bold ${active ? 'text-brand-700' : 'text-brand-100'}`}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View className="bg-white/10 px-5 py-4">
          <MiniBarChart
            data={data.revenueTrend}
            height={90}
            format={(n) => formatCurrency(n, true)}
          />
        </View>
      </Card>

      {/* KPI grid */}
      <View className="mt-4 flex-row gap-3">
        <StatCard
          label="Active clients"
          value={String(s.activeCustomers)}
          icon="people"
          accent="brand"
          delta={{ value: '+6', up: true }}
          onPress={() => router.push('/clients')}
        />
        <StatCard
          label="Online now"
          value={String(s.onlineNow)}
          icon="wifi"
          accent="success"
          onPress={() => router.push('/sessions')}
        />
      </View>
      <View className="mt-3 flex-row gap-3">
        <StatCard
          label="Open tickets"
          value={String(s.openTickets)}
          icon="ticket"
          accent="warning"
          onPress={() => router.push('/tickets')}
        />
        <StatCard
          label="Routers online"
          value={`${s.onlineDevices}/${s.totalDevices}`}
          icon="hardware-chip"
          accent="violet"
          onPress={() => router.push('/devices')}
        />
      </View>

      {/* Quick actions */}
      <SectionHeader title="Quick actions" className="mb-3 mt-6" />
      <View className="flex-row gap-3">
        {QUICK_ACTIONS.map((a) => (
          <Pressable
            key={a.label}
            onPress={() => router.push(a.href as never)}
            className="flex-1 items-center">
            <View className={`h-14 w-14 items-center justify-center rounded-2xl ${a.bg}`}>
              <Ionicons name={a.icon as never} size={24} color={a.color} />
            </View>
            <Text className="mt-2 text-center text-xs font-semibold text-ink-soft dark:text-ink-faint">
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Revenue split */}
      <SectionHeader title="Revenue mix" className="mb-3 mt-6" action="Reports" onAction={() => router.push('/finance')} />
      <Card>
        <SplitBar slices={split} />
      </Card>

      {/* Alerts */}
      <SectionHeader title="Alerts" className="mb-3 mt-6" />
      <Card flush>
        {data.alerts.map((alert, i) => (
          <View
            key={alert.id}
            className={`flex-row items-start p-4 ${i > 0 ? 'border-t border-line dark:border-night-line' : ''}`}>
            <View
              className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${
                alert.type === 'warning' ? 'bg-warning/10' : 'bg-info/10'
              }`}>
              <Ionicons
                name={alert.type === 'warning' ? 'warning' : 'information-circle'}
                size={20}
                color={alert.type === 'warning' ? palette.warning : palette.info}
              />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-ink dark:text-white">{alert.title}</Text>
              <Text className="mt-0.5 text-[13px] text-ink-muted dark:text-ink-faint">
                {alert.message}
              </Text>
              <Text className="mt-1 text-xs text-ink-faint">{timeAgo(alert.at)}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Top data users */}
      <SectionHeader title="Top data users" className="mb-3 mt-6" />
      <Card flush>
        {data.topDataUsers.map((u, i) => (
          <View
            key={u.username}
            className={`flex-row items-center p-4 ${i > 0 ? 'border-t border-line dark:border-night-line' : ''}`}>
            <Text className="w-6 text-sm font-bold text-ink-faint">{i + 1}</Text>
            <Avatar name={u.customerName} size="sm" />
            <View className="ml-3 flex-1">
              <Text className="text-sm font-semibold text-ink dark:text-white">{u.customerName}</Text>
              <Text className="text-xs text-ink-muted dark:text-ink-faint">{u.planName}</Text>
            </View>
            <Text className="text-sm font-bold text-ink dark:text-white">
              {formatBytes(u.totalBytes)}
            </Text>
          </View>
        ))}
      </Card>

      {/* Recent payments */}
      <SectionHeader
        title="Recent payments"
        className="mb-3 mt-6"
        action="See all"
        onAction={() => router.push('/payments')}
      />
      <Card flush>
        {recentPayments.map((p, i) => (
          <View
            key={p.id}
            className={`flex-row items-center p-4 ${i > 0 ? 'border-t border-line dark:border-night-line' : ''}`}>
            <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-success/10">
              <Ionicons name="arrow-down" size={18} color={palette.success} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-ink dark:text-white">{p.customerName}</Text>
              <Text className="text-xs text-ink-muted dark:text-ink-faint">
                {p.methodLabel} · {p.reference}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-bold text-success">{formatCurrency(p.amount)}</Text>
              <Text className="text-xs text-ink-faint">{timeAgo(p.date)}</Text>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
