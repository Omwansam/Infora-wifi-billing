import { Link } from 'react-router-dom';
import { useBrand } from '../contexts/WebsiteContext';
import { BRAND } from '../lib/brand';
import LumenLogo from './LumenLogo';

const FOOTER_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Changelog', href: '/#changelog' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Contact', href: '/#contact' },
  { label: 'Documentation', href: '/#contact' },
];

export default function Footer() {
  const brand = useBrand();

  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <LumenLogo size="sm" showText subtitle="WiFi Billing" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              {brand.description}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Product</p>
            <nav className="mt-4 flex flex-col gap-2.5">
              {FOOTER_LINKS.map((link) => (
                <Link
                  key={link.label}
                  to={link.href}
                  className="text-sm text-slate-600 transition hover:text-violet-600"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Get Started</p>
            <p className="mt-4 text-sm text-slate-500">
              Start your 14-day free trial or talk to our sales team.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                to="/signup"
                className="rounded-full bg-gradient-to-r from-amber-500 to-violet-600 px-5 py-2 text-center text-sm font-semibold text-white"
              >
                Free Trial
              </Link>
              <a
                href={`mailto:${brand.salesEmail}`}
                className="rounded-full border border-slate-300 px-5 py-2 text-center text-sm font-medium text-slate-700 transition hover:border-violet-300"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
          <p className="text-sm text-slate-500">{BRAND.copyright()}</p>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link to="/terms" className="transition hover:text-violet-600">
              Terms
            </Link>
            <Link to="/privacy" className="transition hover:text-violet-600">
              Privacy Policy
            </Link>
            <Link to="/affiliate" className="transition hover:text-violet-600">
              Become an Affiliate
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
