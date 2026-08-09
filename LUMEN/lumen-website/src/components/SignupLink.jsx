import { SIGNUP_URL } from '../lib/brand';

/**
 * Every "Get Started" / "Start free trial" CTA on the marketing site.
 *
 * Signup is the billing app's onboarding wizard at APP_URL/signup — the flow
 * that actually provisions a tenant (see ONBOARDING.md). This site used to
 * carry its own single-form trial page at /signup, which produced a weaker
 * account and is now gone. Funnelling every CTA through one component is what
 * keeps a second signup from reappearing: there is exactly one place that
 * knows the destination.
 *
 * It renders a plain <a>, never a react-router <Link>, because the wizard
 * lives on a different origin in every environment.
 */
export default function SignupLink({ className, children, ...rest }) {
  return (
    <a href={SIGNUP_URL} className={className} {...rest}>
      {children}
    </a>
  );
}
