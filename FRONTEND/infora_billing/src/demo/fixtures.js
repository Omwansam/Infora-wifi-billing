/**
 * Seeded demo data — realistic Kenyan WISP dataset (KES, M-Pesa, MikroTik).
 * Generated deterministically so every demo session tells the same story.
 */

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

// Small deterministic PRNG (mulberry32) — same data on every load.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20260716);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

const NOW = new Date();
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);
const hoursAgo = (n) => new Date(NOW.getTime() - n * 3600000);
const daysAhead = (n) => new Date(NOW.getTime() + n * 86400000);
const iso = (d) => d.toISOString();
const isoDate = (d) => d.toISOString().slice(0, 10);

const FIRST_NAMES = [
  'James', 'Mary', 'John', 'Grace', 'Peter', 'Faith', 'David', 'Mercy',
  'Samuel', 'Esther', 'Joseph', 'Ruth', 'Daniel', 'Joyce', 'Brian', 'Ann',
  'Kevin', 'Lucy', 'Dennis', 'Susan', 'Collins', 'Naomi', 'Victor', 'Agnes',
  'George', 'Catherine', 'Michael', 'Beatrice', 'Stephen', 'Winnie', 'Paul',
  'Caroline', 'Anthony', 'Janet', 'Felix', 'Sarah', 'Martin', 'Eunice',
  'Patrick', 'Lydia', 'Elijah', 'Rose', 'Moses', 'Purity', 'Isaac', 'Gladys',
  'Charles', 'Miriam',
];
const LAST_NAMES = [
  'Mwangi', 'Wanjiku', 'Otieno', 'Achieng', 'Kamau', 'Njeri', 'Ochieng',
  'Adhiambo', 'Kariuki', 'Wairimu', 'Mutua', 'Muthoni', 'Kiprop', 'Chebet',
  'Omondi', 'Akinyi', 'Ndungu', 'Wambui', 'Kipchoge', 'Jepkosgei', 'Maina',
  'Nyambura', 'Onyango', 'Atieno', 'Gitau', 'Wangari', 'Musyoka', 'Mueni',
  'Rotich', 'Cherono', 'Njoroge', 'Waithera', 'Ouma', 'Anyango', 'Karanja',
  'Njoki', 'Kilonzo', 'Ndinda', 'Sang', 'Jebet', 'Macharia', 'Wanjiru',
  'Owino', 'Awuor', 'Mburu', 'Gathoni', 'Mutiso', 'Kalekye',
];
const AREAS = [
  'Ruiru Town', 'Kahawa Sukari', 'Kahawa Wendani', 'Membley Estate',
  'Kimbo', 'Gitambaya', 'Toll Estate', 'Kamakis', 'Wataalam', 'Murera',
  'Gatongora', 'Mugutha', 'Juja Farm', 'BTL Junction', 'Prunes Estate',
];
const ROUTERS = [
  'Ruiru-Core-CCR2004', 'Kahawa-Sukari-RB4011', 'Membley-hAP-AX3',
  'Kimbo-RB3011', 'Kamakis-CRS328',
];

const mpesaRef = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789';
  let out = 'S';
  for (let i = 0; i < 9; i += 1) out += chars[Math.floor(rand() * chars.length)];
  return out;
};
const phone = () => `+2547${between(10, 39)}${String(between(100000, 999999))}`;
const mac = () =>
  Array.from({ length: 6 }, () =>
    between(0, 255).toString(16).padStart(2, '0').toUpperCase()
  ).join(':');

/* ------------------------------------------------------------------ */
/* service plans                                                       */
/* ------------------------------------------------------------------ */

