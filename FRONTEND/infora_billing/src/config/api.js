// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Exported so Settings > Payments can show the real M-Pesa callback URL a
// tenant has to hand to Safaricom, rather than a guess at the host.
export { API_BASE_URL };

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
  authUser: (id) => `${API_BASE_URL}/api/auth/users/${id}`,
  TWO_FACTOR_STATUS: `${API_BASE_URL}/api/auth/2fa/status`,
  TWO_FACTOR_SETUP: `${API_BASE_URL}/api/auth/2fa/setup`,
  TWO_FACTOR_VERIFY: `${API_BASE_URL}/api/auth/2fa/verify`,
  TWO_FACTOR_DISABLE: `${API_BASE_URL}/api/auth/2fa/disable`,

  // Self-serve ISP onboarding (public — no token). See ONBOARDING.md.
  ONBOARDING_COUNTRIES: `${API_BASE_URL}/api/onboarding/countries`,
  ONBOARDING_LOCALE: `${API_BASE_URL}/api/onboarding/locale`,
  ONBOARDING_START: `${API_BASE_URL}/api/onboarding/start`,
  ONBOARDING_RESEND: `${API_BASE_URL}/api/onboarding/resend`,
  ONBOARDING_CHANGE_NUMBER: `${API_BASE_URL}/api/onboarding/change-number`,
  ONBOARDING_VERIFY: `${API_BASE_URL}/api/onboarding/verify`,
  ONBOARDING_ACCOUNT: `${API_BASE_URL}/api/onboarding/account`,
  ONBOARDING_PROFILE: `${API_BASE_URL}/api/onboarding/profile`,
  ONBOARDING_COMPLETE: `${API_BASE_URL}/api/onboarding/complete`,
  onboardingSlugCheck: (params) =>
    `${API_BASE_URL}/api/onboarding/slug-check?${new URLSearchParams(params).toString()}`,
  onboardingStatus: (token) =>
    `${API_BASE_URL}/api/onboarding/status?token=${encodeURIComponent(token)}`,
  onboardingSession: (token) =>
    `${API_BASE_URL}/api/onboarding/session?token=${encodeURIComponent(token)}`,


  // Customer endpoints (RADIUS-aware via legacy hooks on /api/customers)
  CUSTOMERS: `${API_BASE_URL}/api/customers`,
  CUSTOMERS_ACTIVE_SESSIONS: `${API_BASE_URL}/api/customers/sessions/active`,
  BILLING_CUSTOMERS: `${API_BASE_URL}/api/billing/customers`,
  BILLING_RADIUS_STATUS: `${API_BASE_URL}/api/billing/radius/status`,

  // Invoice endpoints
  INVOICES: `${API_BASE_URL}/api/invoices`,

  // Plans endpoints
  PLANS: `${API_BASE_URL}/api/plans`,
  
  // Device endpoints
  DEVICES: `${API_BASE_URL}/api/devices`,
  deviceRadiusScript: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/radius-script`,
  deviceManagementTunnelScript: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/management-tunnel-script`,
  deviceWebfigSession: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/webfig/session`,
  webfigVpnClientConfig: `${API_BASE_URL}/api/devices/webfig/vpn-client-config`,
  deviceProvisionToken: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/provision-token`,
  deviceProvisionStatus: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/provision-status`,
  deviceInterfaces: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/interfaces`,
  deviceSelfCheck: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/self-check`,
  deviceMonitorInterfaces: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/interfaces/monitor`,
  deviceToggleInterface: (deviceId, name) => `${API_BASE_URL}/api/devices/${deviceId}/interfaces/${encodeURIComponent(name)}/toggle`,
  deviceInterfaceTraffic: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/interfaces/traffic`,
  deviceConfigureServices: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/configure-services`,
  deviceLoadBalancingScript: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/load-balancing/script`,
  deviceConfigureLoadBalancing: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/configure-load-balancing`,
  deviceDisableLoadBalancing: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/load-balancing/disable`,
  deviceFirmwareCheck: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/firmware/check`,
  deviceFirmwareUpgrade: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/firmware/upgrade`,
  deviceMaintenance: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/maintenance`,
  deviceBackupCreate: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/backup`,
  deviceBackups: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/backups`,
  deviceBackupDownload: (backupId) => `${API_BASE_URL}/api/devices/backups/${backupId}/download`,
  deviceBackupDelete: (backupId) => `${API_BASE_URL}/api/devices/backups/${backupId}`,
  // Equipment inventory
  EQUIPMENT: `${API_BASE_URL}/api/equipment`,
  EQUIPMENT_STATS: `${API_BASE_URL}/api/equipment/stats`,
  equipmentItem: (id) => `${API_BASE_URL}/api/equipment/${id}`,
  HEALTH_DEPLOYMENT: `${API_BASE_URL}/api/health/deployment`,

  // Import — router scan, reviewable runs, cutover (see ROUTER_SCAN_IMPORT_AND_TAKEOVER.md)
  IMPORT_RUNS: `${API_BASE_URL}/api/import/runs`,
  IMPORT_ROUTER_SCAN: `${API_BASE_URL}/api/import/router/scan`,
  IMPORT_ROUTER_UPLOAD: `${API_BASE_URL}/api/import/router/scan/upload`,
  IMPORT_AGENT_SCRIPT: `${API_BASE_URL}/api/import/router/agent-script`,
  importRun: (runId) => `${API_BASE_URL}/api/import/runs/${runId}`,
  importRunCandidates: (runId) => `${API_BASE_URL}/api/import/runs/${runId}/candidates`,
  importRunPlan: (runId) => `${API_BASE_URL}/api/import/runs/${runId}/plan`,
  importRunCommit: (runId) => `${API_BASE_URL}/api/import/runs/${runId}/commit`,
  importRunRevert: (runId) => `${API_BASE_URL}/api/import/runs/${runId}/revert`,
  importRunCommentPreview: (runId) => `${API_BASE_URL}/api/import/runs/${runId}/comment-preview`,
  importRunAdoptionScript: (runId) => `${API_BASE_URL}/api/import/runs/${runId}/adoption-script`,
  importRunCutoverScript: (runId) => `${API_BASE_URL}/api/import/runs/${runId}/cutover-script`,
  importRunRollbackScript: (runId) => `${API_BASE_URL}/api/import/runs/${runId}/rollback-script`,
  HEALTH_RADIUS_USER: `${API_BASE_URL}/api/health/radius-user`,
  DEVICE_STATS: `${API_BASE_URL}/api/devices/stats`,
  DEVICE_CONNECT: `${API_BASE_URL}/api/devices/connect`,
  DEVICE_DISCONNECT: `${API_BASE_URL}/api/devices/disconnect`,
  DEVICE_SYNC: `${API_BASE_URL}/api/devices/sync`,
  DEVICE_BACKUP: `${API_BASE_URL}/api/devices/backup`,
  DEVICE_RESTORE: `${API_BASE_URL}/api/devices/restore`,
  DEVICE_REBOOT: `${API_BASE_URL}/api/devices/reboot`,
  DEVICE_UPDATE: `${API_BASE_URL}/api/devices/update`,
  deviceDiagnose: (deviceId) => `${API_BASE_URL}/api/devices/${deviceId}/diagnose`,

  // TR-069 CPE endpoints (customer premises equipment — ONTs, vendor routers)
  CPE: `${API_BASE_URL}/api/cpe`,
  CPE_STATS: `${API_BASE_URL}/api/cpe/stats`,
  CPE_PROFILES: `${API_BASE_URL}/api/cpe/profiles`,
  CPE_ENROLLMENT: `${API_BASE_URL}/api/cpe/enrollment`,
  cpeDevice: (id) => `${API_BASE_URL}/api/cpe/${id}`,
  cpeApprove: (id) => `${API_BASE_URL}/api/cpe/${id}/approve`,
  cpeRefresh: (id) => `${API_BASE_URL}/api/cpe/${id}/refresh`,
  cpeSettings: (id) => `${API_BASE_URL}/api/cpe/${id}/settings`,
  cpeReboot: (id) => `${API_BASE_URL}/api/cpe/${id}/reboot`,
  cpeFactoryReset: (id) => `${API_BASE_URL}/api/cpe/${id}/factory-reset`,
  cpeTasks: (id) => `${API_BASE_URL}/api/cpe/${id}/tasks`,
  cpeSessions: (id) => `${API_BASE_URL}/api/cpe/${id}/sessions`,
  cpeCancelTask: (taskId) => `${API_BASE_URL}/api/cpe/tasks/${taskId}`,
  
  // ISP endpoints
  ISPS: `${API_BASE_URL}/api/isps`,
  ISP_STATS: `${API_BASE_URL}/api/isps/stats`,

  // Settings (organisation-level config)
  SETTINGS_GENERAL: `${API_BASE_URL}/api/settings/general`,
  SETTINGS_LOGO: `${API_BASE_URL}/api/settings/logo`,
  SETTINGS_CUSTOM_DOMAIN: `${API_BASE_URL}/api/settings/custom-domain`,
  SETTINGS_MODULES: `${API_BASE_URL}/api/settings/modules`,
  SETTINGS_NOTIFICATIONS: `${API_BASE_URL}/api/settings/notifications`,
  SETTINGS_PORTAL: `${API_BASE_URL}/api/settings/portal`,
  SETTINGS_ANNOUNCEMENTS: `${API_BASE_URL}/api/settings/announcements`,
  // Fiber plant (OSP) — nodes, cable routes, splice plan and the map payload
  FIBER_MAP: `${API_BASE_URL}/api/fiber/map`,
  FIBER_FAULTS: `${API_BASE_URL}/api/fiber/faults`,
  FIBER_NODES: `${API_BASE_URL}/api/fiber/nodes`,
  FIBER_CABLES: `${API_BASE_URL}/api/fiber/cables`,
  FIBER_SPLICES: `${API_BASE_URL}/api/fiber/splices`,
  FIBER_STATS: `${API_BASE_URL}/api/fiber/stats`,
  FIBER_PLACE: `${API_BASE_URL}/api/fiber/place`,
  FIBER_GEOCODE: `${API_BASE_URL}/api/fiber/geocode`,
  FIBER_IMPORT: `${API_BASE_URL}/api/fiber/import`,
  fiberNode: (id) => `${API_BASE_URL}/api/fiber/nodes/${id}`,
  fiberNodeTrace: (id) => `${API_BASE_URL}/api/fiber/nodes/${id}/trace`,
  fiberNodeSplices: (id) => `${API_BASE_URL}/api/fiber/nodes/${id}/splices`,
  fiberCable: (id) => `${API_BASE_URL}/api/fiber/cables/${id}`,
  fiberSplice: (id) => `${API_BASE_URL}/api/fiber/splices/${id}`,

  // Platform subscription — what this tenant pays to use the system itself.
  // Distinct from SETTINGS_SUBSCRIPTION above, which is only the plan tier.
  PLATFORM_SUBSCRIPTION: `${API_BASE_URL}/api/platform/subscription`,
  platformInvoicePay: (id) => `${API_BASE_URL}/api/platform/subscription/invoices/${id}/pay`,
  platformInvoiceStatus: (id) => `${API_BASE_URL}/api/platform/subscription/invoices/${id}/status`,
  platformInvoicePdf: (id) => `${API_BASE_URL}/api/platform/subscription/invoices/${id}/pdf`,
  SETTINGS_SUBSCRIPTION: `${API_BASE_URL}/api/settings/subscription`,
  SETTINGS_SUBSCRIPTION_PLANS: `${API_BASE_URL}/api/settings/plans`,
  SETTINGS_LOGS: `${API_BASE_URL}/api/settings/logs`,
  SUPPORT_REQUESTS: `${API_BASE_URL}/api/support/requests`,
  supportRequest: (id) => `${API_BASE_URL}/api/support/requests/${id}`,
  SETTINGS_PAYMENTS: `${API_BASE_URL}/api/settings/payments`,
  SETTINGS_RADIUS: `${API_BASE_URL}/api/settings/radius`,
  SETTINGS_RADIUS_NAS: `${API_BASE_URL}/api/settings/radius/nas`,
  SETTINGS_INTEGRATIONS: `${API_BASE_URL}/api/settings/integrations`,
  // Test sends: resolve exactly what a real notification resolves, so a pass
  // here means the next receipt leaves the same way.
  settingsIntegrationTest: (key) =>
    `${API_BASE_URL}/api/settings/integrations/${encodeURIComponent(key)}/test`,
  // Messaging gateways: one catalogue call per channel, plus activate + test.
  settingsMessaging: (channel) =>
    `${API_BASE_URL}/api/settings/messaging/${encodeURIComponent(channel)}`,
  settingsMessagingActive: (channel) =>
    `${API_BASE_URL}/api/settings/messaging/${encodeURIComponent(channel)}/active`,
  SETTINGS_LOYALTY: `${API_BASE_URL}/api/settings/loyalty`,
  settingsLoyaltyCustomer: (id) => `${API_BASE_URL}/api/settings/loyalty/customers/${id}`,
  settingsLoyaltyRedeem: (id) => `${API_BASE_URL}/api/settings/loyalty/customers/${id}/redeem`,
  SETTINGS_AUTOMATION: `${API_BASE_URL}/api/settings/automation`,
  SETTINGS_DIGEST_SEND: `${API_BASE_URL}/api/settings/automation/digest/send`,
  SETTINGS_AI: `${API_BASE_URL}/api/settings/ai`,
  SETTINGS_AI_ASK: `${API_BASE_URL}/api/settings/ai/ask`,
  // Copilot conversations — stored server-side, scoped to the signed-in user.
  SETTINGS_AI_THREADS: `${API_BASE_URL}/api/settings/ai/threads`,
  SETTINGS_AI_THREAD_ASK: `${API_BASE_URL}/api/settings/ai/threads/ask`,
  settingsAiThread: (id) => `${API_BASE_URL}/api/settings/ai/threads/${id}`,
  SETTINGS_PAYMENT_GATEWAYS: `${API_BASE_URL}/api/settings/payment-gateways`,
  settingsPaymentGatewayTest: (id) =>
    `${API_BASE_URL}/api/settings/payment-gateways/${encodeURIComponent(id)}/test`,
  SETTINGS_DOMAIN_SLUG: `${API_BASE_URL}/api/settings/domain/slug`,
  settingsMessagingTest: (channel, provider) =>
    `${API_BASE_URL}/api/settings/messaging/${encodeURIComponent(channel)}/${encodeURIComponent(provider)}/test`,
  SETTINGS_API_KEYS: `${API_BASE_URL}/api/settings/api-keys`,
  SETTINGS_WEBHOOK_SECRET: `${API_BASE_URL}/api/settings/api-keys/webhook-secret`,
  settingsRouterTheme: (deviceId) => `${API_BASE_URL}/api/settings/portal/router/${deviceId}`,
  settingsAnnouncement: (id) => `${API_BASE_URL}/api/settings/announcements/${id}`,
  settingsRadiusNas: (id) => `${API_BASE_URL}/api/settings/radius/nas/${id}`,
  settingsIntegration: (key) => `${API_BASE_URL}/api/settings/integrations/${key}`,
  settingsApiKey: (id) => `${API_BASE_URL}/api/settings/api-keys/${id}`,
  
  // RADIUS endpoints
  RADIUS_CLIENTS: `${API_BASE_URL}/api/radius/clients`,
  RADIUS_USERS: `${API_BASE_URL}/api/radius/users`,
  RADIUS_GROUPS: `${API_BASE_URL}/api/radius/groups`,
  RADIUS_ACCOUNTING: `${API_BASE_URL}/api/radius/accounting`,
  RADIUS_API: `${API_BASE_URL}/api/radius-api`,
  RADIUS_ROUTES: `${API_BASE_URL}/api/radius-routes`,
  RADIUS_TEST: `${API_BASE_URL}/api/radius/test`,
  
  // LDAP endpoints
  LDAP_SERVERS: `${API_BASE_URL}/api/ldap/servers`,
  LDAP_TEST: `${API_BASE_URL}/api/ldap/test`,
  LDAP_SYNC: `${API_BASE_URL}/api/ldap/sync`,
  
  // SNMP endpoints
  SNMP_DEVICES: `${API_BASE_URL}/api/snmp/devices`,
  SNMP_TEST: `${API_BASE_URL}/api/snmp/test`,
  SNMP_WALK: `${API_BASE_URL}/api/snmp/walk`,
  SNMP_GET: `${API_BASE_URL}/api/snmp/get`,
  SNMP_SET: `${API_BASE_URL}/api/snmp/set`,
  SNMP_TRAPS: `${API_BASE_URL}/api/snmp/traps`,
  
  // VPN endpoints
  VPN_CONFIGS: `${API_BASE_URL}/api/vpn/configs`,
  VPN_CLIENTS: `${API_BASE_URL}/api/vpn/clients`,
  VPN_STATUS: `${API_BASE_URL}/api/vpn/status`,
  VPN_GENERATE: `${API_BASE_URL}/api/vpn/generate`,

  // WireGuard (billing-integrated)
  WIREGUARD_SERVERS: `${API_BASE_URL}/api/wireguard/servers`,
  WIREGUARD_SYNC_STATS: `${API_BASE_URL}/api/wireguard/sync-stats`,
  wireguardServerPeers: (id) => `${API_BASE_URL}/api/wireguard/servers/${id}/peers`,
  wireguardServerConfig: (id) => `${API_BASE_URL}/api/wireguard/servers/${id}/config`,
  wireguardMikrotikScript: (id) => `${API_BASE_URL}/api/wireguard/servers/${id}/mikrotik-script`,
  wireguardProvisionCustomer: (id) => `${API_BASE_URL}/api/wireguard/customers/${id}/provision`,
  wireguardCustomerConfig: (id) => `${API_BASE_URL}/api/wireguard/customers/${id}/config`,
  wireguardCustomerQrcode: (id) => `${API_BASE_URL}/api/wireguard/customers/${id}/qrcode`,
  wireguardCustomerPeer: (id) => `${API_BASE_URL}/api/wireguard/customers/${id}/peer`,
  wireguardPeer: (id) => `${API_BASE_URL}/api/wireguard/peers/${id}`,
  wireguardPeerSyncMikrotik: (id) => `${API_BASE_URL}/api/wireguard/peers/${id}/sync-mikrotik`,
  wireguardServerSyncMikrotik: (id) => `${API_BASE_URL}/api/wireguard/servers/${id}/sync-mikrotik`,

  PORTAL_WIREGUARD_LOOKUP: `${API_BASE_URL}/api/portal/wireguard/lookup`,
  PORTAL_WIREGUARD_CONFIG: `${API_BASE_URL}/api/portal/wireguard/config`,
  PORTAL_WIREGUARD_QRCODE: `${API_BASE_URL}/api/portal/wireguard/qrcode`,
  
  // EAP endpoints
  EAP_PROFILES: `${API_BASE_URL}/api/eap/profiles`,
  EAP_TEST: `${API_BASE_URL}/api/eap/test`,
  
  // Billing endpoints
  BILLING_SUBSCRIPTIONS: `${API_BASE_URL}/api/billing/subscriptions`,
  BILLING_PAYMENTS: `${API_BASE_URL}/api/billing/payments`,
  BILLING_TRANSACTIONS: `${API_BASE_URL}/api/billing/transactions`,
  BILLING_REPORTS: `${API_BASE_URL}/api/billing/reports`,
  BILLING_VOUCHERS: `${API_BASE_URL}/api/billing/vouchers`,

  // M-Pesa payments
  MPESA_STK_PUSH: `${API_BASE_URL}/api/payments/mpesa/stk-push`,
  MPESA_STATUS: `${API_BASE_URL}/api/payments/mpesa/status`,

  // Captive portal (public)
  PORTAL_CONFIG: `${API_BASE_URL}/api/portal/config`,
  PORTAL_PLANS: `${API_BASE_URL}/api/portal/plans`,
  PORTAL_HOTSPOT_PURCHASE: `${API_BASE_URL}/api/portal/hotspot/purchase`,
  PORTAL_HOTSPOT_LOOKUP: `${API_BASE_URL}/api/portal/hotspot/lookup`,
  PORTAL_HOTSPOT_VOUCHER: `${API_BASE_URL}/api/portal/hotspot/voucher`,
  PORTAL_PPPOE_LOOKUP: `${API_BASE_URL}/api/portal/pppoe/lookup`,
  PORTAL_PPPOE_PAY: `${API_BASE_URL}/api/portal/pppoe/pay`,
  PORTAL_PAYMENT_STATUS: `${API_BASE_URL}/api/portal/payment/status`,

  // Dashboard & tickets
  DASHBOARD_STATS: `${API_BASE_URL}/api/dashboard/stats`,
  FUP_MONITOR: `${API_BASE_URL}/api/monitoring/fup`,
  MONITORING_ALERTS: `${API_BASE_URL}/api/monitoring/alerts`,
  reportEndpoint: (type) => `${API_BASE_URL}/api/reports/${type}`,
  FINANCE_LEADS: `${API_BASE_URL}/api/finance/leads`,
  FINANCE_EXPENSES: `${API_BASE_URL}/api/finance/expenses`,
  FINANCE_SUMMARY: `${API_BASE_URL}/api/finance/summary`,
  KYC: `${API_BASE_URL}/api/kyc`,
  KYC_STATS: `${API_BASE_URL}/api/kyc/stats`,
  INVOICE_STATS: `${API_BASE_URL}/api/invoices/stats`,
  TICKETS: `${API_BASE_URL}/api/tickets`,
  
  // Test endpoint
  TEST: `${API_BASE_URL}/api/test`,
};

export const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  'Authorization': token ? `Bearer ${token}` : '',
});

export default API_BASE_URL;
