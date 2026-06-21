import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Download,
  Send,
  Trash2,
  AlertCircle,
  CreditCard,
  Calendar,
  User,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { invoiceService } from '../../services/invoiceService';
import { formatCurrency, formatDate } from '../../lib/utils';
import InvoiceDocument from './InvoiceDocument';
import InvoiceStatusBadge from './InvoiceStatusBadge';
import MpesaPayModal from './MpesaPayModal';

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [mpesaOpen, setMpesaOpen] = useState(false);

  useEffect(() => {
    const loadInvoice = async () => {
      try {
        setLoading(true);
        const response = await invoiceService.getInvoice(invoiceId);
        if (response.success) setInvoice(response.data);
        else {
          toast.error('Failed to load invoice');
          navigate('/billing/invoices');
        }
      } catch {
        toast.error('Failed to load invoice');
        navigate('/billing/invoices');
      } finally {
        setLoading(false);
      }
    };
    if (invoiceId) loadInvoice();
  }, [invoiceId, navigate]);

  const handleDownloadInvoice = async () => {
    try {
      const response = await invoiceService.generateInvoicePDF(invoiceId);
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

  const handleSendReminder = async () => {
    try {
      setSendingReminder(true);
      const response = await invoiceService.sendInvoiceReminder(invoiceId);
      if (response.success) toast.success('Reminder sent successfully');
      else toast.error(response.error || 'Failed to send reminder');
    } catch {
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      const response = await invoiceService.deleteInvoice(invoiceId);
      if (response.success) {
        toast.success('Invoice deleted');
        navigate('/billing/invoices');
      } else {
        toast.error(response.error || 'Failed to delete invoice');
      }
    } catch {
      toast.error('Failed to delete invoice');
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent mx-auto" />
          <p className="mt-4 text-slate-600">Loading invoice…</p>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const timeline = [
    { label: 'Issued', date: invoice.issueDate, icon: Calendar },
    { label: 'Due', date: invoice.dueDate, icon: CreditCard },
    ...(invoice.paidDate ? [{ label: 'Paid', date: invoice.paidDate, icon: CreditCard, highlight: true }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button
            onClick={() => navigate('/billing/invoices')}
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to invoices
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 font-mono">{invoice.id}</h1>
                <InvoiceStatusBadge status={invoice.status} size="lg" />
              </div>
              <p className="text-slate-600 mt-1">{invoice.customerName}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate(`/billing/invoices/${invoiceId}/edit`)}
                className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </button>
              <button
                onClick={handleDownloadInvoice}
                className="inline-flex items-center px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </button>
              {invoice.status !== 'paid' && (
                <>
                  <button
                    onClick={() => setMpesaOpen(true)}
                    className="inline-flex items-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 shadow-sm shadow-emerald-200"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay with M-Pesa
                  </button>
                  <button
                    onClick={handleSendReminder}
                    disabled={sendingReminder}
                    className="inline-flex items-center px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm font-medium hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {sendingReminder ? 'Sending…' : 'Send reminder'}
                  </button>
                </>
              )}
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="inline-flex items-center px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-sm font-medium text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </button>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="xl:col-span-2"
          >
            <InvoiceDocument invoice={invoice} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Payment summary</p>
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(invoice.amount)}</p>
              <p className="text-sm text-slate-500 mt-1">
                {invoice.status === 'paid' ? 'Paid in full' : 'Amount outstanding'}
              </p>
              {invoice.status !== 'paid' && (
                <button
                  onClick={() => setMpesaOpen(true)}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                >
                  <CreditCard className="h-4 w-4" />
                  Collect via M-Pesa
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Timeline</p>
              <div className="space-y-4">
                {timeline.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${item.highlight ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                        <Icon className={`h-4 w-4 ${item.highlight ? 'text-emerald-600' : 'text-slate-500'}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.label}</p>
                        <p className="text-sm text-slate-500">{item.date ? formatDate(item.date) : 'Not set'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Customer</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  {(invoice.customerName || '?').split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{invoice.customerName}</p>
                  {invoice.customerEmail && <p className="text-sm text-slate-500">{invoice.customerEmail}</p>}
                </div>
              </div>
              {invoice.customerPhone && (
                <p className="text-sm text-slate-600">{invoice.customerPhone}</p>
              )}
              {invoice.customerAddress && (
                <p className="text-sm text-slate-600 mt-1">{invoice.customerAddress}</p>
              )}
              <button
                onClick={() => navigate(`/customers/${invoice.customerId}`)}
                className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                <User className="h-4 w-4 mr-1.5" />
                View customer profile
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-rose-100">
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">Delete invoice</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Delete <strong className="font-mono">{invoice.id}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MpesaPayModal
        open={mpesaOpen}
        onClose={() => setMpesaOpen(false)}
        customerId={invoice.customerId}
        invoiceId={invoice.invoice_id || Number(invoiceId)}
        amount={invoice.amount}
        customerName={invoice.customerName}
        invoiceLabel={invoice.id}
        defaultPhone={invoice.customerPhone}
        onSuccess={async () => {
          const response = await invoiceService.getInvoice(invoiceId);
          if (response.success) setInvoice(response.data);
        }}
      />
    </div>
  );
}
