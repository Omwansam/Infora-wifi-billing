import { apiCall } from '../utils/api';
import { getAuthToken } from '../lib/authUtils';

const voucherService = {
  // Get all vouchers with pagination and filtering
  async getVouchers(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.append('page', params.page);
      if (params.per_page) queryParams.append('per_page', params.per_page);
      if (params.status) queryParams.append('status', params.status);
      if (params.voucher_type) queryParams.append('voucher_type', params.voucher_type);
      if (params.search) queryParams.append('search', params.search);
      
      const url = `http://localhost:5000/api/vouchers/?${queryParams.toString()}`;
      const token = getAuthToken();
      const response = await apiCall(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      throw error;
    }
  },

  // Get specific voucher by ID
  async getVoucher(voucherId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`http://localhost:5000/api/vouchers/${voucherId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching voucher:', error);
      throw error;
    }
  },

  // Create new voucher
  async createVoucher(voucherData) {
    try {
      const token = getAuthToken();
      const response = await apiCall('http://localhost:5000/api/vouchers/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(voucherData)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error creating voucher:', error);
      throw error;
    }
  },

  // Update voucher
  async updateVoucher(voucherId, voucherData) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`http://localhost:5000/api/vouchers/${voucherId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(voucherData)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error updating voucher:', error);
      throw error;
    }
  },

  // Delete voucher
  async deleteVoucher(voucherId) {
    try {
      const token = getAuthToken();
      const response = await apiCall(`http://localhost:5000/api/vouchers/${voucherId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error deleting voucher:', error);
      throw error;
    }
  },

  // Validate voucher code (public endpoint)
  async validateVoucher(voucherCode) {
    try {
      const response = await apiCall('http://localhost:5000/api/vouchers/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          voucher_code: voucherCode
        })
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error validating voucher:', error);
      throw error;
    }
  },

  // Use voucher
  async useVoucher(voucherId, customerEmail = null) {
    try {
      const data = {};
      if (customerEmail) {
        data.customer_email = customerEmail;
      }
      
      const token = getAuthToken();
      const response = await apiCall(`http://localhost:5000/api/vouchers/${voucherId}/use`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error using voucher:', error);
      throw error;
    }
  },

  // Get voucher statistics
  async getVoucherStats() {
    try {
      const token = getAuthToken();
      const response = await apiCall('http://localhost:5000/api/vouchers/stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error fetching voucher stats:', error);
      throw error;
    }
  },

  // Bulk generate vouchers
  async bulkGenerateVouchers(generationData) {
    try {
      const token = getAuthToken();
      const response = await apiCall('http://localhost:5000/api/vouchers/bulk-generate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(generationData)
      });
      
      if (!response.success) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (error) {
      console.error('Error bulk generating vouchers:', error);
      throw error;
    }
  },

  // Generate voucher code (client-side helper)
  generateVoucherCode(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  },

  // Format voucher value for display
  formatVoucherValue(voucher) {
    if (voucher.voucher_type === 'percentage') {
      return `${voucher.voucher_value}%`;
    } else {
      return `$${voucher.voucher_value.toFixed(2)}`;
    }
  },

  // Get voucher status color
  getVoucherStatusColor(status) {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'gray';
      case 'expired':
        return 'red';
      case 'used':
        return 'blue';
      default:
        return 'gray';
    }
  },

  // Get voucher status icon
  getVoucherStatusIcon(status) {
    switch (status) {
      case 'active':
        return 'CheckCircle';
      case 'inactive':
        return 'XCircle';
      case 'expired':
        return 'Clock';
      case 'used':
        return 'Gift';
      default:
        return 'Circle';
    }
  },

  // Check if voucher is expired
  isVoucherExpired(voucher) {
    if (!voucher.expiry_date) return false;
    return new Date(voucher.expiry_date) <= new Date();
  },

  // Check if voucher can be used
  canUseVoucher(voucher) {
    return (
      voucher.is_active &&
      voucher.voucher_status === 'active' &&
      !this.isVoucherExpired(voucher) &&
      voucher.usage_count < voucher.max_usage
    );
  },

  // Calculate discount amount
  calculateDiscount(voucher, originalAmount) {
    if (!this.canUseVoucher(voucher)) {
      return 0;
    }

    if (voucher.voucher_type === 'percentage') {
      return (originalAmount * voucher.voucher_value) / 100;
    } else {
      return Math.min(voucher.voucher_value, originalAmount);
    }
  }
};

export default voucherService;
