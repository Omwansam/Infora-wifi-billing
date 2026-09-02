import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

/**
 * TR-069 customer premises equipment (ONTs, vendor routers).
 *
 * Note every write here returns a *queued task*, not a completed change — a CPE
 * behind CGNAT is only reachable during a session it opens itself. Callers must
 * surface `delivery.note` rather than reporting success.
 */
class CpeService {
  async #request(url, token, { method = 'GET', body } = {}) {
    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(token),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok) {
      throw new Error(data?.error || `HTTP error! status: ${response.status}`);
    }
    return data;
  }

  async listCpe(token, params = {}) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
    ).toString();
    return this.#request(query ? `${API_ENDPOINTS.CPE}?${query}` : API_ENDPOINTS.CPE, token);
  }

  async getStats(token) {
    return this.#request(API_ENDPOINTS.CPE_STATS, token);
  }

  async getCpe(token, id) {
    return this.#request(API_ENDPOINTS.cpeDevice(id), token);
  }

  async updateCpe(token, id, payload) {
    return this.#request(API_ENDPOINTS.cpeDevice(id), token, { method: 'PUT', body: payload });
  }

  async deleteCpe(token, id) {
    return this.#request(API_ENDPOINTS.cpeDevice(id), token, { method: 'DELETE' });
  }

  async approveCpe(token, id) {
    return this.#request(API_ENDPOINTS.cpeApprove(id), token, { method: 'POST' });
  }

  async refreshCpe(token, id) {
    return this.#request(API_ENDPOINTS.cpeRefresh(id), token, { method: 'POST' });
  }

  /** fields uses semantic names (wifi_ssid, wifi_password…), not CWMP paths. */
  async setSettings(token, id, fields) {
    return this.#request(API_ENDPOINTS.cpeSettings(id), token, {
      method: 'POST',
      body: { fields },
    });
  }

  async rebootCpe(token, id) {
    return this.#request(API_ENDPOINTS.cpeReboot(id), token, { method: 'POST' });
  }

  /** Requires the device serial as confirmation — the backend enforces it. */
  async factoryResetCpe(token, id, confirmSerial) {
    return this.#request(API_ENDPOINTS.cpeFactoryReset(id), token, {
      method: 'POST',
      body: { confirm: confirmSerial },
    });
  }

  async listTasks(token, id) {
    return this.#request(API_ENDPOINTS.cpeTasks(id), token);
  }

  async cancelTask(token, taskId) {
    return this.#request(API_ENDPOINTS.cpeCancelTask(taskId), token, { method: 'DELETE' });
  }

  async listSessions(token, id) {
    return this.#request(API_ENDPOINTS.cpeSessions(id), token);
  }

  async enroll(token, payload) {
    return this.#request(API_ENDPOINTS.CPE_ENROLLMENT, token, { method: 'POST', body: payload });
  }

  async listProfiles(token) {
    return this.#request(API_ENDPOINTS.CPE_PROFILES, token);
  }

  /**
   * The time-boxed self-registration window. The counterpart to `enroll` above:
   * that one needs the CPE's serial up front, this one covers an installer who is
   * holding a device and does not have it. Unavailable on a public ACS.
   */
  async getEnrollmentWindow(token) {
    return this.#request(API_ENDPOINTS.CPE_ENROLLMENT_WINDOW, token);
  }

  async openEnrollmentWindow(token, minutes) {
    return this.#request(API_ENDPOINTS.CPE_ENROLLMENT_WINDOW, token, {
      method: 'POST',
      body: { minutes },
    });
  }

  async closeEnrollmentWindow(token) {
    return this.#request(API_ENDPOINTS.CPE_ENROLLMENT_WINDOW, token, { method: 'DELETE' });
  }

  /**
   * Layer-by-layer report on whether CPE can reach the ACS. `probe` adds a live
   * fetch from each router, which is accurate but runs to tens of seconds — only
   * ask for it on an explicit user action, never on page load.
   */
  async diagnoseAcs(token, { probe = false } = {}) {
    const url = probe ? `${API_ENDPOINTS.CPE_DIAGNOSE}?probe=1` : API_ENDPOINTS.CPE_DIAGNOSE;
    return this.#request(url, token);
  }
}

export default new CpeService();
