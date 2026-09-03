export default {
  introduction: {
    title: 'Lumen Billing',
    description: 'Operate subscribers, network access, billing, and customer service from one ISP platform.',
    blocks: [
      { t: 'h2', text: 'Run your ISP with Lumen Billing' },
      { t: 'p', text: 'Lumen Billing brings subscriber management, network access, payments, communications, and reporting into one workspace. It supports ISP workflows built around MikroTik NAS devices, RADIUS-backed PPPoE and Hotspot access, recurring billing, vouchers, and subscriber self-service.' },
      { t: 'p', text: 'This guide documents the current billing application. Screens, fields, and capabilities can vary by your role, country, configured services, payment gateway, and enabled account features.' },
      { t: 'cards', items: [
        { icon: 'rocket', title: 'Get operational', text: 'Secure the operator account, configure your ISP, create a package, and provision a router.', to: '/docs/quickstart' },
        { icon: 'users', title: 'Manage subscribers', text: 'Create and support Hotspot, PPPoE, and binding subscribers throughout their lifecycle.', to: '/docs/subscribers-overview' },
        { icon: 'router', title: 'Connect the network', text: 'Add a MikroTik, open the management tunnel, and push Hotspot or PPPoE service config.', to: '/docs/routers-and-nas' },
        { icon: 'card', title: 'Collect and reconcile', text: 'Take M-Pesa, cash and bank payments, raise invoices, and reconcile every shilling.', to: '/docs/payments' },
      ] },

      { t: 'h2', text: 'Core operating areas' },
      { t: 'h3', text: 'Subscribers and customer service' },
      { t: 'p', text: 'Everything about the people who pay you. Create subscribers on Hotspot, PPPoE or static bindings; look up an account by name, phone, RADIUS login or account number; read a live session; verify identity documents; and answer support tickets from the same profile. See [Subscribers overview](/docs/subscribers-overview).' },
      { t: 'h3', text: 'Network and access' },
      { t: 'p', text: 'Everything that decides whether a subscriber gets online. Add MikroTik routers as NAS devices, provision them over an encrypted management tunnel, publish Hotspot and PPPoE services, define packages that become RADIUS attributes, and keep uplinks alive with multi-WAN failover. See [Routers and NAS](/docs/routers-and-nas).' },
      { t: 'h3', text: 'Billing and finance' },
      { t: 'p', text: 'Everything that turns access into revenue. Recurring subscriptions and renewals, invoices, M-Pesa and manual payments, expenses, and the collections view that tells you who is overdue. See [Payments](/docs/payments).' },
      { t: 'h3', text: 'Communications and reporting' },
      { t: 'p', text: 'Everything you send and everything you measure. SMS and email templates, bulk campaigns, captive-portal promo banners, plus dashboards and exports across billing, network and subscriber health. See [Communications overview](/docs/communications-overview).' },

      { t: 'h2', text: 'Before you begin' },
      { t: 'p', text: 'Have these ready. Each one blocks a later step if it is missing.' },
      { t: 'ul', items: [
        'A **MikroTik router** running RouterOS 6 or 7, reachable from the internet or able to dial out to the management tunnel.',
        'The router’s **admin credentials** and the WAN port it uses for its uplink.',
        'A **public hostname** for your Lumen instance, so routers and payment callbacks can reach it.',
        'Your **payment credentials** — for M-Pesa, a Safaricom Daraja app with a shortcode and passkey.',
        'An **SMS sender ID** if you intend to notify subscribers automatically.',
      ] },
      { t: 'callout', kind: 'note', title: 'You can start without all of it', text: 'Only the router and admin credentials are needed to get a subscriber online. Payments and SMS can be configured later from [Settings](/docs/settings) without touching the network.' },

      { t: 'h2', text: 'Recommended path' },
      { t: 'steps', items: [
        { title: 'Secure the operator account', text: 'Set a strong password and turn on two-factor authentication before you add staff. See [Account security](/docs/account-security).' },
        { title: 'Configure your ISP profile', text: 'Name, currency, timezone and contact details — these appear on invoices and subscriber messages.' },
        { title: 'Create your first package', text: 'A package is the speed, price and validity a subscriber buys. See [Packages](/docs/packages).' },
        { title: 'Add and provision a router', text: 'Register the NAS, open the management tunnel, then push Hotspot or PPPoE service config. See [Provision a router](/docs/provision-router).' },
        { title: 'Create a test subscriber', text: 'Put one account on the network end to end before you migrate anybody real.' },
        { title: 'Connect a payment gateway', text: 'Wire up M-Pesa so renewals collect themselves. See [M-Pesa (Daraja)](/docs/mpesa).' },
      ] },
    ],
  },

  quickstart: {
    title: 'Quickstart',
    description: 'Get from an empty account to one paying subscriber online, in about thirty minutes.',
    blocks: [
      { t: 'p', text: 'This walkthrough assumes a fresh Lumen account and one MikroTik router you are free to reconfigure. Do not run it against a router already carrying live subscribers — provisioning rewrites interface, firewall and RADIUS configuration.' },
      { t: 'callout', kind: 'warning', title: 'Use a lab router first', text: 'Provisioning reclaims WAN ports from bridges and rewrites firewall rules. Practise on a spare device before you point Lumen at the router your customers depend on.' },

      { t: 'h2', text: '1. Secure the account' },
      { t: 'p', text: 'Sign in, open **Settings → Security**, and enable two-factor authentication on the operator account. Everything below can create or cancel service for paying customers, so this is not optional in production.' },

      { t: 'h2', text: '2. Set up your ISP profile' },
      { t: 'p', text: 'In **Settings**, fill in your business name, currency, timezone and support contacts. These values are substituted into invoices, receipts and the default SMS templates, so getting them right now saves reissuing documents later.' },

      { t: 'h2', text: '3. Create a package' },
      { t: 'p', text: 'Go to **Packages** and create one plan — for example a 10 Mbps home plan at a monthly price. The package carries the speed limit, the price and the validity period, and Lumen turns it into the RADIUS attributes the router enforces.' },
      { t: 'p', text: 'Full detail in [Packages](/docs/packages).' },

      { t: 'h2', text: '4. Add the router' },
      { t: 'p', text: 'Go to **Devices → MikroTik** and add the router: give it a name, its address, and the admin credentials. Lumen uses these to log in over SSH and read the interface list.' },
      { t: 'callout', kind: 'warning', title: 'Restart RADIUS after adding a device', text: 'A newly added NAS is unknown to FreeRADIUS until its client entry is regenerated and the service reloads. Until then every authentication from that router is silently dropped as an unknown client — no reject, no log line in the app.' },

      { t: 'h2', text: '5. Provision it' },
      { t: 'p', text: 'Run the provisioning wizard. It opens the management tunnel, assigns port roles (which port is WAN, which ports are LAN), and pushes the service configuration for Hotspot or PPPoE. Follow [Provision a router](/docs/provision-router) — it explains each step and what to check when one fails.' },

      { t: 'h2', text: '6. Create a test subscriber' },
      { t: 'p', text: 'Create one subscriber on the package you made, then connect a phone or laptop through the router and authenticate. Watch **Subscribers → Active sessions**: a successful login appears there within seconds, with the NAS it came from and the IP it was given.' },
      { t: 'callout', kind: 'tip', title: 'This is the real test', text: 'A subscriber that appears in Active sessions has proven the whole chain — router config, RADIUS, the package attributes and the subscriber record. If it works here it will work for everyone else.' },

      { t: 'h2', text: '7. Connect payments' },
      { t: 'p', text: 'Add your Daraja credentials under **Settings → Payments** so subscribers can pay by M-Pesa and renewals collect themselves. See [M-Pesa (Daraja)](/docs/mpesa).' },

      { t: 'h2', text: 'What to do next' },
      { t: 'cards', items: [
        { icon: 'users', title: 'Migrate your subscribers', text: 'Import an existing base from CSV or pull it straight off the router.', to: '/docs/import-export' },
        { icon: 'bolt', title: 'Automate messaging', text: 'Turn on renewal reminders and payment receipts.', to: '/docs/notifications' },
        { icon: 'shield', title: 'Add your staff', text: 'Invite technicians and cashiers with scoped permissions.', to: '/docs/staff' },
        { icon: 'router', title: 'Protect the uplink', text: 'Add a second line with failover before an outage finds you.', to: '/docs/multi-wan' },
      ] },
    ],
  },

  registration: {
    title: 'Registration and provisioning',
    description: 'How an ISP account is created, verified, and provisioned on the platform.',
    blocks: [
      { t: 'h2', text: 'Creating an account' },
      { t: 'p', text: 'Registration runs as a guided wizard rather than a single form. It collects a verified phone number, your business address, your locale, and a password, then provisions the workspace behind the scenes.' },
      { t: 'steps', items: [
        { title: 'Phone verification', text: 'You enter a WhatsApp-capable number and confirm the one-time code sent to it. The number becomes the account’s primary recovery channel.' },
        { title: 'Account address', text: 'Business name and physical address. These print on invoices and receipts.' },
        { title: 'Locale', text: 'Country, currency and timezone. Currency cannot be changed after billing documents exist, so choose carefully.' },
        { title: 'Password', text: 'Sets the operator credential. Two-factor authentication is configured afterwards from Settings.' },
        { title: 'Provisioning', text: 'The workspace, its database records and its RADIUS scaffolding are created. This is automatic and usually finishes in under a minute.' },
      ] },
      { t: 'callout', kind: 'warning', title: 'Currency is effectively permanent', text: 'Once invoices, payments or subscriptions exist in a currency, changing it would silently restate historical amounts. Set it correctly during registration.' },

      { t: 'h2', text: 'What gets provisioned' },
      { t: 'p', text: 'A new account is not empty. Provisioning creates the tenant record, an initial operator user, the RADIUS server scaffolding your routers will authenticate against, and the default notification templates.' },
      { t: 'fields', items: [
        { name: 'ISP profile', type: 'record', text: 'Your business identity — name, address, currency, timezone, support contacts.' },
        { name: 'Operator user', type: 'record', text: 'The first account, with full permissions. Add staff from [Staff and permissions](/docs/staff).' },
        { name: 'RADIUS scaffolding', type: 'service', text: 'The groups and client configuration your NAS devices authenticate against.' },
        { name: 'Notification templates', type: 'records', text: 'Default SMS and email bodies for renewals, receipts and expiry warnings.' },
      ] },

      { t: 'h2', text: 'Platform subscription' },
      { t: 'p', text: 'Your Lumen account itself is billed on a subscription. This is separate from the money your subscribers pay you: it is what you pay to run the platform.' },
      { t: 'callout', kind: 'note', title: 'Your network keeps running', text: 'If a platform subscription lapses, console access is restricted — but RADIUS, the routers and your subscribers’ connectivity are never interrupted. Losing access to the dashboard must never take your customers offline.' },
      { t: 'p', text: 'See [Subscription and renewal](/docs/subscription-renewal) and [Pricing](/docs/pricing).' },
    ],
  },

  'account-security': {
    title: 'Account security',
    description: 'Protect the operator account, enforce two-factor authentication, and audit who did what.',
    blocks: [
      { t: 'p', text: 'A Lumen operator account can disconnect subscribers, change prices, issue refunds and reconfigure routers. Treat it with the same care as your bank login.' },

      { t: 'h2', text: 'Two-factor authentication' },
      { t: 'p', text: 'Enable 2FA under **Settings → Security**. Lumen uses time-based one-time passwords, so any standard authenticator app works — Google Authenticator, Authy, 1Password, Bitwarden.' },
      { t: 'steps', items: [
        { title: 'Open Settings → Security', text: 'Find the two-factor authentication card.' },
        { title: 'Scan the QR code', text: 'Add the account to your authenticator app.' },
        { title: 'Confirm with a code', text: 'Enter the current six-digit code to prove the app is synced. 2FA is not active until this succeeds.' },
        { title: 'Store the recovery codes', text: 'Save them somewhere that is not the phone running the authenticator. They are the only way back in if you lose the device.' },
      ] },
      { t: 'callout', kind: 'danger', title: 'Recovery codes are shown once', text: 'They are not retrievable later. If you lose both the authenticator and the codes, recovery requires support intervention and proof of account ownership.' },

      { t: 'h2', text: 'Passwords' },
      { t: 'ul', items: [
        'Use a unique password that exists nowhere else — password reuse is how most operator accounts are actually lost.',
        'Change it immediately if a staff member with access leaves.',
        'Reset from the login screen; the link is sent to the account’s verified address.',
      ] },

      { t: 'h2', text: 'Staff accounts and least privilege' },
      { t: 'p', text: 'Do not share the operator login. Create a user per person and give each the narrowest role that lets them work — a cashier does not need to reconfigure routers, and a field technician does not need to issue refunds. See [Staff and permissions](/docs/staff).' },

      { t: 'h2', text: 'Audit trail' },
      { t: 'p', text: 'Sensitive actions are recorded with the user, the timestamp and what changed. Review them under **Settings → Logs** when an amount or a configuration is not what you expected. See [Audits and changelog](/docs/audits-changelog).' },

      { t: 'h2', text: 'Router credentials' },
      { t: 'p', text: 'Lumen stores the admin credentials for each NAS so it can push configuration. Give it a dedicated router user rather than the shared admin account, so router access can be revoked independently of your own.' },
      { t: 'callout', kind: 'warning', title: 'Never expose the router’s admin port to the internet', text: 'Use the management tunnel instead. It reaches the router without publishing SSH or the web interface to the world. See [The management tunnel](/docs/management-tunnel).' },
    ],
  },

  navigate: {
    title: 'Navigate Lumen Billing',
    description: 'A map of the console — what lives where, and which screen answers which question.',
    blocks: [
      { t: 'p', text: 'The console is organised by what you are trying to do, not by the underlying data model. This page is the map.' },

      { t: 'h2', text: 'The main areas' },
      { t: 'table', head: ['Area', 'What it answers', 'Start at'], rows: [
        ['Dashboard', 'How is the business doing right now?', '[Dashboard and analytics](/docs/dashboard-analytics)'],
        ['Subscribers', 'Who are my customers and what is their state?', '[Subscribers overview](/docs/subscribers-overview)'],
        ['Devices', 'Are my routers healthy and correctly configured?', '[Routers and NAS](/docs/routers-and-nas)'],
        ['Packages', 'What am I selling and at what speed?', '[Packages](/docs/packages)'],
        ['Billing', 'Who paid, who owes, and what did I invoice?', '[Payments](/docs/payments)'],
        ['Communication', 'What did I send my subscribers?', '[Communications overview](/docs/communications-overview)'],
        ['Reports', 'What happened over time?', '[Dashboard and analytics](/docs/dashboard-analytics)'],
        ['Settings', 'How is the platform itself configured?', '[Settings](/docs/settings)'],
      ] },

      { t: 'h2', text: 'Finding a subscriber fast' },
      { t: 'p', text: 'Most support calls start with a person, not a screen. The subscriber search accepts several identifiers, so use whichever the caller can give you.' },
      { t: 'ul', items: [
        'Name or phone number — what a caller usually offers first.',
        '**Account number** — printed on their invoice and receipts.',
        '**RADIUS login** — the username the router authenticates, useful when reading router logs.',
        'Email address, where one is recorded.',
      ] },
      { t: 'callout', kind: 'tip', title: 'Working backwards from the router', text: 'If you have a username from a RouterOS log, search by RADIUS login rather than name. It maps directly to the account even when the display name is spelled differently.' },

      { t: 'h2', text: 'Status vocabulary' },
      { t: 'p', text: 'The same words appear across the console and mean the same thing everywhere.' },
      { t: 'fields', items: [
        { name: 'Active', type: 'subscriber', text: 'Paid, within validity, and permitted on the network.' },
        { name: 'Expired', type: 'subscriber', text: 'Validity has run out. RADIUS refuses new sessions until renewal.' },
        { name: 'Suspended', type: 'subscriber', text: 'Manually blocked by staff, independent of payment state.' },
        { name: 'Online', type: 'session', text: 'A live RADIUS accounting session exists right now.' },
        { name: 'Offline', type: 'session', text: 'No live session. Not the same as expired — a paid subscriber is offline whenever their equipment is off.' },
        { name: 'Throttled', type: 'session', text: 'Still online but speed-limited, usually by a fair-use policy.' },
      ] },

      { t: 'h2', text: 'Keyboard and search' },
      { t: 'p', text: 'In this documentation, press `Ctrl` + `K` (or `/`) to search every page. In the console itself, the global search box accepts the same subscriber identifiers listed above.' },
    ],
  },

  settings: {
    title: 'Settings',
    description: 'Where the platform itself is configured — identity, payments, messaging, users and integrations.',
    blocks: [
      { t: 'p', text: 'Settings is grouped by subsystem. Changes take effect immediately unless the page says otherwise; some network-facing changes additionally require re-running **Configure services** on affected routers.' },

      { t: 'h2', text: 'Business profile' },
      { t: 'p', text: 'Your ISP identity: trading name, address, currency, timezone, logo and support contacts. These are substituted into invoices, receipts, the captive portal and every message template, so they are the first thing to get right.' },

      { t: 'h2', text: 'Payments' },
      { t: 'p', text: 'Payment gateway credentials and your collection details — paybill, buygoods till, or bank account. See [Payment gateways](/docs/payment-gateways).' },
      { t: 'callout', kind: 'warning', title: 'Per-ISP credentials win over platform defaults', text: 'Credentials saved here take precedence over any platform-level environment configuration. That is deliberate — it stops a shared default silently routing your collections somewhere else — but it also means a half-filled form is used as-is rather than falling back.' },

      { t: 'h2', text: 'Communications' },
      { t: 'p', text: 'SMS gateway, sender ID and SMTP credentials. Resolution is all-or-nothing per source: a partially filled tenant configuration falls back to the platform one as a whole, never blended field by field.' },
      { t: 'callout', kind: 'note', title: 'Why blending would be worse', text: 'Mixing your SMTP host with a platform password produces an authentication error that reads exactly like a wrong password, and sends operators hunting the wrong problem. All-or-nothing fails clearly instead.' },
      { t: 'p', text: 'Both integrations have a test action that performs a real send and returns the gateway’s own refusal text, which is far more useful than a generic failure. See [Messaging providers and sender IDs](/docs/messaging-providers).' },

      { t: 'h2', text: 'Users and roles' },
      { t: 'p', text: 'Invite staff, assign roles and revoke access. See [Staff and permissions](/docs/staff).' },

      { t: 'h2', text: 'Security' },
      { t: 'p', text: 'Two-factor authentication and password policy. See [Account security](/docs/account-security).' },

      { t: 'h2', text: 'Logs' },
      { t: 'p', text: 'The audit trail of who changed what, and the system log for diagnosing failed sends and pushes. See [Audits and changelog](/docs/audits-changelog).' },

      { t: 'h2', text: 'Network services' },
      { t: 'p', text: 'RADIUS, LDAP, SNMP, VPN and EAP configuration for operators running those services. Most ISPs never need to change the defaults — Lumen configures RADIUS itself during provisioning.' },
    ],
  },
};
