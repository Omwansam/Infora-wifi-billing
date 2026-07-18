import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, SectionHeader } from '@/components/ui';
import { IconTile } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page-header';
import { timeAgo } from '@/lib/format';
import { palette } from '@/lib/theme';

const CHANNELS = [
  { icon: 'chatbox-ellipses' as const, label: 'SMS', sub: '12,480 sent · 98% delivered', color: palette.brand[600], bg: 'bg-brand-600/10' },
  { icon: 'mail' as const, label: 'Email', sub: '3,120 sent this month', color: palette.violet, bg: 'bg-violet/10' },
  { icon: 'megaphone' as const, label: 'Campaigns', sub: '2 active · 5 scheduled', color: palette.magenta, bg: 'bg-magenta/10' },
];

const ACTIVITY = [
  { icon: 'chatbox' as const, title: 'Payment reminder blast', sub: 'SMS to 214 overdue clients', at: new Date(Date.now() - 2 * 3600000).toISOString(), color: palette.brand[600] },
  { icon: 'mail-open' as const, title: 'Monthly newsletter', sub: 'Email to 1,240 subscribers', at: new Date(Date.now() - 26 * 3600000).toISOString(), color: palette.violet },
  { icon: 'megaphone' as const, title: '"Upgrade to 20 Mbps" promo', sub: 'Campaign · 38 conversions', at: new Date(Date.now() - 3 * 86400000).toISOString(), color: palette.magenta },
  { icon: 'chatbox' as const, title: 'Welcome onboarding', sub: 'SMS to 18 new clients', at: new Date(Date.now() - 4 * 86400000).toISOString(), color: palette.brand[600] },
];

export default function CommunicationScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Communication" subtitle="Reach your clients" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}>
        <View className="gap-3">
          {CHANNELS.map((c) => (
            <Card key={c.label} className="flex-row items-center">
              <IconTile icon={c.icon} color={c.color} bg={c.bg} />
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-ink dark:text-white">{c.label}</Text>
                <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">{c.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.slate[300]} />
            </Card>
          ))}
        </View>

        <SectionHeader title="Recent activity" className="mb-3 mt-6" />
        <Card flush>
          {ACTIVITY.map((a, i) => (
            <View
              key={a.title}
              className={`flex-row items-center p-4 ${i > 0 ? 'border-t border-line dark:border-night-line' : ''}`}>
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-xl bg-surface-sunken dark:bg-night-raised">
                <Ionicons name={a.icon} size={18} color={a.color} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink dark:text-white">{a.title}</Text>
                <Text className="text-xs text-ink-muted dark:text-ink-faint">{a.sub}</Text>
              </View>
              <Text className="text-xs text-ink-faint">{timeAgo(a.at)}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}
