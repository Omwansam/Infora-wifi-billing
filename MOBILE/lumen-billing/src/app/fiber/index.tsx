import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, EmptyState, ErrorState, Loading, SectionHeader } from '@/components/ui';
import { Divider, IconTile } from '@/components/ui/list-row';
import { PageHeader } from '@/components/ui/page-header';
import { palette } from '@/lib/theme';
import { fiberService } from '@/services';
import type { FiberNodeDTO } from '@/services/fiber';

/**
 * Field GPS capture.
 *
 * The office can trace plant off aerial imagery, but only someone standing at
 * the pole knows where the box really is. This screen closes that gap: it lists
 * what has no coordinates and pins it from the phone.
 *
 * The accuracy reading is not decoration. A pin recorded at ±40 m is worse than
 * no pin — it sends the next tech to the wrong side of the road while looking
 * authoritative on the map. So we show it, colour it, and refuse to save
 * silently when it is poor.
 */

/** Above this many metres of uncertainty a pin is not worth recording. */
const ACCURACY_LIMIT_M = 20;
/** Good enough to identify a specific pole. */
const ACCURACY_GOOD_M = 8;

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  olt: 'server',
  cabinet: 'file-tray-stacked',
  splitter: 'git-branch',
  odb: 'cube',
  joint: 'link',
  pole: 'flag',
  handhole: 'ellipse',
  customer: 'home',
};

const KIND_LABEL: Record<string, string> = {
  olt: 'OLT', cabinet: 'Cabinet / FDT', splitter: 'Splitter', odb: 'ODB / FAT',
  joint: 'Joint', pole: 'Pole', handhole: 'Handhole', customer: 'Premises',
};

function accuracyTone(accuracy: number | null) {
  if (accuracy === null) return { color: palette.slate[500], label: 'unknown' };
  if (accuracy <= ACCURACY_GOOD_M) return { color: palette.success, label: 'good' };
  if (accuracy <= ACCURACY_LIMIT_M) return { color: palette.warning, label: 'usable' };
  return { color: palette.danger, label: 'too rough' };
}

