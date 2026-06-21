export function unwrapList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.isps)) return response.isps;
  if (Array.isArray(response?.data?.sessions)) return response.data.sessions;
  return [];
}

export function unwrapData(response) {
  return response?.data ?? response ?? {};
}

export function parseApiError(error, fallback = 'Request failed') {
  if (error?.message) return error.message;
  return fallback;
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`;
  return `${value} B`;
}

export function formatDuration(seconds) {
  const total = Number(seconds) || 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
