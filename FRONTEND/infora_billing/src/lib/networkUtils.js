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

/* Stopping at GB made a lifetime total read "3818.42 GB", which is a number the
   reader has to convert in their head. The ladder now runs to PB. */
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

export function formatBytes(bytes, decimals = 2) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${Math.round(value)} B`;
  let index = 0;
  let scaled = value;
  while (scaled >= 1024 && index < BYTE_UNITS.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  return `${scaled.toFixed(decimals)} ${BYTE_UNITS[index]}`;
}

/**
 * Same ladder, one significant decimal and none at all past 100 — for axis
 * ticks and other tight slots, where "953.67 MB" wraps onto two lines and
 * stops being a tick label.
 */
export function formatBytesShort(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${Math.round(value)} B`;
  let index = 0;
  let scaled = value;
  while (scaled >= 1024 && index < BYTE_UNITS.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  return `${scaled >= 100 ? Math.round(scaled) : scaled.toFixed(1)} ${BYTE_UNITS[index]}`;
}

export function formatDuration(seconds) {
  const total = Number(seconds) || 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
