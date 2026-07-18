import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, ErrorState, Loading } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useDevices } from '@/hooks/use-data';
import { formatNumber, timeAgo } from '@/lib/format';
import { palette } from '@/lib/theme';

export default function DevicesScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useDevices();

  if (!data) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Devices" subtitle="MikroTik routers" />
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </View>
    );
  }

  const devices = data;
  const online = devices.filter((d) => d.status === 'online').length;
  const totalClients = devices.reduce((s, d) => s + d.clientCount, 0);

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Devices" subtitle="MikroTik routers" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={palette.brand[600]} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {/* Summary */}
        <View className="mb-4 flex-row gap-3">
          <Card className="flex-1">
            <Text className="text-2xl font-extrabold text-ink dark:text-white">
              {online}/{devices.length}
            </Text>
            <Text className="text-xs text-ink-muted dark:text-ink-faint">Routers online</Text>
          </Card>
          <Card className="flex-1">
            <Text className="text-2xl font-extrabold text-ink dark:text-white">
              {formatNumber(totalClients)}
            </Text>
            <Text className="text-xs text-ink-muted dark:text-ink-faint">Connected clients</Text>
          </Card>
        </View>

        {devices.map((d) => (
          <Card key={d.id} className="mb-3">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View
                  className={`mr-3 h-11 w-11 items-center justify-center rounded-xl ${
                    d.status === 'online' ? 'bg-success/10' : 'bg-danger/10'
                  }`}>
                  <Ionicons
                    name="hardware-chip"
                    size={22}
                    color={d.status === 'online' ? palette.success : palette.danger}
                  />
                </View>
                <View>
                  <Text className="text-[15px] font-bold text-ink dark:text-white">{d.name}</Text>
                  <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">
                    {d.model} · {d.ip}
                  </Text>
                </View>
              </View>
              <Badge label={d.status} status dot />
            </View>

            <View className="mt-3 flex-row border-t border-line pt-3 dark:border-night-line">
              <View className="flex-1">
                <Text className="text-xs text-ink-faint">Clients</Text>
                <Text className="mt-0.5 text-sm font-bold text-ink dark:text-white">
                  {d.clientCount}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-ink-faint">Uptime</Text>
                <Text className="mt-0.5 text-sm font-bold text-ink dark:text-white">{d.uptime}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-ink-faint">Bandwidth</Text>
                <Text className="mt-0.5 text-sm font-bold text-ink dark:text-white">
                  {d.bandwidthUsage} Mbps
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row items-center">
              <Ionicons name="location-outline" size={13} color={palette.slate[400]} />
              <Text className="ml-1 text-xs text-ink-muted dark:text-ink-faint">{d.location}</Text>
              <View className="mx-2 h-1 w-1 rounded-full bg-ink-faint" />
              <Text className="text-xs text-ink-faint">Synced {timeAgo(d.lastSynced)}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
