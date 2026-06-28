#!/usr/bin/env bash
# Run on the deployment server after docker compose up.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Flask deployment verify"
docker compose exec -T flask_app flask verify-deployment 2>/dev/null || \
  (cd backend/server && pipenv run flask verify-deployment)

echo ""
echo "==> Regenerating FreeRADIUS clients.conf from MikroTik devices"
docker compose exec -T flask_app flask generate-radius-clients 2>/dev/null || \
  (cd backend/server && pipenv run flask generate-radius-clients)

echo ""
echo "==> HTTP deployment health"
curl -sf "http://127.0.0.1:5000/api/health/deployment" | python3 -m json.tool || \
  echo "Start the API first, then open GET /api/health/deployment"

echo ""
echo "Done. Restart FreeRADIUS after client changes:"
echo "  docker compose restart freeradius"
