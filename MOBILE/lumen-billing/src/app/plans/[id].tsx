import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Divider, ErrorState, KeyValue, Loading } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useCustomers, usePlan } from '@/hooks/use-data';
import { formatCurrency } from '@/lib/format';
import { palette } from '@/lib/theme';

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: plan, loading, error, refetch } = usePlan(Number(id));
  const { data: customers } = useCustomers();

  if (!plan) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Plan" />
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-ink-muted dark:text-ink-faint">Plan not found.</Text>
          </View>
        )}
      </View>
    );
  }

  const isPppoe = plan.planType === 'pppoe';
  const subscribers = (customers ?? []).filter((c) => c.planId === plan.id);
  const mrr = plan.price * plan.customerCount;
  const duration = plan.durationDays
    ? `${plan.durationDays} day${plan.durationDays === 1 ? '' : 's'}`
    : `${plan.durationHours} hour${plan.durationHours === 1 ? '' : 's'}`;

  const features = [
    { icon: 'speedometer' as const, label: 'Download', value: `${plan.downloadSpeed} Mbps` },
    { icon: 'cloud-upload' as const, label: 'Upload', value: `${plan.uploadSpeed} Mbps` },
    { icon: 'time' as const, label: 'Validity', value: duration },
    { icon: 'infinite' as const, label: 'Data cap', value: 'Unlimited' },
  ];

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title={plan.name} subtitle={plan.planType.toUpperCase()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Hero */}
        <Card className={isPppoe ? 'bg-violet' : 'bg-warning'}>
          <View className="flex-row items-center justify-between">
            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
              <Ionicons name={isPppoe ? 'globe' : 'wifi'} size={26} color="#ffffff" />
            </View>
            {plan.popular ? <Badge label="Popular" tone="neutral" className="bg-white/25" /> : null}
          </View>
          <View className="mt-4 flex-row items-baseline">
            <Text className="text-4xl font-extrabold text-white">{formatCurrency(plan.price)}</Text>
            <Text className="ml-2 text-sm text-white/80">/ {duration}</Text>
          </View>
          <Text className="mt-1 text-sm text-white/85">{plan.description}</Text>
        </Card>

        {/* Feature grid */}
        <View className="mt-4 flex-row flex-wrap gap-3">
          {features.map((f) => (
            <Card key={f.label} className="w-[48%]">
              <Ionicons name={f.icon} size={20} color={palette.brand[600]} />
              <Text className="mt-2 text-lg font-extrabold text-ink dark:text-white">{f.value}</Text>
              <Text className="text-xs text-ink-muted dark:text-ink-faint">{f.label}</Text>
            </Card>
          ))}
        </View>

        {/* Business */}
        <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Performance
        </Text>
        <Card>
          <KeyValue label="Active subscribers" value={String(plan.customerCount)} />
          <Divider />
          <KeyValue label="Est. monthly revenue" value={formatCurrency(mrr)} />
          <Divider />
          <KeyValue label="Connection type" value={plan.planType.toUpperCase()} />
          <Divider />
          <KeyValue
            label="Status"
            value={plan.isActive ? 'Active' : 'Inactive'}
            valueClassName={plan.isActive ? 'text-success' : 'text-danger'}
          />
        </Card>

        {/* Subscribers preview */}
        <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Subscribers on this plan
        </Text>
        <Card flush>
          {subscribers.slice(0, 5).map((c, i) => (
            <View
              key={c.id}
              className={`flex-row items-center p-4 ${i > 0 ? 'border-t border-line dark:border-night-line' : ''}`}>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink dark:text-white">{c.name}</Text>
                <Text className="text-xs text-ink-muted dark:text-ink-faint">{c.address}</Text>
              </View>
              <Badge label={c.status} status />
            </View>
          ))}
          {subscribers.length === 0 ? (
            <Text className="p-4 text-sm text-ink-muted dark:text-ink-faint">
              No subscribers yet.
            </Text>
          ) : null}
        </Card>

        <View className="mt-6 gap-3">
          <Button label="Edit plan" icon="create-outline" variant="secondary" />
          <Button label="Deactivate plan" icon="power" variant="danger" />
        </View>
      </ScrollView>
    </View>
  );
}
