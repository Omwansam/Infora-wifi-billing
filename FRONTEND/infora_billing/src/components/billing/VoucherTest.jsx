import React, { useState, useEffect } from 'react';
import voucherService from '../../services/voucherService';
import VoucherValidator from './VoucherValidator';
import toast from 'react-hot-toast';

export default function VoucherTest() {
  const [vouchers, setVouchers] = useState([]);
  const [stats, setStats] = useState({});
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testVoucherSystem();
  }, []);

  const testVoucherSystem = async () => {
    try {
      setLoading(true);
      
      // Test fetching vouchers
      const vouchersResponse = await voucherService.getVouchers({ per_page: 5 });
      setVouchers(vouchersResponse.vouchers || []);
      
      // Test fetching stats
      const statsResponse = await voucherService.getVoucherStats();
      setStats(statsResponse);
      
      toast.success('Voucher system is working!');
    } catch (error) {
      console.error('Voucher system test failed:', error);
      toast.error('Voucher system test failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVoucherApplied = (voucher, discount) => {
    setAppliedVoucher(voucher);
    toast.success(`Voucher applied! Discount: $${discount.toFixed(2)}`);
  };

  const handleVoucherRemoved = () => {
    setAppliedVoucher(null);
    toast.success('Voucher removed');
  };

  if (loading) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Testing Voucher System...</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">Voucher System Test</h2>
        <p className="text-blue-700 text-sm">
          This component tests the voucher system functionality including API calls, validation, and UI components.
        </p>
      </div>

      {/* Stats Display */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-600">Total Vouchers</h3>
          <p className="text-2xl font-bold text-gray-900">{stats.total_vouchers || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-600">Active Vouchers</h3>
          <p className="text-2xl font-bold text-green-600">{stats.active_vouchers || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-600">Used Vouchers</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.used_vouchers || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-sm font-medium text-gray-600">Total Usage</h3>
          <p className="text-2xl font-bold text-purple-600">{stats.total_usage || 0}</p>
        </div>
      </div>

      {/* Voucher Validator Test */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Voucher Validator Test</h3>
        <p className="text-gray-600 mb-4">
          Try entering a voucher code to test the validation system. Use one of the codes below:
        </p>
        
        {vouchers.length > 0 && (
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <p className="text-sm font-medium text-gray-700 mb-2">Available test vouchers:</p>
            <div className="space-y-1">
              {vouchers.slice(0, 3).map(voucher => (
                <div key={voucher.id} className="text-sm">
                  <span className="font-mono bg-white px-2 py-1 rounded border">
                    {voucher.voucher_code}
                  </span>
                  <span className="ml-2 text-gray-600">
                    ({voucherService.formatVoucherValue(voucher)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <VoucherValidator
          onVoucherApplied={handleVoucherApplied}
          onVoucherRemoved={handleVoucherRemoved}
          appliedVoucher={appliedVoucher}
          originalAmount={100.00}
        />
      </div>

      {/* Recent Vouchers */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Recent Vouchers</h3>
        {vouchers.length > 0 ? (
          <div className="space-y-2">
            {vouchers.slice(0, 5).map(voucher => (
              <div key={voucher.id} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-mono font-medium">{voucher.voucher_code}</p>
                  <p className="text-sm text-gray-600">
                    {voucherService.formatVoucherValue(voucher)} • {voucher.voucher_status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    {voucher.usage_count}/{voucher.max_usage} uses
                  </p>
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(voucher.expiry_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No vouchers found</p>
        )}
      </div>

      {/* Test Actions */}
      <div className="bg-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Test Actions</h3>
        <div className="space-y-2">
          <button
            onClick={testVoucherSystem}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Test Data
          </button>
          <button
            onClick={() => {
              setAppliedVoucher(null);
              toast.success('Test reset');
            }}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Reset Test State
          </button>
        </div>
      </div>
    </div>
  );
}
