import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Card, ErrorState, Loading } from '@/components/ui';
import { PageHeader } from '@/components/ui/page-header';
import { useSessions } from '@/hooks/use-data';
import { formatBytes, formatDuration } from '@/lib/format';
import { palette } from '@/lib/theme';

export default function SessionsScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch } = useSessions();

  if (!data) {
    return (
      <View className="flex-1 bg-surface-muted dark:bg-night">
        <PageHeader title="Live sessions" />
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Live sessions" subtitle={`${data.length} online now`} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refetch} tintColor={palette.brand[600]} />
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        {data.map((s) => (
          <Card key={s.id} className="mb-3">
            <View className="flex-row items-center">
              <Avatar name={s.customerName} online />
              <View className="ml-3 flex-1">
                <Text className="text-[15px] font-bold text-ink dark:text-white">
                  {s.customerName}
                </Text>
                <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">
                  {s.ipAddress} · {s.router}
                </Text>
              </View>
              <View className="items-end">
                <View className="flex-row items-center">
                  <View className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success" />
                  <Text className="text-xs font-semibold text-success">
                    {formatDuration(s.durationSeconds)}
                  </Text>
                </View>
                <Text className="mt-0.5 text-[11px] uppercase text-ink-faint">
                  {s.connectionType}
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row border-t border-line pt-3 dark:border-night-line">
              <View className="flex-1 flex-row items-center">
                <Ionicons name="arrow-down" size={14} color={palette.success} />
                <Text className="ml-1.5 text-sm font-semibold text-ink dark:text-white">
                  {formatBytes(s.bytesIn)}
                </Text>
              </View>
              <View className="flex-1 flex-row items-center">
                <Ionicons name="arrow-up" size={14} color={palette.violet} />
                <Text className="ml-1.5 text-sm font-semibold text-ink dark:text-white">
                  {formatBytes(s.bytesOut)}
                </Text>
              </View>
              <Text className="text-xs text-ink-faint">{s.macAddress}</Text>
            </View>
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}
