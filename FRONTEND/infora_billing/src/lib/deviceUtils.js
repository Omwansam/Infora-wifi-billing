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
  // RouterOS uptime is a string like "1w2d3h4m5s"; pass through if present.
  if (!value && value !== 0) return '—';
  return String(value);
}

export function bandwidthLabel(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value || '—';
  if (numeric > 1000000) return `${(numeric / 1000000).toFixed(1)} GB`;
  if (numeric > 1000) return `${(numeric / 1000).toFixed(1)} MB`;
  return `${numeric} MB`;
}

export function bandwidthTone(value) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 'text-slate-600';
  if (numeric > 800) return 'text-rose-600';
  if (numeric > 500) return 'text-amber-600';
  return 'text-emerald-600';
}
