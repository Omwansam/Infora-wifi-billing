import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, ErrorState, Loading, Screen, Segmented, type ChipOption } from '@/components/ui';
import { LargeHeader } from '@/components/ui/page-header';
import { usePlans } from '@/hooks/use-data';
import type { Plan } from '@/data/types';
import { formatCurrency } from '@/lib/format';
import { palette } from '@/lib/theme';

const TABS: ChipOption[] = [
  { value: 'all', label: 'All' },
  { value: 'pppoe', label: 'PPPoE' },
  { value: 'hotspot', label: 'Hotspot' },
];

function PlanCard({ plan }: { plan: Plan }) {
  const isPppoe = plan.planType === 'pppoe';
  const period = plan.durationDays
    ? plan.durationDays >= 30
      ? '/mo'
      : `/${plan.durationDays}d`
    : `/${plan.durationHours}h`;
  return (
    <Card onPress={() => router.push(`/plans/${plan.id}`)} className="mb-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-row items-center">
          <View
            className={`mr-3 h-11 w-11 items-center justify-center rounded-xl ${
              isPppoe ? 'bg-violet/10' : 'bg-warning/10'
            }`}>
            <Ionicons
              name={isPppoe ? 'globe' : 'wifi'}
              size={22}
              color={isPppoe ? palette.violet : palette.warning}
            />
          </View>
          <View>
            <View className="flex-row items-center">
              <Text className="text-base font-bold text-ink dark:text-white">{plan.name}</Text>
              {plan.popular ? (
                <View className="ml-2 rounded-full bg-brand-600/10 px-2 py-0.5">
                  <Text className="text-[10px] font-bold text-brand-600 dark:text-brand-400">
                    POPULAR
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">
              {plan.speed} · {plan.customerCount} subscribers
            </Text>
          </View>
        </View>
      </View>
      <View className="mt-3 flex-row items-end justify-between border-t border-line pt-3 dark:border-night-line">
        <View className="flex-row items-baseline">
          <Text className="text-xl font-extrabold text-ink dark:text-white">
            {formatCurrency(plan.price)}
          </Text>
          <Text className="ml-1 text-xs font-medium text-ink-faint">{period}</Text>
        </View>
        <Text className="text-xs font-semibold uppercase text-ink-muted dark:text-ink-faint">
          {plan.planType}
        </Text>
      </View>
    </Card>
  );
}

export default function PlansScreen() {
  const [tab, setTab] = useState('all');
  const { data, loading, error, refetch } = usePlans();

  const filtered = useMemo(
    () => (data ?? []).filter((p) => tab === 'all' || p.planType === tab),
    [data, tab],
  );

  const header = (
    <LargeHeader
      title="Plans"
      right={
        <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-brand-600">
          <Ionicons name="add" size={26} color="#ffffff" />
        </Pressable>
      }
    />
  );

  if (!data) {
    return (
      <Screen>
        {header}
        {loading ? <Loading /> : <ErrorState message={error ?? undefined} onRetry={refetch} />}
      </Screen>
    );
  }

  return (
    <Screen onRefresh={refetch} refreshing={loading}>
      {header}
      <View className="mt-1">
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>
      <View className="mt-4">
        {filtered.map((p) => (
          <PlanCard key={p.id} plan={p} />
        ))}
      </View>
    </Screen>
  );
}
