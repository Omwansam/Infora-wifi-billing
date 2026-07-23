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



Two documents, two different jobs — and read side by side, the Infora design actually validates most of what your lab proved, while differing where the requirements differ, not where one is right and the other wrong. Here's the analysis.

Where they agree — and that agreement is your strongest evidence

The Infora doc lands independently on the same failover core you built and tested:

Recursive routes with pinned /32 probe host routes + check-gateway=ping for failover, explicitly because it catches upstream ISP failure rather than just a dead local gateway. That's exactly your ISP1→9.9.9.9 / ISP2→1.0.0.1 pinning.
Distance ordering (1 primary, 2 backup) as the failover mechanism, with the routing engine in control.
Netwatch as notifier only — not as the thing that swaps routes. Same conclusion you reached, and your RADIUS blackhole incident is the practical proof of why: control-plane scripting making data-plane decisions strands you.
Per-WAN masquerade replacing any blanket rule, for the same asymmetric-NAT reason.
Router-originated traffic (RADIUS, management tunnel) rides the main-table failover default, deliberately unmarked. Your setup does this too — the mangle chain is prerouting only, so probes/DHCP/OVPN aren't marked.
Idempotent, comment-tagged, one-shot .rsc with a matching remove-by-comment rollback. Their infora-lb tag is your PBR:/WAN1:/WAN2:/MONITOR: convention.
Same edge cases: no session survival across failover, MSS clamping on PPPoE WANs, DNS should follow the active WAN.

When two independently-derived designs converge this hard on the failover layer, that layer is settled. Your production RB5009 file can be written with confidence.

Where they diverge — and why both are correct

The split is entirely about classification, and it traces to different goals:

	Infora	Yours
Goal	Aggregate throughput across two links	Send specific apps to a specific link
Classifier	PCC hash on new connections	Meta AS32934 address-list + per-subscriber list
FastTrack	Removed entirely (PCC needs every packet)	Kept, constrained to connection-mark=no-mark

Infora is right that PCC is the correct tool for "many clients, want more total bandwidth." You're right that PCC is the wrong tool for "WhatsApp goes here" — PCC has no concept of destination or subscriber identity, and you established that early. These aren't competing answers; they're different modes of the same feature, which is precisely how Infora frames it (§0: three modes — off / failover-only / load-balance). Your design is effectively a fourth mode: app-and-subscriber steering, sharing the same failover substrate.

That's the solidifying insight: one skeleton, swappable classifier.

COMMON SUBSTRATE (proven in your lab, independently confirmed by Infora)
  ├─ per-WAN masquerade
  ├─ probe /32 host routes + blackholes
  ├─ recursive defaults, distance-ordered, check-gateway=ping
  ├─ routing tables per WAN
  ├─ netwatch = monitoring only
  └─ comment-tagged, idempotent, removable

CLASSIFIER (choose one)
  ├─ none              → failover-only
  ├─ PCC hash          → load-balance          (Infora)
  └─ address-list      → app/subscriber steer  (yours)
Three things Infora has that your build should adopt

1. FastTrack: your approach is strictly better. Infora removes FastTrack entirely because PCC needs every packet. But you only need the marked subset out of the fast path — so connection-mark=no-mark on the fasttrack rule keeps acceleration for the 95%+ of traffic that isn't Meta. On an RB5009 with hundreds of subscribers that's a meaningful CPU difference. Keep yours; it's the more surgical version.

2. The DHCP-gateway problem — you solved it the way they recommend. Infora §6 flags dynamic gateways as the hard case and prescribes a dhcp-client script that rewrites the routes on lease bind. That's exactly your WAN2: ISP2 DHCP lease script maintaining the 1.0.0.1 probe route. Independent confirmation your approach is the well-trodden one.

3. Two items worth stealing outright:

WireGuard/tunnel persistent-keepalive=25s so the management tunnel rehandshakes in seconds after a WAN flip. Your OVPN-to-RADIUS tunnel has the same exposure — and you lived this failure. Worth the equivalent setting.
Inbound/reply stickiness rules (mangle input + output chains marking connections that arrive on a WAN so replies leave the same WAN). Your chain is prerouting-only. You don't need this today because nothing inbound terminates on the router, but the moment you add a port-forward or anything reachable from outside, you will. Note it as a production addition.
One item Infora got wrong for your case, and one it got right that you hit the hard way

Wrong for you: their §5.3 puts probe routes at plain scope=10 with target-scope=11 but no blackhole. Your blackholes are the safety net that stops a probe leaking out the wrong WAN and falsely reporting health. Keep them — with the caveat you learned painfully.

