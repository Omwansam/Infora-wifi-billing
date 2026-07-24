import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { getAccessToken } from '../utils/authToken';

async function request(path = '', options = {}) {
  const token = getAccessToken();
  const response = await fetch(`${API_ENDPOINTS.TICKETS}${path}`, {
    ...options,
    headers: getAuthHeaders(token),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }
  return data;
}

export const ticketService = {
  getTickets: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(query ? `?${query}` : '');
  },
  getTicket: (ticketId) => request(`/${ticketId}`),
  getStats: () => request('/stats'),
  createTicket: (payload) =>
    request('', { method: 'POST', body: JSON.stringify(payload) }),
  addMessage: (ticketId, message, isInternal = false) =>
    request(`/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message, is_internal: isInternal }),
    }),
  updateTicket: (ticketId, patch) =>
    request(`/${ticketId}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTicket: (ticketId) => request(`/${ticketId}`, { method: 'DELETE' }),
};
