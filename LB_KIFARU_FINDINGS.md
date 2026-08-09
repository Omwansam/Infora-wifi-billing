# Kifaru dual-WAN — live test findings and remediation plan

Read-only diagnostic run against the live router over the management tunnel.
No configuration was changed.

- **Device**: Kifaru (id 37), hEX lite, RouterOS 7.23.2 stable, 10.250.0.2
- **App state**: `wan_config.enabled = true`, `mode = app_steer`, wan1=ether1, wan2=ether2
- **Verdict**: **not solid — inert.** Nothing is being balanced, steered, or failed over.
- **Live load at test time**: 0 hotspot users, 0 PPPoE sessions.

---

## 1. What is actually wrong

### 1.1 `ether1` is a slave of the `defconf` bridge — so WAN1 does not exist

`/interface print` reports `ether1` as `RS` (running + **slave**), and
`/interface bridge port print` shows it as a hardware-offloaded port of
`bridgeLocal`. Every part of the WAN1 config therefore fails, and RouterOS says
so in its own words:

| Object | State | RouterOS message |
|---|---|---|
| DHCP client `infora-wan-dhcp` on ether1 | `I` invalid | *"DHCP client can not run on slave or passthrough interface!"* |
| Mangle `chain=input ... in-interface=ether1` | `I` invalid | *"in/out-interface matcher not possible when interface (ether1) is slave - use master instead (bridgeLocal)"* |
| srcnat `masquerade out-interface=ether1` | `I` invalid | same |

The router still has internet, but only through the **leftover `defconf` DHCP
client on `bridgeLocal`** (192.168.1.101 → 192.168.1.1), which the load-balancing
config knows nothing about. Ping from the router: 3/3 to 8.8.8.8.

### 1.2 `ether2` is plugged into the router's own LAN, not a second ISP

`ether2` holds a **dynamic 172.31.0.101/16** — a lease issued by *this router's own*
hotspot DHCP pool. The LB routes consequently point at `172.31.0.1`, which is the
router's own `infora-bridge` address:

```
;;; infora-lb-gw2    0.0.0.0/0  gateway=172.31.0.1  routing-table=to_WAN2  distance=1
;;; infora-lb-bk2    0.0.0.0/0  gateway=172.31.0.1  routing-table=to_WAN1  distance=2
;;; infora-lb-probe2 1.0.0.1/32 gateway=172.31.0.1
```

"WAN2" routes traffic back into the router's own bridge. That is a loop, not an uplink.

### 1.3 Every load-balancing route is inactive

All five `infora-lb` routes print with the `I` (inactive) flag, and neither
`to_WAN1` nor `to_WAN2` carries the `U` (used) flag in `/routing table print`.
The two default routes carrying real traffic are the DHCP-installed
`192.168.1.1` pair from `defconf`.

### 1.4 LAN clients would have no internet

`/ip firewall nat print where chain=srcnat` returns exactly two rules:

```
0 I  chain=srcnat action=masquerade out-interface=ether1   ← invalid (slave)
1    chain=srcnat action=masquerade out-interface=ether2   ← valid, but ether2 faces the LAN
```

There is **no valid masquerade for the path that actually carries traffic**
(`bridgeLocal` → 192.168.1.1). Router-originated traffic works because it
sources from 192.168.1.101 and needs no NAT. A hotspot or PPPoE client on
172.31.x.x would leave un-NATed and never get a reply. Nobody has noticed
because there are currently zero active sessions.

### 1.5 Mode may not be what was intended

`mode = app_steer` is *policy routing*, not balancing: it steers the
`infora-meta` prefix list and the `ISP2-SUBS` subscriber list to WAN2 and
leaves everything else on WAN1. There are no `per-connection-classifier` rules
on the router, which is correct for this mode. If the goal is genuine traffic
distribution, the mode should be `load_balance` (PCC); if it is "WAN2 as hot
standby", it should be `failover`.

---

## 2. Why the app let this happen

Three gaps in `backend/server/services/load_balancing.py` and
`routes/devices.py`, all of which contributed:

**(a) WAN1 is never reclaimed from a bridge.** `build_lb_steps` reclaims only
WAN2:

```python
# --- 1. Reclaim the WAN2 port from the LAN bridge ---
add('reclaim-wan2', f':do {{/interface bridge port remove [find interface={w2["port"]}]}} ...')
```

