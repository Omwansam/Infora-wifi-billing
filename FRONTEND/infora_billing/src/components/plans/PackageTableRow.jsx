import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2, Wifi, Router, Gift, Layers, Shield } from 'lucide-react';
import {
  PACKAGE_TYPE_META,
  packageSpeedHint,
  packageDurationLabel,
  packageDataLimitLabel,
  packagePriceLabel,
} from '../../lib/planUtils';
import { formatCurrency } from '../../lib/utils';

const ICONS = { wifi: Wifi, router: Router, gift: Gift, layers: Layers, shield: Shield };

export default function PackageTableRow({ plan, onEdit, onDelete, deleting }) {
  const navigate = useNavigate();
  const type = plan.plan_type || 'pppoe';
  const meta = PACKAGE_TYPE_META[type] || PACKAGE_TYPE_META.pppoe;
  const Icon = ICONS[meta.iconName] || Router;
  const speedHint = packageSpeedHint(plan);
  const price = packagePriceLabel(plan, formatCurrency);

  return (
    <tr
      className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors"
    >
      <td className="px-6 py-5">
        <div className="flex items-center gap-4 min-w-[220px]">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-sm ${meta.iconBg}`}
          >
            <Icon className="h-5 w-5" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{plan.name}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`text-[11px] font-bold tracking-wide ${meta.tagClass}`}>
                {meta.label}
              </span>
              {speedHint && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-slate-400">{speedHint}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-5 whitespace-nowrap">
        <span className={`text-sm font-bold ${price.isFree ? 'text-emerald-500' : 'text-slate-900'}`}>
          {price.text}
        </span>
      </td>
      <td className="px-6 py-5 text-sm text-slate-700 whitespace-nowrap">
        {packageDurationLabel(plan)}
      </td>
      <td className="px-6 py-5 text-sm text-slate-700 whitespace-nowrap">
        {packageDataLimitLabel(plan)}
      </td>
      <td className="px-6 py-5 whitespace-nowrap">
        <span
          className={`text-sm font-medium ${
            plan.is_active ? 'text-emerald-500' : 'text-slate-400'
          }`}
        >
          {plan.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-6 py-5">
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="View"
            onClick={() => navigate(`/plans/${plan.id}`)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Eye className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            title="Edit"
            onClick={() => onEdit(plan)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Pencil className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            title="Delete"
            disabled={deleting}
            onClick={() => onDelete(plan)}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>
      </td>
    </tr>
  );
}
