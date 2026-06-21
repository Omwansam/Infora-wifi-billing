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