let planId = 0;
const hotspotPlan = (name, price, speed, hours, popular = false) => ({
  id: (planId += 1),
  name,
  description: `${name} hotspot access at ${speed}`,
  plan_type: 'hotspot',
  price,
  currency: 'KES',
  speed,
  download_speed: parseInt(speed, 10),
  upload_speed: Math.max(1, Math.round(parseInt(speed, 10) / 2)),
  data_limit: null,
  duration_hours: hours,
  duration_days: hours >= 24 ? Math.round(hours / 24) : null,
  is_active: true,
  popular,
  customer_count: between(14, 160),
  created_at: iso(daysAgo(220)),
  updated_at: iso(daysAgo(between(2, 30))),
});
const pppoePlan = (name, price, speed, popular = false) => ({
  id: (planId += 1),
  name,
  description: `${name} — unlimited monthly fibre/wireless at ${speed}`,
  plan_type: 'pppoe',
  price,
  currency: 'KES',
  speed,
  download_speed: parseInt(speed, 10),
  upload_speed: parseInt(speed, 10),
  data_limit: null,
  duration_hours: 720,
  duration_days: 30,
  is_active: true,
  popular,
  customer_count: between(8, 90),
  created_at: iso(daysAgo(300)),
  updated_at: iso(daysAgo(between(2, 45))),
});

export const PLANS = [
  hotspotPlan('1 Hour Blast', 10, '3 Mbps', 1),
  hotspotPlan('3 Hours Surf', 20, '3 Mbps', 3),
  hotspotPlan('Daily Unlimited', 50, '5 Mbps', 24, true),
  hotspotPlan('Weekly Unlimited', 250, '5 Mbps', 168),
  hotspotPlan('Monthly Hotspot', 900, '6 Mbps', 720),
  pppoePlan('Home Basic', 1500, '5 Mbps'),
  pppoePlan('Home Plus', 2500, '10 Mbps', true),
  pppoePlan('Family Stream', 3500, '20 Mbps'),
  pppoePlan('Business Pro', 6500, '40 Mbps'),
  pppoePlan('Enterprise Fibre', 15000, '100 Mbps'),
];

const PPPOE_PLANS = PLANS.filter((p) => p.plan_type === 'pppoe');
const HOTSPOT_PLANS = PLANS.filter((p) => p.plan_type === 'hotspot');

/* ------------------------------------------------------------------ */
/* customers                                                           */
/* ------------------------------------------------------------------ */

const STATUS_POOL = [
  'active', 'active', 'active', 'active', 'active', 'active', 'active',
  'active', 'suspended', 'expired', 'pending',
];
const KYC_POOL = ['verified', 'verified', 'verified', 'pending', 'rejected'];

export const CUSTOMERS = Array.from({ length: 48 }, (_, i) => {
  const id = i + 1;
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[i % LAST_NAMES.length];
  const connection = i % 3 === 2 ? 'hotspot' : 'pppoe';
  const plan = connection === 'pppoe' ? pick(PPPOE_PLANS) : pick(HOTSPOT_PLANS);
  const status = STATUS_POOL[i % STATUS_POOL.length];
  const joined = daysAgo(between(20, 400));
  const subStart = daysAgo(between(1, 28));
  const username = `${first}.${last}`.toLowerCase();
  return {
    id,
    first_name: first,
    last_name: last,
    name: `${first} ${last}`,
    email: `${username}@gmail.com`,
    phone: phone(),
    address: `${pick(AREAS)}, Kiambu`,
    connection_type: connection,
    status,
    plan_id: plan.id,
    service_plan: plan.name,
    package: `${plan.name} (${plan.speed})`,
    monthly_fee: plan.price,
    balance: status === 'active' ? 0 : between(0, plan.price),
    join_date: isoDate(joined),
    created_at: iso(joined),
    radius_username: username,
    id_number: String(between(10000000, 39999999)),
    kyc_status: KYC_POOL[i % KYC_POOL.length],
    kyc_verified_at: i % KYC_POOL.length < 3 ? iso(daysAgo(between(5, 90))) : null,
    kyc_notes: '',
    subscription_start: isoDate(subStart),
    subscription_end: isoDate(daysAhead(between(1, 30))),
    usage_percentage: between(5, 98),
    device_count: between(1, 4),
    last_payment_date: isoDate(daysAgo(between(0, 30))),
    wireguard_peer: null,
  };
});

const ACTIVE_CUSTOMERS = CUSTOMERS.filter((c) => c.status === 'active');

/* ------------------------------------------------------------------ */
/* invoices                                                            */
/* ------------------------------------------------------------------ */

const INVOICE_STATUS = ['paid', 'paid', 'paid', 'pending', 'overdue', 'draft'];

