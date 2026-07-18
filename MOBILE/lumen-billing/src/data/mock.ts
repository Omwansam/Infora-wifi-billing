/**
 * Seeded demo data — realistic Kenyan WISP dataset (KES, M-Pesa, MikroTik).
 * Mirrors the Infora web-admin demo fixtures so the mobile UI tells the same
 * story. Generated deterministically: same data on every launch.
 */
import type {
  Customer,
  DashboardData,
  Device,
  Expense,
  Invoice,
  Payment,
  Plan,
  Session,
  Ticket,
  Transaction,
  Voucher,
} from './types';

/* ---- deterministic PRNG (mulberry32) --------------------------------- */
function rng(seed: number) {
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
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const NOW = new Date();
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000);
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3600000);
const daysAhead = (n: number) => new Date(NOW.getTime() + n * 86400000);
const iso = (d: Date) => d.toISOString();
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

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
const macAddr = () =>
  Array.from({ length: 6 }, () => between(0, 255).toString(16).padStart(2, '0').toUpperCase()).join(':');

/* ---- plans ----------------------------------------------------------- */
let planId = 0;
const hotspotPlan = (name: string, price: number, speed: string, hours: number, popular = false): Plan => ({
  id: (planId += 1),
  name,
  description: `${name} hotspot access at ${speed}`,
  planType: 'hotspot',
  price,
  speed,
  downloadSpeed: parseInt(speed, 10),
  uploadSpeed: Math.max(1, Math.round(parseInt(speed, 10) / 2)),
  durationHours: hours,
  durationDays: hours >= 24 ? Math.round(hours / 24) : null,
  isActive: true,
  popular,
  customerCount: between(14, 160),
});
const pppoePlan = (name: string, price: number, speed: string, popular = false): Plan => ({
  id: (planId += 1),
  name,
  description: `${name} — unlimited monthly fibre/wireless at ${speed}`,
  planType: 'pppoe',
  price,
  speed,
  downloadSpeed: parseInt(speed, 10),
  uploadSpeed: parseInt(speed, 10),
  durationHours: 720,
  durationDays: 30,
  isActive: true,
  popular,
  customerCount: between(8, 90),
});

