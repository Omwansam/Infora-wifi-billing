export function formatPaymentMethod(method) {
  if (!method) return 'Unknown';
  const labels = {
    credit_card: 'Credit Card',
    bank_transfer: 'Bank Transfer',
    paypal: 'PayPal',
    mpesa: 'M-Pesa',
    'm-pesa': 'M-Pesa',
    cash: 'Cash',
    mobile_money: 'Mobile Money',
  };
  const key = String(method).toLowerCase().replace(/\s+/g, '_');
  return labels[key] || method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getMethodStyle(method) {
  const label = formatPaymentMethod(method);
  const styles = {
    'M-Pesa': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    'Credit Card': 'bg-violet-50 text-violet-700 ring-violet-600/20',
    'Bank Transfer': 'bg-blue-50 text-blue-700 ring-blue-600/20',
    PayPal: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    Cash: 'bg-slate-50 text-slate-700 ring-slate-600/20',
  };
  return styles[label] || 'bg-slate-50 text-slate-700 ring-slate-600/20';
}

export function customerInitials(name) {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