export const INVOICES = Array.from({ length: 42 }, (_, i) => {
  const customer = CUSTOMERS[i % CUSTOMERS.length];
  const plan = PLANS.find((p) => p.id === customer.plan_id) || PPPOE_PLANS[0];
  const status = INVOICE_STATUS[i % INVOICE_STATUS.length];
  const issued = daysAgo(between(0, 90));
  const id = i + 1;
  return {
    id,
    invoice_id: `INV-2026-${String(1000 + id)}`,
    customer_id: customer.id,
    customerName: customer.name,
    customer_name: customer.name,
    amount: plan.price,
    total: plan.price,
    status,
    issueDate: isoDate(issued),
    issue_date: isoDate(issued),
    dueDate: isoDate(new Date(issued.getTime() + 14 * 86400000)),
    due_date: isoDate(new Date(issued.getTime() + 14 * 86400000)),
    items: [
      {
        id: 1,
        description: `${plan.name} — ${plan.speed} (monthly subscription)`,
        quantity: 1,
        unit_price: plan.price,
        total: plan.price,
      },
    ],
  };
});

export const INVOICE_STATS = {
  total_invoices: INVOICES.length,
  paid_invoices: INVOICES.filter((i) => i.status === 'paid').length,
  pending_invoices: INVOICES.filter((i) => i.status === 'pending').length,
  overdue_invoices: INVOICES.filter((i) => i.status === 'overdue').length,
  total_amount: INVOICES.reduce((s, i) => s + i.amount, 0),
  pending_amount: INVOICES.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0),
  overdue_amount: INVOICES.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
};

/* ------------------------------------------------------------------ */
/* payments & transactions                                             */
/* ------------------------------------------------------------------ */

const METHODS = [
  { method: 'mpesa', methodLabel: 'M-Pesa' },
  { method: 'mpesa', methodLabel: 'M-Pesa' },
  { method: 'mpesa', methodLabel: 'M-Pesa' },
  { method: 'mpesa', methodLabel: 'M-Pesa' },
  { method: 'cash', methodLabel: 'Cash' },
  { method: 'bank', methodLabel: 'Bank Transfer' },
];
const PAY_STATUS = [
  'completed', 'completed', 'completed', 'completed', 'completed',
  'completed', 'completed', 'pending', 'failed',
];

export const PAYMENTS = Array.from({ length: 64 }, (_, i) => {
  const customer = CUSTOMERS[(i * 3) % CUSTOMERS.length];
  const plan = PLANS.find((p) => p.id === customer.plan_id) || HOTSPOT_PLANS[0];
  const m = METHODS[i % METHODS.length];
  const when = hoursAgo(between(1, 24 * 30));
  return {
    id: i + 1,
    customer_id: customer.id,
    customerName: customer.name,
    customer_name: customer.name,
    amount: plan.price,
    method: m.method,
    methodLabel: m.methodLabel,
    reference: m.method === 'mpesa' ? mpesaRef() : `RCPT-${2000 + i}`,
    status: PAY_STATUS[i % PAY_STATUS.length],
    date: iso(when),
    created_at: iso(when),
  };
});

export const TRANSACTIONS = PAYMENTS.map((p, i) => ({
  ...p,
  type: i % 17 === 0 ? 'refund' : 'payment',
  typeLabel: i % 17 === 0 ? 'Refund' : 'Payment',
  value: p.amount,
}));

/* ------------------------------------------------------------------ */
/* subscriptions                                                       */
/* ------------------------------------------------------------------ */

export const SUBSCRIPTIONS = ACTIVE_CUSTOMERS.filter(
  (c) => c.connection_type === 'pppoe'
).map((c, i) => {
  const plan = PLANS.find((p) => p.id === c.plan_id) || PPPOE_PLANS[0];
  return {
    id: i + 1,
    customer_id: c.id,
    customerName: c.name,
    customerEmail: c.email,
    planName: plan.name,
    planSpeed: plan.speed,
    monthlyAmount: plan.price,
    startDate: c.subscription_start,
    status: 'active',
    usagePercentage: c.usage_percentage,
  };
});

