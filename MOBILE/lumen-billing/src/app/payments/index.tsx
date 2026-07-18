import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, ErrorState, FilterChips, Loading, type ChipOption } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { usePayments } from '@/hooks/use-data';
import type { Payment } from '@/data/types';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { palette } from '@/lib/theme';

const FILTERS: ChipOption[] = [
  { value: 'all', label: 'All' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const METHOD_ICON: Record<Payment['method'], keyof typeof Ionicons.glyphMap> = {
  mpesa: 'phone-portrait',
  cash: 'cash',
  bank: 'business',
};

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState('all');
  const { data, loading, error, refetch } = usePayments();

  const payments = data ?? [];
  const total = useMemo(
    () => payments.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0),
    [payments],
  );
  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (filter === 'all') return true;
        if (filter === 'pending' || filter === 'failed') return p.status === filter;
        return p.method === filter;
      }),
    [payments, filter],
  );

  if (!data) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Payments" />
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Payments" subtitle={`${formatCurrency(total)} collected`} />
      <View className="px-4 pt-3">
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={palette.brand[600]} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {filtered.map((p) => (
          <Card key={p.id} className="mb-3">
            <View className="flex-row items-center">
              <View
                className={`mr-3 h-11 w-11 items-center justify-center rounded-xl ${
                  p.status === 'failed' ? 'bg-danger/10' : 'bg-success/10'
                }`}>
                <Ionicons
                  name={METHOD_ICON[p.method]}
                  size={20}
                  color={p.status === 'failed' ? palette.danger : palette.success}
                />
              </View>
              <View className="flex-1">
                <Text className="text-[15px] font-bold text-ink dark:text-white">
                  {p.customerName}
                </Text>
                <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">
                  {p.methodLabel} · {p.reference}
                </Text>
              </View>
              <View className="items-end">
                <Text
                  className={`text-[15px] font-bold ${
                    p.status === 'failed' ? 'text-danger line-through' : 'text-ink dark:text-white'
                  }`}>
                  {formatCurrency(p.amount)}
                </Text>
                <Text className="mt-0.5 text-[11px] text-ink-faint">{formatDateTime(p.date)}</Text>
              </View>
            </View>
            {p.status !== 'completed' ? (
              <View className="mt-3 border-t border-line pt-3 dark:border-night-line">
                <Badge label={p.status} status />
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
