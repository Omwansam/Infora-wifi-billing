import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  DollarSign,
  Receipt,
  Plus,
  X,
  Calendar,
  Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  createFinanceExpense,
  formatExpenseCategory,
  getFinanceExpenses,
} from '../../services/financeService';

const EXPENSE_CATEGORIES = [
  'operating_expense',
  'bandwidth_expense',
  'equipment_expense',
  'staff_expense',
  'marketing_expense',
];

export default function FinanceExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    category: 'operating_expense',
    date: new Date().toISOString().slice(0, 10),
  });

  const loadExpenses = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getFinanceExpenses({
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      });
      if (response.success) {
        setExpenses(response.data.expenses || []);
        setStats(response.data.stats || {});
        setCategories(response.data.categories || []);
      } else {
        toast.error(response.message || 'Failed to load expenses');
      }
    } catch {
      toast.error('Failed to load expenses');
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  const statsCards = useMemo(
    () => [
      {
        title: 'Total Expenses',
        value: formatCurrency(stats.total_expenses ?? 0),
        subtitle: `${stats.count ?? expenses.length} recorded entries`,
        icon: Receipt,
        accent: 'from-rose-500 to-red-600',
      },
      {
        title: 'This Month',
        value: formatCurrency(stats.this_month ?? 0),
        subtitle: 'Operating costs so far',
        icon: Calendar,
        accent: 'from-amber-500 to-orange-600',
      },
      {
        title: 'Categories',
        value: categories.length || EXPENSE_CATEGORIES.length,
        subtitle: 'Expense classification types',
        icon: Tag,
        accent: 'from-slate-600 to-slate-800',
      },
    ],
    [stats, expenses.length, categories.length]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      setSaving(true);
      const response = await createFinanceExpense({
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: formData.date,
      });
      if (response.success) {
        toast.success('Expense recorded');
        setShowForm(false);
        setFormData({
          amount: '',
          category: 'operating_expense',
          date: new Date().toISOString().slice(0, 10),
        });
        loadExpenses();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save expense');
    } finally {
      setSaving(false);
    }
  };

  const filterOptions = ['all', ...new Set([...EXPENSE_CATEGORIES, ...categories])];

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-rose-600 uppercase tracking-wider">Finance</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Expenses</h1>
              <p className="text-slate-600 mt-1">Track operating costs, bandwidth, and infrastructure spend</p>
            </div>
            <div className="flex gap-3 self-start">
              <button
                onClick={loadExpenses}
                disabled={loading}
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Record Expense
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.accent}`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-2">{stat.subtitle}</p>
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setCategoryFilter(option)}
              className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                categoryFilter === option
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {option === 'all' ? 'All Categories' : formatExpenseCategory(option)}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-rose-600 border-t-transparent mx-auto" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-16">
              <DollarSign className="h-12 w-12 text-slate-300 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No expenses recorded</h3>
              <p className="text-slate-500 mt-1">Start tracking your operating costs.</p>
              <button
                onClick={() => setShowForm(true)}
                className="mt-6 inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Record Expense
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {expense.date ? formatDate(expense.date) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700">
                          {formatExpenseCategory(expense.category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 text-right">
                        {formatCurrency(expense.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => setShowForm(false)}
            >
              <motion.div
                initial={{ scale: 0.96 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.96 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900">Record Expense</h2>
                  <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount (KES)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                      placeholder="15000"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                    >
                      {EXPENSE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {formatExpenseCategory(category)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500"
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Expense'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