export const SUBSCRIPTION_STATS = {
  total_subscriptions: SUBSCRIPTIONS.length,
  active_subscriptions: SUBSCRIPTIONS.length,
  monthly_recurring_revenue: SUBSCRIPTIONS.reduce((s, x) => s + x.monthlyAmount, 0),
};

/* ------------------------------------------------------------------ */
/* vouchers                                                            */
/* ------------------------------------------------------------------ */

const VOUCHER_STATUS = ['active', 'active', 'active', 'used', 'expired'];
export const VOUCHERS = Array.from({ length: 18 }, (_, i) => {
  const plan = HOTSPOT_PLANS[i % HOTSPOT_PLANS.length];
  const status = VOUCHER_STATUS[i % VOUCHER_STATUS.length];
  return {
    id: i + 1,
    code: `LUMEN-${String(between(100000, 999999))}`,
    type: 'time',
    value: plan.price,
    plan_name: plan.name,
    status,
    usedCount: status === 'used' ? 1 : 0,
    maxUses: 1,
    expiresAt: isoDate(status === 'expired' ? daysAgo(between(1, 20)) : daysAhead(between(5, 60))),
    created_at: iso(daysAgo(between(1, 60))),
  };
});

/* ------------------------------------------------------------------ */
/* tickets                                                             */
/* ------------------------------------------------------------------ */

const TICKET_SEED = [
  ['Slow speeds in the evening', 'high', 'open'],
  ['Cannot connect after M-Pesa payment', 'urgent', 'open'],
  ['Requesting plan upgrade to 20 Mbps', 'medium', 'in_progress'],
  ['Router keeps rebooting', 'high', 'in_progress'],
  ['Change WiFi password', 'low', 'resolved'],
  ['Billing dispute — double charge', 'high', 'resolved'],
  ['Relocation — move connection to new house', 'medium', 'open'],
  ['Hotspot voucher not working', 'medium', 'resolved'],
  ['Intermittent drops on PPPoE', 'high', 'open'],
  ['Request invoice statement for June', 'low', 'closed'],
];

export const TICKETS = TICKET_SEED.map(([subject, priority, status], i) => {
  const customer = CUSTOMERS[(i * 5) % CUSTOMERS.length];
  const created = daysAgo(between(0, 14));
  return {
    id: i + 1,
    subject,
    priority,
    status,
    customer_id: customer.id,
    customerName: customer.name,
    customer_name: customer.name,
    assignedTo: pick(['Demo Admin', 'Support Team', 'Field Tech — Ruiru']),
    createdAt: iso(created),
    created_at: iso(created),
    messages: [
      {
        id: 1,
        sender: customer.name,
        sender_type: 'customer',
        message: `Hi, ${subject.toLowerCase()}. Please assist.`,
        created_at: iso(created),
      },
      {
        id: 2,
        sender: 'Support Team',
        sender_type: 'staff',
        message: 'Thanks for reaching out — we are looking into this and will update you shortly.',
        created_at: iso(new Date(created.getTime() + 3600000)),
      },
    ],
  };
});

/* ------------------------------------------------------------------ */
/* devices / network                                                   */
/* ------------------------------------------------------------------ */

export const DEVICES = ROUTERS.map((name, i) => ({
  id: i + 1,
  device_name: name,
  device_ip: `10.10.${i + 1}.1`,
  device_model: name.split('-').pop(),
  device_status: i === 3 ? 'offline' : 'online',
  client_count: i === 3 ? 0 : between(24, 210),
  bandwidth_usage: between(120, 900),
  location: AREAS[i * 2],
  uptime: `${between(3, 40)}d ${between(0, 23)}h`,
  last_synced: iso(hoursAgo(between(0, 6))),
  is_active: true,
  management_wg_enabled: i < 3,
  management_wg_ip: i < 3 ? `10.99.0.${i + 2}` : null,
  isp_name: 'Lumen Demo ISP',
  zone_name: AREAS[i * 2],
  notes: '',
}));

export const DEVICE_STATS = {
  total_devices: DEVICES.length,
  active_devices: DEVICES.length,
  online_devices: DEVICES.filter((d) => d.device_status === 'online').length,
  offline_devices: DEVICES.filter((d) => d.device_status === 'offline').length,
  total_clients: DEVICES.reduce((s, d) => s + d.client_count, 0),
};

