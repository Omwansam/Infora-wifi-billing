// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REGISTER: `${API_BASE_URL}/api/auth/register`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  REFRESH: `${API_BASE_URL}/api/auth/refresh`,
  VERIFY: `${API_BASE_URL}/api/auth/verify`,
  PROFILE: `${API_BASE_URL}/api/auth/profile`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/auth/change-password`,
  USERS: `${API_BASE_URL}/api/auth/users`,
  
  // Customer endpoints
  CUSTOMERS: `${API_BASE_URL}/api/customers`,
  
  // Invoice endpoints
  INVOICES: `${API_BASE_URL}/api/invoices`,
  
  // Plans endpoints
  PLANS: `${API_BASE_URL}/api/plans`,
  
  // Test endpoint
  TEST: `${API_BASE_URL}/api/test`,
};

export const getAuthHeaders = (token) => ({
  'Content-Type': 'application/json',
  'Authorization': token ? `Bearer ${token}` : '',
});

export default API_BASE_URL;
