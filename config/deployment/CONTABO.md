# Manual deployment — Contabo VPS + Cloudflare (ruirufactorymabati.com)

Complete step-by-step guide to deploy by hand on a fresh Contabo VPS. Use this checklist start to finish.

**Deploy directory (this guide):** `/srv/infora-billing`  
Use this path so the stack does not clash with anything already under `/opt` on the same server.

```bash
export DEPLOY_DIR=/srv/infora-billing
```

All commands below assume you are in `$DEPLOY_DIR` unless stated otherwise.

---

## Part 1 — Before you start

You need:

| Item | Notes |
|------|--------|
| Contabo VPS | Ubuntu 22.04+ recommended, **public IPv4** |
| Domain | `ruirufactorymabati.com` (registrar access) |
| Cloudflare | Free tier is fine |
| SSH | Root or sudo user on the VPS |
| Docker | Already installed on your VPS (see Part 3.2) |
| Git access | To clone this repository |

Write down your **Contabo public IPv4** — MikroTik RADIUS and WireGuard must reach this IP directly (not through Cloudflare’s HTTP proxy).

Example: `203.0.113.50` → replace with yours everywhere you see `YOUR_CONTABO_IP`.

---

## Part 2 — Avoid conflicts with an existing `/opt` deployment

If you already run another project under `/opt`, **do not deploy this stack there**. This guide uses `/srv/infora-billing` instead.

Even in a separate folder, Docker **ports and container names** can still conflict. This stack uses:

| Resource | Value |
|----------|--------|
| Host ports (billing only) | `127.0.0.1:5080` (API), `1812/udp`, `1813/udp`, `51820/udp`, `51821/udp` — **not** 80/443 when using dan-proxy |
| Container names | `infora_flask`, `infora_postgres`, `infora_freeradius`, `infora_wireguard`, `infora_openldap` (optional `infora_web` with bundled-nginx profile) |

**Before starting the new stack**, on the VPS:

```bash
# See what is listening on required ports
ss -tulpn | grep -E ':80 |:443 |:1812 |:1813 |:51820 |:51821 '

# List running containers that might conflict
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
```

If the old `/opt` project binds the same ports or uses the same container names, **stop that stack first** (from its own directory):

```bash
cd /opt/<old-project>
docker compose down
```

Leave the old files in `/opt`; only stop the containers. The new billing stack will run entirely from `/srv/infora-billing`.

---

## Part 2B — Shared server: Vision / dan-proxy already on port 80 (recommended)

If `docker ps` shows something like `dan-proxy-1` on `0.0.0.0:80` and `0.0.0.0:443`, **do not start `infora_web`**. The billing stack is designed to run **behind your existing nginx**.

### Architecture

```text
Internet → Cloudflare → dan-proxy (port 80/443)
                              ├─ visionmentors.org      → ngo-website
                              ├─ admin.visionmentors.org → admin
                              └─ billing.ruirufactorymabati.com → static files + /api → Flask :5080
```

### What billing Docker runs (no port 80/443)

| Service | Host binding |
|---------|----------------|
| `infora_flask` | `127.0.0.1:5080` → API only |
| `infora_freeradius` | UDP 1812, 1813 |
| `infora_wireguard` | UDP 51820, 51821 |
| `infora_postgres` | internal only (no public 5432) |

No `infora_web` container in the default production compose.

### Step 1 — Start billing without bundled nginx

```bash
cd /srv/infora-billing
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

If you previously failed on `infora_web`:

```bash
docker rm -f infora_web 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Verify Flask:

```bash
curl -s http://127.0.0.1:5080/api/test
```

### Step 2 — Build frontend static files

On the VPS (requires Node 20+ once, or build locally and upload):

```bash
cd /srv/infora-billing/FRONTEND/infora_billing
npm ci
VITE_API_BASE_URL=https://billing.ruirufactorymabati.com \
VITE_RADIUS_SERVER=YOUR_CONTABO_IP \
npm run build
mkdir -p /srv/infora-billing/frontend-dist
rm -rf /srv/infora-billing/frontend-dist/*
cp -r dist/* /srv/infora-billing/frontend-dist/
```