export const ISPS = [
  {
    id: 1,
    name: 'Lumen Demo ISP',
    contact_email: 'noc@lumen.app',
    contact_phone: '+254700000001',
    status: 'active',
    customer_count: CUSTOMERS.length,
    device_count: DEVICES.length,
    location: 'Ruiru, Kiambu',
    created_at: iso(daysAgo(400)),
  },
];

/* ------------------------------------------------------------------ */
/* live sessions (RADIUS accounting)                                   */
/* ------------------------------------------------------------------ */

export const SESSIONS = ACTIVE_CUSTOMERS.slice(0, 16).map((c, i) => {
  const start = hoursAgo(between(0, 9));
  return {
    id: i + 1,
    username: c.radius_username,
    customer_id: c.id,
    customer_name: c.name,
    connection_type: c.connection_type,
    ip_address: `100.64.${between(0, 9)}.${between(2, 250)}`,
    mac_address: mac(),
    plan_name: c.service_plan,
    router_name: pick(ROUTERS),
    session_start: iso(start),
    duration_seconds: Math.floor((NOW - start) / 1000),
    bytes_in: between(40, 4200) * 1024 * 1024,
    bytes_out: between(10, 900) * 1024 * 1024,
  };
});

/* ------------------------------------------------------------------ */
/* system users                                                        */
/* ------------------------------------------------------------------ */

export const USERS = [
  { id: 1, name: 'Demo Admin', first_name: 'Demo', last_name: 'Admin', email: 'demo@lumen.app', role: 'admin', status: 'active', is_active: true, lastLogin: iso(hoursAgo(0)) },
  { id: 2, name: 'Support Team', first_name: 'Support', last_name: 'Team', email: 'support@lumen.app', role: 'support', status: 'active', is_active: true, lastLogin: iso(hoursAgo(5)) },
  { id: 3, name: 'Finance Desk', first_name: 'Finance', last_name: 'Desk', email: 'finance@lumen.app', role: 'finance', status: 'active', is_active: true, lastLogin: iso(daysAgo(1)) },
  { id: 4, name: 'Field Tech', first_name: 'Field', last_name: 'Tech', email: 'tech@lumen.app', role: 'technician', status: 'inactive', is_active: false, lastLogin: iso(daysAgo(9)) },
];

/* ------------------------------------------------------------------ */
/* finance                                                             */
/* ------------------------------------------------------------------ */

export const LEADS = [
  ['Kamakis Apartments Block C', 'site-survey scheduled', 'referral'],
  ['Green Valley Estate', 'contacted', 'website'],
  ['Ruiru Sports Club', 'new', 'walk-in'],
  ['Membley Court Phase 2', 'quoted', 'facebook'],
  ['Juja Farm SACCO offices', 'won', 'referral'],
  ['Sunrise Academy', 'contacted', 'whatsapp'],
].map(([name, status, source], i) => ({
  id: i + 1,
  name,
  contact_name: `${FIRST_NAMES[i + 10]} ${LAST_NAMES[i + 10]}`,
  phone: phone(),
  email: `lead${i + 1}@example.com`,
  location: pick(AREAS),
  status,
  source,
  estimated_value: between(5, 60) * 1000,
  notes: 'Interested in bulk internet for residents.',
  created_at: iso(daysAgo(between(1, 30))),
}));

export const EXPENSES = [
  ['Bandwidth — upstream provider', 'bandwidth', 185000],
  ['Field technician salaries', 'payroll', 96000],
  ['New MikroTik hAP AX3 units (x6)', 'equipment', 54000],
  ['Fuel & transport — installations', 'transport', 18500],
  ['Office rent — Ruiru', 'rent', 35000],
  ['SMS gateway top-up', 'communication', 6500],
  ['Tower lease — Kamakis mast', 'infrastructure', 25000],
  ['Fibre splicing tools', 'equipment', 12800],
].map(([description, category, amount], i) => ({
  id: i + 1,
  description,
  category,
  amount,
  vendor: pick(['Safaricom', 'Poa Internet Wholesale', 'TP Distributors', 'Local supplier']),
  status: i % 5 === 4 ? 'pending' : 'paid',
  date: isoDate(daysAgo(between(1, 28))),
  created_at: iso(daysAgo(between(1, 28))),
}));

