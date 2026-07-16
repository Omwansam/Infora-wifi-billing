/**
 * Demo API router — maps /api/* requests to in-memory handlers.
 *
 * Each handler receives ({ params, query, body, method }) and returns the
 * JSON body the real Flask backend would produce. Unknown endpoints fall
 * through to a graceful empty response so no page ever crashes.
 */
import { DEMO_TOKEN, DEMO_REFRESH_TOKEN, DEMO_USER } from './config';
import { db, staticData, nextId, resetDemoStore } from './store';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function paginate(items, query, key) {
  const page = Math.max(1, parseInt(query.get('page') || '1', 10));
  const perPage = Math.max(1, parseInt(query.get('per_page') || '20', 10));
  const start = (page - 1) * perPage;
  const slice = items.slice(start, start + perPage);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  return {
    [key]: slice,
    total: items.length,
    pages,
    current_page: page,
    per_page: perPage,
    pagination: { page, per_page: perPage, total: items.length, pages },
  };
}

function textSearch(items, q, fields) {
  if (!q) return items;
  const needle = q.toLowerCase();
  return items.filter((item) =>
    fields.some((f) => String(item[f] ?? '').toLowerCase().includes(needle))
  );
}

const ok = (extra = {}) => ({ success: true, ...extra });

/* ------------------------------------------------------------------ */
/* route table                                                         */
/* ------------------------------------------------------------------ */

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });

/* ---------- auth ---------- */

const authPayload = () =>
  ok({
    access_token: DEMO_TOKEN,
    refresh_token: DEMO_REFRESH_TOKEN,
    user: { ...DEMO_USER },
  });

route('POST', /^\/api\/auth\/login$/, () => authPayload());
route('POST', /^\/api\/auth\/register$/, () => authPayload());
route('POST', /^\/api\/auth\/logout$/, () => ok({ message: 'Logged out' }));
route('POST', /^\/api\/auth\/refresh$/, () => ok({ access_token: DEMO_TOKEN }));
route('GET', /^\/api\/auth\/verify$/, () => ok({ user: { ...DEMO_USER } }));
route('GET', /^\/api\/auth\/profile$/, () => ok({ user: { ...DEMO_USER }, ...DEMO_USER }));
route('PUT', /^\/api\/auth\/profile$/, ({ body }) => ok({ user: { ...DEMO_USER, ...body } }));
route('POST', /^\/api\/auth\/change-password$/, () => ok({ message: 'Password updated (demo)' }));
route('GET', /^\/api\/auth\/users$/, ({ query }) => paginate(db.users, query, 'users'));
route('POST', /^\/api\/auth\/users$/, ({ body }) => {
  const user = {
    id: nextId(db.users),
    name: `${body?.first_name || 'New'} ${body?.last_name || 'User'}`,
    status: 'active',
    is_active: true,
    lastLogin: null,
    role: body?.role || 'support',
    ...body,
  };
  db.users.push(user);
  return ok({ user, message: 'User created' });
});

/* ---------- dashboard & health ---------- */

route('GET', /^\/api\/dashboard\/stats$/, () => staticData.DASHBOARD_STATS);
route('GET', /^\/api\/health\/deployment$/, () => ({
  ok: true,
  status: 'healthy',
  services: { database: 'ok', freeradius: 'ok', wireguard: 'ok' },
  message: 'Demo environment — all systems simulated.',
}));
route('GET', /^\/api\/health\/radius-user$/, () => ok({ found: true, message: 'RADIUS user provisioned (demo)' }));
route('GET', /^\/api\/test$/, () => ok({ message: 'Demo API online' }));

/* ---------- customers / clients ---------- */

function customerListResponse(query) {
  let items = [...db.customers];
  const type = query.get('connection_type');
  const status = query.get('status');
  if (type && type !== 'all') items = items.filter((c) => c.connection_type === type);
  if (status && status !== 'all') items = items.filter((c) => c.status === status);
  items = textSearch(items, query.get('search'), ['name', 'email', 'phone', 'radius_username']);
  return paginate(items, query, 'customers');
}

route('GET', /^\/api\/customers\/stats$/, () => staticData.CUSTOMER_STATS);
route('GET', /^\/api\/customers\/sessions\/active$/, ({ query }) => {
  let items = [...db.sessions];
  const type = query.get('connection_type');
  if (type && type !== 'all') items = items.filter((s) => s.connection_type === type);
  items = textSearch(items, query.get('search'), ['username', 'customer_name', 'ip_address']);
  return { sessions: items, total: items.length };
});
route('GET', /^\/api\/customers\/(\d+)\/invoices$/, ({ params, query }) =>
  paginate(db.invoices.filter((i) => i.customer_id === Number(params[0])), query, 'invoices'));
route('GET', /^\/api\/customers\/(\d+)\/payments$/, ({ params, query }) =>
  paginate(db.payments.filter((p) => p.customer_id === Number(params[0])), query, 'payments'));
