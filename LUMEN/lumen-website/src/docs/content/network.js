export default {
  'routers-and-nas': {
    title: 'Routers and NAS',
    description: 'Register MikroTik routers as network access servers so Lumen can authenticate and control them.',
    blocks: [
      { t: 'p', text: 'A NAS — network access server — is the router that actually lets subscribers on or keeps them off. Lumen does not carry your traffic; it tells your routers who is allowed, at what speed, and for how long. Everything else in this section depends on getting this relationship right.' },

      { t: 'h2', text: 'What Lumen needs from a router' },
      { t: 'fields', items: [
        { name: 'Name', type: 'string', text: 'How you will recognise it. Use the site, not the model — "Kiambu Tower" beats "hEX S #2".' },
        { name: 'Address', type: 'host', text: 'How Lumen reaches it for configuration. Either a reachable address or, preferably, its management tunnel address.' },
        { name: 'Credentials', type: 'user/pass', text: 'A router user Lumen logs in as over SSH. Give it a dedicated account rather than the shared admin login.' },
        { name: 'RADIUS secret', type: 'string', text: 'The shared secret the router uses to authenticate to RADIUS. Generated for you when the device is added.' },
      ] },

      { t: 'h2', text: 'Adding a router' },
      { t: 'steps', items: [
        { title: 'Open Devices → MikroTik → Add', text: 'Enter the name, address and credentials.' },
        { title: 'Let Lumen read the device', text: 'It logs in over SSH and reads the interface list, RouterOS version and identity. If this fails, nothing later will work — fix connectivity first.' },
        { title: 'Confirm the RADIUS client', text: 'Adding the device registers it as a RADIUS client with its own shared secret.' },
        { title: 'Provision it', text: 'Continue to [Provision a router](/docs/provision-router).' },
      ] },
      { t: 'callout', kind: 'danger', title: 'RADIUS must be restarted after adding a device', text: 'FreeRADIUS reads its client list at startup. Until it reloads, authentication requests from a newly added router are dropped as coming from an **unknown client** — there is no reject, no error, and nothing in the application log. It looks exactly like the router is not sending anything at all. If a brand-new NAS authenticates nobody, this is almost always why.' },

      { t: 'h2', text: 'RouterOS versions' },
      { t: 'p', text: 'RouterOS 6 and 7 are both supported, but their command syntax differs in places Lumen has to account for. The generated configuration adapts to the version it reads from the device, which is why letting Lumen read the router before provisioning matters.' },

      { t: 'h2', text: 'Reachability' },
      { t: 'p', text: 'Lumen has to reach the router to configure it, and the router has to reach Lumen for RADIUS. There are two ways to arrange that, and only one of them is a good idea.' },
      { t: 'table', head: ['Approach', 'How it works', 'Verdict'], rows: [
        ['**Management tunnel**', 'The router dials out to Lumen and holds an encrypted tunnel open', 'Recommended — works behind NAT, exposes nothing'],
        ['Public address', 'The router has a routable address and open management ports', 'Avoid — publishes SSH and the web interface to the internet'],
      ] },
      { t: 'p', text: 'See [The management tunnel](/docs/management-tunnel).' },

      { t: 'h2', text: 'Multiple routers' },
      { t: 'p', text: 'Each subscriber is associated with the NAS that serves them, which scopes their sessions and tells you which device to check when they report a fault. Adding sites means adding routers here; there is no separate concept of a site.' },
    ],
  },

  'provision-router': {
    title: 'Provision a router',
    description: 'Push interface, firewall, RADIUS and service configuration to a MikroTik from the console.',
    blocks: [
      { t: 'p', text: 'Provisioning is where Lumen writes real configuration to your router. It is the step that turns a registered device into one that authenticates subscribers.' },
      { t: 'callout', kind: 'danger', title: 'Provisioning rewrites router configuration', text: 'It reclaims ports from bridges, changes firewall rules and configures RADIUS. On a router already carrying subscribers this will interrupt service. Schedule it, and never learn the wizard on a production device.' },

      { t: 'h2', text: 'Port roles' },
      { t: 'p', text: 'Before anything is pushed, you tell Lumen what each physical port is for. This is the single most important input, because the generated configuration is built around it.' },
      { t: 'fields', items: [
        { name: 'WAN', type: 'role', text: 'The uplink to your upstream provider. Carries no subscriber traffic and is never bridged with LAN ports.' },
        { name: 'LAN', type: 'role', text: 'Downstream ports serving subscribers. These are bridged together and carry Hotspot or PPPoE service.' },
        { name: 'Management', type: 'role', text: 'A port reserved for reaching the router itself — useful for keeping an out-of-band path that survives a bad service push.' },
        { name: 'Skip', type: 'role', text: 'Leave this port entirely alone. Use it for anything you have configured by hand and do not want touched.' },
      ] },
      { t: 'callout', kind: 'warning', title: 'A factory MikroTik puts ether1 in a bridge', text: 'MikroTik’s default configuration bridges ether1 with everything else. RouterOS then refuses what a WAN port needs — a DHCP client will not run on a slave interface, and interface-matching firewall rules are rejected for slave ports. The rules are still *accepted* and merely flagged invalid, so the push looks clean while the router does nothing. Provisioning reclaims WAN ports from bridges precisely to avoid this.' },

      { t: 'h2', text: 'The provisioning steps' },
      { t: 'steps', items: [
        { title: 'Read the device', text: 'Lumen logs in, lists interfaces, and reads the RouterOS version so it can generate the right syntax.' },
        { title: 'Assign port roles', text: 'Map each physical port to WAN, LAN, management or skip.' },
        { title: 'Open the management tunnel', text: 'Establishes the encrypted path Lumen uses from here on. See [The management tunnel](/docs/management-tunnel).' },
        { title: 'Configure services', text: 'Pushes the bridge, addressing, firewall, NAT and RADIUS configuration, plus Hotspot or PPPoE server setup.' },
        { title: 'Verify', text: 'Lumen reads the configuration back and confirms the router came up as intended.' },
      ] },

      { t: 'h2', text: 'Applied is not verified' },
      { t: 'p', text: 'Two different things can be true after a push, and the console distinguishes them deliberately:' },
      { t: 'ul', items: [
        '**Applied** — every command ran without error.',
        '**Verified** — the router was read back afterwards and matches what was intended.',
      ] },
      { t: 'p', text: 'Only verified means it worked. RouterOS accepts plenty of configuration it then quietly refuses to act on, so a clean push is not evidence of a working router.' },

      { t: 'h2', text: 'Re-provisioning' },
      { t: 'p', text: 'Provisioning is idempotent — re-running it converges the router to the intended configuration rather than duplicating rules. Re-run it after changing port roles, after a firmware upgrade, or when a router’s configuration has drifted.' },
      { t: 'callout', kind: 'warning', title: 'Older routers may need re-provisioning for new features', text: 'Capabilities added after a router was first provisioned — a widened tunnel firewall, the management port role, browser-based router access — are only present on devices provisioned since. If a feature works on new routers and not old ones, re-provision the old one.' },

      { t: 'h2', text: 'When a push fails' },
      { t: 'p', text: 'The log names the step that failed and the router’s own error text. Work from that rather than retrying blindly. Common causes:' },
      { t: 'table', head: ['Symptom', 'Usual cause'], rows: [
        ['SSH banner or connection errors', 'Several operations hitting the router at once — retry once the others finish'],
        ['"can not run on slave interface"', 'A WAN port is still in a bridge'],
        ['Rules present but flagged invalid', 'Interface matcher on a slave port — reclaim the port first'],
        ['Nothing authenticates afterwards', 'RADIUS was not restarted after the device was added'],
      ] },
      { t: 'p', text: 'More in [Network troubleshooting](/docs/network-troubleshooting).' },
    ],
  },

  'management-tunnel': {
    title: 'The management tunnel',
    description: 'An encrypted path from Lumen to each router that works behind NAT and exposes nothing to the internet.',
    blocks: [
      { t: 'p', text: 'The management tunnel is how Lumen reaches your routers without you publishing their management interfaces. The router dials out and holds an encrypted tunnel open; Lumen configures it through that tunnel. Nothing needs to be port-forwarded, and the router works fine behind carrier-grade NAT.' },

      { t: 'h2', text: 'Why not just open a port' },
      { t: 'p', text: 'A router with SSH or its web interface exposed to the internet is found by scanners within hours. The tunnel gives Lumen the access it needs while the router remains unreachable from everywhere else.' },
      { t: 'cards', cols: 3, items: [
        { icon: 'shield', title: 'Nothing exposed', text: 'No forwarded ports, no public management interface.' },
        { icon: 'router', title: 'Works behind NAT', text: 'The router dials out, so no inbound path is needed.' },
        { icon: 'bolt', title: 'Always available', text: 'The tunnel stays up, so configuration is not dependent on a technician being on site.' },
      ] },

      { t: 'h2', text: 'Keeping the tunnel alive' },
      { t: 'p', text: 'A router behind NAT must send traffic periodically or the NAT mapping that lets replies back in expires. Without that keepalive, a perfectly healthy router goes quiet and reads as offline.' },
      { t: 'callout', kind: 'warning', title: 'Silence is not the same as down', text: 'A router that has stopped answering may be entirely healthy with an expired NAT mapping. The tell is direction: if Lumen’s side shows traffic sent but nothing received, the path back is broken, not the router. A genuinely dead router shows nothing in either direction.' },

      { t: 'h2', text: 'Browser access to the router' },
      { t: 'p', text: 'Once the tunnel is up you can open the router’s own web interface from the console, proxied through the tunnel. That means configuring a router at a remote site without a site visit, a VPN client, or exposing anything publicly.' },
      { t: 'callout', kind: 'note', title: 'Provisioned before this existed?', text: 'Routers provisioned before browser access was added do not have the firewall rules it needs. Re-provision the device and it will work.' },

      { t: 'h2', text: 'Diagnosing a tunnel' },
      { t: 'steps', items: [
        { title: 'Check the router is powered and has internet', text: 'The tunnel is dialled out, so the router needs a working uplink first. If its WAN is down nothing else matters.' },
        { title: 'Look at traffic direction', text: 'Traffic sent with none received points at the return path, not the device.' },
        { title: 'Confirm the uplink did not change', text: 'A new upstream provider or a replaced modem changes the path and can break an established tunnel.' },
        { title: 'Re-provision', text: 'This re-establishes tunnel configuration from scratch, and is the reliable fix once connectivity is confirmed.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'Fix the uplink first', text: 'Almost every "tunnel down" turns out to be an uplink problem at the site. Confirm the router has internet before investigating the tunnel itself.' },
    ],
  },

  'router-health': {
    title: 'Router health and diagnostics',
    description: 'Monitor CPU, memory, uptime, traffic and reachability across every NAS you run.',
    blocks: [
      { t: 'p', text: 'The device view answers one question: is this router healthy, and if not, what is wrong with it. It is the screen to open when several subscribers on one site report a fault at once.' },

      { t: 'h2', text: 'What is collected' },
      { t: 'fields', items: [
        { name: 'Reachability', type: 'status', text: 'Whether Lumen can currently talk to the router over the management tunnel.' },
        { name: 'CPU load', type: 'percent', text: 'Sustained high CPU on a router doing per-connection load balancing is expected; on a plain router it signals a problem.' },
        { name: 'Memory', type: 'percent', text: 'Steadily climbing memory usually means a router that needs a firmware update.' },
        { name: 'Uptime', type: 'duration', text: 'A reset uptime you did not expect means the router rebooted — often a power problem at the site.' },
        { name: 'Interface traffic', type: 'bps', text: 'Per-port throughput, for spotting a saturated uplink or a dead port.' },
        { name: 'Active sessions', type: 'count', text: 'How many subscribers this NAS currently has online.' },
      ] },

      { t: 'h2', text: 'Online and offline' },
      { t: 'p', text: 'Router status is deliberately reluctant to declare a device offline. A single missed poll — a busy router, a moment of packet loss, a slow SSH negotiation — is not evidence of an outage, and a status that flickers trains people to ignore it.' },
      { t: 'callout', kind: 'note', title: 'Why the status is sticky', text: 'A router is only marked offline after it has genuinely stopped responding, and any inbound sign of life marks it online immediately. This is why a card may still read online for a short period after a device stops answering — it is waiting for confirmation rather than reacting to one missed reply.' },

      { t: 'h2', text: 'Reading a fault' },
      { t: 'table', head: ['Symptom', 'Likely cause', 'Where to look'], rows: [
        ['Uptime keeps resetting', 'Power instability at the site', 'Site power, PoE injector'],
        ['CPU pinned, sessions normal', 'Traffic taking the firewall path rather than fast-tracked', '[Multi-WAN and failover](/docs/multi-wan)'],
        ['Reachable, no sessions', 'RADIUS not reaching the server, or an unknown-client drop', '[Network troubleshooting](/docs/network-troubleshooting)'],
        ['Unreachable, subscribers online', 'Management tunnel down, data plane fine', '[The management tunnel](/docs/management-tunnel)'],
        ['One port at zero traffic', 'Dead cable, port, or a device that has been unplugged', 'Physical inspection'],
      ] },
      { t: 'callout', kind: 'tip', title: 'Unreachable does not mean subscribers are down', text: 'The management tunnel and the subscriber data path are independent. A router can be invisible to Lumen while serving every one of its customers perfectly. Check session counts before you dispatch anyone.' },

      { t: 'h2', text: 'Backups and firmware' },
      { t: 'p', text: 'Take a configuration backup before any firmware upgrade or significant change. Firmware upgrades reboot the router and interrupt every subscriber on it, so schedule them for a quiet window and upgrade one site at a time — never your whole estate at once.' },
    ],
  },

  'pppoe-hotspot': {
    title: 'PPPoE and Hotspot',
    description: 'The two ways subscribers authenticate, and how to choose between them.',
    blocks: [
      { t: 'p', text: 'Almost every subscriber connects one of two ways. The choice determines the equipment they need, the support you will give, and how their session behaves.' },

      { t: 'h2', text: 'Choosing between them' },
      { t: 'table', head: ['', 'PPPoE', 'Hotspot'], rows: [
        ['Who authenticates', 'The subscriber’s router, automatically', 'The end device, through a web page'],
        ['Credentials', 'Username and password stored in their router', 'Login or voucher code typed by the user'],
        ['Reconnects unattended', 'Yes', 'Not always — usually needs a re-login'],
        ['Per-device or per-premises', 'Per premises', 'Per device'],
        ['Best for', 'Homes and businesses with their own router', 'Public WiFi, apartments, short-term access'],
      ] },
      { t: 'callout', kind: 'tip', title: 'Default to PPPoE for homes', text: 'It survives power cuts without anyone typing anything, which removes an entire category of support call. Reserve Hotspot for genuinely shared or short-term access.' },

      { t: 'h2', text: 'How authentication flows' },
      { t: 'steps', items: [
        { title: 'The subscriber connects', text: 'A PPPoE router dials; a Hotspot user opens a browser and is redirected to the portal.' },
        { title: 'The router asks RADIUS', text: 'It forwards the credentials to Lumen’s RADIUS server.' },
        { title: 'Lumen decides', text: 'The subscriber is checked for existence, active status and remaining validity.' },
        { title: 'Attributes are returned', text: 'On success, the package’s speed limits and session parameters come back with the accept.' },
        { title: 'The router enforces', text: 'It applies the returned limits and opens the session. Accounting records start flowing.' },
      ] },
      { t: 'callout', kind: 'note', title: 'Attributes are set at login', text: 'The package’s limits are handed out when the session starts. Changing a package mid-session does not change the live speed — disconnect the session to apply it immediately.' },

      { t: 'h2', text: 'Usernames that contain an @' },
      { t: 'p', text: 'If your subscribers log in with email addresses, be careful with RADIUS realm handling. A realm-splitting configuration treats everything after the `@` as a routing domain and tries to proxy the request elsewhere.' },
      { t: 'callout', kind: 'danger', title: 'The silent email-login failure', text: 'When realm handling is misconfigured, an email-style username produces **no reply at all** — not a reject. The subscriber sees a timeout, the router logs nothing useful, and the server appears to have ignored the request. If email logins fail while plain usernames work, this is the cause.' },

      { t: 'h2', text: 'Concurrent sessions' },
      { t: 'p', text: 'Decide how many simultaneous sessions one account may hold. One is right for a PPPoE home subscriber. Hotspot accounts in a household usually need several, and setting the limit too low produces support calls where a second device simply refuses to connect.' },

      { t: 'h2', text: 'PPPoE sessions that drop immediately' },
      { t: 'p', text: 'A session that establishes and dies within seconds — before the link is fully negotiated — is usually a router-side conflict rather than a credential problem. A Hotspot service capturing the PPPoE ports on the same interface will do it, and so will a router in a confused state after configuration changes.' },
      { t: 'callout', kind: 'tip', title: 'Reboot the NAS', text: 'When PPPoE sessions are torn down instantly on a router you have just reconfigured, a reboot frequently clears it. If it recurs, check that a Hotspot service is not bound to the same interface.' },
    ],
  },

  packages: {
    title: 'Packages',
    description: 'Define what you sell — speed, price and validity — and how it becomes enforcement on the router.',
    blocks: [
      { t: 'p', text: 'A package is your product. It carries the speed a subscriber gets, the price they pay and how long it lasts, and Lumen translates it into the RADIUS attributes your routers enforce. Everything a subscriber experiences about their service comes from here.' },

      { t: 'h2', text: 'What a package defines' },
      { t: 'fields', items: [
        { name: 'Name', type: 'string', text: 'What appears on the portal, the invoice and the subscriber’s receipt. Make it meaningful to a customer, not to you.' },
        { name: 'Download / upload speed', type: 'bps', text: 'The rate limit handed to the router. Asymmetric speeds are normal for consumer plans.' },
        { name: 'Price', type: 'money', text: 'Charged per validity period, in your account currency.' },
        { name: 'Validity', type: 'duration', text: 'How long one purchase lasts — an hour, a day, a month. Drives expiry and renewal reminders.' },
        { name: 'Fair use limit', type: 'bytes', text: 'Optional. Data allowance after which the subscriber is throttled rather than cut off. See [Fair use policy](/docs/fup).' },
        { name: 'Access type', type: 'enum', text: 'Whether the package is offered for Hotspot, PPPoE, or both.' },
      ] },

      { t: 'h2', text: 'How a package reaches the router' },
      { t: 'p', text: 'Each package corresponds to a RADIUS group. When a subscriber authenticates, the group’s attributes — principally the rate limit — are returned with the accept, and the router applies them for that session. You do not configure speed limits on the router by hand; the package is the source of truth.' },
      { t: 'callout', kind: 'warning', title: 'Changes apply at next login', text: 'Editing a package changes what future sessions receive. Subscribers already online keep the attributes they were given until they reconnect. To apply a change immediately, disconnect the affected sessions — see [Active sessions](/docs/active-sessions).' },

      { t: 'h2', text: 'Creating a package' },
      { t: 'steps', items: [
        { title: 'Open Packages → New', text: 'Name it as a customer would recognise it.' },
        { title: 'Set the speed', text: 'Download and upload rates. Be realistic about what your uplink can actually deliver when everyone is online at once.' },
        { title: 'Set the price and validity', text: 'Together these define the billing cycle.' },
        { title: 'Add a fair use limit if you need one', text: 'Optional, but the humane way to manage contention — throttle rather than disconnect.' },
        { title: 'Publish it', text: 'Once saved it can be assigned to subscribers and offered on the captive portal.' },
      ] },

      { t: 'h2', text: 'Changing prices' },
      { t: 'p', text: 'Editing a package’s price affects future invoices, not ones already raised. For a broad price change, tell subscribers before it takes effect — a surprise price rise is the most reliable way to generate a wave of cancellations and disputes.' },

      { t: 'h2', text: 'Deleting a package' },
      { t: 'callout', kind: 'danger', title: 'Subscribers must be moved first', text: 'A package with subscribers on it cannot be removed, and the restriction is protective: deleting it would leave those accounts with no attributes to hand the router, and they would stop being able to authenticate. Move them to another package first.' },

      { t: 'h2', text: 'Designing a good range' },
      { t: 'ul', items: [
        'Three to five packages is plenty. Long menus paralyse customers and multiply support questions.',
        'Make the steps between tiers obvious — a customer should be able to see why the next one up costs more.',
        'Match validity to how your customers actually pay. Daily and weekly options matter where income is irregular.',
        'Do not oversell your uplink. A package nobody can actually achieve at peak is a refund request waiting to happen.',
      ] },
    ],
  },

  'captive-portal': {
    title: 'Captive portal',
    description: 'The branded login page Hotspot users see, and how to make it work reliably.',
    blocks: [
      { t: 'p', text: 'The captive portal is the page that appears when someone connects to your Hotspot. It is where they log in, buy a package or redeem a voucher — and for many customers it is the only part of your system they ever see.' },

      { t: 'h2', text: 'What subscribers can do there' },
      { t: 'ul', items: [
        'Log in with an existing account.',
        'Redeem a [voucher](/docs/vouchers) code.',
        'Buy a package and pay by M-Pesa, then be connected automatically.',
        'See how much time or data they have left.',
      ] },

      { t: 'h2', text: 'Branding' },
      { t: 'p', text: 'Your logo, colours and business name come from your ISP profile in [Settings](/docs/settings). Keep it recognisably yours — an unbranded portal looks like an interception attempt, and cautious users will simply disconnect.' },

      { t: 'h2', text: 'The walled garden' },
      { t: 'p', text: 'The walled garden is the set of destinations an unauthenticated user is allowed to reach. It must include everything the portal itself depends on, or the page cannot function for someone who has not yet logged in.' },
      { t: 'callout', kind: 'danger', title: 'Payment endpoints must be in the walled garden', text: 'If a subscriber has to pay before they get access, the payment gateway has to be reachable **before** they are authenticated. Miss this and the portal loads, the customer enters their number, and the payment silently fails — the single most common captive portal fault there is.' },
      { t: 'p', text: 'The walled garden normally needs your portal host, your payment gateway’s endpoints, and any fonts or scripts the page loads. Provisioning configures this for you; it is worth re-checking after you change payment providers.' },

      { t: 'h2', text: 'The portal address must be public' },
      { t: 'callout', kind: 'warning', title: 'A misconfigured portal address gives a blank page', text: 'Subscribers are redirected to the configured portal address by the router. If that address is a development or internal one, the phone is sent somewhere it cannot reach and gets a blank page. Confirm the portal URL in Settings is your real public hostname — and after changing it, re-run **Configure services** on every Hotspot router so they pick up the new address and walled-garden entries.' },

      { t: 'h2', text: 'Testing it properly' },
      { t: 'steps', items: [
        { title: 'Use a real phone on mobile data', text: 'Then connect it to the Hotspot. Testing from a laptop already on your LAN proves nothing.' },
        { title: 'Forget the network first', text: 'A device that has connected before may skip the portal entirely and mask a broken page.' },
        { title: 'Complete a real purchase', text: 'Pay a small amount end to end. The failure modes are almost all in the payment leg.' },
        { title: 'Test on both Android and iPhone', text: 'Their captive portal detection behaves differently, and a page that works on one can fail on the other.' },
      ] },
    ],
  },
};
