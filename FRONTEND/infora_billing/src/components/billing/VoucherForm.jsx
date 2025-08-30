import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, RefreshCw } from 'lucide-react';
import voucherService from '../../services/voucherService';
import toast from 'react-hot-toast';

export default function VoucherForm({ 
  voucher = null, 
  onSave, 
  onCancel, 
  title = "Create Voucher",
  showModal = true 
}) {
  const [formData, setFormData] = useState({
    voucher_code: '',
    voucher_type: 'percentage',
    voucher_value: '',
    expiry_date: '',
    max_usage: 1,
    is_active: true
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (voucher) {
      // Convert voucher data for editing
      setFormData({
        voucher_code: voucher.voucher_code || '',
        voucher_type: voucher.voucher_type || 'percentage',
        voucher_value: voucher.voucher_value?.toString() || '',
        expiry_date: voucher.expiry_date ? new Date(voucher.expiry_date).toISOString().slice(0, 16) : '',
        max_usage: voucher.max_usage || 1,
        is_active: voucher.is_active !== undefined ? voucher.is_active : true
      });
    }
  }, [voucher]);

  const generateVoucherCode = () => {
    const code = voucherService.generateVoucherCode();
    setFormData(prev => ({ ...prev, voucher_code: code }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      if (!formData.voucher_type || !formData.voucher_value || !formData.expiry_date) {
        toast.error('Please fill in all required fields');
        return;
      }

      const voucherData = {
        ...formData,
        voucher_value: parseFloat(formData.voucher_value),
        max_usage: parseInt(formData.max_usage),
        expiry_date: new Date(formData.expiry_date).toISOString()
      };

      if (voucher) {
        // Update existing voucher
        await voucherService.updateVoucher(voucher.id, voucherData);
        toast.success('Voucher updated successfully');
      } else {
        // Create new voucher
        await voucherService.createVoucher(voucherData);
        toast.success('Voucher created successfully');
      }

      onSave();
    } catch (error) {
      console.error('Error saving voucher:', error);
      toast.error(error.message || 'Failed to save voucher');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Voucher Code
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={formData.voucher_code}
            onChange={(e) => handleInputChange('voucher_code', e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Auto-generated if empty"
            disabled={voucher && voucher.voucher_status === 'used'}
          />
          {!voucher && (
            <button
              type="button"
              onClick={generateVoucherCode}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-1"
            >
              <RefreshCw className="w-4 h-4" />
              Generate
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Voucher Type *
        </label>
        <select
          value={formData.voucher_type}
          onChange={(e) => handleInputChange('voucher_type', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={voucher && voucher.voucher_status === 'used'}
        >
          <option value="percentage">Percentage Discount</option>
          <option value="fixed">Fixed Amount Discount</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Value *
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.01"
            min="0"
            max={formData.voucher_type === 'percentage' ? 100 : undefined}
            value={formData.voucher_value}
            onChange={(e) => handleInputChange('voucher_value', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={formData.voucher_type === 'percentage' ? '10' : '50.00'}
            required
            disabled={voucher && voucher.voucher_status === 'used'}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 text-sm">
              {formData.voucher_type === 'percentage' ? '%' : '$'}
            </span>
          </div>
        </div>
        {formData.voucher_type === 'percentage' && (
          <p className="text-xs text-gray-500 mt-1">Maximum 100%</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Expiry Date *
        </label>
        <input
          type="datetime-local"
          value={formData.expiry_date}
          onChange={(e) => handleInputChange('expiry_date', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
          disabled={voucher && voucher.voucher_status === 'used'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Maximum Usage
        </label>
        <input
          type="number"
          min="1"
          value={formData.max_usage}
          onChange={(e) => handleInputChange('max_usage', e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          required
          disabled={voucher && voucher.voucher_status === 'used'}
        />
        <p className="text-xs text-gray-500 mt-1">Number of times this voucher can be used</p>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="is_active"
          checked={formData.is_active}
          onChange={(e) => handleInputChange('is_active', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          disabled={voucher && voucher.voucher_status === 'used'}
        />
        <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
          Active
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : (voucher ? 'Update Voucher' : 'Create Voucher')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );

  if (!showModal) {
    return (
      <div className="bg-white rounded-lg p-6 border">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        {formContent}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {formContent}
      </motion.div>
    </motion.div>
  );
}
