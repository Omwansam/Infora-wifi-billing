import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustedBy from './components/TrustedBy';
import StatsBar from './components/StatsBar';
import Integrations from './components/Integrations';
import HowItWorks from './components/HowItWorks';
import PortalPreview from './components/PortalPreview';
import Insights from './components/Insights';
import FeatureMarquee from './components/FeatureMarquee';
import Automations from './components/Automations';
import Pricing from './components/Pricing';
import Comparison from './components/Comparison';
import FAQ from './components/FAQ';
import Testimonials from './components/Testimonials';
import Changelog from './components/Changelog';
import DocsPreview from './components/DocsPreview';
import ContactSection from './components/ContactSection';
import WhyChoose from './components/WhyChoose';
import CTABanner from './components/CTABanner';
import Footer from './components/Footer';
import WhatsAppButton from './components/WhatsAppButton';
import ScrollToTop from './components/ScrollToTop';
import ScrollToHash from './components/ScrollToHash';
import { lazy, Suspense, useEffect } from 'react';
import { TermsPage, PrivacyPage, AffiliatePage } from './pages/LegalPages';
import { FIRST_SLUG } from './docs/nav';

/**
 * The documentation is lazy-loaded on purpose.
 *
 * Its content is tens of thousands of words, and bundling it with the landing
 * page made every marketing visitor download the whole manual before seeing the
 * hero. Only `nav.js` is imported eagerly — it is the small slug list the
 * redirect below needs.
 */
const DocsLayout = lazy(() => import('./docs/DocsLayout'));

/** Neutral placeholder while the docs chunk arrives — usually imperceptible. */
function DocsFallback() {
  return <div className="min-h-screen bg-white dark:bg-slate-950" />;
}
import { LOGIN_URL, SIGNUP_URL } from './lib/brand';

/**
 * The billing app owns both auth entry points — this site only navigates to
 * them. /signup used to render a local one-form trial page here; it now sends
 * you to the onboarding wizard so old links, bookmarks and any stray <Link
 * to="/signup"> land in the same place as the CTAs.
 */
function ExternalRedirect({ to }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}

function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <TrustedBy />
        <StatsBar />
        <Integrations />
        <HowItWorks />
        <PortalPreview />
        <Insights />
        <FeatureMarquee />
        <Automations />
        <Pricing />
        <Comparison />
        <FAQ />
        <Testimonials />
        <Changelog />
        <DocsPreview />
        <ContactSection />
        <WhyChoose />
        <CTABanner />
      </main>
      <Footer />
      <WhatsAppButton />
      <ScrollToTop />
    </>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signup" element={<ExternalRedirect to={SIGNUP_URL} />} />
        <Route path="/get-started" element={<ExternalRedirect to={SIGNUP_URL} />} />
        <Route path="/login" element={<ExternalRedirect to={LOGIN_URL} />} />
        {/* The docs are a section of this app, served at /docs and at the
            docs subdomain (which redirects its root here). Bare /docs has no
            landing page of its own — the introduction is the landing page. */}
        <Route path="/docs" element={<Navigate to={`/docs/${FIRST_SLUG}`} replace />} />
        <Route
          path="/docs/:slug"
          element={<Suspense fallback={<DocsFallback />}><DocsLayout /></Suspense>}
        />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/affiliate" element={<AffiliatePage />} />
      </Routes>
    </div>
  );
}