Use your real public URL in `VITE_API_BASE_URL` (e.g. `https://ruirufactorymabati.com` if apex, or `https://billing.ruirufactorymabati.com` if subdomain).

Update `.env`:

```bash
VITE_API_BASE_URL=https://billing.ruirufactorymabati.com
CORS_ORIGINS=https://billing.ruirufactorymabati.com
```

### Step 3 — Add vhost to dan-proxy (Vision nginx)

Copy the example and edit the domain:

```bash
# Example lives in the billing repo:
cat /srv/infora-billing/config/deployment/nginx-external-proxy.conf.example
```

Add a `server { ... }` block to your **dan-proxy** nginx config (wherever `dan-proxy-1` mounts its conf.d), using:

- `root /srv/infora-billing/frontend-dist;`
- `proxy_pass http://127.0.0.1:5080;` for `location /api/`

If dan-proxy runs **inside Docker** and cannot use `127.0.0.1`, try:

```nginx
proxy_pass http://172.17.0.1:5080;
```

Reload Vision proxy:

```bash
docker exec dan-proxy-1 nginx -t
docker exec dan-proxy-1 nginx -s reload
```

(Replace `dan-proxy-1` with your proxy container name.)

### Step 4 — Cloudflare DNS for billing

Either use the **apex** domain (proxied A → Contabo IP) or a **subdomain**:

| Type | Name | Content | Proxy |
|------|------|---------|--------|
| A | `billing` | Contabo IP | Proxied |

`MPESA_CALLBACK_URL` and `CORS_ORIGINS` in `.env` must match the exact URL users open in the browser.

### Optional — bundled nginx (only on a clean VPS)

If ports 80/443 are free:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile bundled-nginx up -d
```

---

## Part 3 — Cloudflare (domain + DNS)

### 3.1 Add the site

1. Log in at https://dash.cloudflare.com
2. **Add a site** → enter `ruirufactorymabati.com`
3. Choose the **Free** plan
4. Cloudflare shows two nameservers (e.g. `ada.ns.cloudflare.com`)
5. At your **domain registrar**, replace old nameservers with Cloudflare’s
6. Wait until Cloudflare shows the site as **Active** (often minutes, up to 24 h)

### 3.2 Remove old website records

If the domain pointed to another host:

1. Cloudflare → **DNS** → **Records**
2. Delete old **A**, **AAAA**, and **CNAME** for `@`, `www`, or anything pointing to the old server
3. **Caching** → **Configuration** → **Purge Everything** (optional, after cutover)

### 3.3 Create DNS records

Replace `YOUR_CONTABO_IP` with your VPS IPv4.

| Type | Name | Content | Proxy | Why |
|------|------|---------|-------|-----|
| A | `@` | YOUR_CONTABO_IP | **Proxied** (orange) | Admin UI, API, captive portal |
| A | `www` | YOUR_CONTABO_IP | **Proxied** | Same as apex |
| A | `lumen` | YOUR_CONTABO_IP | **Proxied** | Lumen marketing website |
| A | `demo` | YOUR_CONTABO_IP | **Proxied** | Interactive demo (API simulated in browser) |
| A | `wg` | YOUR_CONTABO_IP | **DNS only** (grey) | WireGuard — UDP cannot use HTTP proxy |
| A | `radius` | YOUR_CONTABO_IP | **DNS only** | Optional label for MikroTik docs |

**Rule:** Orange cloud = web (HTTP/HTTPS) only. Grey cloud or raw IP = RADIUS and WireGuard.

### 3.4 SSL/TLS mode (choose one now)

| Mode | When to use | Cert on VPS? |
|------|-------------|--------------|
| **Flexible** (Part 4A) | Fastest first deploy | No |
| **Full (strict)** (Part 4B) | Recommended long-term | Yes — Cloudflare Origin Certificate |

You can start with Flexible and switch to Full (strict) later using Part 4B.

---

## Part 4 — VPS preparation

### 4.1 SSH into the VPS

```bash
ssh root@YOUR_CONTABO_IP
```

### 4.2 Confirm Docker (already installed)

Docker is expected to be on the server. Verify:

```bash
docker --version
docker compose version
```

If `docker compose` is missing but Docker works:

```bash
apt update
apt install -y docker-compose-v2 git
```

Only if Docker is **not** installed at all:

```bash
apt update
apt install -y docker.io docker-compose-v2 git
systemctl enable docker
systemctl start docker
```

(Optional) Run Docker without sudo:

```bash
usermod -aG docker YOUR_USERNAME
# log out and SSH back in
```

### 4.3 Create deploy directory and clone the project

```bash
export DEPLOY_DIR=/srv/infora-billing
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"
git clone <YOUR_REPO_URL> .
```

Or upload from your machine (run on your **local** PC):

```bash
rsync -avz --exclude node_modules --exclude .git \
  /path/to/Infora-wifi-billing/ root@YOUR_CONTABO_IP:/srv/infora-billing/
