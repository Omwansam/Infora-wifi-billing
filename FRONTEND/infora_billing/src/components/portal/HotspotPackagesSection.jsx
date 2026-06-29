import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Clock, Gauge, Loader2, Sparkles, Wifi } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import portalService from '../../services/portalService';
import PortalPayFlow from './PortalPayFlow';
import { portalClasses, usePortalTheme } from './PortalThemeContext';
import {
  HowItWorksSteps,
  PortalBadge,
  PortalFadeIn,
  PortalGlassCard,
} from './PortalUI';

const CONNECT_STEPS = [
  { icon: Wifi, title: 'Pay & get credentials', text: 'After M-Pesa confirms, copy your username and password.' },
  { icon: Check, title: 'Open hotspot login', text: 'The router login page appears when you try to browse.' },
  { icon: Sparkles, title: 'Start browsing', text: 'Use your details once — enjoy internet for the package duration.' },
];

function planFeatures(plan) {
  const fromJson = plan.features && typeof plan.features === 'object'
    ? Object.values(plan.features).filter(Boolean)
    : [];
  const built = [
    plan.speed && `${plan.speed} speed`,
    plan.duration_label && `${plan.duration_label} access`,
    plan.bandwidth_limit && `Up to ${plan.bandwidth_limit} Mbps`,
  ].filter(Boolean);
  return [...new Set([...built, ...fromJson])].slice(0, 4);
}

