/**
 * DTO → domain mappers. The Infora API returns snake_case payloads; the UI is
 * built against the camelCase domain types in src/data/types.ts. Mapping here
 * means screens never change when the data source swaps from mock to live.
 */
import type {
  Customer,
  Device,
  Expense,
  Invoice,
  Payment,
  Plan,
  Session,
  Ticket,
  TicketMessage,
  Transaction,
  Voucher,
} from '@/data/types';
import type { AuthUser } from './session';

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' ? v : v != null && !Number.isNaN(Number(v)) ? Number(v) : fallback;
const str = (v: unknown, fallback = ''): string => (v == null ? fallback : String(v));
const speedToMbps = (speed?: string | null) => (speed ? parseInt(speed, 10) || 0 : 0);

/* ---- auth ------------------------------------------------------------ */
export interface UserDTO {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  is_admin?: boolean;
}
export function mapUser(d: UserDTO): AuthUser {
  const first = str(d.first_name);
  const last = str(d.last_name);
  return {
    id: d.id,
    email: str(d.email),
    firstName: first,
    lastName: last,
    name: `${first} ${last}`.trim() || str(d.email),
    role: str(d.role, 'user'),
    isAdmin: Boolean(d.is_admin) || d.role === 'admin',
  };
}

/* ---- customers ------------------------------------------------------- */
export interface CustomerDTO {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: string;
  connection_type?: string;
  balance?: number;
  package?: string;
  usage_percentage?: number;
  device_count?: number;
  last_payment_date?: string | null;
  join_date?: string | null;
  service_plan_id?: number;
  id_number?: string;
  kyc_status?: string;
  subscription_end?: string | null;
  radius_username?: string | null;
  router_name?: string | null;
  online?: boolean;
  service_plan?: { id: number; name: string; speed?: string; price?: number } | null;
}
export function mapCustomer(d: CustomerDTO): Customer {
  const name = str(d.name);
  const [firstName, ...rest] = name.split(' ');
  const plan = d.service_plan ?? null;
  return {
    id: d.id,
    firstName: firstName ?? '',
    lastName: rest.join(' '),
    name,
    email: str(d.email),
    phone: str(d.phone),
    address: str(d.address),
    connectionType: (d.connection_type as Customer['connectionType']) ?? 'pppoe',
    status: (d.status as Customer['status']) ?? 'active',
    planId: num(d.service_plan_id ?? plan?.id),
    servicePlan: str(plan?.name, d.package ?? ''),
    package: str(d.package, plan ? `${plan.name} (${plan.speed ?? ''})` : ''),
    monthlyFee: num(plan?.price),
    balance: num(d.balance),
    joinDate: str(d.join_date),
    radiusUsername: str(d.radius_username ?? (d.email ? d.email.split('@')[0] : '')),
    idNumber: str(d.id_number),
    kycStatus: (d.kyc_status as Customer['kycStatus']) ?? 'pending',
    subscriptionEnd: str(d.subscription_end),
    usagePercentage: num(d.usage_percentage),
    deviceCount: num(d.device_count),
    lastPaymentDate: str(d.last_payment_date),
    router: str(d.router_name),
    online: Boolean(d.online),
  };
}

/* ---- plans ----------------------------------------------------------- */
export interface PlanDTO {
  id: number;
  name: string;
  speed?: string;
  description?: string | null;
  plan_type?: string;
  price?: number;
  download_mbps?: number;
  upload_mbps?: number;
  duration_hours?: number | null;
  billing_cycle_days?: number | null;
  popular?: boolean;
  is_active?: boolean;
  customers_count?: number;
}
export function mapPlan(d: PlanDTO): Plan {
  const durationHours = num(d.duration_hours, d.plan_type === 'hotspot' ? 24 : 720);
  const durationDays = d.billing_cycle_days
    ? num(d.billing_cycle_days)
    : durationHours >= 24
      ? Math.round(durationHours / 24)
      : null;
  return {
    id: d.id,
    name: str(d.name),
    description: str(d.description, `${d.name} at ${d.speed ?? ''}`),
    planType: (d.plan_type as Plan['planType']) ?? 'pppoe',
    price: num(d.price),
    speed: str(d.speed),
    downloadSpeed: num(d.download_mbps, speedToMbps(d.speed)),
    uploadSpeed: num(d.upload_mbps, speedToMbps(d.speed)),
    durationHours,
    durationDays,
    isActive: d.is_active !== false,
    popular: Boolean(d.popular),
    customerCount: num(d.customers_count),
  };
}

/* ---- invoices -------------------------------------------------------- */
export interface InvoiceDTO {
  id: number;
  invoice_id?: string;
  invoice_number?: string;
  customer_id?: number;
  customer_name?: string;
  amount?: number;
  total?: number;
  status?: string;
  issue_date?: string;
  due_date?: string;
  plan_name?: string;
  speed?: string;
}
export function mapInvoice(d: InvoiceDTO): Invoice {
  return {
    id: d.id,
    invoiceId: str(d.invoice_id ?? d.invoice_number, `INV-${d.id}`),
    customerId: num(d.customer_id),
    customerName: str(d.customer_name),
    amount: num(d.amount ?? d.total),
    status: (d.status as Invoice['status']) ?? 'pending',
    issueDate: str(d.issue_date),
    dueDate: str(d.due_date),
    planName: str(d.plan_name),
    speed: str(d.speed),
  };
}