export const PLANS: Plan[] = [
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
const PPPOE_PLANS = PLANS.filter((p) => p.planType === 'pppoe');
const HOTSPOT_PLANS = PLANS.filter((p) => p.planType === 'hotspot');

/* ---- customers ------------------------------------------------------- */
const STATUS_POOL: Customer['status'][] = [
  'active', 'active', 'active', 'active', 'active', 'active', 'active',
  'active', 'suspended', 'expired', 'pending',
];
const KYC_POOL: Customer['kycStatus'][] = ['verified', 'verified', 'verified', 'pending', 'rejected'];

export const CUSTOMERS: Customer[] = Array.from({ length: 48 }, (_, i) => {
  const id = i + 1;
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[i % LAST_NAMES.length];
  const connection: Customer['connectionType'] = i % 3 === 2 ? 'hotspot' : 'pppoe';
  const plan = connection === 'pppoe' ? pick(PPPOE_PLANS) : pick(HOTSPOT_PLANS);
  const status = STATUS_POOL[i % STATUS_POOL.length];
  const username = `${first}.${last}`.toLowerCase();
  return {
    id,
    firstName: first,
    lastName: last,
    name: `${first} ${last}`,
    email: `${username}@gmail.com`,
    phone: phone(),
    address: `${pick(AREAS)}, Kiambu`,
    connectionType: connection,
    status,
    planId: plan.id,
    servicePlan: plan.name,
    package: `${plan.name} (${plan.speed})`,
    monthlyFee: plan.price,
    balance: status === 'active' ? 0 : between(0, plan.price),
    joinDate: isoDate(daysAgo(between(20, 400))),
    radiusUsername: username,
    idNumber: String(between(10000000, 39999999)),
    kycStatus: KYC_POOL[i % KYC_POOL.length],
    subscriptionEnd: isoDate(daysAhead(between(1, 30))),
    usagePercentage: between(5, 98),
    deviceCount: between(1, 4),
    lastPaymentDate: isoDate(daysAgo(between(0, 30))),
    router: pick(ROUTERS),
    online: status === 'active' && i % 3 !== 0,
  };
});
const ACTIVE_CUSTOMERS = CUSTOMERS.filter((c) => c.status === 'active');

/* ---- invoices -------------------------------------------------------- */
const INVOICE_STATUS: Invoice['status'][] = ['paid', 'paid', 'paid', 'pending', 'overdue', 'draft'];
export const INVOICES: Invoice[] = Array.from({ length: 42 }, (_, i) => {
  const customer = CUSTOMERS[i % CUSTOMERS.length];
  const plan = PLANS.find((p) => p.id === customer.planId) ?? PPPOE_PLANS[0];
  const status = INVOICE_STATUS[i % INVOICE_STATUS.length];
  const issued = daysAgo(between(0, 90));
  const id = i + 1;
  return {
    id,
    invoiceId: `INV-2026-${String(1000 + id)}`,
    customerId: customer.id,
    customerName: customer.name,
    amount: plan.price,
    status,
    issueDate: isoDate(issued),
    dueDate: isoDate(new Date(issued.getTime() + 14 * 86400000)),
    planName: plan.name,
    speed: plan.speed,
  };
});

/* ---- payments & transactions ----------------------------------------- */
const METHODS: { method: Payment['method']; methodLabel: string }[] = [
  { method: 'mpesa', methodLabel: 'M-Pesa' },
  { method: 'mpesa', methodLabel: 'M-Pesa' },
  { method: 'mpesa', methodLabel: 'M-Pesa' },
  { method: 'mpesa', methodLabel: 'M-Pesa' },
  { method: 'cash', methodLabel: 'Cash' },
  { method: 'bank', methodLabel: 'Bank Transfer' },
];
const PAY_STATUS: Payment['status'][] = [
  'completed', 'completed', 'completed', 'completed', 'completed',
  'completed', 'completed', 'pending', 'failed',
];
export const PAYMENTS: Payment[] = Array.from({ length: 64 }, (_, i) => {
  const customer = CUSTOMERS[(i * 3) % CUSTOMERS.length];
  const plan = PLANS.find((p) => p.id === customer.planId) ?? HOTSPOT_PLANS[0];
  const m = METHODS[i % METHODS.length];
  const when = hoursAgo(between(1, 24 * 30));
  return {
    id: i + 1,
    customerId: customer.id,
    customerName: customer.name,
    amount: plan.price,
    method: m.method,
    methodLabel: m.methodLabel,
    reference: m.method === 'mpesa' ? mpesaRef() : `RCPT-${2000 + i}`,
    status: PAY_STATUS[i % PAY_STATUS.length],
    date: iso(when),
  };
});
export const TRANSACTIONS: Transaction[] = PAYMENTS.map((p, i) => ({
  ...p,
  type: i % 17 === 0 ? 'refund' : 'payment',
  typeLabel: i % 17 === 0 ? 'Refund' : 'Payment',
}));

/* ---- vouchers -------------------------------------------------------- */
const VOUCHER_STATUS: Voucher['status'][] = ['active', 'active', 'active', 'used', 'expired'];
export const VOUCHERS: Voucher[] = Array.from({ length: 18 }, (_, i) => {
  const plan = HOTSPOT_PLANS[i % HOTSPOT_PLANS.length];
  const status = VOUCHER_STATUS[i % VOUCHER_STATUS.length];
  return {
    id: i + 1,
    code: `INFORA-${String(between(100000, 999999))}`,
    value: plan.price,
    planName: plan.name,
    status,
    usedCount: status === 'used' ? 1 : 0,
    maxUses: 1,
    expiresAt: isoDate(status === 'expired' ? daysAgo(between(1, 20)) : daysAhead(between(5, 60))),
  };
});

/* ---- tickets --------------------------------------------------------- */
const TICKET_SEED: [string, Ticket['priority'], Ticket['status']][] = [
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
export const TICKETS: Ticket[] = TICKET_SEED.map(([subject, priority, status], i) => {
  const customer = CUSTOMERS[(i * 5) % CUSTOMERS.length];
  const created = daysAgo(between(0, 14));
  return {
    id: i + 1,
    subject,
    priority,
    status,
    customerId: customer.id,
    customerName: customer.name,
    assignedTo: pick(['Demo Admin', 'Support Team', 'Field Tech — Ruiru']),
    createdAt: iso(created),
    messages: [
      {
        id: 1,
        sender: customer.name,
        senderType: 'customer',
        message: `Hi, ${subject.toLowerCase()}. Please assist.`,
        createdAt: iso(created),
      },
      {
        id: 2,
        sender: 'Support Team',
        senderType: 'staff',
        message: 'Thanks for reaching out — we are looking into this and will update you shortly.',
        createdAt: iso(new Date(created.getTime() + 3600000)),
      },
    ],
  };
});

/* ---- devices --------------------------------------------------------- */
export const DEVICES: Device[] = ROUTERS.map((name, i) => ({
  id: i + 1,
  name,
  ip: `10.10.${i + 1}.1`,
  model: name.split('-').pop() ?? 'MikroTik',
  status: i === 3 ? 'offline' : 'online',
  clientCount: i === 3 ? 0 : between(24, 210),
  bandwidthUsage: between(120, 900),
  location: AREAS[i * 2] ?? AREAS[i],
  uptime: `${between(3, 40)}d ${between(0, 23)}h`,
  lastSynced: iso(hoursAgo(between(0, 6))),
}));

/* ---- live sessions --------------------------------------------------- */
export const SESSIONS: Session[] = ACTIVE_CUSTOMERS.slice(0, 16).map((c, i) => {
  const start = hoursAgo(between(0, 9));
  return {
    id: i + 1,
    username: c.radiusUsername,
    customerName: c.name,
    connectionType: c.connectionType,
    ipAddress: `100.64.${between(0, 9)}.${between(2, 250)}`,
    macAddress: macAddr(),
    planName: c.servicePlan,
    router: pick(ROUTERS),
    sessionStart: iso(start),
    durationSeconds: Math.floor((NOW.getTime() - start.getTime()) / 1000),
    bytesIn: between(40, 4200) * 1024 * 1024,
    bytesOut: between(10, 900) * 1024 * 1024,
  };
});

/* ---- finance --------------------------------------------------------- */
export const EXPENSES: Expense[] = (
  [
    ['Bandwidth — upstream provider', 'bandwidth', 185000],
    ['Field technician salaries', 'payroll', 96000],
    ['New MikroTik hAP AX3 units (x6)', 'equipment', 54000],
    ['Fuel & transport — installations', 'transport', 18500],
    ['Office rent — Ruiru', 'rent', 35000],
    ['SMS gateway top-up', 'communication', 6500],
    ['Tower lease — Kamakis mast', 'infrastructure', 25000],
    ['Fibre splicing tools', 'equipment', 12800],
  ] as [string, string, number][]
).map(([description, category, amount], i) => ({
  id: i + 1,
  description,
  category,
  amount,
  vendor: pick(['Safaricom', 'Poa Internet Wholesale', 'TP Distributors', 'Local supplier']),
  status: i % 5 === 4 ? 'pending' : 'paid',
  date: isoDate(daysAgo(between(1, 28))),
}));

/* ---- derived stats --------------------------------------------------- */
const totalRevenue = PAYMENTS.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
const totalExpenses = EXPENSES.reduce((s, e) => s + e.amount, 0);
const todayPayments = PAYMENTS.filter(
  (p) => new Date(p.date) > daysAgo(1) && p.status === 'completed',
).reduce((s, p) => s + p.amount, 0);

export const DASHBOARD: DashboardData = {
  summary: {
    totalCustomers: CUSTOMERS.length,
    activeCustomers: ACTIVE_CUSTOMERS.length,
    pppoeCustomers: CUSTOMERS.filter((c) => c.connectionType === 'pppoe').length,
    hotspotCustomers: CUSTOMERS.filter((c) => c.connectionType === 'hotspot').length,
    totalRevenue,
    monthlyPayments: Math.round(totalRevenue * 0.4),
    todayPayments,
    openTickets: TICKETS.filter((t) => t.status === 'open').length,
    onlineDevices: DEVICES.filter((d) => d.status === 'online').length,
    totalDevices: DEVICES.length,
    onlineNow: SESSIONS.length,
  },
  revenuePeriods: {
    today: todayPayments,
    thisWeek: between(60, 90) * 1000,
    thisMonth: Math.round(totalRevenue * 0.4),
    lastMonth: between(280, 420) * 1000,
  },
  revenueByType: {
    pppoe: Math.round(totalRevenue * 0.72),
    hotspot: Math.round(totalRevenue * 0.28),
  },
  // 7-day revenue sparkline (KES)
  revenueTrend: Array.from({ length: 7 }, (_, i) => ({
    label: daysAgo(6 - i).toLocaleDateString('en-KE', { weekday: 'short' }),
    value: between(18, 64) * 1000,
  })),
  finance: {
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    mrr: SUBSCRIPTIONS_REVENUE(),
    arpu: Math.round(totalRevenue / Math.max(1, ACTIVE_CUSTOMERS.length)),
  },
  topDataUsers: [...SESSIONS]
    .map((s) => ({
      username: s.username,
      customerName: s.customerName,
      planName: s.planName,
      totalBytes: s.bytesIn + s.bytesOut,
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, 6),
  alerts: [
    {
      id: 1,
      type: 'warning' as const,
      title: `${ROUTERS[3]} is offline`,
      message: 'Last seen 4 hours ago — site power reported down.',
      at: iso(hoursAgo(4)),
    },
    {
      id: 2,
      type: 'info' as const,
      title: `${TICKETS.filter((t) => t.status === 'open').length} open support tickets`,
      message: 'Two flagged urgent — awaiting first response.',
      at: iso(hoursAgo(2)),
    },
  ],
};

function SUBSCRIPTIONS_REVENUE() {
  return ACTIVE_CUSTOMERS.filter((c) => c.connectionType === 'pppoe').reduce(
    (s, c) => s + c.monthlyFee,
    0,
  );
}

/* ---- lookups --------------------------------------------------------- */
export const findCustomer = (id: number) => CUSTOMERS.find((c) => c.id === id);
export const findPlan = (id: number) => PLANS.find((p) => p.id === id);
export const findTicket = (id: number) => TICKETS.find((t) => t.id === id);
export const paymentsForCustomer = (id: number) => PAYMENTS.filter((p) => p.customerId === id);
export const invoicesForCustomer = (id: number) => INVOICES.filter((i) => i.customerId === id);

export const CURRENT_USER = {
  name: 'Demo Admin',
  email: 'demo@infora.app',
  role: 'Administrator',
  org: 'Infora Networks · Ruiru',
};
