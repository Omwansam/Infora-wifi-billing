import { Link } from 'react-router-dom';
import { useBrand } from '../contexts/WebsiteContext';
import Reveal from './Reveal';

export default function CTABanner() {
  const brand = useBrand();
  return (
    <section className="relative overflow-hidden py-16 sm:py-20">
      <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-orange-500 to-violet-600" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to Illuminate Your Network?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/85">
            Join hundreds of ISPs already using Lumen. Start your {brand.trial_days || 14}-day free trial today — no
            credit card required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/signup"
              className="w-full rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-violet-700 shadow-xl transition hover:bg-slate-50 sm:w-auto"
            >
              Start Free Trial
            </Link>
            <a
              href="#contact"
              className="w-full rounded-full border-2 border-white/60 px-8 py-3.5 text-sm font-semibold text-white transition hover:border-white hover:bg-white/10 sm:w-auto"
            >
              Talk to Sales
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
