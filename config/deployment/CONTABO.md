# Manual deployment — Contabo VPS + Cloudflare (ruirufactorymabati.com)

Complete step-by-step guide. Do everything by hand on the VPS and in Cloudflare.

---

## Part 1 — Before you start

You need:

- Contabo VPS (Ubuntu 22.04+ recommended) with a **public IPv4**
- Domain **ruirufactorymabati.com** (registrar access)
- Cloudflare account (free tier is fine)
- SSH access to the VPS as root or sudo user
- This repository on the VPS (git clone or upload)

Write down your **Contabo public IP** — you will use it everywhere MikroTik and WireGuard connect (not the Cloudflare proxy).

---

## Part 2 — Cloudflare (domain + DNS)

### 2.1 Add the site

1. Log in at https://dash.cloudflare.com
2. **Add a site** → enter `ruirufactorymabati.com`
3. Choose the Free plan
4. Cloudflare shows two nameservers (e.g. `ada.ns.cloudflare.com`)
5. At your **domain registrar**, replace the old nameservers with Cloudflare’s
6. Wait until Cloudflare shows the site as **Active** (can take up to 24 hours, often minutes)

### 2.2 Remove old website records

If the domain pointed to another host:

1. Cloudflare → **DNS** → **Records**
2. Delete old **A**, **AAAA**, and **CNAME** records for `@`, `www`, or anything pointing to the old server
3. **Caching** → **Configuration** → **Purge Everything** (optional, after cutover)

### 2.3 Create DNS records

Replace `YOUR_CONTABO_IP` with your VPS IPv4.

| Type | Name     | Content         | Proxy status               | Why |
|------|----------|-----------------|----------------------------|-----|
| A    | `@`      | YOUR_CONTABO_IP | **Proxied** (orange cloud) | Admin UI, API, captive portal |
| A    | `www`    | YOUR_CONTABO_IP | **Proxied**                | Same as apex |
| A    | `lumen`  | YOUR_CONTABO_IP | **Proxied**                | Lumen marketing website |
| A    | `demo`   | YOUR_CONTABO_IP | **Proxied**                | Interactive demo (API simulated in browser) |
| A    | `wg`     | YOUR_CONTABO_IP | **DNS only** (grey cloud)  | WireGuard — UDP cannot use HTTP proxy |
| A    | `radius` | YOUR_CONTABO_IP | **DNS only**               | Optional label for MikroTik documentation |

**Rule:** Orange cloud = web only. Grey cloud or raw IP = RADIUS and WireGuard.

### 2.4 SSL/TLS (pick one)

**Option A — Flexible (fastest, no cert on VPS)**

1. Cloudflare → **SSL/TLS** → Overview → **Flexible**
2. **SSL/TLS** → **Edge Certificates** → turn on **Always Use HTTPS**

Visitors see HTTPS. Your VPS only needs port **80** open for Nginx.

**Option B — Full (strict) (recommended long-term)**

1. Cloudflare → **SSL/TLS** → **Origin Server** → **Create Certificate**
2. Hostnames: `ruirufactorymabati.com`, `*.ruirufactorymabati.com`
3. Save the certificate as `origin.pem` and private key as `origin.key`
4. On the VPS, place them in:
   - `certs/nginx/origin.pem`
   - `certs/nginx/origin.key`
5. Edit `config/nginx/conf.d/billing.conf` — uncomment the entire `listen 443 ssl` server block (lines 21–30)
6. Cloudflare → **SSL/TLS** → Overview → **Full (strict)**
7. After deploy, rebuild only the web container (see Part 5.4)

---

## Part 3 — VPS preparation (Contabo)

### 3.1 SSH into the VPS

```bash
ssh root@YOUR_CONTABO_IP
```

### 3.2 Install Docker

```bash
apt update
apt install -y docker.io docker-compose-v2 git
systemctl enable docker
systemctl start docker
```

(Optional) Allow your user to run Docker without sudo:

```bash
usermod -aG docker YOUR_USERNAME
# log out and SSH back in
```

### 3.3 Clone the project

```bash
mkdir -p /opt/infora-billing
cd /opt/infora-billing
git clone <YOUR_REPO_URL> .
```

Or upload the project with `scp` / SFTP into `/opt/infora-billing`.

### 3.4 Open firewall ports

