export function parseSpeedMbps(speed) {
  if (!speed) return null;
  const match = String(speed).match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function clientSpeedLabel(client) {
  const speed = client?.service_plan?.speed || client?.package;
  const mbps = parseSpeedMbps(speed);
  if (mbps) return `${mbps} Mbps`;
  return speed || '—';
}

export function isClientConnected(client) {
  return client?.status === 'active';
}
