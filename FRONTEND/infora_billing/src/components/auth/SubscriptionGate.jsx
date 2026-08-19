import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSubscription } from '../../contexts/SubscriptionContext';

/**
 * Routes a locked-out tenant can still reach.
 *
 * The subscription page is the point of the lockout; support and feedback stay
 * open so nobody is trapped with a billing problem and no way to report it.
 */
const ALLOWED_WHILE_LOCKED = [
  '/subscription',
  '/settings/contact-support',
  '/settings/bug-report',
];

/**
 * Holds an unpaid tenant on the subscription page.
 *
 * Wrapped around every console route by ProtectedRoute and RoleBasedRoute, so
 * a page added later is covered without being remembered. This is the UX half
 * of the paywall — the enforcing half is the 402 the API returns
 * (app.enforce_platform_subscription), which no client can talk its way past.
 */
export default function SubscriptionGate({ children }) {
  const { locked, loaded } = useSubscription();
  const { pathname } = useLocation();

  // Hold the first paint until the answer is in. Rendering the console and
  // then yanking it away would show a locked-out tenant the dashboard they are
  // not entitled to, however briefly. The provider's watchdog guarantees this
  // resolves even if the request never does.
  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }
  if (!locked) return children;

  const allowed = ALLOWED_WHILE_LOCKED.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (allowed) return children;

  return <Navigate to="/subscription" replace />;
}