function PlanCard({ plan, features, isPopular, onSelect, delay }) {
  const { isLight, accent, accentFg } = usePortalTheme();
  const cx = portalClasses(isLight);

  const cardStyle = isPopular
    ? {
        borderColor: accent,
        boxShadow: `0 18px 40px -18px var(--portal-accent-glow)`,
      }
    : undefined;

  return (
    <PortalFadeIn delay={delay}>
      <button
        type="button"
        onClick={onSelect}
        className={`group relative flex h-full w-full flex-col rounded-2xl border p-5 text-left transition duration-200 hover:-translate-y-0.5 ${
          isPopular
            ? isLight
              ? 'bg-white shadow-md'
              : 'bg-white/[0.06] shadow-xl'
            : isLight
              ? 'border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-[color:var(--portal-accent)]'
              : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.06] hover:border-[color:var(--portal-accent-ring)]'
        }`}
        style={cardStyle}
      >
        {isPopular && (
          <span
            className="absolute -top-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide shadow"
            style={{ backgroundColor: accent, color: accentFg }}
          >
            <Sparkles className="h-3 w-3" />
            Popular
          </span>
        )}

        <div className="mb-4 flex items-start justify-between gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'var(--portal-accent-soft)' }}
          >
            <Wifi className="h-5 w-5" style={{ color: accent }} />
          </div>
          {plan.duration_label && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                isLight ? 'bg-slate-100 text-slate-600' : 'bg-black/30 text-white/65'
              }`}
            >
              <Clock className="h-3 w-3" />
              {plan.duration_label}
            </span>
          )}
        </div>

        <h3 className={`text-lg font-bold ${cx.text}`}>{plan.name}</h3>
        {plan.description && (
          <p className={`mt-1.5 text-sm leading-relaxed ${cx.textMuted}`}>{plan.description}</p>
        )}

        <div className="mt-4 flex items-end gap-1">
          <span className={`text-2xl font-bold ${cx.text}`}>{formatCurrency(plan.price)}</span>
        </div>

        {plan.speed && (
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs" style={{ color: accent }}>
            <Gauge className="h-3.5 w-3.5" />
            {plan.speed}
          </p>
        )}

        <ul
          className={`mt-4 flex-1 space-y-1.5 border-t pt-4 ${
            isLight ? 'border-slate-100' : 'border-white/8'
          }`}
        >
          {features.map((feature) => (
            <li key={feature} className={`flex items-start gap-2 text-sm ${cx.textMuted}`}>
              <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: accent }} />
              {feature}
            </li>
          ))}
        </ul>

        <span
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold transition group-hover:shadow"
          style={{
            backgroundColor: isPopular ? accent : 'var(--portal-accent-soft)',
            color: isPopular ? accentFg : accent,
          }}
        >
          Buy with M-Pesa
        </span>
      </button>
    </PortalFadeIn>
  );
}

export default function HotspotPackagesSection({ config, ispId, routerId, sectionId = 'wifi-packages' }) {
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      const result = await portalService.getPlans('hotspot', ispId);
      if (cancelled) return;
      if (result.success) {
        setPlans(result.data);
        setPlansError('');
      } else {
        setPlansError(result.error || 'Could not load packages');
      }
      setLoadingPlans(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ispId]);

  if (selectedPlan) {
    return (
      <section id={sectionId} className="scroll-mt-28">
        <PortalFadeIn className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => setSelectedPlan(null)}
            className="mb-5 inline-flex items-center gap-2 text-sm hover:opacity-80"
            style={{ color: accent }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to packages
          </button>
          <PortalPayFlow
            title="Complete your purchase"
            subtitle={config.hotspot_welcome}
            planName={selectedPlan.name}
            amount={selectedPlan.price}
            planMeta={selectedPlan}
            successKind="hotspot"
            onReset={() => setSelectedPlan(null)}
            onSubmit={({ phone, fullName }) =>
              portalService.purchaseHotspot({
                planId: selectedPlan.id,
                phone,
                fullName,
                ispId,
                routerId,
              })
            }
          />
        </PortalFadeIn>
      </section>
    );
  }

  return (
    <section id={sectionId} className="scroll-mt-28 space-y-8">
      <PortalFadeIn>
        <div>
          <PortalBadge variant="mpesa">Pay with M-Pesa</PortalBadge>
          <h2 className={`mt-3 text-2xl font-bold tracking-tight sm:text-3xl ${cx.text}`}>
            WiFi packages
          </h2>
          <p className={`mt-2 max-w-xl text-sm ${cx.textMuted}`}>{config.hotspot_welcome}</p>
        </div>
      </PortalFadeIn>

      {loadingPlans && (
        <div className={`flex flex-col items-center justify-center py-12 ${cx.textMuted}`}>
          <Loader2 className="mb-3 h-7 w-7 animate-spin" style={{ color: accent }} />
          <p className="text-sm">Loading packages…</p>
        </div>
      )}

      {!loadingPlans && plansError && (
        <PortalFadeIn>
          <div
            className={`mx-auto max-w-lg rounded-2xl border p-6 text-center text-sm ${
              isLight ? 'border-red-200 bg-red-50 text-red-800' : 'border-red-400/25 bg-red-500/10 text-red-100'
            }`}
          >
            {plansError}
          </div>
        </PortalFadeIn>
      )}

      {!loadingPlans && !plansError && plans.length > 0 && (
        <PortalFadeIn delay={0.05}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan, index) => (
              <PlanCard
                key={plan.id}
                delay={index * 0.05}
                plan={plan}
                features={planFeatures(plan)}
                isPopular={plan.popular}
                onSelect={() => setSelectedPlan(plan)}
              />
            ))}
          </div>
        </PortalFadeIn>
      )}

      {!loadingPlans && !plansError && plans.length === 0 && (
        <PortalGlassCard className="mx-auto max-w-lg text-center">
          <Wifi className={`mx-auto mb-3 h-9 w-9 ${cx.textSubtle}`} />
          <p className={`font-medium ${cx.text}`}>No packages available</p>
          <p className={`mt-1 text-sm ${cx.textMuted}`}>Please contact support for assistance.</p>
        </PortalGlassCard>
      )}

      {!loadingPlans && !plansError && plans.length > 0 && (
        <PortalFadeIn delay={0.1}>
          <PortalGlassCard>
            <h3 className={`text-base font-semibold ${cx.text}`}>After payment</h3>
            <p className={`mt-1 text-sm ${cx.textMuted}`}>How to connect to the hotspot.</p>
            <div className="mt-4">
              <HowItWorksSteps steps={CONNECT_STEPS} />
            </div>
          </PortalGlassCard>
        </PortalFadeIn>
      )}
    </section>
  );
}