```

Confirm layout:

```bash
cd /srv/infora-billing
ls docker-compose.yml docker-compose.prod.yml config/nginx/conf.d/billing.conf
```

### 4.4 Open firewall ports

**On the VPS** — either run the script:

```bash
cd /srv/infora-billing
sudo ./scripts/setup-firewall.sh
```

Or configure UFW manually:

```bash
ufw allow 22/tcp
ufw allow 80/tcpr
ufw enable
ufw status
```

**In the Contabo control panel:** if the VPS has a separate firewall, allow the same ports there too.

| Port | Protocol | Service |
|------|----------|---------|
| 22 | TCP | SSH |
| 80 | TCP | Nginx (Cloudflare → origin) |
| 443 | TCP | Nginx HTTPS (Full strict) |
| 1812 | UDP | RADIUS authentication |
| 1813 | UDP | RADIUS accounting |
| 51820 | UDP | Customer WireGuard VPN |
| 51821 | UDP | Management WireGuard (MikroTik tunnel) |

Do **not** expose PostgreSQL (5432) to the public internet.

---

## Part 5 — Environment file (`.env`)

### 5.1 Create `.env`

```bash
cd /srv/infora-billing
cp config/deployment/production.env.example .env
nano .env
```

### 5.2 Generate secrets

On the VPS:

```bash
openssl rand -hex 32    # SECRET_KEY
openssl rand -hex 32    # JWT_SECRET_KEY
openssl rand -hex 32    # ENCRYPTION_KEY
openssl rand -hex 32    # RADIUS_SECRET
openssl rand -hex 24    # POSTGRES_PASSWORD
```

### 5.3 Fill in `.env`

Replace every placeholder. `POSTGRES_PASSWORD` inside `DATABASE_URL` must match `POSTGRES_PASSWORD`.

```bash
CONTABO_PUBLIC_IP=YOUR_CONTABO_IP

APP_DOMAIN=ruirufactorymabati.com
VITE_API_BASE_URL=https://ruirufactorymabati.com
CORS_ORIGINS=https://ruirufactorymabati.com,https://www.ruirufactorymabati.com

PUBLIC_SERVER_HOST=YOUR_CONTABO_IP
FREERADIUS_HOST=YOUR_CONTABO_IP
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

VITE_RADIUS_SERVER=YOUR_CONTABO_IP

MPESA_ENVIRONMENT=production
MPESA_CALLBACK_URL=https://ruirufactorymabati.com/api/payments/mpesa/callback
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

---

## Part 6 — SSL certificates (Cloudflare)

Skip to **Part 7** if you chose **Flexible** SSL (Part 4A below).  
Complete this part **before** the first `docker compose build` if you want **Full (strict)** from day one.

### 6A — Option A: Flexible SSL (no cert on VPS)

Do this in Cloudflare only — no files on the server.

1. Cloudflare → **SSL/TLS** → **Overview** → select **Flexible**
2. **SSL/TLS** → **Edge Certificates** → enable **Always Use HTTPS**
3. Deploy the stack (Part 7). Nginx only needs port **80** on the VPS.

Visitors see HTTPS; Cloudflare talks to your origin over HTTP on port 80.

### 6B — Option B: Full (strict) with Origin Certificate (recommended)

