import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

export const getFinanceLeads = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  const url = query.toString()
    ? `${API_ENDPOINTS.FINANCE_LEADS}?${query}`
    : API_ENDPOINTS.FINANCE_LEADS;
  return authenticatedApiCall(url, getAccessToken(), { method: 'GET' });
};

export const getFinanceExpenses = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  const url = query.toString()
    ? `${API_ENDPOINTS.FINANCE_EXPENSES}?${query}`
    : API_ENDPOINTS.FINANCE_EXPENSES;
  return authenticatedApiCall(url, getAccessToken(), { method: 'GET' });
};

export const createFinanceExpense = async (payload) => {
  return authenticatedApiCall(API_ENDPOINTS.FINANCE_EXPENSES, getAccessToken(), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getFinanceSummary = async () => {
  return authenticatedApiCall(API_ENDPOINTS.FINANCE_SUMMARY, getAccessToken(), { method: 'GET' });
};

export const formatExpenseCategory = (category) => {
  if (!category) return 'Uncategorized';
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};
