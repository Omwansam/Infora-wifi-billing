import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { getAccessToken } from '../utils/authToken';

/**
 * The tenant's own subscription to this platform.
 *
 * Not to be confused with subscriptionService (the plan *tier*) or
 * billingService (what this ISP charges its own subscribers). This is the bill
 * that, unpaid, locks the console.
 *
 * Throws on failure rather than returning {success:false} — a silently
 * swallowed error here would leave the paywall showing stale state.
 */
async function request(url, { method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: getAuthHeaders(getAccessToken()),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

export const platformSubscriptionService = {
  /** { subscription, invoices, tenant, can_pay } */
  async get() {
    return request(API_ENDPOINTS.PLATFORM_SUBSCRIPTION);
  },

  /** Sends an M-Pesa prompt. Returns 202 — nothing is paid until the callback. */
  async payInvoice(invoiceId, phone) {
    return request(API_ENDPOINTS.platformInvoicePay(invoiceId), {
      method: 'POST',
      body: { phone },
    });
  },

  /** Poll after a prompt: the Safaricom callback is what settles the invoice. */
  async invoiceStatus(invoiceId) {
    return request(API_ENDPOINTS.platformInvoiceStatus(invoiceId));
  },

  /**
   * The document endpoint needs the bearer token, so a plain <a href> cannot
   * reach it — fetch it and hand the browser a blob instead.
   */
  async openInvoiceDocument(invoiceId) {
    const response = await fetch(API_ENDPOINTS.platformInvoicePdf(invoiceId), {
      headers: getAuthHeaders(getAccessToken()),
    });
    if (!response.ok) throw new Error('Could not open the invoice document');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) {
      URL.revokeObjectURL(url);
      throw new Error('Your browser blocked the invoice window — allow pop-ups and retry.');
    }
    // Revoke late: revoking immediately can race the new tab's own load.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

export default platformSubscriptionService;
