#!/bin/sh
set -e
export PYTHONPATH=/app/server:/app

# Background loop: keep the route to 10.250.0.0/24 via the WireGuard container.
# The WG container starts *after* Flask, so the first attempt usually fails.
# This loop retries every 15s until the route is up, then checks every 60s.
(
  while true; do
    WG_IP=$(getent hosts infora_wireguard 2>/dev/null | awk '{print $1; exit}')
    if [ -n "$WG_IP" ]; then
      CURRENT=$(ip route show 10.250.0.0/24 2>/dev/null || true)
      if echo "$CURRENT" | grep -q "$WG_IP"; then
        sleep 60
      else
        ip route replace 10.250.0.0/24 via "$WG_IP" 2>/dev/null && \
          echo "[routing] 10.250.0.0/24 via $WG_IP (infora_wireguard)" || true
        sleep 15
      fi
    else
      sleep 15
    fi
  done
) &

cd /app/server
python -m flask db upgrade
python -m flask initdb
cd /app
exec gunicorn --bind 0.0.0.0:5000 --workers 4 --threads 2 --timeout 120 --chdir /app/server app:app
