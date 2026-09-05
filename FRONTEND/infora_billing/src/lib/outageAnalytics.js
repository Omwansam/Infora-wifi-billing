/**
 * Derived statistics for a device's outage log.
 *
 * Everything here is computed from the outage rows the API already returns, so
 * the panel gains analysis without a second request or a schema change.
 *
 * The governing rule is: never claim a pattern the sample cannot support. Every
 * finding below is gated on a minimum number of outages, because "outages
 * cluster in the morning" drawn from three events is not an insight, it is
 * noise with a confident sentence attached — and an operator who acts on it
 * once and finds nothing stops trusting the panel entirely.
 */

/** Minutes between two ISO timestamps. */
const minutesBetween = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));

/** Duration bands. Ordered, and the boundaries match the daily strip's bands. */
export const DURATION_BUCKETS = [
  { key: 'blip', label: 'Under 1 min', test: (m) => m < 1 },
  { key: 'short', label: '1–5 min', test: (m) => m >= 1 && m < 5 },
  { key: 'medium', label: '5–30 min', test: (m) => m >= 5 && m < 30 },
  { key: 'long', label: '30–60 min', test: (m) => m >= 30 && m < 60 },
  { key: 'major', label: 'Over an hour', test: (m) => m >= 60 },
];

/** The middle value — reported alongside the mean because one long outage drags
 *  the mean far above anything the operator actually experienced. */
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Headline reliability figures.
 *
 * `mtbf` is mean time BETWEEN failures, so it divides the time the router was
 * actually up — not the whole window — by the failure count. Dividing the whole
 * window would flatter a router that spent much of it down.
 */
export function reliability(outages, measuredMinutes, totalDownMinutes) {
  const count = outages.length;
  const durations = outages.map((o) => o.minutes || 0);
  const upMinutes = Math.max(0, (measuredMinutes || 0) - (totalDownMinutes || 0));
  return {
    count,
    mtbf: count ? Math.round(upMinutes / count) : null,
    mttr: count ? Math.round((totalDownMinutes || 0) / count) : null,
    median: median(durations),
    longest: durations.length ? Math.max(...durations) : 0,
  };
}

/**
 * Outages counted by the hour they STARTED, in the viewer's timezone.
 *
 * Start hour, not overlap: this chart asks "when do failures begin", which is
 * the causal signal — a scheduled job, a thermal peak, the hour the generator
 * changes over. Spreading a long outage across the hours it spans would blur
 * exactly the thing being looked for. (The daily strip does the opposite, and
 * correctly so: it measures downtime, not events.)
 */
export function byHour(outages) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const o of outages) {
    if (!o.started_at) continue;
    hours[new Date(o.started_at).getHours()].count += 1;
  }
  return hours;
}

/** Outage counts and downtime share per duration band. */
export function byDuration(outages, totalDownMinutes) {
  const total = totalDownMinutes || outages.reduce((n, o) => n + (o.minutes || 0), 0);
  return DURATION_BUCKETS.map((bucket) => {
    const rows = outages.filter((o) => bucket.test(o.minutes || 0));
    const minutes = rows.reduce((n, o) => n + (o.minutes || 0), 0);
    return {
      ...bucket,
      count: rows.length,
      minutes,
      share: total ? (minutes / total) * 100 : 0,
    };
  });
}

/** The 6-hour window holding the most outage starts, for the clustering test. */
function busiestWindow(hourly) {
  let best = { start: 0, count: -1 };
  for (let start = 0; start < 24; start += 1) {
    let count = 0;
    for (let offset = 0; offset < 6; offset += 1) count += hourly[(start + offset) % 24].count;
    if (count > best.count) best = { start, count };
  }
  return best;
}

/** Gaps between consecutive outages, oldest first — how long peace tends to last. */
export function gaps(outages) {
  const closed = [...outages]
    .filter((o) => o.started_at)
    .sort((a, b) => new Date(a.started_at) - new Date(b.started_at));
  const out = [];
  for (let i = 1; i < closed.length; i += 1) {
    const prevEnd = closed[i - 1].ended_at || closed[i - 1].started_at;
    out.push(minutesBetween(prevEnd, closed[i].started_at));
  }
  return out;
}

const SLA_TARGET = 99.9;

/**
 * Plain-language findings, most actionable first.
 *
 * Each carries a `tone` the panel renders with an icon and a label, never with
 * colour alone. `minSample` gates exist on every pattern claim — see the note at
 * the top of this file.
 */
