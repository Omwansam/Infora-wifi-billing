import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Avatar,
  Badge,
  Card,
  Divider,
  ErrorState,
  KeyValue,
  Loading,
  ProgressBar,
  SectionHeader,
} from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useCustomer, usePayments, usePlans } from '@/hooks/use-data';
import { formatCurrency, formatDate, humanize, timeAgo } from '@/lib/format';
import { palette } from '@/lib/theme';

function Action({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <Pressable className="flex-1 items-center rounded-xl bg-surface py-3 active:opacity-70 dark:bg-night-card">
      <Ionicons name={icon} size={22} color={color} />
      <Text className="mt-1.5 text-xs font-semibold text-ink-soft dark:text-ink-faint">{label}</Text>
    </Pressable>
  );
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const clientId = Number(id);
  const { data: client, loading, error, refetch } = useCustomer(clientId);
  const { data: plans } = usePlans();
  const { data: allPayments } = usePayments();

  if (!client) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Client" />
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-ink-muted dark:text-ink-faint">Client not found.</Text>
          </View>
        )}
      </View>
    );
  }

  const plan = plans?.find((p) => p.id === client.planId);
  const payments = (allPayments ?? []).filter((p) => p.customerId === client.id).slice(0, 5);

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader
        title="Client profile"
        right={
          <Pressable className="h-9 w-9 items-center justify-center rounded-full active:bg-surface-sunken dark:active:bg-night-raised">
            <Ionicons name="create-outline" size={22} color={palette.slate[500]} />
          </Pressable>
        }
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Identity */}
        <Card className="items-center">
          <Avatar name={client.name} size="lg" online={client.online} />
          <Text className="mt-3 text-xl font-extrabold text-ink dark:text-white">{client.name}</Text>
          <Text className="text-sm text-ink-muted dark:text-ink-faint">
            @{client.radiusUsername}
          </Text>
          <View className="mt-3 flex-row gap-2">
            <Badge label={client.status} status />
            <Badge label={client.connectionType.toUpperCase()} tone="brand" />
            <Badge label={`KYC ${humanize(client.kycStatus)}`} tone={client.kycStatus === 'verified' ? 'success' : client.kycStatus === 'pending' ? 'warning' : 'danger'} />
          </View>
        </Card>

        {/* Quick actions */}
        <View className="mt-3 flex-row gap-3">
          <Action icon="call" label="Call" color={palette.success} />
          <Action icon="chatbubble-ellipses" label="SMS" color={palette.brand[600]} />
          <Action icon="cash" label="Collect" color={palette.violet} />
          <Action icon="pause-circle" label="Suspend" color={palette.warning} />
        </View>

        {/* Balance */}
        <Card className="mt-3">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs font-medium text-ink-muted dark:text-ink-faint">
                Outstanding balance
              </Text>
              <Text
                className={`mt-1 text-2xl font-extrabold ${
                  client.balance > 0 ? 'text-danger' : 'text-success'
                }`}>
                {formatCurrency(client.balance)}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-xs font-medium text-ink-muted dark:text-ink-faint">
                Monthly fee
              </Text>
              <Text className="mt-1 text-lg font-bold text-ink dark:text-white">
                {formatCurrency(client.monthlyFee)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Subscription */}
        <SectionHeader title="Subscription" className="mb-3 mt-6" />
        <Card>
          <KeyValue label="Plan" value={plan?.name ?? client.servicePlan} />
          <Divider />
          <KeyValue label="Speed" value={plan?.speed ?? '—'} />
          <Divider />
          <KeyValue label="Renews on" value={formatDate(client.subscriptionEnd)} />
          <Divider />
          <View className="pt-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-ink-muted dark:text-ink-faint">Data usage</Text>
              <Text className="text-sm font-semibold text-ink dark:text-white">
                {client.usagePercentage}%
              </Text>
            </View>
            <ProgressBar value={client.usagePercentage} className="mt-2" />
          </View>
        </Card>

        {/* Contact & network */}
        <SectionHeader title="Contact & network" className="mb-3 mt-6" />
        <Card>
          <KeyValue label="Phone" value={client.phone} />
          <Divider />
          <KeyValue label="Email" value={client.email} />
          <Divider />
          <KeyValue label="Address" value={client.address} />
          <Divider />
          <KeyValue label="Router" value={client.router} />
          <Divider />
          <KeyValue label="ID number" value={client.idNumber} />
          <Divider />
          <KeyValue label="Devices" value={String(client.deviceCount)} />
        </Card>

        {/* Payments */}
        <SectionHeader title="Recent payments" className="mb-3 mt-6" />
        <Card flush>
          {payments.length === 0 ? (
            <Text className="p-4 text-sm text-ink-muted dark:text-ink-faint">No payments yet.</Text>
          ) : (
            payments.map((p, i) => (
              <View
                key={p.id}
                className={`flex-row items-center p-4 ${i > 0 ? 'border-t border-line dark:border-night-line' : ''}`}>
                <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-success/10">
                  <Ionicons name="cash-outline" size={18} color={palette.success} />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink dark:text-white">
                    {p.methodLabel}
                  </Text>
                  <Text className="text-xs text-ink-muted dark:text-ink-faint">{p.reference}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-bold text-ink dark:text-white">
                    {formatCurrency(p.amount)}
                  </Text>
                  <Text className="text-xs text-ink-faint">{timeAgo(p.date)}</Text>
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
