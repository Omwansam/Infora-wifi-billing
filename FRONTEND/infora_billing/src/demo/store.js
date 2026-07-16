/**
 * In-memory demo database.
 *
 * Cloned from the fixtures at boot; mutations (create/update/delete) only
 * touch this copy, so every page reload starts from a pristine dataset —
 * the demo "auto-resets" by design.
 */
import * as fixtures from './fixtures';

const clone = (v) => JSON.parse(JSON.stringify(v));

function freshState() {
  return {
    customers: clone(fixtures.CUSTOMERS),
    plans: clone(fixtures.PLANS),
    invoices: clone(fixtures.INVOICES),
    payments: clone(fixtures.PAYMENTS),
    transactions: clone(fixtures.TRANSACTIONS),
    subscriptions: clone(fixtures.SUBSCRIPTIONS),
    vouchers: clone(fixtures.VOUCHERS),
    tickets: clone(fixtures.TICKETS),
    devices: clone(fixtures.DEVICES),
    isps: clone(fixtures.ISPS),
    sessions: clone(fixtures.SESSIONS),
    users: clone(fixtures.USERS),
    leads: clone(fixtures.LEADS),
    expenses: clone(fixtures.EXPENSES),
    kycRecords: clone(fixtures.KYC_RECORDS),
  };
}

export const db = freshState();

export function resetDemoStore() {
  Object.assign(db, freshState());
}

export function nextId(collection) {
  return collection.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

/** Static (non-mutable) fixtures the router serves directly. */
export const staticData = {
  DASHBOARD_STATS: fixtures.DASHBOARD_STATS,
  CUSTOMER_STATS: fixtures.CUSTOMER_STATS,
  INVOICE_STATS: fixtures.INVOICE_STATS,
  DEVICE_STATS: fixtures.DEVICE_STATS,
  SUBSCRIPTION_STATS: fixtures.SUBSCRIPTION_STATS,
  FINANCE_SUMMARY: fixtures.FINANCE_SUMMARY,
  KYC_STATS: fixtures.KYC_STATS,
  PORTAL_CONFIG: fixtures.PORTAL_CONFIG,
  PLAN_STATS: fixtures.PLAN_STATS,
};
