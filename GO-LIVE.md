# Go-live — remaining steps on fibi (2.24.114.80)

The billing stack is **built, running and verified internally**. It is not yet
reachable from the internet: the edge proxy does not know about it and has no
certificate for the domain. Four steps remain, in this order.

Nothing below touches fibi / dan / draftbit until step 2's reload, and that
reload is validated first.

---

## 1. Paste the Cloudflare Origin certificate

In Cloudflare → `ruirufactorymabati.com` → **SSL/TLS → Origin Server →
Create Certificate**. Let Cloudflare generate the key. Hostnames must include
**both**:

    ruirufactorymabati.com
    *.ruirufactorymabati.com

Validity 15 years → **Create**. Leave the tab open — the private key is shown
once and can never be retrieved again.

Then on the server, exactly as before:

```bash
cd /srv/infora-billing/Infora-wifi-billing
nano -w certs/nginx/origin.pem     # paste the Origin Certificate block
nano -w certs/nginx/origin.key     # paste the Private Key block
```

Include the `-----BEGIN…-----` / `-----END…-----` lines in both. Save with
`Ctrl+O`, `Enter`, `Ctrl+X`. Use `-w`: without it a nano configured to wrap
long lines will corrupt a pasted PEM, and the error appears later as an nginx
failure rather than a paste problem.

```bash
chmod 644 certs/nginx/origin.pem
chmod 600 certs/nginx/origin.key
./scripts/publish-origin-cert.sh
```

The script refuses to publish unless the certificate parses AND the key matches
it, then copies the pair onto the proxy's cert volume as
`live/ruirufactorymabati.com/{fullchain,privkey}.pem`.

> A key/cert mismatch is the classic cause of a Cloudflare **525** with nothing
> useful in any log. The script catches it here instead.

---

## 2. Wire the domain into the shared proxy

`fibi-proxy-1` includes vhosts from two mounted directories. Billing has no
mount of its own, so its files go into the `dan` directory, which is already
mounted read-only into the proxy:

```bash
cp config/deployment/fibi-proxy/10-infora-billing-http.conf  /srv/dan/deploy/vhosts/
cp config/deployment/fibi-proxy/20-infora-billing-https.conf /srv/dan/deploy/vhosts/

docker exec fibi-proxy-1 nginx -t          # MUST pass before the next line
docker exec fibi-proxy-1 nginx -s reload
```

**Never `docker compose up`/`restart` that container** — it fronts
fibicommunity.org, visionmentors.org and draftbitlabs.tech. A reload is
zero-downtime; a recreate is not.

If `nginx -t` fails, delete the two files and reload again — the other three
sites are untouched as long as you never reload a failing config.

> Install the HTTPS file **only after step 1**. nginx refuses to start when a
> server block names a certificate that is missing or empty, and that failure
> would take the other three sites down with it. The two files are split for
> exactly this reason.

Cleaner alternative, if you would rather billing owned its own mount: add
`- /srv/infora-billing/Infora-wifi-billing/config/deployment/fibi-proxy:/etc/nginx/conf.d/vhosts-billing:ro`
to the proxy service in `/opt/fibi/FIBI/docker-compose.yml` and an
`include /etc/nginx/conf.d/vhosts-billing/*.conf;` line in
`/opt/fibi/FIBI/deploy/nginx.conf`. That needs the proxy **recreated**, which
briefly drops all four sites — so do it in a quiet window, not at go-live.

---

## 3. Point Cloudflare DNS at this server

All records → **2.24.114.80**.

| Type | Name | Proxy | Why |
|---|---|---|---|
| A | `@` | **Proxied** | Lumen marketing site + /api for M-Pesa callbacks |
| A | `www` | **Proxied** | same as apex |
| A | `billing` | **Proxied** | admin console + captive portal |
| A | `demo` | **Proxied** | interactive demo |
| A | `lumen` | **Proxied** | legacy, 301s to apex |
| A | `webfig` | **Proxied** | must be orange: the origin serves a Cloudflare Origin CA cert that only Cloudflare's edge trusts |
| A | `wg` | **DNS only** | WireGuard — UDP cannot cross the HTTP proxy |
| A | `radius` | **DNS only** | RADIUS — same reason |

Then **SSL/TLS → Overview → Full (strict)**, and purge the cache.

The orange/grey split is not cosmetic: anything carrying UDP must be grey or a
raw IP.

---

## 4. Open the UDP ports (needs root — I could not do this)

`sudo` on this box requires a password, so the firewall was left alone.

```bash
sudo ./scripts/setup-firewall.sh
```

That opens 22/80/443 TCP and 1812/1813/51820/51821 UDP, **and** adds the
`DOCKER-USER` accept rules plus `DEFAULT_FORWARD_POLICY="ACCEPT"`. Those last
two matter: `ufw allow` only opens the host INPUT chain, but WireGuard runs
inside a container, so handshakes are forwarded — and ufw drops forwarded
traffic by default. That is the failure where the router's Tx climbs, Rx stays
0, and every peer shows zero handshakes.

Check the hosting panel for a cloud firewall too. If `tcpdump -ni any udp port
51821` shows nothing while a router is trying, the drop is upstream of the host.

DOCKER-USER rules do not survive a dockerd restart or reboot — re-run the
script after either.

---

## Verify

```bash
curl -I https://billing.ruirufactorymabati.com/login
curl -s https://billing.ruirufactorymabati.com/api/test
curl -s http://127.0.0.1:5080/api/health/deployment | python3 -m json.tool
```

Create the first tenant at `https://billing.ruirufactorymabati.com/signup` —
there is no seeded admin. Then register routers, and after each one:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.fibi.yml \
  exec flask_app flask generate-radius-clients
docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.fibi.yml \
  restart freeradius
```

FreeRADIUS reads `clients.conf` only at startup; an unlisted NAS is dropped as
an unknown client with nothing logged that names the router.

---

## Everyday commands

```bash
cd /srv/infora-billing/Infora-wifi-billing
export DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.fibi.yml"
$DC ps
$DC logs --tail=100 flask_app
$DC build flask_app && $DC up -d flask_app        # backend change
$DC build web       && $DC up -d web              # frontend / VITE_* change
$DC up -d flask_app                               # .env change (NOT restart)
```

`config/freeradius/sites-available/default` is modified locally (the realm fix).
Before the next `git pull`, either commit it upstream and then
`git checkout -- config/freeradius/sites-available/default`, or stash it —
otherwise the pull is blocked.
