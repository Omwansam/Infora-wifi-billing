import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { authenticatedApiCall } from '../utils/api';

// Helper function to get auth token
const getToken = () => {
  return localStorage.getItem('token');
};

// Get all plans with pagination and filtering
export const getPlans = async (params = {}) => {
  const token = getToken();
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page);
  if (params.per_page) queryParams.append('per_page', params.per_page);
  if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
  if (params.popular !== undefined) queryParams.append('popular', params.popular);
  if (params.search) queryParams.append('search', params.search);
  
  const url = queryParams.toString() 
    ? `${API_ENDPOINTS.PLANS}?${queryParams.toString()}`
    : API_ENDPOINTS.PLANS;
    
  return authenticatedApiCall(url, token, { method: 'GET' });
};

// Get specific plan by ID
export const getPlan = async (planId) => {
  const token = getToken();
  return authenticatedApiCall(`${API_ENDPOINTS.PLANS}/${planId}`, token, { method: 'GET' });
};

// Create new plan
export const createPlan = async (planData) => {
  const token = getToken();
  return authenticatedApiCall(API_ENDPOINTS.PLANS, token, { 
    method: 'POST', 
    body: JSON.stringify(planData) 
  });
};

// Update plan
export const updatePlan = async (planId, planData) => {
  const token = getToken();
  return authenticatedApiCall(`${API_ENDPOINTS.PLANS}/${planId}`, token, { 
    method: 'PUT', 
    body: JSON.stringify(planData) 
  });
};

// Delete plan
export const deletePlan = async (planId) => {
  const token = getToken();
  return authenticatedApiCall(`${API_ENDPOINTS.PLANS}/${planId}`, token, { method: 'DELETE' });
};

// Toggle plan active status
export const togglePlanActive = async (planId) => {
  const token = getToken();
  return authenticatedApiCall(`${API_ENDPOINTS.PLANS}/${planId}/toggle-active`, token, { method: 'PUT' });
};

// Toggle plan popular status
export const togglePlanPopular = async (planId) => {
  const token = getToken();
  return authenticatedApiCall(`${API_ENDPOINTS.PLANS}/${planId}/toggle-popular`, token, { method: 'PUT' });
};

// Get active plans only
export const getActivePlans = async () => {
  const token = getToken();
  return authenticatedApiCall(`${API_ENDPOINTS.PLANS}/active`, token, { method: 'GET' });
};

// Get popular plans only
export const getPopularPlans = async () => {
  const token = getToken();
  return authenticatedApiCall(`${API_ENDPOINTS.PLANS}/popular`, token, { method: 'GET' });
};

// Get plan statistics
export const getPlanStats = async () => {
  const token = getToken();
  return authenticatedApiCall(`${API_ENDPOINTS.PLANS}/stats`, token, { method: 'GET' });
};

// Get customers using a specific plan
export const getPlanCustomers = async (planId, params = {}) => {
  const token = getToken();
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page);
  if (params.per_page) queryParams.append('per_page', params.per_page);
  
  const url = queryParams.toString() 
    ? `${API_ENDPOINTS.PLANS}/${planId}/customers?${queryParams.toString()}`
    : `${API_ENDPOINTS.PLANS}/${planId}/customers`;
    
  return authenticatedApiCall(url, token, { method: 'GET' });
};

// Bulk update plans
export const bulkUpdatePlans = async (planIds, updates) => {
  const token = getToken();
  return authenticatedApiCall(`${API_ENDPOINTS.PLANS}/bulk-update`, token, { 
    method: 'PUT', 
    body: JSON.stringify({
      plan_ids: planIds,
      updates: updates
    })
  });
};