route('GET', /^\/api\/customers\/(\d+)\/tickets$/, ({ params, query }) =>
  paginate(db.tickets.filter((t) => t.customer_id === Number(params[0])), query, 'tickets'));
route('POST', /^\/api\/customers\/(\d+)\/(connect|disconnect)$/, ({ params }) => {
  const customer = db.customers.find((c) => c.id === Number(params[0]));
  if (customer) customer.status = params[1] === 'connect' ? 'active' : 'suspended';
  return ok({ message: `Client ${params[1]}ed (demo)`, customer });
});
route('PUT', /^\/api\/customers\/(\d+)\/status$/, ({ params, body }) => {
  const customer = db.customers.find((c) => c.id === Number(params[0]));
  if (customer && body?.status) customer.status = body.status;
  return ok({ message: 'Status updated (demo)', customer });
});
route('PUT', /^\/api\/customers\/(\d+)\/balance$/, ({ params, body }) => {
  const customer = db.customers.find((c) => c.id === Number(params[0]));
  if (customer && body) customer.balance = Number(body.balance) || 0;
  return ok({ message: 'Balance updated (demo)', customer });
});
route('GET', /^\/api\/customers\/(\d+)$/, ({ params }) => {
  const customer = db.customers.find((c) => c.id === Number(params[0]));
  return customer || { error: 'Customer not found' };
});
route('PUT', /^\/api\/customers\/(\d+)$/, ({ params, body }) => {
  const customer = db.customers.find((c) => c.id === Number(params[0]));
  if (customer && body) Object.assign(customer, body);
  return ok({ message: 'Customer updated (demo)', customer });
});
route('DELETE', /^\/api\/customers\/(\d+)$/, ({ params }) => {
  const idx = db.customers.findIndex((c) => c.id === Number(params[0]));
  if (idx >= 0) db.customers.splice(idx, 1);
  return ok({ message: 'Customer deleted (demo)' });
});
route('GET', /^\/api\/customers$/, ({ query }) => customerListResponse(query));
route('POST', /^\/api\/customers$/, ({ body }) => {
  const plan = db.plans.find((p) => p.id === Number(body?.plan_id)) || db.plans[5];
  const customer = {
    id: nextId(db.customers),
    status: 'active',
    balance: 0,
    connection_type: body?.connection_type || 'pppoe',
    kyc_status: 'pending',
    join_date: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    usage_percentage: 0,
    device_count: 1,
    service_plan: plan?.name,
    package: plan ? `${plan.name} (${plan.speed})` : undefined,
    ...body,
    name: body?.name || `${body?.first_name || ''} ${body?.last_name || ''}`.trim(),
  };
  if (!customer.radius_username) {
    customer.radius_username = (customer.name || `user${customer.id}`)
      .toLowerCase()
      .replace(/\s+/g, '.');
  }
  db.customers.unshift(customer);
  return ok({ message: 'Customer created (demo)', customer });
});
route('POST', /^\/api\/billing\/customers\/(\d+)\/(suspend|activate)$/, ({ params }) => {
  const customer = db.customers.find((c) => c.id === Number(params[0]));
  if (customer) customer.status = params[1] === 'activate' ? 'active' : 'suspended';
  return ok({ message: `Customer ${params[1]}d (demo)`, customer });
});
route('GET', /^\/api\/billing\/customers/, ({ query }) => customerListResponse(query));
route('GET', /^\/api\/billing\/radius\/status$/, () => ok({
  radius_reachable: true,
  server: 'freeradius (simulated)',
  message: 'RADIUS reachable — demo environment',
}));

/* ---------- plans ---------- */

route('GET', /^\/api\/plans\/stats$/, () => staticData.PLAN_STATS);
route('GET', /^\/api\/plans\/active$/, ({ query }) => {
  let items = db.plans.filter((p) => p.is_active);
  const type = query.get('plan_type');
  if (type) items = items.filter((p) => p.plan_type === type);
  return { plans: items };
});
route('GET', /^\/api\/plans\/popular$/, () => ({ plans: db.plans.filter((p) => p.popular) }));
route('GET', /^\/api\/plans\/(\d+)\/customers$/, ({ params, query }) =>
  paginate(db.customers.filter((c) => c.plan_id === Number(params[0])), query, 'customers'));
