/**
 * API configuration for the Infora backend (Flask, see backend/server).
 *
 * The base URL comes from an Expo public env var so it can differ per build:
 *   EXPO_PUBLIC_API_URL=http://192.168.1.10:5000   (LAN dev)
 *   EXPO_PUBLIC_API_URL=https://api.infora.app      (production)
 *
 * When it is NOT set, the app runs in DEMO mode: every service returns the
 * seeded mock dataset (src/data/mock.ts) so the UI is fully usable offline.
 * Set the var (e.g. in `.env`, or app config `extra`) to talk to the real API.
 */
const RAW_BASE = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';

/** Normalized base URL with no trailing slash, or '' in demo mode. */
export const API_BASE_URL = RAW_BASE.replace(/\/+$/, '');

/** True when a real backend is configured; false → seeded demo data. */
export const IS_LIVE = API_BASE_URL.length > 0;

/** Milliseconds before a request is aborted. */
export const REQUEST_TIMEOUT = 20000;

/** Full URL for an `/api/...` path. */
export const api = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

/** Endpoint map — mirrors FRONTEND/infora_billing/src/config/api.js. */
export const ENDPOINTS = {
  // auth
  login: '/api/auth/login',
  register: '/api/auth/register',
  logout: '/api/auth/logout',
  refresh: '/api/auth/refresh',
  verify: '/api/auth/verify',
  profile: '/api/auth/profile',
  changePassword: '/api/auth/change-password',

  // customers
  customers: '/api/customers',
  customer: (id: number | string) => `/api/customers/${id}`,
  activeSessions: '/api/customers/sessions/active',

  // plans
  plans: '/api/plans',
  plan: (id: number | string) => `/api/plans/${id}`,

  // invoices
  invoices: '/api/invoices',
  invoice: (id: number | string) => `/api/invoices/${id}`,
  invoiceStats: '/api/invoices/stats',

  // billing
  billingPayments: '/api/billing/payments',
  billingTransactions: '/api/billing/transactions',
  billingSubscriptions: '/api/billing/subscriptions',
  billingVouchers: '/api/billing/vouchers',
  billingReports: '/api/billing/reports',

  // dashboard / finance
  dashboardStats: '/api/dashboard/stats',
  financeSummary: '/api/finance/summary',
  financeExpenses: '/api/finance/expenses',
  financeLeads: '/api/finance/leads',

  // tickets
  tickets: '/api/tickets',
  ticket: (id: number | string) => `/api/tickets/${id}`,

  // devices / network
  devices: '/api/devices',
  deviceStats: '/api/devices/stats',
  isps: '/api/isps',

  // health
  test: '/api/test',
} as const;
