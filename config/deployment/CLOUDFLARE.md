# Cloudflare DNS for ruirufactorymabati.com

Point the domain to your **Contabo VPS public IPv4**. Use **proxied (orange cloud)** only for HTTP web traffic. RADIUS and WireGuard must use **DNS only (grey cloud)** or the raw IP.

## 1. Add site to Cloudflare

1. Create/login at [Cloudflare](https://dash.cloudflare.com).
2. Add site `ruirufactorymabati.com`.
3. Replace nameservers at your domain registrar with Cloudflare’s NS records.

## 2. DNS records

Replace `YOUR_CONTABO_IP` with the VPS IPv4 from the Contabo panel.

| Type | Name | Content | Proxy status | Purpose |
|------|------|---------|--------------|---------|
| A | `@` | YOUR_CONTABO_IP | **Proxied** | Admin UI + API + captive portal |
| A | `www` | YOUR_CONTABO_IP | **Proxied** | Redirect/www alias |
| A | `lumen` | YOUR_CONTABO_IP | **Proxied** | Lumen marketing website |
| A | `demo` | YOUR_CONTABO_IP | **Proxied** | Interactive demo (browser-simulated API) |
| A | `wg` | YOUR_CONTABO_IP | **DNS only** | WireGuard customer VPN + mgmt endpoint |
| A | `radius` | YOUR_CONTABO_IP | **DNS only** | Optional label for MikroTik docs |

**Important:** MikroTik cannot send RADIUS through Cloudflare’s HTTP proxy. Set `PUBLIC_SERVER_HOST` in `.env` to **YOUR_CONTABO_IP** (or `radius.ruirufactorymabati.com` as DNS-only).

Set in `.env`:

```bash
PUBLIC_SERVER_HOST=YOUR_CONTABO_IP
WIREGUARD_MGMT_ENDPOINT=wg.ruirufactorymabati.com
VITE_API_BASE_URL=https://ruirufactorymabati.com
CORS_ORIGINS=https://ruirufactorymabati.com,https://www.ruirufactorymabati.com
```

## 3. SSL/TLS mode

### Quick start (Flexible)

- Cloudflare → SSL/TLS → **Flexible**
- Visitors get HTTPS; origin serves HTTP on port 80.
- No certificate required on the VPS.

### Recommended (Full strict)

1. Cloudflare → SSL/TLS → Origin Server → **Create certificate** (15-year origin cert). Add `*.ruirufactorymabati.com` and `ruirufactorymabati.com` as hostnames so `lumen.` and `demo.` are covered.
2. Save on the VPS under `/srv/infora-billing/certs/nginx/` as `origin.pem` and `origin.key`.
3. Uncomment the `listen 443 ssl` server blocks in `config/nginx/conf.d/billing.conf`, `lumen.conf` and `demo.conf`.
4. Cloudflare → SSL/TLS → **Full (strict)**.
5. Rebuild web: `docker compose -f docker-compose.yml -f docker-compose.prod.yml build web && docker compose ... up -d web`

## 4. Contabo + VPS firewall

On the VPS:

```bash
sudo ./scripts/setup-firewall.sh
```

Open the same UDP/TCP ports in the **Contabo control panel** firewall if enabled.

| Port | Protocol | Service |
|------|----------|---------|
| 80 | TCP | Nginx (Cloudflare) |
| 443 | TCP | Nginx HTTPS (optional) |
| 1812 | UDP | RADIUS authentication |
| 1813 | UDP | RADIUS accounting |
| 51820 | UDP | Customer WireGuard |
| 51821 | UDP | Management WireGuard (MikroTik tunnel) |

## 5. MikroTik checklist

1. Register router in admin UI → Devices → MikroTik.
2. Download **management tunnel** `.rsc` (if behind NAT) then **RADIUS** `.rsc`.
3. RADIUS server = `PUBLIC_SERVER_HOST` (IP or DNS-only hostname).
4. Import scripts on RouterOS.
5. Create active PPPoE client → test login.
6. Check: `https://ruirufactorymabati.com/api/health/deployment`

## 6. Moving domain from old website

1. Remove old A/CNAME records pointing to the previous host.
2. Wait for TTL to expire (or purge Cloudflare cache).
3. Deploy this stack on Contabo, then add records above.
4. Enable **Always Use HTTPS** in Cloudflare → SSL/TLS → Edge Certificates.