route('PUT', /^\/api\/plans\/(\d+)\/toggle-active$/, ({ params }) => {
  const plan = db.plans.find((p) => p.id === Number(params[0]));
  if (plan) plan.is_active = !plan.is_active;
  return ok({ plan, message: 'Plan updated (demo)' });
});
route('PUT', /^\/api\/plans\/(\d+)\/toggle-popular$/, ({ params }) => {
  const plan = db.plans.find((p) => p.id === Number(params[0]));
  if (plan) plan.popular = !plan.popular;
  return ok({ plan, message: 'Plan updated (demo)' });
});
route('GET', /^\/api\/plans\/(\d+)$/, ({ params }) => {
  const plan = db.plans.find((p) => p.id === Number(params[0]));
  return plan ? { plan, ...plan } : { error: 'Plan not found' };
});
route('PUT', /^\/api\/plans\/(\d+)$/, ({ params, body }) => {
  const plan = db.plans.find((p) => p.id === Number(params[0]));
  if (plan && body) Object.assign(plan, body, { updated_at: new Date().toISOString() });
  return ok({ plan, message: 'Plan updated (demo)' });
});
route('DELETE', /^\/api\/plans\/(\d+)$/, ({ params }) => {
  const idx = db.plans.findIndex((p) => p.id === Number(params[0]));
  if (idx >= 0) db.plans.splice(idx, 1);
  return ok({ message: 'Plan deleted (demo)' });
});
route('GET', /^\/api\/plans$/, ({ query }) => {
  let items = [...db.plans];
  const type = query.get('plan_type');
  if (type && type !== 'all') items = items.filter((p) => p.plan_type === type);
  items = textSearch(items, query.get('search'), ['name', 'description', 'speed']);
  return paginate(items, query, 'plans');
});
route('POST', /^\/api\/plans$/, ({ body }) => {
  const plan = {
    id: nextId(db.plans),
    is_active: true,
    popular: false,
    currency: 'KES',
    customer_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...body,
  };
  db.plans.unshift(plan);
  return ok({ plan, message: 'Plan created (demo)' });
});

/* ---------- invoices ---------- */

