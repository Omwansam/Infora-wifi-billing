export default {
  'subscription-renewal': {
    title: 'Subscription and renewal',
    description: 'How recurring billing works — for your subscribers, and for your own Lumen account.',
    blocks: [
      { t: 'callout', kind: 'note', title: 'Two different subscriptions', text: 'This page covers both. **Subscriber subscriptions** are what your customers pay you for internet. The **platform subscription** is what you pay to run Lumen. They are unrelated, and a problem with one never affects the other.' },

      { t: 'h2', text: 'Subscriber renewal' },
      { t: 'p', text: 'A subscriber holds a package with a validity period. When that period ends they must renew to keep access. The cycle is the same regardless of how they pay.' },
      { t: 'steps', items: [
        { title: 'Validity approaches its end', text: 'The account is still active and online.' },
        { title: 'A reminder is sent', text: 'Before expiry, not after — see [Notifications and templates](/docs/notifications).' },
        { title: 'Payment arrives', text: 'By M-Pesa, cash, or bank. Validity extends from the current expiry, so paying early never costs the customer days.' },
        { title: 'Or validity lapses', text: 'The account becomes expired. New sessions are refused; existing ones end at the next accounting interval.' },
        { title: 'Late payment restores access', text: 'Access returns on payment without any manual intervention.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'Remind before, not after', text: 'A reminder sent the day after cut-off arrives to a customer who is already angry and already offline. One sent three days before arrives to a customer who can still act, and collects far more.' },

      { t: 'h2', text: 'Renewal from expiry, not from payment' },
      { t: 'p', text: 'Extending from the existing expiry date means a subscriber who pays two days early does not lose those two days. Extending from the payment date would quietly shorten every early payment and is the sort of thing customers notice and resent.' },

      { t: 'h2', text: 'Automatic collection' },
      { t: 'p', text: 'With a payment gateway connected, renewals can collect themselves — the subscriber is prompted and pays without contacting you. This is the single largest reduction in collection effort available to you. See [M-Pesa (Daraja)](/docs/mpesa).' },

      { t: 'h2', text: 'Your platform subscription' },
      { t: 'p', text: 'Your Lumen account is billed on its own subscription. Manage it under **Subscription**, where you can see your plan, next billing date, and invoice history.' },
      { t: 'callout', kind: 'warning', title: 'Your network keeps running regardless', text: 'If your platform subscription lapses, console access is restricted — but RADIUS, your routers and your subscribers’ connectivity are never interrupted. A billing problem between you and Lumen must never take your customers offline, and it does not.' },
    ],
  },

  payments: {
    title: 'Payments',
    description: 'Record, reconcile and investigate every payment your subscribers make.',
    blocks: [
      { t: 'p', text: 'The payments ledger is every shilling received, however it arrived. It is the screen you open to answer "did this customer pay", and the one you reconcile against your bank and M-Pesa statements.' },

      { t: 'h2', text: 'How payments arrive' },
      { t: 'table', head: ['Method', 'How it is recorded', 'Reconciliation'], rows: [
        ['**M-Pesa**', 'Automatically, via gateway callback', 'Gateway transaction code matches the customer’s SMS'],
        ['**Cash**', 'Entered by staff', 'Against the cash book and the recording user'],
        ['**Bank transfer**', 'Entered by staff from the statement', 'Against the bank statement reference'],
        ['**Voucher**', 'At the moment of redemption', 'Against the agent float — see [Voucher agents](/docs/voucher-agents)'],
      ] },

      { t: 'h2', text: 'What a payment record holds' },
      { t: 'fields', items: [
        { name: 'Amount', type: 'money', text: 'In your account currency.' },
        { name: 'Method', type: 'enum', text: 'How it was received. Drives how you reconcile it.' },
        { name: 'Reference', type: 'string', text: 'The gateway transaction code, or the bank reference. For M-Pesa this is what the customer can read off their own phone — the most useful field on the record during a dispute.' },
        { name: 'Subscriber', type: 'link', text: 'Which account it was applied to.' },
        { name: 'Recorded by', type: 'user', text: 'The staff member, for manual entries. Automatic payments show the gateway.' },
        { name: 'Received at', type: 'datetime', text: 'When the money arrived, which may differ from when it was recorded.' },
      ] },

      { t: 'h2', text: 'Recording a manual payment' },
      { t: 'p', text: 'For cash and bank transfers, record the payment against the subscriber and enter the real reference. Access extends immediately.' },
      { t: 'callout', kind: 'warning', title: 'Always enter a reference', text: 'A cash payment with no reference is impossible to reconcile later and impossible to defend if a customer disputes it. The receipt number is the minimum.' },

      { t: 'h2', text: 'Investigating "I paid and I am still off"' },
      { t: 'steps', items: [
        { title: 'Ask for the transaction code', text: 'The customer has it in their M-Pesa message. Search the ledger for it directly.' },
        { title: 'If it is in the ledger', text: 'The money arrived. Check which account it was applied to — payments to the wrong account number are common.' },
        { title: 'If it is not in the ledger', text: 'The callback did not arrive or the payment failed at the gateway. See [M-Pesa (Daraja)](/docs/mpesa).' },
        { title: 'Check the amount', text: 'A partial payment may not cover the package and so may not have extended validity.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'The transaction code settles it', text: 'A customer with a genuine M-Pesa confirmation has a code. If that code is nowhere in your ledger, the failure is in the payment path, not in your billing — and telling them so honestly is far better than arguing about whether they paid.' },

      { t: 'h2', text: 'Refunds' },
      { t: 'p', text: 'Record refunds against the original payment so the ledger nets out correctly. A refund recorded as an unrelated negative entry makes reconciliation harder every month that follows.' },
    ],
  },

  invoices: {
    title: 'Invoices',
    description: 'Raise, send and track invoices, and understand when you actually need one.',
    blocks: [
      { t: 'p', text: 'An invoice is a formal request for payment. Prepaid consumer subscribers often need nothing more than a receipt, but business customers, corporate accounts and anyone claiming tax will require a proper invoice.' },

      { t: 'h2', text: 'When you need invoices' },
      { t: 'ul', items: [
        '**Business subscribers** who pay in arrears against terms.',
        '**Corporate accounts** whose finance department will not release payment without one.',
        '**Tax compliance**, where your jurisdiction requires an invoice per sale.',
        '**Installation and equipment charges** billed separately from access.',
      ] },

      { t: 'h2', text: 'Creating one' },
      { t: 'steps', items: [
        { title: 'Choose the subscriber', text: 'Their details are carried from their record onto the document.' },
        { title: 'Add line items', text: 'Package charges, installation, equipment. Describe each so the customer recognises it without calling you.' },
        { title: 'Set the due date', text: 'This is what the collections view uses to decide who is overdue.' },
        { title: 'Issue it', text: 'The invoice is numbered and can be sent by email or downloaded.' },
      ] },

      { t: 'h2', text: 'Invoice states' },
      { t: 'table', head: ['State', 'Meaning'], rows: [
        ['Draft', 'Being prepared; not yet a formal document and freely editable'],
        ['Issued', 'Sent to the customer and awaiting payment'],
        ['Paid', 'Settled in full and matched to one or more payments'],
        ['Partially paid', 'Some payment received; a balance remains'],
        ['Overdue', 'Past its due date and unpaid — appears in [Collections](/docs/collections)'],
        ['Cancelled', 'Voided. The number is retained, never reused'],
      ] },
      { t: 'callout', kind: 'warning', title: 'Cancel, never delete', text: 'Invoice numbers must be sequential and unbroken for audit. Cancelling voids the document while preserving the number; deleting it leaves a gap that your accountant, and possibly your tax authority, will ask about.' },

      { t: 'h2', text: 'Matching payments' },
      { t: 'p', text: 'Payments are applied to invoices to settle them. A partially paid invoice keeps its balance visible so it is not mistaken for settled, and one payment can settle several invoices where a customer pays a total.' },

      { t: 'h2', text: 'Numbering' },
      { t: 'p', text: 'Numbers are assigned sequentially at issue. Do not attempt to reuse or renumber — the sequence is what makes the ledger auditable.' },
    ],
  },

  expenses: {
    title: 'Expenses',
    description: 'Record what your business spends, so profitability is a number rather than a guess.',
    blocks: [
      { t: 'p', text: 'Revenue alone does not tell you whether you are making money. Expenses record the other side: bandwidth, power, rent, salaries, equipment and fuel. Together they answer whether the business works.' },

      { t: 'h2', text: 'Categories worth separating' },
      { t: 'table', head: ['Category', 'Typically includes'], rows: [
        ['**Bandwidth**', 'Your upstream transit — usually the largest single cost'],
        ['**Power**', 'Electricity, generator fuel, batteries at sites'],
        ['**Equipment**', 'Routers, radios, ONTs, cable'],
        ['**Salaries**', 'Staff and contracted technicians'],
        ['**Rent**', 'Office, tower space, colocation'],
        ['**Transport**', 'Fuel and vehicle costs for installations and callouts'],
        ['**Other**', 'Licences, software, professional fees'],
      ] },
      { t: 'callout', kind: 'tip', title: 'Split bandwidth and power out', text: 'They are the two costs that scale with growth and the two most likely to quietly ruin your margin. Lumped into "other" you will not notice until it is serious.' },

      { t: 'h2', text: 'Recording an expense' },
      { t: 'fields', items: [
        { name: 'Date', type: 'date', text: 'When it was incurred, not when you got round to entering it.' },
        { name: 'Category', type: 'enum', text: 'What makes reporting meaningful. Be consistent.' },
        { name: 'Amount', type: 'money', text: 'In your account currency.' },
        { name: 'Description', type: 'string', text: 'Specific enough to recognise a year later.' },
        { name: 'Reference', type: 'string', text: 'Receipt or invoice number from the supplier.' },
      ] },

      { t: 'h2', text: 'Recurring costs' },
      { t: 'p', text: 'Enter monthly costs every month, even when the amount never changes. A missing month understates your costs and overstates profit for that period, which is precisely the error that makes people expand at the wrong moment.' },

      { t: 'h2', text: 'Cost per subscriber' },
      { t: 'p', text: 'Total monthly cost divided by active subscribers is the most useful number this section produces. Compare it to your average revenue per subscriber: the gap is your real margin, and watching it move as you grow tells you whether growth is helping.' },
    ],
  },

  collections: {
    title: 'Collections and withdrawals',
    description: 'Chase what you are owed, and move collected money out to your own account.',
    blocks: [
      { t: 'h2', text: 'Collections' },
      { t: 'p', text: 'Collections is the list of subscribers who owe you money, ordered by how overdue they are. It is a work queue, not a report — it exists to be worked through until it is short.' },

      { t: 'h3', text: 'A workable routine' },
      { t: 'steps', items: [
        { title: 'Remind before expiry', text: 'Automatically. Most subscribers simply forget, and a timely reminder collects from them without any human effort.' },
        { title: 'Follow up the day after', text: 'A short, factual message. They are now offline and motivated.' },
        { title: 'Call at one week', text: 'By this point a message is not working and a conversation might.' },
        { title: 'Suspend, do not delete', text: 'Suspension preserves the account and history so restoration is instant when they pay.' },
        { title: 'Decide a write-off point', text: 'Set a limit — sixty or ninety days — beyond which you stop spending effort. Chasing indefinitely costs more than the debt.' },
      ] },
      { t: 'callout', kind: 'tip', title: 'Automate the first two steps', text: 'The pre-expiry reminder and the day-after follow-up collect the large majority of late payments and cost nothing once configured. Human effort should start where automation has already failed.' },

      { t: 'h3', text: 'Ageing' },
      { t: 'p', text: 'Debt is grouped by how long it has been outstanding. The shape matters more than the total: a small number of very old debts is a write-off decision, while a large volume of recently overdue accounts is a reminder problem you can fix.' },

      { t: 'h2', text: 'Withdrawals' },
      { t: 'p', text: 'Money collected through a payment gateway sits with that gateway until it is settled to your account. Withdrawals track that movement so you can reconcile what was collected against what actually reached your bank.' },
      { t: 'fields', items: [
        { name: 'Amount', type: 'money', text: 'What was moved out.' },
        { name: 'Destination', type: 'string', text: 'The bank account or mobile money account it went to.' },
        { name: 'Reference', type: 'string', text: 'The settlement reference, for matching against your bank statement.' },
        { name: 'Status', type: 'enum', text: 'Requested, processing or settled.' },
      ] },
      { t: 'callout', kind: 'warning', title: 'Collected is not the same as received', text: 'A payment recorded in Lumen means the gateway confirmed it. It does not mean the money is in your bank yet. Reconcile withdrawals separately, or you will overstate your available cash.' },
    ],
  },

  'payment-gateways': {
    title: 'Payment gateways',
    description: 'Connect the services that collect money from subscribers on your behalf.',
    blocks: [
      { t: 'p', text: 'A payment gateway lets subscribers pay without you being present. It is the difference between collecting money and chasing it, and it is usually the highest-leverage thing you can configure.' },

      { t: 'h2', text: 'Available methods' },
      { t: 'cards', items: [
        { icon: 'card', title: 'M-Pesa (Daraja)', text: 'Safaricom mobile money with STK push — the customer confirms on their phone and is connected automatically.', to: '/docs/mpesa' },
        { icon: 'book', title: 'Cash, bank and manual', text: 'Payments received outside any gateway, recorded by your staff.', to: '/docs/manual-payments' },
      ] },

      { t: 'h2', text: 'Where credentials live' },
      { t: 'p', text: 'Gateway credentials are configured per ISP under **Settings → Payments**. Credentials saved there take precedence over any platform-level defaults.' },
      { t: 'callout', kind: 'danger', title: 'Precedence is deliberate, and it cuts both ways', text: 'Your own credentials winning over a platform default is what stops a shared configuration silently routing your collections into somebody else’s account. The consequence is that a half-filled form is used exactly as entered rather than falling back to something that works — so complete the configuration, or clear it entirely.' },

      { t: 'h2', text: 'Callbacks' },
      { t: 'p', text: 'Gateways confirm payments by calling back to your Lumen instance. That callback address must be publicly reachable, or payments will succeed at the gateway and never appear in your ledger.' },
      { t: 'callout', kind: 'warning', title: 'The most common gateway fault', text: 'The customer is debited, the gateway is happy, and nothing appears in Lumen. That is almost always an unreachable callback address — not a failed payment. Check the callback URL before investigating anything else.' },

      { t: 'h2', text: 'Before you go live' },
      { t: 'steps', items: [
        { title: 'Test in sandbox', text: 'Confirm the whole flow with test credentials before touching real money.' },
        { title: 'Verify the callback arrives', text: 'A sandbox payment must appear in your ledger. If it does not, production will not either.' },
        { title: 'Check the walled garden', text: 'On a captive portal, unauthenticated users must be able to reach the gateway — see [Captive portal](/docs/captive-portal).' },
        { title: 'Make one real payment', text: 'A small live transaction end to end, before you tell customers the option exists.' },
      ] },
    ],
  },

  mpesa: {
    title: 'M-Pesa (Daraja)',
    description: 'Connect Safaricom Daraja so subscribers pay by phone and renewals collect themselves.',
    blocks: [
      { t: 'p', text: 'M-Pesa through Safaricom’s Daraja API is how most Kenyan ISPs collect. With STK push, the subscriber receives a prompt on their phone, enters their PIN, and access is restored automatically — no code to type, no staff involvement.' },

      { t: 'h2', text: 'What you need from Safaricom' },
      { t: 'fields', items: [
        { name: 'Consumer key', type: 'string', required: true, text: 'From your Daraja app. Identifies your application.' },
        { name: 'Consumer secret', type: 'string', required: true, text: 'The paired secret. Treat it as a password.' },
        { name: 'Shortcode', type: 'string', required: true, text: 'Your paybill or buygoods number — where the money actually lands.' },
        { name: 'Passkey', type: 'string', required: true, text: 'Issued for your shortcode. Required to initiate STK push.' },
        { name: 'Environment', type: 'enum', required: true, text: 'Sandbox for testing, production for real money. They use different base URLs and different credentials.' },
      ] },

      { t: 'h2', text: 'Setting it up' },
      { t: 'steps', items: [
        { title: 'Create a Daraja app', text: 'On Safaricom’s developer portal, create an app and note its consumer key and secret.' },
        { title: 'Get your shortcode and passkey', text: 'For production this means a real paybill or till and a passkey issued for it.' },
        { title: 'Enter the credentials', text: 'Under Settings → Payments. Save all five fields together.' },
        { title: 'Set the callback address', text: 'It must be publicly reachable from Safaricom’s systems.' },
        { title: 'Test in sandbox', text: 'Complete a payment end to end and confirm it appears in your ledger.' },
        { title: 'Switch to production', text: 'Swap in the production credentials and make one small real payment.' },
      ] },
      { t: 'callout', kind: 'danger', title: 'Sandbox credentials are not production credentials', text: 'Safaricom publishes test credentials — a well-known test shortcode and passkey — that work only against the sandbox. Pointing those at the production URL fails every time. If payments break the moment you go live, check that the environment and the credentials were changed **together**.' },

      { t: 'h2', text: 'How a payment flows' },
      { t: 'steps', items: [
        { title: 'The subscriber requests to pay', text: 'From the captive portal, the customer portal, or a staff-initiated prompt.' },
        { title: 'Lumen sends an STK push', text: 'Safaricom prompts the phone.' },
        { title: 'They enter their PIN', text: 'The transaction is authorised on their handset.' },
        { title: 'Safaricom calls back', text: 'The result is posted to your callback address.' },
        { title: 'Lumen records and activates', text: 'The payment is recorded and access is extended immediately.' },
      ] },

      { t: 'h2', text: 'When payments do not arrive' },
      { t: 'table', head: ['Symptom', 'Most likely cause'], rows: [
        ['No prompt on the phone', 'Wrong phone format, or credentials rejected before the push was sent'],
        ['Prompt appears, customer pays, nothing in Lumen', 'The callback did not reach you — the classic failure'],
        ['Everything worked in sandbox, fails in production', 'Sandbox credentials still in place, or environment not switched'],
        ['Works for staff, fails from the captive portal', 'M-Pesa endpoints missing from the walled garden'],
        ['Customer has a code, ledger has nothing', 'Callback lost; reconcile manually from the code'],
      ] },
      { t: 'callout', kind: 'tip', title: 'A transaction code is proof', text: 'If the customer can quote an M-Pesa code and it appears nowhere in your ledger, the money moved and your callback did not arrive. Record it manually to restore their service, then fix the callback — do not leave a paying customer offline while you debug.' },

      { t: 'h2', text: 'Paybill versus buygoods' },
      { t: 'p', text: 'A paybill takes an account number, which lets you match a payment to a subscriber automatically — use the subscriber’s account number. A buygoods till does not, so payments must be matched by phone number or by hand. For an ISP billing recurring accounts, a paybill is materially easier to reconcile.' },
    ],
  },

  'manual-payments': {
    title: 'Cash, bank and manual payments',
    description: 'Record money that arrives outside any gateway, without losing the audit trail.',
    blocks: [
      { t: 'p', text: 'Not every customer pays through a gateway. Cash at your office, a bank transfer, a cheque — all of it has to reach the ledger, and all of it has to be traceable afterwards.' },

      { t: 'h2', text: 'Recording one' },
      { t: 'steps', items: [
        { title: 'Open the subscriber', text: 'Record against the account so validity extends automatically.' },
        { title: 'Enter the amount and method', text: 'Cash, bank transfer or cheque.' },
        { title: 'Enter a real reference', text: 'A receipt number for cash; the bank reference for a transfer. This is what makes the entry reconcilable.' },
        { title: 'Set the date received', text: 'When the money actually arrived, which may not be today.' },
        { title: 'Save', text: 'Access extends immediately and a receipt can be sent.' },
      ] },
      { t: 'callout', kind: 'danger', title: 'A manual payment with no reference is unverifiable', text: 'It cannot be reconciled against a statement, and it cannot be defended if the customer disputes it or if you later need to establish who took the money. Make the reference mandatory in your own process even where the form allows blank.' },

      { t: 'h2', text: 'Controls for cash' },
      { t: 'p', text: 'Cash is the highest-risk payment method you handle, because a payment that is never recorded leaves no trace anywhere.' },
      { t: 'ul', items: [
        'Every staff member records under their own login — never a shared account. See [Staff and permissions](/docs/staff).',
        'Issue a receipt for every cash payment, every time.',
        'Reconcile cash recorded against cash banked, daily.',
        'Review the audit log for backdated or amended entries.',
      ] },
      { t: 'callout', kind: 'warning', title: 'Watch for backdating', text: 'A payment recorded with a date well before it was entered deserves a look. There are legitimate reasons — a bank transfer noticed late — but it is also how a shortfall gets covered up.' },

      { t: 'h2', text: 'Bank transfers' },
      { t: 'p', text: 'Reconcile from the statement rather than from customer claims. Match each credit to a subscriber using the reference, and follow up unmatched credits promptly — an unidentified payment is a customer who believes they have paid and is about to be cut off.' },

      { t: 'h2', text: 'Partial payments' },
      { t: 'p', text: 'Record what was actually received. Decide a consistent policy for whether a partial payment extends partial access, and apply it to everyone — inconsistency here is remembered and repeated back to you by customers.' },
    ],
  },
};
