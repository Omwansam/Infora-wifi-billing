import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Copy, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';

export function PortalBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="portal-mesh absolute inset-0 opacity-90" />
      <motion.div
        className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full bg-emerald-500/20 blur-[100px]"
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-24 top-1/4 h-[22rem] w-[22rem] rounded-full bg-cyan-500/15 blur-[90px]"
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-teal-400/10 blur-[80px]"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_transparent_0%,_rgba(2,6,23,0.55)_100%)]" />
    </div>
  );
}

export function PortalFadeIn({ children, className, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PortalGlassCard({ children, className, glow = false }) {
  return (
    <div
      className={cn(
        'rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8',
        glow && 'ring-1 ring-emerald-400/20',
        className
      )}
    >
      {children}
    </div>
  );
}

export function PortalSectionHeader({ eyebrow, title, subtitle, align = 'left' }) {
  return (
    <div className={cn('mb-8', align === 'center' && 'text-center mx-auto max-w-2xl')}>
      {eyebrow && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/90">
          {eyebrow}
        </p>
      )}
      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">{title}</h2>
      {subtitle && (
        <p className={cn('mt-3 text-base leading-relaxed text-white/60', align === 'center' && 'mx-auto')}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function PortalBadge({ children, variant = 'default' }) {
  const styles = {
    default: 'bg-white/10 text-white/80',
    success: 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-400/30',
    warning: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30',
    mpesa: 'bg-[#4CAF50]/20 text-green-200 ring-1 ring-green-400/30',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium', styles[variant])}>
      {children}
    </span>
  );
}

export function PortalButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}) {
  const variants = {
    primary:
      'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400',
    secondary: 'border border-white/15 bg-white/5 text-white hover:bg-white/10',
    ghost: 'text-emerald-200 hover:bg-white/5 hover:text-white',
  };
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-3 text-sm font-semibold',
    lg: 'px-6 py-3.5 text-base font-semibold',
  };
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl transition-all duration-200 disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function HowItWorksSteps({ steps }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className="relative rounded-2xl border border-white/8 bg-black/20 p-5"
        >
          <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/10 text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/20">
            {index + 1}
          </div>
          <step.icon className="mb-3 h-5 w-5 text-emerald-300" />
          <h4 className="font-semibold text-white">{step.title}</h4>
          <p className="mt-2 text-sm leading-relaxed text-white/55">{step.text}</p>
        </div>
      ))}
    </div>
  );
}

export function FaqAccordion({ items }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q} className="overflow-hidden rounded-2xl border border-white/8 bg-black/20">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-medium text-white">{item.q}</span>
              <ChevronDown
                className={cn('h-5 w-5 shrink-0 text-white/50 transition-transform', isOpen && 'rotate-180')}
              />
            </button>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="border-t border-white/5 px-5 pb-4 pt-3 text-sm leading-relaxed text-white/60"
              >
                {item.a}
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CopyCredential({ label, value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rounded-xl bg-black/40 p-4 ring-1 ring-white/10">
      <div className="mb-1 flex items-center justify-between gap-2">
        <dt className="text-xs uppercase tracking-wider text-white/45">{label}</dt>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <dd className="break-all font-mono text-lg text-white">{value}</dd>
    </div>
  );
}

export function ConnectionStatusRing({ online, label }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            online ? 'bg-emerald-500/20 animate-pulse' : 'bg-amber-500/15'
          )}
        />
        <div
          className={cn(
            'relative flex h-20 w-20 items-center justify-center rounded-full ring-4',
            online ? 'bg-emerald-500/20 ring-emerald-400/40' : 'bg-amber-500/15 ring-amber-400/30'
          )}
        >
          <span className={cn('h-3 w-3 rounded-full', online ? 'bg-emerald-400' : 'bg-amber-400')} />
        </div>
      </div>
      <p className={cn('text-sm font-medium', online ? 'text-emerald-200' : 'text-amber-200')}>{label}</p>
    </div>
  );
}

export function PayStepIndicator({ step }) {
  const steps = ['Details', 'M-Pesa PIN', 'Connected'];
  return (
    <div className="mb-8 flex items-center justify-between gap-2">
      {steps.map((label, index) => {
        const active = index <= step;
        const current = index === step;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition',
                  current && 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
                  active && !current && 'bg-emerald-500/25 text-emerald-200',
                  !active && 'bg-white/5 text-white/35'
                )}
              >
                {index + 1}
              </div>
              <span className={cn('hidden text-[10px] uppercase tracking-wide sm:block', active ? 'text-white/70' : 'text-white/30')}>
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn('mb-6 h-px flex-1', active ? 'bg-emerald-500/40' : 'bg-white/10')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function PortalStatStrip({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-white/8 bg-black/25 px-4 py-4 text-center backdrop-blur-sm"
        >
          <p className="text-lg font-bold text-white sm:text-xl">{item.value}</p>
          <p className="mt-1 text-xs text-white/50">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function ExternalLinkButton({ href, children }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-emerald-200 hover:text-white"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}
