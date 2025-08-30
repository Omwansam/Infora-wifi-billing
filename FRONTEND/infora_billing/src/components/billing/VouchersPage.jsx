import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Filter,
  Gift,
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Eye,
  Copy,
  Edit,
  Trash2,
  RefreshCw,
  FileText,
  MoreVertical
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/utils';
import voucherService from '../../services/voucherService';
import VoucherForm from './VoucherForm';
import toast from 'react-hot-toast';

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVouchers, setTotalVouchers] = useState(0);

  // Form states
  const [formData, setFormData] = useState({
    voucher_code: '',
    voucher_type: 'percentage',
    voucher_value: '',
    expiry_date: '',
    max_usage: 1,
    is_active: true
  });

  const [bulkFormData, setBulkFormData] = useState({
    count: 10,
    voucher_type: 'percentage',
    voucher_value: '',
    expiry_date: '',
    max_usage: 1
  });

  useEffect(() => {
    fetchVouchers();
    fetchStats();
  }, [currentPage, statusFilter, typeFilter, searchTerm]);

  const fetchVouchers = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        per_page: 20,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        voucher_type: typeFilter !== 'all' ? typeFilter : undefined,
        search: searchTerm || undefined
      };

      const response = await voucherService.getVouchers(params);
      setVouchers(response.vouchers || []);
      setTotalPages(response.pages || 1);
      setTotalVouchers(response.total || 0);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      toast.error('Failed to fetch vouchers');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await voucherService.getVoucherStats();
      setStats(response);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    try {
      await voucherService.createVoucher(formData);
      toast.success('Voucher created successfully');
      setShowCreateModal(false);
      resetFormData();
      fetchVouchers();
      fetchStats();
    } catch (error) {
      console.error('Error creating voucher:', error);
      toast.error(error.message || 'Failed to create voucher');
    }
  };

  const handleBulkGenerate = async (e) => {
    e.preventDefault();
    try {
      await voucherService.bulkGenerateVouchers(bulkFormData);
      toast.success(`${bulkFormData.count} vouchers generated successfully`);
      setShowBulkModal(false);
      resetBulkFormData();
      fetchVouchers();
      fetchStats();
    } catch (error) {
      console.error('Error bulk generating vouchers:', error);
      toast.error(error.message || 'Failed to generate vouchers');
    }
  };

  const handleDeleteVoucher = async (voucherId) => {
    if (!window.confirm('Are you sure you want to delete this voucher?')) {
      return;
    }

    try {
      await voucherService.deleteVoucher(voucherId);
      toast.success('Voucher deleted successfully');
      fetchVouchers();
      fetchStats();
    } catch (error) {
      console.error('Error deleting voucher:', error);
      toast.error('Failed to delete voucher');
    }
  };

  const handleViewVoucher = (voucher) => {
    setSelectedVoucher(voucher);
    setShowViewModal(true);
  };

  const handleEditVoucher = (voucher) => {
    setSelectedVoucher(voucher);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      await voucherService.updateVoucher(selectedVoucher.id, formData);
      toast.success('Voucher updated successfully');
      setShowEditModal(false);
      setSelectedVoucher(null);
      resetFormData();
      fetchVouchers();
      fetchStats();
    } catch (error) {
      console.error('Error updating voucher:', error);
      toast.error(error.message || 'Failed to update voucher');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadVoucherData = (voucher) => {
    const data = {
      voucher_code: voucher.voucher_code,
      voucher_type: voucher.voucher_type,
      voucher_value: voucher.voucher_value,
      voucher_status: voucher.voucher_status,
      expiry_date: voucher.expiry_date,
      usage_count: voucher.usage_count,
      max_usage: voucher.max_usage,
      is_active: voucher.is_active,
      created_at: voucher.created_at,
      used_by: voucher.used_by,
      used_at: voucher.used_at
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voucher-${voucher.voucher_code}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Voucher data downloaded');
  };

  const downloadAllVouchers = () => {
    const data = vouchers.map(voucher => ({
      voucher_code: voucher.voucher_code,
      voucher_type: voucher.voucher_type,
      voucher_value: voucher.voucher_value,
      voucher_status: voucher.voucher_status,
      expiry_date: voucher.expiry_date,
      usage_count: voucher.usage_count,
      max_usage: voucher.max_usage,
      is_active: voucher.is_active,
      created_at: voucher.created_at,
      used_by: voucher.used_by,
      used_at: voucher.used_at
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-vouchers-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('All vouchers downloaded');
  };

  const resetFormData = () => {
    setFormData({
      voucher_code: '',
      voucher_type: 'percentage',
      voucher_value: '',
      expiry_date: '',
      max_usage: 1,
      is_active: true
    });
  };

  const resetBulkFormData = () => {
    setBulkFormData({
      count: 10,
      voucher_type: 'percentage',
      voucher_value: '',
      expiry_date: '',
      max_usage: 1
    });
  };

  const getStatusColor = (status) => {
    return voucherService.getVoucherStatusColor(status);
  };

  const getStatusIcon = (status) => {
    const iconName = voucherService.getVoucherStatusIcon(status);
    const icons = { CheckCircle, XCircle, Clock, Gift, Circle: CheckCircle };
    return icons[iconName] || CheckCircle;
  };

  const formatVoucherValue = (voucher) => {
    return voucherService.formatVoucherValue(voucher);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
        {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vouchers</h1>
          <p className="text-gray-600">Manage discount vouchers and promotional codes</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadAllVouchers}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Bulk Generate
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Voucher
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-lg shadow-sm border"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Vouchers</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total_vouchers || 0}</p>
            </div>
            <Gift className="w-8 h-8 text-blue-600" />
          </div>
        </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-lg shadow-sm border"
            >
              <div className="flex items-center justify-between">
                <div>
              <p className="text-sm font-medium text-gray-600">Active Vouchers</p>
              <p className="text-2xl font-bold text-green-600">{stats.active_vouchers || 0}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-lg shadow-sm border"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Used Vouchers</p>
              <p className="text-2xl font-bold text-blue-600">{stats.used_vouchers || 0}</p>
                </div>
            <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
            </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-lg shadow-sm border"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Usage</p>
              <p className="text-2xl font-bold text-purple-600">{stats.total_usage || 0}</p>
            </div>
            <DollarSign className="w-8 h-8 text-purple-600" />
          </div>
        </motion.div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6">
        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                placeholder="Search vouchers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
                <option value="used">Used</option>
              </select>
            
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            
            <button
              onClick={fetchVouchers}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
              </button>
            </div>
          </div>
      </div>

        {/* Vouchers Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Voucher Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type & Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expiry Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
              {vouchers.map((voucher) => {
                const StatusIcon = getStatusIcon(voucher.voucher_status);
                return (
                  <motion.tr
                    key={voucher.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-gray-900">
                          {voucher.voucher_code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(voucher.voucher_code)}
                          className="text-gray-400 hover:text-gray-600"
                          title="Copy code"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        <span className="capitalize">{voucher.voucher_type}</span>
                        <span className="mx-2">•</span>
                        <span className="font-medium">
                          {formatVoucherValue(voucher)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`w-4 h-4 text-${getStatusColor(voucher.voucher_status)}-600`} />
                        <span className={`text-sm font-medium text-${getStatusColor(voucher.voucher_status)}-600 capitalize`}>
                          {voucher.voucher_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {voucher.usage_count} / {voucher.max_usage}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(voucher.expiry_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewVoucher(voucher)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditVoucher(voucher)}
                          className="text-green-600 hover:text-green-900"
                          title="Edit voucher"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadVoucherData(voucher)}
                          className="text-purple-600 hover:text-purple-900"
                          title="Download data"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => copyToClipboard(voucher.voucher_code)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Copy code"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteVoucher(voucher.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete voucher"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              </tbody>
            </table>
          </div>

        {vouchers.length === 0 && (
          <div className="text-center py-12">
            <Gift className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No vouchers found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new voucher.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Voucher
              </button>
            </div>
          </div>
        )}
      </div>

        {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Previous
              </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Next
              </button>
          </nav>
        </div>
      )}

      {/* Create Voucher Modal */}
      {showCreateModal && (
        <VoucherForm
          onSave={() => {
            setShowCreateModal(false);
            resetFormData();
            fetchVouchers();
            fetchStats();
          }}
          onCancel={() => {
            setShowCreateModal(false);
            resetFormData();
          }}
          title="Create New Voucher"
        />
      )}

      {/* Edit Voucher Modal */}
      {showEditModal && selectedVoucher && (
        <VoucherForm
          voucher={selectedVoucher}
          onSave={() => {
            setShowEditModal(false);
            setSelectedVoucher(null);
            resetFormData();
            fetchVouchers();
            fetchStats();
          }}
          onCancel={() => {
            setShowEditModal(false);
            setSelectedVoucher(null);
            resetFormData();
          }}
          title="Edit Voucher"
        />
      )}

      {/* View Voucher Modal */}
      {showViewModal && selectedVoucher && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Voucher Details</h2>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedVoucher(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Basic Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Voucher Code</label>
                    <p className="font-mono text-lg font-bold">{selectedVoucher.voucher_code}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Type</label>
                    <p className="capitalize">{selectedVoucher.voucher_type}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Value</label>
                    <p className="font-medium">{formatVoucherValue(selectedVoucher)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <div className="flex items-center gap-2">
                      {React.createElement(getStatusIcon(selectedVoucher.voucher_status), {
                        className: `w-4 h-4 text-${getStatusColor(selectedVoucher.voucher_status)}-600`
                      })}
                      <span className={`capitalize text-${getStatusColor(selectedVoucher.voucher_status)}-600`}>
                        {selectedVoucher.voucher_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Usage & Dates</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">Usage</label>
                    <p>{selectedVoucher.usage_count} / {selectedVoucher.max_usage}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Expiry Date</label>
                    <p>{formatDate(selectedVoucher.expiry_date)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Created</label>
                    <p>{formatDate(selectedVoucher.created_at)}</p>
                  </div>
                  {selectedVoucher.used_by && (
                    <div>
                      <label className="text-xs text-gray-500">Used By</label>
                      <p>{selectedVoucher.used_by}</p>
                    </div>
                  )}
                  {selectedVoucher.used_at && (
                    <div>
                      <label className="text-xs text-gray-500">Used At</label>
                      <p>{formatDate(selectedVoucher.used_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setShowEditModal(true);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Edit Voucher
              </button>
              <button
                onClick={() => downloadVoucherData(selectedVoucher)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Download Data
              </button>
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedVoucher(null);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generate Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">Bulk Generate Vouchers</h2>
            <form onSubmit={handleBulkGenerate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Vouchers
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={bulkFormData.count}
                    onChange={(e) => setBulkFormData(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Voucher Type
                  </label>
                  <select
                    value={bulkFormData.voucher_type}
                    onChange={(e) => setBulkFormData(prev => ({ ...prev, voucher_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={bulkFormData.voucher_value}
                    onChange={(e) => setBulkFormData(prev => ({ ...prev, voucher_value: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={bulkFormData.voucher_type === 'percentage' ? '10' : '50.00'}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="datetime-local"
                    value={bulkFormData.expiry_date}
                    onChange={(e) => setBulkFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Usage per Voucher
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bulkFormData.max_usage}
                    onChange={(e) => setBulkFormData(prev => ({ ...prev, max_usage: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
            </div>
          </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Generate Vouchers
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
      </div>
        </div>
      )}
    </div>
  );
}
