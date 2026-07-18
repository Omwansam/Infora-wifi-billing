import { Text, View } from 'react-native';

export interface BarDatum {
  label: string;
  value: number;
}

interface MiniBarChartProps {
  data: BarDatum[];
  height?: number;
  /** Formats the peak-value tooltip label. */
  format?: (n: number) => string;
}

/**
 * Lightweight bar chart built from Views (no chart lib) — good enough for the
 * dashboard revenue sparkline and keeps the bundle lean.
 */
export function MiniBarChart({ data, height = 120, format }: MiniBarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  return (
    <View>
      <View className="flex-row items-end justify-between" style={{ height }}>
        {data.map((d) => {
          const h = Math.max(6, (d.value / max) * height);
          const isPeak = d.label === peak.label;
          return (
            <View key={d.label} className="flex-1 items-center justify-end px-1">
              {isPeak && format ? (
                <Text className="mb-1 text-[10px] font-bold text-brand-600 dark:text-brand-400">
                  {format(d.value)}
                </Text>
              ) : null}
              <View
                className={`w-full rounded-lg ${isPeak ? 'bg-brand-600' : 'bg-brand-600/25'}`}
                style={{ height: isPeak && format ? h - 16 : h }}
              />
            </View>
          );
        })}
      </View>
      <View className="mt-2 flex-row justify-between">
        {data.map((d) => (
          <View key={d.label} className="flex-1 items-center">
            <Text className="text-[11px] font-medium text-ink-faint">{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface DonutProps {
  slices: { label: string; value: number; color: string }[];
}

/** Legend + proportional bar (stand-in for a donut) for revenue split. */
export function SplitBar({ slices }: DonutProps) {
  const total = Math.max(1, slices.reduce((s, x) => s + x.value, 0));
  return (
    <View>
      <View className="h-3 flex-row overflow-hidden rounded-full">
        {slices.map((s) => (
          <View key={s.label} style={{ flex: s.value / total, backgroundColor: s.color }} />
        ))}
      </View>
      <View className="mt-3 flex-row flex-wrap gap-x-5 gap-y-2">
        {slices.map((s) => (
          <View key={s.label} className="flex-row items-center">
            <View className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <Text className="text-[13px] font-medium text-ink-soft dark:text-ink-faint">
              {s.label} · {Math.round((s.value / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
