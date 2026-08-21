import {
  BellRing, Boxes, Code2, CreditCard, Gift, Globe, Mail, MessageCircle,
  MessageSquare, Network, Palette, Plug, Radio, Receipt, ShieldCheck,
  Sparkles, User, Wifi,
} from 'lucide-react';

/* -------------------------------------------------------------------------
 * The Settings rail.
 *
 * One entry per panel, grouped the way an operator thinks about the job rather
 * than the way the endpoints happen to be split: what the business looks like,
 * what the network does, how money and messages move, who gets told, what is
 * plugged in, and who you are.
 *
 * `title`/`accent`/`lead` are the page header. `accent` must appear in `title`
 * exactly once — it is the word that gets the colour.
 * `keywords` only feed the search box; they never render.
 * ---------------------------------------------------------------------- */

export const SETTINGS_GROUPS = [
  {
    label: 'General',
    items: [
      {
        id: 'branding',
        name: 'Branding',
        sub: 'Identity, logo, colours',
        icon: Palette,
        title: 'Your brand',
        accent: 'brand',
        lead: 'The name, logo and colour subscribers see on the captive portal, on every receipt, and in each message you send. Set it once and it follows them everywhere.',
        keywords: ['logo', 'colour', 'color', 'theme', 'name', 'isp', 'retention', 'website', 'support phone'],
      },
      {
        id: 'domain',
        name: 'Domain',
        sub: 'Tenant URL & DNS',
        icon: Globe,
        title: 'Your domain',
        accent: 'domain',
        lead: 'Where subscribers reach your captive portal and their self-serve account. Your account address is permanent — point a domain you own at it to replace what they see.',
        keywords: ['url', 'dns', 'cname', 'subdomain', 'custom domain', 'address', 'hostname', 'ssl'],
      },
      {
        id: 'modules',
        name: 'Modules',
        sub: 'Features switched on',
        icon: Boxes,
        title: 'What is switched on',
        accent: 'switched on',
        lead: 'Turning a module off hides its whole surface — pages, menu entries and reports — for everyone in this workspace. Nothing is deleted.',
        keywords: ['pppoe', 'hotspot', 'reseller', 'enable', 'disable', 'features'],
      },
    ],
  },
  {
    label: 'Network',
    items: [
      {
        id: 'pppoe',
        name: 'PPPoE',
        sub: 'Fixed-line subscribers & FUP',
        icon: Network,
        title: 'Fixed-line over PPPoE',
        accent: 'PPPoE',
        lead: 'Username-and-password broadband for homes and offices on a wire. Speeds and fair-use live on the package; this is the switch and the map to the rest.',
        keywords: ['broadband', 'fup', 'fair use', 'fixed line', 'ppp', 'dsl', 'fibre', 'fiber'],
      },
      {
        id: 'hotspot',
        name: 'Hotspot',
        sub: 'Captive portal & vouchers',
        icon: Wifi,
        title: 'Your hotspot',
        accent: 'hotspot',
        lead: 'The page someone lands on before they have paid, the codes they type in, and how those codes are generated. Preview it against a real router as you go.',
        keywords: ['captive portal', 'voucher', 'code', 'walled garden', 'announcement', 'redirect', 'wifi'],
      },
      {
        id: 'radius',
        name: 'RADIUS',
        sub: 'Server, NAS clients, CoA',
        icon: Radio,
        title: 'Your RADIUS server',
        accent: 'RADIUS',
        lead: 'What every router authenticates against. Add a NAS client here before the router will be answered at all — an unknown client is dropped silently.',
        keywords: ['nas', 'coa', 'accounting', 'secret', 'freeradius', 'auth', 'disconnect'],
      },
    ],
  },
  {
    label: 'Billing & messaging',
    items: [
      {
        id: 'payments',
        name: 'Payments',
        sub: 'Payment gateways and credentials',
        icon: CreditCard,
        title: 'Payment gateways',
        accent: 'gateways',
        lead: 'Pick one gateway so subscribers can pay you. Only one is active at a time, and switching keeps the credentials the others already hold. M-Pesa details are worth checking twice — a wrong shortcode fails silently at 2am.',
        keywords: ['mpesa', 'daraja', 'paybill', 'till', 'bank', 'stk', 'c2b', 'gateway', 'currency'],
      },
      {
        id: 'sms',
        name: 'Communications',
        sub: 'SMS gateway',
        icon: MessageSquare,
        title: 'SMS providers',
        accent: 'providers',
        lead: 'The outbound gateway for receipts, expiry warnings and vouchers. Pick a provider and add its credentials — only one is active at a time, and everything falls back to the platform default.',
        keywords: ['sms', 'africastalking', 'sender id', 'shortcode', 'text', 'credit', 'balance'],
      },
      {
        id: 'email',
        name: 'Email',
        sub: 'SMTP gateway',
        icon: Mail,
        title: 'Your email gateway',
        accent: 'email',
        lead: 'Your own mail server, used for invoices and account email so messages arrive from your domain rather than ours.',
        keywords: ['smtp', 'mail', 'imap', 'from address', 'tls', 'port 587'],
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp',
        sub: 'WhatsApp gateway',
        icon: MessageCircle,
        title: 'WhatsApp providers',
        accent: 'providers',
        lead: 'A richer channel for receipts and reminders. Pick a provider to see the credentials it would need — only one can be active at a time. Not built yet.',
        keywords: ['whatsapp', 'meta', 'twilio', 'waba', 'template', 'business'],
      },
      {
        id: 'templates',
        name: 'Message templates',
        sub: 'Receipts, expiry & reminders',
        icon: Receipt,
        title: 'What you send subscribers',
        accent: 'send',
        lead: 'Every automatic message, per channel, with the wording under your control. Leave a template blank and the system default is used instead.',
        keywords: ['notification', 'receipt', 'reminder', 'welcome', 'expiry', 'template', 'variables', 'sms', 'email'],
      },
      {
        id: 'loyalty',
        name: 'Loyalty points',
        sub: 'Reward subscribers for payments',
        icon: Gift,
        title: 'Your loyalty scheme',
        accent: 'loyalty scheme',
        lead: 'Points earned on payment, spent against a renewal. Not built yet — the rules below are the ones the feature would need to agree on first.',
        keywords: ['points', 'reward', 'discount', 'redeem', 'referral', 'retention'],
      },
    ],
  },
  {
    label: 'Notifications',
    items: [
      {
        id: 'alerts',
        name: 'Operator alerts',
        sub: 'Router status & sales digests',
        icon: BellRing,
        title: 'Alerts for your team',
        accent: 'your team',
        lead: 'The messages addressed to whoever runs the network rather than to a subscriber — a router dropping, a digest of the day. Send them somewhere out-of-hours.',
        keywords: ['router', 'offline', 'digest', 'telegram', 'alert', 'downtime', 'health'],
      },
    ],
  },
  {
    label: 'Integrations',
    items: [
      {
        id: 'ai',
        name: 'AI Assistant',
        sub: 'Provider & API key',
        icon: Sparkles,
        title: 'Your AI assistant',
        accent: 'AI assistant',
        lead: 'Drafted ticket replies, plain-English router diagnoses, a written digest of the day. Not built yet — this panel settles what it would ask you for.',
        keywords: ['ai', 'anthropic', 'claude', 'model', 'assistant', 'api key', 'llm'],
      },
      {
        id: 'developer',
        name: 'Developer',
        sub: 'API tokens & webhooks',
        icon: Code2,
        title: 'Building on Lumen',
        accent: 'Lumen',
        lead: 'Keys for reading your own data out, and webhooks for hearing about events as they happen. The signing secret is what proves a delivery came from us.',
        keywords: ['api', 'token', 'key', 'webhook', 'secret', 'rest', 'integration', 'developer'],
      },
      {
        id: 'integrations',
        name: 'All integrations',
        sub: 'Everything connected',
        icon: Plug,
        title: 'Everything connected',
        accent: 'connected',
        lead: 'One list of every external service this workspace talks to, and which of them are actually switched on.',
        keywords: ['zapier', 'analytics', 'telegram', 'connect', 'services', 'third party'],
      },
    ],
  },
  {
    label: 'Account',
    items: [
      {
        id: 'profile',
        name: 'Profile',
        sub: 'Your name & contact',
        icon: User,
        title: 'Your profile',
        accent: 'profile',
        lead: 'Who you are signed in as. Your name goes on outgoing notifications, and your email is also how you sign in.',
        keywords: ['name', 'email', 'role', 'contact', 'me', 'user'],
      },
      {
        id: 'security',
        name: 'Password & 2FA',
        sub: 'Sign-in security',
        icon: ShieldCheck,
        title: 'Your sign-in security',
        accent: 'security',
        lead: 'A password you use nowhere else, and a second factor so a leaked one is not enough on its own.',
        keywords: ['password', '2fa', 'two factor', 'totp', 'authenticator', 'backup codes', 'login'],
      },
      {
        id: 'subscription',
        name: 'Subscription',
        sub: 'Your plan & invoices',
        icon: Boxes,
        title: 'Your Lumen plan',
        accent: 'plan',
        lead: 'What this workspace costs, what it includes, and how much of those limits you are using. Let it lapse and the console locks — your network keeps running.',
        keywords: ['plan', 'billing', 'invoice', 'quota', 'limits', 'upgrade', 'trial', 'expiry'],
      },
    ],
  },
];

/** Every item, flattened, with its group label attached. */
export const SETTINGS_ITEMS = SETTINGS_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
);

export const DEFAULT_TAB = 'branding';

/**
 * Tab ids that used to exist. Overview's setup checklist and the dashboard API
 * both hand out `/settings?tab=general`-style links, and those links outlive
 * any rename we do here, so they are resolved rather than 404'd to Branding.
 */
const ALIASES = {
  general: 'branding',
  portal: 'hotspot',
  captiveportal: 'hotspot',
  notifications: 'templates',
  apikeys: 'developer',
  webhooks: 'developer',
  account: 'profile',
  '2fa': 'security',
  password: 'security',
};

export function resolveTab(requested) {
  if (!requested) return DEFAULT_TAB;
  const id = String(requested).toLowerCase();
  if (SETTINGS_ITEMS.some((item) => item.id === id)) return id;
  return ALIASES[id] || DEFAULT_TAB;
}

export function findItem(id) {
  return SETTINGS_ITEMS.find((item) => item.id === id) || SETTINGS_ITEMS[0];
}

/** Substring match over everything an operator might plausibly type. */
export function searchItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  return SETTINGS_ITEMS.filter((item) =>
    [item.name, item.sub, item.group, ...(item.keywords || [])]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}
