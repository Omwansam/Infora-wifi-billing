# Hotspot & PPPoE — Client Router Setup & Testing

How to test **Hotspot** and **PPPoE** through a MikroTik that this billing system has
already onboarded, using an ordinary user router (e.g. **Tenda F3 N300**) as the
downstream device.

This is specific to how this system provisions the MikroTik (`configure_services` in
`backend/server/services/device_config_ops.py`). Read §0 first — it removes the most
common misconception.

---

## 0. How this system lays out the router (read this first)

When you onboard a MikroTik and run **Configure services** (wizard Step 3), the system
builds **one bridge** and runs *both* services on it:

```text
Internet ──▶ ether1 (UPLINK, NAT masquerade, NOT bridged)
                 │
        ┌────────┴─────────────────────────────────┐
        │        infora-bridge  (172.31.0.1)        │
        │  ┌─ DHCP + Hotspot (name=infora) ─┐       │
        │  └─ PPPoE server (service-name=infora)─┘   │
        └──┬───────────────┬───────────────┬────────┘
        ether3          ether5          etherX   ← all "bridge ports"
```

Concretely (from `build_services_commands`):
- **`infora-bridge`** with your chosen ports (ether3, ether5…) added as bridge ports.
- **Bridge IP / gateway:** `172.31.0.1` (default subnet `172.31.0.0/16`).
- **Hotspot** (`/ip hotspot name=infora`) on the bridge, pool = **lower half**
  (`172.31.0.x …`), authenticating via **RADIUS**.
- **PPPoE server** (`service-name=infora`) on the same bridge, pool = **upper half**
  (`172.31.128.x …`), `/ppp aaa use-radius=yes`.

### The key rule
> A MikroTik **port does not "belong" to a service.** ether3 and ether5 both sit on
> `infora-bridge`, so **both hotspot and PPPoE are available on both ports.** What
> decides which one a downstream device uses is **how you configure the user router**:
>
> | User router mode | What happens | Service used |
> |---|---|---|
> | **Dumb AP / bridge** (no NAT, no DHCP) — uplink into its **LAN** port | its clients get a `172.31.0.x` lease from the MikroTik and hit the captive portal | **Hotspot** |
> | **Router / PPPoE client** (keeps its NAT+DHCP) — uplink into its **WAN** port, WAN type = PPPoE | it dials a PPPoE session, authenticated by RADIUS | **PPPoE** |

So "ether3 for hotspot, ether5 for PPPoE" isn't a MikroTik setting — plug the
**dumb-AP** Tenda into ether3 and the **PPPoE-client** Tenda into ether5, and each
uses the matching service. (If you genuinely need *port-isolated* services — ether3
can only ever do hotspot — that's an advanced manual setup with separate bridges/VLANs;
see §5. The default and simplest model is the shared bridge above.)

---

## 1. Prerequisites (do once, on the MikroTik)

Before any client test, confirm the MikroTik is fully provisioned by this system:

1. **Device onboarded & Online** in *Devices → MikroTik* (management tunnel up).
2. **RADIUS script imported** — the router has a `/radius` entry pointing at the
   billing server with `service=ppp,hotspot,dhcp` (from `build_radius_script`). Check:
   ```
   /radius print
   /radius monitor 0        ;# should show it reachable, no timeouts
   ```
3. **Services configured** — run wizard Step 3 (*Configure services*) with:
   - **Bridge ports:** tick `ether3`, `ether5` (the ports your user routers plug into).
     **Do NOT tick the uplink port** (`ether1`, the one going to the internet).
   - **Enable Hotspot:** ✅   **Enable PPPoE:** ✅
   - Subnet: leave default `172.31.0.0/16`.
4. **Verify on the router:**
   ```
   /interface bridge port print          ;# ether3, ether5 on infora-bridge
   /ip hotspot print                      ;# name=infora, on infora-bridge
   /interface pppoe-server server print   ;# service-name=infora, running
   /ip address print                      ;# 172.31.0.1/16 on infora-bridge
   ```

