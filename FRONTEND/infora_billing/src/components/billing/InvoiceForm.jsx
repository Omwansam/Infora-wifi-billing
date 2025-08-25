import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  FileText,
  DollarSign,
  Calendar,
  User
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { invoiceService } from '../../services/invoiceService';
import { customerService } from '../../services/customerService';
import { formatCurrency } from '../../lib/utils';

export default function InvoiceForm() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const isEditing = !!invoiceId;

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [invoice, setInvoice] = useState({
    customer_id: '',
    amount: '',
    due_days: 30,
    notes: '',
    items: [
      {
        description: '',
        quantity: 1,
        unit_price: '',
        total_price: ''
      }
    ]
  });

  // Load customers for dropdown
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setCustomersLoading(true);
        const response = await customerService.getCustomers({ per_page: 100 });
        
        if (response.success) {
          setCustomers(response.data.customers);
        } else {
          toast.error('Failed to load customers');
        }
      } catch (error) {
        toast.error('Failed to load customers');
        console.error('Load customers error:', error);
      } finally {
        setCustomersLoading(false);
      }
    };

    loadCustomers();
  }, []);

  // Load invoice data if editing
  useEffect(() => {
    if (isEditing) {
      const loadInvoice = async () => {
        try {
          setLoading(true);
          const response = await invoiceService.getInvoice(invoiceId);
          
          if (response.success) {
            const invoiceData = response.data;
            setInvoice({
              customer_id: invoiceData.customerId,
              amount: invoiceData.amount,
              due_days: 30,
              notes: invoiceData.notes || '',
              items: invoiceData.items.length > 0 ? invoiceData.items.map(item => ({
                description: item.description,
                quantity: 1,
                unit_price: item.amount,
                total_price: item.amount
              })) : [{
                description: '',
                quantity: 1,
                unit_price: '',
                total_price: ''
              }]
            });
          } else {
            toast.error('Failed to load invoice');
            navigate('/billing/invoices');
          }
        } catch (error) {
          toast.error('Failed to load invoice');
          console.error('Load invoice error:', error);
          navigate('/billing/invoices');
        } finally {
          setLoading(false);
        }
      };

      loadInvoice();
    }
  }, [invoiceId, isEditing, navigate]);

  // Calculate item total
  const calculateItemTotal = (quantity, unitPrice) => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;
    return (qty * price).toFixed(2);
  };

  // Calculate invoice total
  const calculateInvoiceTotal = () => {
    return invoice.items.reduce((total, item) => {
      return total + (parseFloat(item.total_price) || 0);
    }, 0);
  };

  // Handle form field changes
  const handleFieldChange = (field, value) => {
    setInvoice(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle item field changes
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...invoice.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };

    // Calculate total price for the item
    if (field === 'quantity' || field === 'unit_price') {
      updatedItems[index].total_price = calculateItemTotal(
        updatedItems[index].quantity,
        updatedItems[index].unit_price
      );
    }

    setInvoice(prev => ({
      ...prev,
      items: updatedItems
    }));
  };

  // Add new item
  const addItem = () => {
    setInvoice(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: '',
          quantity: 1,
          unit_price: '',
          total_price: ''
        }
      ]
    }));
  };

  // Remove item
  const removeItem = (index) => {
    if (invoice.items.length > 1) {
      setInvoice(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!invoice.customer_id) {
      toast.error('Please select a customer');
      return;
    }

    if (!invoice.amount || parseFloat(invoice.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (invoice.items.some(item => !item.description || !item.unit_price)) {
      toast.error('Please fill in all item details');
      return;
    }

    try {
      setLoading(true);

      const invoiceData = {
        customer_id: parseInt(invoice.customer_id),
        amount: parseFloat(invoice.amount),
        due_days: parseInt(invoice.due_days),
        notes: invoice.notes
      };

      let response;
      if (isEditing) {
        response = await invoiceService.updateInvoice(invoiceId, invoiceData);
      } else {
        response = await invoiceService.createInvoice(invoiceData);
      }

      if (response.success) {
        toast.success(isEditing ? 'Invoice updated successfully' : 'Invoice created successfully');
        navigate('/billing/invoices');
      } else {
        toast.error(response.error || `Failed to ${isEditing ? 'update' : 'create'} invoice`);
      }
    } catch (error) {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} invoice`);
      console.error('Submit error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/billing/invoices')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoices
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {isEditing ? 'Edit Invoice' : 'Create New Invoice'}
                </h1>
                <p className="text-gray-600 mt-2">
                  {isEditing ? 'Update invoice details' : 'Create a new invoice for a customer'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Customer Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-2" />
                Customer
              </label>
              <select
                value={invoice.customer_id}
                onChange={(e) => handleFieldChange('customer_id', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
                disabled={customersLoading}
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name} - {customer.email}
                  </option>
                ))}
              </select>
              {customersLoading && (
                <p className="mt-1 text-sm text-gray-500">Loading customers...</p>
              )}
            </div>

            {/* Invoice Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <DollarSign className="h-4 w-4 inline mr-2" />
                  Total Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={invoice.amount}
                  onChange={(e) => handleFieldChange('amount', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="h-4 w-4 inline mr-2" />
                  Due Days
                </label>
                <input
                  type="number"
                  min="1"
                  value={invoice.due_days}
                  onChange={(e) => handleFieldChange('due_days', e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="h-4 w-4 inline mr-2" />
                  Invoice Total
                </label>
                <div className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-lg font-bold text-gray-900">
                  {formatCurrency(calculateInvoiceTotal())}
                </div>
              </div>
            </div>

            {/* Invoice Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Invoice Items
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </button>
              </div>

              <div className="space-y-4">
                {invoice.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-gray-200 rounded-lg">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Item description"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total
                      </label>
                      <div className="flex items-center space-x-2">
                        <div className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-medium text-gray-900">
                          {formatCurrency(parseFloat(item.total_price) || 0)}
                        </div>
                        {invoice.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-2 text-red-600 hover:text-red-900 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={invoice.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                rows={3}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Additional notes for this invoice..."
              />
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => navigate('/billing/invoices')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : (isEditing ? 'Update Invoice' : 'Create Invoice')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
