import { API_ENDPOINTS } from '../config/api';
import { apiCall } from '../utils/api';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withIspQuery(baseUrl, ispId) {
  if (ispId == null || ispId === '') return baseUrl;
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}isp_id=${encodeURIComponent(ispId)}`;
}

export const portalService = {
  async getConfig(ispId) {
    const url = withIspQuery(API_ENDPOINTS.PORTAL_CONFIG, ispId);
    const result = await apiCall(url);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const body = result.data;
    if (!body?.ok) {
      return { success: false, error: body?.message || 'Could not load portal' };
    }
    return { success: true, data: body.data };
  },

  async getPlans(planType, ispId) {
    const base = `${API_ENDPOINTS.PORTAL_PLANS}?type=${encodeURIComponent(planType)}`;
    const url = withIspQuery(base, ispId);
    const result = await apiCall(url);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const body = result.data;
    if (!body?.ok) {
      return { success: false, error: body?.message || 'Could not load packages' };
    }
    return { success: true, data: body.data };
  },

  async purchaseHotspot({ planId, phone, fullName, ispId }) {
    const result = await apiCall(API_ENDPOINTS.PORTAL_HOTSPOT_PURCHASE, {
      method: 'POST',
      body: JSON.stringify({
        plan_id: planId,
        phone,
        full_name: fullName || undefined,
        isp_id: ispId || undefined,
      }),
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const body = result.data;
    if (!body?.ok) {
      return { success: false, error: body?.message || 'Purchase failed' };
    }
    return { success: true, data: body.data, message: body.message };
  },

  async lookupPppoe({ account, ispId }) {
    const result = await apiCall(API_ENDPOINTS.PORTAL_PPPOE_LOOKUP, {
      method: 'POST',
      body: JSON.stringify({
        account,
        isp_id: ispId || undefined,
      }),
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const body = result.data;
    if (!body?.ok) {
      return { success: false, error: body?.message || 'Account not found' };
    }
    return { success: true, data: body.data };
  },

  async renewPppoe({ account, phone, planId, ispId }) {
    const result = await apiCall(API_ENDPOINTS.PORTAL_PPPOE_PAY, {
      method: 'POST',
      body: JSON.stringify({
        account,
        phone,
        plan_id: planId || undefined,
        isp_id: ispId || undefined,
      }),
    });
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const body = result.data;
    if (!body?.ok) {
      return { success: false, error: body?.message || 'Payment could not start' };
    }
    return { success: true, data: body.data, message: body.message };
  },

  async getPaymentStatus(checkoutRequestId) {
    const url = `${API_ENDPOINTS.PORTAL_PAYMENT_STATUS}/${encodeURIComponent(checkoutRequestId)}`;
    const result = await apiCall(url);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    const body = result.data;
    if (!body?.ok) {
      return { success: false, error: body?.message || 'Status check failed' };
    }
    return { success: true, data: body.data };
  },

  async pollPaymentStatus(checkoutRequestId, { maxAttempts = 24, intervalMs = 2500 } = {}) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const result = await this.getPaymentStatus(checkoutRequestId);
      if (result.success && result.data) {
        const { status } = result.data;
        if (status === 'completed') {
          return { success: true, data: result.data };
        }
        if (status === 'failed') {
          return { success: false, error: 'Payment was declined or cancelled on the phone.' };
        }
      }
      if (attempt < maxAttempts - 1) {
        await sleep(intervalMs);
      }
    }
    return {
      success: false,
      error: 'Payment is still pending. Confirm on your phone and try again.',
      pending: true,
    };
  },
};

export default portalService;
