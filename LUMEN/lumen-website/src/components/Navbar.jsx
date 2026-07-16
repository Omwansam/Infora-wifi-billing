import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useBrand } from '../contexts/WebsiteContext';
import LumenLogo from './LumenLogo';

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Why Lumen', href: '/#compare' },
  { label: 'Changelog', href: '/#changelog' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Contact', href: '/#contact' },
];

export default function Navbar() {
  const brand = useBrand();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="shrink-0">
          <LumenLogo size="sm" showText subtitle="WiFi Billing" />
        </Link>

        <ul className="hidden items-center gap-7 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                to={link.href}
                className="text-sm font-medium text-slate-600 transition hover:text-violet-600"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-violet-600"
          >
            Log In
          </Link>
          <a
            href={brand.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-violet-600 lg:inline-block"
          >
            View Demo
          </a>
          <Link
            to="/signup"
            className="rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:shadow-orange-500/40"
          >
            Get Started — Free
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 lg:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="border-t border-slate-100 bg-white px-4 py-4 lg:hidden">
          <ul className="space-y-3">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className="block text-sm font-medium text-slate-700"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              to="/login"
              className="rounded-full border border-slate-200 py-2.5 text-center text-sm font-medium"
            >
              Log In
            </Link>
            <a
              href={brand.demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-slate-200 py-2.5 text-center text-sm font-medium"
            >
              View Demo
            </a>
            <Link
              to="/signup"
              className="rounded-full bg-gradient-to-r from-amber-500 to-violet-600 py-2.5 text-center text-sm font-semibold text-white"
            >
              Get Started — Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
