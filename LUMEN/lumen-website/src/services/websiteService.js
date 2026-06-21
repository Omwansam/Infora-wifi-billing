import { API_ENDPOINTS } from '../config/api';

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }

  return data;
}

export async function fetchWebsiteConfig() {
  const data = await request(API_ENDPOINTS.WEBSITE_CONFIG);
  return data.data;
}

export async function fetchWebsiteStats() {
  const data = await request(API_ENDPOINTS.WEBSITE_STATS);
  return data.data;
}

export async function fetchWebsiteChangelog() {
  const data = await request(API_ENDPOINTS.WEBSITE_CHANGELOG);
  return data.data;
}

export async function submitContactForm(payload) {
  return request(API_ENDPOINTS.WEBSITE_CONTACT, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitAffiliateApplication(payload) {
  return request(API_ENDPOINTS.WEBSITE_AFFILIATE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function submitTrialSignup(payload) {
  return request(API_ENDPOINTS.WEBSITE_TRIAL_SIGNUP, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function loginUser(payload) {
  return request(API_ENDPOINTS.WEBSITE_LOGIN, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
