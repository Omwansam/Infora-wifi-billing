import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

export const subscriptionService = {
  async getSubscription() {
    return authenticatedApiCall(API_ENDPOINTS.SETTINGS_SUBSCRIPTION, getAccessToken());
  },

  async getPlans() {
    return authenticatedApiCall(API_ENDPOINTS.SETTINGS_SUBSCRIPTION_PLANS, getAccessToken());
  },

  async changePlan(plan) {
    return authenticatedApiCall(API_ENDPOINTS.SETTINGS_SUBSCRIPTION, getAccessToken(), {
      method: 'PUT',
      body: JSON.stringify({ plan }),
    });
  },
};
