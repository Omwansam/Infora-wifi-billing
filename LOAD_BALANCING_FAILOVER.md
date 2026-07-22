# Dual‑WAN Load Balancing & Failover — Design Discussion

**Status:** discussion / design only. Nothing here is wired into the app yet. This
document works out *the best way* to add an optional **two‑uplink load‑balancing +
failover** feature to the Infora billing system, delivered the same way we already
deliver router config: a **one‑shot `.rsc` script** the operator runs once (or that the
system pushes over the management tunnel), after which "everything just works."

Scenario the operator asks for: **WAN1 on `ether1`, WAN2 on `ether3`**, two internet
connections that should (a) share load and (b) fail over to each other so a single ISP
outage doesn't take the network down.

---

## 0. TL;DR / recommendation

- Offer **one feature with three modes**, chosen by the operator per router:
  1. **Failover only** (primary/backup) — simplest, safest. Ship this first.
  2. **Load balance + failover** — PCC (Per‑Connection Classifier) split with automatic
     failover. Best fit for our workload (many hotspot/PPPoE clients = many connections).
  3. **Off** (current single‑WAN behaviour) — the default.
- Use **PCC** for balancing (not ECMP): it is sticky per connection, so HTTPS/M‑Pesa/bank
  sessions don't break mid‑stream, and it degrades gracefully to failover.
- Use **recursive routes with `check-gateway=ping`** to a public probe host per WAN for
  failover, so we detect *upstream* outages (ISP down but link still up), not just a dead
  local gateway.
- Make WAN NAT **per‑interface masquerade**, keep **FastTrack removed** (we already remove
  it — PCC needs every packet in the firewall path), and let **router‑originated traffic
  (RADIUS + WireGuard management tunnel) ride the main‑table failover default** so the
  billing plane survives a WAN flip.
- Deliver it as a **device action mirroring "Configure services"**: a generator
  `build_load_balancing_script(device, config)` in
  [`services/provisioning_scripts.py`](backend/server/services/provisioning_scripts.py),
  a GET script endpoint (like `deviceRadiusScript`) **and** a push endpoint (like
  `configure-services`), a small `wan_config` JSON stored on the device, and a
  `DualWanPanel` in the UI. Everything tagged `comment="infora-lb"` so it is idempotent
  and cleanly removable.

The single biggest gotcha is **`ether3` is currently a LAN bridge port**, not a WAN — see
§1. The feature has to reclaim it.

---

## 1. Where this collides with the current router layout (read first)

Today the wizard's **Configure services** builds *one bridge* and runs both services on it
(`build_services_commands` in
[`services/device_config_ops.py`](backend/server/services/device_config_ops.py)), while
`ether1` is the lone uplink with a single blanket masquerade
(`build_radius_script` in
[`services/provisioning_scripts.py`](backend/server/services/provisioning_scripts.py)):

```text
Internet ─▶ ether1 (UPLINK, NAT masquerade, NOT bridged)
                 │
        ┌────────┴───────────────────────────┐
        │      infora-bridge (172.31.0.1)     │
        │  hotspot (infora) + PPPoE (infora)  │
        └──┬──────────────┬──────────────┬────┘
        ether3         ether5         etherX   ← bridge ports (LAN)
```

So **`ether3` is a LAN port on `infora-bridge` in the default build.** Turning it into a
second WAN means:

1. **Remove `ether3` from `infora-bridge`** (`/interface bridge port remove [find
   interface=ether3]`) before configuring it as WAN2.
2. The operator loses one downstream LAN port. That's usually fine (they still have
   `ether5…`), but the UI must make the trade explicit and refuse if `ether3` is the *only*
   remaining bridge port.
3. **Order of operations matters:** run **Configure services first**, then **Dual‑WAN**.
   The LB script assumes `infora-bridge` already exists (it marks LAN‑originated traffic by
   `in-interface=infora-bridge`).