Right, and you paid for it: §11's rollback explicitly removes routes and restores the prior state. Your RADIUS blackhole outage happened because a distance-200 blackhole outlived the tunnel outage it was meant to cover and then shadowed the recovered route. The production lesson: any blackhole must be paired with a guaranteed-present real route, or bound to the interface rather than left standing alone. Your fix — 10.9.0.0/24 gateway=ovpn-out1, interface-bound — is the correct pattern and should go into the RB5009 file instead of the blackhole.

What this means concretely for your production file

Nothing in the Infora document changes your design. It confirms the failover substrate, isolates the classifier as the only genuine difference, and contributes four refinements: tunnel keepalive, inbound stickiness rules (for later), interface-bound tunnel route instead of a standing blackhole, and the mode-selection framing.

If the Infora system is something you're also building or will use to manage these routers, the practical implication is bigger: your app-steering config should be expressed as a third mode in that same generator, sharing the substrate and the comment= tagging, rather than as a separate hand-maintained script. Same rollback path, same idempotency, same UI.

Which raises the question worth answering before I cut the RB5009 file: is Infora your billing system — the one whose maintenance took FreeRADIUS down — and do you want the production PBR config shaped to slot into that generator pattern, or delivered as a standalone .rsc like the lab one?


The Name

Application-Steered Dual-WAN with Recursive Failover — or in shorthand, App-Steered PBR.

If you want something shorter for internal use: Selective WAN Steering. If you want it to sit alongside the Infora modes (off / failover / load-balance), call it app_steer mode — that's the naming that lets it slot into the same generator as a fourth option.

The Explanation (short version)

You have two internet lines. Instead of splitting traffic randomly between them, you decide which apps use which line — and if either line dies, the other picks up its work automatically.

That's it. Three sentences longer:

What it does. Normal browsing goes out ISP1. WhatsApp, Facebook and Instagram go out ISP2. If ISP2 dies, those apps quietly fall back to ISP1. If ISP1 dies, everything falls back to ISP2. When either line recovers, traffic returns to where it belongs — no manual intervention, ever.

How it decides. Meta owns its own network (AS32934), so the router recognises WhatsApp/Facebook/Instagram simply by destination IP — no deep inspection, no CPU cost, works even with encrypted traffic and QUIC. There's a second lever too: a whole subscriber can be assigned to ISP2 (all their traffic, not just Meta), which RADIUS sets automatically per customer.

How it fails over. Not by scripts watching things and flipping switches — by the routing engine itself. Each line has a "canary" IP pinned to it; if the router can't reach that canary through that line, the routing table withdraws the route and the backup takes over. Monitoring exists only to write logs, never to change routing. That separation is what makes it trustworthy.

Why the name matters

"Load balancing" is the wrong word for this and will mislead anyone you hand it to — load balancing means spreading traffic to get more bandwidth, and this design deliberately doesn't do that. It sends specific traffic to a specific line for policy reasons: cost, quality, contention, or because ISP2 is a cheaper social-media bundle. The bandwidth is a side effect, not the goal.

Steering is the honest word: you're directing named traffic to a chosen path. Pair it with recursive failover (the routing technique) and you have a name that tells a network engineer exactly what's inside without them reading a line of config.

One-line elevator version, if you need to explain it to a non-technical stakeholder: "Social apps ride the second line, everything else rides the main line, and either line covers for the other automatically."

i can implement the 2 differently thea user can choose the type of script  to download and use in loadbalancing

That's the right call, and it's the same conclusion the Infora doc reached independently (§0: one feature, three modes). You'd be adding a fourth. The reason it works is that the two scripts aren't really two different things — they're one substrate with a swappable classifier:

SHARED SUBSTRATE (identical in every mode)
  ├─ reclaim the WAN2 port / define both uplinks
  ├─ per-WAN masquerade (never a blanket rule)
  ├─ probe /32 host routes per WAN
  ├─ recursive defaults, distance-ordered, check-gateway=ping
  ├─ per-WAN routing tables
  ├─ netwatch = logging + safe recovery only
  └─ comment-tagged, idempotent, remove-by-comment rollback

CLASSIFIER (this is the ONLY part that changes)
  ├─ mode: failover      → no classifier at all
  ├─ mode: load_balance  → PCC hash on new connections
  └─ mode: app_steer     → Meta address-list + ISP2-SUBS subscriber list