End-to-end encryption between Cloudflare and your VPS.

#### Step 1 — Create the origin certificate in Cloudflare

1. Cloudflare → select `ruirufactorymabati.com`
2. **SSL/TLS** → **Origin Server**
3. **Create Certificate**
4. Let Cloudflare generate a private key and CSR
5. Hostnames (defaults are fine):
   - `ruirufactorymabati.com`
   - `*.ruirufactorymabati.com`
6. Certificate validity: **15 years**
7. Click **Create**
8. Copy **Origin Certificate** (PEM) — you will paste this into `origin.pem`
9. Copy **Private Key** (PEM) — you will paste this into `origin.key`
10. Click **OK**

Keep the Cloudflare tab open until both files are saved on the VPS.

#### Step 2 — Place certificate files on the VPS

On the VPS:

```bash
cd /srv/infora-billing
mkdir -p certs/nginx
chmod 755 certs/nginx
```

**Origin certificate:**

```bash
nano certs/nginx/origin.pem
```

Paste the full **Origin Certificate** from Cloudflare, including lines:

```
-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----
```

Save and exit.

**Private key:**

```bash
nano certs/nginx/origin.key
```

Paste the full **Private Key** from Cloudflare, including lines:

```
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

Save and exit.

Lock down the key:

```bash
chmod 600 certs/nginx/origin.key
chmod 644 certs/nginx/origin.pem
ls -la certs/nginx/
```

Expected:

```
-rw-r--r-- 1 root root  ... origin.pem
-rw------- 1 root root  ... origin.key
-rw-r--r-- 1 root root  ... README.md
```

**Alternative — upload from your laptop:**

```bash
scp origin.pem origin.key root@YOUR_CONTABO_IP:/srv/infora-billing/certs/nginx/
ssh root@YOUR_CONTABO_IP 'chmod 600 /srv/infora-billing/certs/nginx/origin.key'
```

#### Step 3 — Enable HTTPS in Nginx config

On the VPS:

```bash
nano /srv/infora-billing/config/nginx/conf.d/billing.conf
```

Uncomment the entire HTTPS `server { ... }` block (lines 21–30). It should look like:

```nginx
server {
    listen 443 ssl http2;
    server_name ruirufactorymabati.com www.ruirufactorymabati.com;

    ssl_certificate     /etc/nginx/ssl/origin.pem;
    ssl_certificate_key /etc/nginx/ssl/origin.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    include /etc/nginx/snippets/billing-locations.conf;
}
```

Save and exit. The HTTP server on port 80 stays enabled (Cloudflare and health checks use it).

`docker-compose.prod.yml` already mounts `./certs/nginx` → `/etc/nginx/ssl` inside the web container.

#### Step 4 — Set Cloudflare to Full (strict)

1. Cloudflare → **SSL/TLS** → **Overview** → **Full (strict)**
2. **SSL/TLS** → **Edge Certificates** → enable **Always Use HTTPS**

#### Step 5 — Rebuild web after cert or nginx change

After placing certs or editing `billing.conf`, rebuild **only** the web image (Part 7.4).

#### Verify certs inside the container (after deploy)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec web \
  ls -la /etc/nginx/ssl/
```

You should see `origin.pem` and `origin.key`.

---

## Part 7 — Build and start Docker

All commands from `/srv/infora-billing`:

```bash
cd /srv/infora-billing
```

**If you use Vision / dan-proxy (Part 2B):** no `infora_web` — Flask binds `127.0.0.1:5080` only.

### 7.1 Build images

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

This builds:

| Service | Image |
|---------|--------|
| **flask_app** | API with gunicorn |
| **freeradius** | RADIUS server |

Uses upstream images for postgres, wireguard, openldap.  
(`web` is only built with `--profile bundled-nginx`.)

First build can take several minutes.

### 7.2 Start all services

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 7.3 Check containers are running

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Expected state **running** (default / behind external proxy):

- `infora_flask` — ports `127.0.0.1:5080->5000/tcp`
- `infora_postgres` — no public 5432
- `infora_freeradius`
- `infora_wireguard`
- `infora_openldap`

