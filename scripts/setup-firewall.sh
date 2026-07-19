#!/usr/bin/env bash
# Open Contabo VPS firewall for Infora billing (run as root on the VPS once).
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

if command -v ufw >/dev/null 2>&1; then
  # `ufw allow` opens the host INPUT chain only. WireGuard runs inside the
  # linuxserver/wireguard container, so inbound handshakes to 51820/51821 are
  # DNAT'd toward the container and must ALSO be permitted through the FORWARD
  # chain — which ufw defaults to DROP. Without the forward rules below the
  # router's handshakes reach the host but are dropped before the container, so
  # no tunnel ever establishes (Tx grows on the router, Rx stays 0).
  ufw allow 22/tcp comment 'SSH'
  ufw allow 80/tcp comment 'HTTP (Cloudflare → Nginx)'
  ufw allow 443/tcp comment 'HTTPS origin (optional)'
  ufw allow 1812/udp comment 'RADIUS auth'
  ufw allow 1813/udp comment 'RADIUS accounting'
  ufw allow 51820/udp comment 'WireGuard customer VPN'
  ufw allow 51821/udp comment 'WireGuard management tunnel (MikroTik)'

  # Let ufw permit forwarded (DNAT'd) container traffic instead of dropping it.
  if [ -f /etc/default/ufw ]; then
    sed -i 's/^DEFAULT_FORWARD_POLICY=.*/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw
  fi
  ufw --force enable
  ufw reload
  ufw status
else
  echo "ufw not installed. Ensure Contabo firewall / iptables allows:"
  echo "  TCP 22, 80, 443"
  echo "  UDP 1812, 1813, 51820, 51821"
fi

# Explicitly accept forwarding of WireGuard UDP to the container. DOCKER-USER is
# traversed for every forwarded (published-port) packet and is NOT touched by
# ufw reloads, so these rules are the durable fix for the "handshake never
# reaches the container" problem. Guarded with -C so re-running is idempotent.
if command -v iptables >/dev/null 2>&1 && iptables -L DOCKER-USER >/dev/null 2>&1; then
  for port in 51820 51821; do
    if ! iptables -C DOCKER-USER -p udp --dport "$port" -j ACCEPT 2>/dev/null; then
      iptables -I DOCKER-USER -p udp --dport "$port" -j ACCEPT
      echo "DOCKER-USER: accept forwarded udp/$port -> WireGuard container"
    fi
  done
else
  echo "DOCKER-USER chain not found — is Docker running? Skipped forward rules."
fi

echo ""
echo "Contabo panel: also allow the same ports in the VPS firewall if enabled there"
echo "(UDP 1812, 1813, 51820, 51821). If the router's handshakes never reach the"
echo "host NIC at all (verify with: tcpdump -ni any udp port 51821), the drop is"
echo "the cloud firewall, not ufw."