> Corollary: the blanket `infora-masquerade` rule (no `out-interface`) must be replaced by
> **per‑WAN masquerade** (§4/§5) or WAN2 traffic will be NATed incorrectly / inter‑WAN
> leakage becomes possible.

---

## 2. Goals & requirements

| # | Requirement | Why it matters here |
|---|---|---|
| G1 | Balance many subscribers' traffic across 2 uplinks | Aggregate throughput for a hotspot/PPPoE site with dozens of clients |
| G2 | Automatic failover both directions | Either ISP can drop; the other carries everyone until it returns |
| G3 | **Sticky per connection** | A payment/bank/HTTPS session must not swap source IP mid‑flow |
| G4 | **Billing plane survives failover** | RADIUS auth+accounting and the WireGuard management tunnel to the billing server must reconverge on the surviving WAN |
| G5 | One‑shot, idempotent, reversible | Paste‑once `.rsc`; re‑runnable; removable without bricking the router |
| G6 | Works on the CPE tiers we onboard | RouterOS v6 **and** v7 (mangle dual‑WAN syntax differs — §5.4) |
| G7 | Handle DHCP / static / PPPoE WAN types | Real uplinks are a mix; DHCP gateways are dynamic (§6) |

Non‑goals (call out to the user): true **per‑packet** bonding (needs same‑ISP MLPPP/BGP or
an aggregation box — not achievable with two independent consumer links), and **session
survival across a failover** (a live download on WAN1 drops when WAN1 dies; new connections
go to WAN2 — this is inherent to L3 failover).

---

## 3. The RouterOS techniques, compared (deep)

### 3.1 ECMP — `gateway=GW1,GW2` (❌ not recommended)
One route with two gateways. RouterOS caches the chosen gateway *per src/dst pair* for ~10
minutes, so balancing is coarse and "sticky in a bad way." Its historical bugs around
recursive next‑hops and **route flapping on failover** make it fragile. Simple to write,
painful to operate. Skip it.

### 3.2 PCC — Per‑Connection Classifier (✅ recommended for balancing)
Mangle marks each **new** connection into one WAN by hashing chosen fields
(`per-connection-classifier=both-addresses:2/0` and `:2/1` for a 2‑way split). Because the
mark is on the *connection*, every packet of that flow stays on the same WAN → **G3
satisfied**. Ratios support unequal links (§8). This is the standard MikroTik dual‑WAN
load‑balancer and the right default for us because our traffic is *many* independent client
connections, which is exactly what PCC spreads well.

### 3.3 Recursive routing + `check-gateway` (✅ recommended for failover)
Failover is a *routing* decision layered under PCC:
- **Distances**: main‑table default via GW1 `distance=1`, via GW2 `distance=2`. Lower wins;
  if it's withdrawn, the higher takes over.
- **`check-gateway=ping`** withdraws a route when its gateway stops answering.
- **Recursive probe** (the robust part): pin a public host to each WAN with a `/32` route
  (`8.8.8.8` via GW1, `1.0.0.1` via GW2) and make the default *recursive* through that
  probe. Now "is WAN1 healthy?" means "can I reach the internet through WAN1?", catching
  **upstream ISP failure**, not just a dead local gateway.

### 3.4 Netwatch scripts (⚙️ optional escalation)
`/tool netwatch` can run up/down scripts (swap routes, send a log, notify). We already use
netwatch for the tunnel watchdog in
[`build_radius_script`](backend/server/services/provisioning_scripts.py) (`infora-wg-watchdog`).
Useful as a **notifier** ("WAN2 down") and to nudge WireGuard to rehandshake on flip, but
not required for the core failover — recursive routing handles that itself.

**Verdict:** PCC (balance) + recursive/`check-gateway` (failover), with netwatch purely for
notifications and a WG kick. Failover‑only mode = the same routing minus the PCC mangle.

---

## 4. Recommended architecture