> Manual equivalent (if you ever wire ports by hand):
> ```
> /interface bridge port add bridge=infora-bridge interface=ether3
> /interface bridge port add bridge=infora-bridge interface=ether5
> ```
> Never add the internet uplink port to `infora-bridge`.

---

## 2. PART A — Hotspot (Tenda as a "dumb AP")

Goal: a phone joins the **Tenda's WiFi**, gets an IP from the **MikroTik hotspot**, and
sees the **captive portal** to buy a package / redeem a voucher.

For hotspot, the Tenda must **not** run its own NAT or DHCP — it's just an access
point that passes clients through to the MikroTik.

### 2.1 Cabling
- **MikroTik `ether3`  →  a Tenda LAN port** (one of the numbered `1/2/3` ports).
- **Leave the Tenda WAN port empty** (the blue/“WAN”/“Internet” port).

### 2.2 Configure the Tenda F3 N300
Log into the Tenda web UI (default `http://192.168.0.1`, or `tendawifi.com`; admin
password on the label).

**Preferred — if your firmware has an operating-mode switch:**
1. Go to **System Settings → Operating Mode** (or **Working Mode**).
2. Choose **AP Mode** (a.k.a. *Access Point*). This bridges WiFi↔LAN and turns **off**
   the Tenda's DHCP and NAT automatically.
3. Set your **WiFi name (SSID)** and a WiFi password (this is only Wi-Fi access; the
   *internet* login is the captive portal).
4. Save / reboot.

**Fallback — any router without an AP-mode switch (works universally):**
1. **WiFi:** set the SSID + WiFi password under **Wireless Settings**.
2. **Turn OFF the DHCP server:** *DHCP Server → Disable* (critical — otherwise the
   Tenda hands out `192.168.0.x` and clients never reach the MikroTik hotspot).
3. (Optional) change the Tenda **LAN IP** to a free static like `192.168.0.2` so you
   can still log in to manage it later.
4. Do **not** configure the WAN — you're using a LAN port as the uplink.
5. Save / reboot.

### 2.3 Test the hotspot
1. On a phone, join the **Tenda WiFi**.
2. Confirm it got a MikroTik lease: the phone's IP should be **`172.31.0.x`**, gateway
   **`172.31.0.1`** (not `192.168.0.x`).
3. A **captive portal** should pop up (or open a browser to any `http://` site). It's
   served by the MikroTik hotspot → this system's portal.
4. Buy a package (M-Pesa STK — see `MPESA.md`) or redeem a voucher. On success the
   subscriber is authorised and gets internet.

### 2.4 Verify (MikroTik + billing)
On the MikroTik:
```
/ip hotspot host print      ;# your phone's MAC/IP, showing as a host
/ip hotspot active print    ;# appears here once authenticated
```
In the billing UI: *Customers* → filter **Hotspot**, and the **Active sessions**
view should list the online device.

> Note: hotspot customers are **created by the captive portal after payment**, not from
> the admin “Add customer” form (the API rejects creating an *active hotspot* customer
> directly — see `routes/customers.py`). So the portal purchase **is** the creation step.

### 2.5 How a hotspot login actually completes

Worth knowing, because the portal runs on the public internet while the thing that puts
a session online lives on the router:

1. The phone's OS probes a well-known URL. The hotspot intercepts it (this only works
   because those probe hosts are **not** in the walled garden) → "Sign in to network".
2. The router serves `hotspot/login.html`, which it fetched from
   `GET /api/portal/captive-redirect`. That page is a real MikroTik login form posting to
   `$(link-login-only)`, plus a **Buy a package** button.
3. The button opens the portal SPA with the hotspot context attached
   (`?link_login=…&link_orig=…&mac=…&ip=…`). The SPA host is walled-garden allowed.
4. After M-Pesa/voucher succeeds, the SPA shows the credentials **and** a
   **Get online now** button, which returns to the router's login page with
   `?username=&password=`. The page auto-submits and the session goes active.

