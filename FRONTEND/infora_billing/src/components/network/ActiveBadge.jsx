import { CheckCircle, XCircle } from 'lucide-react';

export default function ActiveBadge({ active = true }) {
  return active ? (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
      <CheckCircle className="h-3 w-3 mr-1" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20">
      <XCircle className="h-3 w-3 mr-1" />
      Inactive
    </span>
  );
}