So in the UI it's a single dropdown, and in the backend it's one generator with a branch at the classifier step — not two codebases to maintain. That matters, because the substrate is where all the hard-won correctness lives (the escaped-script format, the DHCP lease script, the blackhole lesson, the MSS clamp) and you don't want two copies of it drifting apart.

Three things that differ per mode and must be handled in the generator, not left to the operator:

FastTrack. Load-balance mode must strip it entirely (PCC needs every packet). App-steer mode keeps it, constrained to connection-mark=no-mark, so unmarked traffic stays accelerated. Failover-only can leave it fully on. Getting this wrong is the classic "works for ten seconds then traffic goes out the wrong WAN" bug — so the generator should set it, not a checkbox.

Ratio vs. lists. Load-balance needs weights (PCC bucket math from the two link speeds). App-steer needs the Meta prefix list and the subscriber address-list name. Different config fields entirely — the UI should swap the form when the mode changes rather than showing both.

What "ISP2 down" means. In load-balance, losing a WAN means the survivor carries everything at reduced capacity. In app-steer, it means Meta traffic silently rejoins ISP1 and nobody notices. Worth saying differently in the UI copy, because operators will ask.

One thing to carry across all modes regardless of classifier — the lessons your outage taught: the management/RADIUS tunnel route must be interface-bound (gateway=ovpn-out1), never a standing blackhole that can outlive the outage it was covering; embedded scripts must be escaped single-line strings, never {} blocks; and MSS clamping is mandatory on any PPPoE WAN. Those belong in the substrate, so every mode inherits them.

If you want, I can write the app_steer script as a clean, parameterised template — same shape as the Infora {{placeholder}} style, so it drops straight into a generator alongside their failover/load-balance templates rather than being a hand-maintained one-off. That would give you all three modes sharing one substrate and one rollback path.

Before that though — your lab router is still sitting with ISP1 down on test/test and a polluted route table, and real subscribers on it. Worth closing that out first so the template you generate is one you've actually validated end to end. Which do you want to do: finish the lab (settle ISP1, clean routes, run the two failover drills), or draft the parameterised app_steer template now while the design is fresh?

---

## 15. The mode switch — one feature, pick your method (implementation design)

This section turns §0 + the classifier discussion above into the concrete **UI switch +
data + generator** design: how the operator **chooses the load-balancing method and
downloads (or applies) the matching `.rsc`**. It supersedes the loose ends in §9.

### 15.1 The modes — one enum, a swappable classifier

`wan_config.mode` has four values. The two the operator will call "load balancing" are
`load_balance` and `app_steer`; `failover` and `off` round out the switch.

| mode | classifier | what it's for | FastTrack (generator sets this, not a checkbox) |
|---|---|---|---|
| `off` | — | single-WAN, today's behaviour (default) | left on |
| `failover` | none | second line = hot standby | left on |
| `load_balance` | **PCC** hash on new conns | aggregate throughput, many clients | **removed** (PCC needs every packet) |
| `app_steer` | **Meta AS32934 address-list + `ISP2-SUBS` subscriber list** | send named apps / whole subscribers to ISP2 | **kept**, constrained to `connection-mark=no-mark` |

All four share the **substrate** (§4/§5), which is where every hard-won correctness lives:
reclaim the WAN2 port, per-WAN masquerade (never blanket), `/32` probe routes, recursive
distance-ordered defaults with `check-gateway=ping`, per-WAN routing tables, netwatch =
logging/recovery only, **interface-bound** tunnel route (not a standing blackhole — the
outage lesson), MSS clamp on any PPPoE WAN, escaped single-line embedded scripts, and
`comment="infora-lb"` idempotency + remove-by-comment rollback. **The classifier is the only
branch.**

### 15.2 Where the switch lives

Load balancing is **per-router** (each device has its own two uplinks), so the switch belongs
on the device — not a global on/off:

- **Primary — a `DualWanPanel` on the Device Detail page**, a new card/tab beside *Configure
  Services* (same page, same mental model). The **first control is a mode dropdown**
  (`Off · Failover only · Load balance · App steering`). Changing it **swaps the form below**
  (§15.3) and the generated script. Two actions, mirroring Configure services:
  **`Download .rsc`** (the "choose the type of script to download" the operator asked for —
  parameterised by the selected mode) and **`Apply now`** (push over the WG tunnel). Plus a
  **`Disable`** that pushes the remove-by-comment rollback.
- **Optional — a "Load Balancing" sidebar entry** under *Network*: a fleet table
  (`router · mode · WAN1/WAN2 up-down · active default · last flip`) with each row deep-linking
  into that device's DualWanPanel. It's an overview + jump-off, **not** a second place to set
  the mode — the switch stays per-device so there's one source of truth.

