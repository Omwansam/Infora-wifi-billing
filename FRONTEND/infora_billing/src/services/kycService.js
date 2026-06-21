import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';

export const getKycRecords = async (params = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page);
  if (params.per_page) query.set('per_page', params.per_page);
  if (params.search) query.set('search', params.search);
  if (params.status) query.set('status', params.status);
  const url = query.toString() ? `${API_ENDPOINTS.KYC}?${query}` : API_ENDPOINTS.KYC;
  return authenticatedApiCall(url, getAccessToken(), { method: 'GET' });
};

export const getKycStats = async () => {
  return authenticatedApiCall(API_ENDPOINTS.KYC_STATS, getAccessToken(), { method: 'GET' });
};

export const getKycRecord = async (customerId) => {
  return authenticatedApiCall(`${API_ENDPOINTS.KYC}/${customerId}`, getAccessToken(), { method: 'GET' });
};

export const updateKycStatus = async (customerId, payload) => {
  return authenticatedApiCall(`${API_ENDPOINTS.KYC}/${customerId}/status`, getAccessToken(), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const updateKycRecord = async (customerId, payload) => {
  return authenticatedApiCall(`${API_ENDPOINTS.KYC}/${customerId}`, getAccessToken(), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const uploadKycDocument = async (customerId, formData) => {
  const token = getAccessToken();
  const response = await fetch(`${API_ENDPOINTS.KYC}/${customerId}/documents`, {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: formData,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to upload document');
  }
  return { success: true, data };
};

export const verifyKycDocument = async (documentId, payload) => {
  return authenticatedApiCall(`${API_ENDPOINTS.KYC}/documents/${documentId}/verify`, getAccessToken(), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const deleteKycDocument = async (documentId) => {
  return authenticatedApiCall(`${API_ENDPOINTS.KYC}/documents/${documentId}`, getAccessToken(), {
    method: 'DELETE',
  });
};

export const KYC_DOCUMENT_TYPES = [
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'selfie', label: 'Selfie Verification' },
  { value: 'business_registration', label: 'Business Registration' },
];

export const formatDocumentType = (type) => {
  const match = KYC_DOCUMENT_TYPES.find((item) => item.value === type);
  return match?.label || type?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Document';
};
