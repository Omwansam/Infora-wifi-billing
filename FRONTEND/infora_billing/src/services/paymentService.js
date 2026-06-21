import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const paymentService = {
  /**
   * Initiate M-Pesa STK push for a customer (optionally linked to an invoice).
   */
  async initiateMpesaStkPush({ customerId, invoiceId, phone, amount }) {
    const payload = {
      customer_id: customerId,
      phone,
      amount,
    };
    if (invoiceId != null) {
      payload.invoice_id = invoiceId;
    }

    const result = await authenticatedApiCall(
      API_ENDPOINTS.MPESA_STK_PUSH,
      getAccessToken(),
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to initiate payment' };
    }

    const body = result.data;
    if (!body?.ok) {
      return { success: false, error: body?.message || 'STK push failed' };
    }

    return { success: true, data: body.data };
  },

  /**
   * Check M-Pesa payment status by checkout request ID.
   */
  async getMpesaPaymentStatus(checkoutRequestId) {
    const url = `${API_ENDPOINTS.MPESA_STATUS}/${encodeURIComponent(checkoutRequestId)}`;
    const result = await authenticatedApiCall(url, getAccessToken());

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to check payment status' };
    }

    const body = result.data;
    if (!body?.ok) {
      return { success: false, error: body?.message || 'Status check failed' };
    }

    return { success: true, data: body.data };
  },

  /**
   * Poll until payment completes, fails, or times out.
   */
  async pollMpesaPaymentStatus(checkoutRequestId, { maxAttempts = 24, intervalMs = 2500 } = {}) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const result = await this.getMpesaPaymentStatus(checkoutRequestId);
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
      error: 'Payment is still pending. Confirm on your phone or check Payments later.',
      pending: true,
    };
  },
};

export default paymentService;
