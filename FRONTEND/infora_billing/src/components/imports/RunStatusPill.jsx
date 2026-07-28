import React from 'react';

const TONES = {
  scanning: 'bg-blue-50 text-blue-700 border-blue-200',
  scanned: 'bg-slate-100 text-slate-700 border-slate-200',
  importing: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  reverted: 'bg-violet-50 text-violet-700 border-violet-200',
};

const LABELS = {
  scanning: 'Scanning',
  scanned: 'Ready to review',
  importing: 'Importing',
  completed: 'Imported',
  failed: 'Failed',
  reverted: 'Reverted',
};

export default function RunStatusPill({ status }) {
  const tone = TONES[status] || TONES.scanned;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {LABELS[status] || status}
    </span>
  );
}
