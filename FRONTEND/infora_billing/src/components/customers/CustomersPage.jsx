import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Users,
  DollarSign,
  RefreshCw,
  UserPlus,
  FileText,
  AlertCircle,
  Pause,
  Play,
} from 'lucide-react';
import { customerService } from '../../services/customerService';
import { formatCurrency, formatDate } from '../../lib/utils';
import { customerInitials } from '../../lib/billingFormatters';
import { isSubscriptionExpired } from '../../lib/subscriptionUtils';
import PaymentStatusBadge from '../billing/PaymentStatusBadge';
import KycStatusBadge from './KycStatusBadge';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
];

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [stats, setStats] = useState({});
  const [statsLoading, setStatsLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [actionId, setActionId] = useState(null);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const result = await customerService.getCustomers({
        page: currentPage,
        per_page: 20,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (result.success) {
        setCustomers(result.data.customers || []);
        setTotalPages(result.data.pages || 1);
        setTotalCustomers(result.data.total || 0);
      } else {
        toast.error(result.error || 'Failed to load customers');
      }
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const result = await customerService.getCustomerStats();
      if (result.success) setStats(result.data || {});
    } catch {
      setStats({});
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(loadCustomers, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadCustomers, searchTerm]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleAccessToggle = async (customer) => {
    try {
      setActionId(customer.id);
      const isSuspend = customer.status === 'active';
      const result = isSuspend
        ? await customerService.suspendCustomer(customer.id)
        : await customerService.activateCustomer(customer.id);
      if (result.success) {
        toast.success(isSuspend ? 'Suspended — RADIUS removed' : 'Activated — RADIUS provisioned');
        loadCustomers();
        loadStats();
      } else {
        toast.error(result.error || 'Action failed');
      }
    } catch {
      toast.error('Action failed');
    } finally {
      setActionId(null);
    }
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      setDeleting(true);
      const result = await customerService.deleteCustomer(customerToDelete.id);
      if (result.success) {
        toast.success('Customer deleted');
        setDeleteModalOpen(false);
        setCustomerToDelete(null);
        loadCustomers();
        loadStats();
      } else {
        toast.error(result.error || 'Failed to delete customer');
      }
    } catch {
      toast.error('Failed to delete customer');
    } finally {
      setDeleting(false);
    }
  };

  const statsCards = useMemo(
    () => [
      {
        title: 'Total Customers',
        value: stats.total_customers ?? 0,
        subtitle: 'Registered accounts',
        icon: Users,
        accent: 'from-blue-500 to-indigo-600',
      },
      {
        title: 'Active',
        value: stats.active_customers ?? 0,
        subtitle: stats.pending_customers ? `${stats.pending_customers} pending onboarding` : 'Currently subscribed',
        icon: UserPlus,
        accent: 'from-emerald-500 to-teal-600',
      },
      {
        title: 'Outstanding Balance',
        value: formatCurrency(stats.total_balance ?? 0),
        subtitle: `${stats.customers_with_balance ?? 0} with balance due`,
        icon: DollarSign,
        accent: 'from-violet-500 to-purple-600',
      },
      {
        title: 'Suspended',
        value: stats.suspended_customers ?? 0,
        subtitle: 'Needs follow-up',
        icon: AlertCircle,
        accent: 'from-amber-500 to-orange-600',
      },
    ],
    [stats]
  );

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Customers</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Customer Directory</h1>
              <p className="text-slate-600 mt-1">Accounts, subscriptions, balances, and verification</p>
            </div>
            <div className="flex flex-wrap gap-3 self-start">
              <button
                onClick={() => {
                  loadCustomers();
                  loadStats();
                }}
                disabled={loading || statsLoading}
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading || statsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <Link
                to="/customers/kyc"
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                KYC
              </Link>
              <Link
                to="/customers/new"
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Link>
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
              className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-5 shadow-sm"
            >
              <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${stat.accent}`} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  {statsLoading ? (
                    <div className="h-8 w-20 bg-slate-100 rounded mt-2 animate-pulse" />
                  ) : (
                    <>
                      <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                      <p className="text-xs text-slate-500 mt-2">{stat.subtitle}</p>
                    </>
                  )}
                </div>
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.accent} text-white`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setStatusFilter(tab.value);
                    setCurrentPage(1);
                  }}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                    statusFilter === tab.value
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent mx-auto" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16">
              <Users className="h-12 w-12 text-slate-300 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No customers found</h3>
              <Link to="/customers/new" className="mt-4 inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">KYC</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Balance</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Expires</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Usage</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
                            {customerInitials(customer.name)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{customer.name}</p>
                            <p className="text-sm text-slate-500">{customer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        <p>{customer.package || '—'}</p>
                        <p className="text-slate-400">{customer.device_count || 0} devices</p>
                      </td>
                      <td className="px-6 py-4">
                        <PaymentStatusBadge status={customer.status} />
                      </td>
                      <td className="px-6 py-4">
                        <KycStatusBadge status={customer.kyc_status || 'pending'} />
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                        {formatCurrency(customer.balance)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {customer.subscription_end ? (
                          <span className={isSubscriptionExpired(customer.subscription_end) ? 'text-rose-600 font-medium' : 'text-slate-600'}>
                            {formatDate(customer.subscription_end)}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${customer.usage_percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">{customer.usage_percentage || 0}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {(customer.status === 'active' || customer.status === 'suspended') && (
                            <button
                              onClick={() => handleAccessToggle(customer)}
                              disabled={actionId === customer.id}
                              className={`p-2 rounded-lg disabled:opacity-50 ${
                                customer.status === 'active'
                                  ? 'text-amber-600 hover:bg-amber-50'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={customer.status === 'active' ? 'Suspend RADIUS' : 'Activate RADIUS'}
                            >
                              {customer.status === 'active' ? (
                                <Pause className="h-4 w-4" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => navigate(`/customers/${customer.id}`)}
                            className="p-2 rounded-lg text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/customers/${customer.id}/edit`)}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setCustomerToDelete(customer);
                              setDeleteModalOpen(true);
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between bg-white rounded-2xl border border-slate-200 p-4 mt-6">
            <p className="text-sm text-slate-600">
              Showing {(currentPage - 1) * 20 + 1}–{Math.min(currentPage * 20, totalCustomers)} of {totalCustomers}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {deleteModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              onClick={() => !deleting && setDeleteModalOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.96 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.96 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
                    <Trash2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Delete customer</h3>
                    <p className="text-sm text-slate-500">This action cannot be undone.</p>
                  </div>
                </div>
                <p className="text-sm text-slate-700 mb-6">
                  Remove <span className="font-semibold">{customerToDelete?.name}</span> and all associated records?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteModalOpen(false)}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
