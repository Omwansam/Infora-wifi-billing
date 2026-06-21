import { useMemo, useState } from 'react';
import { useBrand } from '../contexts/WebsiteContext';

export default function FAQ() {
  const brand = useBrand();
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = useMemo(
    () => [
      {
        q: 'Is there a free trial available?',
        a: `Yes, we offer a ${brand.trial_days || 14}-day trial so you can evaluate Lumen WiFi Billing and determine if it suits your ISP needs.`,
      },
      {
        q: 'Is there technical support available?',
        a: `Yes, we offer free technical support to all our users. Reach us via WhatsApp at ${brand.whatsapp} or email ${brand.supportEmail}.`,
      },
      {
        q: 'Do you support multiple locations?',
        a: 'Yes, Lumen supports multiple locations and unlimited MikroTik devices from a single dashboard.',
      },
      {
        q: 'Can I customize Lumen to fit my brand?',
        a: 'Absolutely. Lumen offers flexible customization options including fonts, colors, layouts, and branded captive portals to match your ISP identity.',
      },
      {
        q: 'Which countries do you support?',
        a: 'Lumen is available worldwide. We integrate with local payment gateways like M-Pesa for East Africa and support international options including cards and bank transfers.',
      },
      {
        q: 'Which MikroTik models do you support?',
        a: 'Lumen is fully compatible with MikroTik RouterOS v6 and v7 devices — hAP, RB, CCR, CRS, LHG, SXT, and LtAP series.',
      },
      {
        q: 'What payment methods do you support?',
        a: 'We integrate with M-Pesa STK Push, Paystack, direct bank payments, and more with real-time payment confirmations.',
      },
      {
        q: 'Do you support captive portals?',
        a: 'Yes! Lumen fully supports branded captive portals for voucher login, mobile number auth, M-Pesa payments, and usage tracking.',
      },
    ],
    [brand]
  );

  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-600">
            Your Queries, Simplified
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Questions? Answers!
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Find quick answers to the most common questions about our platform.
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.q}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                >
                  <span className="pr-4 text-sm font-semibold text-slate-900 sm:text-base">
                    {faq.q}
                  </span>
                  <svg
                    className={`h-5 w-5 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-sm leading-relaxed text-slate-600">{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          Feel free to mail us for any enquiries:{' '}
          <a href={`mailto:${brand.salesEmail}`} className="font-medium text-violet-600 hover:underline">
            {brand.salesEmail}
          </a>
        </p>
      </div>
    </section>
  );
}