**On the VPS (UFW example):**

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 1812/udp
ufw allow 1813/udp
ufw allow 51820/udp
ufw allow 51821/udp
ufw enable
ufw status
```

**In Contabo control panel:** if there is a separate VPS firewall, allow the same ports there too.

| Port  | Protocol | Service |
|-------|----------|---------|
| 22    | TCP      | SSH |
| 80    | TCP      | Nginx (Cloudflare → origin) |
| 443   | TCP      | Nginx HTTPS (if using Full strict) |
| 1812  | UDP      | RADIUS authentication |
| 1813  | UDP      | RADIUS accounting |
| 51820 | UDP      | Customer WireGuard VPN |
| 51821 | UDP      | Management WireGuard (MikroTik tunnel) |

Do **not** expose PostgreSQL (5432) to the public internet.

---

## Part 4 — Environment file (`.env`)

### 4.1 Create `.env`

```bash
cd /opt/infora-billing
cp config/deployment/production.env.example .env
nano .env
```

### 4.2 Generate secrets

On the VPS:

```bash
openssl rand -hex 32    # use for SECRET_KEY
openssl rand -hex 32    # use for JWT_SECRET_KEY
openssl rand -hex 32    # use for ENCRYPTION_KEY
openssl rand -hex 32    # use for RADIUS_SECRET
openssl rand -hex 24    # use for POSTGRES_PASSWORD
```

### 4.3 Fill in `.env` (example)

Replace every placeholder with real values. `POSTGRES_PASSWORD` in `DATABASE_URL` must match `POSTGRES_PASSWORD`.

```bash
CONTABO_PUBLIC_IP=203.0.113.50

APP_DOMAIN=ruirufactorymabati.com
VITE_API_BASE_URL=https://ruirufactorymabati.com
CORS_ORIGINS=https://ruirufactorymabati.com,https://www.ruirufactorymabati.com

PUBLIC_SERVER_HOST=203.0.113.50
FREERADIUS_HOST=203.0.113.50
WIREGUARD_MGMT_ENDPOINT=wg.ruirufactorymabati.com
WIREGUARD_MGMT_PORT=51821

SECRET_KEY=<generated>
JWT_SECRET_KEY=<generated>
ENCRYPTION_KEY=<generated>
RADIUS_SECRET=<generated>
POSTGRES_PASSWORD=<generated>

DATABASE_URL=postgresql://infora_user:<same_postgres_password>@postgres:5432/infora_billing
FLASK_ENV=production

WIREGUARD_CONFIG_DIR=/app/wireguard_configs
WIREGUARD_MIKROTIK_AUTO_PUSH=true

VITE_RADIUS_SERVER=203.0.113.50

MPESA_ENVIRONMENT=production
MPESA_CALLBACK_URL=https://ruirufactorymabati.com/api/payments/mpesa/callback
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

---

## Part 5 — Build and start Docker

All commands from `/opt/infora-billing`.

### 5.1 Build images

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

This builds:

- **web** — React frontend + Nginx (`config/nginx/Dockerfile`)
- **flask_app** — API with gunicorn
- **freeradius** — RADIUS server
- Uses existing images for postgres, wireguard, openldap

First build can take several minutes.

### 5.2 Start all services

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 5.3 Check containers are running

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

You should see `infora_web`, `infora_flask`, `infora_postgres`, `infora_freeradius`, `infora_wireguard` (and openldap) with state **running**.

### 5.4 Rebuild web only (after SSL cert or frontend env change)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build web
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d web
```

### 5.5 View logs if something fails

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs flask_app
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs web
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs freeradius
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs wireguard
```

Flask on first start runs `flask db upgrade` and `flask initdb` automatically.

---

## Part 6 — FreeRADIUS NAS clients (MikroTik)

After you register MikroTik devices in the admin UI, sync `clients.conf`:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec flask_app flask generate-radius-clients
```

Restart FreeRADIUS so it reloads the file (mounted from `./config/freeradius/clients.conf`):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart freeradius
```

Repeat these two commands whenever you add a router or regenerate an ISP RADIUS secret.

---

## Part 7 — Verify the web stack

### 7.1 From the VPS

```bash
curl -s http://localhost/api/test
```

Expected: `{"message":"Backend is working!"}`

```bash
curl -s http://localhost/api/health/deployment | head -c 500
```

### 7.2 From your browser

