import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  DollarSign,
  TrendingUp,
  Clock,
  RefreshCw,
  CreditCard,
  Eye,
  X,
  Receipt,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../../lib/utils';
import { formatPaymentMethod, getMethodStyle, customerInitials } from '../../lib/billingFormatters';
import { API_ENDPOINTS, getAuthHeaders } from '../../config/api';
import { getAccessToken } from '../../utils/authToken';
import PaymentStatusBadge from './PaymentStatusBadge';
import MpesaPayModal from './MpesaPayModal';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [collectOpen, setCollectOpen] = useState(false);
  const [mpesaOpen, setMpesaOpen] = useState(false);
  const [collectForm, setCollectForm] = useState({
    customerId: '',
    invoiceId: '',
    amount: '',
    phone: '',
    customerName: '',
  });

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const params = new URLSearchParams({ per_page: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const response = await fetch(`${API_ENDPOINTS.BILLING_PAYMENTS}?${params}`, {
        headers: getAuthHeaders(token),
      });
      const data = await response.json();
      if (response.ok) {
        setPayments(data.payments || []);
      } else {
        toast.error(data.message || 'Failed to load payments');
      }
    } catch {
      toast.error('Failed to load payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const q = searchTerm.toLowerCase();
      return (
        (payment.customerName || '').toLowerCase().includes(q) ||
        (payment.reference || '').toLowerCase().includes(q) ||
        String(payment.id).includes(q)
      );
    });
  }, [payments, searchTerm]);

  const totalCollected = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const pendingAmount = payments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const completedCount = payments.filter((p) => p.status === 'completed').length;
  const successRate = payments.length
    ? `${Math.round((completedCount / payments.length) * 100)}%`
    : '0%';

  const statsCards = [
    {
      title: 'Total Collected',
      value: formatCurrency(totalCollected),
      subtitle: `${completedCount} completed payments`,
      icon: DollarSign,
      accent: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Pending',
      value: formatCurrency(pendingAmount),
      subtitle: `${payments.filter((p) => p.status === 'pending').length} awaiting confirmation`,
      icon: Clock,
      accent: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Success Rate',
      value: successRate,
      subtitle: 'Of all recorded payments',
      icon: TrendingUp,
      accent: 'from-indigo-500 to-violet-600',
    },
    {
      title: 'Total Payments',
      value: payments.length,
      subtitle: 'All payment records',
      icon: CreditCard,
      accent: 'from-slate-600 to-slate-800',
    },
  ];

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Billing</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Payments</h1>
              <p className="text-slate-600 mt-1">Track collections, methods, and payment status</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadPayments}
                disabled={loading}
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setCollectOpen(true)}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200"
              >
                <Smartphone className="h-4 w-4 mr-2" />
                Collect via M-Pesa
              </button>
              <button
                onClick={() => navigate('/billing/invoices/create')}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                New invoice
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-2">{stat.subtitle}</p>
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent}`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer, reference, or payment ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    statusFilter === tab.value
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {['Payment', 'Customer', 'Amount', 'Method', 'Status', 'Date', ''].map((h) => (
                    <th key={h || 'actions'} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      Loading payments…
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <CreditCard className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="font-semibold text-slate-900">No payments found</p>
                      <p className="text-sm text-slate-500 mt-1">Payments appear here when customers pay invoices.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="hover:bg-emerald-50/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedPayment(payment)}
                    >
                      <td className="px-5 py-4">
                        <p className="font-mono text-sm font-semibold text-slate-900">{payment.reference}</p>
                        <p className="text-xs text-slate-500">ID #{payment.id}</p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                            {customerInitials(payment.customerName)}
                          </div>
                          <span className="font-medium text-slate-900">{payment.customerName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">{formatCurrency(payment.amount)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${getMethodStyle(payment.method)}`}>
                          {payment.methodLabel || formatPaymentMethod(payment.method)}
                        </span>
                      </td>
                      <td className="px-5 py-4"><PaymentStatusBadge status={payment.status} /></td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {payment.date ? formatDate(payment.date) : '—'}
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedPayment(payment)}
                          className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filteredPayments.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 text-sm text-slate-600">
              Showing {filteredPayments.length} of {payments.length} payments
            </div>
          )}
        </motion.div>
      </div>

      {selectedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-emerald-100 text-xs uppercase tracking-wider">Payment details</p>
                  <p className="font-mono font-bold text-lg mt-1">{selectedPayment.reference}</p>
                </div>
                <button onClick={() => setSelectedPayment(null)} className="text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-3xl font-bold mt-3">{formatCurrency(selectedPayment.amount)}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Customer</span>
                <span className="font-medium text-slate-900">{selectedPayment.customerName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Method</span>
                <span className="font-medium">{selectedPayment.methodLabel || formatPaymentMethod(selectedPayment.method)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <PaymentStatusBadge status={selectedPayment.status} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date</span>
                <span className="font-medium">{selectedPayment.date ? formatDate(selectedPayment.date) : '—'}</span>
              </div>
              {selectedPayment.invoiceId && (
                <button
                  onClick={() => navigate(`/billing/invoices/${selectedPayment.invoiceId}`)}
                  className="w-full mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50"
                >
                  <Receipt className="h-4 w-4" />
                  View linked invoice
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {collectOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Collect M-Pesa payment</h3>
            <p className="text-sm text-slate-500 mb-4">Enter customer and amount to send an STK push.</p>
            <div className="space-y-3">
              <input
                type="number"
                placeholder="Customer ID"
                value={collectForm.customerId}
                onChange={(e) => setCollectForm((f) => ({ ...f, customerId: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
              />
              <input
                type="number"
                placeholder="Invoice ID (optional)"
                value={collectForm.invoiceId}
                onChange={(e) => setCollectForm((f) => ({ ...f, invoiceId: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
              />
              <input
                type="number"
                placeholder="Amount (KES)"
                value={collectForm.amount}
                onChange={(e) => setCollectForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
              />
              <input
                type="tel"
                placeholder="M-Pesa phone"
                value={collectForm.phone}
                onChange={(e) => setCollectForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setCollectOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!collectForm.customerId || !collectForm.amount || !collectForm.phone) {
                    toast.error('Customer ID, amount, and phone are required');
                    return;
                  }
                  setCollectOpen(false);
                  setMpesaOpen(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      <MpesaPayModal
        open={mpesaOpen}
        onClose={() => setMpesaOpen(false)}
        customerId={Number(collectForm.customerId) || null}
        invoiceId={collectForm.invoiceId ? Number(collectForm.invoiceId) : null}
        amount={Number(collectForm.amount) || 0}
        customerName={collectForm.customerName}
        defaultPhone={collectForm.phone}
        onSuccess={() => {
          setMpesaOpen(false);
          loadPayments();
        }}
      />
    </div>
  );
}
