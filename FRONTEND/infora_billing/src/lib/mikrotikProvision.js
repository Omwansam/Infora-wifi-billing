/**
 * MikroTik RouterOS RADIUS provisioning snippets (matches config/mikrotik/radius-provision.rsc)
 */

export function getRadiusServerHost() {
  return (
    import.meta.env.VITE_RADIUS_SERVER
    || import.meta.env.VITE_FREERADIUS_HOST
    || 'YOUR_FREERADIUS_SERVER_IP'
  );
}

export function buildRadiusProvisionCommands({
  radiusServer,
  radiusSecret = 'YOUR_ISP_RADIUS_SECRET',
  pppoe = true,
  hotspot = true,
}) {
  const server = radiusServer || getRadiusServerHost();
  const lines = [
    '# Infora billing — paste in MikroTik terminal or import downloaded .rsc',
    `/radius add address=${server} secret=${radiusSecret} service=ppp,hotspot,dhcp timeout=3000 comment="infora-billing"`,
    '/radius incoming set accept=yes',
  ];

  if (pppoe) {
    lines.push('/ppp aaa set use-radius=yes accounting=yes interim-update=5m');
  }
  if (hotspot) {
    lines.push(
      '/ip hotspot profile set [find default=yes] use-radius=yes radius-accounting=yes radius-interim-update=5m',
    );
  }

  lines.push(':log info "Infora RADIUS provisioning applied"');
  return lines.join('\n');
}

export const MIKROTIK_API_COMMANDS = `/ip service enable api
/ip service set api port=8728 disabled=no`;
