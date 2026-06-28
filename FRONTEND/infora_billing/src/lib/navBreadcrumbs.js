const SEGMENT_LABELS = {
  clients: 'Clients',
  online: 'Online Users',
  new: 'New',
  edit: 'Edit',
  pppoe: 'PPPoE',
  hotspot: 'Hotspot',
  kyc: 'KYC',
  plans: 'Packages',
  fup: 'FUP Monitor',
  billing: 'Billing',
  payments: 'Payments',
  invoices: 'Invoices',
  transactions: 'Transactions',
  vouchers: 'Vouchers',
  subscriptions: 'Subscriptions',
  reports: 'Reports',
  tickets: 'Support',
  settings: 'Settings',
  devices: 'Devices',
  mikrotik: 'Mikrotik',
  equipment: 'Equipment',
  status: 'Status',
  backup: 'Backup',
  firmware: 'Firmware',
  network: 'Network',
  isps: 'ISPs',
  radius: 'RADIUS',
  ldap: 'LDAP',
  snmp: 'SNMP',
  vpn: 'VPN',
  wireguard: 'WireGuard',
  eap: 'EAP',
  finance: 'Finance',
  leads: 'Leads',
  expenses: 'Expenses',
  communication: 'Communication',
  sms: 'SMS',
  emails: 'Emails',
  campaigns: 'Campaigns',
  security: 'Security',
  monitoring: 'Monitoring',
  logs: 'Logs',
  alerts: 'Alerts',
  traffic: 'Traffic',
  '2fa': '2FA',
  users: 'Users',
  'bug-report': 'Bug Report',
  'contact-support': 'Contact Support',
};

function isNumericId(segment) {
  return /^\d+$/.test(segment);
}

export function buildBreadcrumbs(pathname) {
  if (pathname === '/' || pathname === '/dashboard') {
    return [{ label: 'Dashboard', path: '/' }];
  }

  const segments = pathname.split('/').filter(Boolean);
  const crumbs = [];
  let path = '';

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    path += `/${segment}`;

    if (isNumericId(segment)) {
      crumbs.push({ label: `#${segment}`, path });
      continue;
    }

    const label = SEGMENT_LABELS[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, path });
  }

  return crumbs;
}

export function breadcrumbPageTitle(pathname) {
  const crumbs = buildBreadcrumbs(pathname);
  return crumbs[crumbs.length - 1]?.label || 'Dashboard';
}