**Recommendation:** ship the per-device panel first (it *is* the switch); add the sidebar
overview together with the dual-WAN health card (§10) in a later pass.

### 15.3 The form swaps with the mode (don't show fields a mode doesn't use)

- **Common to every non-`off` mode:** WAN1 & WAN2 `port` + `type` (`dhcp|static|pppoe`, with
  `ip`/`gateway` when static), `primary_wan`, `probe_hosts`, and an advanced
  `pin_management_to` (null | wan1 | wan2).
- **`load_balance` adds:** WAN1/WAN2 **weights** → PCC bucket math (§8). No lists.
- **`app_steer` adds:** the **Meta prefix source** (AS32934, auto-populated address-list) and
  the **subscriber steer list name** (`ISP2-SUBS`, which RADIUS can fill per customer). No
  weights.
- **`failover`:** no classifier fields at all.

The panel swaps the form on mode change so weights and lists never show together.

### 15.4 The generator — one builder, one branch at the classifier

`build_load_balancing_script(device, config)` in
[`services/provisioning_scripts.py`](backend/server/services/provisioning_scripts.py) (pure,
v6/v7-aware, `infora-lb`-tagged, unit-testable like the existing builders):

1. Emit the **substrate** (§5.1, §5.3, §5.4).
2. `mode == 'load_balance'` → append PCC mangle (§5.2) **and strip FastTrack**.
3. `mode == 'app_steer'` → append Meta/subscriber address-list mangle **and** re-assert
   FastTrack with `connection-mark=no-mark` (keeps the 95% unmarked traffic accelerated).
4. `mode == 'failover'` → no classifier (keep only inbound/reply stickiness).
5. `off` / `Disable` → the remove-by-comment rollback (§11).

Data + routes are as in §9 — `wan_config.mode` simply gains `app_steer`; the three endpoints
(`GET …/load-balancing-script`, `POST …/configure-load-balancing`,
`POST …/load-balancing/disable`) are unchanged. **Download .rsc** = the GET endpoint with the
chosen `mode`.

### 15.5 UI copy that changes with the mode (operators will ask "what happens if ISP2 dies?")

- `load_balance`: "Both lines share traffic; if one drops, the other carries everyone at reduced speed."
- `app_steer`: "Named apps / subscribers ride ISP2; if ISP2 drops they quietly rejoin ISP1 — nobody notices."
- `failover`: "ISP2 is a hot standby — it only carries traffic when ISP1 is down."

### 15.7 As-built refinements (from lab review — the generator does these)

Reviewing the generated `.rsc` against the lab lessons surfaced two gaps in the §5 template
that `services/load_balancing.py` now closes:

- **Probe blackholes (leak-proof detection).** Each probe `/32` (via its WAN gateway,
  distance 1) is paired with a **`type=blackhole distance=250 scope=10`** route. If a WAN
  drops and its real probe route goes inactive, the probe is dropped here instead of leaking
  out the surviving WAN and falsely reporting the dead WAN healthy. `distance=250 ≫ 1` means
  the real route wins the instant it returns — no shadowing (the RADIUS-outage lesson).
- **Per-marked-table failover.** §5.3 gave each marked table a single gateway, so PCC/steered
  traffic pinned to a dead WAN would have no route (a marked table doesn't fall through to
  `main` in v7). Each WAN's gateway now also seeds the **other** table's **backup default**
  (`distance=2`, `check-gateway=ping`): `to_WAN1 = {GW1 d1, GW2 d2}`,
  `to_WAN2 = {GW2 d1, GW1 d2}`. LAN traffic now fails over too. For DHCP WANs the lease
  script maintains all three routes (own primary, other-table backup, probe) on each bind.

Still using direct-gateway `check-gateway` for the marked tables (local-gateway failover),
matching §5.3; **upstream** detection for marked LAN traffic (recursive marked defaults) is a
candidate refinement pending lab validation of v7 recursion-table semantics.

### 15.6 Build order

1. Substrate + `failover` + `load_balance` generator, `DualWanPanel` with the mode dropdown and
   **Download .rsc** (copy-paste delivery). Lowest risk, covers the common asks.
2. **Apply now** (push over tunnel) + `Disable`, and the `app_steer` classifier (Meta list +
   `ISP2-SUBS`, RADIUS-driven subscriber steering).
3. Sidebar overview + dual-WAN health card + netwatch notifications + PPPoE-WAN.