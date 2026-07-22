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

### 2.5 Hotspot troubleshooting
| Symptom | Fix |
|---|---|
| Phone gets `192.168.0.x`, no portal | Tenda DHCP still on, or uplink is in the Tenda **WAN** port. Disable Tenda DHCP; move uplink to a **LAN** port (or use AP mode). |
| Phone gets `172.31.0.x` but no portal page | Open `http://neverssl.com` (HTTPS won't trigger a redirect). Check `/ip hotspot print` server is `enabled` on `infora-bridge`. |
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
| Tenda: “authentication failed” | Username must be the **exact lowercased email**; password must match the `radius_password`. Re-check by editing the customer and setting a known password. |
| Session dials then drops | Plan expired, or `/radius monitor 0` shows timeouts (tunnel/RADIUS down). Confirm customer status is **active** and subscription not expired. |
| Connects but no internet | Uplink NAT: the internet port (`ether1`) needs the `infora-masquerade` NAT rule (from provisioning). Check `/ip firewall nat print`. |
| Wrong service picked (portal instead of PPPoE) | The Tenda is in AP/bridge mode — for PPPoE it must be **router mode with WAN=PPPoE**. |

---

## 4. Quick reference

**Addressing (default subnet `172.31.0.0/16`, gateway `172.31.0.1`):**
- Hotspot/DHCP pool: `172.31.0.2 – 172.31.127.255`
- PPPoE pool: `172.31.128.0 – 172.31.255.254`

**Names created on the MikroTik:** `infora-bridge`, `infora-pool`, `infora-dhcp`,
`infora` (hotspot + hotspot profile), `infora` (pppoe-server), `infora-pppoe`
(ppp profile), `infora-pppoe-pool`, `infora-masquerade` (NAT), `infora-billing` (radius).

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
