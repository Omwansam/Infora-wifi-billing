import { Link } from 'react-router-dom';
import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useBrand } from '../contexts/WebsiteContext';
import { submitAffiliateApplication } from '../services/websiteService';
import { BRAND } from '../lib/brand';

function LegalLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link to="/" className="text-sm font-medium text-violet-600 hover:text-violet-700">
          ← Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        <div className="prose prose-slate mt-8 max-w-none space-y-4 text-slate-600">{children}</div>
      </main>
      <Footer />
    </div>
  );
}

export function TermsPage() {
  const brand = useBrand();
  return (
    <LegalLayout title="Terms of Service">
      <p>Last updated: June 2026</p>
      <p>
        By using {brand.fullName}, you agree to these terms. Lumen provides ISP billing software
        on a subscription and usage-based model.
      </p>
      <p>
        Questions? Contact{' '}
        <a href={`mailto:${brand.salesEmail}`} className="text-violet-600 hover:underline">
          {brand.salesEmail}
        </a>
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  const brand = useBrand();
  return (
    <LegalLayout title="Privacy Policy">
      <p>Last updated: June 2026</p>
      <p>
        {brand.name} respects your privacy and the privacy of your subscribers.
      </p>
      <p>
        You may request data export or deletion by contacting{' '}
        <a href={`mailto:${brand.supportEmail}`} className="text-violet-600 hover:underline">
          {brand.supportEmail}
        </a>
      </p>
    </LegalLayout>
  );
}

export function AffiliatePage() {
  const brand = useBrand();
  const [form, setForm] = useState({ name: '', email: '', company: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await submitAffiliateApplication(form);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LegalLayout title="Become an Affiliate">
      <p>
        Earn commissions by referring ISPs to {brand.fullName}. Our affiliate program is designed
        for consultants, network installers, and technology partners.
      </p>
      <ul className="list-disc space-y-2 pl-5">
        <li>20% recurring commission on referred PPPoE accounts for 12 months</li>
        <li>5% revenue share on referred hotspot operators</li>
        <li>Dedicated partner dashboard and referral tracking</li>
      </ul>

      {submitted ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
          Application received. Our partnerships team will contact you at {form.email}.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="not-prose mt-6 space-y-4 rounded-2xl border border-slate-200 p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Company / region</label>
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tell us about your network</label>
            <textarea
              required
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Expected referral volume, regions you serve, etc."
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-gradient-to-r from-amber-500 to-violet-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? 'Submitting…' : 'Apply Now'}
          </button>
        </form>
      )}
    </LegalLayout>
  );
}

export { BRAND };
