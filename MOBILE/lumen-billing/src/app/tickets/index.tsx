import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Card, ErrorState, FilterChips, Loading, type ChipOption } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useTickets } from '@/hooks/use-data';
import type { Ticket } from '@/data/types';
import { timeAgo } from '@/lib/format';
import { palette } from '@/lib/theme';

function buildFilters(tickets: Ticket[]): ChipOption[] {
  const count = (s: string) => tickets.filter((t) => t.status === s).length;
  return [
    { value: 'all', label: 'All', count: tickets.length },
    { value: 'open', label: 'Open', count: count('open') },
    { value: 'in_progress', label: 'In progress', count: count('in_progress') },
    { value: 'resolved', label: 'Resolved', count: count('resolved') },
    { value: 'closed', label: 'Closed', count: count('closed') },
  ];
}

const PRIORITY_ICON: Record<Ticket['priority'], keyof typeof Ionicons.glyphMap> = {
  urgent: 'alert-circle',
  high: 'arrow-up-circle',
  medium: 'remove-circle',
  low: 'arrow-down-circle',
};

export default function TicketsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const { data, loading, error, refetch } = useTickets();

  const tickets = data ?? [];
  const filters = useMemo(() => buildFilters(tickets), [tickets]);
  const filtered = useMemo(
    () => tickets.filter((t) => filter === 'all' || t.status === filter),
    [tickets, filter],
  );

  const header = (
    <PageHeader
      title="Support tickets"
      right={
        <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-brand-600">
          <Ionicons name="add" size={22} color="#ffffff" />
        </Pressable>
      }
    />
  );

  if (!data) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        {header}
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      {header}
      <View className="px-4 pt-3">
        <FilterChips options={filters} value={filter} onChange={setFilter} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={palette.brand[600]} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {filtered.map((t) => (
          <Card key={t.id} className="mb-3" onPress={() => router.push(`/tickets/${t.id}`)}>
            <View className="flex-row items-start">
              <Avatar name={t.customerName} size="sm" />
              <View className="ml-3 flex-1">
                <Text className="text-[15px] font-bold text-ink dark:text-white" numberOfLines={1}>
                  {t.subject}
                </Text>
                <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">
                  {t.customerName} · #{t.id}
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row items-center justify-between border-t border-line pt-3 dark:border-night-line">
              <View className="flex-row items-center gap-2">
                <Badge label={t.status} status />
                <View className="flex-row items-center">
                  <Ionicons
                    name={PRIORITY_ICON[t.priority]}
                    size={13}
                    color={
                      t.priority === 'urgent' || t.priority === 'high'
                        ? palette.danger
                        : t.priority === 'medium'
                          ? palette.info
                          : palette.slate[400]
                    }
                  />
                  <Text className="ml-1 text-xs font-medium capitalize text-ink-muted dark:text-ink-faint">
                    {t.priority}
                  </Text>
                </View>
              </View>
              <Text className="text-xs text-ink-faint">{timeAgo(t.createdAt)}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
