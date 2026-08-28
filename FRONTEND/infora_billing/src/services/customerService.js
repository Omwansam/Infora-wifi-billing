import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall, authenticatedApiCallText } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

export const customerService = {
  async getCustomers(params = {}) {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.connection_type) queryParams.append('connection_type', params.connection_type);
    if (params.sort_by) queryParams.append('sort_by', params.sort_by);
    if (params.sort_order) queryParams.append('sort_order', params.sort_order);

    const url = `${API_ENDPOINTS.CUSTOMERS}?${queryParams.toString()}`;
    return authenticatedApiCall(url, getAccessToken());
  },

  async getCustomer(customerId) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}`;
    return authenticatedApiCall(url, getAccessToken());
  },

  async createCustomer(customerData) {
    return authenticatedApiCall(API_ENDPOINTS.CUSTOMERS, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  },

  async updateCustomer(customerId, customerData) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}`;
    return authenticatedApiCall(url, getAccessToken(), {
      method: 'PUT',
      body: JSON.stringify(customerData),
    });
  },

  async deleteCustomer(customerId) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}`;
    return authenticatedApiCall(url, getAccessToken(), {
      method: 'DELETE',
    });
  },

  /**
   * Permanently delete many subscribers at once.
   *
   * Either `ids` (an explicit selection) or `scope: 'filtered'` with the same
   * filters the list is showing — the latter is how "delete everything" works
   * without shipping thousands of ids.
   *
   * `expectedCount` is what the operator was shown and agreed to. The server
   * refuses with 409 if the real count differs, so a subscriber created between
   * the confirmation and the request cannot be swept up silently.
   */
  async bulkDeleteCustomers({ ids, scope = 'ids', filters, expectedCount }) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/bulk-delete`;
    return authenticatedApiCall(url, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify({
        scope,
        ...(scope === 'ids' ? { ids } : { filters }),
        expected_count: expectedCount,
      }),
    });
  },

  /** Connect client — provision RADIUS at plan speed */
  async connectClient(clientId) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${clientId}/connect`;
    return authenticatedApiCall(url, getAccessToken(), { method: 'POST' });
  },

  /** Disconnect client — remove RADIUS access */
  async disconnectClient(clientId) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${clientId}/disconnect`;
    return authenticatedApiCall(url, getAccessToken(), { method: 'POST' });
  },

  /** Kick a single live session (keeps the account active) */
  async terminateSession(sessionId) {
    const url = `${API_ENDPOINTS.RADIUS_ROUTES}/sessions/terminate/${sessionId}`;
    return authenticatedApiCall(url, getAccessToken(), { method: 'POST' });
  },

  /** Reveal a client's PPPoE/hotspot login (username + stored password) */
  async getRadiusCredentials(clientId) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${clientId}/radius-credentials`;
    return authenticatedApiCall(url, getAccessToken());
  },

  /** Reset a client's RADIUS password (optionally to a supplied value) */
  async resetRadiusCredentials(clientId, password) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${clientId}/radius-credentials/reset`;
    return authenticatedApiCall(url, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(password ? { password } : {}),
    });
  },

  /** Suspend customer and remove RADIUS access */
  async suspendCustomer(customerId) {
    const url = `${API_ENDPOINTS.BILLING_CUSTOMERS}/${customerId}/suspend`;
    return authenticatedApiCall(url, getAccessToken(), { method: 'POST' });
  },

  /** Activate customer and provision RADIUS */
  async activateCustomer(customerId) {
    const url = `${API_ENDPOINTS.BILLING_CUSTOMERS}/${customerId}/activate`;
    return authenticatedApiCall(url, getAccessToken(), { method: 'POST' });
  },

  async updateCustomerStatus(customerId, status) {
    if (status === 'suspended') {
      return this.suspendCustomer(customerId);
    }
    if (status === 'active') {
      return this.activateCustomer(customerId);
    }
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/status`;
    return authenticatedApiCall(url, getAccessToken(), {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  },

  async updateCustomerBalance(customerId, balance) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/balance`;
    return authenticatedApiCall(url, getAccessToken(), {
      method: 'PUT',
      body: JSON.stringify({ balance }),
    });
  },

  async updateCustomerUsage(customerId, usageData) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/usage`;
    return authenticatedApiCall(url, getAccessToken(), {
      method: 'PUT',
      body: JSON.stringify(usageData),
    });
  },

  async getCustomerStats() {
    const url = `${API_ENDPOINTS.CUSTOMERS}/stats`;
    return authenticatedApiCall(url, getAccessToken());
  },

  /**
   * Bulk-import subscribers from another billing system. Pass raw CSV text
   * (dryRun=true previews without writing; dryRun=false commits).
   */
  async importCustomers({ csv, rows, dryRun = true, defaultStatus, planMap, createPlans } = {}) {
    const url = `${API_ENDPOINTS.CUSTOMERS}/import`;
    return authenticatedApiCall(url, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify({
        csv,
        rows,
        dry_run: dryRun,
        default_status: defaultStatus,
        plan_map: planMap,
        create_plans: createPlans,
      }),
    });
  },

  /** Fetch the import CSV template as text (for a client-side download). */
  async getImportTemplate() {
    const url = `${API_ENDPOINTS.CUSTOMERS}/import/template`;
    return authenticatedApiCallText(url, getAccessToken());
  },

  async getActiveSessions(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.connection_type) queryParams.append('connection_type', params.connection_type);
    if (params.search) queryParams.append('search', params.search);
    if (params.router_id) queryParams.append('router_id', params.router_id);

    const qs = queryParams.toString();
    const url = qs
      ? `${API_ENDPOINTS.CUSTOMERS_ACTIVE_SESSIONS}?${qs}`
      : API_ENDPOINTS.CUSTOMERS_ACTIVE_SESSIONS;
    return authenticatedApiCall(url, getAccessToken());
  },

  async getCustomerInvoices(customerId, params = {}) {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.status) queryParams.append('status', params.status);

    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/invoices?${queryParams.toString()}`;
    return authenticatedApiCall(url, getAccessToken());
  },

  async getCustomerPayments(customerId, params = {}) {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.status) queryParams.append('status', params.status);

    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/payments?${queryParams.toString()}`;
    return authenticatedApiCall(url, getAccessToken());
  },

  // --- Subscriber detail page -------------------------------------------
  // Backed by routes/subscriber_detail.py. Every one of these returns the
  // shape { ok, data } inside `result.data`; `unwrap()` below is what callers
  // use so a failed call throws instead of quietly rendering an empty page.

  /** Everything the Overview tab and the header need, in one request. */
  async getOverview(customerId) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/overview`, getAccessToken());
  },

  /** Everything the Reports tab needs, in one request. */
  async getReports(customerId) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/reports`, getAccessToken());
  },

  async getSessions(customerId, { page = 1, perPage = 20 } = {}) {
    const qs = new URLSearchParams({ page, per_page: perPage });
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/sessions?${qs}`, getAccessToken());
  },

  async getDevices(customerId) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/devices`, getAccessToken());
  },

  async getPackageHistory(customerId) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/package-history`, getAccessToken());
  },

  async getNotes(customerId) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/notes`, getAccessToken());
  },

  async addNote(customerId, content, type = 'general') {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/notes`, getAccessToken(),
      { method: 'POST', body: JSON.stringify({ content, type }) });
  },

  async deleteNote(customerId, noteId) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/notes/${noteId}`, getAccessToken(),
      { method: 'DELETE' });
  },

  async getMessages(customerId) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/messages`, getAccessToken());
  },

  async sendMessage(customerId, message) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/messages`, getAccessToken(),
      { method: 'POST', body: JSON.stringify({ message }) });
  },

  /**
   * Change when the subscription ends.
   * Pass `extend` ('1h'|'1d'|'7d'|'1mo') for a relative bump, or `expiry` for
   * an absolute date. `planId` switches package, `graceDays` sets the grace.
   */
  async changeExpiry(customerId, { expiry, extend, planId, graceDays, notify = true } = {}) {
    const body = { notify };
    if (extend) body.extend = extend;
    if (expiry !== undefined) body.expiry = expiry;
    if (planId) body.plan_id = planId;
    if (graceDays !== undefined) body.grace_days = graceDays;
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/expiry`, getAccessToken(),
      { method: 'POST', body: JSON.stringify(body) });
  },

  /**
   * Exactly what a canned SMS will say, before it is sent.
   * `kind` is 'credentials' or 'payment_details'.
   */
  async getMessagePreview(customerId, kind) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/message-preview?kind=${encodeURIComponent(kind)}`,
      getAccessToken());
  },

  /** `message` overrides the generated body — the operator may have edited it. */
  async sendCredentials(customerId, message) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/send-credentials`, getAccessToken(),
      { method: 'POST', body: JSON.stringify(message ? { message } : {}) });
  },

  async sendPaymentDetails(customerId, message) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/send-payment-details`, getAccessToken(),
      { method: 'POST', body: JSON.stringify(message ? { message } : {}) });
  },

  async generateInvoice(customerId, body = {}) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/invoice`, getAccessToken(),
      { method: 'POST', body: JSON.stringify(body) });
  },

  /**
   * Pause banks the remaining days; resume hands them back.
   * `pause_until` (ISO) sets an automatic resume.
   */
  async pauseSubscription(customerId, body = {}) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/pause`, getAccessToken(),
      { method: 'POST', body: JSON.stringify(body) });
  },

  async resumeSubscription(customerId) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/resume`, getAccessToken(), { method: 'POST' });
  },

  /** Block cuts access and keeps the clock running — not the same as pause. */
  async blockSubscriber(customerId, reason) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/block`, getAccessToken(),
      { method: 'POST', body: JSON.stringify({ reason }) });
  },

  async unblockSubscriber(customerId) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/unblock`, getAccessToken(), { method: 'POST' });
  },

  /** `mode` is inherit | exempt | throttle | disconnect; `days` bounds it. */
  async fupOverride(customerId, { mode = 'inherit', reason, days } = {}) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/fup-override`, getAccessToken(),
      { method: 'POST', body: JSON.stringify({ mode, reason, days }) });
  },

  /** Duration is minutes on the wire — an outage is rarely a whole day. */
  async compensate(customerId, { minutes, reason, notify = false }) {
    return authenticatedApiCall(
      `${API_ENDPOINTS.CUSTOMERS}/${customerId}/compensate`, getAccessToken(),
      { method: 'POST', body: JSON.stringify({ minutes, reason, notify }) });
  },

  async getCustomerTickets(customerId, params = {}) {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.status) queryParams.append('status', params.status);

    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/tickets?${queryParams.toString()}`;
    return authenticatedApiCall(url, getAccessToken());
  },
};

/**
 * Turn an apiCall result into data, or throw.
 *
 * `apiCall` never throws — it returns `{ success: false, error }` — so the
 * common `if (result.success) { … }` with no else silently renders an empty
 * page when the API is down. Every caller on the detail page goes through here
 * so a failure is loud.
 */
export function unwrap(result, fallbackMessage = 'Request failed') {
  if (!result?.success) {
    throw new Error(result?.error || result?.data?.error || fallbackMessage);
  }
  const payload = result.data;
  if (payload && typeof payload === 'object' && 'ok' in payload) {
    if (!payload.ok) throw new Error(payload.error || fallbackMessage);
    return payload.data ?? payload;
  }
  return payload;
}
