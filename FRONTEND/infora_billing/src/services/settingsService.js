import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

const json = (token) => getAuthHeaders(token);

async function handle(response) {
  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }
  if (!response.ok) {
    throw new Error((data && (data.error || data.message)) || `HTTP ${response.status}`);
  }
  return data;
}

const settingsService = {
  // ---- General ----
  async getGeneral(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_GENERAL, { headers: json(token) }));
  },
  async saveGeneral(token, payload) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_GENERAL, {
      method: 'PUT', headers: json(token), body: JSON.stringify(payload),
    }));
  },
  async uploadLogo(token, file) {
    const form = new FormData();
    form.append('file', file);
    return handle(await fetch(API_ENDPOINTS.SETTINGS_LOGO, {
      method: 'POST',
      headers: { Authorization: token ? `Bearer ${token}` : '' },
      body: form,
    }));
  },
  async saveCustomDomain(token, custom_domain) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_CUSTOM_DOMAIN, {
      method: 'PUT', headers: json(token), body: JSON.stringify({ custom_domain }),
    }));
  },

  // ---- Modules ----
  async getModules(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_MODULES, { headers: json(token) }));
  },
  async saveModules(token, payload) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_MODULES, {
      method: 'PUT', headers: json(token), body: JSON.stringify(payload),
    }));
  },

  // ---- Notifications ----
  async getNotifications(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_NOTIFICATIONS, { headers: json(token) }));
  },
  async saveNotifications(token, settings) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_NOTIFICATIONS, {
      method: 'PUT', headers: json(token), body: JSON.stringify({ settings }),
    }));
  },

  // ---- Captive portal ----
  async getPortal(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_PORTAL, { headers: json(token) }));
  },
  async savePortal(token, payload) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_PORTAL, {
      method: 'PUT', headers: json(token), body: JSON.stringify(payload),
    }));
  },
  async setRouterTheme(token, deviceId, theme) {
    return handle(await fetch(API_ENDPOINTS.settingsRouterTheme(deviceId), {
      method: 'PUT', headers: json(token), body: JSON.stringify({ theme }),
    }));
  },
  async createAnnouncement(token, payload) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_ANNOUNCEMENTS, {
      method: 'POST', headers: json(token), body: JSON.stringify(payload),
    }));
  },
  async updateAnnouncement(token, id, payload) {
    return handle(await fetch(API_ENDPOINTS.settingsAnnouncement(id), {
      method: 'PUT', headers: json(token), body: JSON.stringify(payload),
    }));
  },
  async deleteAnnouncement(token, id) {
    return handle(await fetch(API_ENDPOINTS.settingsAnnouncement(id), {
      method: 'DELETE', headers: json(token),
    }));
  },

  // ---- Subscription ----
  async getSubscription(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_SUBSCRIPTION, { headers: json(token) }));
  },

  // ---- Payments ----
  async getPayments(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_PAYMENTS, { headers: json(token) }));
  },
  async savePayments(token, payload) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_PAYMENTS, {
      method: 'PUT', headers: json(token), body: JSON.stringify(payload),
    }));
  },

  // ---- RADIUS ----
  async getRadius(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_RADIUS, { headers: json(token) }));
  },
  async saveRadius(token, payload) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_RADIUS, {
      method: 'PUT', headers: json(token), body: JSON.stringify(payload),
    }));
  },
  async addRadiusNas(token, payload) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_RADIUS_NAS, {
      method: 'POST', headers: json(token), body: JSON.stringify(payload),
    }));
  },
  async deleteRadiusNas(token, id) {
    return handle(await fetch(API_ENDPOINTS.settingsRadiusNas(id), {
      method: 'DELETE', headers: json(token),
    }));
  },

  // ---- Integrations ----
  async getIntegrations(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_INTEGRATIONS, { headers: json(token) }));
  },
  async saveIntegration(token, key, payload) {
    return handle(await fetch(API_ENDPOINTS.settingsIntegration(key), {
      method: 'PUT', headers: json(token), body: JSON.stringify(payload),
    }));
  },

  // ---- API keys ----
  async getApiKeys(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_API_KEYS, { headers: json(token) }));
  },
  async createApiKey(token, payload) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_API_KEYS, {
      method: 'POST', headers: json(token), body: JSON.stringify(payload),
    }));
  },
  async deleteApiKey(token, id) {
    return handle(await fetch(API_ENDPOINTS.settingsApiKey(id), {
      method: 'DELETE', headers: json(token),
    }));
  },
  async regenerateWebhookSecret(token) {
    return handle(await fetch(API_ENDPOINTS.SETTINGS_WEBHOOK_SECRET, {
      method: 'POST', headers: json(token),
    }));
  },
};

export default settingsService;
