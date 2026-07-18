import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { Badge, Card, Screen, SectionHeader } from '@/components/ui';
import { LargeHeader } from '@/components/ui/page-header';
import { IconTile } from '@/components/ui/list-row';
import { useDashboard, useInvoices, usePayments } from '@/hooks/use-data';
import { formatCurrency } from '@/lib/format';
import { palette } from '@/lib/theme';

export default function BillingScreen() {
  const { data: dashboard, loading, refetch } = useDashboard();
  const { data: invoicesData, refetch: refetchInvoices } = useInvoices();
  const { data: paymentsData } = usePayments();

  const invoices = invoicesData ?? [];
  const outstanding = invoices
    .filter((i) => i.status === 'pending' || i.status === 'overdue')
    .reduce((s, i) => s + i.amount, 0);
  const collectedMonth = dashboard?.revenuePeriods.thisMonth ?? 0;
  const mrr = dashboard?.finance.mrr ?? 0;
  const recentInvoices = invoices.slice(0, 5);

  const SECTIONS = [
    {
      icon: 'cash' as const,
      label: 'Payments',
      sub: `${(paymentsData ?? []).length} recorded`,
      color: palette.success,
      bg: 'bg-success/10',
      href: '/payments',
    },
    {
      icon: 'document-text' as const,
      label: 'Invoices',
      sub: `${invoices.filter((i) => i.status !== 'paid').length} unpaid`,
      color: palette.brand[600],
      bg: 'bg-brand-600/10',
      href: '/invoices',
    },
    {
      icon: 'swap-horizontal' as const,
      label: 'Transactions',
      sub: 'Full ledger',
      color: palette.violet,
      bg: 'bg-violet/10',
      href: '/transactions',
    },
    {
      icon: 'ticket' as const,
      label: 'Vouchers',
      sub: 'Hotspot codes',
      color: palette.warning,
      bg: 'bg-warning/10',
      href: '/vouchers',
    },
  ];

  return (
    <Screen
      onRefresh={() => {
        refetch();
        refetchInvoices();
      }}
      refreshing={loading}>
      <LargeHeader title="Billing" />

      {/* Money summary */}
      <Card className="mt-2 bg-brand-600">
        <Text className="text-sm font-medium text-brand-100">Collected this month</Text>
        <Text className="mt-1 text-3xl font-extrabold text-white">
          {formatCurrency(collectedMonth)}
        </Text>
        <View className="mt-4 flex-row">
          <View className="flex-1 border-r border-white/20 pr-4">
            <Text className="text-xs text-brand-100">Outstanding</Text>
            <Text className="mt-0.5 text-lg font-bold text-white">{formatCurrency(outstanding)}</Text>
          </View>
          <View className="flex-1 pl-4">
            <Text className="text-xs text-brand-100">MRR</Text>
            <Text className="mt-0.5 text-lg font-bold text-white">{formatCurrency(mrr)}</Text>
          </View>
        </View>
      </Card>

      {/* Section grid */}
      <View className="mt-4 flex-row flex-wrap gap-3">
        {SECTIONS.map((s) => (
          <Card key={s.label} onPress={() => router.push(s.href)} className="w-[48%]">
            <IconTile icon={s.icon} color={s.color} bg={s.bg} />
            <Text className="mt-3 text-base font-bold text-ink dark:text-white">{s.label}</Text>
            <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">{s.sub}</Text>
          </Card>
        ))}
      </View>

      {/* Recent invoices */}
      <SectionHeader
        title="Recent invoices"
        className="mb-3 mt-6"
        action="See all"
        onAction={() => router.push('/invoices')}
      />
      <Card flush>
        {recentInvoices.map((inv, i) => (
          <View
            key={inv.id}
            className={`flex-row items-center p-4 ${i > 0 ? 'border-t border-line dark:border-night-line' : ''}`}>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink dark:text-white">{inv.invoiceId}</Text>
              <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint" numberOfLines={1}>
                {inv.customerName} · {inv.planName}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-sm font-bold text-ink dark:text-white">
                {formatCurrency(inv.amount)}
              </Text>
              <View className="mt-1">
                <Badge label={inv.status} status />
              </View>
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
