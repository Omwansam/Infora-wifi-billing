#!/bin/sh
# FreeRADIUS entrypoint — maintain the return route to the MikroTik
# management tunnel subnet (10.250.0.0/24) via the wireguard container.
#
# RADIUS requests from NAT'd routers arrive DNAT'd from infora_wireguard with
# their ORIGINAL source (10.250.0.x) so clients.conf per-device secrets match.
# Replies must therefore route back through the wireguard container, which
# un-DNATs them to 10.250.0.1 and sends them down the tunnel.
set -e

(
  while true; do
    WG_IP=$(getent hosts infora_wireguard 2>/dev/null | awk '{print $1; exit}')
    [ -z "$WG_IP" ] && WG_IP=$(getent hosts wireguard 2>/dev/null | awk '{print $1; exit}')
    if [ -n "$WG_IP" ]; then
      CURRENT=$(ip route show 10.250.0.0/24 2>/dev/null || true)
      if echo "$CURRENT" | grep -q "$WG_IP"; then
        sleep 60
      else
        ip route replace 10.250.0.0/24 via "$WG_IP" 2>/dev/null \
          && echo "[routing] 10.250.0.0/24 via $WG_IP (infora_wireguard)" \
          || echo "[routing] warn: could not install tunnel return route (need NET_ADMIN)"
        sleep 15
      fi
    else
      sleep 15
    fi
  done
) &

exec "$@"
