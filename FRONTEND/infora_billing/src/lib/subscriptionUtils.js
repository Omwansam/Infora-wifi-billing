/** Subscription / RADIUS helper utilities */

export function isSubscriptionExpired(subscriptionEnd) {
  if (!subscriptionEnd) return false;
  return new Date(subscriptionEnd) < new Date();
}

export function subscriptionStatusLabel(customer) {
  if (!customer) return '—';
  if (customer.status === 'suspended') return 'Suspended';
  if (isSubscriptionExpired(customer.subscription_end)) return 'Expired';
  if (customer.status === 'pending') return 'Pending';
  return 'Active';
}

export function subscriptionStatusTone(customer) {
  const label = subscriptionStatusLabel(customer);
  if (label === 'Expired' || label === 'Suspended') return 'text-rose-700 bg-rose-50';
  if (label === 'Pending') return 'text-amber-700 bg-amber-50';
  return 'text-emerald-700 bg-emerald-50';
}
