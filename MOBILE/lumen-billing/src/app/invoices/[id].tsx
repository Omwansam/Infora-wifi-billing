import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Divider, ErrorState, KeyValue, Loading } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useCustomers, useInvoice } from '@/hooks/use-data';
import { formatCurrency, formatDate } from '@/lib/format';
import { palette } from '@/lib/theme';

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: invoice, loading, error, refetch } = useInvoice(Number(id));
  const { data: customers } = useCustomers();
  const customer = invoice ? customers?.find((c) => c.id === invoice.customerId) : undefined;

  if (!invoice) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Invoice" />
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-ink-muted dark:text-ink-faint">Invoice not found.</Text>
          </View>
        )}
      </View>
    );
  }

  const subtotal = invoice.amount;
  const tax = Math.round(subtotal * 0.16);
  const total = subtotal + tax;

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader
        title={invoice.invoiceId}
        right={
          <View className="h-9 w-9 items-center justify-center rounded-full">
            <Ionicons name="share-outline" size={22} color={palette.slate[500]} />
          </View>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <Card className="items-center">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/10">
            <Ionicons name="document-text" size={26} color={palette.brand[600]} />
          </View>
          <Text className="mt-3 text-3xl font-extrabold text-ink dark:text-white">
            {formatCurrency(total)}
          </Text>
          <View className="mt-2">
            <Badge label={invoice.status} status />
          </View>
        </Card>

        <Card className="mt-3">
          <KeyValue label="Billed to" value={invoice.customerName} />
          <Divider />
          <KeyValue label="Phone" value={customer?.phone ?? '—'} />
          <Divider />
          <KeyValue label="Issued" value={formatDate(invoice.issueDate)} />
          <Divider />
          <KeyValue label="Due" value={formatDate(invoice.dueDate)} />
        </Card>

        <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Line items
        </Text>
        <Card>
          <View className="flex-row items-start justify-between py-1">
            <View className="flex-1 pr-3">
              <Text className="text-sm font-semibold text-ink dark:text-white">
                {invoice.planName}
              </Text>
              <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">
                {invoice.speed} · monthly subscription
              </Text>
            </View>
            <Text className="text-sm font-semibold text-ink dark:text-white">
              {formatCurrency(subtotal)}
            </Text>
          </View>
          <Divider />
          <KeyValue label="Subtotal" value={formatCurrency(subtotal)} />
          <KeyValue label="VAT (16%)" value={formatCurrency(tax)} />
          <Divider />
          <View className="flex-row items-center justify-between pt-3">
            <Text className="text-base font-bold text-ink dark:text-white">Total</Text>
            <Text className="text-base font-extrabold text-ink dark:text-white">
              {formatCurrency(total)}
            </Text>
          </View>
        </Card>

        <View className="mt-6 gap-3">
          {invoice.status !== 'paid' ? (
            <Button label="Record payment" icon="cash" onPress={() => router.push('/payments')} />
          ) : null}
          <Button label="Send reminder" icon="paper-plane" variant="secondary" />
        </View>
      </ScrollView>
    </View>
  );
}
