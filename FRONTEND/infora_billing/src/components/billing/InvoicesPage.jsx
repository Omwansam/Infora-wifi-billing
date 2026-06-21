import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  AlertCircle,
  Download,
  Eye,
  Send,
  Edit,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  Smartphone,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { invoiceService } from '../../services/invoiceService';
import { formatCurrency, formatDate } from '../../lib/utils';
import InvoiceStatusBadge from './InvoiceStatusBadge';
import MpesaPayModal from './MpesaPayModal';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
];

function CustomerAvatar({ name }) {
  const initials = (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
      {initials}
    </div>
  );
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [stats, setStats] = useState({
    total_invoices: 0,
    pending_invoices: 0,
    paid_invoices: 0,
    overdue_invoices: 0,
    total_amount: 0,
    pending_amount: 0,
    paid_amount: 0,
    overdue_amount: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [mpesaInvoice, setMpesaInvoice] = useState(null);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const response = await invoiceService.getInvoices({
        page: currentPage,
        per_page: 20,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (response.success) {
        setInvoices(response.data.invoices);
        setTotalPages(response.data.pages);
        setTotalInvoices(response.data.total);
      } else {
        toast.error('Failed to load invoices');
      }
    } catch {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await invoiceService.getInvoiceStats();
      if (response.success) setStats(response.data);
    } catch {
      toast.error('Failed to load invoice statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    loadStats();
  }, []);

  const handleRefresh = () => {
    loadInvoices();
    loadStats();
    toast.success('Invoices refreshed');
  };

  const handleDownloadInvoice = async (invoice) => {
    try {
      const response = await invoiceService.generateInvoicePDF(invoice.invoice_id);
      if (response.success) {
        const blob = new Blob([response.data], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            setTimeout(() => {
              printWindow.close();
              window.URL.revokeObjectURL(url);
            }, 1000);
          }, 500);
        };
        toast.success('Invoice ready to print or save as PDF');
      } else {
        toast.error(response.error || 'Failed to download invoice');
      }
    } catch {
      toast.error('Failed to download invoice');
    }
  };

  const handleSendReminder = async (invoice) => {
    try {
      setSendingReminder(invoice.invoice_id);
      const response = await invoiceService.sendInvoiceReminder(invoice.invoice_id);
      if (response.success) toast.success('Reminder sent successfully');
      else toast.error(response.error || 'Failed to send reminder');
    } catch {
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      setDeleting(true);
      const response = await invoiceService.deleteInvoice(invoiceToDelete.invoice_id);
      if (response.success) {
        toast.success('Invoice deleted');
        loadInvoices();
        loadStats();
      } else {
        toast.error(response.error || 'Failed to delete invoice');
      }
    } catch {
      toast.error('Failed to delete invoice');
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const collectionRate = stats.total_invoices > 0
    ? Math.round((stats.paid_invoices / stats.total_invoices) * 100)
    : 0;

  const statsCards = [
    {
      title: 'Total Revenue',
      value: statsLoading ? '…' : formatCurrency(stats.total_amount),
      subtitle: `${stats.total_invoices} invoices issued`,
      icon: DollarSign,
      accent: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Outstanding',
      value: statsLoading ? '…' : formatCurrency(stats.pending_amount + stats.overdue_amount),
      subtitle: `${stats.pending_invoices + stats.overdue_invoices} unpaid invoices`,
      icon: Clock,
      accent: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Overdue',
      value: statsLoading ? '…' : stats.overdue_invoices,
      subtitle: formatCurrency(stats.overdue_amount),
      icon: AlertCircle,
      accent: 'from-rose-500 to-red-600',
    },
    {
      title: 'Collection Rate',
      value: statsLoading ? '…' : `${collectionRate}%`,
      subtitle: `${stats.paid_invoices} paid invoices`,
      icon: TrendingUp,
      accent: 'from-indigo-500 to-violet-600',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">Billing</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Invoices</h1>
              <p className="text-slate-600 mt-1">Create, track, and collect customer payments</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={loading || statsLoading}
                className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading || statsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => navigate('/billing/invoices/create')}
                className="inline-flex items-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Invoice
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
          className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-6 overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by invoice number or customer..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => { setStatusFilter(tab.value); setCurrentPage(1); }}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    statusFilter === tab.value
                      ? 'bg-indigo-600 text-white shadow-sm'
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
                  {['Invoice', 'Customer', 'Amount', 'Status', 'Due', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-500 mx-auto mb-2" />
                      <p className="text-slate-500">Loading invoices…</p>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="font-semibold text-slate-900">No invoices found</p>
                      <p className="text-sm text-slate-500 mt-1 mb-4">
                        {statusFilter !== 'all' || searchTerm
                          ? 'Try changing your filters or search term.'
                          : 'Create your first invoice to start billing customers.'}
                      </p>
                      {!searchTerm && statusFilter === 'all' && (
                        <button
                          onClick={() => navigate('/billing/invoices/create')}
                          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Invoice
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => (
                    <tr
                      key={invoice.invoice_id}
                      className="hover:bg-indigo-50/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/billing/invoices/${invoice.invoice_id}`)}
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900 font-mono text-sm">{invoice.id}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {invoice.issueDate ? formatDate(invoice.issueDate) : '—'} · {invoice.items?.length || 0} items
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <CustomerAvatar name={invoice.customerName} />
                          <p className="font-medium text-slate-900">{invoice.customerName}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">{formatCurrency(invoice.amount)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {invoice.dueDate ? formatDate(invoice.dueDate) : '—'}
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => navigate(`/billing/invoices/${invoice.invoice_id}`)}
                            className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/billing/invoices/${invoice.invoice_id}/edit`)}
                            className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadInvoice(invoice)}
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            title="Download"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenu(openMenu === invoice.invoice_id ? null : invoice.invoice_id)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {openMenu === invoice.invoice_id && (
                              <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-lg z-10 py-1">
                                {invoice.status !== 'paid' && (
                                  <button
                                    onClick={() => {
                                      setMpesaInvoice(invoice);
                                      setOpenMenu(null);
                                    }}
                                    className="w-full px-4 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
                                  >
                                    <Smartphone className="h-4 w-4" />
                                    Pay with M-Pesa
                                  </button>
                                )}
                                <button
                                  onClick={() => { handleSendReminder(invoice); setOpenMenu(null); }}
                                  disabled={sendingReminder === invoice.invoice_id}
                                  className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Send className="h-4 w-4" />
                                  Send reminder
                                </button>
                                <button
                                  onClick={() => {
                                    setInvoiceToDelete(invoice);
                                    setDeleteModalOpen(true);
                                    setOpenMenu(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && invoices.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Showing {((currentPage - 1) * 20) + 1}–{Math.min(currentPage * 20, totalInvoices)} of {totalInvoices}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-rose-100">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Delete invoice</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Delete <strong className="font-mono">{invoiceToDelete?.id}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete invoice'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <MpesaPayModal
        open={Boolean(mpesaInvoice)}
        onClose={() => setMpesaInvoice(null)}
        customerId={mpesaInvoice?.customerId}
        invoiceId={mpesaInvoice?.invoice_id}
        amount={mpesaInvoice?.amount}
        customerName={mpesaInvoice?.customerName}
        invoiceLabel={mpesaInvoice?.id}
        defaultPhone={mpesaInvoice?.customerPhone}
        onSuccess={() => {
          setMpesaInvoice(null);
          loadInvoices();
          loadStats();
        }}
      />
    </div>
  );
}