Steps 2–4 are why a bare redirect page isn't enough: without the form there is nowhere to
submit credentials, and the subscriber stays offline holding a username and password.

### 2.6 Hotspot troubleshooting
| Symptom | Fix |
|---|---|
| Phone gets `192.168.0.x`, no portal | Tenda DHCP still on, or uplink is in the Tenda **WAN** port. Disable Tenda DHCP; move uplink to a **LAN** port (or use AP mode). |
| Phone gets `172.31.0.x` but no portal page | Open `http://neverssl.com` (HTTPS won't trigger a redirect). Check `/ip hotspot print` server is `enabled` on `infora-bridge`. |
| **No "Sign in to network" prompt, and browsing works without paying** | Something reachable before login is answering the phone's captive-probe. Check `/ip hotspot walled-garden print` — it must contain **only** your portal/API host and the Safaricom hosts. `connectivitycheck.gstatic.com`, `captive.apple.com`, `www.msftconnecttest.com` and `www.google.com` must **not** be there: those probes exist to be intercepted, and allowing them tells every device it already has internet. Re-run *Configure services* to rewrite the list. |
| Portal never opens even though DNS "works" | `/ip dns print` → `allow-remote-requests` must be `yes`. A hotspot answers client DNS from the router; without a resolver nothing redirects. Re-import the provisioning one-liner (it now sets this) or run `/ip dns set servers=8.8.8.8,1.1.1.1 allow-remote-requests=yes`. |
| **Captive page opens but is blank** (e.g. `10.20.0.1` white screen) | The router couldn't fetch `hotspot/login.html` because the server URL is a **dev/localhost address it can't reach**. Set `PUBLIC_BASE_URL` + `PORTAL_BASE_URL` to your **public** server/portal URL and `FLASK_ENV=production`, then re-run *Configure services*. `GET /api/health/deployment` now flags this. |
| Bought a package, have credentials, still offline | Use the **Get online now** button on the portal success screen — it returns you to the router's login page and submits for you. Typing them on the MikroTik login form works too. |
| Portal loads but payment/login fails | RADIUS not reaching the server: `/radius monitor 0`; confirm the device is Online (tunnel up). |
| Portal loads but pages/assets blocked | Walled-garden missing your portal host — re-run *Configure services*. |

---

## 3. PART B — PPPoE (create the client, then configure the user router)

Goal: create a PPPoE **customer** in the billing system, then set the user's router to
**dial PPPoE** with that customer's credentials.

Here the credentials come from this system: **username = the customer's email
(lowercased)**, **password = the RADIUS password** generated on creation
(`radius_username()` / `set_customer_radius_password()`).

### 3.1 Make sure you have a PPPoE service plan
*Plans* → create/confirm a plan whose **type is `pppoe`** (speed = the rate-limit the
subscriber gets, e.g. 5M/5M). You'll assign this to the customer.

### 3.2 Create the PPPoE customer (this generates the login)
Admin UI: *Customers → Add customer*
- **Name, Email, Phone** (email becomes the PPPoE **username**).
- **Connection type:** `pppoe`
- **Plan:** the pppoe plan from §3.1
- **Status:** `active` (so RADIUS is provisioned immediately)
- **Password:** leave blank to auto-generate, or type one you want.

On save, the system:
- writes the RADIUS rows (`RadCheck` Cleartext-Password, plan rate-limits, expiry), and
- returns the **`radius_password`** — **copy it now**, it's shown once.

**API equivalent:**
```bash
curl -s -X POST https://<host>/api/customers \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","phone":"0712345678",
       "connection_type":"pppoe","plan_id":5,"status":"active","password":"Secret123"}'
# → { ..., "radius_password": "Secret123", "radius_provisioned": true }
```

So the **PPPoE client credentials** are:
| Field | Value |
|---|---|
| Username | the customer email, lowercased — e.g. `john@example.com` |
| Password | the `radius_password` from creation (e.g. `Secret123`) |
| Service name | `infora` (the MikroTik PPPoE server; user router can leave "service" blank) |

> To look them back up later: the password is stored **encrypted** on the customer
> (`radius_password_encrypted`). Open the client in *Customers → (client) → RADIUS &
> network access* and use **Reveal** to show the stored password, or **Reset** to issue a
> new one (which re-provisions RADIUS and, for an active client, kicks the live session so
> the old password stops working immediately). Same actions over the API:
> `GET /api/customers/<id>/radius-credentials` and
> `POST /api/customers/<id>/radius-credentials/reset`.

### 3.3 Cabling
- **MikroTik `ether5`  →  Tenda WAN port** (the “WAN”/“Internet” port).

### 3.4 Configure the Tenda F3 N300 as a PPPoE client
For PPPoE the Tenda stays a **normal router** (it keeps its own NAT + DHCP for its LAN):
1. Log into the Tenda (`192.168.0.1`).
2. Go to **Internet Settings / WAN Settings**.
3. **Connection Type / Internet Connection Type = `PPPoE`** (sometimes “PPPoE/ADSL”).
4. **PPPoE Username** = the customer email (e.g. `john@example.com`).
5. **PPPoE Password** = the `radius_password` (e.g. `Secret123`).
6. Leave **Service Name** blank (or `infora`), MTU default (1480 is safe for PPPoE).
7. Save / Connect. The Tenda dials the session.
8. (Optional) set the Tenda's **own** WiFi SSID/password under Wireless — its LAN
   clients get internet **through** the PPPoE session (double-NAT, which is normal for
   CPE).

### 3.5 Verify (MikroTik + billing)
On the MikroTik:
```
/ppp active print                         ;# john@example.com session, with an IP 172.31.128.x
/interface pppoe-server server print      ;# service running on infora-bridge
/log print where topics~"pppoe"           ;# dial attempts / auth results
```
In the billing UI: *Customers* → filter **PPPoE** shows the customer; **Active
sessions** lists the live PPPoE session with its Framed-IP.

### 3.6 PPPoE troubleshooting
| Symptom | Fix |
|---|---|
| Tenda: “PPPoE server not found” / no session | Uplink is in the Tenda **LAN** port — move it to **WAN**. Confirm `ether5` is on `infora-bridge` and the PPPoE server is enabled. |
| Tenda: “authentication failed” / “login failed” | First: the customer must be **active with a plan** — a `pending` client has no RADIUS rows on purpose (the create response says so in `radius_provision_reason`). Then check the username is the **exact login** (lowercased email or `radius_login`) and the password matches `radius_password`. If it still fails, watch `docker compose logs -f freeradius` during a dial: an Access-Reject names the reason, and no packet at all means the router isn't a known NAS (`clients.conf`). See §7 for the two config-level causes that produce this for *every* subscriber at once. |
| Dials, authenticates, then drops and redials every few seconds | The bridge has no gateway address, so the session's `local-address` points nowhere. `/ip address print` must show `172.31.0.1/16` on `infora-bridge`; re-run *Configure services*. |
| Session dials then drops | Plan expired, or `/radius monitor 0` shows timeouts (tunnel/RADIUS down). Confirm customer status is **active** and subscription not expired. |
| Connects but no internet | Uplink NAT: the internet port (`ether1`) needs the `infora-masquerade` NAT rule (from provisioning). Check `/ip firewall nat print`. |
| Wrong service picked (portal instead of PPPoE) | The Tenda is in AP/bridge mode — for PPPoE it must be **router mode with WAN=PPPoE**. |

---

## 4. Quick reference

**Addressing (default subnet `172.31.0.0/16`, gateway `172.31.0.1`):**

- Hotspot/DHCP pool: `172.31.0.2–.254`, `172.31.1.1–.254` … 8 × /24 (≈2 000 addresses)
- PPPoE pool: `172.31.128.1–.254`, `172.31.129.1–.254` … 8 × /24

The pools are built one /24 at a time on purpose. A single contiguous range across a
subnet wider than /24 hands out hosts like `172.31.3.255`, and plenty of cheap CPE
firmware treats a last octet of 255 as a broadcast and `DHCPDECLINE`s the offer — the
client re-requests immediately, which looks exactly like the link dropping and
reconnecting every second.

**Names created on the MikroTik:** `infora-bridge`, `infora-pool`, `infora-dhcp`,
`infora` (hotspot + hotspot profile), `infora` (pppoe-server), `infora-pppoe`
(ppp profile), `infora-pppoe-pool`, `infora-masquerade` (NAT), `infora-billing` (radius),
`infora-hotspot-isolate` (firewall: blocks hotspot clients from the router's own
winbox/ssh/api), plus for the Management role: `infora-mgmt-bridge`, `infora-mgmt-pool`,
`infora-mgmt-dhcp`, `infora-mgmt-port` (address/firewall comment); and `infora-wan-dhcp`
(the optional uplink DHCP client).

**Anti-sharing** (`infora-anti-sharing` mangle rule) sets TTL=1 **only on traffic leaving
towards `infora-bridge`**, so a subscriber re-sharing through another router sees it die
at that hop. It must never be left unscoped: an unscoped `postrouting change-ttl` applies
to everything the router sends — including the WireGuard management tunnel — and takes the
whole box off the network.

**PPPoE login:** username = customer email (lowercased); password = `radius_password`
issued at customer creation.

**Downstream router cheat-sheet:**
| Want | User-router mode | Uplink into | Its DHCP | Its NAT |
|---|---|---|---|---|
| Hotspot | AP / dumb bridge | its **LAN** port | **OFF** | off |
| PPPoE | Router, WAN=PPPoE | its **WAN** port | on (default) | on (default) |

**Verify commands:** `/ip hotspot active print`, `/ppp active print`,
`/radius monitor 0`, `/ip firewall nat print`.

---

## 5. (Advanced) Truly isolating a port to one service

The default shared-bridge model above is recommended. If you *must* make, say, `ether3`
hotspot-only and `ether5` PPPoE-only (separate broadcast domains), you'd stop using the
one-bridge layout and instead run **two bridges** (or VLANs) — e.g. a hotspot bridge
with only `ether3` + the hotspot server, and a PPPoE bridge with only `ether5` + the
PPPoE server. This is **not** what the wizard builds and it isn't managed by the app,
so you'd maintain those bridges by hand on the router and keep the uplink/NAT + RADIUS
in place. For almost all deployments the shared bridge (§0) is simpler and correct.

---

## 6. Management port, DHCP client, and WebFig over the VPN

### 6.1 Management port (guaranteed local Winbox/WebFig)

Assign an otherwise-unused ether (e.g. `ether3`) the **Management** role in *Configure
services*. The platform then builds `infora-mgmt-bridge` with a static `192.168.99.1/24`,
its own DHCP server (`infora-mgmt-dhcp`, pool `192.168.99.10–254`), enables `www`/`winbox`/
`ssh`, and adds an input-accept firewall rule for that port. Plug a laptop into `ether3`
→ it leases `192.168.99.x` and reaches **WebFig at `http://192.168.99.1`** and **Winbox at
`192.168.99.1`** — always, independent of the WireGuard tunnel or the internet uplink.

> `192.168.99.x`, not `192.168.88.x`: the latter is RouterOS's factory `defconf` LAN, and
> reusing it collides with the factory config on a fresh board.

### 6.2 Uplink DHCP client (plug-and-play WAN)

Tick **“Uplink gets IP via DHCP”** in *Configure services* to add `/ip dhcp-client` on the
uplink (`infora-wan-dhcp`), so the MikroTik auto-addresses from an upstream router. Leave
it **off** when the WAN has a static IP or itself dials PPPoE upstream. (The provisioning
one-liner still pings `8.8.8.8` first and aborts if the WAN has no internet at all.)

### 6.3 DHCP on the MikroTik vs. on the user router

- **On the MikroTik:** hotspot clients lease from `infora-dhcp` (service subnet, e.g.
  `172.31.0.x`, with the **router itself** as their DNS server so the captive redirect can
  fire); management-port laptops lease from `infora-mgmt-dhcp` (`192.168.99.x`);
  PPPoE clients get their address from the PPPoE pool via RADIUS/`infora-pppoe-pool`.
- **On the user router (Tenda):**
  - **Hotspot → AP/bridge mode, DHCP-client OFF.** The Tenda must *not* run its own DHCP or
    NAT; its clients then lease `172.31.0.x` straight from the MikroTik and see the captive
    portal. A Tenda left in **router mode with WAN=DHCP** takes a single `172.31.x` lease
    and NATs its own LAN behind it — so its clients get internet **without** the portal and
    can reach the MikroTik; that is exactly the “no captive portal” symptom. Fix: AP mode.
  - **PPPoE → router mode, WAN=PPPoE.** The Tenda dials the session with the customer’s
    RADIUS credentials; its own LAN DHCP/NAT stay on (normal double-NAT CPE).

### 6.4 WebFig / Winbox over the platform WireGuard VPN

The router’s web/winbox live on the management tunnel (`10.250.0.x`), which only the
platform reaches — not your browser directly. Two supported ways from the device page:
- **Open WebFig** — one click; the platform proxies your browser to the router’s WebFig
  over the tunnel. If a WebFig skin renders oddly through the proxy, use the client config:
- **Download VPN client config** — a WireGuard `.conf` that puts *your laptop* on the
  management tunnel. Import it into WireGuard, activate, then open the router directly by
  its VPN IP: **WebFig `http://10.250.0.x`**, **Winbox `10.250.0.x:8291`**. Provisioning
  enables `www`/`winbox` and opens ports `80,443,8291,22,8728,8729` from the tunnel, so a
  router provisioned before this change must be **re-provisioned** (re-import the one-liner,
  or run the *Download tunnel script*) to pick up the widened firewall + web service.

> Blank hotspot login page? The router couldn’t fetch `hotspot/login.html` because
> `PUBLIC_BASE_URL`/`PORTAL_BASE_URL` weren’t set to a **public** address it can reach. Set
> them in your production `.env` (`config/deployment/production.env.example`), then re-run
> *Configure services*. The device **self-check** now flags a missing hotspot/PPPoE server
> or login page, so a “configured OK” result no longer hides these.

---

## 7. When *every* subscriber fails at once (FreeRADIUS config)

A per-subscriber problem looks like one CPE failing. When **nobody** can dial — PPPoE and
hotspot alike — suspect the server config, not the accounts. Three causes, all verified
against FreeRADIUS 3.2.10 with `radclient`:

### 7.1 The config directory moved (3.0 → 3.2)

`config/freeradius/Dockerfile` used to build `FROM freeradius/freeradius-server:latest` and
copy everything into `/etc/freeradius/3.0/`. FreeRADIUS **3.0** kept its config there;
**3.2** uses `/etc/freeradius` directly. When `latest` rolled forward, every `COPY` began
creating a directory the server never reads — no SQL module, no `clients.conf`, no site
config — so *every* request was rejected (or dropped as an unknown client).

The image is now pinned (`3.2.10`) and everything targets **`/etc/raddb`**, the symlink
that points at the active config root on both versions. The Dockerfile also greps the
result, so a future path change fails the build instead of shipping a dead config.

The compose bind-mount moved with it:

```yaml
- ./config/freeradius/clients.conf:/etc/raddb/clients.conf:ro
```

### 7.2 `Auth-Type = mschap`, not `MS-CHAP`

3.2's `rlm_mschap` sets `Auth-Type` to its **module instance name**. A site whose
`authenticate` block only has `Auth-Type MS-CHAP { mschap }` logs:

```text
mschap: Found MS-CHAP attributes.  Setting 'Auth-Type = mschap'
Found Auth-Type = mschap
Auth-Type sub-section not found.  Ignoring.
Failed to authenticate the user
```

MikroTik PPPoE negotiates MS-CHAPv2 by default, so this rejects **every PPPoE dial** while
PAP-based hotspot logins for the same subscriber still work — which reads as a per-user
problem. `sites-available/default` now carries the bare `mschap` / `digest` / `eap` entries
alongside the `Auth-Type` blocks, matching the stock 3.2 site.

### 7.3 `sql_user_name` must be set explicitly

`rlm_sql` defaults it to `""`, and with an empty value it never creates `SQL-User-Name`.
Every query then runs as `WHERE lower(username) = lower('')`, matches nothing, and the
subscriber is rejected with no obvious reason. `mods-available/sql` now sets:

```text
sql_user_name = "%{%{Stripped-User-Name}:-%{User-Name}}"
```

### 7.4 Verifying a fix

Watch a real dial, or reproduce it locally:

```bash
docker compose logs -f freeradius          # then dial from the CPE
docker compose build freeradius && docker compose up -d freeradius   # after any change here
```

A healthy MS-CHAPv2 accept looks like this — note **`MS-CHAP2-Success`**, whose absence is
what a CPE reports as "login failed" even though the server said Accept:

```text
mschap: Found Cleartext-Password, hashing to create NT-Password
mschap: Client is using MS-CHAPv2
mschap: Adding MS-CHAPv2 MPPE keys
Sent Access-Accept ... length 212
  Mikrotik-Rate-Limit = "10M/10M"
  MS-CHAP2-Success = 0x01533d...
  MS-MPPE-Recv-Key / MS-MPPE-Send-Key
```

An Accept of ~53 bytes with no `MS-CHAP2-Success` means an `Auth-Type := Accept` row is
still in `radgroupcheck` — it bypasses password checking entirely *and* starves MS-CHAPv2
of its authenticator response. `purge_auth_type_accept_rows()` clears those at boot.

---

## 8. Live hardware acceptance test

Everything above is verified in CI/simulation except the RouterOS side. Run this on one
provisioned MikroTik, in order — each step isolates a different failure.

| # | Test | Expected | If it fails |
|---|---|---|---|
| 1 | **DNS.** Join the hotspot, check the client's DNS server | the **MikroTik's bridge IP** (`172.31.0.1`), not `8.8.8.8` | Client is on a stale lease. Leases are 1 h; "forget network" or wait it out. If a fresh lease still says 8.8.8.8, the `dhcp` step didn't apply |
| 2 | **CPD.** Connect an iPhone *and* an Android | both show "Sign in to network" within ~10 s | Re-check `/ip hotspot walled-garden print` — the probe hosts must **not** be there (§2.5). Also `/ip dns print` → `allow-remote-requests=yes` |
| 3 | **Redirect.** Tap the notification | lands on our login page, not MikroTik's stock one | `/ip hotspot profile print` → `html-directory=hotspot`, and `/file print` shows `hotspot/login.html`. Both are covered by the apply-time verification |
| 4 | **Auth.** Buy a package, tap **Get online now** | POSTs to `$(link-login-only)`, device gets internet, session in `/ip hotspot active print` | Check the RADIUS side first (§7.4) — the portal round trip only carries credentials, it doesn't authenticate |
| 5 | **Negative.** Browse `http://neverssl.com` unpaid on a laptop | redirects to the portal | A `fasttrack-connection` rule short-circuits the hotspot. `configure_services` strips it and verifies it's gone |
| 6 | **HTTPS block.** Browse `https://example.com` unpaid | times out or resets — **not** loaded | Same as 5. A hotspot cannot intercept HTTPS (no cert), and that block *is* the captive signal — do not "fix" it by allowing 443 |

Steps 5 and 6 are the ones that catch a silently-open hotspot. Test them from a laptop, not
a phone: a phone that has already cached a captive-portal verdict will behave differently.

> The apply-time verification covers 1, 3, 5 and the walled garden — a green **Router is
> live** now means those were read back off the router, not merely commanded. Steps 2, 4
> and 6 need real client hardware.
