export default {
  'dashboard-analytics': {
    title: 'Dashboard and analytics',
    description: 'The numbers that tell you whether the business is working, and how to read them.',
    blocks: [
      { t: 'p', text: 'The dashboard answers one question on opening: is anything wrong right now. The analytics behind it answer a slower one: is the business getting better or worse.' },

      { t: 'h2', text: 'What to check daily' },
      { t: 'fields', items: [
        { name: 'Active subscribers', type: 'count', text: 'Your revenue base. A fall means churn you have not noticed yet.' },
        { name: 'Online now', type: 'count', text: 'Live sessions. A sharp drop is an outage in progress, not a reporting artefact.' },
        { name: 'Collected today', type: 'money', text: 'Money in. Compare against the same weekday, not yesterday — collections are strongly weekly.' },
        { name: 'Overdue', type: 'money', text: 'Money owed. Growing means your reminders are not working.' },
        { name: 'Routers offline', type: 'count', text: 'Should be zero. Anything else needs a reason.' },
        { name: 'Open tickets', type: 'count', text: 'A spike is an incident before anyone has called it one.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'Compare like with like', text: 'Subscriber payments cluster by weekday and by month-end. Comparing a Tuesday to a Monday produces alarm about nothing. Always compare to the same day last week.' },

      { t: 'h2', text: 'The numbers that actually matter' },
      { t: 'h3', text: 'Churn' },
      { t: 'p', text: 'The proportion of subscribers who leave in a period. It is the quietest way a business fails: growth hides churn until acquisition slows, and then the decline looks sudden when it has been running for a year.' },
      { t: 'h3', text: 'Average revenue per subscriber' },
      { t: 'p', text: 'Total revenue divided by active subscribers. Falling ARPU while subscriber numbers rise means you are growing into cheaper customers — worth knowing before you take on the cost of serving them.' },
      { t: 'h3', text: 'Cost per subscriber' },
      { t: 'p', text: 'Total monthly cost divided by active subscribers, from [Expenses](/docs/expenses). The gap between this and ARPU is your real margin.' },
      { t: 'h3', text: 'Collection rate' },
      { t: 'p', text: 'Of what was due this month, how much arrived. Below about ninety percent, fix collections before you spend anything on acquiring more customers who will also not pay.' },

      { t: 'h2', text: 'Reports' },
      { t: 'p', text: 'Reporting covers billing, network, devices, subscribers and overall analytics, each filterable by period. Export any of them to CSV to work in a spreadsheet.' },
      { t: 'callout', kind: 'warning', title: 'Export the filtered view', text: 'Exporting everything and filtering afterwards is how reconciliations go wrong. Apply the filter first, confirm the totals on screen, then export what you are looking at.' },

      { t: 'h2', text: 'A monthly review worth doing' },
      { t: 'ol', items: [
        'Subscribers gained and lost — is churn rising?',
        'Revenue against the same month last year.',
        'Collection rate — how much of what was due arrived?',
        'Cost per subscriber against revenue per subscriber.',
        'Ticket volume by category — what keeps breaking?',
        'Router uptime — which site is costing you the most goodwill?',
      ] },
    ],
  },

  monitoring: {
    title: 'Monitoring and alerts',
    description: 'Watch device health and traffic continuously, and be told when something breaks.',
    blocks: [
      { t: 'p', text: 'Monitoring is what turns "a customer called to say it is down" into "we already knew". It polls your devices, records what it finds, and raises alerts on the conditions you care about.' },

      { t: 'h2', text: 'What is collected' },
      { t: 'ul', items: [
        '**Device resources** — CPU, memory and uptime per router.',
        '**Interface traffic** — throughput per port, for spotting saturation and dead links.',
        '**Reachability** — whether each device is answering.',
        '**Session counts** — how many subscribers each NAS is carrying.',
      ] },

      { t: 'h2', text: 'Reading a graph' },
      { t: 'table', head: ['Pattern', 'Usually means'], rows: [
        ['Traffic flat at a ceiling during peak', 'The uplink is saturated — subscribers are being throttled by physics'],
        ['CPU high, traffic normal', 'Packets taking the firewall path rather than being fast-tracked'],
        ['Uptime resetting repeatedly', 'Power instability at the site'],
        ['One port at zero, others normal', 'Dead cable, port, or unplugged device'],
        ['Sessions dropping to zero and returning', 'The NAS rebooted, or its RADIUS path failed briefly'],
      ] },

      { t: 'h2', text: 'Alerts worth having' },
      { t: 'p', text: 'Alert on things that need a human. Everything else is noise, and noise is how real alerts get ignored.' },
      { t: 'ul', items: [
        'A router unreachable for longer than a brief blip.',
        'Sustained high CPU on a NAS.',
        'An uplink saturated for an extended period.',
        'A sharp fall in session count on one device.',
      ] },
      { t: 'callout', kind: 'danger', title: 'Alert fatigue is the real failure mode', text: 'A system that pages you for every transient blip trains you to dismiss it, and the one alert that mattered gets dismissed with the rest. Tune thresholds until an alert is always worth reading — an ignored alerting system is worse than none, because it produces false confidence.' },

      { t: 'h2', text: 'Polling and gaps' },
      { t: 'p', text: 'Data is gathered by periodic polling, so a gap in a graph means collection did not happen — the device was unreachable, or the collector was not running. A gap is not evidence of zero traffic, and reading it as such has sent many people looking for an outage that never occurred.' },
    ],
  },

  'audits-changelog': {
    title: 'Audits and changelog',
    description: 'Who changed what, and what changed in the platform itself.',
    blocks: [
      { t: 'h2', text: 'The audit log' },
      { t: 'p', text: 'Sensitive actions are recorded with the user who performed them, the time, and what changed. It is the first place to look whenever a value is not what you expect.' },
      { t: 'p', text: 'Typically recorded:' },
      { t: 'ul', items: [
        'Subscriber creation, package changes, suspension and deletion.',
        'Payments recorded, amended or refunded.',
        'Package price and speed changes.',
        'Router configuration pushes.',
        'User and permission changes.',
        'Settings changes, especially payment credentials.',
      ] },

      { t: 'h2', text: 'Using it' },
      { t: 'table', head: ['Question', 'What to look for'], rows: [
        ['Why is this subscriber suspended?', 'The suspension entry — who and when'],
        ['Why did this package change price?', 'The package edit and the user who made it'],
        ['Who recorded this cash payment?', 'The payment entry’s recording user'],
        ['Why did the router configuration change?', 'The provisioning or configuration push entry'],
        ['Who added this staff account?', 'The user creation entry'],
      ] },
      { t: 'callout', kind: 'warning', title: 'Shared logins destroy this', text: 'Every protection here depends on each person having their own account. If your team shares one login, the audit log records that a change happened but never who made it — and the moment it matters, it will not help you.' },

      { t: 'h2', text: 'Investigating a discrepancy' },
      { t: 'steps', items: [
        { title: 'Find the record', text: 'The subscriber, payment or package in question.' },
        { title: 'Read its history', text: 'What changed, when, and by whom.' },
        { title: 'Establish the sequence', text: 'Discrepancies are usually two legitimate actions in the wrong order, not one wrong action.' },
        { title: 'Correct forward', text: 'Record a correcting entry rather than editing history. The trail is worth more than a tidy record.' },
      ] },

      { t: 'h2', text: 'Platform changelog' },
      { t: 'p', text: 'The changelog records what changed in Lumen itself — new features, fixes and behaviour changes. Check it when something works differently from how you remember, before assuming a fault.' },
    ],
  },

  'search-imports-exports': {
    title: 'Search, imports, and exports',
    description: 'Find anything quickly, and move data in and out.',
    blocks: [
      { t: 'h2', text: 'Search' },
      { t: 'p', text: 'Global search accepts several subscriber identifiers, so you can use whatever the caller can actually give you.' },
      { t: 'ul', items: [
        'Name or partial name.',
        'Phone number, in whole or in part.',
        '**Account number** — printed on their invoices and receipts.',
        '**RADIUS login** — the username that appears in router logs.',
        'Email address, where recorded.',
      ] },
      { t: 'callout', kind: 'tip', title: 'Match the identifier to the source', text: 'From a phone call, search the phone number. From a router log, search the RADIUS login. From an M-Pesa payment, search the account number. Searching by name is the least reliable of the four, because names are spelled inconsistently at capture.' },

      { t: 'h2', text: 'Filters' },
      { t: 'p', text: 'List screens filter by status, package, router, date range and more. Filters compose, so you can narrow to exactly the group you mean — and that filtered view is what a campaign or an export should be built from.' },

      { t: 'h2', text: 'Exports' },
      { t: 'p', text: 'Most lists export to CSV, honouring the filters currently applied.' },
      { t: 'ul', items: [
        'Subscriber lists, for reconciliation or migration.',
        'Payments, for accounting.',
        'Invoices, for tax records.',
        'Session history, for investigating a dispute.',
      ] },
      { t: 'callout', kind: 'warning', title: 'Exports contain personal data', text: 'A subscriber export holds names, phone numbers and addresses. Treat the file as you would the database itself: do not email it casually, and delete it when the task is done. See [Privacy Policy](/docs/privacy).' },

      { t: 'h2', text: 'Imports' },
      { t: 'p', text: 'Subscriber imports run from CSV or directly from a router, with a review step before anything is written and an explicit cutover before anything goes live. Full detail in [Subscriber import and export](/docs/import-export).' },

      { t: 'h2', text: 'Import runs' },
      { t: 'p', text: 'Every import is retained as a run: what was imported, when, by whom, and every row that failed with its reason. When a subscriber turns out to be missing weeks later, the run is where you find out why — which is exactly when you will need it.' },
    ],
  },
};
