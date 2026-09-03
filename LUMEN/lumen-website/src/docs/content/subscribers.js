export default {
  'subscribers-overview': {
    title: 'Subscribers overview',
    description: 'How subscribers are modelled, identified, and moved through their lifecycle.',
    blocks: [
      { t: 'p', text: 'A subscriber is one paying relationship: a person or business, the package they bought, the credentials the network authenticates, and the history of what they have paid. Everything in customer service starts from this record.' },

      { t: 'h2', text: 'Access types' },
      { t: 'p', text: 'How a subscriber gets online determines which fields matter on their record.' },
      { t: 'table', head: ['Type', 'How they authenticate', 'Typical use'], rows: [
        ['**Hotspot**', 'Captive portal login, or a voucher code', 'Public WiFi, apartments, shared spaces'],
        ['**PPPoE**', 'A username and password dialled by their router', 'Home and business fibre or wireless links'],
        ['**Static binding**', 'Their IP or MAC address, with no login', 'Fixed installations, CCTV, point-to-point links'],
      ] },

      { t: 'h2', text: 'How a subscriber is identified' },
      { t: 'p', text: 'Each subscriber carries several identifiers, and they exist for different audiences. Knowing which is which saves a great deal of confusion during support calls.' },
      { t: 'fields', items: [
        { name: 'account_number', type: 'string', text: 'The customer-facing reference. It appears on invoices and receipts and is what a subscriber quotes when paying by M-Pesa.' },
        { name: 'radius_login', type: 'string', text: 'The username the router authenticates. This is what appears in RouterOS logs and RADIUS accounting, and it is not necessarily their email or name.' },
        { name: 'email', type: 'string', text: 'Optional. Used for portal access and emailed documents, not for network authentication.' },
        { name: 'phone', type: 'string', text: 'The primary support and notification channel, and usually the fastest way to find an account.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'Searching backwards from the network', text: 'When you have a username from a router log or a RADIUS reject, search by **RADIUS login** — not by name. It resolves directly to the account even when the display name is spelled differently or the customer has since been renamed.' },

      { t: 'h2', text: 'The lifecycle' },
      { t: 'steps', items: [
        { title: 'Created', text: 'The record exists with a package assigned. Credentials are generated but the subscriber may not have connected yet.' },
        { title: 'Active', text: 'Paid and inside their validity window. RADIUS permits sessions and applies the package’s speed limits.' },
        { title: 'Expiring', text: 'Validity is nearly up. This is when renewal reminders are sent — see [Notifications and templates](/docs/notifications).' },
        { title: 'Expired', text: 'Validity has run out. New sessions are refused until the account renews. Existing sessions are cut at the next accounting interval.' },
        { title: 'Suspended', text: 'Blocked by staff regardless of payment — for abuse, disputes, or on request.' },
      ] },
      { t: 'callout', kind: 'note', title: 'Expired is not offline', text: 'They are different axes. **Expired** is a billing state; **offline** simply means no live session — which is also true of a fully paid subscriber whose router is switched off. Never diagnose a payment problem from an offline indicator alone.' },

      { t: 'h2', text: 'Where to go next' },
      { t: 'cards', items: [
        { icon: 'users', title: 'Create and manage', text: 'Add subscribers on any access type and edit them safely.', to: '/docs/create-subscribers' },
        { icon: 'chart', title: 'Subscriber profile', text: 'Read a single account: state, sessions, payments, tickets.', to: '/docs/subscriber-profile' },
        { icon: 'bolt', title: 'Active sessions', text: 'See who is online right now and disconnect a session.', to: '/docs/active-sessions' },
        { icon: 'book', title: 'Import and export', text: 'Migrate an existing base from CSV or from the router.', to: '/docs/import-export' },
      ] },
    ],
  },

  'create-subscribers': {
    title: 'Create and manage subscribers',
    description: 'Add subscribers on Hotspot, PPPoE or static bindings, and change them without breaking service.',
    blocks: [
      { t: 'h2', text: 'Creating a subscriber' },
      { t: 'p', text: 'Open **Subscribers → New**. The form adapts to the access type you choose, because a PPPoE account needs credentials a Hotspot voucher user does not.' },
      { t: 'steps', items: [
        { title: 'Identity', text: 'Name, phone and optional email. The phone number is the notification channel, so verify it at capture time rather than discovering it is wrong when a renewal reminder fails.' },
        { title: 'Access type', text: 'Hotspot, PPPoE or static binding. This choice determines the remaining fields and cannot be changed casually later.' },
        { title: 'Package', text: 'The plan they are buying. It sets speed, price and validity. See [Packages](/docs/packages).' },
        { title: 'Credentials', text: 'For PPPoE, the username and password their router dials with. Lumen can generate both — generated credentials avoid the support burden of customers choosing weak, colliding usernames.' },
        { title: 'Router', text: 'Which NAS serves this subscriber. It scopes their sessions and determines which device you check when they report a fault.' },
        { title: 'Billing start', text: 'When their validity begins. Backdate it if they have already been connected during a trial.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'Let Lumen generate PPPoE credentials', text: 'Generated usernames are unique by construction. Hand-typed ones collide, and a duplicate PPPoE username produces intermittent disconnections for both subscribers that are genuinely difficult to diagnose from the router side.' },

      { t: 'h2', text: 'Changing a package' },
      { t: 'p', text: 'Changing a subscriber’s package updates the RADIUS attributes they will receive. The change applies to their **next** session, not the one in progress — RADIUS hands out attributes at authentication time.' },
      { t: 'p', text: 'To apply an upgrade immediately, disconnect the live session after changing the package. The subscriber’s equipment reconnects within seconds and picks up the new speed. See [Active sessions](/docs/active-sessions).' },

      { t: 'h2', text: 'Suspending and restoring' },
      { t: 'p', text: 'Suspension blocks network access without deleting anything. Their history, invoices and credentials are preserved, and restoring is a single action. Use it for disputes, abuse, or a customer travelling for a month.' },
      { t: 'callout', kind: 'warning', title: 'Suspend rather than delete', text: 'Deleting a subscriber removes the account and unlinks its history. If you only want to stop service, suspend. Deletion is for records created in error.' },

      { t: 'h2', text: 'Bulk operations' },
      { t: 'p', text: 'From the subscriber list you can select many accounts and act on them together — change package, suspend, restore, or send a message. This is how price changes and estate-wide migrations are done without touching each record.' },
      { t: 'callout', kind: 'warning', title: 'Bulk actions are not undoable in one step', text: 'Reversing a bulk change means another bulk change. Filter the list first and confirm the count matches what you expect before you apply.' },
    ],
  },

  'subscriber-profile': {
    title: 'Subscriber profile',
    description: 'Everything known about one account, on one screen — and how to read it during a support call.',
    blocks: [
      { t: 'p', text: 'The profile is the single screen a support agent should need. It answers, in order: who are they, are they paid, are they online, and what has happened to them recently.' },

      { t: 'h2', text: 'The header' },
      { t: 'p', text: 'Name, account number, package, status and current balance. If the status badge and the online indicator disagree, that disagreement is usually the answer — see the troubleshooting table below.' },

      { t: 'h2', text: 'Sessions' },
      { t: 'p', text: 'The current session if there is one, and recent history: when they connected, from which NAS, which IP they were given, and how much data moved. This is drawn from RADIUS accounting, so it reflects what the network actually did rather than what the billing record expects.' },

      { t: 'h2', text: 'Payments and invoices' },
      { t: 'p', text: 'Every payment received and every invoice raised, newest first. Each payment shows its method and gateway reference — for M-Pesa that is the transaction code the customer can read off their phone, which makes reconciling a disputed payment straightforward.' },

      { t: 'h2', text: 'Documents and KYC' },
      { t: 'p', text: 'Uploaded identity documents and their verification state. See [KYC and verification](/docs/kyc).' },

      { t: 'h2', text: 'Tickets' },
      { t: 'p', text: 'Support history for this subscriber, so an agent can see whether this is a first report or the fourth call about the same fault. See [Support tickets](/docs/tickets).' },

      { t: 'h2', text: 'Reading the profile during a call' },
      { t: 'table', head: ['What you see', 'What it means', 'What to do'], rows: [
        ['Active, online, slow', 'Connected and paid; a speed or contention problem', 'Check the package speed and whether a fair-use policy has throttled them'],
        ['Active, offline', 'Paid, but no session', 'Their equipment or the last-mile link — check the router, not the billing'],
        ['Expired, offline', 'Validity ran out', 'Take payment; access restores on renewal'],
        ['Active, offline, router down', 'The NAS itself is unreachable', 'A site problem affecting everyone on that router, not this subscriber'],
        ['Suspended', 'Blocked by staff', 'Check the audit log for who suspended them and why'],
      ] },
      { t: 'callout', kind: 'tip', title: 'Check the router before the subscriber', text: 'If several subscribers on one NAS report a fault within minutes of each other, the fault is the NAS or its uplink. Open [Router health and diagnostics](/docs/router-health) before working through accounts one by one.' },
    ],
  },

  'active-sessions': {
    title: 'Active sessions',
    description: 'See who is connected right now, what they are using, and disconnect a session when you need to.',
    blocks: [
      { t: 'p', text: 'Active sessions is the live view of your network: every subscriber with an open RADIUS accounting session, the NAS serving them, their address, uptime and data used.' },

      { t: 'h2', text: 'Where the data comes from' },
      { t: 'p', text: 'Sessions come from RADIUS accounting records that the router writes as subscribers connect, stay connected, and disconnect. This means the list reflects what the **network** believes, which is the truth you want during an incident.' },
      { t: 'callout', kind: 'warning', title: 'Two clocks, one truth', text: 'Session timestamps are written by the router and interpreted by the server. If a router’s clock is wrong, its sessions appear to start in the future or the distant past and will not line up with your billing records. Configure NTP on every NAS during provisioning — this is one of the most common causes of session data that looks impossible.' },

      { t: 'h2', text: 'Disconnecting a session' },
      { t: 'p', text: 'Disconnecting cuts the session at the router. The subscriber’s equipment will usually redial within seconds — which is exactly what you want when applying a package change.' },
      { t: 'p', text: 'Use it to:' },
      { t: 'ul', items: [
        'Apply a package upgrade immediately rather than at next reconnection.',
        'Clear a stuck session that is holding an address or blocking a fresh login.',
        'Enforce a suspension that was applied while the subscriber was already online.',
      ] },
      { t: 'callout', kind: 'note', title: 'Disconnect is not suspend', text: 'A disconnect ends one session. If the account is still active, they reconnect immediately. To keep someone off the network, suspend the subscriber — see [Create and manage subscribers](/docs/create-subscribers).' },

      { t: 'h2', text: 'Stale sessions' },
      { t: 'p', text: 'A session that ends without the router reporting it — a power cut, a crashed NAS — can linger as apparently active. Lumen ages these out after a configured staleness window rather than trusting them indefinitely.' },
      { t: 'p', text: 'If you see many stale sessions from one router, that router is not delivering accounting updates. Check its RADIUS accounting configuration and its path to the server; see [Network troubleshooting](/docs/network-troubleshooting).' },

      { t: 'h2', text: 'What to watch' },
      { t: 'ul', items: [
        '**Session count per NAS** — a sudden drop means a router or uplink problem, not a subscriber problem.',
        '**Duplicate logins** — the same PPPoE username in two places usually means credentials have been shared or duplicated.',
        '**Very long sessions with no data** — often a device that is connected but unused; harmless, but it inflates online counts.',
      ] },
    ],
  },

  'ip-mac-bindings': {
    title: 'IP and MAC bindings',
    description: 'Give a device network access by its address instead of a login.',
    blocks: [
      { t: 'p', text: 'A binding authorises a device by its IP or MAC address, with no username, no password and no captive portal. It is how you connect equipment that cannot log in.' },

      { t: 'h2', text: 'When to use a binding' },
      { t: 'ul', items: [
        '**CCTV cameras, NVRs and IoT devices** that have no interactive login.',
        '**Point-to-point links** between sites, where a portal would break the link.',
        '**Business customers with static addressing** who run their own routing.',
        '**Kiosks and payment terminals** that must reconnect unattended after a power cut.',
      ] },

      { t: 'h2', text: 'IP versus MAC' },
      { t: 'table', head: ['', 'IP binding', 'MAC binding'], rows: [
        ['Identifies', 'The assigned address', 'The physical network adapter'],
        ['Survives a DHCP change', 'No — the lease must be reserved', 'Yes'],
        ['Survives hardware replacement', 'Yes', 'No — the new device has a new MAC'],
        ['Best for', 'Statically addressed equipment', 'Devices that move or use DHCP'],
      ] },
      { t: 'callout', kind: 'tip', title: 'Reserve the lease as well', text: 'An IP binding is only stable if the address is genuinely fixed. Pair it with a DHCP reservation on the router, or the device will eventually be issued a different address and lose access at the least convenient moment.' },

      { t: 'h2', text: 'Creating a binding' },
      { t: 'steps', items: [
        { title: 'Create the subscriber', text: 'Choose **static binding** as the access type. Billing, packages and invoicing work exactly as they do for any other subscriber.' },
        { title: 'Record the address', text: 'Enter the IP or MAC. A MAC must be the device’s real hardware address — a randomised or privacy MAC will stop matching without warning.' },
        { title: 'Assign the package', text: 'Speed limits apply to bindings the same way they apply to logins.' },
        { title: 'Verify', text: 'Confirm traffic passes and the device appears in the session list.' },
      ] },
      { t: 'callout', kind: 'warning', title: 'Randomised MAC addresses', text: 'Phones and laptops rotate their MAC per network by default. Never bind a consumer device by MAC without first disabling private addressing for your SSID on that device — otherwise access silently stops when the address rotates.' },

      { t: 'h2', text: 'Security' },
      { t: 'p', text: 'Both IP and MAC addresses can be spoofed by anyone on the same segment. A binding is a convenience for equipment that cannot log in, not a security control. Do not use bindings for high-value access where a credential is possible.' },
    ],
  },

  'import-export': {
    title: 'Subscriber import and export',
    description: 'Migrate an existing subscriber base from a CSV file or straight off a router, and export your data.',
    blocks: [
      { t: 'p', text: 'Migration is the riskiest thing you will do in Lumen, because it touches every customer at once. The import tooling is built around one principle: nothing changes on the network until you explicitly cut over.' },

      { t: 'h2', text: 'Two sources' },
      { t: 'cards', items: [
        { icon: 'router', title: 'Import from a router', text: 'Read PPPoE secrets and Hotspot users directly off a MikroTik. Best when the router is the only record you have.' },
        { icon: 'book', title: 'Import from a file', text: 'Upload a CSV exported from your previous system. Best when you have billing history and contact details worth keeping.' },
      ] },

      { t: 'h2', text: 'The import workflow' },
      { t: 'steps', items: [
        { title: 'Choose a source', text: 'Point Lumen at the router, or upload the CSV.' },
        { title: 'Map the columns', text: 'Match each source column to a Lumen field. Unmapped columns are ignored rather than guessed at.' },
        { title: 'Review the run', text: 'Lumen reports what it will create, what it will update, and what it cannot parse — **before** writing anything.' },
        { title: 'Fix and re-run', text: 'Correct the source and repeat. Runs are cheap; a bad migration is not.' },
        { title: 'Cut over', text: 'The separate, explicit step that makes the imported subscribers live on the network.' },
      ] },
      { t: 'callout', kind: 'warning', title: 'Cutover is the point of no return', text: 'Everything before it is a dry run you can repeat freely. Cutover switches authentication to Lumen for the imported accounts — plan it for a quiet window and have the previous system available to fall back to.' },

      { t: 'h2', text: 'Import runs' },
      { t: 'p', text: 'Every import is recorded as a run you can reopen: what was imported, when, by whom, and every row that failed with the reason. When a subscriber turns out to be missing three weeks later, the run is where you find out why.' },

      { t: 'h2', text: 'Preparing a CSV' },
      { t: 'ul', items: [
        'One subscriber per row, with a header row naming the columns.',
        'Include a **unique identifier** per subscriber — an existing account number is ideal, and lets a re-run update rather than duplicate.',
        'Phone numbers in a consistent format, ideally full international form.',
        'Name the package per row, matching packages you have already created in Lumen.',
        'Save as UTF-8. Other encodings mangle accented names silently.',
      ] },
      { t: 'callout', kind: 'tip', title: 'Import twenty before you import two thousand', text: 'Run a small slice end to end, including cutover, and confirm those subscribers authenticate and bill correctly. Every problem you find on twenty rows is one you would otherwise have found on all of them at once.' },

      { t: 'h2', text: 'Exporting' },
      { t: 'p', text: 'Subscriber lists, payments and invoices export to CSV from their respective screens, honouring the filters you have applied. Export the filtered view rather than everything — a targeted file is far easier to reconcile than a full dump.' },
    ],
  },

  leads: {
    title: 'Leads',
    description: 'Track prospective subscribers from first enquiry to connected customer.',
    blocks: [
      { t: 'p', text: 'A lead is someone who wants service but is not yet connected. Keeping them here rather than in a notebook means installation demand is visible, and no enquiry is quietly lost.' },

      { t: 'h2', text: 'Where leads come from' },
      { t: 'ul', items: [
        'Enquiries submitted from your public website.',
        'Walk-ins and phone calls captured by staff.',
        'Referrals from existing subscribers.',
        'Coverage requests from addresses you cannot yet serve.',
      ] },

      { t: 'h2', text: 'The pipeline' },
      { t: 'steps', items: [
        { title: 'New', text: 'Captured, not yet contacted. This is the queue that should never grow.' },
        { title: 'Contacted', text: 'Someone has spoken to them and recorded what they need.' },
        { title: 'Survey', text: 'Coverage and line-of-sight confirmed for their address.' },
        { title: 'Scheduled', text: 'An installation date is booked.' },
        { title: 'Converted', text: 'Installed and now a subscriber. The lead links to the account it became.' },
        { title: 'Lost', text: 'Closed with a reason — no coverage, price, or chose a competitor.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'Record why you lose', text: 'Lost reasons are the most valuable field here. A cluster of "no coverage" leads in one area is a costed argument for extending the network there.' },

      { t: 'h2', text: 'Converting a lead' },
      { t: 'p', text: 'Converting carries the captured name, phone and address into a new subscriber record, so nothing is retyped and the enquiry stays linked to the resulting account. Continue from [Create and manage subscribers](/docs/create-subscribers).' },
    ],
  },

  tickets: {
    title: 'Support tickets',
    description: 'Record faults and requests against the subscriber they concern, and close the loop.',
    blocks: [
      { t: 'p', text: 'Tickets keep support history attached to the account rather than scattered across phones and chat. The value shows up on the fourth call about the same fault, when the pattern is visible instead of remembered.' },

      { t: 'h2', text: 'Raising a ticket' },
      { t: 'p', text: 'Raise one from the subscriber profile so it is linked automatically, or from **Tickets → New** and choose the subscriber. Record what the customer actually reported, in their words, before you add your diagnosis — the two are different pieces of evidence.' },
      { t: 'fields', items: [
        { name: 'Subject', type: 'string', text: 'A specific summary. "No connection since Tuesday storm" beats "internet down".' },
        { name: 'Category', type: 'enum', text: 'Connectivity, billing, speed, installation, other. Categories are what make the reporting useful.' },
        { name: 'Priority', type: 'enum', text: 'Drives ordering in the queue. Reserve the top priority for outages affecting many subscribers.' },
        { name: 'Assignee', type: 'user', text: 'The staff member responsible. An unassigned ticket is nobody’s job.' },
      ] },

      { t: 'h2', text: 'Working a ticket' },
      { t: 'p', text: 'Add updates as you investigate. Notes are the record another agent reads when the customer calls back and you are not there — write them for that reader, not for yourself.' },

      { t: 'h2', text: 'Closing' },
      { t: 'p', text: 'Close with a resolution that says what was actually wrong, not just that it works now. "Replaced faulty PoE injector" tells you something six months later; "resolved" does not.' },
      { t: 'callout', kind: 'tip', title: 'Tickets are early warning', text: 'Several connectivity tickets from one area within an hour is an outage, not a coincidence. Sort the open queue by router or area during any spike before you work them individually.' },

      { t: 'h2', text: 'Subscriber-raised tickets' },
      { t: 'p', text: 'Subscribers can raise tickets themselves from the customer portal, which arrive in the same queue already linked to their account. See [Portal support tickets](/docs/portal-tickets).' },
    ],
  },

  staff: {
    title: 'Staff and permissions',
    description: 'Add your team with the narrowest access that lets them do their job.',
    blocks: [
      { t: 'p', text: 'Every person who uses Lumen should have their own login. Shared accounts destroy the audit trail: when an amount is wrong, "the operator account did it" tells you nothing.' },

      { t: 'h2', text: 'Adding a staff member' },
      { t: 'steps', items: [
        { title: 'Open Settings → Users', text: 'The list of everyone with access.' },
        { title: 'Invite by email', text: 'They receive an invitation and set their own password. You never handle their credential.' },
        { title: 'Assign a role', text: 'Choose the narrowest role that covers their actual work.' },
        { title: 'Require 2FA', text: 'Anyone who can move money or reconfigure routers should have two-factor authentication on. See [Account security](/docs/account-security).' },
      ] },

      { t: 'h2', text: 'Roles' },
      { t: 'table', head: ['Role', 'Typically can', 'Typically cannot'], rows: [
        ['**Administrator**', 'Everything, including settings, users and gateway credentials', '—'],
        ['**Manager**', 'Subscribers, packages, billing, reports', 'Change platform settings or payment credentials'],
        ['**Cashier**', 'Record payments, raise invoices, view subscribers', 'Reconfigure routers or change prices'],
        ['**Technician**', 'Routers, sessions, diagnostics, tickets', 'See financial records or issue refunds'],
        ['**Support**', 'View subscribers, work tickets, send messages', 'Change packages or take payments'],
      ] },
      { t: 'callout', kind: 'note', title: 'Roles vary by account', text: 'Available roles and their exact permissions depend on your plan and configuration. The table shows the common shape, not a guarantee of what your account exposes.' },

      { t: 'h2', text: 'Least privilege in practice' },
      { t: 'ul', items: [
        'A field technician needs routers and sessions, not the payments ledger.',
        'A cashier needs to record money, not to change what a package costs.',
        'Only administrators should hold gateway credentials — they are the keys to your collections.',
        'Review the user list whenever someone leaves, and revoke the same day.',
      ] },

      { t: 'h2', text: 'Auditing' },
      { t: 'p', text: 'Actions are recorded against the user who performed them. When a subscriber’s package or balance is not what you expect, the audit log names who changed it and when. See [Audits and changelog](/docs/audits-changelog).' },
    ],
  },
};
