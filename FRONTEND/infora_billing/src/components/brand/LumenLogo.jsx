import React from 'react';
import { cn } from '../../lib/utils';
import { BRAND } from '../../lib/brand';

const SIZES = { xs: 28, sm: 36, md: 44, lg: 56, xl: 72 };

function LumenMark({ size = 44, className }) {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="lumen-bg" x1="8" y1="56" x2="56" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F59E0B" />
          <stop offset="0.45" stopColor="#F97316" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id="lumen-beam" x1="32" y1="12" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FEF3C7" />
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#A5F3FC" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="lumen-ring" x1="12" y1="52" x2="52" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <filter id="lumen-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer container */}
      <rect x="4" y="4" width="56" height="56" rx="16" fill="url(#lumen-bg)" />
      <rect x="4.5" y="4.5" width="55" height="55" rx="15.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />

      {/* WiFi signal arcs */}
      <path
        d="M18 38 C22 30, 42 30, 46 38"
        stroke="url(#lumen-ring)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M22 42 C25 36, 39 36, 42 42"
        stroke="url(#lumen-ring)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />

      {/* Light beam — stylized L + radiance */}
      <path
        d="M26 18 L26 46 L40 46"
        stroke="url(#lumen-beam)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#lumen-glow)"
      />
      <circle cx="32" cy="18" r="4" fill="#FEF9C3" filter="url(#lumen-glow)" />
      <path
        d="M32 8 L32 14 M26 10 L30 14 M38 10 L34 14"
        stroke="#FDE68A"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export default function LumenLogo({
  size = 'md',
  showText = false,
  subtitle,
  textClassName,
  subtitleClassName,
  className,
  orientation = 'horizontal',
  theme = 'light',
}) {
  const subtitleText = subtitle ?? BRAND.tagline;
  const nameClass =
    theme === 'dark'
      ? 'text-white'
      : 'bg-gradient-to-r from-amber-600 via-orange-500 to-violet-600 bg-clip-text text-transparent';
  const subClass =
    theme === 'dark' ? 'text-slate-500' : 'text-cyan-600/80';

  if (!showText) {
    return (
      <div className={cn('inline-flex items-center', className)}>
        <LumenMark size={size} />
      </div>
    );
  }

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-3',
        isVertical && 'flex-col text-center gap-2',
        className
      )}
    >
      <LumenMark size={size} />
      <div className={cn(isVertical && 'items-center', 'min-w-0')}>
        <p
          className={cn(
            'font-bold tracking-tight',
            size === 'xl' || size === 'lg' ? 'text-2xl sm:text-3xl' : 'text-base',
            nameClass,
            textClassName
          )}
        >
          {BRAND.name}
        </p>
        {subtitleText && (
          <p
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.2em]',
              subClass,
              subtitleClassName
            )}
          >
            {subtitleText}
          </p>
        )}
      </div>
    </div>
  );
}

export { LumenMark };
