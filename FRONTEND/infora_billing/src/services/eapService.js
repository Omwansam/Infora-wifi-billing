import { API_ENDPOINTS, getAuthHeaders } from '../config/api';

class EAPService {
  constructor() {
    this.baseURL = API_ENDPOINTS.EAP_PROFILES;
  }

  // EAP Profiles
  async getEAPProfiles(token) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching EAP profiles:', error);
      throw error;
    }
  }

  async getEAPProfile(token, profileId) {
    try {
      const response = await fetch(`${this.baseURL}/${profileId}`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching EAP profile:', error);
      throw error;
    }
  }

  async createEAPProfile(token, profileData) {
    try {
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating EAP profile:', error);
      throw error;
    }
  }

  async updateEAPProfile(token, profileId, profileData) {
    try {
      const response = await fetch(`${this.baseURL}/${profileId}`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error updating EAP profile:', error);
      throw error;
    }
  }

  async deleteEAPProfile(token, profileId) {
    try {
      const response = await fetch(`${this.baseURL}/${profileId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting EAP profile:', error);
      throw error;
    }
  }

  // EAP Test
  async testEAPProfile(token, profileId, testData = {}) {
    try {
      const response = await fetch(`${API_ENDPOINTS.EAP_TEST}/${profileId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(testData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error testing EAP profile:', error);
      throw error;
    }
  }

  // EAP Certificate Management
  async uploadEAPCertificate(token, profileId, certificateData) {
    try {
      const response = await fetch(`${this.baseURL}/${profileId}/certificate`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(certificateData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error uploading EAP certificate:', error);
      throw error;
    }
  }

  async getEAPCertificate(token, profileId) {
    try {
      const response = await fetch(`${this.baseURL}/${profileId}/certificate`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching EAP certificate:', error);
      throw error;
    }
  }

  async deleteEAPCertificate(token, profileId) {
    try {
      const response = await fetch(`${this.baseURL}/${profileId}/certificate`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting EAP certificate:', error);
      throw error;
    }
  }

  // EAP Configuration Export/Import
  async exportEAPConfig(token, profileId) {
    try {
      const response = await fetch(`${this.baseURL}/${profileId}/export`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error exporting EAP config:', error);
      throw error;
    }
  }

  async importEAPConfig(token, configData) {
    try {
      const response = await fetch(`${this.baseURL}/import`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(configData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error importing EAP config:', error);
      throw error;
    }
  }

  // EAP Profile Validation
  async validateEAPProfile(token, profileData) {
    try {
      const response = await fetch(`${this.baseURL}/validate`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error validating EAP profile:', error);
      throw error;
    }
  }

  // EAP Profile Templates
  async getEAPTemplates(token) {
    try {
      const response = await fetch(`${this.baseURL}/templates`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching EAP templates:', error);
      throw error;
    }
  }

  async createEAPFromTemplate(token, templateId, profileData) {
    try {
      const response = await fetch(`${this.baseURL}/templates/${templateId}`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error creating EAP from template:', error);
      throw error;
    }
  }

  // EAP Profile Statistics
  async getEAPProfileStats(token, profileId) {
    try {
      const response = await fetch(`${this.baseURL}/${profileId}/stats`, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching EAP profile stats:', error);
      throw error;
    }
  }

  // EAP Profile Logs
  async getEAPProfileLogs(token, profileId, params = {}) {
    try {
      const queryParams = new URLSearchParams(params).toString();
      const url = queryParams 
        ? `${this.baseURL}/${profileId}/logs?${queryParams}` 
        : `${this.baseURL}/${profileId}/logs`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching EAP profile logs:', error);
      throw error;
    }
  }
}

export default new EAPService();
