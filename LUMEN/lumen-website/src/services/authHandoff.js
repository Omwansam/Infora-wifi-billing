import { APP_URL } from '../lib/brand';

/**
 * The billing app lives on its own subdomain (APP_URL), so auth tokens can't
 * be handed over via localStorage (it never crosses origins). All sign-in
 * happens on the billing app's own login page — we only navigate there.
 */
export function redirectToBillingApp(path = '/') {
  window.location.href = `${APP_URL}${path}`;
}
