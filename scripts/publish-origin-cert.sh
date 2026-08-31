#!/usr/bin/env bash
# Publish the Cloudflare Origin certificate to the shared edge proxy.
#
# On this host TLS is terminated by fibi-proxy-1, not by the billing nginx, so
# the pair pasted into certs/nginx/ has to be copied onto the proxy's cert
# volume. That volume is mounted read-only into the proxy, so it is written
# here through a throwaway container instead (no sudo needed).
#
# Re-runnable: run it again whenever the certificate is rotated.
#
#   ./scripts/publish-origin-cert.sh
set -euo pipefail

DOMAIN="${DOMAIN:-ruirufactorymabati.com}"
VOLUME="${VOLUME:-fibi_letsencrypt_certs}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PEM="$ROOT/certs/nginx/origin.pem"
KEY="$ROOT/certs/nginx/origin.key"

for f in "$PEM" "$KEY"; do
  [ -s "$f" ] || { echo "ERROR: $f is empty — paste the certificate first."; exit 1; }
done

echo "==> Validating the certificate"
openssl x509 -in "$PEM" -noout -subject -dates
echo "    SANs:"
openssl x509 -in "$PEM" -noout -text | grep -A1 "Subject Alternative Name" | tail -1 | sed 's/^/    /'

echo "==> Checking the key matches the certificate"
c=$(openssl x509 -in "$PEM" -noout -pubkey | openssl sha256)
k=$(openssl pkey -in "$KEY" -pubout | openssl sha256)
[ "$c" = "$k" ] || { echo "ERROR: key does not match certificate. Re-copy BOTH from the same Cloudflare 'Create Certificate' run."; exit 1; }
echo "    match OK"

echo "==> Publishing to volume $VOLUME as live/$DOMAIN"
docker run --rm -i -v "$VOLUME":/le -v "$ROOT/certs/nginx":/src:ro alpine sh -c "
  mkdir -p /le/live/$DOMAIN
  cp /src/origin.pem /le/live/$DOMAIN/fullchain.pem
  cp /src/origin.key /le/live/$DOMAIN/privkey.pem
  chmod 644 /le/live/$DOMAIN/fullchain.pem
  chmod 600 /le/live/$DOMAIN/privkey.pem
  ls -la /le/live/$DOMAIN/
"
echo
echo "Done. Next: install the HTTPS vhost and reload the proxy —"
echo "  cp $ROOT/config/deployment/fibi-proxy/20-infora-billing-https.conf /srv/dan/deploy/vhosts/"
echo "  docker exec fibi-proxy-1 nginx -t && docker exec fibi-proxy-1 nginx -s reload"