export function insights({ outages, data, stats, hourly, buckets }) {
  const found = [];
  const count = outages.length;
  const totalDown = data?.total_minutes || 0;
  const measured = data?.measured_minutes || 0;

  if (data?.currently_down) {
    const open = outages.find((o) => o.open);
    found.push({
      tone: 'critical',
      title: 'Offline right now',
      text: open
        ? `The current outage started ${new Date(open.started_at).toLocaleString()} and is still open. Everything below excludes nothing — this outage is already counted.`
        : 'The router is not answering.',
    });
  }

  // Flapping: many brief drops is a different fault, and a different fix, from
  // one long one. Worth saying explicitly because the availability figure alone
  // cannot tell the two apart.
  const brief = buckets.filter((b) => b.key === 'blip' || b.key === 'short');
  const briefCount = brief.reduce((n, b) => n + b.count, 0);
  const briefShare = brief.reduce((n, b) => n + b.share, 0);
  if (count >= 8 && briefCount / count >= 0.6) {
    found.push({
      tone: 'serious',
      title: 'This looks like flapping, not repeated failure',
      text: `${briefCount} of ${count} outages lasted under 5 minutes, and together they account for only ${briefShare.toFixed(0)}% of total downtime. That pattern points at an unstable uplink, PoE or site power rather than the router itself — check the physical link before reconfiguring anything.`,
    });
  }

  // One dominant outage: the mean is misleading whenever this is true.
  if (count >= 3 && totalDown > 0 && stats.longest / totalDown >= 0.3) {
    const worst = outages.reduce((a, b) => ((b.minutes || 0) > (a.minutes || 0) ? b : a));
    found.push({
      tone: 'warning',
      title: 'One outage dominates the total',
      text: `A single ${Math.round(stats.longest)}-minute outage on ${new Date(worst.started_at).toLocaleDateString()} is ${Math.round((stats.longest / totalDown) * 100)}% of all downtime in this window. Judge the rest by the median (${stats.median}m), not the average.`,
    });
  }

  // Time-of-day clustering.
  if (count >= 10) {
    const window = busiestWindow(hourly);
    if (window.count / count >= 0.5) {
      const to = (window.start + 6) % 24;
      const fmt = (h) => `${String(h).padStart(2, '0')}:00`;
      found.push({
        tone: 'warning',
        title: `Outages cluster between ${fmt(window.start)} and ${fmt(to)}`,
        text: `${window.count} of ${count} outages began in that six-hour window. Concentration at one time of day usually means something scheduled — a generator changeover, a thermal peak, or a backup job — rather than a random fault.`,
      });
    }
  }

  // SLA budget, stated in minutes because that is what an operator can act on.
  if (measured > 0) {
    const budget = measured * (1 - SLA_TARGET / 100);
    const over = totalDown > budget;
    found.push({
      tone: over ? 'serious' : 'good',
      title: over
        ? `Over a ${SLA_TARGET}% availability budget`
        : `Within a ${SLA_TARGET}% availability budget`,
      text: over
        ? `A ${SLA_TARGET}% target allows ${budget.toFixed(0)} minutes of downtime over the ${Math.round(measured / 60)} hours monitored. This router has used ${totalDown} minutes.`
        : `${totalDown} of the ${budget.toFixed(0)} minutes a ${SLA_TARGET}% target allows over the ${Math.round(measured / 60)} hours monitored.`,
    });
  }

  // Downtime nobody was credited for.
  const uncredited = outages.filter((o) => !o.open && !o.compensated_at && (o.minutes || 0) >= 5);
  if (uncredited.length) {
    const mins = uncredited.reduce((n, o) => n + (o.minutes || 0), 0);
    found.push({
      tone: 'warning',
      title: 'Downtime with no subscriber credit',
      text: `${uncredited.length} outage${uncredited.length === 1 ? '' : 's'} over 5 minutes (${mins} minutes in total) carry no compensation record. If your terms promise credit for outages, these are the ones owed it.`,
    });
  }

  // Honesty about the sample. Last, so it frames everything above it.
  if (measured > 0 && measured < 7 * 1440) {
    found.push({
      tone: 'note',
      title: 'Based on a short monitoring history',
      text: `Only ${(measured / 1440).toFixed(1)} days of this window have actually been monitored, so these figures describe that period — not the full range selected.`,
    });
  }

  return found;
}
