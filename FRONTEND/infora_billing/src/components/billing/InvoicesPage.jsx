import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Filter,
  FileText,
  DollarSign,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Eye,
  Send,
  Edit,
  Trash2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { invoiceService } from '../../services/invoiceService';
import { formatCurrency, formatDate } from '../../lib/utils';

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
    overdue_amount: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  // Load invoices from API
  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        per_page: 20,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      };

      const response = await invoiceService.getInvoices(params);
      
      if (response.success) {
        setInvoices(response.data.invoices);
        setTotalPages(response.data.pages);
        setTotalInvoices(response.data.total);
      } else {
        toast.error('Failed to load invoices');
        console.error('Load invoices error:', response.error);
      }
    } catch (error) {
      toast.error('Failed to load invoices');
      console.error('Load invoices error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load stats from API
  const loadStats = async () => {
    try {
      setStatsLoading(true);
      const response = await invoiceService.getInvoiceStats();
      
      if (response.success) {
        setStats(response.data);
      } else {
        toast.error('Failed to load invoice statistics');
        console.error('Load stats error:', response.error);
      }
    } catch (error) {
      toast.error('Failed to load invoice statistics');
      console.error('Load stats error:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    loadInvoices();
  }, [currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    loadStats();
  }, []);

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle status filter
  const handleStatusFilter = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Handle refresh
  const handleRefresh = () => {
    loadInvoices();
    loadStats();
    toast.success('Data refreshed');
  };

  // Handle view invoice
  const handleViewInvoice = (invoice) => {
    navigate(`/billing/invoices/${invoice.invoice_id}`);
  };

  // Handle edit invoice
  const handleEditInvoice = (invoice) => {
    navigate(`/billing/invoices/${invoice.invoice_id}/edit`);
  };

  // Handle delete invoice
  const handleDeleteInvoice = (invoice) => {
    setInvoiceToDelete(invoice);
    setDeleteModalOpen(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!invoiceToDelete) return;

    try {
      setDeleting(true);
      const response = await invoiceService.deleteInvoice(invoiceToDelete.invoice_id);
      
      if (response.success) {
        toast.success('Invoice deleted successfully');
        loadInvoices();
        loadStats();
      } else {
        toast.error(response.error || 'Failed to delete invoice');
      }
    } catch (error) {
      toast.error('Failed to delete invoice');
      console.error('Delete invoice error:', error);
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setInvoiceToDelete(null);
    }
  };

  // Handle send reminder
  const handleSendReminder = async (invoice) => {
    try {
      setSendingReminder(true);
      const response = await invoiceService.sendInvoiceReminder(invoice.invoice_id);
      
      if (response.success) {
        toast.success('Invoice reminder sent successfully');
      } else {
        toast.error(response.error || 'Failed to send reminder');
      }
    } catch (error) {
      toast.error('Failed to send reminder');
      console.error('Send reminder error:', error);
    } finally {
      setSendingReminder(false);
    }
  };

  // Handle download invoice
  const handleDownloadInvoice = async (invoice) => {
    try {
      const response = await invoiceService.generateInvoicePDF(invoice.invoice_id || invoice.id);
      
      if (response.success) {
        // Create a blob from the HTML response
        const blob = new Blob([response.data], { type: 'text/html' });
        const url = window.URL.createObjectURL(blob);
        
        // Open the HTML in a new window and trigger print
        const printWindow = window.open(url, '_blank');
        
        printWindow.onload = function() {
          // Wait a bit for the content to load, then print
          setTimeout(() => {
            printWindow.print();
            // Close the window after printing
            setTimeout(() => {
              printWindow.close();
              window.URL.revokeObjectURL(url);
            }, 1000);
          }, 500);
        };
        
        toast.success('Invoice PDF ready for printing/download');
      } else {
        toast.error(response.error || 'Failed to download invoice');
      }
    } catch (error) {
      toast.error('Failed to download invoice');
      console.error('Download error:', error);
    }
  };

  // Handle create invoice
  const handleCreateInvoice = () => {
    navigate('/billing/invoices/create');
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      paid: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      overdue: { color: 'bg-red-100 text-red-800', icon: XCircle },
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock }
    };
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Stats cards data
  const statsCards = [
    {
      title: 'Total Invoices',
      value: statsLoading ? '...' : stats.total_invoices,
      change: '+15%',
      icon: FileText,
      color: 'bg-blue-500'
    },
    {
      title: 'Total Amount',
      value: statsLoading ? '...' : formatCurrency(stats.total_amount),
      change: '+12%',
      icon: DollarSign,
      color: 'bg-green-500'
    },
    {
      title: 'Overdue Invoices',
      value: statsLoading ? '...' : stats.overdue_invoices,
      change: '-8%',
      icon: AlertCircle,
      color: 'bg-red-500'
    },
    {
      title: 'Collection Rate',
      value: statsLoading ? '...' : stats.total_invoices > 0 
        ? `${Math.round((stats.paid_invoices / stats.total_invoices) * 100)}%`
        : '0%',
      change: '+3%',
      icon: TrendingUp,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invoices</h1>
              <p className="text-gray-600 mt-2">Manage and track customer invoices</p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={handleRefresh}
                disabled={loading || statsLoading}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(loading || statsLoading) ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button 
                onClick={handleCreateInvoice}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </button>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statsCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-sm text-green-600 mt-1">{stat.change} from last month</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search invoices by customer or invoice number..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={handleStatusFilter}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="all">All Status</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="pending">Pending</option>
              </select>
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                <Filter className="h-4 w-4 mr-2" />
                More Filters
              </button>
            </div>
          </div>
        </motion.div>

        {/* Invoices Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Paid Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                        <span className="text-gray-500">Loading invoices...</span>
                      </div>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-lg font-medium">No invoices found</p>
                        <p className="text-sm">Get started by creating your first invoice.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.id}</div>
                        <div className="text-sm text-gray-500">{invoice.items?.length || 0} items</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{invoice.customerName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{formatCurrency(invoice.amount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invoice.paidDate ? formatDate(invoice.paidDate) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleViewInvoice(invoice)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                            title="View Invoice"
                          >
                          <Eye className="h-4 w-4" />
                        </button>
                          <button 
                            onClick={() => handleEditInvoice(invoice)}
                            className="text-yellow-600 hover:text-yellow-900 transition-colors"
                            title="Edit Invoice"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDownloadInvoice(invoice)}
                            className="text-gray-600 hover:text-gray-900 transition-colors"
                            title="Download Invoice"
                          >
                          <Download className="h-4 w-4" />
                        </button>
                          <button 
                            onClick={() => handleSendReminder(invoice)}
                            disabled={sendingReminder}
                            className="text-green-600 hover:text-green-900 transition-colors disabled:opacity-50"
                            title="Send Reminder"
                          >
                          <Send className="h-4 w-4" />
                        </button>
                          <button 
                            onClick={() => handleDeleteInvoice(invoice)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                            title="Delete Invoice"
                          >
                            <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Pagination */}
        {!loading && invoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4 mt-6"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{((currentPage - 1) * 20) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * 20, totalInvoices)}</span> of{' '}
                <span className="font-medium">{totalInvoices}</span> results
            </div>
            <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                Previous
              </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'border-blue-500 text-blue-600 bg-blue-50'
                          : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
              </button>
                  );
                })}
                
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                Next
              </button>
            </div>
          </div>
        </motion.div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <AlertCircle className="h-6 w-6 text-red-600 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">Delete Invoice</h3>
              </div>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete invoice <strong>{invoiceToDelete?.id}</strong>? 
                This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