/* ---- payments / transactions ----------------------------------------- */
export interface PaymentDTO {
  id: number;
  customer_id?: number;
  customer_name?: string;
  amount?: number;
  method?: string;
  method_label?: string;
  reference?: string;
  status?: string;
  date?: string;
  created_at?: string;
  type?: string;
}
export function mapPayment(d: PaymentDTO): Payment {
  const method = (d.method as Payment['method']) ?? 'mpesa';
  return {
    id: d.id,
    customerId: num(d.customer_id),
    customerName: str(d.customer_name),
    amount: num(d.amount),
    method,
    methodLabel: str(d.method_label, method === 'mpesa' ? 'M-Pesa' : method),
    reference: str(d.reference),
    status: (d.status as Payment['status']) ?? 'completed',
    date: str(d.date ?? d.created_at),
  };
}
export function mapTransaction(d: PaymentDTO): Transaction {
  const base = mapPayment(d);
  const type = d.type === 'refund' ? 'refund' : 'payment';
  return { ...base, type, typeLabel: type === 'refund' ? 'Refund' : 'Payment' };
}

/* ---- vouchers -------------------------------------------------------- */
export interface VoucherDTO {
  id: number;
  code?: string;
  value?: number;
  plan_name?: string;
  status?: string;
  used_count?: number;
  max_uses?: number;
  expires_at?: string;
}
export function mapVoucher(d: VoucherDTO): Voucher {
  return {
    id: d.id,
    code: str(d.code),
    value: num(d.value),
    planName: str(d.plan_name),
    status: (d.status as Voucher['status']) ?? 'active',
    usedCount: num(d.used_count),
    maxUses: num(d.max_uses, 1),
    expiresAt: str(d.expires_at),
  };
}

/* ---- tickets --------------------------------------------------------- */
export interface TicketMessageDTO {
  id: number;
  sender?: string;
  sender_type?: string;
  message?: string;
  created_at?: string;
}
export interface TicketDTO {
  id: number;
  subject?: string;
  priority?: string;
  status?: string;
  customer_id?: number;
  customer_name?: string;
  assigned_to?: string;
  created_at?: string;
  messages?: TicketMessageDTO[];
}
function mapTicketMessage(d: TicketMessageDTO): TicketMessage {
  return {
    id: d.id,
    sender: str(d.sender),
    senderType: d.sender_type === 'staff' ? 'staff' : 'customer',
    message: str(d.message),
    createdAt: str(d.created_at),
  };
}
export function mapTicket(d: TicketDTO): Ticket {
  return {
    id: d.id,
    subject: str(d.subject),
    priority: (d.priority as Ticket['priority']) ?? 'medium',
    status: (d.status as Ticket['status']) ?? 'open',
    customerId: num(d.customer_id),
    customerName: str(d.customer_name),
    assignedTo: str(d.assigned_to, 'Support Team'),
    createdAt: str(d.created_at),
    messages: (d.messages ?? []).map(mapTicketMessage),
  };
}

/* ---- devices --------------------------------------------------------- */
export interface DeviceDTO {
  id: number;
  device_name?: string;
  name?: string;
  device_ip?: string;
  device_model?: string;
  device_status?: string;
  client_count?: number;
  bandwidth_usage?: number;
  location?: string;
  uptime?: string;
  last_synced?: string;
}
export function mapDevice(d: DeviceDTO): Device {
  return {
    id: d.id,
    name: str(d.device_name ?? d.name),
    ip: str(d.device_ip),
    model: str(d.device_model, 'MikroTik'),
    status: d.device_status === 'offline' ? 'offline' : 'online',
    clientCount: num(d.client_count),
    bandwidthUsage: num(d.bandwidth_usage),
    location: str(d.location),
    uptime: str(d.uptime, '—'),
    lastSynced: str(d.last_synced),
  };
}

/* ---- sessions -------------------------------------------------------- */
export interface SessionDTO {
  id: number;
  username?: string;
  customer_name?: string;
  connection_type?: string;
  ip_address?: string;
  mac_address?: string;
  plan_name?: string;
  router_name?: string;
  session_start?: string;
  duration_seconds?: number;
  bytes_in?: number;
  bytes_out?: number;
}
export function mapSession(d: SessionDTO): Session {
  return {
    id: d.id,
    username: str(d.username),
    customerName: str(d.customer_name),
    connectionType: (d.connection_type as Session['connectionType']) ?? 'pppoe',
    ipAddress: str(d.ip_address),
    macAddress: str(d.mac_address),
    planName: str(d.plan_name),
    router: str(d.router_name),
    sessionStart: str(d.session_start),
    durationSeconds: num(d.duration_seconds),
    bytesIn: num(d.bytes_in),
    bytesOut: num(d.bytes_out),
  };
}

/* ---- expenses -------------------------------------------------------- */
export interface ExpenseDTO {
  id: number;
  description?: string;
  category?: string;
  amount?: number;
  vendor?: string;
  status?: string;
  date?: string;
}
export function mapExpense(d: ExpenseDTO): Expense {
  return {
    id: d.id,
    description: str(d.description),
    category: str(d.category, 'other'),
    amount: num(d.amount),
    vendor: str(d.vendor),
    status: d.status === 'pending' ? 'pending' : 'paid',
    date: str(d.date),
  };
}
