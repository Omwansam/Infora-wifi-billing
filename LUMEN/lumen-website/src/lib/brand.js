export const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173';
export const DEMO_URL = import.meta.env.VITE_DEMO_URL || APP_URL;

export const BRAND = {
  name: 'Lumen',
  fullName: 'Lumen WiFi Billing',
  tagline: 'Connect. Bill. Grow.',
  description:
    'Lumen helps local ISPs grow their business by automating billing, payments, and network management — so you can focus on what matters most: customer support and satisfaction.',
  supportEmail: 'support@lumen.app',
  salesEmail: 'sales@lumen.app',
  website: 'https://lumen.app',
  whatsapp: '+254700000000',
  appUrl: APP_URL,
  signupUrl: `${APP_URL}/signup`,
  loginUrl: `${APP_URL}/login`,
  demoUrl: DEMO_URL,
  // Portal preview opens the demo's captive portal — safe to explore,
  // never the production portal.
  portalUrl: `${DEMO_URL}/portal`,
  copyright: (year = new Date().getFullYear()) =>
    `© ${year} Lumen. All rights reserved.`,
};

export const STATS = [
  { value: '500+', label: 'ISPs Worldwide' },
  { value: '2M+', label: 'Subscribers Managed' },
  { value: '99.9%', label: 'Uptime SLA' },
  { value: '14', label: 'Day Free Trial' },
];

export const CHANGELOG_FALLBACK = [
  {
    version: 'v2.4.0',
    date: 'Jun 2026',
    tag: 'Latest',
    title: 'Customer KYC & verification workflow',
    items: [
      'Document upload and admin review for subscriber onboarding',
      'KYC status badges across customer list and detail views',
    ],
  },
  {
    version: 'v2.3.0',
    date: 'May 2026',
    tag: 'Feature',
    title: 'M-Pesa STK Push & payment reconciliation',
    items: [
      'Real-time M-Pesa payment callbacks with instant activation',
      'Unified payments ledger across hotspot and PPPoE',
    ],
  },
];
