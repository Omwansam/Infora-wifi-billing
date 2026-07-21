export function mapMikrotikDevice(device) {
  return {
    id: device.id,
    name: device.device_name,
    ip: device.device_ip,
    model: device.device_model,
    status: device.device_status || 'offline',
    clients: device.client_count || 0,
    bandwidth: device.bandwidth_usage || 0,
    location: device.location,
    uptime: device.uptime,
    osVersion: device.os_version,
    firmwareLatest: device.firmware_latest,
    lastBackupAt: device.last_backup_at,
    lastSynced: device.last_synced,
    isActive: device.is_active,
    management_wg_enabled: Boolean(device.management_wg_enabled),
    management_wg_ip: device.management_wg_ip,
    ispName: device.isp_name,
    zoneName: device.zone_name,
    notes: device.notes,
  };
}

export function uptimeLabel(value) {
  if (value === null || value === undefined || value === '') return '—';
  // Uptime is stored as seconds. Format into a compact duration; pass through
  // any legacy non-numeric string ("1w2d3h") unchanged.
  const secs = Number(value);
  if (!Number.isFinite(secs)) return String(value);
  if (secs <= 0) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || (!d && !h)) parts.push(`${m}m`);
  return parts.join(' ');
}

// Live uplink throughput. The backend stores current rx+tx on the WAN port in
// Kbps; render it as exact Mbps (Gbps for very high links).
export function bandwidthLabel(value) {
  const kbps = Number(value);
  if (Number.isNaN(kbps) || kbps <= 0) return '0 Mbps';
  const mbps = kbps / 1000;
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  if (mbps >= 10) return `${mbps.toFixed(1)} Mbps`;
  return `${mbps.toFixed(2)} Mbps`;
}

export function bandwidthTone(value) {
  const mbps = Number(value) / 1000;
  if (Number.isNaN(mbps)) return 'text-slate-600';
  if (mbps > 800) return 'text-rose-600';
  if (mbps > 400) return 'text-amber-600';
  return 'text-emerald-600';
}
