#!/usr/bin/env bash
# Deploy Infora billing to Contabo VPS with Docker + Nginx + Cloudflare domain.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy and edit:"
  echo "  cp config/deployment/production.env.example .env"
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

for var in PUBLIC_SERVER_HOST SECRET_KEY JWT_SECRET_KEY POSTGRES_PASSWORD; do
  if [[ -z "${!var:-}" ]] || [[ "${!var}" == CHANGE_ME* ]] || [[ "${!var}" == YOUR_* ]]; then
    echo "Set ${var} in .env before deploying."
    exit 1
  fi
done

echo "==> Building production images (domain: ${APP_DOMAIN:-ruirufactorymabati.com})"
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

echo "==> Starting stack"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo "==> Waiting for Flask (migrations)..."
sleep 15

echo "==> Syncing FreeRADIUS clients.conf from database"
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T flask_app flask generate-radius-clients || true

echo "==> Restarting FreeRADIUS to pick up clients.conf"
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart freeradius wireguard

echo ""
echo "Deployment complete."
echo "  Admin UI:  https://${APP_DOMAIN:-ruirufactorymabati.com}"
echo "  Portal:    https://${APP_DOMAIN:-ruirufactorymabati.com}/portal"
echo "  Website:   https://lumen.${APP_DOMAIN:-ruirufactorymabati.com}"
echo "  Demo:      https://demo.${APP_DOMAIN:-ruirufactorymabati.com}"
echo "  Health:    https://${APP_DOMAIN:-ruirufactorymabati.com}/api/health/deployment"
echo ""
echo "MikroTik (DNS only — not Cloudflare proxy):"
echo "  RADIUS server: ${PUBLIC_SERVER_HOST} UDP 1812/1813"
echo "  WireGuard mgmt: ${WIREGUARD_MGMT_ENDPOINT:-$PUBLIC_SERVER_HOST} UDP ${WIREGUARD_MGMT_PORT:-51821}"
echo ""
echo "Next: configure Cloudflare DNS — see config/deployment/CLOUDFLARE.md"
