import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  RefreshCw,
  ShieldCheck,
  FileText,
  Clock,
  ShieldAlert,
  Upload,
  X,
  ExternalLink,
  CheckCircle,
  XCircle,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '../../lib/utils';
import { customerInitials } from '../../lib/billingFormatters';
import {
  deleteKycDocument,
  formatDocumentType,
  getKycRecords,
  getKycStats,
  KYC_DOCUMENT_TYPES,
  updateKycStatus,
  uploadKycDocument,
  verifyKycDocument,
} from '../../services/kycService';
import KycStatusBadge from './KycStatusBadge';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

function formatFileSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CustomerKycPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [uploadType, setUploadType] = useState('national_id');
  const [uploadFile, setUploadFile] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [recordsRes, statsRes] = await Promise.all([
        getKycRecords({
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          per_page: 50,
        }),
        getKycStats(),
      ]);
      if (recordsRes.success) setRecords(recordsRes.data.records || []);
      if (statsRes.success) setStats(statsRes.data || {});
    } catch {
      toast.error('Failed to load KYC records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(loadData, searchTerm ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadData, searchTerm]);

  useEffect(() => {
    setReviewNotes(selected?.kyc_notes || '');
  }, [selected]);

  const statsCards = useMemo(
    () => [
      { title: 'Pending', value: stats.pending ?? 0, icon: Clock, accent: 'from-amber-500 to-orange-600' },
      { title: 'Under Review', value: stats.under_review ?? 0, icon: FileText, accent: 'from-blue-500 to-indigo-600' },
      { title: 'Verified', value: stats.verified ?? 0, icon: ShieldCheck, accent: 'from-emerald-500 to-teal-600' },
      { title: 'Rejected', value: stats.rejected ?? 0, icon: ShieldAlert, accent: 'from-rose-500 to-red-600' },
    ],
    [stats]
  );

  const handleSelectRecord = (record) => {
    setSelected(record);
    setUploadFile(null);
  };

  const refreshSelected = async (record) => {
    setSelected(record);
    await loadData();
  };

  const handleStatusUpdate = async (kycStatus) => {
    if (!selected) return;
    try {
      setActionLoading(true);
      const response = await updateKycStatus(selected.id, {
        kyc_status: kycStatus,
        kyc_notes: reviewNotes,
      });
      if (response.success) {
        toast.success(`KYC marked as ${kycStatus.replace('_', ' ')}`);
        await refreshSelected(response.data.record);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update KYC status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDocumentVerify = async (documentId, verificationStatus) => {
    if (!selected) return;
    try {
      setActionLoading(true);
      const response = await verifyKycDocument(documentId, { verification_status: verificationStatus });
      if (response.success) {
        toast.success(`Document ${verificationStatus}`);
        await refreshSelected(response.data.record);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to verify document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!selected) return;
    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append('document_type', uploadType);
      if (uploadFile) formData.append('file', uploadFile);
      else formData.append('original_file_name', `${uploadType}.pdf`);
      const response = await uploadKycDocument(selected.id, formData);
      if (response.success) {
        toast.success('Document uploaded');
        setUploadFile(null);
        await refreshSelected(response.data.record);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId) => {
    if (!selected || !window.confirm('Delete this document?')) return;
    try {
      setActionLoading(true);
      const response = await deleteKycDocument(documentId);
      if (response.success) {
        toast.success('Document deleted');
        await refreshSelected(response.data.record);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete document');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Link to="/customers" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-4">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Customers
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-600 uppercase tracking-wider">Customers</p>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">KYC Verification</h1>
              <p className="text-slate-600 mt-1">Review identity documents and approve customer onboarding</p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium bg-white hover:bg-slate-50 disabled:opacity-50 self-start"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
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
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
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
                placeholder="Search by name, email, phone, or ID number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium ${
                    statusFilter === tab.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-600 border-t-transparent mx-auto" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center">
              <ShieldCheck className="h-12 w-12 text-slate-300 mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-slate-900">No KYC records found</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ID Number</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">KYC Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Documents</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Verified</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center text-sm font-semibold">
                            {customerInitials(record.name)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{record.name}</p>
                            <p className="text-sm text-slate-500">{record.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{record.id_number || '—'}</td>
                      <td className="px-6 py-4">
                        <KycStatusBadge status={record.kyc_status} />
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {record.approved_documents || 0}/{record.documents_count || 0} approved
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {record.kyc_verified_at ? formatDate(record.kyc_verified_at) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleSelectRecord(record)}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50"
              onClick={() => !actionLoading && setSelected(null)}
            >
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto"
              >
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{selected.name}</h2>
                    <p className="text-sm text-slate-500">KYC review</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-slate-100">
                    <X className="h-5 w-5 text-slate-500" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <KycStatusBadge status={selected.kyc_status} size="lg" />
                      <button
                        onClick={() => navigate(`/customers/${selected.id}`)}
                        className="inline-flex items-center text-sm text-teal-700 hover:text-teal-800"
                      >
                        View customer
                        <ExternalLink className="h-3.5 w-3.5 ml-1" />
                      </button>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-slate-500">Email</dt>
                        <dd className="font-medium text-slate-900">{selected.email}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Phone</dt>
                        <dd className="font-medium text-slate-900">{selected.phone}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">ID Number</dt>
                        <dd className="font-medium text-slate-900">{selected.id_number || 'Not provided'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Verified</dt>
                        <dd className="font-medium text-slate-900">
                          {selected.kyc_verified_at ? formatDate(selected.kyc_verified_at) : 'Not yet'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-3">Submitted Documents</h3>
                    <div className="space-y-3">
                      {(selected.documents || []).length === 0 ? (
                        <p className="text-sm text-slate-500 py-6 text-center bg-slate-50 rounded-xl">No documents uploaded yet.</p>
                      ) : (
                        selected.documents.map((doc) => (
                          <div key={doc.id} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-slate-900">{formatDocumentType(doc.document_type)}</p>
                                <p className="text-sm text-slate-500 mt-0.5">{doc.original_file_name}</p>
                                <p className="text-xs text-slate-400 mt-1">
                                  {formatFileSize(doc.file_size)} · {doc.upload_date ? formatDate(doc.upload_date) : '—'}
                                </p>
                              </div>
                              <KycStatusBadge status={doc.verification_status === 'approved' ? 'verified' : doc.verification_status === 'rejected' ? 'rejected' : 'pending'} />
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                              {doc.verification_status !== 'approved' && (
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleDocumentVerify(doc.id, 'approved')}
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                  Approve
                                </button>
                              )}
                              {doc.verification_status !== 'rejected' && (
                                <button
                                  disabled={actionLoading}
                                  onClick={() => handleDocumentVerify(doc.id, 'rejected')}
                                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50"
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Reject
                                </button>
                              )}
                              <button
                                disabled={actionLoading}
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <form onSubmit={handleUploadDocument} className="rounded-2xl border border-dashed border-slate-300 p-4 bg-slate-50/50">
                    <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Document
                    </h3>
                    <div className="space-y-3">
                      <select
                        value={uploadType}
                        onChange={(e) => setUploadType(e.target.value)}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white"
                      >
                        {KYC_DOCUMENT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                      <input
                        type="file"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="w-full text-sm text-slate-600"
                      />
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="w-full py-2.5 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
                      >
                        Upload
                      </button>
                    </div>
                  </form>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Review notes</label>
                    <textarea
                      rows={3}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl"
                      placeholder="Notes for the customer or internal team..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleStatusUpdate('under_review')}
                      className="py-2.5 rounded-xl text-sm font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                    >
                      Mark Review
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleStatusUpdate('verified')}
                      className="py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Verify KYC
                    </button>
                    <button
                      disabled={actionLoading}
                      onClick={() => handleStatusUpdate('rejected')}
                      className="py-2.5 rounded-xl text-sm font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    >
                      Reject KYC
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
