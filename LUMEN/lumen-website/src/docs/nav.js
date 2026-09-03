/**
 * The documentation information architecture.
 *
 * One flat slug namespace (`/docs/<slug>`) with groups used purely for
 * presentation. Flat slugs keep every URL short and stable: moving a page
 * between groups is a sidebar edit, not a redirect.
 *
 * An item may carry `children`, which the sidebar renders as a collapsible
 * subtree. The parent is still a real page, not just a folder.
 */
export const NAV = [
  {
    group: 'Getting started',
    items: [
      { slug: 'introduction', title: 'Lumen Billing' },
      { slug: 'quickstart', title: 'Quickstart' },
      { slug: 'registration', title: 'Registration and provisioning' },
      { slug: 'account-security', title: 'Account security' },
      { slug: 'navigate', title: 'Navigate Lumen Billing' },
      { slug: 'settings', title: 'Settings' },
    ],
  },
  {
    group: 'Subscribers',
    items: [
      { slug: 'subscribers-overview', title: 'Subscribers overview' },
      { slug: 'create-subscribers', title: 'Create and manage subscribers' },
      { slug: 'subscriber-profile', title: 'Subscriber profile' },
      { slug: 'active-sessions', title: 'Active sessions' },
      { slug: 'ip-mac-bindings', title: 'IP and MAC bindings' },
      { slug: 'import-export', title: 'Subscriber import and export' },
      { slug: 'kyc', title: 'KYC and verification' },
      { slug: 'leads', title: 'Leads' },
      { slug: 'tickets', title: 'Support tickets' },
      { slug: 'staff', title: 'Staff and permissions' },
    ],
  },
  {
    group: 'Network and access',
    items: [
      { slug: 'routers-and-nas', title: 'Routers and NAS' },
      { slug: 'provision-router', title: 'Provision a router' },
      { slug: 'management-tunnel', title: 'The management tunnel' },
      { slug: 'router-health', title: 'Router health and diagnostics' },
      { slug: 'pppoe-hotspot', title: 'PPPoE and Hotspot' },
      { slug: 'packages', title: 'Packages' },
      { slug: 'captive-portal', title: 'Captive portal' },
      { slug: 'vouchers', title: 'Vouchers' },
      { slug: 'voucher-agents', title: 'Voucher agents' },
      { slug: 'multi-wan', title: 'Multi-WAN and failover' },
      { slug: 'equipment', title: 'Equipment inventory' },
      { slug: 'tr069', title: 'TR-069 and CPE' },
      { slug: 'fiber', title: 'Fiber plant and maps' },
      { slug: 'network-troubleshooting', title: 'Network troubleshooting' },
    ],
  },
  {
    group: 'Billing and finance',
    items: [
      { slug: 'subscription-renewal', title: 'Subscription and renewal' },
      { slug: 'payments', title: 'Payments' },
      { slug: 'invoices', title: 'Invoices' },
      { slug: 'fup', title: 'Fair use policy' },
      { slug: 'expenses', title: 'Expenses' },
      { slug: 'collections', title: 'Collections and withdrawals' },
      {
        slug: 'payment-gateways',
        title: 'Payment gateways',
        children: [
          { slug: 'mpesa', title: 'M-Pesa (Daraja)' },
          { slug: 'manual-payments', title: 'Cash, bank and manual' },
        ],
      },
    ],
  },
  {
    group: 'Communications',
    items: [
      { slug: 'communications-overview', title: 'Communications overview' },
      { slug: 'sms', title: 'SMS' },
      { slug: 'campaigns', title: 'Message campaigns' },
      { slug: 'promo-banners', title: 'Captive promo banners' },
      { slug: 'whatsapp', title: 'WhatsApp' },
      { slug: 'messaging-providers', title: 'Messaging providers and sender IDs' },
      { slug: 'notifications', title: 'Notifications and templates' },
    ],
  },
  {
    group: 'Analytics and operations',
    items: [
      { slug: 'dashboard-analytics', title: 'Dashboard and analytics' },
      { slug: 'monitoring', title: 'Monitoring and alerts' },
      { slug: 'audits-changelog', title: 'Audits and changelog' },
      { slug: 'search-imports-exports', title: 'Search, imports, and exports' },
    ],
  },
  {
    group: 'Customer portal',
    items: [
      { slug: 'portal-overview', title: 'Customer portal overview' },
      { slug: 'portal-access', title: 'Portal access and profile' },
      { slug: 'portal-packages', title: 'Packages, top-ups, and vouchers' },
      { slug: 'portal-usage', title: 'Usage, invoices, and receipts' },
      { slug: 'portal-tickets', title: 'Portal support tickets' },
    ],
  },
  {
    group: 'Reference and legal',
    items: [
      { slug: 'pricing', title: 'Pricing' },
      { slug: 'glossary', title: 'Glossary' },
      { slug: 'troubleshooting-index', title: 'Troubleshooting index' },
      { slug: 'support', title: 'Getting support' },
      { slug: 'privacy', title: 'Privacy Policy' },
      { slug: 'terms', title: 'Terms of Use' },
    ],
  },
];

/** Depth-first walk, so nested children keep their reading order. */
function walk(items, group, out = []) {
  for (const item of items) {
    out.push({ slug: item.slug, title: item.title, group });
    if (item.children) walk(item.children, group, out);
  }
  return out;
}

/** Every page in sidebar order — the sequence prev/next walks. */
export const FLAT = NAV.flatMap((section) => walk(section.items, section.group));

export const BY_SLUG = Object.fromEntries(FLAT.map((item) => [item.slug, item]));

export const FIRST_SLUG = FLAT[0].slug;

/** The slug of a nested child's parent, so the sidebar can auto-expand it. */
export const PARENT_OF = Object.fromEntries(
  NAV.flatMap((section) =>
    section.items.flatMap((item) =>
      (item.children || []).map((child) => [child.slug, item.slug]),
    ),
  ),
);

/** The pages either side of `slug`, for the footer links. */
export function neighbours(slug) {
  const index = FLAT.findIndex((item) => item.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? FLAT[index - 1] : null,
    next: index < FLAT.length - 1 ? FLAT[index + 1] : null,
  };
}
