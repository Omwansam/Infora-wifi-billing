export default {
  'portal-overview': {
    title: 'Customer portal overview',
    description: 'The self-service area where subscribers manage their own account.',
    blocks: [
      { t: 'p', text: 'The customer portal lets subscribers do for themselves what they would otherwise call you about: check their balance, pay, see when they expire, and raise a ticket. Every one of those is a support call you do not take.' },

      { t: 'h2', text: 'What subscribers can do' },
      { t: 'cards', items: [
        { icon: 'users', title: 'Manage their account', text: 'View and update their contact details and see their status.', to: '/docs/portal-access' },
        { icon: 'card', title: 'Buy and renew', text: 'Purchase packages, top up, and redeem vouchers.', to: '/docs/portal-packages' },
        { icon: 'chart', title: 'See usage and documents', text: 'Check data used, session history, invoices and receipts.', to: '/docs/portal-usage' },
        { icon: 'wrench', title: 'Get help', text: 'Raise a support ticket that arrives already linked to their account.', to: '/docs/portal-tickets' },
      ] },

      { t: 'h2', text: 'Why it is worth promoting' },
      { t: 'p', text: 'Most support calls are three questions: how much do I owe, when do I expire, and how do I pay. All three are answered here without staff involvement, at any hour.' },
      { t: 'callout', kind: 'tip', title: 'Put the address in your messages', text: 'Include the portal link in activation and renewal messages. Subscribers use what they are shown; a portal nobody knows about saves nobody any time.' },

      { t: 'h2', text: 'Portal and captive portal are different' },
      { t: 'table', head: ['', 'Customer portal', 'Captive portal'], rows: [
        ['Who sees it', 'A subscriber who signs in deliberately', 'Anyone connecting to the Hotspot'],
        ['Purpose', 'Manage an ongoing account', 'Get online right now'],
        ['Reached by', 'A URL you publish', 'Automatic redirect on connection'],
        ['Covered in', 'This page', '[Captive portal](/docs/captive-portal)'],
      ] },

      { t: 'h2', text: 'Access while expired' },
      { t: 'p', text: 'A subscriber whose service has lapsed still needs to reach the portal to pay — which is precisely when they have no internet through you. Make sure the portal is reachable from an expired session, or the people who most need to pay you cannot.' },
      { t: 'callout', kind: 'danger', title: 'The circular failure', text: 'If paying requires internet and internet requires paying, expired subscribers cannot recover without calling you. The portal and your payment gateway must both be reachable from an unauthenticated or expired session — see the walled garden in [Captive portal](/docs/captive-portal).' },
    ],
  },

  'portal-access': {
    title: 'Portal access and profile',
    description: 'How subscribers sign in and what they can change about themselves.',
    blocks: [
      { t: 'h2', text: 'Signing in' },
      { t: 'p', text: 'Subscribers sign in with the identifier you have recorded for them — commonly their phone number or account number, with a password or a one-time code. Choose the method your customers can actually complete without help: for many, a code sent by SMS beats a password they will forget.' },

      { t: 'h2', text: 'What they can see' },
      { t: 'ul', items: [
        'Their package, and the speed it provides.',
        'Their status and expiry date.',
        'Their balance, and whether anything is owed.',
        'Their account number, for making payments.',
      ] },

      { t: 'h2', text: 'What they can change' },
      { t: 'p', text: 'Contact details — phone, email, and how they wish to be contacted. Keep this narrow deliberately: a subscriber should not be able to change their own package price, their status, or anything that determines what they are charged.' },
      { t: 'callout', kind: 'warning', title: 'A changed phone number changes your reach', text: 'The phone number is both the login and the notification channel. When a subscriber updates it, renewal reminders follow it. Make sure changes are verified rather than accepted blindly, or a typo silently removes them from every message you send.' },

      { t: 'h2', text: 'Password resets' },
      { t: 'p', text: 'Resets go to the verified phone or email on the account. This is why verifying contact details at capture matters: a subscriber whose recorded number is wrong cannot recover their own access and must call you, which is the situation the portal exists to avoid.' },

      { t: 'h2', text: 'Helping a subscriber who cannot sign in' },
      { t: 'ol', items: [
        'Confirm the number or account they are using matches the record.',
        'Check the account is not suspended — a suspended subscriber may be blocked from signing in.',
        'Confirm their contact details are correct, since that is where a reset would go.',
        'Correct the record and have them retry, rather than reading them a credential over the phone.',
      ] },
    ],
  },

  'portal-packages': {
    title: 'Packages, top-ups, and vouchers',
    description: 'How subscribers buy and renew without contacting you.',
    blocks: [
      { t: 'p', text: 'Self-service purchase is where the portal pays for itself. A subscriber who can renew at midnight without calling anyone is a subscriber who stays connected — and one who does not generate a support call.' },

      { t: 'h2', text: 'Renewing' },
      { t: 'steps', items: [
        { title: 'They open the portal', text: 'Their current package and expiry are shown.' },
        { title: 'They choose to renew', text: 'Or select a different package.' },
        { title: 'They pay', text: 'By M-Pesa STK push, they confirm on their phone. See [M-Pesa (Daraja)](/docs/mpesa).' },
        { title: 'Access extends immediately', text: 'Validity is added to their existing expiry, so paying early costs them nothing.' },
      ] },

      { t: 'h2', text: 'Upgrading and downgrading' },
      { t: 'p', text: 'Subscribers can move between the packages you have published. Decide and document how mid-cycle changes are priced — whether an upgrade is prorated or starts a fresh period — and apply it consistently. Inconsistency here is remembered and quoted back at you.' },
      { t: 'callout', kind: 'note', title: 'Speed changes at the next session', text: 'Package attributes are handed to the router when a session starts. A subscriber who upgrades mid-session keeps their old speed until they reconnect. Telling them to restart their router is a legitimate and complete answer.' },

      { t: 'h2', text: 'Redeeming a voucher' },
      { t: 'p', text: 'Subscribers can enter a voucher code in the portal to add access without a card or mobile money transaction — useful for anyone who buys credit in cash from an agent. See [Vouchers](/docs/vouchers).' },

      { t: 'h2', text: 'What to publish' },
      { t: 'ul', items: [
        'Show the price and the validity together. A price without a period is not an offer.',
        'Keep the list short. The same three-to-five packages that work on the captive portal work here.',
        'Do not expose legacy or negotiated packages — those belong to the accounts that hold them.',
      ] },
    ],
  },

  'portal-usage': {
    title: 'Usage, invoices, and receipts',
    description: 'The records subscribers can retrieve for themselves.',
    blocks: [
      { t: 'h2', text: 'Usage' },
      { t: 'p', text: 'Subscribers can see how much data they have used, their session history, and — where a fair-use policy applies — how much of their allowance remains.' },
      { t: 'callout', kind: 'tip', title: 'Visible usage prevents arguments', text: 'A subscriber who can see they have used their allowance rarely disputes being throttled. One who is throttled with no explanation always does. Showing the number converts a complaint into an upgrade conversation.' },

      { t: 'h2', text: 'Session history' },
      { t: 'p', text: 'When they connected, for how long, and how much moved. This is genuinely useful during a fault report: a subscriber who can see repeated short sessions is describing an intermittent link, and that is a far more precise report than "it keeps going off".' },

      { t: 'h2', text: 'Invoices' },
      { t: 'p', text: 'Business subscribers in particular need to retrieve invoices themselves, usually at month end and usually urgently. Making them available here removes a recurring interruption. See [Invoices](/docs/invoices).' },

      { t: 'h2', text: 'Receipts' },
      { t: 'p', text: 'Every payment produces a receipt showing the amount, date, method and reference. For M-Pesa the reference is the transaction code, which lets a subscriber match your record against their own phone.' },
      { t: 'callout', kind: 'tip', title: 'This settles most payment disputes', text: 'A subscriber who can compare their M-Pesa message to your receipt, and see the same code on both, stops disputing. Where the codes do not match, you have learned something specific instead of arguing about memory.' },

      { t: 'h2', text: 'Fair use visibility' },
      { t: 'p', text: 'Where a package carries a data allowance, show what remains. A throttle that arrives without warning reads as a fault and generates a ticket; one the subscriber watched approaching reads as the policy they agreed to. See [Fair use policy](/docs/fup).' },
    ],
  },

  'portal-tickets': {
    title: 'Portal support tickets',
    description: 'Let subscribers report faults themselves, with the context already attached.',
    blocks: [
      { t: 'p', text: 'A ticket raised from the portal arrives already linked to the subscriber, their package and their router. Nobody has to establish who is calling, and nothing is mistyped.' },

      { t: 'h2', text: 'Why this beats a phone call' },
      { t: 'ul', items: [
        'The account is identified automatically — no spelling out names.',
        'It can be raised at 2am, when your office is closed and the fault is happening.',
        'It creates a written record both sides can refer back to.',
        'It arrives in the same queue as everything else, so nothing is lost in someone’s phone.',
      ] },

      { t: 'h2', text: 'Asking the right questions' },
      { t: 'p', text: 'A subscriber reporting a fault does not know what is diagnostically useful. Prompt for it:' },
      { t: 'ul', items: [
        'What exactly is happening — no connection at all, or slow?',
        'When did it start?',
        'Does it affect all devices, or one?',
        'Have the router lights changed?',
      ] },
      { t: 'callout', kind: 'tip', title: 'Four questions save a site visit', text: '"All devices, started after the storm, no lights on the router" is a diagnosis before anyone travels. "Internet not working" is a phone call, then a visit, then the same four questions.' },

      { t: 'h2', text: 'Keeping the subscriber informed' },
      { t: 'p', text: 'Updates you add are visible to the subscriber. Use that: a customer who can see their fault is being worked stops calling to ask. Silence produces chasing calls that cost more time than the update would have.' },

      { t: 'h2', text: 'Closing' },
      { t: 'p', text: 'Close with a resolution the subscriber can read and understand. "Replaced faulty injector at the pole" is a resolution; "resolved" is a shrug. The first builds confidence, the second invites a follow-up call to ask what actually happened.' },
      { t: 'p', text: 'Staff-side handling in [Support tickets](/docs/tickets).' },
    ],
  },
};
