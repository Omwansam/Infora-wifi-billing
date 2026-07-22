import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

export const twoFactorService = {
  async getStatus() {
    return authenticatedApiCall(API_ENDPOINTS.TWO_FACTOR_STATUS, getAccessToken());
  },

  async setup() {
    return authenticatedApiCall(API_ENDPOINTS.TWO_FACTOR_SETUP, getAccessToken(), {
      method: 'POST',
    });
  },

  async verify(code) {
    return authenticatedApiCall(API_ENDPOINTS.TWO_FACTOR_VERIFY, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async disable(password) {
    return authenticatedApiCall(API_ENDPOINTS.TWO_FACTOR_DISABLE, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },
};
