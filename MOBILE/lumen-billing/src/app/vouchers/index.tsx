import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, ErrorState, FilterChips, Loading, type ChipOption } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useVouchers } from '@/hooks/use-data';
import type { Voucher } from '@/data/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { palette } from '@/lib/theme';

function buildFilters(vouchers: Voucher[]): ChipOption[] {
  const count = (s: string) => vouchers.filter((v) => v.status === s).length;
  return [
    { value: 'all', label: 'All', count: vouchers.length },
    { value: 'active', label: 'Active', count: count('active') },
    { value: 'used', label: 'Used', count: count('used') },
    { value: 'expired', label: 'Expired', count: count('expired') },
  ];
}

export default function VouchersScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const { data, loading, error, refetch } = useVouchers();

  const vouchers = data ?? [];
  const filters = useMemo(() => buildFilters(vouchers), [vouchers]);
  const filtered = useMemo(
    () => vouchers.filter((v) => filter === 'all' || v.status === filter),
    [vouchers, filter],
  );

  if (!data) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Vouchers" subtitle="Hotspot access codes" />
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader
        title="Vouchers"
        subtitle="Hotspot access codes"
        right={
          <Pressable className="h-9 w-9 items-center justify-center rounded-full bg-brand-600">
            <Ionicons name="add" size={22} color="#ffffff" />
          </Pressable>
        }
      />
      <View className="px-4 pt-3">
        <FilterChips options={filters} value={filter} onChange={setFilter} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={palette.brand[600]} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {filtered.map((v) => (
          <Card key={v.id} className="mb-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
                  <Ionicons name="ticket" size={20} color={palette.warning} />
                </View>
                <View>
                  <Text className="text-base font-extrabold tracking-wider text-ink dark:text-white">
                    {v.code}
                  </Text>
                  <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">
                    {v.planName} · {formatCurrency(v.value)}
                  </Text>
                </View>
              </View>
              <Badge label={v.status} status />
            </View>
            <View className="mt-3 flex-row items-center justify-between border-t border-line pt-3 dark:border-night-line">
              <Text className="text-xs text-ink-muted dark:text-ink-faint">
                Uses {v.usedCount}/{v.maxUses}
              </Text>
              <Text className="text-xs text-ink-faint">Expires {formatDate(v.expiresAt)}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
