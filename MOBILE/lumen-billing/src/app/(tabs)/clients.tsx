import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  Loading,
  Screen,
  SearchBar,
  type ChipOption,
} from '@/components/ui';
import { LargeHeader } from '@/components/ui/page-header';
import { useCustomers } from '@/hooks/use-data';
import type { Customer } from '@/data/types';
import { formatCurrency, timeAgo } from '@/lib/format';
import { palette } from '@/lib/theme';

function buildFilters(customers: Customer[]): ChipOption[] {
  return [
    { value: 'all', label: 'All', count: customers.length },
    { value: 'active', label: 'Active', count: customers.filter((c) => c.status === 'active').length },
    { value: 'online', label: 'Online', count: customers.filter((c) => c.online).length },
    { value: 'pppoe', label: 'PPPoE', count: customers.filter((c) => c.connectionType === 'pppoe').length },
    { value: 'hotspot', label: 'Hotspot', count: customers.filter((c) => c.connectionType === 'hotspot').length },
    { value: 'suspended', label: 'Suspended', count: customers.filter((c) => c.status === 'suspended').length },
  ];
}

function matches(c: Customer, filter: string) {
  switch (filter) {
    case 'active':
      return c.status === 'active';
    case 'online':
      return c.online;
    case 'pppoe':
      return c.connectionType === 'pppoe';
    case 'hotspot':
      return c.connectionType === 'hotspot';
    case 'suspended':
      return c.status === 'suspended';
    default:
      return true;
  }
}

function ClientCard({ client }: { client: Customer }) {
  return (
    <Card onPress={() => router.push(`/clients/${client.id}`)} className="mb-3">
      <View className="flex-row items-center">
        <Avatar name={client.name} online={client.online} />
        <View className="ml-3 flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-bold text-ink dark:text-white" numberOfLines={1}>
              {client.name}
            </Text>
            <Badge label={client.status} status />
          </View>
          <Text className="mt-0.5 text-[13px] text-ink-muted dark:text-ink-faint" numberOfLines={1}>
            {client.package}
          </Text>
        </View>
      </View>
      <View className="mt-3 flex-row items-center justify-between border-t border-line pt-3 dark:border-night-line">
        <View className="flex-row items-center">
          <Ionicons
            name={client.connectionType === 'pppoe' ? 'globe-outline' : 'wifi-outline'}
            size={14}
            color={palette.slate[400]}
          />
          <Text className="ml-1.5 text-xs font-medium capitalize text-ink-muted dark:text-ink-faint">
            {client.connectionType}
          </Text>
          <View className="mx-2 h-1 w-1 rounded-full bg-ink-faint" />
          <Text className="text-xs text-ink-muted dark:text-ink-faint">
            Paid {timeAgo(client.lastPaymentDate)}
          </Text>
        </View>
        {client.balance > 0 ? (
          <Text className="text-xs font-bold text-danger">
            {formatCurrency(client.balance)} due
          </Text>
        ) : (
          <Text className="text-xs font-bold text-success">Settled</Text>
        )}
      </View>
    </Card>
  );
}

export default function ClientsScreen() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const { data, loading, error, refetch } = useCustomers();

  const customers = data ?? [];
  const filters = useMemo(() => buildFilters(customers), [customers]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => matches(c, filter)).filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.radiusUsername.includes(q),
    );
  }, [customers, query, filter]);

  const header = (
    <LargeHeader
      title="Clients"
      right={
        <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-brand-600">
          <Ionicons name="add" size={26} color="#ffffff" />
        </Pressable>
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

  return (
    <Screen onRefresh={refetch} refreshing={loading}>
      {header}
      <View className="mt-1">
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search name, phone, username" />
      </View>
      <View className="-mx-4 mt-3">
        <View className="px-4">
          <FilterChips options={filters} value={filter} onChange={setFilter} />
        </View>
      </View>

      <Text className="mb-3 mt-4 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {filtered.length} client{filtered.length === 1 ? '' : 's'}
      </Text>

      {filtered.length === 0 ? (
        <EmptyState icon="people-outline" title="No clients found" message="Try a different search or filter." />
      ) : (
        filtered.map((c) => <ClientCard key={c.id} client={c} />)
      )}
    </Screen>
  );
}
