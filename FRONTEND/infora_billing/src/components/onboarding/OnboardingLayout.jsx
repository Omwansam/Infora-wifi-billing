import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { BRAND } from '../../lib/brand';
import './onboarding.css';

/**
 * Fixed constellation backdrop.
 *
 * Hand-placed rather than randomised: the same nodes every load means the page
 * does not visibly rearrange itself between steps, which is distracting when
 * someone is halfway through a form. Percentage coordinates on a
 * `preserveAspectRatio="none"` viewBox let it stretch to any viewport.
 */
function Backdrop() {
  const nodes = [
    [6, 4], [62, 14], [92, 44], [79, 88], [39, 96], [13, 84], [1, 40],
  ];
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]];

  return (
    <div className="onb__backdrop" aria-hidden="true">
      <div className="onb__grid" />
      <svg
        className="onb__constellation"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {edges.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            x1={nodes[a][0]} y1={nodes[a][1]}
            x2={nodes[b][0]} y2={nodes[b][1]}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {nodes.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.4" />
        ))}
      </svg>
    </div>
  );
}

export default function OnboardingLayout({ children, wide = false }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <div className="onb">
      <Backdrop />

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
