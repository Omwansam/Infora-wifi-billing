import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import AuthBackdrop from '../brand/AuthBackdrop';
import { BRAND } from '../../lib/brand';
import './onboarding.css';

export default function OnboardingLayout({ children, wide = false }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="onb">
      <AuthBackdrop />

      <button
        type="button"
        className="onb__theme-toggle"
        onClick={toggleTheme}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Light theme' : 'Dark theme'}
      >
        {isDark ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="onb__shell">
        <main className={`onb__card${wide ? ' onb__card--wide' : ''}`}>{children}</main>
        <p className="onb__footer">{BRAND.copyright()}</p>
      </div>
    </div>
  );
}
