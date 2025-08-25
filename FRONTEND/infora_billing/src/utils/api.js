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
  return apiCall(API_ENDPOINTS.TEST);
};