const totalRevenue = PAYMENTS.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
const totalExpenses = EXPENSES.reduce((s, e) => s + e.amount, 0);

export const FINANCE_SUMMARY = {
  total_revenue: totalRevenue,
  total_expenses: totalExpenses,
  net_profit: totalRevenue - totalExpenses,
  monthly_recurring_revenue: SUBSCRIPTION_STATS.monthly_recurring_revenue,
  outstanding_invoices: INVOICE_STATS.pending_amount + INVOICE_STATS.overdue_amount,
  arpu: Math.round(totalRevenue / Math.max(1, ACTIVE_CUSTOMERS.length)),
  expense_breakdown: Object.entries(
    EXPENSES.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {})
  ).map(([category, amount]) => ({ category, amount })),
  revenue_trend: Array.from({ length: 6 }, (_, i) => ({
    label: daysAgo((5 - i) * 30).toLocaleDateString('en-KE', { month: 'short' }),
    revenue: between(280, 520) * 1000,
    expenses: between(180, 320) * 1000,
  })),
};

/* ------------------------------------------------------------------ */
/* KYC                                                                 */
/* ------------------------------------------------------------------ */

export const KYC_RECORDS = CUSTOMERS.slice(0, 20).map((c, i) => ({
  id: i + 1,
  customer_id: c.id,
  customer_name: c.name,
  customer_email: c.email,
  customer_phone: c.phone,
  status: c.kyc_status,
  id_number: c.id_number,
  document_type: pick(['national_id', 'passport']),
  documents: [],
  submitted_at: iso(daysAgo(between(2, 60))),
  verified_at: c.kyc_verified_at,
  notes: c.kyc_status === 'rejected' ? 'ID photo unclear — please re-upload.' : '',
}));

export const KYC_STATS = {
  total: KYC_RECORDS.length,
  pending: KYC_RECORDS.filter((r) => r.status === 'pending').length,
  verified: KYC_RECORDS.filter((r) => r.status === 'verified').length,
  rejected: KYC_RECORDS.filter((r) => r.status === 'rejected').length,
};

/* ------------------------------------------------------------------ */
/* dashboard                                                           */
/* ------------------------------------------------------------------ */

const gb = (n) => n * 1024 * 1024 * 1024;
const radiusPeriod = (scale) => ({
  upload_bytes: gb(between(8, 30)) * scale,
  download_bytes: gb(between(60, 200)) * scale,
  unique_users: Math.min(ACTIVE_CUSTOMERS.length, between(10, 40) * scale),
  sessions: between(30, 120) * scale,
  live_sessions: SESSIONS.length,
});

const subsFor = (type) => {
  const all = CUSTOMERS.filter((c) => c.connection_type === type);
  return {
    total: all.length,
    active: all.filter((c) => c.status === 'active').length,
    expired: all.filter((c) => c.status === 'expired').length,
    suspended: all.filter((c) => c.status === 'suspended').length,
    new_month: between(2, 8),
    live_sessions: SESSIONS.filter((s) => s.connection_type === type).length,
  };
};