route('GET', /^\/api\/invoices\/stats$/, () => staticData.INVOICE_STATS);
route('GET', /^\/api\/invoices\/(\d+)$/, ({ params }) => {
  const invoice = db.invoices.find((i) => i.id === Number(params[0]));
  return invoice ? { invoice, ...invoice } : { error: 'Invoice not found' };
});
route('PUT', /^\/api\/invoices\/(\d+)$/, ({ params, body }) => {
  const invoice = db.invoices.find((i) => i.id === Number(params[0]));
  if (invoice && body) Object.assign(invoice, body);
  return ok({ invoice, message: 'Invoice updated (demo)' });
});
route('DELETE', /^\/api\/invoices\/(\d+)$/, ({ params }) => {
  const idx = db.invoices.findIndex((i) => i.id === Number(params[0]));
  if (idx >= 0) db.invoices.splice(idx, 1);
  return ok({ message: 'Invoice deleted (demo)' });
});
route('GET', /^\/api\/invoices$/, ({ query }) => {
  let items = [...db.invoices];
  const status = query.get('status');
  if (status && status !== 'all') items = items.filter((i) => i.status === status);
  items = textSearch(items, query.get('search'), ['customerName', 'invoice_id']);
  return paginate(items, query, 'invoices');
});
route('POST', /^\/api\/invoices$/, ({ body }) => {
  const id = nextId(db.invoices);
  const customer = db.customers.find((c) => c.id === Number(body?.customer_id));
  const amount = Number(body?.amount) ||
    (body?.items || []).reduce((s, it) => s + (Number(it.total) || Number(it.unit_price) * (Number(it.quantity) || 1) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const invoice = {
    id,
    invoice_id: `INV-2026-${1000 + id}`,
    status: 'pending',
    customerName: customer?.name || body?.customerName || 'Walk-in customer',
    customer_name: customer?.name,
    issueDate: today,
    issue_date: today,
    dueDate: body?.due_date || today,
    due_date: body?.due_date || today,
    items: body?.items || [],
    amount,
    total: amount,
    ...body,
  };
  db.invoices.unshift(invoice);
  return ok({ invoice, message: 'Invoice created (demo)' });
});

/* ---------- billing: payments / transactions / subscriptions / vouchers ---------- */

route('GET', /^\/api\/billing\/payments$/, ({ query }) => {
  let items = [...db.payments];
  const status = query.get('status');
  if (status && status !== 'all') items = items.filter((p) => p.status === status);
  return { ...paginate(items, query, 'payments') };
});
route('POST', /^\/api\/billing\/payments$/, ({ body }) => {
  const customer = db.customers.find((c) => c.id === Number(body?.customer_id));
  const payment = {
    id: nextId(db.payments),
    status: 'completed',
    method: body?.method || 'mpesa',
    methodLabel: body?.method === 'cash' ? 'Cash' : body?.method === 'bank' ? 'Bank Transfer' : 'M-Pesa',
    reference: body?.reference || `DEMO${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    customerName: customer?.name || body?.customerName || 'Walk-in customer',
    ...body,
    amount: Number(body?.amount) || 0,
  };
  db.payments.unshift(payment);
  db.transactions.unshift({ ...payment, type: 'payment', typeLabel: 'Payment', value: payment.amount });
  return ok({ payment, message: 'Payment recorded (demo)' });
});
route('GET', /^\/api\/billing\/transactions$/, ({ query }) => paginate(db.transactions, query, 'transactions'));
route('GET', /^\/api\/billing\/subscriptions$/, ({ query }) => ({
  ...paginate(db.subscriptions, query, 'subscriptions'),
  stats: staticData.SUBSCRIPTION_STATS,
}));
route('GET', /^\/api\/billing\/vouchers$/, ({ query }) => paginate(db.vouchers, query, 'vouchers'));
route('POST', /^\/api\/billing\/vouchers$/, ({ body }) => {
  const count = Math.min(50, Number(body?.count) || 1);
  const created = Array.from({ length: count }, (_, i) => ({
    id: nextId(db.vouchers) + i,
    code: `LUMEN-${Math.floor(100000 + Math.random() * 900000)}`,
    type: body?.type || 'time',
    value: Number(body?.value) || 50,
    status: 'active',
    usedCount: 0,
    maxUses: Number(body?.maxUses) || 1,
    expiresAt: body?.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
  }));
  db.vouchers.unshift(...created);
  return ok({ vouchers: created, message: `${count} voucher(s) generated (demo)` });
});
route('GET', /^\/api\/billing\/reports$/, () => ({ ...staticData.FINANCE_SUMMARY, reports: [] }));

/* ---------- tickets ---------- */

route('GET', /^\/api\/tickets\/(\d+)$/, ({ params }) => {
  const ticket = db.tickets.find((t) => t.id === Number(params[0]));
  return ticket ? { ticket, ...ticket } : { error: 'Ticket not found' };
});
route('PUT', /^\/api\/tickets\/(\d+)$/, ({ params, body }) => {
  const ticket = db.tickets.find((t) => t.id === Number(params[0]));
  if (ticket && body) Object.assign(ticket, body);
  return ok({ ticket, message: 'Ticket updated (demo)' });
});
route('POST', /^\/api\/tickets\/(\d+)\/messages$/, ({ params, body }) => {
  const ticket = db.tickets.find((t) => t.id === Number(params[0]));
  if (ticket) {
    ticket.messages = ticket.messages || [];
    ticket.messages.push({
      id: ticket.messages.length + 1,
      sender: 'Demo Admin',
      sender_type: 'staff',
      message: body?.message || '',
      created_at: new Date().toISOString(),
    });
  }
  return ok({ ticket, message: 'Reply sent (demo)' });
});
route('GET', /^\/api\/tickets$/, ({ query }) => {
  let items = [...db.tickets];
  const status = query.get('status');
  if (status && status !== 'all') items = items.filter((t) => t.status === status);
  items = textSearch(items, query.get('search'), ['subject', 'customerName']);
  return paginate(items, query, 'tickets');
});
route('POST', /^\/api\/tickets$/, ({ body }) => {
  const ticket = {
    id: nextId(db.tickets),
    status: 'open',
    priority: body?.priority || 'medium',
    assignedTo: 'Support Team',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    messages: [],
    ...body,
  };
  db.tickets.unshift(ticket);
  return ok({ ticket, message: 'Ticket created (demo)' });
});

/* ---------- devices ---------- */

route('GET', /^\/api\/devices\/stats$/, () => staticData.DEVICE_STATS);
route('GET', /^\/api\/devices\/(\d+)\/radius-script$/, ({ params }) => ({
  __text: `# Lumen demo — MikroTik RADIUS provisioning for device ${params[0]}\n/radius add service=ppp,hotspot address=10.99.0.1 secret=demo-secret timeout=3s\n/ppp aaa set use-radius=yes\n/ip hotspot profile set [find] use-radius=yes\n`,
}));
route('GET', /^\/api\/devices\/(\d+)\/management-tunnel-script$/, ({ params }) => ({
  __text: `# Lumen demo — WireGuard management tunnel for device ${params[0]}\n/interface wireguard add name=wg-mgmt listen-port=51820\n# (demo output — keys are generated on the live system)\n`,
}));
route('POST', /^\/api\/devices\/(connect|disconnect|sync|backup|restore|reboot|update)$/, ({ params }) =>
  ok({ message: `Device ${params[0]} completed (demo)` }));
route('GET', /^\/api\/devices\/(\d+)$/, ({ params }) => {
  const device = db.devices.find((d) => d.id === Number(params[0]));
  return device ? { device, ...device } : { error: 'Device not found' };
});
route('PUT', /^\/api\/devices\/(\d+)$/, ({ params, body }) => {
  const device = db.devices.find((d) => d.id === Number(params[0]));
  if (device && body) Object.assign(device, body);
  return ok({ device, message: 'Device updated (demo)' });
});
route('DELETE', /^\/api\/devices\/(\d+)$/, ({ params }) => {
  const idx = db.devices.findIndex((d) => d.id === Number(params[0]));
  if (idx >= 0) db.devices.splice(idx, 1);
  return ok({ message: 'Device removed (demo)' });
});
route('GET', /^\/api\/devices$/, ({ query }) => paginate(db.devices, query, 'devices'));
route('POST', /^\/api\/devices$/, ({ body }) => {
  const device = {
    id: nextId(db.devices),
    device_status: 'online',
    client_count: 0,
    bandwidth_usage: 0,
    is_active: true,
    management_wg_enabled: false,
    isp_name: 'Lumen Demo ISP',
    last_synced: new Date().toISOString(),
    ...body,
  };
  db.devices.unshift(device);
  return ok({ device, message: 'Device added (demo)' });
});

/* ---------- device onboarding wizard (simulated provisioning) ---------- */
/* The demo walks the full WaveCore-style flow: one-shot command → script
   fetch → WireGuard tunnel → reachable → self-check, then port discovery.
   Progress is driven by elapsed time since the provision token was minted. */

const PHYSICAL_KINDS = ['ether', 'sfp', 'wlan'];
const provisionClock = new Map(); // deviceId -> epoch ms of token mint
const demoPorts = new Map(); // deviceId -> interfaces (persists toggles)
const demoTraffic = new Map(); // deviceId -> byte counters per interface

const SELF_CHECK_ITEMS = [
  ['wg_interface', 'wg-mgmt interface exists'],
  ['wg_peer', 'Billing server WireGuard peer exists'],
  ['wg_address', 'Tunnel VPN address exists'],
  ['wg_route', 'Route to billing server via tunnel exists'],
  ['radius_client', 'RADIUS client entry exists'],
  ['radius_incoming', 'RADIUS incoming (CoA/disconnect) accepted'],
  ['ppp_aaa', 'PPPoE AAA uses RADIUS'],
  ['fasttrack_absent', 'FastTrack removed (accounting integrity)'],
  ['mgmt_firewall', 'Winbox/API/SSH firewall rule exists (tunnel only)'],
  ['nat_masquerade', 'NAT masquerade rule exists'],
  ['snmp', 'SNMP monitoring enabled'],
  ['mgmt_user', 'Billing management user exists'],
  ['api_service', 'API service enabled on port 8728'],
  ['ssh_service', 'SSH service enabled'],
  ['wg_watchdog', 'WireGuard watchdog (netwatch) exists'],
];

const demoSelfCheck = () => ({
  passed: SELF_CHECK_ITEMS.length,
  total: SELF_CHECK_ITEMS.length,
  ok: true,
  checks: SELF_CHECK_ITEMS.map(([id, label]) => ({ id, label, ok: true, detail: '' })),
  at: new Date().toISOString(),
});

function demoInterfaces(deviceId) {
  if (!demoPorts.has(deviceId)) {
    const octet = String(deviceId % 100).padStart(2, '0');
    const ifaces = [];
    for (let i = 1; i <= 16; i += 1) {
      ifaces.push({
        name: `ether${i}`,
        type: 'ether',
        kind: 'ether',
        running: i <= 6,
        disabled: false,
        mac: `DC:2C:6E:${octet}:00:${String(i).padStart(2, '0')}`,
        mtu: '1500',
        speed: '1Gbps',
        comment: i === 1 ? 'WAN uplink' : null,
        is_uplink: i === 1,
      });
    }
    ifaces.push({
      name: 'sfp-sfpplus1', type: 'ether', kind: 'sfp', running: true, disabled: false,
      mac: `DC:2C:6E:${octet}:00:11`, mtu: '1500', speed: '10Gbps', comment: 'fibre backhaul', is_uplink: false,
    });
    ifaces.push({
      name: 'sfp-sfpplus2', type: 'ether', kind: 'sfp', running: false, disabled: false,
      mac: `DC:2C:6E:${octet}:00:12`, mtu: '1500', speed: '10Gbps', comment: null, is_uplink: false,
    });
    ifaces.push({
      name: 'infora-bridge', type: 'bridge', kind: 'bridge', running: true, disabled: false,
      mac: null, mtu: '1500', speed: null, comment: 'infora-billing', is_uplink: false,
    });
    ifaces.push({
      name: 'wg-mgmt', type: 'wg', kind: 'wg', running: true, disabled: false,
      mac: null, mtu: '1420', speed: null, comment: 'infora-mgmt-tunnel', is_uplink: false,
    });
    demoPorts.set(deviceId, ifaces);
  }
  return demoPorts.get(deviceId);
}

route('POST', /^\/api\/devices\/(\d+)\/provision-token$/, ({ params }) => {
  const id = Number(params[0]);
  provisionClock.set(id, Date.now());
  return ok({
    one_liner:
      `/tool fetch url="https://demo.lumen.app/api/provision/demo-${id}-a1b2c3d4e5f6/script" ` +
      'dst-path=flash/provision.rsc; :delay 3s; /import flash/provision.rsc; :delay 2s; ' +
      ':do { /file remove [find name~"provision.rsc"] } on-error={}',
    expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
  });
});
route('DELETE', /^\/api\/devices\/(\d+)\/provision-token$/, () =>
  ok({ message: 'Provision token revoked (demo)' }));

route('GET', /^\/api\/devices\/(\d+)\/provision-status$/, ({ params }) => {
  const id = Number(params[0]);
  if (!provisionClock.has(id)) provisionClock.set(id, Date.now());
  const elapsed = (Date.now() - provisionClock.get(id)) / 1000;
  const fetched = elapsed > 5;
  const tunnelUp = elapsed > 11;
  const reachable = elapsed > 16;
  const checked = elapsed > 21;
  const host = `10.250.0.${(id % 200) + 2}`;
  const selfCheck = checked
    ? { done: true, ...demoSelfCheck() }
    : { done: false, ok: false, passed: 0, total: 0, checks: [], at: null };
  return {
    fetched,
    fetch_count: fetched ? 1 : 0,
    last_fetched_at: fetched ? new Date().toISOString() : null,
    reachable,
    online: reachable,
    host,
    management_wg_ip: host,
    detected: reachable ? { model: 'CCR2004-16G-2S+', version: '7.20.7' } : {},
    error: null,
    stages: {
      command_generated: true,
      script_fetched: {
        done: fetched,
        count: fetched ? 1 : 0,
        at: fetched ? new Date().toISOString() : null,
      },
      tunnel_up: {
        done: tunnelUp,
        applicable: true,
        detail: tunnelUp
          ? `Reply from ${host} in 12 ms (tcp/8291)`
          : `No reply from ${host} yet`,
      },
      reachable: {
        done: reachable,
        detail: reachable ? `Connected to ${host} via SSH` : 'Not reachable yet',
      },
      self_check: selfCheck,
    },
    complete: checked,
  };
});

route('POST', /^\/api\/devices\/(\d+)\/self-check$/, () => demoSelfCheck());

route('GET', /^\/api\/devices\/(\d+)\/interfaces\/traffic$/, ({ params }) => {
  const id = Number(params[0]);
  const ifaces = demoInterfaces(id);
  let counters = demoTraffic.get(id);
  if (!counters) {
    counters = {};
    demoTraffic.set(id, counters);
  }
  const stats = ifaces.map((iface, idx) => {
    const c = counters[iface.name] || {
      rx: 1e9 + idx * 3.7e8,
      tx: 4e8 + idx * 1.3e8,
    };
    if (iface.running && !iface.disabled) {
      // bytes accrued since the last poll (~5s) — uplink busier than access ports
      const base = iface.is_uplink || iface.kind === 'sfp' ? 4e6 : ((idx % 5) + 1) * 3e5;
      c.rx += Math.round(base * (0.6 + Math.random() * 0.8));
      c.tx += Math.round(base * 0.35 * (0.6 + Math.random() * 0.8));
    }
    counters[iface.name] = c;
    return { name: iface.name, rx_bytes: c.rx, tx_bytes: c.tx, rx_packets: 0, tx_packets: 0 };
  });
  return { at: Date.now() / 1000, stats };
});

route('GET', /^\/api\/devices\/(\d+)\/interfaces$/, ({ params }) => {
  const id = Number(params[0]);
  const interfaces = demoInterfaces(id);
  const physical = interfaces.filter((i) => PHYSICAL_KINDS.includes(i.kind));
  const device = db.devices.find((d) => d.id === id);
  return {
    interfaces,
    device: {
      model: 'CCR2004-16G-2S+',
      version: '7.20.7',
      architecture: 'arm64',
      uptime: '12d 4h',
      cpu_load: '4',
      ports: physical.length,
    },
    counts: {
      total: interfaces.length,
      physical: physical.length,
      ethernet: interfaces.filter((i) => i.kind === 'ether').length,
      sfp: interfaces.filter((i) => i.kind === 'sfp').length,
      wireless: interfaces.filter((i) => i.kind === 'wlan').length,
      active: physical.filter((i) => i.running && !i.disabled).length,
    },
    monitored: device?.monitored_interfaces || [],
  };
});

route('PUT', /^\/api\/devices\/(\d+)\/interfaces\/monitor$/, ({ params, body }) => {
  const device = db.devices.find((d) => d.id === Number(params[0]));
  const names = Array.isArray(body?.interfaces) ? body.interfaces : [];
  if (device) device.monitored_interfaces = names;
  return ok({ monitored: names });
});

route('POST', /^\/api\/devices\/(\d+)\/interfaces\/([^/]+)\/toggle$/, ({ params, body }) => {
  const ifaces = demoInterfaces(Number(params[0]));
  const iface = ifaces.find((i) => i.name === decodeURIComponent(params[1])) || ifaces[0];
  // The UI guards the uplink client-side; the demo never disables it either.
  if (!(iface.is_uplink && body?.disabled)) {
    iface.disabled = Boolean(body?.disabled);
  }
  return ok({ interface: { ...iface } });
});

route('POST', /^\/api\/devices\/(\d+)\/configure-services$/, ({ body }) => {
  const services = [body?.pppoe && 'PPPoE', body?.hotspot && 'Hotspot'].filter(Boolean);
  const ports = body?.bridge_ports || [];
  const log = [
    { step: 'queued', status: 'ok', detail: 'Starting device configuration...' },
    { step: 'connect', status: 'ok', detail: 'Connecting via SSH...' },
    { step: 'bridge', status: 'ok', detail: 'bridge configured' },
    ...ports.map((p) => ({ step: `bridge-port:${p}`, status: 'ok', detail: `bridge-port:${p} configured` })),
    { step: 'address', status: 'ok', detail: 'address configured' },
    { step: 'pool', status: 'ok', detail: 'pool configured' },
    { step: 'dhcp', status: 'ok', detail: 'dhcp configured' },
    ...(body?.pppoe ? [{ step: 'pppoe', status: 'ok', detail: 'pppoe configured' }] : []),
    ...(body?.hotspot ? [{ step: 'hotspot', status: 'ok', detail: 'hotspot configured' }] : []),
    { step: 'done', status: 'ok', detail: 'Configuration complete.' },
  ];
  return {
    success: true,
    log,
    summary: {
      services,
      ports,
      subnet: body?.subnet || '172.31.0.0/16',
      gateway: '172.31.0.1',
      anti_sharing: Boolean(body?.hotspot && body?.anti_sharing),
    },
  };
});

/* ---------- ISPs ---------- */

route('GET', /^\/api\/isps\/stats$/, () => ({
  total_isps: db.isps.length,
  active_isps: db.isps.length,
  total_customers: db.customers.length,
  total_devices: db.devices.length,
}));
route('GET', /^\/api\/isps$/, ({ query }) => paginate(db.isps, query, 'isps'));

/* ---------- finance ---------- */

route('GET', /^\/api\/finance\/leads$/, ({ query }) => paginate(db.leads, query, 'leads'));
route('POST', /^\/api\/finance\/leads$/, ({ body }) => {
  const lead = { id: nextId(db.leads), status: 'new', created_at: new Date().toISOString(), ...body };
  db.leads.unshift(lead);
  return ok({ lead, message: 'Lead added (demo)' });
});
route('GET', /^\/api\/finance\/expenses$/, ({ query }) => paginate(db.expenses, query, 'expenses'));
route('POST', /^\/api\/finance\/expenses$/, ({ body }) => {
  const expense = {
    id: nextId(db.expenses),
    status: 'paid',
    date: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    ...body,
    amount: Number(body?.amount) || 0,
  };
  db.expenses.unshift(expense);
  return ok({ expense, message: 'Expense recorded (demo)' });
});
route('GET', /^\/api\/finance\/summary$/, () => staticData.FINANCE_SUMMARY);

/* ---------- KYC ---------- */

route('GET', /^\/api\/kyc\/stats$/, () => staticData.KYC_STATS);
route('GET', /^\/api\/kyc$/, ({ query }) => paginate(db.kycRecords, query, 'records'));
route('PUT', /^\/api\/kyc\/(\d+)/, ({ params, body, path }) => {
  const record = db.kycRecords.find((r) => r.id === Number(params[0]));
  if (record) {
    if (path.endsWith('/verify')) record.status = 'verified';
    else if (path.endsWith('/reject')) record.status = 'rejected';
    else if (body) Object.assign(record, body);
    record.verified_at = record.status === 'verified' ? new Date().toISOString() : record.verified_at;
  }
  return ok({ record, message: 'KYC updated (demo)' });
});
route('POST', /^\/api\/kyc\/(\d+)/, ({ params, path }) => {
  const record = db.kycRecords.find((r) => r.id === Number(params[0]));
  if (record) {
    if (path.includes('verify') || path.includes('approve')) record.status = 'verified';
    if (path.includes('reject')) record.status = 'rejected';
  }
  return ok({ record, message: 'KYC updated (demo)' });
});

/* ---------- monitoring / FUP ---------- */

route('GET', /^\/api\/monitoring\/fup$/, () => ({
  customers: db.customers
    .filter((c) => c.usage_percentage > 70)
    .map((c) => ({
      id: c.id,
      customer_id: c.id,
      customer_name: c.name,
      username: c.radius_username,
      plan_name: c.service_plan,
      usage_percentage: c.usage_percentage,
      data_used_gb: Math.round(c.usage_percentage * 2.4),
      data_limit_gb: 240,
      status: c.usage_percentage > 90 ? 'throttled' : 'warning',
    })),
  records: [],
  items: [],
}));

/* ---------- RADIUS / LDAP / SNMP / VPN / WireGuard / EAP ---------- */

route('GET', /^\/api\/radius\/users$/, ({ query }) =>
  paginate(db.customers.map((c) => ({
    id: c.id,
    username: c.radius_username,
    customer_name: c.name,
    groupname: c.connection_type,
    plan_name: c.service_plan,
    status: c.status,
  })), query, 'users'));
route('GET', /^\/api\/radius\/clients$/, () => ({
  clients: db.devices.map((d) => ({
    id: d.id,
    name: d.device_name,
    nasname: d.device_ip,
    shortname: d.device_name,
    type: 'mikrotik',
    status: d.device_status,
  })),
}));
route('GET', /^\/api\/radius\/groups$/, () => ({
  groups: [
    { id: 1, groupname: 'pppoe', users: staticData.CUSTOMER_STATS.pppoe_clients },
    { id: 2, groupname: 'hotspot', users: staticData.CUSTOMER_STATS.hotspot_clients },
  ],
}));
route('GET', /^\/api\/radius\/accounting$/, ({ query }) => paginate(db.sessions, query, 'sessions'));
route('POST', /^\/api\/radius\/test$/, () => ok({ message: 'RADIUS test OK (demo)', reachable: true }));
route('GET', /^\/api\/ldap\/servers$/, () => ({
  servers: [{
    id: 1, name: 'Demo OpenLDAP', host: 'openldap', port: 389,
    base_dn: 'dc=company,dc=com', status: 'connected', users_synced: db.users.length,
  }],
}));
route('GET', /^\/api\/snmp\/devices$/, () => ({
  devices: db.devices.map((d) => ({
    id: d.id, name: d.device_name, host: d.device_ip, community: 'public',
    version: 'v2c', status: d.device_status, uptime: d.uptime,
  })),
}));
route('GET', /^\/api\/vpn\/(configs|clients|status)$/, ({ params }) => ({
  [params[0] === 'status' ? 'status' : params[0]]: params[0] === 'status' ? 'up' : [],
  configs: [], clients: [], message: 'Demo environment — VPN simulated',
}));
route('GET', /^\/api\/wireguard\/servers$/, () => ({
  servers: [{
    id: 1, name: 'wg-mgmt', interface: 'wg0', listen_port: 51820,
    address: '10.99.0.1/24', peers: 3, status: 'up',
  }],
}));
route('GET', /^\/api\/wireguard\/servers\/(\d+)\/peers$/, () => ({
  peers: db.devices.filter((d) => d.management_wg_enabled).map((d, i) => ({
    id: i + 1, name: d.device_name, allowed_ips: `${d.management_wg_ip}/32`,
    endpoint: `${d.device_ip}:51820`, latest_handshake: new Date().toISOString(), status: 'connected',
  })),
}));
route('GET', /^\/api\/eap\/profiles$/, () => ({ profiles: [] }));

/* ---------- payments: M-Pesa ---------- */

route('POST', /^\/api\/payments\/mpesa\/stk-push$/, () => ok({
  data: {
    CheckoutRequestID: `ws_CO_DEMO_${Date.now()}`,
    MerchantRequestID: `demo-${Date.now()}`,
    ResponseDescription: 'Success. STK push simulated (demo).',
  },
  message: 'STK push sent (demo — no real charge)',
}));
route('GET', /^\/api\/payments\/mpesa\/status/, () => ok({
  data: { status: 'completed', ResultCode: 0, ResultDesc: 'The service request is processed successfully. (demo)' },
}));

/* ---------- captive portal (public) ---------- */

route('GET', /^\/api\/portal\/config$/, () => staticData.PORTAL_CONFIG);
route('GET', /^\/api\/portal\/plans$/, ({ query }) => {
  let items = db.plans.filter((p) => p.is_active);
  const type = query.get('plan_type') || query.get('type');
  if (type) items = items.filter((p) => p.plan_type === type);
  return { plans: items };
});
route('POST', /^\/api\/portal\/hotspot\/purchase$/, () => ok({
  message: 'Payment simulated — you are now connected! (demo)',
  data: { status: 'completed', credentials: { username: 'demo-guest', password: 'wifi1234' } },
  credentials: { username: 'demo-guest', password: 'wifi1234' },
}));
route('POST', /^\/api\/portal\/pppoe\/lookup$/, () => {
  const customer = db.customers.find((c) => c.connection_type === 'pppoe' && c.status === 'active');
  return ok({ customer, account: customer });
});
route('POST', /^\/api\/portal\/pppoe\/pay$/, () => ok({
  message: 'STK push simulated — account renewed (demo)',
  data: { status: 'completed' },
}));
route('GET', /^\/api\/portal\/payment\/status/, () => ok({ data: { status: 'completed' }, status: 'completed' }));

/* ---------- website endpoints (shared with marketing site) ---------- */

route('POST', /^\/api\/website\/(contact|trial-signup|affiliate|login)$/, () =>
  ok({ message: 'Received (demo) — thank you!' }));

/* ------------------------------------------------------------------ */
/* dispatch                                                            */
/* ------------------------------------------------------------------ */

const FALLBACK = () => ({
  success: true,
  message: 'Demo mode — endpoint simulated',
  data: [],
  items: [],
  results: [],
  records: [],
  total: 0,
  pages: 1,
  pagination: { page: 1, per_page: 20, total: 0, pages: 1 },
});

export { resetDemoStore };

export function dispatchDemoRequest(method, path, query, body) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const match = path.match(r.pattern);
    if (match) {
      return r.handler({ params: match.slice(1), query, body, method, path });
    }
  }
  // Mutations we don't model still succeed so the UI flows keep working.
  if (method !== 'GET') return ok({ message: 'Saved (demo mode — resets on reload)' });
  return FALLBACK();
}
