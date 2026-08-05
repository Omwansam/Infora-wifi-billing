import React from 'react';
import { Check, ChevronLeft } from 'lucide-react';

export const TOTAL_STEPS = 5;

/**
 * The 1–5 progress pips, with an optional back affordance.
 *
 * `onBack` is omitted rather than disabled on step 1 — there is nowhere to go
 * back to, and a dead control reads as broken.
 */
export default function StepIndicator({ current, onBack, disabled = false }) {
  const steps = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1);

  return (
    <nav
      className="onb__steps"
      aria-label={`Step ${current} of ${TOTAL_STEPS}`}
    >
      {onBack && (
        <button
          type="button"
          className="onb__back"
          onClick={onBack}
          disabled={disabled}
        >
          <ChevronLeft size={16} />
          Back
        </button>
      )}

      {steps.map((step) => {
        const done = step < current;
        const active = step === current;
        return (
          <React.Fragment key={step}>
            {step > 1 && (
              <span className={`onb__rule${done || active ? ' onb__rule--done' : ''}`} />
            )}
            <span
              className={
                'onb__pip'
                + (active ? ' onb__pip--active' : '')
                + (done ? ' onb__pip--done' : '')
              }
              aria-current={active ? 'step' : undefined}
            >
              {done ? <Check size={15} strokeWidth={3} /> : step}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
