import { Link } from 'react-router-dom';
import Reveal from './Reveal';

const GUIDES = [
  {
    title: 'Connect Your First MikroTik',
    description: 'Step-by-step API setup for RouterOS v6 and v7 devices.',
    time: '10 min read',
    category: 'Devices',
  },
  {
    title: 'Enable M-Pesa STK Push',
    description: 'Configure Safaricom Daraja credentials and test payments.',
    time: '8 min read',
    category: 'Payments',
  },
  {
    title: 'Launch Your Captive Portal',
    description: 'Brand your hotspot login page and publish packages.',
    time: '12 min read',
    category: 'Portal',
  },
  {
    title: 'Set Up PPPoE Billing',
    description: 'Create plans, automate invoicing, and provision subscribers.',
    time: '15 min read',
    category: 'Billing',
  },
];

export default function DocsPreview() {
  return (
    <section className="border-t border-slate-100 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">Documentation</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Get Up and Running Fast
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Clear guides for every part of the platform — from router setup to your first payment.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GUIDES.map((guide, i) => (
            <Reveal key={guide.title} delay={i * 70}>
              <Link
                to="/#contact"
                className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50/50 p-5 transition hover:border-violet-200 hover:bg-white hover:shadow-md"
              >
                <span className="w-fit rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                  {guide.category}
                </span>
                <h3 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-violet-700">
                  {guide.title}
                </h3>
                <p className="mt-2 flex-1 text-sm text-slate-500">{guide.description}</p>
                <p className="mt-4 text-xs font-medium text-slate-400">{guide.time}</p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
