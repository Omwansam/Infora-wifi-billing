import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Copy, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/utils';
import { portalClasses, usePortalTheme } from './PortalThemeContext';

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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08),transparent_55%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_transparent_0%,_rgba(2,6,23,0.55)_100%)]" />
    </div>
  );
}

export function PortalFadeIn({ children, className, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PortalGlassCard({ children, className, glow = false }) {
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <div
      className={cn(
        cx.card,
        'p-6 sm:p-8',
        glow && (isLight ? 'ring-2 ring-emerald-500/25' : 'ring-1 ring-emerald-400/20'),
        className
      )}
      style={glow && isLight ? { borderColor: `${accent}40` } : undefined}
    >
      {children}
    </div>
  );
}

export function PortalSectionHeader({ eyebrow, title, subtitle, align = 'left' }) {
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <div className={cn('mb-6', align === 'center' && 'text-center mx-auto max-w-2xl')}>
      {eyebrow && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>
          {eyebrow}
        </p>
      )}
      <h2 className={cn('text-xl font-bold tracking-tight sm:text-2xl', cx.text)}>{title}</h2>
      {subtitle && (
        <p className={cn('mt-2 text-sm leading-relaxed', cx.textMuted, align === 'center' && 'mx-auto')}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function PortalBadge({ children, variant = 'default' }) {
  const { isLight } = usePortalTheme();
  const styles = isLight
    ? {
        default: 'bg-slate-100 text-slate-600',
        success: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
        warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
        mpesa: 'bg-green-50 text-green-800 ring-1 ring-green-200',
      }
    : {
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
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);
  const variants = {
    primary: isLight
      ? 'text-white shadow-sm hover:opacity-90'
      : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-400',
    secondary: isLight
      ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      : 'border border-white/15 bg-white/5 text-white hover:bg-white/10',
    ghost: isLight
      ? 'text-emerald-700 hover:bg-emerald-50'
      : 'text-emerald-200 hover:bg-white/5 hover:text-white',
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
        'inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      style={variant === 'primary' && isLight ? { backgroundColor: accent } : undefined}
      {...props}
    >
      {children}
    </button>
  );
}

export function PortalInput({ className, ...props }) {
  const { isLight } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <input
      className={cn('w-full px-4 py-3 focus:outline-none', cx.input, className)}
      {...props}
    />
  );
}

export function PortalLabel({ children, className }) {
  const { isLight } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <label className={cn('mb-1.5 block text-xs font-semibold uppercase tracking-wide', cx.textSubtle, className)}>
      {children}
    </label>
  );
}

export function HowItWorksSteps({ steps }) {
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className={cn('rounded-xl border p-4', isLight ? 'border-slate-200 bg-slate-50' : 'border-white/8 bg-black/20')}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {index + 1}
          </div>
          <step.icon className="mb-2 h-4 w-4" style={{ color: accent }} />
          <h4 className={cn('text-sm font-semibold', cx.text)}>{step.title}</h4>
          <p className={cn('mt-1 text-xs leading-relaxed', cx.textMuted)}>{step.text}</p>
        </div>
      ))}
    </div>
  );
}

export function FaqAccordion({ items }) {
  const [open, setOpen] = useState(0);
  const { isLight } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div
            key={item.q}
            className={cn('overflow-hidden rounded-xl border', isLight ? 'border-slate-200 bg-white' : 'border-white/8 bg-black/20')}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
            >
              <span className={cn('text-sm font-medium', cx.text)}>{item.q}</span>
              <ChevronDown
                className={cn('h-4 w-4 shrink-0 transition-transform', cx.textSubtle, isOpen && 'rotate-180')}
              />
            </button>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className={cn('border-t px-4 pb-3 pt-2 text-sm leading-relaxed', cx.textMuted, isLight ? 'border-slate-100' : 'border-white/5')}
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
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);

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
    <div className={cn('rounded-xl p-4', isLight ? 'bg-slate-50 ring-1 ring-slate-200' : 'bg-black/40 ring-1 ring-white/10')}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <dt className={cn('text-xs uppercase tracking-wider', cx.textSubtle)}>{label}</dt>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs',
            isLight ? 'bg-white text-slate-600 hover:bg-slate-100' : 'bg-white/5 text-white/70 hover:bg-white/10'
          )}
        >
          {copied ? <Check className="h-3 w-3" style={{ color: accent }} /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <dd className={cn('break-all font-mono text-lg', cx.text)}>{value}</dd>
    </div>
  );
}

export function ConnectionStatusRing({ online, label }) {
  const { isLight } = usePortalTheme();
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className={cn('absolute inset-0 rounded-full', online ? 'bg-emerald-500/20 animate-pulse' : 'bg-amber-500/15')} />
        <div
          className={cn(
            'relative flex h-16 w-16 items-center justify-center rounded-full ring-4',
            online ? 'bg-emerald-500/20 ring-emerald-400/40' : 'bg-amber-500/15 ring-amber-400/30'
          )}
        >
          <span className={cn('h-3 w-3 rounded-full', online ? 'bg-emerald-500' : 'bg-amber-400')} />
        </div>
      </div>
      <p className={cn('text-sm font-medium', online ? (isLight ? 'text-emerald-700' : 'text-emerald-200') : (isLight ? 'text-amber-700' : 'text-amber-200'))}>
        {label}
      </p>
    </div>
  );
}

export function PayStepIndicator({ step }) {
  const { isLight, accent } = usePortalTheme();
  const cx = portalClasses(isLight);
  const steps = ['Details', 'M-Pesa PIN', 'Connected'];
  return (
    <div className="mb-6 flex items-center justify-between gap-2">
      {steps.map((label, index) => {
        const active = index <= step;
        const current = index === step;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition',
                  !active && (isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/35')
                )}
                style={current ? { backgroundColor: accent, color: '#fff' } : active ? { backgroundColor: `${accent}33`, color: accent } : undefined}
              >
                {index + 1}
              </div>
              <span className={cn('hidden text-[10px] uppercase tracking-wide sm:block', active ? cx.textMuted : cx.textSubtle)}>
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={cn('mb-5 h-px flex-1', active ? 'bg-emerald-500/40' : isLight ? 'bg-slate-200' : 'bg-white/10')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function ExternalLinkButton({ href, children }) {
  const { accent } = usePortalTheme();
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm hover:opacity-80"
      style={{ color: accent }}
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}
