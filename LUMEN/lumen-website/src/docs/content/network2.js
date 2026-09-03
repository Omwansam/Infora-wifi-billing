export default {
  vouchers: {
    title: 'Vouchers',
    description: 'Prepaid codes that grant access without an account — sold in cash, redeemed on the portal.',
    blocks: [
      { t: 'p', text: 'A voucher is a printed code that buys a fixed amount of access. The customer types it into the captive portal and is online. No account, no registration, no payment integration in the moment of sale.' },

      { t: 'h2', text: 'Why vouchers matter' },
      { t: 'p', text: 'They let you sell connectivity to people who pay cash, have no smartphone wallet, or simply want an hour of access without a relationship. In many markets this is the majority of hotspot revenue.' },
      { t: 'cards', cols: 3, items: [
        { icon: 'card', title: 'Cash sales', text: 'Sell through shops and agents with no gateway involved.' },
        { icon: 'bolt', title: 'Instant access', text: 'Redeemed at the portal — no signup, no waiting.' },
        { icon: 'shield', title: 'Bounded risk', text: 'A code is worth exactly its package and nothing more.' },
      ] },

      { t: 'h2', text: 'Generating a batch' },
      { t: 'steps', items: [
        { title: 'Choose the package', text: 'The voucher grants this package’s speed and validity when redeemed.' },
        { title: 'Set the quantity', text: 'Generate what you will actually distribute. Unissued codes are a liability if the printout is lost.' },
        { title: 'Set the expiry', text: 'When unredeemed codes stop being valid. Without this, a code found in a drawer next year still works.' },
        { title: 'Generate and print', text: 'Export the batch for printing or hand to an agent.' },
      ] },
      { t: 'callout', kind: 'warning', title: 'Always set a batch expiry', text: 'A voucher without one is an open-ended promise. Codes surface months later, are honoured, and you deliver service against revenue you recognised long ago.' },

      { t: 'h2', text: 'Validity starts at redemption' },
      { t: 'p', text: 'A one-day voucher gives one day from the moment it is redeemed, not from when it was printed. That is what makes it sellable through a shop — the customer decides when their day begins.' },

      { t: 'h2', text: 'Tracking' },
      { t: 'p', text: 'Every voucher carries a state: unused, redeemed, or expired. Redeemed codes record when and by whom, which is what lets you reconcile an agent’s float against actual usage. See [Voucher agents](/docs/voucher-agents).' },

      { t: 'h2', text: 'Handling disputes' },
      { t: 'table', head: ['Complaint', 'What to check'], rows: [
        ['"The code does not work"', 'Whether it is already redeemed, and by whom — the usual answer is that it was'],
        ['"I only just bought it"', 'The batch expiry; an old printed batch may have lapsed before sale'],
        ['"It gave me less time than promised"', 'The package on the batch, not the package you meant to use'],
        ['Agent float does not reconcile', 'Redeemed count against codes issued to that agent'],
      ] },
    ],
  },

  'voucher-agents': {
    title: 'Voucher agents',
    description: 'Distribute vouchers through shops and resellers, and reconcile what they owe you.',
    blocks: [
      { t: 'p', text: 'An agent is someone who sells your vouchers on your behalf — a shop, a kiosk, a reseller in an area you do not staff. Agents extend your reach to customers who will never visit your office.' },

      { t: 'h2', text: 'How the relationship works' },
      { t: 'steps', items: [
        { title: 'Register the agent', text: 'Name, phone and location. The phone number is how you will reach them about float and reconciliation.' },
        { title: 'Issue vouchers to them', text: 'A batch is allocated to that agent, so redemptions can be attributed.' },
        { title: 'They sell for cash', text: 'The customer pays the agent directly.' },
        { title: 'Reconcile', text: 'Compare codes redeemed against codes issued, and settle the difference less their commission.' },
      ] },

      { t: 'h2', text: 'Commission' },
      { t: 'p', text: 'Agents are normally paid a margin per voucher sold. Agree it in writing before issuing the first batch, and make sure both sides understand whether commission is on codes *issued* or codes *redeemed* — that distinction is the source of most agent disputes.' },
      { t: 'callout', kind: 'tip', title: 'Reconcile on redemption', text: 'Paying on issue means paying for codes that may never sell. Paying on redemption aligns the agent’s incentive with actual customers and keeps your float honest.' },

      { t: 'h2', text: 'Controlling exposure' },
      { t: 'ul', items: [
        'Issue small batches often rather than large batches rarely.',
        'Set a batch expiry so unsold stock does not linger indefinitely.',
        'Reconcile on a fixed schedule — weekly is usually right.',
        'Stop issuing to an agent whose reconciliation is overdue, before the exposure grows.',
      ] },

      { t: 'h2', text: 'Reporting' },
      { t: 'p', text: 'Per-agent reporting shows codes issued, redeemed and outstanding. A healthy agent shows steady redemption; a large unredeemed balance means either slow sales or codes that have gone missing, and both are worth a conversation.' },
    ],
  },

  'multi-wan': {
    title: 'Multi-WAN and failover',
    description: 'Run two or more uplinks that share load and cover for each other when one fails.',
    blocks: [
      { t: 'p', text: 'A single uplink is a single point of failure for every subscriber behind it. Multi-WAN lets a router use several lines — adding their bandwidth together, or keeping one in reserve — and Lumen generates the router configuration for you.' },

      { t: 'h2', text: 'Choosing a method' },
      { t: 'table', head: ['Method', 'What it does', 'Use when'], rows: [
        ['**Off**', 'One uplink, no multi-WAN routing', 'You have a single line'],
        ['**Failover**', 'Standby lines carry nothing until the line above them fails, then take over automatically', 'A cheap backup line purely for resilience'],
        ['**Load balance**', 'Every line carries a weighted share of connections, adding up bandwidth', 'Two comparable lines and you want the combined capacity'],
        ['**App steering**', 'Named apps and steered subscribers ride the secondary lines; everything else stays on the primary', 'A cheaper line you want social and bulk traffic to use'],
      ] },
      { t: 'callout', kind: 'note', title: 'Load balancing does not speed up one download', text: 'Balancing is per connection, so a single file transfer still runs at one line’s speed. The gain shows with many users at once. Balancing per packet would be faster for one download and would break every banking and payment session, so it is deliberately not done.' },

      { t: 'h2', text: 'Lines' },
      { t: 'p', text: 'A configuration holds between two and five lines. Each line is one uplink and carries its own settings.' },
      { t: 'fields', items: [
        { name: 'Port', type: 'interface', text: 'The physical port this line uses. Every line must use a different port.' },
        { name: 'Type', type: 'enum', text: 'DHCP, static, or PPPoE — how the line obtains its address and gateway.' },
        { name: 'Probe host', type: 'ip', text: 'A public IP tested through this line to judge whether it is alive. Every line needs its own.' },
        { name: 'Weight', type: 'number', text: 'In load balance mode, the relative share of connections. A 30 Mbps and a 10 Mbps line would be 3 and 1.' },
        { name: 'Label', type: 'string', text: 'Optional name — the provider, so a technician knows which physical line it is.' },
      ] },
      { t: 'callout', kind: 'danger', title: 'Every line needs its own probe host', text: 'Health is judged per line by whether that line’s own probe answers. If two lines share a probe address, a dead line can still be reported healthy and will keep being handed traffic — which is worse than having no health check at all. The console refuses a configuration where two lines share one.' },

      { t: 'h2', text: 'Primary line and pinning' },
      { t: 'p', text: 'The **primary line** is the one traffic prefers; the remaining lines follow in the order the cards are arranged. You can also **pin the billing tunnel** to a specific line, so management and RADIUS traffic always leaves the same way rather than following failover.' },

      { t: 'h2', text: 'Applying a configuration' },
      { t: 'steps', items: [
        { title: 'Set the method and lines', text: 'Choose a method, then configure each line’s port, type and probe.' },
        { title: 'Download or apply', text: 'Download the generated script to paste into the router terminal, or push it over the management tunnel.' },
        { title: 'Wait for verification', text: 'A push runs several SSH sessions and takes minutes on a busy router. The console shows the stage and elapsed time — do not click again.' },
        { title: 'Confirm it verified', text: 'Applied means the commands ran. Verified means the router was read back and matches. Only verified counts.' },
      ] },

      { t: 'h2', text: 'The rollback guard' },
      { t: 'callout', kind: 'danger', title: 'A failed push used to strand routers', text: 'Multi-WAN changes rewrite the router’s default route. A push that failed part-way could leave a router with no route at all — unreachable, with no way back except a site visit. The configuration now rolls itself back automatically if it does not verify.' },
      { t: 'p', text: 'If a push fails and the console says the router is rolling back, **wait**. Retrying immediately pushes into a router that is mid-repair and makes the situation harder to reason about.' },

      { t: 'h2', text: 'The five-line ceiling' },
      { t: 'p', text: 'Beyond five lines the limit is the router, not the software. Per-connection balancing forces fast-tracking off, so every packet takes the firewall path and CPU becomes the constraint. On a small router even three balanced lines can saturate the processor before they saturate the bandwidth.' },

      { t: 'h2', text: 'Before you enable it' },
      { t: 'ul', items: [
        'Confirm the ports you intend to use as uplinks are not currently LAN bridge ports — using one removes it from the bridge and that downstream port disappears.',
        'Have physical access, or a second path to the router, the first time you push.',
        'Push during a quiet window. The router’s routing table is rewritten and sessions will drop.',
        'Test failover deliberately by unplugging the primary line, rather than trusting it works.',
      ] },
    ],
  },

  equipment: {
    title: 'Equipment inventory',
    description: 'Track the routers, radios, ONTs and cable you own, and where each item ended up.',
    blocks: [
      { t: 'p', text: 'Equipment inventory records the physical hardware in your business: what you bought, what is in the store, what is installed at a customer, and what has failed. Without it, capital equipment quietly disappears.' },

      { t: 'h2', text: 'What to track' },
      { t: 'ul', items: [
        '**Subscriber equipment** — routers, ONTs and radios installed at premises, especially any you still own.',
        '**Network equipment** — the switches, radios and NAS devices that make up your infrastructure.',
        '**Stock** — untraceable until it is issued, which is exactly when it goes missing.',
        '**Failed units** — for warranty claims and for spotting a bad batch.',
      ] },

      { t: 'h2', text: 'Item states' },
      { t: 'table', head: ['State', 'Meaning'], rows: [
        ['In stock', 'Held in the store, available to issue'],
        ['Issued', 'Given to a technician but not yet installed'],
        ['Deployed', 'Installed and in service, linked to a subscriber or site'],
        ['Faulty', 'Returned as not working, pending repair or warranty'],
        ['Retired', 'Written off and out of service'],
      ] },
      { t: 'callout', kind: 'tip', title: 'Record serial numbers at purchase', text: 'Not at installation. A serial captured when the box is opened is the only reliable way to make a warranty claim, and the only way to prove which unit went where.' },

      { t: 'h2', text: 'Linking equipment to subscribers' },
      { t: 'p', text: 'Attaching a device to a subscriber tells you what to collect on disconnection, and what to check when they report a fault. If you subsidise equipment, this is the record that says what you are owed.' },

      { t: 'h2', text: 'Why it pays for itself' },
      { t: 'ul', items: [
        'Equipment recovered on disconnection instead of written off.',
        'Warranty claims that succeed because the serial and purchase date exist.',
        'Bad batches identified from failure clusters rather than anecdote.',
        'Technicians accountable for stock issued to them.',
      ] },
    ],
  },

  tr069: {
    title: 'TR-069 and CPE',
    description: 'Manage subscriber premises equipment remotely — provision, monitor and diagnose without a site visit.',
    blocks: [
      { t: 'p', text: 'TR-069 is the standard protocol for managing customer premises equipment. Where your MikroTik NAS devices are managed over the management tunnel, TR-069 manages the **subscriber’s** device — the ONT or router in their house.' },
      { t: 'callout', kind: 'note', title: 'Different fleet, different protocol', text: 'This is not how your MikroTik routers are managed. Those use the management tunnel and SSH. TR-069 exists for the customer-premises fleet, which is usually a mix of vendors that all speak this protocol and nothing else in common.' },

      { t: 'h2', text: 'What it gives you' },
      { t: 'cards', items: [
        { icon: 'bolt', title: 'Zero-touch provisioning', text: 'A new ONT configures itself when it first connects, with no technician typing settings.' },
        { icon: 'chart', title: 'Optical power readings', text: 'Read the light level at the customer’s ONT — the single most useful fibre fault indicator.' },
        { icon: 'wrench', title: 'Remote diagnosis', text: 'Read WAN state, uptime and errors without dispatching anyone.' },
        { icon: 'router', title: 'Firmware management', text: 'Push firmware to a whole fleet on a schedule.' },
      ] },

      { t: 'h2', text: 'How devices connect' },
      { t: 'p', text: 'The CPE is configured with the address of Lumen’s auto-configuration server and contacts it periodically. Because the device dials out, this works behind NAT exactly as the management tunnel does.' },

      { t: 'h2', text: 'Tasks are queued' },
      { t: 'p', text: 'You do not talk to a CPE synchronously. Actions are queued and delivered the next time that device checks in, so a request against a powered-off ONT is pending rather than failed.' },
      { t: 'callout', kind: 'warning', title: 'Pending is not failed', text: 'A queued task waits for the device to call home. If a customer has switched their ONT off, the task sits until it comes back. Check the device’s last contact time before concluding a task did not work.' },

      { t: 'h2', text: 'Vendor profiles' },
      { t: 'p', text: 'Vendors implement TR-069 with different parameter names for the same thing. Vendor profiles map those differences, so an optical power reading means the same thing regardless of who made the ONT. When adding an unfamiliar model, expect to confirm which profile it needs.' },

      { t: 'h2', text: 'Optical power' },
      { t: 'p', text: 'The received optical power at the ONT, in dBm, is the fastest fibre diagnosis you have. A reading well below the expected range means loss on the path — a dirty connector, a tight bend, a bad splice. Compare it against the designed loss budget for that route; see [Fiber plant and maps](/docs/fiber).' },
      { t: 'table', head: ['Reading', 'Interpretation'], rows: [
        ['Within design budget', 'The optical path is healthy — look elsewhere for the fault'],
        ['A few dB low', 'Degradation: a dirty connector or an ageing splice'],
        ['Far below budget', 'A real break, a severe bend, or the wrong port patched'],
        ['No reading at all', 'No light, or the ONT is not reporting — check power first'],
      ] },
    ],
  },

  fiber: {
    title: 'Fiber plant and maps',
    description: 'Record your physical fibre network — routes, nodes, splices — and compare designed loss against measured light.',
    blocks: [
      { t: 'p', text: 'The fibre plant records what you have physically built: where cable runs, where it is spliced, and what each route is expected to lose. It exists to answer one question quickly — is this fault where I think it is.' },

      { t: 'h2', text: 'What is recorded' },
      { t: 'fields', items: [
        { name: 'Nodes', type: 'points', text: 'Cabinets, splitters, joint closures and termination points, with their locations.' },
        { name: 'Cables', type: 'routes', text: 'The physical runs between nodes, including fibre count and length.' },
        { name: 'Splices', type: 'joins', text: 'Where fibres are joined, and the loss each join contributes.' },
        { name: 'Loss budget', type: 'dB', text: 'The total expected loss along a route — the number a measurement is judged against.' },
      ] },

      { t: 'h2', text: 'Budget versus measurement' },
      { t: 'p', text: 'This is the point of the whole feature. A loss budget on its own is a design document. A power reading on its own is a number without meaning. Together they tell you whether a route is performing as built.' },
      { t: 'callout', kind: 'tip', title: 'The comparison is the diagnosis', text: 'A customer reading 3 dB below their route’s budget has a real, locatable problem even though the link still works. Finding it now is a maintenance visit; finding it after it fails completely is an outage.' },
      { t: 'p', text: 'Optical readings come from the subscriber’s ONT — see [TR-069 and CPE](/docs/tr069).' },

      { t: 'h2', text: 'The map' },
      { t: 'p', text: 'Nodes and cables are plotted geographically, so you can see coverage, plan extensions, and judge which customers a given break affects.' },
      { t: 'callout', kind: 'warning', title: 'Coordinate order catches everyone', text: 'KML and most mapping libraries disagree about coordinate order — one expects longitude first, the other latitude first. Get it backwards and your Nairobi plant appears in the ocean off Somalia. If imported nodes land somewhere absurd, this is why.' },

      { t: 'h2', text: 'Importing existing plant' },
      { t: 'p', text: 'Existing survey data can be imported from KML, which is what most GPS survey tools and Google Earth produce. Import a small section first and confirm it lands in the right place before importing everything.' },

      { t: 'h2', text: 'Using it during an outage' },
      { t: 'steps', items: [
        { title: 'Identify affected subscribers', text: 'A cluster of faults in one area usually shares a route.' },
        { title: 'Find the common node', text: 'Trace back from the affected customers to the first shared point.' },
        { title: 'Check optical readings', text: 'Where light is still present but low, the break is partial and locatable.' },
        { title: 'Dispatch to the segment', text: 'Not to the customer — to the section of plant the evidence points at.' },
      ] },
    ],
  },

  'network-troubleshooting': {
    title: 'Network troubleshooting',
    description: 'A diagnostic order of operations for when subscribers cannot get online.',
    blocks: [
      { t: 'p', text: 'Most network faults are diagnosed fastest by working outwards from what is shared. This page is the order to work in.' },

      { t: 'h2', text: 'Start with scope' },
      { t: 'p', text: 'Before anything else, establish how many subscribers are affected. It determines where the fault can possibly be.' },
      { t: 'table', head: ['Scope', 'The fault is', 'Go to'], rows: [
        ['One subscriber', 'Their account, credentials or equipment', '[Subscriber profile](/docs/subscriber-profile)'],
        ['Everyone on one router', 'That NAS or its uplink', '[Router health](/docs/router-health)'],
        ['Everyone on one route', 'Physical plant', '[Fiber plant and maps](/docs/fiber)'],
        ['Everyone, everywhere', 'RADIUS, or your own upstream', 'This page, below'],
      ] },

      { t: 'h2', text: 'Nobody can authenticate' },
      { t: 'p', text: 'When authentication fails estate-wide, work through these in order:' },
      { t: 'steps', items: [
        { title: 'Was a router added recently?', text: 'A new NAS whose RADIUS client entry has not been reloaded is dropped as an unknown client — silently, with no reject. This is the single most common cause.' },
        { title: 'Do usernames contain an @?', text: 'Email-style logins fail with no reply at all when realm handling is misconfigured. Plain usernames working while email ones time out is the signature.' },
        { title: 'Can the router reach the server?', text: 'RADIUS is UDP and fails silently. Confirm the path, not just that the router is up.' },
        { title: 'Is the shared secret right?', text: 'A wrong secret produces no useful error on either side.' },
      ] },
      { t: 'callout', kind: 'danger', title: 'RADIUS fails quietly by design', text: 'Almost every RADIUS misconfiguration produces silence rather than an error. Never conclude from an absence of log entries that nothing was sent — assume the opposite and check the path.' },

      { t: 'h2', text: 'One subscriber cannot connect' },
      { t: 'ol', items: [
        'Check their status — expired and suspended both refuse new sessions.',
        'Check whether they are already online elsewhere; a concurrent-session limit will refuse the second login.',
        'Confirm the credentials, especially for a hand-typed PPPoE username.',
        'Check whether their NAS is healthy — a site fault presents as an individual one to the first caller.',
        'Look at their session history: sessions that start and instantly drop are a different fault from sessions that never start.',
      ] },

      { t: 'h2', text: 'Sessions that drop immediately' },
      { t: 'p', text: 'A PPPoE session that establishes and dies within seconds is usually a router-side conflict rather than a credential problem — commonly a Hotspot service bound to the same interface capturing the PPPoE ports. Rebooting the NAS frequently clears it; if it recurs, check the interface bindings.' },

      { t: 'h2', text: 'Everything is slow' },
      { t: 'ul', items: [
        'Check the uplink’s actual throughput against what you have sold. Oversubscription presents as slowness for everyone at peak.',
        'Check router CPU. Per-connection load balancing disables fast-tracking, and a small router can run out of processor long before it runs out of bandwidth.',
        'Check whether fair-use throttling has engaged for the complaining subscribers.',
        'Check for a failed-over uplink — a backup line carrying everyone will be slower than the primary.',
      ] },

      { t: 'h2', text: 'A router is unreachable' },
      { t: 'p', text: 'Check session counts before dispatching anyone. The management tunnel and the subscriber data path are independent: a router can be invisible to Lumen while serving all of its customers perfectly. If subscribers are online, it is a tunnel problem, not an outage — see [The management tunnel](/docs/management-tunnel).' },
    ],
  },
};
