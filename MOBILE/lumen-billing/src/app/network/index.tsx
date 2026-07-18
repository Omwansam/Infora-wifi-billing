import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, SectionHeader } from '@/components/ui';
import { Divider, IconTile } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page-header';
import { palette } from '@/lib/theme';

const SERVICES = [
  { icon: 'server' as const, label: 'RADIUS', sub: 'FreeRADIUS · AAA', status: 'online', color: palette.success, bg: 'bg-success/10' },
  { icon: 'people-circle' as const, label: 'LDAP', sub: 'Directory & auth', status: 'online', color: palette.brand[600], bg: 'bg-brand-600/10' },
  { icon: 'pulse' as const, label: 'SNMP', sub: 'Device monitoring', status: 'online', color: palette.violet, bg: 'bg-violet/10' },
  { icon: 'lock-closed' as const, label: 'VPN', sub: 'Site-to-site tunnels', status: 'online', color: palette.info, bg: 'bg-info/10' },
  { icon: 'shield-checkmark' as const, label: 'WireGuard', sub: '3 management peers', status: 'online', color: palette.success, bg: 'bg-success/10' },
  { icon: 'key' as const, label: 'EAP', sub: '802.1X / PEAP', status: 'degraded', color: palette.warning, bg: 'bg-warning/10' },
];

const ISPS = [
  { name: 'Infora Networks', sub: 'Ruiru, Kiambu · primary', customers: 48, uplink: '1 Gbps fibre' },
];

export default function NetworkScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Network & RADIUS" subtitle="Core services" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <SectionHeader title="Upstream ISPs" />
        {ISPS.map((isp) => (
          <Card key={isp.name} className="mb-3">
            <View className="flex-row items-center">
              <IconTile icon="business" color={palette.brand[600]} bg="bg-brand-600/10" />
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-ink dark:text-white">{isp.name}</Text>
                <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">{isp.sub}</Text>
              </View>
              <Badge label="active" status dot />
            </View>
            <View className="mt-3 flex-row border-t border-line pt-3 dark:border-night-line">
              <View className="flex-1">
                <Text className="text-xs text-ink-faint">Customers</Text>
                <Text className="mt-0.5 text-sm font-bold text-ink dark:text-white">
                  {isp.customers}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-xs text-ink-faint">Uplink</Text>
                <Text className="mt-0.5 text-sm font-bold text-ink dark:text-white">
                  {isp.uplink}
                </Text>
              </View>
            </View>
          </Card>
        ))}

        <SectionHeader title="Core services" className="mb-3 mt-6" />
        <Card flush className="px-4">
          {SERVICES.map((s, i) => (
            <View key={s.label}>
              <View className="flex-row items-center py-3">
                <IconTile icon={s.icon} color={s.color} bg={s.bg} />
                <View className="ml-3 flex-1">
                  <Text className="text-[15px] font-semibold text-ink dark:text-white">
                    {s.label}
                  </Text>
                  <Text className="mt-0.5 text-[13px] text-ink-muted dark:text-ink-faint">
                    {s.sub}
                  </Text>
                </View>
                <Badge label={s.status} status dot />
              </View>
              {i < SERVICES.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
