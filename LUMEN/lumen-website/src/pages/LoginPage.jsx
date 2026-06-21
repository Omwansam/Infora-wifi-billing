import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loginUser } from '../services/websiteService';
import { handoffToBillingApp } from '../services/authHandoff';
import LumenLogo from '../components/LumenLogo';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = await loginUser(form);
      handoffToBillingApp(payload, '/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-violet-950 to-slate-900 px-4 py-12">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex">
            <LumenLogo size="md" showText subtitle="WiFi Billing" theme="dark" />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to your Lumen billing dashboard</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 shadow-xl sm:p-8"
        >
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
            <input
              name="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
            <input
              name="password"
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg transition disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-sm text-slate-400">
            New to Lumen?{' '}
            <Link to="/signup" className="font-medium text-amber-400 hover:underline">
              Start free trial
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