```text
        ether1 (WAN1) ─▶ ISP A            ether3 (WAN3=WAN2) ─▶ ISP B
             │  mark: WAN1_conn                 │  mark: WAN2_conn
             └──────────────┬──────────────────┘
                     routing tables
             to_WAN1 (→GW1)   to_WAN2 (→GW2)      ← marked LAN connections (PCC split)
             main default: GW1 d1 / GW2 d2        ← router-originated + failover
                            │
                   infora-bridge (LAN, PCC classifies NEW conns here)
                            │
                 hotspot + PPPoE clients (unchanged)
```

Four moving parts, all tagged `infora-lb`:

1. **Reply/inbound stickiness (mangle input+output):** connections *arriving* on a WAN get
   that WAN's connection‑mark; their replies get the matching routing‑mark so they leave the
   same WAN.
2. **LAN split (mangle prerouting):** new connections from `infora-bridge` are PCC‑marked
   `WAN1_conn`/`WAN2_conn`, then routing‑marked `to_WAN1`/`to_WAN2`.
3. **Routing:** two marked default routes (one per table) + a main‑table failover default
   (distance 1/2, recursive `check-gateway=ping`).
4. **NAT:** one masquerade **per WAN out‑interface** (replaces the blanket
   `infora-masquerade`).

Router‑originated traffic (RADIUS packets, the WireGuard handshake to the billing server,
DNS) is **not** marked (it isn't `in-interface=infora-bridge`), so it follows the **main
table failover default** → **G4 satisfied**: kill WAN1 and the tunnel/RADIUS reconverge on
WAN2.

---

## 5. The one‑shot `.rsc` (annotated template)

Placeholders (`{{…}}`) are filled by the generator from the operator's `wan_config`. Shown
for **static/known gateways**; DHCP/PPPoE variants in §6. RouterOS **v7** syntax with v6
notes in §5.4.

### 5.1 WAN interfaces + reclaim ether3
```rsc
# --- infora-lb: reclaim ether3 from the bridge, define WANs ---
/interface bridge port remove [find interface={{wan2_port}}]        ;# ether3 → WAN2
# (static example; DHCP/PPPoE — see §6)
/ip address remove [find comment="infora-lb"]
/ip address add interface={{wan1_port}} address={{wan1_ip}} comment="infora-lb"
/ip address add interface={{wan2_port}} address={{wan2_ip}} comment="infora-lb"
```

### 5.2 Mangle (marking) — the heart of PCC
```rsc
/ip firewall mangle
:do { remove [find comment="infora-lb"] } on-error={}

# Replies to connections that CAME IN a WAN must go back out the same WAN
add chain=input  in-interface={{wan1_port}} action=mark-connection \
    new-connection-mark=WAN1_conn passthrough=yes comment="infora-lb"
add chain=input  in-interface={{wan2_port}} action=mark-connection \
    new-connection-mark=WAN2_conn passthrough=yes comment="infora-lb"
add chain=output connection-mark=WAN1_conn action=mark-routing \
    new-routing-mark=to_WAN1 comment="infora-lb"
add chain=output connection-mark=WAN2_conn action=mark-routing \
    new-routing-mark=to_WAN2 comment="infora-lb"

# LAN → internet: split NEW connections across the two WANs (2-way PCC)
add chain=prerouting in-interface=infora-bridge connection-state=new \
    dst-address-type=!local action=mark-connection new-connection-mark=WAN1_conn \
    per-connection-classifier=both-addresses:2/0 passthrough=yes comment="infora-lb"
add chain=prerouting in-interface=infora-bridge connection-state=new \
    dst-address-type=!local action=mark-connection new-connection-mark=WAN2_conn \
    per-connection-classifier=both-addresses:2/1 passthrough=yes comment="infora-lb"
# Give marked LAN connections their routing table
add chain=prerouting in-interface=infora-bridge connection-mark=WAN1_conn \
    action=mark-routing new-routing-mark=to_WAN1 comment="infora-lb"
add chain=prerouting in-interface=infora-bridge connection-mark=WAN2_conn \
    action=mark-routing new-routing-mark=to_WAN2 comment="infora-lb"
```

### 5.3 Routing tables + failover
```rsc
/routing table
:do { add name=to_WAN1 fib comment="infora-lb" } on-error={}
:do { add name=to_WAN2 fib comment="infora-lb" } on-error={}

/ip route
:do { remove [find comment~"infora-lb"] } on-error={}

# Per-WAN default routes used by PCC-marked LAN traffic
add dst-address=0.0.0.0/0 gateway={{gw1}} routing-table=to_WAN1 check-gateway=ping comment="infora-lb"
add dst-address=0.0.0.0/0 gateway={{gw2}} routing-table=to_WAN2 check-gateway=ping comment="infora-lb"

# Recursive failover for main table (router-originated + unmarked + failover)
add dst-address={{probe1}}/32 gateway={{gw1}} scope=10 comment="infora-lb-probe"   ;# e.g. 8.8.8.8
add dst-address={{probe2}}/32 gateway={{gw2}} scope=10 comment="infora-lb-probe"   ;# e.g. 1.0.0.1
add dst-address=0.0.0.0/0 gateway={{probe1}} distance=1 check-gateway=ping target-scope=11 comment="infora-lb"
add dst-address=0.0.0.0/0 gateway={{probe2}} distance=2 check-gateway=ping target-scope=11 comment="infora-lb"
```
For **failover‑only mode**, ship §5.3 (and swap distances to set the primary) and **omit
§5.2's PCC split** — inbound/reply marks stay so port‑forwards/hotspot replies behave.

### 5.4 NAT + hygiene
```rsc
/ip firewall nat
:do { remove [find comment="infora-masquerade"] } on-error={}   ;# drop the blanket rule
:do { remove [find comment="infora-lb"] } on-error={}
add chain=srcnat out-interface={{wan1_port}} action=masquerade comment="infora-lb"
add chain=srcnat out-interface={{wan2_port}} action=masquerade comment="infora-lb"

# FastTrack must stay OFF (PCC needs every packet in the firewall path).
:do { /ip firewall filter remove [find action=fasttrack-connection] } on-error={}

# Nudge the management tunnel to rehandshake fast after a WAN flip
/interface wireguard peers set [find comment~"infora"] persistent-keepalive=25s
```

**v6 vs v7:** v7 uses `/routing table` + route option `routing-table=`. **v6** has no
`/routing table`; use route option `routing-mark=to_WAN1` and mangle
`new-routing-mark=…` (already what we write). The generator branches on
`device.routeros_version` (we already detect/track firmware) and emits the right form,
guarding every line with `:do {…} on-error={}` exactly like the existing scripts.

---

## 6. WAN types — DHCP, static, PPPoE (the dynamic‑gateway problem)

The template above assumes **known gateways**. Reality:

- **Static:** operator supplies IP + gateway → straightforward (§5).
- **DHCP:** the gateway is learned, not known at script time. Two clean options:
  - `/ip dhcp-client add interface=ether1 add-default-route=no` and a small
    dhcp‑client **script** that writes the learned gateway into the `infora-lb` routes on
    lease bind/renew (so the two default routes always track the ISP's current gateway).
  - Or use interface‑scoped recursion where supported. The DHCP‑client‑script approach is
    the reliable, well‑trodden one; the generator emits it when the WAN type is `dhcp`.
- **PPPoE‑WAN** (this router itself dials a PPPoE upstream — distinct from our PPPoE
  *server* for subscribers): use `gateway=pppoe-out1` (point‑to‑point, no ARP gateway
  needed), `check-gateway=ping`, and remember **MTU 1480 / MSS clamping**
  (`/ip firewall mangle add chain=forward action=change-mss ...`) so PMTU black‑holes don't
  break HTTPS.

The `wan_config` therefore stores a **type per WAN** (`static|dhcp|pppoe`) and the generator
picks the matching stanza.

---

## 7. Billing‑system‑specific concerns (don't skip)

1. **RADIUS auth + accounting survive failover (G4).** RADIUS is router‑originated → main
   table → recursive failover default. When WAN1 dies, RADIUS re‑targets WAN2. The
   `src-address` we pin in `build_radius_script` is the **WireGuard tunnel IP** (internal),
   not a WAN IP, so it's unaffected — good. Accounting `interim-update=5m` keeps sessions
   fresh across the flip.
2. **Management WireGuard tunnel.** Its endpoint is the billing server's public IP, reached
   via the main default route. On failover it must **rehandshake** over the new WAN — set
   `persistent-keepalive` (≈25s) so recovery is seconds, not minutes. Our existing
   `infora-wg-watchdog` netwatch already logs tunnel up/down; extend it to also log WAN
   transitions.
3. **Don't PCC‑split the billing/management traffic.** Because PCC marking is scoped to
   `in-interface=infora-bridge`, control‑plane traffic is naturally excluded. If an operator
   wants the tunnel *pinned* to the more reliable WAN (e.g. keep RADIUS on the fibre, balance
   only client traffic), add an explicit mangle exception marking the WG endpoint / RADIUS
   host to `to_WAN1` **above** the failover default — offer this as an advanced toggle.
4. **FastTrack stays removed.** Already true in provisioning; the LB script re‑asserts it.
5. **Hotspot & PPPoE server unaffected.** They live on `infora-bridge`; subscriber auth,
   pools, DHCP, and the captive portal don't change. Only the *upstream* path changes.
6. **Hairpin / port‑forwards** (if any) must reference the correct WAN; the inbound
   connection‑mark rules keep replies symmetric.
7. **CGNAT reality check:** if either ISP is CGNAT, inbound/port‑forward won't work on that
   WAN, but **outbound balancing + failover still works** — worth stating in the UI.

---

## 8. Unequal links & weighting

Two independent knobs:
- **PCC ratio** for outbound balance: e.g. a 30M + 10M pair ≈ 3:1 → four classifier buckets
  `3/0,3/1,3/2` → WAN1 and `3/… →` WAN2 (generator computes buckets from the two
  `weight` values in `wan_config`).
- **Failover priority**: which WAN is primary (distance 1) for router‑originated traffic.

Expose as: `mode`, `wan1.weight`, `wan2.weight`, `primary_wan`, plus health‑probe hosts.

---

## 9. Product integration — how it becomes a user‑facing option

Mirror the **Configure services** pattern exactly (that flow already generates *and* pushes
router config), so there's nothing new to learn operationally.

**Data model** — store the choice on the device (reuse the device‑service‑config JSON
pattern from migration `f6a7b8c9d0e1`, or add a `wan_config` JSON column /
`DeviceWanConfig` row):
```jsonc
{
  "enabled": true,
  "mode": "load_balance",          // off | failover | load_balance
  "wan1": { "port": "ether1", "type": "dhcp",   "weight": 1 },
  "wan2": { "port": "ether3", "type": "static", "ip": "…", "gateway": "…", "weight": 1 },
  "primary_wan": "wan1",
  "probe_hosts": ["8.8.8.8", "1.0.0.1"],
  "pin_management_to": null         // null | wan1 | wan2  (advanced)
}
```

**Backend**
- `build_load_balancing_script(device, config)` in
  [`services/provisioning_scripts.py`](backend/server/services/provisioning_scripts.py) —
  pure generator (v6/v7 aware, idempotent, `infora-lb` tagged), unit‑testable like the
  existing script builders.
- Optional `build_load_balancing_commands(...)` in
  [`services/device_config_ops.py`](backend/server/services/device_config_ops.py) for the
  **push** path (over the WG tunnel via `MikroTikClient`), plus a **remove** builder for
  rollback.
- Routes in [`routes/devices.py`](backend/server/routes/devices.py):
  - `GET /api/devices/<id>/load-balancing-script` → returns the `.rsc` to copy/paste
    (parallels `deviceRadiusScript`).
  - `POST /api/devices/<id>/configure-load-balancing` → validates `wan_config`, persists it,
    pushes (parallels `configure-services`).
  - `POST /api/devices/<id>/load-balancing/disable` → pushes the remove‑by‑comment script.
- Add the endpoints to `API_ENDPOINTS` and a `deviceService` method, matching the current
  device‑script wiring.

**Frontend** — a `DualWanPanel` beside
[`ConfigureServicesPanel.jsx`](FRONTEND/infora_billing/src/components/devices/ConfigureServicesPanel.jsx)
(and/or a wizard step): pick ports, mode, WAN types, weights, primary, probe hosts; live
warnings for the `ether3`‑is‑a‑bridge‑port conflict; a **"Copy .rsc"** button and an
**"Apply now"** (push) button; a status/health readout.

**Delivery = "run once and it works":** operator either pastes the `.rsc` in the router
terminal **or** clicks *Apply now* and we push over the tunnel. Re‑runs are safe (everything
keyed on `comment="infora-lb"`), and *Disable* strips it back to single‑WAN.

---

## 10. Verification & monitoring

```rsc
/ip route print where comment~"infora-lb"      ;# active default = lower distance; blue=active
/ip firewall mangle print stats where comment="infora-lb"   ;# both WAN buckets taking hits
/ip firewall connection print                  ;# connections spread across both WANs
/ping 8.8.8.8 interface={{wan1_port}}          ;# per-WAN reachability
/tool traceroute 8.8.8.8                        ;# confirm exit path
```
Failover test: unplug WAN1 → within a few `check-gateway` cycles the WAN2 default goes
active, tunnel rehandshakes, RADIUS keeps flowing; replug → traffic rebalances. Surface a
**dual‑WAN health card** on the device detail page (per‑WAN up/down, active default,
last flip time) fed by the data we already poll (netwatch state / SNMP / self‑check).

## 11. Rollback / disable
`remove [find comment~"infora-lb"]` across `/ip route`, `/ip firewall mangle`,
`/ip firewall nat`, `/ip address`, `/routing table`, re‑add the blanket
`infora-masquerade`, and (optionally) return `ether3` to `infora-bridge`. Ship this as the
`load-balancing/disable` script so the UI toggle is truly reversible.

## 12. Edge cases & caveats to put in front of the operator
- **One big download won't exceed one link's speed** — PCC balances *connections*, not
  packets. Many users → great aggregate; single flow → capped at one WAN.
- **Live sessions drop on failover** (new ones use the survivor) — inherent to L3 failover.
- **Same‑ISP two lines** balance fine but share fate if the ISP core fails.
- **DNS:** let clients use the router (`172.31.0.1`) as resolver so lookups follow the
  active WAN; avoid hard‑coding a resolver only reachable via one ISP.
- **IPv6** is out of scope for v1 (dual‑stack dual‑WAN is a separate, harder problem).
- **MSS clamping** required on any PPPoE WAN.
- **v6 vs v7** mangle/route syntax divergence — the generator must branch (§5.4).

---

## 13. Suggested rollout
1. **Failover‑only** mode (routing + per‑WAN NAT + reclaim `ether3`), static & DHCP WAN,
   copy‑`.rsc` delivery, disable script. Lowest risk, covers most "second line as backup."
2. **Load‑balance** mode (add PCC mangle + ratios) and the **push/Apply‑now** path.
3. **Advanced**: management‑pin toggle, PPPoE‑WAN, health dashboard, netwatch notifications.

## 14. Open questions for the user
- Is `ether3`‑as‑WAN2 acceptable given it's a **LAN bridge port** today, or should WAN2
  default to a different free port and `ether3` stay LAN?
- Do you want the **billing/management tunnel pinned** to one WAN, or riding failover
  (recommended default)?
- WAN types to support in v1: **DHCP + static** first, add **PPPoE‑WAN** later?
- Delivery preference: **copy‑paste `.rsc` only**, or also **push over the tunnel** like
  Configure services (recommended)?
- Balancing ratio: **equal 1:1** default, with optional weights — good?