Nothing removes WAN1 from `bridgeLocal`. On any router still carrying the
MikroTik `defconf` bridge — which is every factory-reset hEX — WAN1 silently
lands on a slave port.

**(b) Validation never looks at the router.** `validate_wan_config` checks the
shape of a dict: ports present, distinct, valid types, weights ≥ 1, probe IPs
parseable. It cannot know that `ether1` is enslaved, that `ether2` is on the LAN,
or that a `defconf` DHCP client already owns the default route.

**(c) A push "succeeds" even when every rule it creates is invalid.**
`push_lb_steps` reports success when the commands are *accepted*; RouterOS
accepts a mangle rule that references a slave interface and simply flags it
invalid. `configure_load_balancing` then persists `wan_config` as truth. The
hotspot/service path already builds a `verification` block (visible in
`service_config.summary.verification`); the LB path has no equivalent, so the
console shows LB as enabled while the router disagrees.

---

## 3. Remediation plan

### Phase 1 — physical/wiring (operator, on site)

Nothing in software can fix these two:

1. **Free `ether1` from `bridgeLocal`.** Either remove the port from the defconf
   bridge or remove `bridgeLocal` entirely, along with its `defconf` DHCP client
   `client1`. Until then WAN1 cannot exist.
2. **Plug `ether2` into a real second uplink.** It is currently on the LAN and
   leasing from this router's own pool.

Confirm afterwards: `/interface print` shows `ether1` without `S`, and `ether2`
holds an address from the second ISP, not `172.31.x.x`.

### Phase 2 — code changes

| # | Change | File | Why |
|---|---|---|---|
| 1 | Reclaim **both** WAN ports from any bridge, not just WAN2 | `services/load_balancing.py` | The root cause. Mirror `reclaim-wan2` for wan1. |
| 2 | Remove/disable the `defconf` DHCP client and its default route when a WAN port is claimed | `services/load_balancing.py` | Otherwise `defconf` keeps installing a competing distance-1 default. |
| 3 | Pre-flight check against the live router before pushing: refuse when a WAN port is a bridge slave, already holds a LAN address, or is the LAN interface itself | `services/load_balancing.py`, `routes/devices.py` | Turns a silent misconfiguration into an actionable error. |
| 4 | Post-push verification block (mirroring the hotspot one): assert each `infora-lb` route is active, `to_WAN1`/`to_WAN2` are `U`, and no `infora-lb` mangle/NAT/DHCP object carries `I` | `services/load_balancing.py`, `routes/devices.py` | Stops the app from reporting success over an inert config. |
| 5 | Persist `wan_config` only after verification passes; surface `verification` in the device response | `routes/devices.py` | Stored state should match the router. |
| 6 | Ensure a valid masquerade exists for whichever interface actually carries the default route | `services/load_balancing.py` | The current failure leaves LAN clients un-NATed. |

### Phase 3 — live test (only once 1 and 2 are done)

Kifaru has **zero active sessions**, so this is a safe window — but re-check
before starting, and take a router backup first (`/system backup save`).

1. Apply `mode=failover` first — simplest, fewest moving parts.
2. Verify: both WAN DHCP clients bound, both `infora-lb` routes active,
   `to_WAN1`/`to_WAN2` marked `U`, no `I` flags anywhere in `infora-lb`.
3. Connect a test client, confirm it reaches the internet (this is what proves
   the masquerade fix).
4. **Failover test**: unplug WAN1, watch `check-gateway=ping` withdraw the
   distance-1 route and traffic move to WAN2; confirm the test client keeps
   browsing. Re-plug and confirm it returns.
5. Only then try `load_balance` (PCC) or `app_steer`, and re-verify.

---

## 4. Commands used

All read-only, over the management tunnel via `services.device_config_ops.mikrotik_ssh`:

```
/system resource print
/interface print brief without-paging
/interface bridge port print brief without-paging
/ip address print detail
/ip dhcp-client print detail
/ip route print without-paging
/routing table print without-paging
/ip firewall mangle print without-paging
/ip firewall nat print without-paging
/tool netwatch print brief without-paging
/ping 8.8.8.8 count=3
/ip hotspot active print count-only
/ppp active print count-only
```

Note: `/ping ... routing-table=` is not accepted on 7.23.2 — per-table reachability
has to be tested from a client or with a marked source instead.