Test API:

```bash
curl -s http://127.0.0.1:5080/api/test
```

### 7.4 Rebuild after code or `.env` changes

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build flask_app
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d flask_app
```

If you changed `VITE_*` in `.env`, rebuild frontend static files (Part 2B Step 2) and reload dan-proxy — no `infora_web` rebuild needed.

**Only if using bundled nginx profile:**

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml build web
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile bundled-nginx up -d web
```

### 7.5 View logs if something fails

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs flask_app
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs freeradius
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs wireguard
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs postgres
```

Flask on first start runs `flask db upgrade` and `flask initdb` automatically.

---

## Part 8 — FreeRADIUS NAS clients (MikroTik)

After you register MikroTik devices in the admin UI, sync `clients.conf`:

```bash
cd /srv/infora-billing
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec flask_app flask generate-radius-clients
```

Restart FreeRADIUS so it reloads the file (mounted from `./config/freeradius/clients.conf`):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart freeradius
```

Repeat whenever you add a router or regenerate an ISP RADIUS secret.

---

## Part 9 — Verify the deployment

### 9.1 From the VPS (localhost)

```bash
curl -s http://localhost/api/test
```

Expected: `{"message":"Backend is working!"}`

```bash
curl -s http://localhost/api/health/deployment | python3 -m json.tool
```

If using Full (strict) and HTTPS is enabled:

```bash
curl -sk https://localhost/api/test
```

### 9.2 From your browser

| URL | Expected |
|-----|----------|
| https://ruirufactorymabati.com | Lumen marketing website (main site) |
| https://billing.ruirufactorymabati.com/login | Admin login page |
| https://billing.ruirufactorymabati.com/portal | Captive portal |
| https://billing.ruirufactorymabati.com/api/health/deployment | JSON deployment checklist |
| https://demo.ruirufactorymabati.com | Interactive demo (browser-simulated API) |

### 9.3 Troubleshoot “site not loading”

1. Cloudflare DNS: `@` and `www` A records → YOUR_CONTABO_IP, **proxied**
2. VPS firewall: ports 80 (and 443 if Full strict) open
3. Contabo panel firewall: same ports
4. No other stack on the host using port 80/443 (`ss -tulpn | grep ':80 '`)
5. `docker compose ... ps` — `infora_web` must be **running**
6. `docker compose ... logs web` — no nginx SSL errors

| Cloudflare error | Likely cause |
|------------------|--------------|
| 521 | Nginx not running or port 80 closed |
| 522 | VPS unreachable / firewall |
| 525 / SSL errors | Full (strict) but missing or wrong `origin.pem` / `origin.key` |

---

## Part 10 — First-time admin setup

1. Open https://ruirufactorymabati.com/signup or use seeded admin (check `flask_app` logs after `flask initdb`)
2. Create an **ISP** — note the auto-generated `radius_secret`
3. **Devices → MikroTik** — register each router (NAS IP = what FreeRADIUS sees)
4. Run Part 8 again to update `clients.conf`
5. Download **RADIUS .rsc** from the device row (never copy placeholder commands from the UI)
6. **Clients** — create an active PPPoE customer with a plan → save the one-time RADIUS password

Verify RADIUS user row:

```bash
curl "https://ruirufactorymabati.com/api/health/radius-user?email=customer@example.com"
```

---

## Part 11 — MikroTik (manual)

### 11.1 Direct RADIUS (router reaches Contabo IP on UDP 1812)

1. Admin UI → Devices → MikroTik → **Download RADIUS .rsc**
2. Upload to MikroTik: Winbox → Files → upload → Terminal: `/import file-name=infora-radius-....rsc`
3. RADIUS server in the file = your **Contabo IP** and **ISP radius_secret**

### 11.2 Router behind NAT (management WireGuard tunnel)

1. When adding the device, enable **Management WireGuard tunnel**
2. Download **management tunnel .rsc** first → import on MikroTik
3. Download **RADIUS .rsc** → import second
4. RADIUS server in script = `10.250.0.1` (tunnel IP on billing server)
5. WireGuard peer endpoint on router = `wg.ruirufactorymabati.com:51821` (DNS only, grey cloud)

