import { API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { getAccessToken } from '../utils/authToken';

/**
 * Fiber plant (outside plant) API.
 *
 * Throws on failure rather than returning {success:false} — a map that
 * silently swallowed a failed save would show the operator a node in a place
 * the server never accepted.
 */
async function request(url, { method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: getAuthHeaders(getAccessToken()),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return data;
}

export const fiberService = {
  /** Everything drawable in one call — nodes, cables, ONTs, customers, bounds. */
  getMap: () => request(API_ENDPOINTS.FIBER_MAP),
  getStats: () => request(API_ENDPOINTS.FIBER_STATS),
  getFaults: (minAffected) => request(
    minAffected ? `${API_ENDPOINTS.FIBER_FAULTS}?min_affected=${minAffected}` : API_ENDPOINTS.FIBER_FAULTS,
  ),

  listNodes: (params = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ).toString();
    return request(query ? `${API_ENDPOINTS.FIBER_NODES}?${query}` : API_ENDPOINTS.FIBER_NODES);
  },
  createNode: (payload) => request(API_ENDPOINTS.FIBER_NODES, { method: 'POST', body: payload }),
  updateNode: (id, payload) => request(API_ENDPOINTS.fiberNode(id), { method: 'PUT', body: payload }),
  deleteNode: (id) => request(API_ENDPOINTS.fiberNode(id), { method: 'DELETE' }),
  traceNode: (id) => request(API_ENDPOINTS.fiberNodeTrace(id)),

  listCables: () => request(API_ENDPOINTS.FIBER_CABLES),
  createCable: (payload) => request(API_ENDPOINTS.FIBER_CABLES, { method: 'POST', body: payload }),
  updateCable: (id, payload) => request(API_ENDPOINTS.fiberCable(id), { method: 'PUT', body: payload }),
  deleteCable: (id) => request(API_ENDPOINTS.fiberCable(id), { method: 'DELETE' }),

  listSplices: (nodeId) => request(API_ENDPOINTS.fiberNodeSplices(nodeId)),
  createSplice: (payload) => request(API_ENDPOINTS.FIBER_SPLICES, { method: 'POST', body: payload }),
  updateSplice: (id, payload) => request(API_ENDPOINTS.fiberSplice(id), { method: 'PUT', body: payload }),
  deleteSplice: (id) => request(API_ENDPOINTS.fiberSplice(id), { method: 'DELETE' }),

  /** Pin a node, ONT or customer. kind: 'node' | 'ont' | 'customer' */
  place: (kind, id, latitude, longitude) => request(API_ENDPOINTS.FIBER_PLACE, {
    method: 'POST', body: { kind, id, latitude, longitude },
  }),

  geocodeBatch: (limit = 25) => request(API_ENDPOINTS.FIBER_GEOCODE, {
    method: 'POST', body: { limit },
  }),

  /** KML/GeoJSON survey upload. Multipart, so it bypasses the JSON helper. */
  async importSurvey(file, { dryRun = false } = {}) {
    const form = new FormData();
    form.append('file', file);
    const url = dryRun ? `${API_ENDPOINTS.FIBER_IMPORT}?dry_run=1` : API_ENDPOINTS.FIBER_IMPORT;
    const headers = getAuthHeaders(getAccessToken());
    // Let the browser set the multipart boundary — a manual Content-Type breaks it.
    delete headers['Content-Type'];
    const response = await fetch(url, { method: 'POST', headers, body: form });
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) throw new Error(data?.error || `Import failed (${response.status})`);
    return data;
  },
};

export default fiberService;