| URL | Expected |
|-----|----------|
| https://ruirufactorymabati.com/login | Admin login page |
| https://ruirufactorymabati.com/portal | Captive portal |
| https://ruirufactorymabati.com/api/health/deployment | JSON deployment checklist |

If the site does not load: check Cloudflare DNS (proxied A record), port 80 on VPS/Contabo firewall, and `docker compose ... logs web`.

---

## Part 8 — First-time admin setup

1. Open https://ruirufactorymabati.com/signup or use seeded admin (if `flask initdb` created one — check logs)
2. Create an **ISP** — note that `radius_secret` is auto-generated
3. **Devices → MikroTik** — register each router (NAS IP = what FreeRADIUS sees)
4. Run Part 6 again to update `clients.conf`
5. Download **RADIUS .rsc** from the device row (never copy placeholder commands from the UI)
6. **Clients** — create an active PPPoE customer with a plan → save the one-time RADIUS password

Verify RADIUS user row:

```bash
curl "https://ruirufactorymabati.com/api/health/radius-user?email=customer@example.com"
```

---

## Part 9 — MikroTik (manual)

### 9.1 Direct RADIUS (router can reach Contabo IP on UDP 1812)

1. Admin UI → Devices → MikroTik → **Download RADIUS .rsc**
2. Upload to MikroTik: Winbox → Files → upload → Terminal: `/import file-name=infora-radius-....rsc`
3. RADIUS server in the file should be your **Contabo IP** and **ISP radius_secret**

### 9.2 Router behind NAT (management WireGuard tunnel)

1. When adding the device, enable **Management WireGuard tunnel**
2. Download **management tunnel .rsc** first → import on MikroTik
3. Download **RADIUS .rsc** → import second
4. RADIUS server in script = `10.250.0.1` (tunnel IP on billing server)
5. WireGuard peer endpoint on router = `wg.ruirufactorymabati.com:51821` (DNS only)

### 9.3 On the router (API for monitoring)

Enable API so the billing server can sync stats (from Winbox terminal):

```
/ip service enable api
/ip service set api port=8728 disabled=no
```

### 9.4 Test PPPoE

Create a PPPoE secret on MikroTik with the customer email (lowercase) and password from the admin UI. Connect a client — session should authenticate via RADIUS.

---

## Part 10 — WireGuard on the server

The `wireguard` container shares a volume with Flask:

- Customer VPN configs: `/config/isp_*/server_*/wg0.conf`
- Management tunnel: `/config/mgmt/wg-mgmt.conf`

UDP **51820** — customer VPN  
UDP **51821** — management tunnel (MikroTik)

After provisioning peers in the admin UI, restart WireGuard if needed:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart wireguard
```

Check logs:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs wireguard
```

---

## Part 11 — Updates (manual)

When you pull new code:

```bash
cd /opt/infora-billing
git pull

docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

docker compose -f docker-compose.yml -f docker-compose.prod.yml exec flask_app flask db upgrade
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec flask_app flask generate-radius-clients
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart freeradius wireguard
```

---

## Part 12 — Troubleshooting

| Problem | What to check |
|---------|----------------|
| Site 522/521 on Cloudflare | VPS down, port 80 closed, or `infora_web` not running |
| Login works locally but not via domain | `CORS_ORIGINS` in `.env` must include `https://ruirufactorymabati.com` — rebuild **web** and restart **flask_app** |
| PPPoE Access-Reject | `clients.conf` has router IP + correct secret; `radcheck` row exists; UDP 1812 open |
| Wrong RADIUS secret on MikroTik | Re-download `.rsc` from API; ISP must have `radius_secret` |
| WireGuard won't connect | `wg` DNS record grey-cloud; UDP 51820/51821 open; endpoint = `wg.ruirufactorymabati.com` |
| M-Pesa callback fails | `MPESA_CALLBACK_URL` must be `https://ruirufactorymabati.com/api/payments/mpesa/callback` |

---

## Quick reference — containers

| Container | Role |
|-----------|------|
| `infora_web` | Nginx + React (ports 80, 443) |
| `infora_flask` | API gunicorn (internal 5000) |
| `infora_postgres` | Database (internal only in prod) |
| `infora_freeradius` | RADIUS 1812/1813 UDP |
| `infora_wireguard` | WireGuard 51820/51821 UDP |

Compose files used together:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml <command>
```
