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
        className="absolute -left-32 top-0 h-[28rem] w-[28rem] rounded-full blur-[100px]"
        style={{ backgroundColor: 'var(--portal-accent-soft)' }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-24 top-1/4 h-[22rem] w-[22rem] rounded-full blur-[90px]"
        style={{ backgroundColor: 'var(--portal-accent-softer)' }}
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
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
  const { isLight } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <div
      className={cn(cx.card, 'p-6 sm:p-8', className)}
      style={
        glow
          ? {
              boxShadow: `0 10px 35px -10px var(--portal-accent-glow)`,
              borderColor: 'var(--portal-accent-ring)',
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export function PortalSectionHeader({ eyebrow, title, subtitle, align = 'left' }) {
  const { isLight } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <div className={cn('mb-6', align === 'center' && 'text-center mx-auto max-w-2xl')}>
      {eyebrow && (
        <p
          className="mb-2 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--portal-accent)' }}
        >
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

  if (variant === 'success' || variant === 'mpesa') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1"
        style={{
          backgroundColor: 'var(--portal-accent-soft)',
          color: 'var(--portal-accent)',
          // eslint-disable-next-line no-restricted-syntax
          ['--tw-ring-color']: 'var(--portal-accent-ring)',
        }}
      >
        {children}
      </span>
    );
  }

  const styles = isLight
    ? {
        default: 'bg-slate-100 text-slate-700',
        warning: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
      }
    : {
        default: 'bg-white/10 text-white/80',
        warning: 'bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30',
      };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        styles[variant] || styles.default,
      )}
    >
      {children}
    </span>
  );
}

export function PortalButton({
  children,
  className,
  variant = 'primary',
  size = 'md',
  style,
  ...props
}) {
  const { isLight } = usePortalTheme();
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-3 text-sm font-semibold',
    lg: 'px-6 py-3.5 text-base font-semibold',
  };

  if (variant === 'primary') {
    return (
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl shadow-sm transition-all duration-200 hover:brightness-110 disabled:opacity-50',
          sizes[size],
          className,
        )}
        style={{
          backgroundColor: 'var(--portal-accent)',
          color: 'var(--portal-accent-fg)',
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }

  if (variant === 'secondary') {
    return (
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl border transition-all duration-200 disabled:opacity-50',
          isLight
            ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            : 'border-white/15 bg-white/5 text-white hover:bg-white/10',
          sizes[size],
          className,
        )}
        style={style}
        {...props}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl transition-all duration-200 disabled:opacity-50',
        isLight
          ? 'hover:bg-[color:var(--portal-accent-softer)]'
          : 'hover:bg-white/5',
        sizes[size],
        className,
      )}
      style={{ color: 'var(--portal-accent)', ...style }}
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
    <label
      className={cn(
        'mb-1.5 block text-xs font-semibold uppercase tracking-wide',
        cx.textSubtle,
        className,
      )}
    >
      {children}
    </label>
  );
}

export function HowItWorksSteps({ steps }) {
  const { isLight } = usePortalTheme();
  const cx = portalClasses(isLight);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className={cn(
            'rounded-xl border p-4',
            isLight ? 'border-slate-200 bg-slate-50' : 'border-white/8 bg-black/20',
          )}
        >
          <div
            className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
            style={{ backgroundColor: 'var(--portal-accent)', color: 'var(--portal-accent-fg)' }}
          >
            {index + 1}
          </div>
          <step.icon className="mb-2 h-4 w-4" style={{ color: 'var(--portal-accent)' }} />
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
            className={cn(
              'overflow-hidden rounded-xl border',
              isLight ? 'border-slate-200 bg-white' : 'border-white/8 bg-black/20',
            )}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left"
            >
              <span className={cn('text-sm font-medium', cx.text)}>{item.q}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 transition-transform',
                  cx.textSubtle,
                  isOpen && 'rotate-180',
                )}
                style={isOpen ? { color: 'var(--portal-accent)' } : undefined}
              />
            </button>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className={cn(
                  'border-t px-4 pb-3 pt-2 text-sm leading-relaxed',
                  cx.textMuted,
                  isLight ? 'border-slate-100' : 'border-white/5',
                )}
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
  const { isLight } = usePortalTheme();
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
    <div
      className={cn(
        'rounded-xl p-4 ring-1',
        isLight ? 'bg-slate-50 ring-slate-200' : 'bg-black/40 ring-white/10',
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <dt className={cn('text-xs uppercase tracking-wider', cx.textSubtle)}>{label}</dt>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs',
            isLight ? 'bg-white text-slate-600 hover:bg-slate-100' : 'bg-white/5 text-white/70 hover:bg-white/10',
          )}
        >
          {copied ? (
            <Check className="h-3 w-3" style={{ color: 'var(--portal-accent)' }} />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <dd className={cn('break-all font-mono text-lg', cx.text)}>{value}</dd>
    </div>
  );
}

export function ConnectionStatusRing({ online, label }) {
  const { isLight } = usePortalTheme();
  if (online) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-24 w-24 items-center justify-center">
          <div
            className="absolute inset-0 animate-pulse rounded-full"
            style={{ backgroundColor: 'var(--portal-accent-soft)' }}
          />
          <div
            className="relative flex h-16 w-16 items-center justify-center rounded-full ring-4"
            style={{
              backgroundColor: 'var(--portal-accent-soft)',
              // eslint-disable-next-line no-restricted-syntax
              ['--tw-ring-color']: 'var(--portal-accent-ring)',
            }}
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: 'var(--portal-accent)' }}
            />
          </div>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--portal-accent)' }}>{label}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-amber-500/15" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 ring-4 ring-amber-400/30">
          <span className="h-3 w-3 rounded-full bg-amber-500" />
        </div>
      </div>
      <p className={cn('text-sm font-medium', isLight ? 'text-amber-700' : 'text-amber-200')}>{label}</p>
    </div>
  );
}

export function PayStepIndicator({ step }) {
  const { isLight } = usePortalTheme();
  const cx = portalClasses(isLight);
  const steps = ['Details', 'M-Pesa PIN', 'Connected'];
  return (
    <div className="mb-6 flex items-center justify-between gap-2">
      {steps.map((label, index) => {
        const active = index <= step;
        const current = index === step;
        const baseStyle =
          current
            ? { backgroundColor: 'var(--portal-accent)', color: 'var(--portal-accent-fg)' }
            : active
              ? { backgroundColor: 'var(--portal-accent-soft)', color: 'var(--portal-accent)' }
              : undefined;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition',
                  !active && (isLight ? 'bg-slate-100 text-slate-400' : 'bg-white/5 text-white/35'),
                )}
                style={baseStyle}
              >
                {index + 1}
              </div>
              <span
                className={cn(
                  'hidden text-[10px] uppercase tracking-wide sm:block',
                  active ? cx.textMuted : cx.textSubtle,
                )}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn('mb-5 h-px flex-1')}
                style={{
                  backgroundColor: active
                    ? 'var(--portal-accent-tint)'
                    : isLight
                      ? '#e2e8f0'
                      : 'rgba(255,255,255,0.1)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
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
      className="inline-flex items-center gap-1 text-sm hover:opacity-80"
      style={{ color: 'var(--portal-accent)' }}
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}
