export function normalizePlanFeatures(features) {
  if (!features) return [];
  if (Array.isArray(features)) {
    return features.filter((feature) => typeof feature === 'string' && feature.trim() !== '');
  }
  if (typeof features === 'object') {
    return Object.values(features).filter((feature) => typeof feature === 'string' && feature.trim() !== '');
  }
  if (typeof features === 'string') {
    return features.trim() ? [features] : [];
  }
  return [];
}

export function planMonthlyRevenue(plan, subscriberCount = 0) {
  const price = Number(plan?.price) || 0;
  const count = Number(subscriberCount) || 0;
  return price * count;
}

/** Colored icon + label config per package type (matches packages table UI). */
export const PACKAGE_TYPE_META = {
  hotspot: {
    label: 'HOTSPOT',
    iconName: 'wifi',
    iconBg: 'bg-teal-500',
    tagClass: 'text-teal-600',
  },
  pppoe: {
    label: 'PPPOE',
    iconName: 'router',
    iconBg: 'bg-violet-500',
    tagClass: 'text-violet-600',
  },
  trial: {
    label: 'TRIAL',
    iconName: 'gift',
    iconBg: 'bg-orange-500',
    tagClass: 'text-orange-600',
  },
  bundle: {
    label: 'BUNDLE',
    iconName: 'layers',
    iconBg: 'bg-blue-500',
    tagClass: 'text-blue-600',
  },
  wireguard: {
    label: 'WIREGUARD',
    iconName: 'shield',
    iconBg: 'bg-emerald-500',
    tagClass: 'text-emerald-600',
  },
};

function parseMbps(value) {
  if (value == null || value === '') return null;
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function parseDataCapFromFeatures(features) {
  if (!features) return null;
  if (typeof features === 'object' && !Array.isArray(features)) {
    const cap = features.data_cap;
    if (!cap || String(cap).toLowerCase() === 'unlimited') return null;
    return String(cap).trim();
  }
  if (Array.isArray(features)) {
    const dataLine = features.find(
      (f) => typeof f === 'string' && /^data:/i.test(f.trim())
    );
    if (dataLine) {
      const label = dataLine.replace(/^data:\s*/i, '').trim();
      if (label && label.toLowerCase() !== 'unlimited') return label;
    }
  }
  return null;
}

export function packageSpeedHint(plan) {
  if (plan?.speed_display) return plan.speed_display;

  let download = plan?.download_mbps ?? plan?.bandwidth_limit;
  let upload = plan?.upload_mbps;

  const rawFeatures = plan?.features;
  if (typeof rawFeatures === 'object' && rawFeatures && !Array.isArray(rawFeatures)) {
    if (download == null) {
      download = parseMbps(rawFeatures.download_speed) ?? parseMbps(rawFeatures.bandwidth_limit);
    }
    if (upload == null) upload = parseMbps(rawFeatures.upload_speed);
  }

  if (download == null) download = parseMbps(plan?.speed);
  if (upload == null) upload = download;

  if (download) {
    if (upload && upload !== download) return `${upload}/${download}M`;
    return `${download}/${download}`;
  }

  const ratio = String(plan?.speed || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (ratio) return `${ratio[1]}/${ratio[2]}M`;
  return plan?.speed || '';
}

export function packageDurationLabel(plan) {
  if (plan?.duration_hours) {
    const h = Number(plan.duration_hours);
    if (h >= 24 && h % 24 === 0) {
      const days = h / 24;
      return `${days} day${days === 1 ? '' : 's'}`;
    }
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  if (plan?.billing_cycle_days) {
    const d = Number(plan.billing_cycle_days);
    return `${d} day${d === 1 ? '' : 's'}`;
  }
  if (plan?.plan_type === 'pppoe') return '30 days';
  return '—';
}

export function packageDataLimitLabel(plan) {
  if (plan?.data_cap_display) return plan.data_cap_display;

  const fromFeatures = parseDataCapFromFeatures(plan?.features);
  if (fromFeatures) return fromFeatures;

  const limit = plan?.data_limit;
  if (limit == null || limit === '' || limit === 0) return 'Unlimited';
  const gb = Number(limit);
  if (Number.isNaN(gb) || gb <= 0) return 'Unlimited';
  if (gb < 1) return `${Math.round(gb * 1024)} MB`;
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1).replace(/\.0$/, '')} GB`;
}

export function packagePriceLabel(plan, formatCurrency) {
  const price = Number(plan?.price) || 0;
  if ((plan?.plan_type === 'trial' && price === 0)) {
    return { text: 'Free', isFree: true };
  }
  return { text: formatCurrency(price), isFree: false };
}
