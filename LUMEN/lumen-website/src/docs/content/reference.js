export default {
  pricing: {
    title: 'Pricing',
    description: 'How the Lumen platform subscription is charged, and how it relates to what you charge.',
    blocks: [
      { t: 'callout', kind: 'note', title: 'Two different prices', text: 'This page is about what **you** pay to run Lumen. What your subscribers pay you is set in [Packages](/docs/packages) and is entirely yours.' },

      { t: 'h2', text: 'How the platform is billed' },
      { t: 'p', text: 'Your Lumen account runs on a subscription with a recurring fee and a billing period. Current plans, inclusions and prices are shown under **Subscription** in the console, which is always authoritative — pricing changes over time and a documentation page is the wrong place to promise a number.' },

      { t: 'h2', text: 'What happens if it lapses' },
      { t: 'callout', kind: 'warning', title: 'Your subscribers are never cut off', text: 'A lapsed platform subscription restricts your access to the console. It does not touch RADIUS, your routers, or any subscriber session. A commercial dispute between you and Lumen must never take your customers offline, and by design it cannot.' },
      { t: 'p', text: 'Practically, that means you may temporarily lose the ability to add subscribers or change configuration while the network continues serving everyone already on it. Restoring the subscription restores access.' },

      { t: 'h2', text: 'Managing it' },
      { t: 'ul', items: [
        'View your plan, next billing date and invoice history under **Subscription**.',
        'Platform invoices are separate from the invoices you issue your own subscribers.',
        'Changing plan takes effect according to the terms shown at the time of change.',
      ] },
      { t: 'p', text: 'See [Subscription and renewal](/docs/subscription-renewal).' },

      { t: 'h2', text: 'Pricing your own service' },
      { t: 'p', text: 'The platform fee is one of your costs, alongside bandwidth, power and staff. To know whether your pricing works, compare revenue per subscriber against cost per subscriber — both are in [Dashboard and analytics](/docs/dashboard-analytics), and the gap between them is the only margin figure that means anything.' },
    ],
  },

  glossary: {
    title: 'Glossary',
    description: 'The terms used throughout this documentation and in the console.',
    blocks: [
      { t: 'h2', text: 'Network' },
      { t: 'fields', items: [
        { name: 'NAS', type: 'Network Access Server', text: 'The router that admits or refuses subscribers. In Lumen this is normally a MikroTik. See [Routers and NAS](/docs/routers-and-nas).' },
        { name: 'RADIUS', type: 'protocol', text: 'The protocol routers use to ask "may this subscriber connect, and at what speed". Fails silently when misconfigured, which is why so much troubleshooting starts there.' },
        { name: 'PPPoE', type: 'access method', text: 'Point-to-Point Protocol over Ethernet. The subscriber’s router dials in with a username and password and reconnects unattended.' },
        { name: 'Hotspot', type: 'access method', text: 'Browser-based login through a captive portal. Per device rather than per premises.' },
        { name: 'Captive portal', type: 'page', text: 'The login page shown when a device joins the Hotspot. See [Captive portal](/docs/captive-portal).' },
        { name: 'Walled garden', type: 'allowlist', text: 'Destinations an unauthenticated user may still reach — the portal itself and your payment gateway.' },
        { name: 'CPE', type: 'Customer Premises Equipment', text: 'The router or ONT in the subscriber’s home. Managed by TR-069 rather than the management tunnel.' },
        { name: 'ONT', type: 'device', text: 'Optical Network Terminal — the device converting fibre to Ethernet at the customer.' },
        { name: 'Management tunnel', type: 'connection', text: 'The encrypted path Lumen uses to configure routers without exposing them. See [The management tunnel](/docs/management-tunnel).' },
        { name: 'Multi-WAN', type: 'configuration', text: 'Two or more uplinks sharing load or providing failover. See [Multi-WAN and failover](/docs/multi-wan).' },
      ] },

      { t: 'h2', text: 'Subscribers' },
      { t: 'fields', items: [
        { name: 'Subscriber', type: 'record', text: 'One paying relationship — the person, their package, credentials and history.' },
        { name: 'Account number', type: 'identifier', text: 'The customer-facing reference, printed on invoices and quoted when paying.' },
        { name: 'RADIUS login', type: 'identifier', text: 'The username the router authenticates. What appears in router logs.' },
        { name: 'Binding', type: 'access method', text: 'Access granted by IP or MAC address with no login. See [IP and MAC bindings](/docs/ip-mac-bindings).' },
        { name: 'Session', type: 'record', text: 'One period of being connected, recorded by RADIUS accounting.' },
        { name: 'Active', type: 'status', text: 'Paid and within validity. Not the same as online.' },
        { name: 'Expired', type: 'status', text: 'Validity has run out; new sessions are refused.' },
        { name: 'Suspended', type: 'status', text: 'Blocked by staff, independent of payment.' },
      ] },

      { t: 'h2', text: 'Billing' },
      { t: 'fields', items: [
        { name: 'Package', type: 'product', text: 'What you sell — speed, price and validity. See [Packages](/docs/packages).' },
        { name: 'Validity', type: 'duration', text: 'How long one purchase lasts. Extended from the existing expiry, not from the payment date.' },
        { name: 'Voucher', type: 'code', text: 'A prepaid code granting access when redeemed. See [Vouchers](/docs/vouchers).' },
        { name: 'FUP', type: 'Fair Use Policy', text: 'A data allowance after which a subscriber is throttled rather than disconnected. See [Fair use policy](/docs/fup).' },
        { name: 'STK push', type: 'M-Pesa flow', text: 'A prompt sent to the customer’s phone to authorise payment with their PIN.' },
        { name: 'Paybill', type: 'M-Pesa account', text: 'Takes an account number, so payments match to a subscriber automatically.' },
        { name: 'Buygoods', type: 'M-Pesa account', text: 'A till number with no account field — payments must be matched by hand.' },
        { name: 'ARPU', type: 'metric', text: 'Average revenue per subscriber. Compare against cost per subscriber for real margin.' },
        { name: 'Churn', type: 'metric', text: 'The proportion of subscribers leaving in a period.' },
      ] },
    ],
  },

  'troubleshooting-index': {
    title: 'Troubleshooting index',
    description: 'Symptoms, in plain language, pointing at the page that explains them.',
    blocks: [
      { t: 'p', text: 'Find the symptom, follow the link. Where several entries look similar, the differences between them are the diagnosis.' },

      { t: 'h2', text: 'Nobody can connect' },
      { t: 'table', head: ['Symptom', 'Likely cause', 'Page'], rows: [
        ['A newly added router authenticates nobody', 'RADIUS not reloaded — the device is an unknown client and is dropped silently', '[Routers and NAS](/docs/routers-and-nas)'],
        ['Email-style usernames time out, plain ones work', 'RADIUS realm handling splitting on the @', '[PPPoE and Hotspot](/docs/pppoe-hotspot)'],
        ['Authentication fails estate-wide', 'RADIUS path, or shared secret', '[Network troubleshooting](/docs/network-troubleshooting)'],
      ] },

      { t: 'h2', text: 'One subscriber cannot connect' },
      { t: 'table', head: ['Symptom', 'Likely cause', 'Page'], rows: [
        ['Refused, account looks fine', 'Expired, suspended, or at their session limit', '[Subscriber profile](/docs/subscriber-profile)'],
        ['Connects then drops within seconds', 'Hotspot service capturing PPPoE ports on the same interface', '[PPPoE and Hotspot](/docs/pppoe-hotspot)'],
        ['Two subscribers disconnecting each other', 'Duplicate PPPoE username', '[Create and manage subscribers](/docs/create-subscribers)'],
        ['A bound device stopped working', 'Randomised MAC, or the DHCP lease changed', '[IP and MAC bindings](/docs/ip-mac-bindings)'],
      ] },

      { t: 'h2', text: 'Payments' },
      { t: 'table', head: ['Symptom', 'Likely cause', 'Page'], rows: [
        ['Customer paid, nothing in the ledger', 'Callback never reached Lumen', '[M-Pesa (Daraja)](/docs/mpesa)'],
        ['Worked in sandbox, fails live', 'Sandbox credentials, or environment not switched with them', '[M-Pesa (Daraja)](/docs/mpesa)'],
        ['Payment works for staff, not from the portal', 'Gateway missing from the walled garden', '[Captive portal](/docs/captive-portal)'],
        ['Payment applied to the wrong subscriber', 'Wrong account number quoted at payment', '[Payments](/docs/payments)'],
      ] },

      { t: 'h2', text: 'Routers' },
      { t: 'table', head: ['Symptom', 'Likely cause', 'Page'], rows: [
        ['Router unreachable, subscribers still online', 'Management tunnel down; data plane unaffected', '[The management tunnel](/docs/management-tunnel)'],
        ['Push succeeded but nothing changed', 'Applied but not verified — RouterOS accepted invalid rules', '[Provision a router](/docs/provision-router)'],
        ['"Cannot run on slave interface"', 'A WAN port is still in a bridge', '[Provision a router](/docs/provision-router)'],
        ['Router lost its default route after a WAN change', 'Failed multi-WAN push; wait for the rollback', '[Multi-WAN and failover](/docs/multi-wan)'],
        ['Uptime keeps resetting', 'Site power', '[Router health and diagnostics](/docs/router-health)'],
      ] },

      { t: 'h2', text: 'Messaging' },
      { t: 'table', head: ['Symptom', 'Likely cause', 'Page'], rows: [
        ['No SMS ever arrives', 'No gateway configured — messages are logged, not sent', '[Messaging providers](/docs/messaging-providers)'],
        ['SMS costs far more than expected', 'A non-GSM character forcing Unicode encoding', '[SMS](/docs/sms)'],
        ['Email authentication fails with correct credentials', 'A partially filled configuration falling back as a whole', '[Messaging providers](/docs/messaging-providers)'],
      ] },

      { t: 'h2', text: 'Portal' },
      { t: 'table', head: ['Symptom', 'Likely cause', 'Page'], rows: [
        ['Captive portal shows a blank page', 'Portal address not publicly reachable', '[Captive portal](/docs/captive-portal)'],
        ['Expired subscribers cannot pay', 'Portal or gateway not reachable pre-authentication', '[Customer portal overview](/docs/portal-overview)'],
        ['Banner image does not load', 'Asset host missing from the walled garden', '[Captive promo banners](/docs/promo-banners)'],
      ] },
    ],
  },

  support: {
    title: 'Getting support',
    description: 'How to get help, and what to include so it can actually be answered.',
    blocks: [
      { t: 'h2', text: 'Before you ask' },
      { t: 'p', text: 'Check the [Troubleshooting index](/docs/troubleshooting-index). A large share of issues are known behaviours with a specific cause — particularly the ones that fail silently.' },

      { t: 'h2', text: 'What to include' },
      { t: 'p', text: 'A report that contains these can usually be answered on the first reply. One without them costs a round trip before anyone can even begin.' },
      { t: 'fields', items: [
        { name: 'What you expected', type: 'required', text: 'What should have happened.' },
        { name: 'What happened', type: 'required', text: 'Exactly what you observed, including the precise error text rather than a paraphrase.' },
        { name: 'Scope', type: 'required', text: 'One subscriber, one router, or everyone. This single fact eliminates most possibilities.' },
        { name: 'When it started', type: 'required', text: 'And what changed around then — a push, an upgrade, a new device, a provider change.' },
        { name: 'Identifiers', type: 'helpful', text: 'Account number, RADIUS login, router name, transaction code. Whatever is relevant to the thing that failed.' },
        { name: 'What you have tried', type: 'helpful', text: 'So nobody suggests it again.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'Scope is the most valuable line', text: '"One subscriber" and "everyone on one router" lead to completely different investigations. Stating it up front skips an entire exchange.' },

      { t: 'h2', text: 'Copying a page' },
      { t: 'p', text: 'Every page here has a **Copy page** button that puts it on your clipboard as markdown, with options to view or download the source. Use it to quote the exact section you are asking about, or to give an assistant the context it needs.' },

      { t: 'h2', text: 'Urgency' },
      { t: 'table', head: ['Situation', 'Treat as'], rows: [
        ['Every subscriber offline', 'Urgent — include what changed immediately before'],
        ['One router down', 'High — say how many subscribers it serves'],
        ['Payments not recording', 'High — money is moving without being tracked'],
        ['One subscriber affected', 'Normal'],
        ['A question about how something works', 'Normal — check the documentation first'],
      ] },

      { t: 'h2', text: 'Your own support contacts' },
      { t: 'p', text: 'The contacts your **subscribers** should use are the ones in your ISP profile, which appear on invoices, portal pages and message templates. Keep them current — see [Settings](/docs/settings).' },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    description: 'How subscriber data is handled, and your responsibilities as the operator holding it.',
    blocks: [
      { t: 'callout', kind: 'warning', title: 'This is operational guidance, not legal advice', text: 'It describes how Lumen handles data and what your obligations generally are. Your jurisdiction imposes specific requirements — in Kenya, the Data Protection Act — and you should take advice on how they apply to you.' },

      { t: 'h2', text: 'What the platform holds' },
      { t: 'p', text: 'Running an ISP means holding personal data. Lumen stores it because the service cannot function otherwise:' },
      { t: 'ul', items: [
        '**Identity** — names, phone numbers, email and physical addresses.',
        '**Identity documents** where you collect them for verification.',
        '**Connection records** — sessions, addresses assigned, data volumes.',
        '**Financial records** — payments, invoices, transaction references.',
        '**Support history** — tickets and correspondence.',
      ] },

      { t: 'h2', text: 'Who is responsible for what' },
      { t: 'p', text: 'You decide what data to collect from your subscribers and why. Lumen processes it on your behalf, according to how you configure the platform. Practically, that means the obligations to your subscribers are yours.' },

      { t: 'h2', text: 'Your obligations' },
      { t: 'ul', items: [
        'Collect only what you actually need to provide service and bill for it.',
        'Tell subscribers what you collect and why, before you collect it.',
        'Keep it secure — individual staff logins, least privilege, two-factor authentication.',
        'Do not retain it longer than you need it, or than the law requires.',
        'Be able to respond when a subscriber asks what you hold about them.',
      ] },

      { t: 'h2', text: 'Practical care' },
      { t: 'callout', kind: 'danger', title: 'Exports are the weak point', text: 'A subscriber export is a spreadsheet of names, phone numbers and addresses. Once it leaves the platform, none of the platform’s controls apply. Do not email it, do not leave it in a shared folder, and delete it when the task that needed it is done.' },
      { t: 'ul', items: [
        'Never share logins — shared accounts destroy accountability entirely. See [Staff and permissions](/docs/staff).',
        'Revoke access the day someone leaves.',
        'Keep identity documents only as long as verification requires.',
        'Review the audit log periodically for access that has no business reason.',
      ] },

      { t: 'h2', text: 'Data in messages' },
      { t: 'p', text: 'Never send credentials by SMS or email, and never send links asking for payment details. Beyond the direct risk, it trains your subscribers to trust exactly the sort of message a fraudster will send them next. See [Notifications and templates](/docs/notifications).' },
    ],
  },

  terms: {
    title: 'Terms of Use',
    description: 'The shape of the agreement covering your use of the platform.',
    blocks: [
      { t: 'callout', kind: 'warning', title: 'The binding terms are the ones you accepted', text: 'This page summarises the arrangement in plain language for orientation. The actual agreement is the one presented at registration and available from your account. Where the two differ, that agreement governs.' },

      { t: 'h2', text: 'What the service is' },
      { t: 'p', text: 'Lumen is software for operating an ISP: managing subscribers, controlling network access through your own routers, billing, and communicating with customers. It is not a connectivity provider. Lumen does not carry your traffic, does not supply your bandwidth, and does not stand between you and your subscribers.' },

      { t: 'h2', text: 'Your responsibilities' },
      { t: 'ul', items: [
        'Operating your network lawfully, including any licensing your regulator requires.',
        'The accuracy of what you tell subscribers about speeds, prices and terms.',
        'Securing your account — credentials, staff access, and two-factor authentication.',
        'Handling subscriber data lawfully. See [Privacy Policy](/docs/privacy).',
        'Paying the platform subscription that keeps your account active.',
      ] },

      { t: 'h2', text: 'What is yours' },
      { t: 'p', text: 'Your subscriber records, billing history and configuration are yours. You can export them at any time — see [Search, imports, and exports](/docs/search-imports-exports). Being able to leave with your own data is a property of the platform, not a concession.' },

      { t: 'h2', text: 'Availability' },
      { t: 'p', text: 'The console is a hosted service and will occasionally be unavailable for maintenance. By design, that does not disconnect your subscribers: RADIUS and your routers continue to serve existing sessions independently of your ability to reach the console.' },
      { t: 'callout', kind: 'note', title: 'The separation is deliberate', text: 'Console availability and subscriber connectivity are kept independent throughout the platform — including when your own subscription lapses. Losing access to the dashboard must never take your customers offline.' },

      { t: 'h2', text: 'Acceptable use' },
      { t: 'p', text: 'The platform may not be used to send unsolicited bulk messaging, to hold data you have no lawful basis for, or in breach of your regulator’s requirements. Your messaging gateway will enforce its own rules on top of these, and it is generally less forgiving.' },

      { t: 'h2', text: 'Ending the arrangement' },
      { t: 'p', text: 'You can stop using the service. Export your data before you do — see [Search, imports, and exports](/docs/search-imports-exports) — and plan how your subscribers will be authenticated afterwards, because they authenticate against Lumen today.' },
    ],
  },
};