export default function FiberFieldScreen() {
  const insets = useSafeAreaInsets();
  const [nodes, setNodes] = useState<FiberNodeDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [fix, setFix] = useState<Location.LocationObject | null>(null);
  const [locating, setLocating] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setNodes(await fiberService.listUnplaced());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the plant');
      setNodes([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Watch continuously rather than sampling on demand: a fix taken the instant
  // someone taps is usually the coarse network fix, not the settled GPS one.
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') { setPermission('denied'); return; }
      setPermission('granted');
      setLocating(true);
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 2000 },
        (position) => { setFix(position); setLocating(false); },
      );
    })();

    return () => { cancelled = true; subscription?.remove(); };
  }, []);

  const savePin = async (node: FiberNodeDTO) => {
    if (!fix) return;
    const accuracy = fix.coords.accuracy ?? null;
    const { latitude, longitude } = fix.coords;

    const commit = async () => {
      setSavingId(node.id);
      try {
        await fiberService.place('node', node.id, latitude, longitude);
        setNodes((prev) => (prev ?? []).filter((n) => n.id !== node.id));
        Alert.alert('Pinned', `${node.name} recorded at ${latitude.toFixed(5)}, ${longitude.toFixed(5)}.`);
      } catch (e) {
        Alert.alert('Could not pin', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setSavingId(null);
      }
    };

    if (accuracy !== null && accuracy > ACCURACY_LIMIT_M) {
      Alert.alert(
        'Position is rough',
        `The phone is only sure to about ${Math.round(accuracy)} m. That is wide enough to point at the wrong pole. Stand in the open for a few seconds and let it settle.`,
        [{ text: 'Wait' }, { text: 'Save anyway', style: 'destructive', onPress: commit }],
      );
      return;
    }
    await commit();
  };

  const accuracy = fix?.coords.accuracy ?? null;
  const tone = accuracyTone(accuracy);

  return (
    <View className="flex-1 bg-surface-muted dark:bg-night">
      <PageHeader title="Field survey" subtitle="Pin plant from where you stand" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          />
        }>
        {/* --- current fix --- */}
        <Card className="mb-4">
          <View className="flex-row items-center">
            <IconTile icon="locate" color={tone.color} bg="bg-brand-600/10" />
            <View className="ml-3 flex-1">
              <Text className="text-base font-bold text-ink dark:text-white">Your position</Text>
              <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint">
                {permission === 'denied'
                  ? 'Location permission denied'
                  : fix
                    ? `${fix.coords.latitude.toFixed(6)}, ${fix.coords.longitude.toFixed(6)}`
                    : locating ? 'Acquiring GPS…' : 'Waiting for a fix'}
              </Text>
            </View>
            {accuracy !== null ? (
              <View className="items-end">
                <Text className="text-lg font-bold" style={{ color: tone.color }}>
                  ±{Math.round(accuracy)} m
                </Text>
                <Text className="text-[10px] uppercase tracking-wider text-ink-faint">{tone.label}</Text>
              </View>
            ) : null}
          </View>

          {permission === 'denied' ? (
            <View className="mt-3 rounded-xl bg-danger/10 p-3">
              <Text className="text-xs text-danger">
                Enable location for this app in your phone settings, then pull down to retry.
                Without it nothing can be pinned from the field.
              </Text>
            </View>
          ) : accuracy !== null && accuracy > ACCURACY_LIMIT_M ? (
            <View className="mt-3 rounded-xl bg-warning/10 p-3">
              <Text className="text-xs text-warning">
                Too rough to identify a pole. Step into the open and give it a few seconds —
                a wrong pin costs more than a missing one.
              </Text>
            </View>
          ) : null}
        </Card>

        {/* --- what needs placing --- */}
        <SectionHeader title="Waiting to be placed" />

        {nodes === null ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : nodes.length === 0 ? (
          <EmptyState
            icon="checkmark-done"
            title="Everything is placed"
            message="No plant is missing coordinates. Anything added in the office will show up here."
          />
        ) : (
          <Card className="overflow-hidden p-0">
            {nodes.map((node, index) => {
              const ready = permission === 'granted' && Boolean(fix);
              return (
                <View key={node.id}>
                  <View className="flex-row items-center p-4">
                    <IconTile
                      icon={KIND_ICON[node.kind] ?? 'cube'}
                      color={palette.brand[600]}
                      bg="bg-brand-600/10"
                    />
                    <View className="ml-3 flex-1">
                      <Text className="text-base font-semibold text-ink dark:text-white" numberOfLines={1}>
                        {node.name}
                      </Text>
                      <Text className="mt-0.5 text-xs text-ink-muted dark:text-ink-faint" numberOfLines={1}>
                        {KIND_LABEL[node.kind] ?? node.kind}
                        {node.code ? ` · ${node.code}` : ''}
                        {node.address ? ` · ${node.address}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      disabled={!ready || savingId === node.id}
                      onPress={() => savePin(node)}
                      className={`ml-2 flex-row items-center rounded-full px-3 py-2 ${
                        ready ? 'bg-brand-600 active:bg-brand-700' : 'bg-slate-300 dark:bg-night-raised'
                      }`}>
                      <Ionicons
                        name={savingId === node.id ? 'ellipsis-horizontal' : 'pin'}
                        size={14}
                        color="#fff"
                      />
                      <Text className="ml-1.5 text-xs font-bold text-white">
                        {savingId === node.id ? 'Saving' : 'Pin here'}
                      </Text>
                    </Pressable>
                  </View>
                  {index < nodes.length - 1 ? <Divider /> : null}
                </View>
              );
            })}
          </Card>
        )}

        <Text className="mt-4 px-1 text-xs leading-relaxed text-ink-faint">
          Pinning records your current position as the node&apos;s location. Stand at the box, not
          across the road — the map is used to dispatch the next person to it.
        </Text>
      </ScrollView>
    </View>
  );
}
