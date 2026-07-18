import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, ErrorState, Loading, ProgressBar, SectionHeader } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useExpenses, useFinanceSummary } from '@/hooks/use-data';
import { formatCurrency } from '@/lib/format';
import { palette } from '@/lib/theme';

const CATEGORY_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  bandwidth: 'cloud',
  payroll: 'people',
  equipment: 'hardware-chip',
  transport: 'car',
  rent: 'business',
  communication: 'chatbubbles',
  infrastructure: 'construct',
};

export default function FinanceScreen() {
  const insets = useSafeAreaInsets();
  const { data: f, loading, error, refetch } = useFinanceSummary();
  const { data: expensesData, refetch: refetchExpenses } = useExpenses();

  if (!f) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Finance" subtitle="Revenue & expenses" />
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </View>
    );
  }

  const expenses = expensesData ?? [];
  const maxExpense = Math.max(1, ...expenses.map((e) => e.amount));
  const reload = () => {
    refetch();
    refetchExpenses();
  };

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Finance" subtitle="Revenue & expenses" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={palette.brand[600]} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Net profit hero */}
        <Card className="bg-brand-600">
          <Text className="text-sm font-medium text-brand-100">Net profit (all time)</Text>
          <Text className="mt-1 text-3xl font-extrabold text-white">
            {formatCurrency(f.netProfit)}
          </Text>
          <View className="mt-4 flex-row">
            <View className="flex-1 border-r border-white/20 pr-3">
              <Text className="text-xs text-brand-100">Revenue</Text>
              <Text className="mt-0.5 text-base font-bold text-white">
                {formatCurrency(f.totalRevenue, true)}
              </Text>
            </View>
            <View className="flex-1 px-3">
              <Text className="text-xs text-brand-100">Expenses</Text>
              <Text className="mt-0.5 text-base font-bold text-white">
                {formatCurrency(f.totalExpenses, true)}
              </Text>
            </View>
            <View className="flex-1 pl-3">
              <Text className="text-xs text-brand-100">ARPU</Text>
              <Text className="mt-0.5 text-base font-bold text-white">
                {formatCurrency(f.arpu)}
              </Text>
            </View>
          </View>
        </Card>

        {/* KPI row */}
        <View className="mt-4 flex-row gap-3">
          <Card className="flex-1">
            <Ionicons name="repeat" size={20} color={palette.violet} />
            <Text className="mt-2 text-xl font-extrabold text-ink dark:text-white">
              {formatCurrency(f.mrr, true)}
            </Text>
            <Text className="text-xs text-ink-muted dark:text-ink-faint">Recurring / mo</Text>
          </Card>
          <Card className="flex-1">
            <Ionicons name="wallet" size={20} color={palette.success} />
            <Text className="mt-2 text-xl font-extrabold text-ink dark:text-white">
              {f.totalRevenue ? Math.round((f.netProfit / f.totalRevenue) * 100) : 0}%
            </Text>
            <Text className="text-xs text-ink-muted dark:text-ink-faint">Profit margin</Text>
          </Card>
        </View>

        {/* Expense breakdown */}
        <SectionHeader title="Expense breakdown" className="mb-3 mt-6" />
        <Card flush className="px-4">
          {expenses.map((e, i) => (
            <View key={e.id} className={`py-3 ${i > 0 ? 'border-t border-line dark:border-night-line' : ''}`}>
              <View className="flex-row items-center">
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-surface-sunken dark:bg-night-raised">
                  <Ionicons
                    name={CATEGORY_ICON[e.category] ?? 'pricetag'}
                    size={18}
                    color={palette.slate[500]}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink dark:text-white" numberOfLines={1}>
                    {e.description}
                  </Text>
                  <Text className="text-xs capitalize text-ink-muted dark:text-ink-faint">
                    {e.category} · {e.vendor}
                  </Text>
                </View>
                <Text className="text-sm font-bold text-ink dark:text-white">
                  {formatCurrency(e.amount)}
                </Text>
              </View>
              <ProgressBar value={(e.amount / maxExpense) * 100} className="mt-2" tone="danger" />
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
