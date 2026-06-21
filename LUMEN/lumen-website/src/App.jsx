import { Routes, Route } from 'react-router-dom';
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
import { TermsPage, PrivacyPage, AffiliatePage } from './pages/LegalPages';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';

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
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/affiliate" element={<AffiliatePage />} />
      </Routes>
    </div>
  );
}
