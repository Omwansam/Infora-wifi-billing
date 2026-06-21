import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  BarChart3,
  DollarSign,
  TrendingUp,
  RefreshCw,
  ArrowLeftRight,
  Eye,
  X,
  Download,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../../lib/utils';
import { formatPaymentMethod, getMethodStyle, customerInitials } from '../../lib/billingFormatters';
import { API_ENDPOINTS, getAuthHeaders } from '../../config/api';
import { getAccessToken } from '../../utils/authToken';
import PaymentStatusBadge from './PaymentStatusBadge';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedTxn, setSelectedTxn] = useState(null);

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      const response = await fetch(`${API_ENDPOINTS.BILLING_TRANSACTIONS}?per_page=100`, {
        headers: getAuthHeaders(token),
      });
      const data = await response.json();
      if (response.ok) {
        setTransactions(data.transactions || []);
      } else {
        toast.error(data.message || 'Failed to load transactions');
      }
    } catch {
      toast.error('Failed to load transactions');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const typeOptions = useMemo(() => {
    const types = [...new Set(transactions.map((t) => t.type).filter(Boolean))];
    return types;
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((txn) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        (txn.customerName || '').toLowerCase().includes(q) ||
        (txn.reference || '').toLowerCase().includes(q) ||
        String(txn.id).includes(q);
      const matchesStatus = statusFilter === 'all' || txn.status === statusFilter;
      const matchesType = typeFilter === 'all' || txn.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [transactions, searchTerm, statusFilter, typeFilter]);

  const totalVolume = transactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
  const completedCount = transactions.filter((t) => t.status === 'completed').length;
  const successRate = transactions.length
    ? `${Math.round((completedCount / transactions.length) * 100)}%`
    : '0%';

  const statsCards = [
    {
      title: 'Total Transactions',
      value: transactions.length,
      subtitle: 'All ledger entries',
      icon: BarChart3,
      accent: 'from-indigo-500 to-violet-600',
    },
    {
      title: 'Total Volume',
      value: formatCurrency(totalVolume),
      subtitle: 'Combined transaction value',
      icon: DollarSign,
      accent: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Success Rate',
      value: successRate,
      subtitle: `${completedCount} completed`,
      icon: TrendingUp,
      accent: 'from-blue-500 to-cyan-600',
    },
    {
      title: 'Transaction Types',
      value: typeOptions.length,
      subtitle: 'Distinct categories',
      icon: ArrowLeftRight,
      accent: 'from-slate-600 to-slate-800',
    },
  ];

  const exportCsv = () => {
    if (!filteredTransactions.length) return;
    const headers = ['ID', 'Reference', 'Customer', 'Type', 'Method', 'Amount', 'Status', 'Date'];
    const rows = filteredTransactions.map((t) => [
      t.id,
      t.reference,
      t.customerName,
      t.typeLabel || t.type,
      t.methodLabel || formatPaymentMethod(t.method),
      t.amount,
      t.status,
      t.date,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transactions.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Transactions exported');
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Billing</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Transactions</h1>
              <p className="text-slate-600 mt-1">Financial ledger and payment activity history</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={loadTransactions}
                disabled={loading}
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={exportCsv}
                disabled={!filteredTransactions.length}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
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
          <div className="p-5 border-b border-slate-100 space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer, reference, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium ${
                    statusFilter === tab.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {typeOptions.length > 0 && (
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="all">All types</option>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100">
                  {['Reference', 'Customer', 'Type', 'Amount', 'Method', 'Status', 'Date', ''].map((h) => (
                    <th key={h || 'a'} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center text-slate-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading transactions…
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <ArrowLeftRight className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="font-semibold text-slate-900">No transactions found</p>
                      <p className="text-sm text-slate-500 mt-1">Transaction records appear when payments are processed.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((txn) => (
                    <tr
                      key={txn.id}
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedTxn(txn)}
                    >
                      <td className="px-5 py-4 font-mono text-sm font-semibold text-slate-900">{txn.reference}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                            {customerInitials(txn.customerName)}
                          </div>
                          <span className="font-medium text-slate-900">{txn.customerName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-slate-700 capitalize">{txn.typeLabel || txn.type?.replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-5 py-4 font-bold text-slate-900">{formatCurrency(txn.amount)}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${getMethodStyle(txn.method)}`}>
                          {txn.methodLabel || formatPaymentMethod(txn.method)}
                        </span>
                      </td>
                      <td className="px-5 py-4"><PaymentStatusBadge status={txn.status} /></td>
                      <td className="px-5 py-4 text-sm text-slate-600">{txn.date ? formatDate(txn.date) : '—'}</td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedTxn(txn)}
                          className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
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

          {!loading && filteredTransactions.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 text-sm text-slate-600">
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>
          )}
        </motion.div>
      </div>

      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-indigo-200 text-xs uppercase tracking-wider">Transaction</p>
                  <p className="font-mono font-bold text-lg mt-1">{selectedTxn.reference}</p>
                </div>
                <button onClick={() => setSelectedTxn(null)} className="text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-3xl font-bold mt-3">{formatCurrency(selectedTxn.amount)}</p>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Customer</span><span className="font-medium">{selectedTxn.customerName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-medium capitalize">{selectedTxn.typeLabel || selectedTxn.type}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Method</span><span className="font-medium">{selectedTxn.methodLabel || formatPaymentMethod(selectedTxn.method)}</span></div>
              <div className="flex justify-between items-center"><span className="text-slate-500">Status</span><PaymentStatusBadge status={selectedTxn.status} /></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{selectedTxn.date ? formatDate(selectedTxn.date) : '—'}</span></div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
