import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

/**
 * Generic API call function with error handling
 */
export const apiCall = async (endpoint, options = {}) => {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return { success: true, data };
  } catch (error) {
    console.error('API call failed:', error);
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
  return apiCall(endpoint, {
    ...options,
    headers: {
      ...getAuthHeaders(token),
      ...options.headers,
    },
  });
};

/**
 * Test API connection
 */
export const testApiConnection = async () => {
  return apiCall(API_ENDPOINTS.TEST);
};
