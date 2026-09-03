export default {
  'communications-overview': {
    title: 'Communications overview',
    description: 'Everything Lumen sends your subscribers, and how the sending is configured.',
    blocks: [
      { t: 'p', text: 'Communications covers every outbound message: renewal reminders, payment receipts, expiry warnings, bulk announcements and the promotional space on your captive portal. Configured well, it collects money and prevents support calls without anyone doing anything.' },

      { t: 'h2', text: 'The channels' },
      { t: 'cards', items: [
        { icon: 'bolt', title: 'SMS', text: 'The workhorse. Reaches every subscriber regardless of handset or data.', to: '/docs/sms' },
        { icon: 'book', title: 'Email', text: 'For invoices, receipts and anything that benefits from an attachment.', to: '/docs/messaging-providers' },
        { icon: 'users', title: 'WhatsApp', text: 'Rich, conversational, and often cheaper at volume.', to: '/docs/whatsapp' },
        { icon: 'card', title: 'Portal banners', text: 'Promotional space shown to users on the captive portal.', to: '/docs/promo-banners' },
      ] },

      { t: 'h2', text: 'Automatic versus deliberate' },
      { t: 'table', head: ['', 'Automatic', 'Campaign'], rows: [
        ['Triggered by', 'An event — expiry approaching, payment received', 'You, deliberately'],
        ['Audience', 'One subscriber', 'A filtered group'],
        ['Examples', 'Renewal reminder, receipt, expiry warning', 'Price change, planned outage, new package'],
        ['Configure at', '[Notifications and templates](/docs/notifications)', '[Message campaigns](/docs/campaigns)'],
      ] },

      { t: 'h2', text: 'Before anything sends' },
      { t: 'p', text: 'A gateway must be configured. Until it is, messages are composed and logged but never delivered — deliberately, so an unconfigured system does not silently appear to work.' },
      { t: 'callout', kind: 'warning', title: '"The SMS never arrived" is often not a bug', text: 'With no SMS gateway configured, messages fall through to the log rather than being sent. Check the system log to confirm the message was composed, then check whether a gateway is configured at all. See [Messaging providers and sender IDs](/docs/messaging-providers).' },

      { t: 'h2', text: 'Message discipline' },
      { t: 'ul', items: [
        'Send fewer, better messages. Subscribers who learn to ignore you will also ignore the important ones.',
        'Every message should be actionable or genuinely informative.',
        'Respect the hour — nobody wants a marketing message at 6am.',
        'Always identify yourself. An unbranded SMS about payment reads exactly like a scam.',
      ] },
    ],
  },

  sms: {
    title: 'SMS',
    description: 'The primary channel for reaching subscribers — configuration, cost and content.',
    blocks: [
      { t: 'p', text: 'SMS reaches every subscriber, on every handset, without data or an app. For an ISP it is the only channel that works when the customer is offline — which is precisely when you most need to reach them.' },
      { t: 'callout', kind: 'tip', title: 'Why SMS matters more here than elsewhere', text: 'An expired subscriber has no internet. Email and WhatsApp cannot reach them. SMS is the only channel that still works at the exact moment you need them to renew.' },

      { t: 'h2', text: 'What gets sent' },
      { t: 'ul', items: [
        'Renewal reminders before expiry.',
        'Payment receipts confirming money was received.',
        'Expiry notices when access stops.',
        'Planned maintenance and outage notices.',
        'Credentials and account details at activation.',
      ] },

      { t: 'h2', text: 'Cost' },
      { t: 'p', text: 'Every SMS costs money, and the cost scales with your subscriber base. Two things control it: how many you send, and how long each one is.' },
      { t: 'callout', kind: 'warning', title: 'Message length changes the price', text: 'A single SMS is 160 characters of plain GSM text. Exceed that and it is split and billed as multiple messages. Worse, a single non-GSM character — a curly apostrophe, an emoji, an accented letter — switches the whole message to Unicode encoding, cutting the limit to 70 characters and often tripling the cost of every message you send.' },
      { t: 'p', text: 'Keep templates in plain ASCII and under 160 characters. Check the length after substituting a long business name, because the template is not what gets sent.' },

      { t: 'h2', text: 'Writing an SMS' },
      { t: 'ul', items: [
        'Lead with what matters. It may be read in a notification preview and nowhere else.',
        'Identify your business in the first few words.',
        'Include the amount and the account number for anything payment-related.',
        'Give one clear action.',
        'Never include a login credential or anything a scammer could reuse.',
      ] },
      { t: 'code', lang: 'text', title: 'A workable reminder', code: 'Acme Net: your 10Mbps plan expires in 3 days.\nPay KES 2500 to paybill 123456, account AC-4471.\nHelp: 0700 000 000' },

      { t: 'h2', text: 'Sender ID' },
      { t: 'p', text: 'The name recipients see instead of a phone number. A registered sender ID makes your messages recognisable and much harder to impersonate. Registration is handled by your gateway and can take days, so start it early. See [Messaging providers and sender IDs](/docs/messaging-providers).' },

      { t: 'h2', text: 'Delivery' },
      { t: 'p', text: 'Sent is not delivered. A message accepted by the gateway can still fail at the network — a switched-off handset, an invalid number, a barred subscriber. Check delivery reports before concluding a customer ignored you.' },
    ],
  },

  campaigns: {
    title: 'Message campaigns',
    description: 'Send a deliberate message to a filtered group of subscribers.',
    blocks: [
      { t: 'p', text: 'A campaign is a one-off send to many subscribers at once — a price change, a planned outage, a new package. Unlike automatic notifications, you choose the audience and the moment.' },

      { t: 'h2', text: 'Running one' },
      { t: 'steps', items: [
        { title: 'Filter the audience', text: 'By package, status, router or area. The filter is the campaign — get it wrong and the right message reaches the wrong people.' },
        { title: 'Check the count', text: 'Confirm the number of recipients matches what you expect **before** you continue. This is the last honest check you get.' },
        { title: 'Write the message', text: 'Mind the length; see [SMS](/docs/sms).' },
        { title: 'Send yourself a test', text: 'Read it on a real handset. Substituted fields and line breaks look different there.' },
        { title: 'Send', text: 'Delivery is tracked per recipient.' },
      ] },
      { t: 'callout', kind: 'danger', title: 'A campaign cannot be recalled', text: 'Once messages are handed to the gateway they are gone. There is no unsend. The recipient count and a test message are the only safeguards, so use both every time.' },

      { t: 'h2', text: 'Targeting that is actually useful' },
      { t: 'table', head: ['Audience', 'Good for'], rows: [
        ['Expiring in the next 3 days', 'A renewal push'],
        ['Expired in the last 30 days', 'Win-back offers'],
        ['One router or area', 'Planned maintenance affecting only that site'],
        ['A specific package', 'Price change or upgrade offer'],
        ['All active', 'Genuinely universal news — use sparingly'],
      ] },

      { t: 'h2', text: 'Cost control' },
      { t: 'p', text: 'A campaign to every subscriber costs the per-message price times your entire base, and it is easy to spend a great deal in one click. Confirm the recipient count and multiply it by your rate before sending anything estate-wide.' },

      { t: 'h2', text: 'Timing' },
      { t: 'ul', items: [
        'Business hours only, unless it is a genuine outage notice.',
        'Renewal reminders land best in the morning, while people can act.',
        'Never send bulk marketing at night — it produces complaints, not sales.',
        'For outages, send **before** where you can. A warning is a service; an apology afterwards is not.',
      ] },
    ],
  },

  'promo-banners': {
    title: 'Captive promo banners',
    description: 'Promotional space on the captive portal, shown to people already looking at your page.',
    blocks: [
      { t: 'p', text: 'Banners appear on the captive portal, where you have the attention of someone who is actively trying to get online. It is the only advertising space you own where the audience is already engaged.' },

      { t: 'h2', text: 'What works there' },
      { t: 'ul', items: [
        '**Package upgrades** — shown to someone who has just noticed their speed.',
        '**New packages or promotions**, at the moment of purchase.',
        '**Referral offers**, when they are already thinking about your service.',
        '**Service notices**, such as planned maintenance.',
      ] },
      { t: 'callout', kind: 'tip', title: 'Do not stand between them and the internet', text: 'The visitor came to get online, not to read. A banner that delays or obscures the login turns a promotional opportunity into a complaint. Promote alongside the login, never in front of it.' },

      { t: 'h2', text: 'Designing one' },
      { t: 'ul', items: [
        'One message. A banner offering three things communicates none of them.',
        'Readable on a phone in daylight — that is the real viewing condition.',
        'Include the price. An offer without one is ignored.',
        'Keep the image small; it loads over a connection that is not yet authenticated.',
      ] },
      { t: 'callout', kind: 'warning', title: 'Banner assets must be in the walled garden', text: 'The visitor has not authenticated yet. If your image is hosted somewhere unauthenticated users cannot reach, it silently fails to load and the banner appears broken. Host assets on the portal itself, or add the host to the walled garden — see [Captive portal](/docs/captive-portal).' },

      { t: 'h2', text: 'Measuring' },
      { t: 'p', text: 'Judge a banner by what it caused, not by how it looked: package upgrades or purchases during the period it ran. Change one thing at a time, or you will not know which change worked.' },
    ],
  },

  whatsapp: {
    title: 'WhatsApp',
    description: 'Reach subscribers on the channel most of them already use all day.',
    blocks: [
      { t: 'p', text: 'WhatsApp is where many customers already are. It carries more than 160 characters, supports images and documents, and is often cheaper than SMS at volume — but it comes with rules SMS does not have.' },

      { t: 'h2', text: 'WhatsApp versus SMS' },
      { t: 'table', head: ['', 'WhatsApp', 'SMS'], rows: [
        ['Needs internet', 'Yes — on the recipient’s side', 'No'],
        ['Reaches an expired subscriber', 'Only on mobile data', 'Always'],
        ['Message length', 'Long, with formatting', '160 characters per part'],
        ['Attachments', 'Yes — invoices, receipts', 'No'],
        ['Cost at volume', 'Usually lower', 'Usually higher'],
      ] },
      { t: 'callout', kind: 'danger', title: 'Never use WhatsApp alone for renewal reminders', text: 'A subscriber whose service has lapsed has no internet. If they are not on mobile data, your reminder cannot arrive. The one message that must always land is the one WhatsApp is least able to deliver — send renewal reminders by SMS.' },

      { t: 'h2', text: 'Templates and the session window' },
      { t: 'p', text: 'WhatsApp restricts business-initiated messages. Outside an open conversation you may only send pre-approved template messages; free-form replies are allowed for a limited window after the customer writes to you.' },
      { t: 'ul', items: [
        'Get templates approved before you need them — approval is not instant.',
        'Keep a template for each routine message: reminder, receipt, activation.',
        'Answer inbound messages promptly, while the free-form window is open.',
      ] },

      { t: 'h2', text: 'Good uses' },
      { t: 'ul', items: [
        'Sending invoices and receipts as documents.',
        'Support conversations, where back-and-forth is natural.',
        'Installation coordination, including photos and location pins.',
        'Onboarding, where you can send more than a line of text.',
      ] },
    ],
  },

  'messaging-providers': {
    title: 'Messaging providers and sender IDs',
    description: 'Connect an SMS gateway and SMTP server, and register the name your messages come from.',
    blocks: [
      { t: 'p', text: 'Nothing sends until a provider is configured. This page covers connecting one and proving it works.' },

      { t: 'h2', text: 'Where configuration is resolved' },
      { t: 'p', text: 'Lumen looks for your own credentials first and falls back to any platform-level configuration only if yours are absent.' },
      { t: 'callout', kind: 'danger', title: 'Resolution is all-or-nothing per source', text: 'A partially filled configuration falls back **as a whole** — it is never blended field by field with the platform defaults. That is deliberate: pairing your SMTP host with a platform password produces an authentication error that reads exactly like a wrong password, and sends people hunting entirely the wrong problem. Fill it in completely, or leave it empty.' },

      { t: 'h2', text: 'SMS gateway' },
      { t: 'p', text: 'Configure your provider’s credentials under **Settings → Communications**. Africa’s Talking is the common choice in East Africa.' },
      { t: 'fields', items: [
        { name: 'Provider', type: 'enum', required: true, text: 'Which gateway you are using.' },
        { name: 'API key', type: 'secret', required: true, text: 'From your provider’s dashboard.' },
        { name: 'Username', type: 'string', required: true, text: 'Your account identifier with the provider.' },
        { name: 'Sender ID', type: 'string', text: 'The registered name recipients see. Without one, messages come from a shortcode.' },
      ] },

      { t: 'h2', text: 'SMTP for email' },
      { t: 'fields', items: [
        { name: 'Host and port', type: 'string', required: true, text: 'Your mail server. Port 587 with STARTTLS is the usual choice.' },
        { name: 'Username and password', type: 'secret', required: true, text: 'Credentials for the sending mailbox.' },
        { name: 'From address', type: 'email', required: true, text: 'What recipients see. It must be an address the server is authorised to send as, or your mail will be rejected or land in spam.' },
      ] },

      { t: 'h2', text: 'Test before you rely on it' },
      { t: 'p', text: 'Both integrations have a test action that performs a **real** send and returns the gateway’s own response — including its refusal text when it refuses. That is far more useful than a generic failure message, because it names the actual problem.' },
      { t: 'callout', kind: 'note', title: 'Tests are rate limited', text: 'A small number of tests are allowed per few minutes. This stops a misconfigured retry loop burning your message credit while you experiment.' },

      { t: 'h2', text: 'Registering a sender ID' },
      { t: 'steps', items: [
        { title: 'Choose a name', text: 'Short, recognisable, and clearly yours. Most networks allow up to eleven characters.' },
        { title: 'Apply through your gateway', text: 'They handle registration with the mobile networks.' },
        { title: 'Provide business documents', text: 'Registration certificates are normally required to prove the name is legitimately yours.' },
        { title: 'Wait', text: 'Approval takes days to weeks depending on the network. Start well before you need it.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'A sender ID is anti-fraud', text: 'Payment messages from a recognisable name are trusted and acted on. The same message from an anonymous shortcode looks like a scam — and increasingly, customers are right to treat it as one.' },
    ],
  },

  notifications: {
    title: 'Notifications and templates',
    description: 'The automatic messages Lumen sends on your behalf, and how to word them.',
    blocks: [
      { t: 'p', text: 'Notifications are triggered by events rather than sent by you. Configured once, they run forever — which makes them the highest-leverage messages in the system, and the ones most worth writing carefully.' },

      { t: 'h2', text: 'The events' },
      { t: 'table', head: ['Event', 'When it fires', 'Why it matters'], rows: [
        ['**Renewal reminder**', 'A configured period before expiry', 'The single highest-value message you send'],
        ['**Expiry notice**', 'When validity ends', 'Explains why they are offline before they call you'],
        ['**Payment receipt**', 'When a payment is recorded', 'Confirms money arrived; prevents disputes'],
        ['**Activation**', 'When an account is created', 'Delivers account details and support contacts'],
        ['**Suspension**', 'When an account is suspended', 'Explains an otherwise baffling loss of service'],
      ] },
      { t: 'callout', kind: 'tip', title: 'The renewal reminder pays for everything else', text: 'Most late payments are forgetfulness, not refusal. A reminder timed a few days before expiry collects from people who would otherwise lapse, call, and take up staff time. If you configure one notification, configure that one.' },

      { t: 'h2', text: 'Templates' },
      { t: 'p', text: 'Each notification has a template with placeholders substituted at send time — the subscriber’s name, amount due, expiry date, your paybill and account number. Default templates are created with your account and are worth rewriting in your own voice.' },
      { t: 'callout', kind: 'warning', title: 'Test with real data', text: 'A template that reads well in the editor can break when a long business name or a missing field is substituted. Send yourself one against a real subscriber before enabling it for everybody.' },

      { t: 'h2', text: 'Timing' },
      { t: 'ul', items: [
        '**Three days before expiry** is the usual sweet spot for reminders — long enough to act, close enough to matter.',
        'A second reminder on the day is worthwhile; a third is nagging.',
        'Receipts should be immediate. Delay makes customers think the payment failed.',
        'Keep automatic messages inside business hours.',
      ] },

      { t: 'h2', text: 'What never to include' },
      { t: 'ul', items: [
        'Passwords or PPPoE credentials — anyone who sees the phone sees them.',
        'Links that ask for payment details. Teach customers to distrust these, not to follow them.',
        'Anything you would not want forwarded to a competitor or screenshotted.',
      ] },
      { t: 'callout', kind: 'danger', title: 'Your messages train your customers', text: 'If you send links asking for payment, you teach subscribers that such messages are normal — and the next one they receive will be from somebody impersonating you. Always direct them to a paybill and account number they can verify, never to a link.' },
    ],
  },
};
