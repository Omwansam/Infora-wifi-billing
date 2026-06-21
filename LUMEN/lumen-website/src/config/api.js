export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  WEBSITE_CONFIG: `${API_BASE_URL}/api/website/config`,
  WEBSITE_STATS: `${API_BASE_URL}/api/website/stats`,
  WEBSITE_CHANGELOG: `${API_BASE_URL}/api/website/changelog`,
  WEBSITE_CONTACT: `${API_BASE_URL}/api/website/contact`,
  WEBSITE_AFFILIATE: `${API_BASE_URL}/api/website/affiliate`,
  WEBSITE_TRIAL_SIGNUP: `${API_BASE_URL}/api/website/trial-signup`,
  WEBSITE_LOGIN: `${API_BASE_URL}/api/website/login`,
};
