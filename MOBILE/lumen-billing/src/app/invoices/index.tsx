import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, ErrorState, FilterChips, Loading, type ChipOption } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useInvoices } from '@/hooks/use-data';
import type { Invoice } from '@/data/types';
import { formatCurrency, formatDate } from '@/lib/format';
import { palette } from '@/lib/theme';

function buildFilters(invoices: Invoice[]): ChipOption[] {
  const count = (s: string) => invoices.filter((i) => i.status === s).length;
  return [
    { value: 'all', label: 'All', count: invoices.length },
    { value: 'paid', label: 'Paid', count: count('paid') },
    { value: 'pending', label: 'Pending', count: count('pending') },
    { value: 'overdue', label: 'Overdue', count: count('overdue') },
    { value: 'draft', label: 'Draft', count: count('draft') },
  ];
}

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const { data, loading, error, refetch } = useInvoices();

  const invoices = data ?? [];
  const filters = useMemo(() => buildFilters(invoices), [invoices]);
  const filtered = useMemo(
    () => invoices.filter((i) => filter === 'all' || i.status === filter),
    [invoices, filter],
  );

  if (!data) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Invoices" />
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Invoices" subtitle={`${filtered.length} shown`} />
      <View className="px-4 pt-3">
        <FilterChips options={filters} value={filter} onChange={setFilter} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={palette.brand[600]} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {filtered.map((inv) => (
          <Card key={inv.id} className="mb-3" onPress={() => router.push(`/invoices/${inv.id}`)}>
            <View className="flex-row items-center justify-between">
              <Text className="text-[15px] font-bold text-ink dark:text-white">{inv.invoiceId}</Text>
              <Badge label={inv.status} status />
            </View>
            <Text className="mt-1 text-[13px] text-ink-muted dark:text-ink-faint">
              {inv.customerName}
            </Text>
            <View className="mt-3 flex-row items-end justify-between border-t border-line pt-3 dark:border-night-line">
              <View>
                <Text className="text-xs text-ink-faint">Due {formatDate(inv.dueDate)}</Text>
                <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">
                  {inv.planName} · {inv.speed}
                </Text>
              </View>
              <Text className="text-lg font-extrabold text-ink dark:text-white">
                {formatCurrency(inv.amount)}
              </Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
