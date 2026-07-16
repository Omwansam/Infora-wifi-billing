import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { clearStoredAuth } from './authToken';

/**
 * Generic API call function with error handling
 */
export const apiCall = async (endpoint, options = {}) => {
  let status = 0;
  try {
    console.log('Making API call to:', endpoint);
    console.log('Options:', options);
    
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    status = response.status;

    const contentType = response.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      if (!response.ok) {
        const hint = response.status === 404
          ? ' API endpoint not found — restart the backend server after pulling latest code.'
          : '';
        throw new Error(`Server returned ${response.status}.${hint}`);
      }
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('Server returned an unexpected response format.');
      }
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || `HTTP error! status: ${response.status}`);
    }

    return { success: true, status, data };
  } catch (error) {
    console.error('API call failed:', error);

    // Provide more specific error messages
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      return {
        success: false,
        status,
        error: 'Cannot connect to server. Please ensure the backend is running on http://localhost:5000'
      };
    }

    return {
      success: false,
      status,
      error: error.message || 'Network error. Please check your connection.'
    };
  }
};

/**
 * The server rejected our token (401 unauthorized, or 422 from older backends
 * that return it for undecodable legacy tokens). Clear the dead credentials
 * and send the user back to login instead of retrying forever.
 */
const handleAuthRejection = (status) => {
  if (status !== 401 && status !== 422) return;
  clearStoredAuth();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login');
  }
};

/**
 * Authenticated API call function
 */
export const authenticatedApiCall = async (endpoint, token, options = {}) => {
  console.log('Making authenticated API call to:', endpoint);
  console.log('Token:', token ? 'Present' : 'Missing');
  console.log('Options:', options);
  
  const headers = {
    ...getAuthHeaders(token),
    ...options.headers,
  };
  console.log('Request headers:', headers);

  const result = await apiCall(endpoint, {
    ...options,
    headers,
  });
  if (!result.success) {
    handleAuthRejection(result.status);
  }
  return result;
};

/**
 * Authenticated API call function that returns text instead of JSON
 */
export const authenticatedApiCallText = async (endpoint, token, options = {}) => {
  console.log('Making authenticated API call (text) to:', endpoint);
  console.log('Token:', token ? 'Present' : 'Missing');
  
  const headers = {
    ...getAuthHeaders(token),
    ...options.headers,
  };
  
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const text = await response.text();

    if (!response.ok) {
      handleAuthRejection(response.status);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return { success: true, data: text };
  } catch (error) {
    console.error('API call failed:', error);
    return { 
      success: false, 
      error: error.message || 'Network error. Please check your connection.' 
    };
  }
};

/**
 * Test API connection
 */
export const testApiConnection = async () => {
  console.log('Testing API connection...');
  const result = await apiCall(API_ENDPOINTS.TEST);
  console.log('API connection test result:', result);
  return result;
};

/**
 * Check if backend is reachable
 */
export const checkBackendStatus = async () => {
  try {
    const response = await fetch(API_ENDPOINTS.TEST, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Backend status check failed:', error);
    return false;
  }
};
