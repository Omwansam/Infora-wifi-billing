import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, ErrorState, Loading, Segmented, type ChipOption } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useTransactions } from '@/hooks/use-data';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { palette } from '@/lib/theme';

const TABS: ChipOption[] = [
  { value: 'all', label: 'All' },
  { value: 'payment', label: 'Payments' },
  { value: 'refund', label: 'Refunds' },
];

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('all');
  const { data, loading, error, refetch } = useTransactions();

  const filtered = useMemo(
    () => (data ?? []).filter((t) => tab === 'all' || t.type === tab),
    [data, tab],
  );

  if (!data) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Transactions" subtitle="Full ledger" />
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Transactions" subtitle="Full ledger" />
      <View className="px-4 pt-3">
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={palette.brand[600]} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <Card flush>
          {filtered.map((t, i) => {
            const isRefund = t.type === 'refund';
            return (
              <View
                key={t.id}
                className={`flex-row items-center p-4 ${i > 0 ? 'border-t border-line dark:border-night-line' : ''}`}>
                <View
                  className={`mr-3 h-10 w-10 items-center justify-center rounded-full ${
                    isRefund ? 'bg-danger/10' : 'bg-success/10'
                  }`}>
                  <Ionicons
                    name={isRefund ? 'arrow-up' : 'arrow-down'}
                    size={18}
                    color={isRefund ? palette.danger : palette.success}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink dark:text-white">
                    {t.customerName}
                  </Text>
                  <Text className="text-xs text-ink-muted dark:text-ink-faint">
                    {t.typeLabel} · {t.methodLabel}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className={`text-sm font-bold ${isRefund ? 'text-danger' : 'text-success'}`}>
                    {isRefund ? '-' : '+'}
                    {formatCurrency(t.amount)}
                  </Text>
                  <Text className="text-[11px] text-ink-faint">{formatDateTime(t.date)}</Text>
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </View>
  );
}
