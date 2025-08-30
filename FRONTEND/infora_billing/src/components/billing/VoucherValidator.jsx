import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, CheckCircle, XCircle, Loader } from 'lucide-react';
import voucherService from '../../services/voucherService';
import toast from 'react-hot-toast';

export default function VoucherValidator({ 
  onVoucherApplied, 
  onVoucherRemoved, 
  appliedVoucher = null,
  originalAmount = 0,
  disabled = false 
}) {
  const [voucherCode, setVoucherCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const handleValidateVoucher = async (e) => {
    e.preventDefault();
    
    if (!voucherCode.trim()) {
      toast.error('Please enter a voucher code');
      return;
    }

    setValidating(true);
    setValidationResult(null);

    try {
      const result = await voucherService.validateVoucher(voucherCode.trim());
      
      if (result.valid) {
        setValidationResult({
          valid: true,
          voucher: result.voucher,
          discount: voucherService.calculateDiscount(result.voucher, originalAmount)
        });
        toast.success('Voucher applied successfully!');
      } else {
        setValidationResult({
          valid: false,
          message: result.message
        });
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error validating voucher:', error);
      setValidationResult({
        valid: false,
        message: 'Failed to validate voucher'
      });
      toast.error('Failed to validate voucher');
    } finally {
      setValidating(false);
    }
  };

  const handleApplyVoucher = () => {
    if (validationResult?.valid && onVoucherApplied) {
      onVoucherApplied(validationResult.voucher, validationResult.discount);
      setVoucherCode('');
      setValidationResult(null);
    }
  };

  const handleRemoveVoucher = () => {
    if (onVoucherRemoved) {
      onVoucherRemoved();
    }
  };

  const formatDiscount = (discount) => {
    return `$${discount.toFixed(2)}`;
  };

  const formatVoucherValue = (voucher) => {
    return voucherService.formatVoucherValue(voucher);
  };

  if (appliedVoucher) {
    const discount = voucherService.calculateDiscount(appliedVoucher, originalAmount);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-green-50 border border-green-200 rounded-lg p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Voucher Applied: {appliedVoucher.voucher_code}
              </p>
              <p className="text-xs text-green-600">
                {formatVoucherValue(appliedVoucher)} discount
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-green-800">
              -{formatDiscount(discount)}
            </p>
            <button
              onClick={handleRemoveVoucher}
              className="text-xs text-green-600 hover:text-green-800 underline"
            >
              Remove
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleValidateVoucher} className="flex gap-2">
        <div className="flex-1 relative">
          <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={voucherCode}
            onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
            placeholder="Enter voucher code"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={disabled || validating}
          />
        </div>
        <button
          type="submit"
          disabled={disabled || validating || !voucherCode.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {validating ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Validating...
            </>
          ) : (
            'Apply'
          )}
        </button>
      </form>

      {validationResult && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={`rounded-lg p-3 ${
            validationResult.valid 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {validationResult.valid ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">
                    Valid voucher: {validationResult.voucher.voucher_code}
                  </p>
                  <p className="text-xs text-green-600">
                    {formatVoucherValue(validationResult.voucher)} discount
                    {originalAmount > 0 && (
                      <span> • Save {formatDiscount(validationResult.discount)}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={handleApplyVoucher}
                  className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                >
                  Apply
                </button>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-800">{validationResult.message}</p>
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
