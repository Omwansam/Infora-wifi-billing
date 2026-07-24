#!/bin/sh
# FreeRADIUS entrypoint. Two background duties, then supervise radiusd:
#
#  1. Maintain the return route to the MikroTik management tunnel subnet
#     (10.250.0.0/24) via the wireguard container. RADIUS requests from NAT'd
#     routers arrive DNAT'd from infora_wireguard with their ORIGINAL source
#     (10.250.0.x) so clients.conf per-device secrets match; replies must route
#     back through the wireguard container.
#
#  2. Auto-reload on clients.conf change. FreeRADIUS does NOT reload clients on
#     SIGHUP, so a newly-added router's packets are dropped as "unknown client"
#     until radiusd restarts. flask writes clients.conf in place (shared bind
#     mount), so we watch its mtime and restart radiusd when it changes — new
#     NAS clients go live within a few seconds, no manual restart needed.
#
# NOTE: no `set -e` — this is a long-running supervisor; each loop guards itself.

CLIENTS_CONF=/etc/freeradius/3.0/clients.conf
RADIUSD_BIN=$1

# --- 1. tunnel return route maintenance ---
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

# --- 2. radiusd supervisor + clients.conf auto-reload ---
RADIUSD_PID=""

start_radiusd() {
  "$@" &
  RADIUSD_PID=$!
  echo "[clients-watch] radiusd started (pid $RADIUSD_PID)"
}

shutdown() {
  [ -n "$RADIUSD_PID" ] && kill "$RADIUSD_PID" 2>/dev/null
  exit 0
}
trap shutdown TERM INT

start_radiusd "$@"
LAST=$(stat -c %Y "$CLIENTS_CONF" 2>/dev/null || echo 0)

while true; do
  sleep 5

  # If radiusd died, propagate its exit so Docker's restart policy recreates it.
  if ! kill -0 "$RADIUSD_PID" 2>/dev/null; then
    wait "$RADIUSD_PID" 2>/dev/null
    RC=$?
    echo "[clients-watch] radiusd exited ($RC); leaving container for Docker to restart"
    exit "$RC"
  fi

  NOW=$(stat -c %Y "$CLIENTS_CONF" 2>/dev/null || echo 0)
  [ "$NOW" = "$LAST" ] && continue

  # Let the writer finish, then re-read the mtime.
  sleep 1
  LAST=$(stat -c %Y "$CLIENTS_CONF" 2>/dev/null || echo 0)
  echo "[clients-watch] clients.conf changed — validating config"

  # Guard: never restart into a broken clients.conf (would crash RADIUS).
  if "$RADIUSD_BIN" -C >/dev/null 2>&1; then
    kill "$RADIUSD_PID" 2>/dev/null
    wait "$RADIUSD_PID" 2>/dev/null
    start_radiusd "$@"
    echo "[clients-watch] reload complete — new NAS clients are now active"
  else
    echo "[clients-watch] ERROR: clients.conf failed config check; keeping current radiusd running"
  fi
done
