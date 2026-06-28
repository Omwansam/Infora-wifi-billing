#!/usr/bin/env bash
# Open Contabo VPS firewall for Infora billing (run as root on the VPS once).
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp comment 'SSH'
  ufw allow 80/tcp comment 'HTTP (Cloudflare → Nginx)'
  ufw allow 443/tcp comment 'HTTPS origin (optional)'
  ufw allow 1812/udp comment 'RADIUS auth'
  ufw allow 1813/udp comment 'RADIUS accounting'
  ufw allow 51820/udp comment 'WireGuard customer VPN'
  ufw allow 51821/udp comment 'WireGuard management tunnel (MikroTik)'
  ufw --force enable
  ufw status
else
  echo "ufw not installed. Ensure Contabo firewall / iptables allows:"
  echo "  TCP 22, 80, 443"
  echo "  UDP 1812, 1813, 51820, 51821"
fi

echo ""
echo "Contabo panel: also allow the same ports in the VPS firewall if enabled there."