export const DASHBOARD_STATS = {
  summary: {
    total_customers: CUSTOMERS.length,
    active_customers: ACTIVE_CUSTOMERS.length,
    pppoe_customers: CUSTOMERS.filter((c) => c.connection_type === 'pppoe').length,
    hotspot_customers: CUSTOMERS.filter((c) => c.connection_type === 'hotspot').length,
    total_revenue: totalRevenue,
    monthly_payments: Math.round(totalRevenue * 0.4),
    today_payments: PAYMENTS.filter((p) => new Date(p.date) > daysAgo(1) && p.status === 'completed').reduce((s, p) => s + p.amount, 0),
    open_tickets: TICKETS.filter((t) => t.status === 'open').length,
    online_devices: DEVICE_STATS.online_devices,
    total_devices: DEVICE_STATS.total_devices,
  },
  revenue_periods: {
    today: PAYMENTS.filter((p) => new Date(p.date) > daysAgo(1) && p.status === 'completed').reduce((s, p) => s + p.amount, 0),
    yesterday: between(8, 18) * 1000,
    this_week: between(60, 90) * 1000,
    this_month: Math.round(totalRevenue * 0.4),
    last_month: between(280, 420) * 1000,
    this_year: totalRevenue * 6,
  },
  revenue_by_type: {
    pppoe: Math.round(totalRevenue * 0.72),
    hotspot: Math.round(totalRevenue * 0.28),
  },
  revenue_data: Array.from({ length: 12 }, (_, i) => {
    const d = daysAgo((11 - i) * 30);
    const revenue = between(260, 560) * 1000;
    return {
      label: d.toLocaleDateString('en-KE', { month: 'short' }),
      month: d.toLocaleDateString('en-KE', { month: 'short' }),
      revenue,
      amount: revenue,
      value: revenue,
    };
  }),
  subscribers: { pppoe: subsFor('pppoe'), hotspot: subsFor('hotspot') },
  hotspot_activity: {
    today: between(40, 120),
    yesterday: between(40, 120),
    this_week: between(300, 700),
    this_month: between(1200, 2600),
    sales_today: between(400, 3000),
  },
  radius_periods: {
    today: radiusPeriod(1),
    week: radiusPeriod(3),
    month: radiusPeriod(8),
    last_month: radiusPeriod(8),
    all: radiusPeriod(20),
  },
  top_data_users: SESSIONS.slice(0, 8)
    .map((s) => ({
      username: s.username,
      customer_name: s.customer_name,
      plan_name: s.plan_name,
      download_bytes: s.bytes_in,
      upload_bytes: s.bytes_out,
      total_bytes: s.bytes_in + s.bytes_out,
    }))
    .sort((a, b) => b.total_bytes - a.total_bytes),
  top_data_users_by_period: {},
  routers: DEVICES.map((d) => ({ id: d.id, name: d.device_name, status: d.device_status })),
  roadmap: [],
  alerts: [
    { id: 1, type: 'warning', title: `${ROUTERS[3]} is offline`, message: 'Last seen 4 hours ago — site power reported down.', created_at: iso(hoursAgo(4)) },
    { id: 2, type: 'info', title: `${INVOICE_STATS.overdue_invoices} overdue invoices`, message: 'Automated SMS reminders were sent this morning.', created_at: iso(hoursAgo(9)) },
  ],
  generated_at: iso(NOW),
};

export const CUSTOMER_STATS = {
  total_clients: CUSTOMERS.length,
  total_customers: CUSTOMERS.length,
  active_customers: ACTIVE_CUSTOMERS.length,
  suspended_customers: CUSTOMERS.filter((c) => c.status === 'suspended').length,
  pending_customers: CUSTOMERS.filter((c) => c.status === 'pending').length,
  pppoe_clients: CUSTOMERS.filter((c) => c.connection_type === 'pppoe').length,
  hotspot_clients: CUSTOMERS.filter((c) => c.connection_type === 'hotspot').length,
  active_pppoe_clients: ACTIVE_CUSTOMERS.filter((c) => c.connection_type === 'pppoe').length,
  active_hotspot_clients: ACTIVE_CUSTOMERS.filter((c) => c.connection_type === 'hotspot').length,
};

/* ------------------------------------------------------------------ */
/* captive portal (public)                                             */
/* ------------------------------------------------------------------ */

export const PORTAL_CONFIG = {
  company_name: 'Lumen Demo WiFi',
  name: 'Lumen Demo WiFi',
  tagline: 'Fast, reliable internet for home and business',
  support_phone: '+254700000000',
  support_email: 'support@lumen.app',
  mpesa_paybill: '4123456',
  location: 'Ruiru, Kiambu',
  currency: 'KES',
};

export const PLAN_STATS = {
  total_plans: PLANS.length,
  active_plans: PLANS.filter((p) => p.is_active).length,
  popular_plans: PLANS.filter((p) => p.popular).length,
  hotspot_plans: HOTSPOT_PLANS.length,
  pppoe_plans: PPPOE_PLANS.length,
  total_customers: CUSTOMERS.length,
};
