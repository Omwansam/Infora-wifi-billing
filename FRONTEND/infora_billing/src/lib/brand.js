export const BRAND = {
  name: 'Lumen',
  companyName: 'Lumen',
  tagline: 'WiFi Billing',
  fullName: 'Lumen WiFi Billing',
  portalTagline: 'Fast, reliable internet for home and business',
  portalAbout:
    'Lumen connects homes and businesses across Kenya with affordable broadband. Pay with M-Pesa and get online in seconds.',
  description: 'Illuminate your network — connect, bill, and grow.',
  supportEmail: 'support@lumen.app',
  adminEmail: 'admin@lumen.app',
  website: 'https://lumen.app',
  copyright: (year = new Date().getFullYear()) => `© ${year} Lumen. All rights reserved.`,
};

/** Strip legacy Infora naming from API/DB strings shown in the UI. */
export function sanitizeBrandText(value, fallback = BRAND.name) {
  if (!value || typeof value !== 'string') return fallback;
  const cleaned = value
    .replace(/Infora WiFi Billing System/gi, BRAND.fullName)
    .replace(/Infora WiFi Solutions/gi, BRAND.companyName)
    .replace(/Infora WiFi/gi, BRAND.name)
    .replace(/Infora/gi, BRAND.name)
    .replace(/Default Company/gi, BRAND.companyName)
    .trim();
  return cleaned || fallback;
}

export function portalCompanyName(config) {
  return sanitizeBrandText(config?.company_name || config?.name, BRAND.companyName);
}

export const STORAGE_KEYS = {
  user: 'lumen_user',
  sidebarCollapsed: 'lumen-sidebar-collapsed',
};

/** @deprecated legacy keys — read once for migration */
export const LEGACY_STORAGE_KEYS = {
  user: 'infora_user',
  sidebarCollapsed: 'infora-sidebar-collapsed',
};
