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

  async getCustomerTickets(customerId, params = {}) {
    const queryParams = new URLSearchParams();

    if (params.page) queryParams.append('page', params.page);
    if (params.per_page) queryParams.append('per_page', params.per_page);
    if (params.status) queryParams.append('status', params.status);

    const url = `${API_ENDPOINTS.CUSTOMERS}/${customerId}/tickets?${queryParams.toString()}`;
    return authenticatedApiCall(url, getAccessToken());
  },
};
