import { API_ENDPOINTS } from '../config/api';
import { authenticatedApiCall } from '../utils/api';
import { getAccessToken } from '../utils/authToken';
import { toQueryString } from '../lib/queryString';

/**
 * Router-scan import & live-system takeover.
 *
 * Note on error handling: `authenticatedApiCall` never throws — it resolves to
 * `{ success, data | error }`. Every caller here must branch on `success` and
 * surface `error`; wrapping these in try/catch alone silently swallows failures.
 */
export const importService = {
  /** Every run this ISP has ever made, newest first. */
  async listRuns(params = {}) {
    const query = toQueryString(params);
    const url = query ? `${API_ENDPOINTS.IMPORT_RUNS}?${query}` : API_ENDPOINTS.IMPORT_RUNS;
    return authenticatedApiCall(url, getAccessToken());
  },

  /** One run: fingerprint, package drafts, existing packages to map onto. */
  async getRun(runId) {
    return authenticatedApiCall(API_ENDPOINTS.importRun(runId), getAccessToken());
  },

  /**
   * Live SSH scan of a registered device. Read-only on the router: every
   * command is a print/get, enforced by an allowlist server-side.
   */
  async scanRouter(deviceId, options = {}) {
    return authenticatedApiCall(API_ENDPOINTS.IMPORT_ROUTER_SCAN, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, ...options }),
    });
  },

  /** Parse an uploaded `/export` — needs no access to the router at all. */
  async uploadExport(text, deviceId = null) {
    return authenticatedApiCall(API_ENDPOINTS.IMPORT_ROUTER_UPLOAD, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify({ export: text, device_id: deviceId }),
    });
  },

  /** Mint a run + the read-only script the operator pastes into the router. */
  async getAgentScript(deviceId = null) {
    return authenticatedApiCall(API_ENDPOINTS.IMPORT_AGENT_SCRIPT, getAccessToken(), {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
  },

  async getCandidates(runId, params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.kind) query.append('kind', params.kind);
    if (params.q) query.append('q', params.q);
    query.append('page', params.page || 1);
    query.append('per_page', params.perPage || 100);
    const url = `${API_ENDPOINTS.importRunCandidates(runId)}?${query.toString()}`;
    return authenticatedApiCall(url, getAccessToken());
  },

  /** Bulk include/exclude rows, or retarget them at a package. */
  async updateCandidates(runId, payload) {
    return authenticatedApiCall(API_ENDPOINTS.importRunCandidates(runId), getAccessToken(), {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Store pricing + billing-anchor decisions and get back the expiry preview.
   * The preview is what tells the operator whether the anchor would suspend
   * anyone on arrival.
   */
  async planRun(runId, payload) {
    return authenticatedApiCall(API_ENDPOINTS.importRunPlan(runId), getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Create the customers. Returns 409 (success:false) when the guard trips. */
  async commitRun(runId, payload) {
    return authenticatedApiCall(API_ENDPOINTS.importRunCommit(runId), getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async revertRun(runId) {
    return authenticatedApiCall(API_ENDPOINTS.importRunRevert(runId), getAccessToken(), {
      method: 'POST',
    });
  },

  async commentPreview(runId, limit = 20) {
    const url = `${API_ENDPOINTS.importRunCommentPreview(runId)}?limit=${limit}`;
    return authenticatedApiCall(url, getAccessToken());
  },

  /** Batch-move imported subscribers onto Infora by disabling local secrets. */
  async cutoverScript(runId, payload = {}) {
    return authenticatedApiCall(API_ENDPOINTS.importRunCutoverScript(runId), getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async rollbackScript(runId, payload = {}) {
    return authenticatedApiCall(API_ENDPOINTS.importRunRollbackScript(runId), getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Where this migration stands: moved, remaining, verified, per package. */
  async cutoverStatus(runId) {
    return authenticatedApiCall(API_ENDPOINTS.importRunCutover(runId), getAccessToken());
  },

  /** Un-mark a batch that was generated but never pasted. */
  async cutoverReset(runId, payload = {}) {
    return authenticatedApiCall(API_ENDPOINTS.importRunCutoverReset(runId), getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Pre-cutover verification. Resumable by design — the server works to a
   * deadline and reports what is still pending, so the caller loops.
   */
  async verifyRun(runId, payload = {}) {
    return authenticatedApiCall(API_ENDPOINTS.importRunVerify(runId), getAccessToken(), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Post-cutover watch: who was moved and has not come back. */
  async cutoverWatch(runId, { router = true } = {}) {
    const url = `${API_ENDPOINTS.importRunWatch(runId)}?router=${router ? 1 : 0}`;
    return authenticatedApiCall(url, getAccessToken());
  },

  /** The additive-only adoption script, as text (not JSON). */
  adoptionScriptUrl(runId, { interim = '5m', fasttrack = 'remove' } = {}) {
    return `${API_ENDPOINTS.importRunAdoptionScript(runId)}?interim=${interim}&fasttrack=${fasttrack}`;
  },
};

export default importService;
