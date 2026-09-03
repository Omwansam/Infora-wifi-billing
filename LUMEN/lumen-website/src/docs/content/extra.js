export default {
  kyc: {
    title: 'KYC and verification',
    description: 'Collect and verify subscriber identity documents where your regulator requires it.',
    blocks: [
      { t: 'p', text: 'Many regulators require an ISP to know who its subscribers are. KYC records the documents you collected, who checked them, and when — so you can demonstrate compliance rather than assert it.' },

      { t: 'h2', text: 'The workflow' },
      { t: 'steps', items: [
        { title: 'Documents are uploaded', text: 'By your staff at signup, or by the subscriber through the portal.' },
        { title: 'They await review', text: 'The account is flagged as pending verification.' },
        { title: 'A staff member reviews', text: 'Checking that the document is legible, valid, and matches the account name.' },
        { title: 'Verified or rejected', text: 'Rejection records a reason, so the subscriber can be told what to resubmit.' },
      ] },

      { t: 'h2', text: 'Verification states' },
      { t: 'table', head: ['State', 'Meaning'], rows: [
        ['Not submitted', 'No documents on file'],
        ['Pending', 'Uploaded and awaiting review — this queue should stay short'],
        ['Verified', 'Checked and accepted, with the reviewing user recorded'],
        ['Rejected', 'Not accepted, with a reason the subscriber can act on'],
        ['Expired', 'The document itself has passed its expiry date'],
      ] },
      { t: 'callout', kind: 'warning', title: 'Rejecting without a reason wastes everyone’s time', text: 'A subscriber told only that their document was rejected will resubmit the same thing. "Photo too dark to read the number" gets you a usable document on the second attempt.' },

      { t: 'h2', text: 'Reviewing well' },
      { t: 'ul', items: [
        'The document must be legible — if you cannot read the number, it proves nothing.',
        'The name should match the account. Where it does not, find out why before accepting.',
        'Check the document’s own expiry date, not just that one was uploaded.',
        'Confirm the whole document is visible, with no cropped corners hiding detail.',
      ] },

      { t: 'h2', text: 'Handling the documents' },
      { t: 'callout', kind: 'danger', title: 'Identity documents are the most sensitive data you hold', text: 'A leaked ID is worth far more to a fraudster than a phone number. Restrict who can view them, never export them, never send them over messaging, and delete them once your retention obligation ends. See [Privacy Policy](/docs/privacy).' },

      { t: 'h2', text: 'Keeping the queue short' },
      { t: 'p', text: 'Pending verifications are subscribers waiting on you. Review them daily. A backlog either delays activations or — worse — leads to people being connected unverified, which is the exact compliance gap the process exists to close.' },
    ],
  },

  fup: {
    title: 'Fair use policy',
    description: 'Manage contention by throttling heavy users rather than disconnecting them.',
    blocks: [
      { t: 'p', text: 'A fair use policy sets a data allowance on a package. Once a subscriber passes it, their speed is reduced for the remainder of the period rather than their access being cut. It is how you protect the experience of the majority without taking anyone offline.' },

      { t: 'h2', text: 'Why throttle rather than disconnect' },
      { t: 'p', text: 'A disconnected subscriber is a support call, a refund argument, and often a cancellation. A throttled one still has working internet, notices it is slower, and frequently upgrades. The same policy produces revenue instead of churn depending on which you choose.' },
      { t: 'callout', kind: 'tip', title: 'Throttling converts, disconnection churns', text: 'The subscriber who hits their allowance is by definition your heaviest user — the one most likely to pay for more. Cutting them off makes them a former customer; slowing them down makes them a candidate for the next tier up.' },

      { t: 'h2', text: 'Configuring it' },
      { t: 'fields', items: [
        { name: 'Allowance', type: 'bytes', text: 'Data at full speed before throttling engages.' },
        { name: 'Throttled speed', type: 'bps', text: 'The reduced rate afterwards. Keep it genuinely usable — browsing and messaging should still work.' },
        { name: 'Period', type: 'duration', text: 'When the allowance resets, normally aligned to the package validity.' },
      ] },
      { t: 'callout', kind: 'warning', title: 'Do not throttle to uselessness', text: 'A speed too slow to load a web page is a disconnection with extra steps — and the subscriber will describe it as a fault, not a policy. Set it low enough to matter and high enough to work.' },

      { t: 'h2', text: 'Telling subscribers' },
      { t: 'p', text: 'A throttle nobody was warned about is indistinguishable from a fault, and generates exactly the ticket you were trying to avoid.' },
      { t: 'ul', items: [
        'State the allowance in the package description, before purchase.',
        'Show remaining allowance in the customer portal — see [Usage, invoices, and receipts](/docs/portal-usage).',
        'Notify as they approach the limit, while they can still act.',
        'Notify when it engages, with the upgrade option in the same message.',
      ] },

      { t: 'h2', text: 'Choosing an allowance' },
      { t: 'p', text: 'Look at what your subscribers actually use before setting a number. An allowance that catches half your base is not a fair use policy, it is a speed reduction you have not announced. A well-set one affects the heaviest few percent and is invisible to everyone else.' },
    ],
  },
};
