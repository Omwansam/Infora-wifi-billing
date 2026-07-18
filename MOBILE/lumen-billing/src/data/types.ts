/** Domain types for the Infora billing mobile app. */

export type ConnectionType = 'pppoe' | 'hotspot';
export type CustomerStatus = 'active' | 'suspended' | 'expired' | 'pending';
export type KycStatus = 'verified' | 'pending' | 'rejected';

export interface Plan {
  id: number;
  name: string;
  description: string;
  planType: ConnectionType;
  price: number;
  speed: string;
  downloadSpeed: number;
  uploadSpeed: number;
  durationHours: number;
  durationDays: number | null;
  isActive: boolean;
  popular: boolean;
  customerCount: number;
}

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  connectionType: ConnectionType;
  status: CustomerStatus;
  planId: number;
  servicePlan: string;
  package: string;
  monthlyFee: number;
  balance: number;
  joinDate: string;
  radiusUsername: string;
  idNumber: string;
  kycStatus: KycStatus;
  subscriptionEnd: string;
  usagePercentage: number;
  deviceCount: number;
  lastPaymentDate: string;
  router: string;
  online: boolean;
}

export type InvoiceStatus = 'paid' | 'pending' | 'overdue' | 'draft';
export interface Invoice {
  id: number;
  invoiceId: string;
  customerId: number;
  customerName: string;
  amount: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  planName: string;
  speed: string;
}

export type PaymentMethod = 'mpesa' | 'cash' | 'bank';
export type PaymentStatus = 'completed' | 'pending' | 'failed';
export interface Payment {
  id: number;
  customerId: number;
  customerName: string;
  amount: number;
  method: PaymentMethod;
  methodLabel: string;
  reference: string;
  status: PaymentStatus;
  date: string;
}

export interface Transaction extends Payment {
  type: 'payment' | 'refund';
  typeLabel: string;
}

export type VoucherStatus = 'active' | 'used' | 'expired';
export interface Voucher {
  id: number;
  code: string;
  value: number;
  planName: string;
  status: VoucherStatus;
  usedCount: number;
  maxUses: number;
  expiresAt: string;
}

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export interface TicketMessage {
  id: number;
  sender: string;
  senderType: 'customer' | 'staff';
  message: string;
  createdAt: string;
}
export interface Ticket {
  id: number;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  customerId: number;
  customerName: string;
  assignedTo: string;
  createdAt: string;
  messages: TicketMessage[];
}

export interface Device {
  id: number;
  name: string;
  ip: string;
  model: string;
  status: 'online' | 'offline';
  clientCount: number;
  bandwidthUsage: number;
  location: string;
  uptime: string;
  lastSynced: string;
}

export interface Session {
  id: number;
  username: string;
  customerName: string;
  connectionType: ConnectionType;
  ipAddress: string;
  macAddress: string;
  planName: string;
  router: string;
  sessionStart: string;
  durationSeconds: number;
  bytesIn: number;
  bytesOut: number;
}

export interface Expense {
  id: number;
  description: string;
  category: string;
  amount: number;
  vendor: string;
  status: 'paid' | 'pending';
  date: string;
}

export interface DashboardAlert {
  id: number;
  type: 'warning' | 'info';
  title: string;
  message: string;
  at: string;
}

export interface DashboardData {
  summary: {
    totalCustomers: number;
    activeCustomers: number;
    pppoeCustomers: number;
    hotspotCustomers: number;
    totalRevenue: number;
    monthlyPayments: number;
    todayPayments: number;
    openTickets: number;
    onlineDevices: number;
    totalDevices: number;
    onlineNow: number;
  };
  revenuePeriods: { today: number; thisWeek: number; thisMonth: number; lastMonth: number };
  revenueByType: { pppoe: number; hotspot: number };
  revenueTrend: { label: string; value: number }[];
  finance: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    mrr: number;
    arpu: number;
  };
  topDataUsers: { username: string; customerName: string; planName: string; totalBytes: number }[];
  alerts: DashboardAlert[];
}
