#!/bin/sh
set -e
export PYTHONPATH=/app/server:/app

# Route management WireGuard subnet (10.250.0.0/24) through the wireguard container.
# Resolves infora_wireguard via Docker DNS and adds a host route so Flask can SSH
# to MikroTik routers through the management tunnel.
WG_IP=$(getent hosts infora_wireguard 2>/dev/null | awk '{print $1; exit}')
if [ -n "$WG_IP" ]; then
  ip route replace 10.250.0.0/24 via "$WG_IP" 2>/dev/null || true
  echo "Route 10.250.0.0/24 via $WG_IP (infora_wireguard)"
else
  echo "WARNING: could not resolve infora_wireguard — management tunnel routing unavailable"
fi

cd /app/server
python -m flask db upgrade
python -m flask initdb
cd /app
exec gunicorn --bind 0.0.0.0:5000 --workers 4 --threads 2 --timeout 120 --chdir /app/server app:app
