import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { invoiceService } from '../../services/invoiceService';
import { customerService } from '../../services/customerService';
import { formatCurrency } from '../../lib/utils';
import InvoiceDocument from './InvoiceDocument';

const emptyItem = { description: '', quantity: 1, unit_price: '', total_price: '' };

function calculateItemTotal(quantity, unitPrice) {
  return ((parseFloat(quantity) || 0) * (parseFloat(unitPrice) || 0)).toFixed(2);
}

function calculateInvoiceTotal(items) {
  return items.reduce((total, item) => total + (parseFloat(item.total_price) || 0), 0);
}

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const isEditing = !!invoiceId;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [invoice, setInvoice] = useState({
    customer_id: '',
    amount: '',
    due_days: 30,
    notes: '',
    items: [{ ...emptyItem }],
  });

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(invoice.customer_id)),
    [customers, invoice.customer_id]
  );

  const previewInvoice = useMemo(() => {
    const issueDate = new Date().toISOString().split('T')[0];
    const due = new Date();
    due.setDate(due.getDate() + (parseInt(invoice.due_days, 10) || 30));
    return {
      id: isEditing ? 'Editing…' : 'Draft',
      status: 'pending',
      customerName: selectedCustomer?.full_name || 'Select customer',
      customerEmail: selectedCustomer?.email,
      customerPhone: selectedCustomer?.phone,
      customerAddress: selectedCustomer?.address,
      issueDate,
      dueDate: due.toISOString().split('T')[0],
      amount: calculateInvoiceTotal(invoice.items) || parseFloat(invoice.amount) || 0,
      notes: invoice.notes,
      items: invoice.items
        .filter((item) => item.description || item.unit_price)
        .map((item) => ({
          description: item.description || 'Line item',
          quantity: parseInt(item.quantity, 10) || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          amount: parseFloat(item.total_price) || 0,
        })),
    };
  }, [invoice, selectedCustomer, isEditing]);

  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const response = await customerService.getCustomers({ per_page: 100 });
        if (response.success) setCustomers(response.data.customers);
      } catch {
        toast.error('Failed to load customers');
      } finally {
        setCustomersLoading(false);
      }
    };
    loadCustomers();
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    const loadInvoice = async () => {
      try {
        setLoading(true);
        const response = await invoiceService.getInvoice(invoiceId);
        if (response.success) {
          const data = response.data;
          setInvoice({
            customer_id: data.customerId,
            amount: data.amount,
            due_days: 30,
            notes: data.notes || '',
            items: data.items?.length
              ? data.items.map((item) => ({
                  description: item.description,
                  quantity: item.quantity ?? 1,
                  unit_price: item.unit_price ?? item.amount,
                  total_price: item.amount,
                }))
              : [{ ...emptyItem }],
          });
        } else {
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
    loadInvoice();
  }, [invoiceId, isEditing, navigate]);

  const handleFieldChange = (field, value) => {
    setInvoice((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...invoice.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      updatedItems[index].total_price = calculateItemTotal(
        updatedItems[index].quantity,
        updatedItems[index].unit_price
      );
    }
    const total = calculateInvoiceTotal(updatedItems);
    setInvoice((prev) => ({
      ...prev,
      items: updatedItems,
      amount: total.toFixed(2),
    }));
  };

  const addItem = () => {
    setInvoice((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
  };

  const removeItem = (index) => {
    if (invoice.items.length <= 1) return;
    const updatedItems = invoice.items.filter((_, i) => i !== index);
    const total = calculateInvoiceTotal(updatedItems);
    setInvoice((prev) => ({ ...prev, items: updatedItems, amount: total.toFixed(2) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!invoice.customer_id) {
      toast.error('Please select a customer');
      return;
    }
    const total = calculateInvoiceTotal(invoice.items);
    if (total <= 0) {
      toast.error('Add at least one line item with a valid amount');
      return;
    }
    if (invoice.items.some((item) => !item.description?.trim() || !item.unit_price)) {
      toast.error('Complete all line item fields');
      return;
    }

    try {
      setSaving(true);
      const invoiceData = {
        customer_id: parseInt(invoice.customer_id, 10),
        amount: total,
        due_days: parseInt(invoice.due_days, 10) || 30,
        notes: invoice.notes,
        items: invoice.items.map((item) => ({
          description: item.description,
          quantity: parseInt(item.quantity, 10) || 1,
          unit_price: parseFloat(item.unit_price),
          total_price: parseFloat(item.total_price),
        })),
      };

      const response = isEditing
        ? await invoiceService.updateInvoice(invoiceId, invoiceData)
        : await invoiceService.createInvoice(invoiceData);

      if (response.success) {
        toast.success(isEditing ? 'Invoice updated' : 'Invoice created');
        navigate('/billing/invoices');
      } else {
        toast.error(response.error || `Failed to ${isEditing ? 'update' : 'create'} invoice`);
      }
    } catch {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} invoice`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button
            onClick={() => navigate('/billing/invoices')}
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to invoices
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {isEditing ? 'Edit invoice' : 'Create invoice'}
          </h1>
          <p className="text-slate-600 mt-1">
            {isEditing ? 'Update invoice details and line items' : 'Build a new invoice with live preview'}
          </p>
        </motion.div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Invoice details
                </h2>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <User className="h-4 w-4 inline mr-1.5 text-slate-400" />
                    Customer
                  </label>
                  <select
                    value={invoice.customer_id}
                    onChange={(e) => handleFieldChange('customer_id', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    required
                    disabled={customersLoading}
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.full_name} — {customer.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Calendar className="h-4 w-4 inline mr-1.5 text-slate-400" />
                    Payment terms (days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={invoice.due_days}
                    onChange={(e) => handleFieldChange('due_days', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-700">Line items</label>
                    <button
                      type="button"
                      onClick={addItem}
                      className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add line
                    </button>
                  </div>

                  <div className="space-y-3">
                    {invoice.items.map((item, index) => (
                      <div key={index} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          placeholder="Description (e.g. Premium 100Mbps — June)"
                          className="w-full px-3 py-2 mb-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Qty</label>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Unit price</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Total</label>
                            <div className="flex items-center gap-1">
                              <div className="flex-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold">
                                {formatCurrency(parseFloat(item.total_price) || 0)}
                              </div>
                              {invoice.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeItem(index)}
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
                  <textarea
                    value={invoice.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    rows={3}
                    placeholder="Payment instructions, thank-you message, etc."
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div>
                    <p className="text-sm text-slate-500">Invoice total</p>
                    <p className="text-2xl font-bold text-indigo-700">
                      {formatCurrency(calculateInvoiceTotal(invoice.items))}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/billing/invoices')}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saving ? 'Saving…' : isEditing ? 'Update invoice' : 'Create invoice'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              className="xl:sticky xl:top-6"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Live preview</p>
              <InvoiceDocument invoice={previewInvoice} compact />
            </motion.div>
          </div>
        </form>
      </div>
    </div>
  );
}
