import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, Clock, Gauge, Loader2, Sparkles, Wifi } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import portalService from '../../services/portalService';
import PortalPayFlow from './PortalPayFlow';
import {
  HowItWorksSteps,
  PortalBadge,
  PortalFadeIn,
  PortalGlassCard,
  PortalSectionHeader,
} from './PortalUI';

const CONNECT_STEPS = [
  { icon: Wifi, title: 'Pay & get credentials', text: 'After M-Pesa confirms, copy your username and password.' },
  { icon: Check, title: 'Open hotspot login', text: 'The router login page appears when you try to browse.' },
  { icon: Sparkles, title: 'Start browsing', text: 'Enter your details once — enjoy internet for your package duration.' },
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
  return (
    <PortalFadeIn delay={delay}>
      <button
        type="button"
        onClick={onSelect}
        className={`group relative flex h-full w-full flex-col rounded-[1.75rem] border p-6 text-left transition duration-300 hover:-translate-y-1 hover:shadow-2xl ${
          isPopular
            ? 'border-emerald-400/35 bg-gradient-to-b from-emerald-500/20 via-teal-500/10 to-transparent shadow-xl shadow-emerald-500/10 hover:border-emerald-400/50'
            : 'border-white/10 bg-white/[0.04] hover:border-emerald-400/25 hover:bg-white/[0.06]'
        }`}
      >
        {isPopular && (
          <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg">
            <Sparkles className="h-3 w-3" />
            Best value
          </span>
        )}

        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-400/20">
            <Wifi className="h-5 w-5 text-emerald-300" />
          </div>
          {plan.duration_label && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/30 px-2.5 py-1 text-xs text-white/60">
              <Clock className="h-3 w-3" />
              {plan.duration_label}
            </span>
          )}
        </div>

        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
        {plan.description && (
          <p className="mt-2 text-sm leading-relaxed text-white/55">{plan.description}</p>
        )}

        <div className="mt-5 flex items-end gap-1">
          <span className="text-3xl font-bold text-white">{formatCurrency(plan.price)}</span>
        </div>

        {plan.speed && (
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-200/90">
            <Gauge className="h-3.5 w-3.5" />
            {plan.speed}
          </p>
        )}

        <ul className="mt-5 flex-1 space-y-2 border-t border-white/8 pt-5">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-white/60">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              {feature}
            </li>
          ))}
        </ul>

        <span className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-sm font-semibold text-emerald-200 ring-1 ring-white/10 transition group-hover:bg-emerald-500 group-hover:text-white group-hover:ring-emerald-400/30">
          Select & pay with M-Pesa
        </span>
      </button>
    </PortalFadeIn>
  );
}

export default function HotspotPackagesSection({ config, ispId, sectionId = 'wifi-packages' }) {
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
            className="mb-6 inline-flex items-center gap-2 text-sm text-emerald-200 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to all packages
          </button>
          <PortalPayFlow
            title="Complete your WiFi purchase"
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
              })
            }
          />
        </PortalFadeIn>
      </section>
    );
  }

  return (
    <section id={sectionId} className="scroll-mt-28 space-y-10">
      <PortalFadeIn>
        <div className="text-center">
          <PortalBadge variant="mpesa">Pay with M-Pesa</PortalBadge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Choose your WiFi package
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-white/60">{config.hotspot_welcome}</p>
        </div>
      </PortalFadeIn>

      {loadingPlans && (
        <div className="flex flex-col items-center justify-center py-16 text-emerald-200">
          <Loader2 className="mb-3 h-8 w-8 animate-spin" />
          <p className="text-sm text-white/45">Loading available packages…</p>
        </div>
      )}

      {!loadingPlans && plansError && (
        <PortalFadeIn>
          <div className="mx-auto max-w-lg rounded-[1.75rem] border border-red-400/25 bg-red-500/10 p-8 text-center text-red-100">
            {plansError}
          </div>
        </PortalFadeIn>
      )}

      {!loadingPlans && !plansError && plans.length > 0 && (
        <PortalFadeIn delay={0.05}>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan, index) => (
              <PlanCard
                key={plan.id}
                delay={index * 0.06}
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
          <Wifi className="mx-auto mb-4 h-10 w-10 text-white/30" />
          <p className="font-medium text-white">No packages available yet</p>
          <p className="mt-2 text-sm text-white/50">
            Hotspot bundles have not been configured. Please contact support.
          </p>
        </PortalGlassCard>
      )}

      {!loadingPlans && !plansError && plans.length > 0 && (
        <PortalFadeIn delay={0.1}>
          <PortalGlassCard>
            <PortalSectionHeader
              eyebrow="After payment"
              title="How to connect to the hotspot"
              subtitle="Follow these steps once M-Pesa confirms your payment."
              align="center"
            />
            <HowItWorksSteps steps={CONNECT_STEPS} />
          </PortalGlassCard>
        </PortalFadeIn>
      )}
    </section>
  );
}
