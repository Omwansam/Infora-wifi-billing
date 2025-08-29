// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  REFRESH: `${API_BASE_URL}/api/auth/refresh`,
  VERIFY: `${API_BASE_URL}/api/auth/verify`,
  PROFILE: `${API_BASE_URL}/api/auth/profile`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/auth/change-password`,
  USERS: `${API_BASE_URL}/api/auth/users`,
  
  // Customer endpoints
  CUSTOMERS: `${API_BASE_URL}/api/customers`,
  
  // Invoice endpoints
  INVOICES: `${API_BASE_URL}/api/invoices`,
  
  // Plans endpoints
  PLANS: `${API_BASE_URL}/api/plans`,
  
  // Device endpoints
  DEVICES: `${API_BASE_URL}/api/devices`,
  DEVICE_STATS: `${API_BASE_URL}/api/devices/stats`,
  DEVICE_CONNECT: `${API_BASE_URL}/api/devices/connect`,
  DEVICE_DISCONNECT: `${API_BASE_URL}/api/devices/disconnect`,
  DEVICE_SYNC: `${API_BASE_URL}/api/devices/sync`,
  DEVICE_BACKUP: `${API_BASE_URL}/api/devices/backup`,
  DEVICE_RESTORE: `${API_BASE_URL}/api/devices/restore`,
  DEVICE_REBOOT: `${API_BASE_URL}/api/devices/reboot`,
  DEVICE_UPDATE: `${API_BASE_URL}/api/devices/update`,
  
  // ISP endpoints
  ISPS: `${API_BASE_URL}/api/isps`,
  ISP_STATS: `${API_BASE_URL}/api/isps/stats`,
  
  // RADIUS endpoints
  RADIUS_CLIENTS: `${API_BASE_URL}/api/radius/clients`,
  RADIUS_USERS: `${API_BASE_URL}/api/radius/users`,
  RADIUS_GROUPS: `${API_BASE_URL}/api/radius/groups`,
  RADIUS_ACCOUNTING: `${API_BASE_URL}/api/radius/accounting`,
  RADIUS_API: `${API_BASE_URL}/api/radius-api`,
  RADIUS_ROUTES: `${API_BASE_URL}/api/radius-routes`,
  
  // LDAP endpoints
  LDAP_SERVERS: `${API_BASE_URL}/api/ldap/servers`,
  LDAP_TEST: `${API_BASE_URL}/api/ldap/test`,
  LDAP_SYNC: `${API_BASE_URL}/api/ldap/sync`,
  
  // SNMP endpoints
  SNMP_DEVICES: `${API_BASE_URL}/api/snmp/devices`,
  SNMP_WALK: `${API_BASE_URL}/api/snmp/walk`,
  SNMP_GET: `${API_BASE_URL}/api/snmp/get`,
  SNMP_SET: `${API_BASE_URL}/api/snmp/set`,
  SNMP_TRAPS: `${API_BASE_URL}/api/snmp/traps`,
  
  // VPN endpoints
  VPN_CONFIGS: `${API_BASE_URL}/api/vpn/configs`,
  VPN_CLIENTS: `${API_BASE_URL}/api/vpn/clients`,
  VPN_STATUS: `${API_BASE_URL}/api/vpn/status`,
  VPN_GENERATE: `${API_BASE_URL}/api/vpn/generate`,
  
  // EAP endpoints
  EAP_PROFILES: `${API_BASE_URL}/api/eap/profiles`,
  EAP_TEST: `${API_BASE_URL}/api/eap/test`,
  
  // Billing endpoints
  BILLING_SUBSCRIPTIONS: `${API_BASE_URL}/api/billing/subscriptions`,
  BILLING_PAYMENTS: `${API_BASE_URL}/api/billing/payments`,
  BILLING_TRANSACTIONS: `${API_BASE_URL}/api/billing/transactions`,
  BILLING_REPORTS: `${API_BASE_URL}/api/billing/reports`,
  BILLING_VOUCHERS: `${API_BASE_URL}/api/billing/vouchers`,
  
  // Test endpoint
  TEST: `${API_BASE_URL}/api/test`,
};

export const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  'Authorization': token ? `Bearer ${token}` : '',
});

export default API_BASE_URL;