### 11.3 On the router (API for monitoring)

```
/ip service enable api
/ip service set api port=8728 disabled=no
```

### 11.4 Test PPPoE

Create a PPPoE secret on MikroTik with the customer email (lowercase) and password from the admin UI. Connect a client — session should authenticate via RADIUS.

---

## Part 12 — WireGuard on the server

The `wireguard` container shares a volume with Flask:

| Path in container | Purpose |
|-------------------|---------|
| `/config/isp_*/server_*/wg0.conf` | Customer VPN |
| `/config/mgmt/wg-mgmt.conf` | Management tunnel (MikroTik) |

| Port | Purpose |
|------|---------|
| UDP 51820 | Customer VPN |
| UDP 51821 | Management tunnel |

After provisioning peers in the admin UI:

```bash
cd /srv/infora-billing
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart wireguard
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs wireguard
```

---

## Part 13 — Updates (manual)

When you pull new code:

```bash
cd /srv/infora-billing
git pull

docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

docker compose -f docker-compose.yml -f docker-compose.prod.yml exec flask_app flask db upgrade
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec flask_app flask generate-radius-clients
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart freeradius wireguard
```

If nginx or SSL config changed, also rebuild web (Part 7.4).

---

## Part 14 — Troubleshooting

| Problem | What to check |
|---------|----------------|
| Site 522/521 on Cloudflare | VPS down, port 80 closed, or `infora_web` not running |
| SSL 525 / origin cert errors | `origin.pem` / `origin.key` in `certs/nginx/`, HTTPS block uncommented in `billing.conf`, rebuild **web** |
| Login works locally but not via domain | `CORS_ORIGINS` in `.env` must include `https://ruirufactorymabati.com` — rebuild **web**, restart **flask_app** |
| Port already in use | Old `/opt` stack still running — `docker compose down` in that project |
| Container name already in use | Stop old `infora_*` containers: `docker rm -f infora_web ...` or stop the other compose project |
| PPPoE Access-Reject | `clients.conf` has router IP + correct secret; `radcheck` row exists; UDP 1812 open |
| Wrong RADIUS secret on MikroTik | Re-download `.rsc` from API; ISP must have `radius_secret` |
| WireGuard won't connect | `wg` DNS record grey-cloud; UDP 51820/51821 open; endpoint = `wg.ruirufactorymabati.com` |
| M-Pesa callback fails | `MPESA_CALLBACK_URL` = `https://ruirufactorymabati.com/api/payments/mpesa/callback` |

---

## Quick reference

**Deploy path:** `/srv/infora-billing` (not `/opt`)

**Compose command** (use for every docker operation):

```bash
cd /srv/infora-billing
docker compose -f docker-compose.yml -f docker-compose.prod.yml <command>
```

**Containers:**

| Container | Role |
|-----------|------|
| `infora_flask` | API gunicorn (`127.0.0.1:5080` → proxy) |
| `infora_web` | Optional bundled nginx (`--profile bundled-nginx` only) |
| `infora_postgres` | Database (internal only in prod) |
| `infora_freeradius` | RADIUS 1812/1813 UDP |
| `infora_wireguard` | WireGuard 51820/51821 UDP |
| `infora_openldap` | LDAP (internal) |

**Cert files (Full strict):**

```
/srv/infora-billing/certs/nginx/origin.pem
/srv/infora-billing/certs/nginx/origin.key
```

**Deploy checklist (copy/paste order):**

1. [ ] Cloudflare DNS records (Part 3)
2. [ ] Stop conflicting `/opt` containers if needed (Part 2)
3. [ ] Clone to `/srv/infora-billing` (Part 4.3)
4. [ ] Firewall ports (Part 4.4)
5. [ ] Create `.env` with secrets (Part 5)
6. [ ] SSL: Flexible **or** origin certs + nginx HTTPS (Part 6)
7. [ ] `docker compose ... build && up -d` (Part 7)
8. [ ] Verify health URLs (Part 9)
9. [ ] Admin + ISP + MikroTik (Parts 10–11)
