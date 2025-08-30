import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

// Get API base URL from environment or config
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Generic API call function with error handling
 */
export const apiCall = async (endpoint, options = {}) => {
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

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }
      
      return { success: true, data };
    } else {
      // Handle non-JSON responses (like HTML error pages)
      const text = await response.text();
      console.error('Non-JSON response received:', text.substring(0, 200));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}. Server returned: ${text.substring(0, 100)}`);
      }
      
      throw new Error('Server returned non-JSON response. Please check if the backend server is running correctly.');
    }
  } catch (error) {
    console.error('API call failed:', error);
    
    // Provide more specific error messages
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      return { 
        success: false, 
        error: 'Cannot connect to server. Please ensure the backend is running on http://localhost:5000' 
      };
    }
    
    return { 
      success: false, 
      error: error.message || 'Network error. Please check your connection.' 
    };
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
  
  return apiCall(endpoint, {
    ...options,
    headers,
  });
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

// Create a default export for backward compatibility
const api = {
  get: async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    return apiCall(url, { ...options, method: 'GET' });
  },
  post: async (endpoint, data, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    return apiCall(url, { 
      ...options, 
      method: 'POST',
      body: JSON.stringify(data)
    });
  },
  put: async (endpoint, data, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    return apiCall(url, { 
      ...options, 
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },
  delete: async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    return apiCall(url, { ...options, method: 'DELETE' });
  }
};

export default api;
