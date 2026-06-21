import { formatCurrency, formatDate } from '../../lib/utils';
import { BRAND } from '../../lib/brand';
import InvoiceStatusBadge from './InvoiceStatusBadge';

export default function InvoiceDocument({ invoice, compact = false }) {
  const items = invoice.items?.length
    ? invoice.items
    : [{ description: 'Service charge', quantity: 1, unit_price: invoice.amount, amount: invoice.amount }];

  const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const total = parseFloat(invoice.amount) || subtotal;

  return (
    <div className={`bg-white ${compact ? 'rounded-xl border border-slate-200' : 'rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50'} overflow-hidden`}>
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 px-6 sm:px-8 py-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-[0.2em]">{BRAND.fullName}</p>
            <h2 className="text-2xl sm:text-3xl font-bold mt-1">Invoice</h2>
            <p className="text-slate-300 mt-1 font-mono text-sm">{invoice.id || 'Draft'}</p>
          </div>
          <div className="text-left sm:text-right">
            {invoice.status && <InvoiceStatusBadge status={invoice.status} size="lg" />}
            <p className="text-slate-300 text-sm mt-3">Amount due</p>
            <p className="text-2xl sm:text-3xl font-bold">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      <div className={`px-6 sm:px-8 py-6 ${compact ? 'space-y-5' : 'space-y-8'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Bill to</p>
            <p className="font-semibold text-slate-900 text-lg">{invoice.customerName || 'Select customer'}</p>
            {invoice.customerEmail && <p className="text-slate-600 text-sm mt-1">{invoice.customerEmail}</p>}
            {invoice.customerPhone && <p className="text-slate-600 text-sm">{invoice.customerPhone}</p>}
            {invoice.customerAddress && <p className="text-slate-600 text-sm mt-1">{invoice.customerAddress}</p>}
          </div>
          <div className="sm:text-right space-y-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Issue date</p>
              <p className="text-slate-900 font-medium">{invoice.issueDate ? formatDate(invoice.issueDate) : '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Due date</p>
              <p className="text-slate-900 font-medium">{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</p>
            </div>
            {invoice.paidDate && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Paid date</p>
                <p className="text-emerald-700 font-medium">{formatDate(invoice.paidDate)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Description</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-28">Unit price</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-28">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item, index) => (
                <tr key={index} className={index % 2 === 1 ? 'bg-slate-50/50' : ''}>
                  <td className="px-4 py-3 text-sm text-slate-900">{item.description || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">{item.quantity ?? 1}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 text-right">
                    {formatCurrency(item.unit_price ?? item.amount ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right">
                    {formatCurrency(item.amount ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <div className="w-full sm:w-72 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t-2 border-slate-900">
              <span className="font-bold text-slate-900">Total</span>
              <span className="text-xl font-bold text-indigo-700">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {invoice.notes && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Notes</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {!compact && (
          <div className="pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
            Thank you for your business · {BRAND.fullName}
          </div>
        )}
      </div>
    </div>
  );
}
