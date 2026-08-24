# Router-scan import & live-system takeover

**Status: built and deployed** (2026-07-28) — `services/router_scan/`, `routes/imports.py`,
`ImportRun`/`ImportCandidate`, and the `/import` section of the admin UI are live on the Contabo
deployment. All three transports and the commit/revert cycle were tested against production
(including a real RouterOS 7.23.2 router); see **§20** for the results and the five defects that
testing found. Sections 1–19 remain the design of record.

Companion to [MIGRATION_FROM_OTHER_BILLING.md](MIGRATION_FROM_OTHER_BILLING.md), which covers the
**CSV** path (shipped: `Customer.radius_login`, `POST /api/customers/import`, the wizard at
`/clients/import`). This document covers the two things that path does *not*:

1. **Import straight off the router.** Pick a MikroTik → scan it → it finds the PPPoE pool, the PPP
   profiles, the rate limits, the secrets, the hotspot users → every profile becomes a package
   (creating the speeds you don't have yet) → you price them → 400+ clients land in one sitting.
2. **Take over a router that is already running someone else's billing** (self-built, Centipede,
   Splynx, User-Manager…) **without touching the router first.** Scan → import everything → verify →
   *then* provision and cut over. Nothing on the router changes until the operator says so, and the
   subscribers never notice.

Plus the navigation change that makes both discoverable: a dedicated **Import** section in the
sidebar instead of a button buried under Clients.

---

## 0. TL;DR

- **One parser, three transports.** The hard part is understanding a RouterOS config, not fetching
  it. Build `services/router_scan/` as a pure parser over RouterOS output, then feed it from (a)
  live SSH, (b) a read-only script the operator runs that POSTs its findings back, or (c) an
  uploaded `/export` file. (b) and (c) need **zero inbound access to the router** — which is what
  makes the takeover case work for NAT'd routers we haven't provisioned yet.
- **The scan is strictly read-only.** Every command is a `print`/`get`. No `add`, no `set`, no
  `remove`. This is the load-bearing promise of scenario 2 and must be enforced in code (a command
  allowlist), not just by convention.
- **Import and provisioning become two separate, independently-triggered actions.** Today
  `build_radius_script()` assumes a greenfield router and rewrites pools, NAT, DNS and SNMP. A
  takeover needs a new **additive-only** script that adds a RADIUS client and nothing else.
- **RouterOS PPP AAA checks local `/ppp secret` first, then RADIUS.** That gives a per-client
  canary migration: enable RADIUS while every local secret still works, then retire secrets one at a
  time (or in bulk) once Infora is proven. Verify this on the target RouterOS version before relying
  on it — it is the whole basis of the low-risk cutover.
- **Two worlds, and the scan must tell them apart.** If secrets live *on* the router
  (`/ppp secret`), we get cleartext passwords and a zero-touch import. If the router delegates to a
  foreign RADIUS, we get usernames, profiles, IPs and who's online — but **no passwords**. That is a
  physical limit, not a missing feature. Section 7 covers the four honest ways out.
- **Money is not on the router.** Speeds are; prices, due dates and real names usually aren't. The
  wizard must have an explicit **pricing step** and a **billing-anchor** decision, and be able to
  **merge an external CSV onto the scanned roster** (join on login) so the technical truth and the
  commercial truth combine.
- **Everything is a reviewable, revertible run.** 400 clients is too many to fix by hand. Persist
  `ImportRun` + `ImportCandidate`, diff on re-scan, and support "revert this run".

---

## 1. Navigation: a dedicated Import section

Today: one button on Clients → `/clients/import` ([ImportClients.jsx](FRONTEND/infora_billing/src/components/clients/ImportClients.jsx),
routed at [App.jsx:130](FRONTEND/infora_billing/src/App.jsx#L130)). Fine when import was a one-off
CSV. It stops being fine once import is a *mode of onboarding an ISP* with three sources, a run
history and a cutover attached to it.

**New top-level sidebar entry** in the `navigationItems` array of
[AppSidebar.jsx](FRONTEND/infora_billing/src/components/AppSidebar.jsx) (`icon: Download` or
`ArrowDownToLine`), placed directly under **Clients**:

| Item | Route | What it is |
|---|---|---|
| Import overview | `/import` | Landing: three source cards + recent runs |
| From a router | `/import/router` | The scan wizard (this document, §5–§13) |
| From a file | `/import/file` | Today's CSV wizard, moved |
| Migration & cutover | `/import/cutover` | Takeover checklist + pre-flight + cutover (§14–§15) |
| Import history | `/import/runs` | Every run, its diff, its revert |

**Compatibility:** keep `/clients/import` as a `<Navigate to="/import/file" replace />`, and keep the
Import button on the Clients page pointing at `/import/file`. Existing muscle memory and any
bookmarked link keeps working — same treatment as the `/packages` → `/plans` and `/customers` →
`/clients` redirects already in [App.jsx](FRONTEND/infora_billing/src/App.jsx#L140-L144).

**Access:** `AdminRoute`, not `ProtectedRoute`. A scan reads every subscriber's cleartext password
off a router; that is not a support-role capability. (Note that `/clients/import` is currently only
`ProtectedRoute` — tightening it is part of this work.)

---

## 2. The three shapes of import

| | Source of truth | Passwords | Typical operator |
|---|---|---|---|
| **A. Local-auth router** | `/ppp secret`, `/ip hotspot user`, static leases, simple queues | **Cleartext, readable** | Self-built billing, or a spreadsheet + Winbox |
| **B. RADIUS-backed router** | A foreign RADIUS server (Centipede, Splynx, UISP, daloRADIUS…) | **Not on the router** | Bought/rented a billing system |
| **C. File** | CSV / DB dump / `/export` from the old system | Depends on the export | Anyone with a working export |

The wizard's first job is to work out **which one it's looking at** (§6) and route the operator down
the right path — including "you're in case B, here is what I *can* get you and here is what you'll
need to supply."

Most real migrations are **B + C**: the router gives the technical roster, a CSV gives the money and
the names. The merge step (§11) is what makes that one clean import instead of two messy ones.

---

## 3. Getting to the router at all

A router already running someone else's billing is almost always behind NAT, and we haven't
provisioned it, so there's no management tunnel. Three transports, in the order the wizard should
offer them:

### 3a. Offline: upload an export *(no access to the router needed)*

Operator runs in the router terminal and saves the output:

```
/export show-sensitive           # RouterOS v7 — v7 hides secrets by default
/export                          # RouterOS v6 — already includes secrets
```

They upload the `.rsc` to `/import/router`. We parse it with the same parser as a live scan.

**This should be the default offer.** It requires no credentials, no inbound port, no tunnel, no
trust — and it is the only option when the router is on a CGNAT'd LTE link. Caveat to surface in the
UI: **v7 `/export` without `show-sensitive` strips every password**, producing a roster with no
credentials. Detect that case (all `password=""`) and say so loudly rather than importing 400
password-less clients.

An export is a point-in-time snapshot, so it can't tell us who is online right now — the wizard
should mark session-derived fields as unavailable rather than blank.

### 3b. Agent script: the router pushes its inventory to us

We generate a read-only `.rsc` (behind a short-lived token, same pattern as
`provision_token` / `build_one_liner()` in
[provisioning_scripts.py](backend/server/services/provisioning_scripts.py#L245)) that gathers the
inventory and POSTs it:

```
/tool fetch url="https://<infora>/api/import/router/<token>/ingest" http-method=post \
  http-data=$payload check-certificate=no
```

Outbound HTTPS only — works through any NAT. The script contains **no configuration commands**,
which the operator can verify by reading it before pasting. Worth publishing the script verbatim in
the UI for exactly that reason.

Constraint to design around: RouterOS `http-data` on older v6 builds is size-limited and the string
builder is slow. For 400 secrets, **page the upload** — POST in chunks of ~50 records with a
sequence number, and have the ingest endpoint assemble them into one run.

### 3c. Live SSH *(requires reachability)*

Reuses the existing plumbing exactly as-is: `mikrotik_ssh()` in
[device_config_ops.py:133](backend/server/services/device_config_ops.py#L133) gives us a serialized,
retrying session behind a per-device `flock`, and `client.run_cli()` runs a command.

Only viable when the router is reachable — public IP with SSH open, or the management tunnel is
already up. **The tunnel is itself a router change**, so for a strict takeover it's the *third*
choice, not the first. If the operator does accept it, the tunnel-only script is already built and
exposed at `GET /api/devices/<id>/management-tunnel-script`
([devices.py:1167](backend/server/routes/devices.py#L1167)) — it adds a WireGuard interface, peer,
address, route and netwatch, and touches no billing config.

> **Do not use the API transport.** `MikroTikClient._parse_api_response()`
> ([mikrotik_client.py:262](backend/server/mikrotik_client.py#L262)) collapses a multi-sentence
> reply into a single flat dict — it cannot represent a list of 400 secrets, and
> `_get_interface_stats_api()` iterating a dict is already latent evidence of that. SSH + the
> scripting emitter (§4) is the only transport that returns correct list data today. Fixing the
> binary API protocol is a separate, larger piece of work and is **out of scope** here.

---

## 4. Reading RouterOS output without it lying to you

Two parsers already exist in [device_config_ops.py](backend/server/services/device_config_ops.py):
`_parse_kv()` for `name: value` blocks and `_parse_terse_rows()` for `print terse`. **Neither is
safe for subscriber data**, because both split on whitespace — and a `/ppp secret` comment is
`comment=John Kabete 0712345678 exp 15/08` and a password can be `my pass word`. `print terse` will
shred both. This is the same class of bug the `interface_traffic()` comment at
[device_config_ops.py:660](backend/server/services/device_config_ops.py#L660) already documents for
columnar output.

**Use a record emitter: one field per line, an explicit record separator.** Values may contain
spaces, `=`, `,`, `|`; they cannot contain newlines (RouterOS forbids them in comments and names),
so line-delimited framing is sound.

```
:foreach i in=[/ppp secret find] do={
  :put "#REC";
  :do { :put ("name=" . [/ppp secret get $i name]) } on-error={};
  :do { :put ("password=" . [/ppp secret get $i password]) } on-error={};
  :do { :put ("profile=" . [/ppp secret get $i profile]) } on-error={};
  :do { :put ("service=" . [/ppp secret get $i service]) } on-error={};
  :do { :put ("remote-address=" . [/ppp secret get $i remote-address]) } on-error={};
  :do { :put ("caller-id=" . [/ppp secret get $i caller-id]) } on-error={};
  :do { :put ("disabled=" . [/ppp secret get $i disabled]) } on-error={};
  :do { :put ("comment=" . [/ppp secret get $i comment]) } on-error={};
}
```

Each field is individually `:do{}on-error={}` guarded because a property that is unset — or that
doesn't exist on this RouterOS version — raises and would otherwise abort the whole loop and cost us
the entire roster. Parse into `[{...}, {...}]` on `#REC` boundaries.

### The permission trap that will waste an afternoon

`[/ppp secret get $i password]` returns **empty** unless the connecting user's group carries the
**`sensitive`** policy. A `read`-only group does not include it. Same for
`/ip hotspot user`.

So the wizard must:
- Recommend a scan user with `group=read` **plus** `sensitive` (`/user group add name=infora-scan
  policy=read,sensitive,ssh,api,test`), and print that command.
- **Detect the symptom** — a roster where every `password` is empty but `name` is populated — and
  report *"the scan user cannot read passwords (missing the `sensitive` policy)"* rather than
  importing 400 clients with generated passwords and mass-breaking every CPE.

That detection is worth writing before anything else in this feature; it is the difference between a
migration and an outage.

---

## 5. The discovery surface — what a MikroTik actually knows

All read-only. Grouped by what they tell us; every one guarded so an absent menu (no hotspot, no
user-manager, v6 vs v7 differences) degrades to "not present" instead of failing the scan.

**Identity & posture**
```
/system resource print          /system routerboard print        /system identity print
/ppp aaa print                  → use-radius, accounting, interim-update
/radius print detail            → foreign RADIUS servers (the case-A/B tell)
/radius incoming print
/ip firewall filter print terse → is FastTrack present (accounting integrity)
```

**Plan skeletons**
```
/ppp profile print detail             → name, rate-limit, local/remote-address, only-one, dns
/ip hotspot user profile print detail → rate-limit, shared-users, session-timeout
/queue simple print detail            → per-client caps where there are no profiles
/queue tree print detail
```

**Address plan**
```
/ip pool print detail            /ip address print detail
/ip dhcp-server print detail     /ip dhcp-server network print detail
/interface pppoe-server server print detail
/interface bridge print terse    /interface bridge port print terse
```

**The roster**
```
/ppp secret print detail             → PPPoE subscribers (+ cleartext passwords)
/ppp active print detail             → who is online *right now* (+ address, caller-id, uptime)
/ip hotspot user print detail        → hotspot subscribers (+ passwords, MAC, byte/uptime limits)
/ip hotspot ip-binding print detail  → MAC-bypassed clients
/ip dhcp-server lease print detail   → static leases (name/comment/mac/address)
/ip firewall address-list print detail → blocked / expired / paid markers
/tool user-manager user print detail  → RouterOS 6 User Manager, if present
```

**Evidence of the incumbent system**
```
/system script print detail      /system scheduler print detail
/file print detail               /ip hotspot walled-garden print detail
```
Self-built billing lives here — scheduled scripts that disable secrets on a due date, address-list
timeouts, a `hotspot/login.html` branded by someone else. Reading them is how we discover the
*billing rules* the router is enforcing, and often where the due dates are.

---

## 6. Fingerprinting: which import path applies

Cheap to compute from §5, and it is what turns "scan the system first" from a vague wish into a
concrete screen. The wizard's first result page is a **Router profile** card:

| Signal | Reading |
|---|---|
| `/radius print` has entries + `/ppp aaa use-radius=yes` | **External billing detected** at `<ip>` → case B |
| `/ppp secret` count > 0 | **Local subscriber database** — passwords readable → case A |
| Both | Hybrid — usually a half-finished migration; import locals, flag the rest |
| `/queue simple` count > 0 with no PPPoE server | **Queue-billed static ISP** → §9c, limited support |
| `/tool user-manager` present with users | **MikroTik User Manager** → case A (readable) |
| `/system scheduler` entries referencing `/ppp secret … disabled` | **Home-grown expiry automation** — mine it for due dates (§10) |
| `/ip hotspot` present with users | Hotspot subscribers to import alongside PPPoE |
| FastTrack rule present | Warn: accounting will be wrong until cutover removes it |

Render it as plain sentences — *"This router authenticates 412 PPPoE subscribers from its own
database. Passwords are readable. Nothing here talks to an external billing system."* — followed by
the counts, and then the recommended path. That single screen is the answer to "how can the user
scan the system first".

---

## 7. Case B: when the passwords aren't on the router

If auth is delegated to a foreign RADIUS, `/ppp secret` is empty and **no amount of scanning
produces a password**. Say so plainly in the UI. The scan still yields real value — from
`/ppp active` and the queues we get the **live roster**: username, assigned IP, MAC/caller-id,
current rate-limit, uptime, and (via profile) the package. That is the skeleton; four honest ways to
put credentials on it:

1. **Export from the old system.** Best case. Splynx/UCRM/Powercode export CSV; Radius Manager,
   daloRADIUS and User-Manager are MySQL/SQLite — query `radcheck`/`users` directly. Merge onto the
   scan (§11). Covered by the existing CSV importer end-to-end.
2. **Temporarily force PAP and harvest.** Set the PPPoE server to `authentication=pap` and add
   Infora as a RADIUS server; PAP carries `User-Password` in cleartext inside the Access-Request, so
   every client that reconnects hands us its real password and we auto-create it. Full roster within
   one reconnect cycle, zero customer contact. **This is a router change** (so it belongs to cutover,
   not scan) and it puts subscriber passwords in cleartext on the operator's own LAN for the harvest
   window. Offer it explicitly, with the trade-off stated and an automatic revert to
   `pap,chap,mschap1,mschap2` when the run closes. CHAP/MS-CHAP responses are **not** reversible —
   there is no version of this that works without forcing PAP.
3. **Proxy-learn.** Point the router at Infora's FreeRADIUS, which proxies unknown users to the old
   server, returns the Access-Accept verbatim (so the client connects exactly as before) and records
   username + reply attributes as a discovered candidate. Zero downtime, roster builds itself over a
   week of natural reauth, and combined with (2) it captures passwords too. The most elegant option
   and the most infrastructure — a FreeRADIUS `proxy.conf`/realm change plus an ingest hook. **Phase
   5**, not day one.
4. **Re-issue.** Generate new passwords and reconfigure every CPE. Always available, always the
   worst answer at 400 clients. The importer already flags generated passwords via
   `needs_reconfigure` ([customer_import.py:412](backend/server/services/customer_import.py#L412)) —
   surface that count as a scary number, because it is one.

---

## 8. Profiles → Packages, and the pricing step

**Every PPP profile (and hotspot user profile) becomes a `ServicePlan`.** The resolution logic
already exists and should be reused, not rewritten: `_build_plan_indexes` / `_auto_match_plan` /
`_create_plan_from_name` / `_resolve_plan_map` in
[customer_import.py](backend/server/services/customer_import.py#L118-L142) already do *exact name →
unambiguous speed match → auto-create placeholder*, and the wizard already has a
"Resolve packages" step driven by `plan_resolutions`. The scan feeds that same machinery — it just
supplies a much richer input than a CSV string.

**Rate-limit parsing.** RouterOS format:

```
rx-rate[/tx-rate [rx-burst/tx-burst [rx-threshold/tx-threshold [rx-burst-time/tx-burst-time [priority [rx-min/tx-min]]]]]]
```

Two things to get right, and they are both easy to get backwards:

- **First value is the client's UPLOAD, second is the DOWNLOAD.** Same convention for
  `/ppp profile rate-limit`, `/queue simple max-limit` and the `Mikrotik-Rate-Limit` RADIUS
  attribute. So `rate-limit=5M/20M` is a 20 Mbps download package. Getting this inverted turns every
  imported package into an upload-heavy mutant, and it will not be obvious until customers complain.
  The pricing step should show both numbers explicitly (`↓ 20M ↑ 5M`) with a global "swap
  upload/download" toggle for when a scan proves otherwise.
- **Units vary**: `512k`, `2M`, `10000000` all appear. Normalise to Mbps, floor at 1, and keep the
  raw string in `features` for audit.

**Prerequisite fix.** `generate_radius_attributes()`
([plan_utils.py:209](backend/server/services/plan_utils.py#L209)) currently emits only symmetric
`f'{mbps}M/{mbps}M'` from `bandwidth_limit`, even though `get_plan_speed_mbps()` right above it
already resolves upload and download separately. Importing asymmetric packages is pointless until
that emits `{upload}M/{download}M`. Small change, must land **before** any asymmetric import — do it
first, with a test.

**Map into `ServicePlan`:**

| Router | ServicePlan |
|---|---|
| profile name | `name` (dedup within ISP) |
| rate-limit tx | `bandwidth_limit` (Mbps), `speed` = `"20M"` |
| rate-limit rx | `features.upload_speed_mbps` |
| burst fields | `features.burst_speed_mbps`, `burst_threshold_pct`, `burst_time_seconds` — already read by `extract_package_policy()` |
| `only-one` | informational |
| hotspot `limit-bytes-total` | `data_limit` (GB) |
| hotspot `session-timeout` | `session_timeout` |
| `remote-address` (pool name) | recorded on the run, used by cutover (§14) |
| — | `plan_type` = `pppoe` / `hotspot` |
| — | **`price` — not on the router** |
| — | **`billing_cycle_days` — not on the router**, default 30 |

**The pricing step is a required wizard step, not an afterthought.** A table of every discovered
profile with its subscriber count, its parsed speeds, and an editable price + cycle:

```
Profile          Clients   Speed        Price (KES)   Cycle    → Package
PPPOE-10M          187     ↓10M ↑5M     [ 2500 ]      [30 d]   new "PPPOE-10M"
PPPOE-20M          140     ↓20M ↑10M    [ 3500 ]      [30 d]   → existing "Home 20M"  ▾
PPPOE-5M            71     ↓5M  ↑2M     [ 1500 ]      [30 d]   new "PPPOE-5M"
default              14    (none)       [    0 ]      [30 d]   ⚠ skip / map
```

Sorted by client count, because that is the order that matters. Each row can also be **remapped to
an existing package** (reusing `plan_map`) so a re-scan doesn't duplicate what the operator already
built. Rows with no rate-limit — RouterOS's stock `default` and `default-encryption` profiles — must
default to *skip* and be flagged; silently creating a 0-price package named "default" and putting 14
people on it is exactly the kind of quiet mess this feature exists to prevent.

---

## 9. The three subscriber classes

### 9a. PPPoE — the main case

`/ppp secret` (roster) joined with `/ppp active` (who's up). Maps cleanly onto what already exists:

| Router field | Infora |
|---|---|
| `name` | `Customer.radius_login` — **keep it exactly**; that's what the CPE dials |
| `password` | `radius_password_encrypted` via `set_customer_radius_password()` |
| `profile` | → `ServicePlan` (§8) |
| `remote-address` (an IP, not a pool) | `radreply` `Framed-IP-Address` — static-IP client |
| `caller-id` | `radcheck` `Calling-Station-Id` if the old system pinned MAC |
| `disabled=yes` | `status = suspended` — do **not** provision RADIUS rows |
| `comment` | mined for name/phone/expiry (§10) |
| `last-logged-out` | dormancy signal — offer "skip clients not seen in 90 days" |

Commit path is unchanged: `provision_customer_radius()` writes `radcheck` / `radreply` /
`radusergroup`, `ensure_plan_group()` makes the `plan_<id>` group. Same code the CSV importer calls
at [customer_import.py:405](backend/server/services/customer_import.py#L405). Reuse it.

### 9b. Hotspot

`/ip hotspot user` → name/password, or MAC-only users where identity *is* the MAC. Same handling the
CSV importer already has: MAC → `radcheck` `Calling-Station-Id`
([customer_import.py:410](backend/server/services/customer_import.py#L410)). `/ip hotspot ip-binding`
entries with `type=bypassed` are free/infrastructure devices — import as records, never as billable
customers, and default them to skip.

### 9c. Static / queue-billed clients — **explicitly out of scope for v1**

Very common in small ISPs: no PPPoE at all. A static DHCP lease + a simple queue per IP, and
"billing" is the operator disabling the queue when someone doesn't pay. The scan *can* build the
roster (queue name/comment, target IP, max-limit, lease MAC, address-list membership) and we should
**import them as customer records with `connection_type='static'` so the operator gets their
billing, invoicing and M-Pesa references** — that alone is most of the value.

What we cannot do in v1 is **enforce** them: Infora's enforcement is entirely RADIUS
(`provision_customer_radius`, `suspend_customer_access`), and these clients never authenticate. Two
futures, both deferred:
- push queue enable/disable to the router from `sync_customer_radius_status()` — a new enforcement
  backend, real work; or
- migrate them onto PPPoE/hotspot, which means touching every CPE.

Say this out loud in the UI at import time ("these 46 clients will be billed but not enforced")
rather than letting an operator discover it when a non-payer doesn't get cut off.

---

## 10. Where due dates come from

The router knows speeds. It does not know money or dates — **unless** the incumbent system left
tracks. In priority order:

1. **Merged CSV** (§11) — the old system's export. Authoritative when available.
2. **Comment mining.** Small ISPs put everything in the `/ppp secret` comment:
   `John Kabete 0712345678 exp 15/08/2026`, `0722000000 | Home 10M | due 2026-08-01`. Ship a
   comment-parser step: auto-detect phone numbers (reuse `normalize_phone()` from
   [hotspot_credentials.py](backend/server/services/hotspot_credentials.py)), dates (reuse
   `_parse_date()` and its `_DATE_FORMATS` at
   [customer_import.py:188](backend/server/services/customer_import.py#L188)), and names, then show a
   **live preview over the first 20 real comments** with per-field enable/disable and a manual regex
   escape hatch. Never apply silently — the operator confirms against their own data.
3. **Scheduler/script mining.** A home-grown `/system scheduler` entry that disables a secret on a
   date encodes the due date. Best-effort, present as a hint.
4. **`disabled=yes`** → already expired → import as `suspended`.
5. **Uniform anchor** — the fallback, and it must be the default: *every imported client gets
   `subscription_end = today + N days`* (operator picks N, default 30). Nobody is cut off during the
   migration, the operator collects normally, and each client's real cycle re-anchors on their first
   payment through `activate_customer_after_payment()`
   ([radius_provisioning.py:339](backend/server/services/radius_provisioning.py#L339)).

**Default to generous.** The single worst outcome of this feature is a bad date import
disconnecting 400 paying customers at midnight. The anchor step should show a histogram of resulting
expiry dates and hard-block a commit where >5% of clients would land in the past without the
operator explicitly ticking "yes, suspend these 23 clients on import".

---

## 11. Merging an external export onto a scan

The step that makes case B work, and the reason Import is a section rather than a button.

- Scan gives: `login`, `password`, `profile`, `ip`, `mac`, `disabled`, `online`.
- CSV gives: `name`, `phone`, `email`, `balance`, `subscription_end`, `plan`, `account_number`.

**Join on `login`** (lowercased, trimmed). Present a three-column reconciliation:

```
  In both            387    → merged (CSV wins for name/phone/money, router wins for credentials)
  Router only         25    → import with a generated name from the comment, flagged
  CSV only            13    → import without credentials → needs_reconfigure, flagged
```

Field-level precedence must be stated, not implicit: **router wins for anything the CPE depends on**
(login, password, static IP, MAC); **CSV wins for anything a human typed** (name, phone, email,
balance, due date). Where both are present and disagree on the *plan*, surface the conflict — that
usually means the old system's package and the router's profile drifted, and the operator is the only
one who knows which is right.

Fuzzy-matching logins (`john_kabete` vs `john.kabete`) is tempting and should be **suggest-only,
never automatic** — a wrong join writes one subscriber's password onto another's account.

---

## 12. Data model

Follow the project's established pattern: idempotent DDL in `ensure_schema_upgrades()`, **no
Alembic** (see the as-built note in
[MIGRATION_FROM_OTHER_BILLING.md §12](MIGRATION_FROM_OTHER_BILLING.md), and the prod-deploy memo
about not running `flask db migrate` over it).

**`ImportRun`** — one scan/import attempt.
```
id, isp_id (FK, NOT NULL), device_id (FK, nullable — file imports have no device)
source          'router-ssh' | 'router-agent' | 'router-export' | 'csv' | 'radius-learn'
status          'scanning' | 'scanned' | 'importing' | 'completed' | 'failed' | 'reverted'
mode            'dry_run' | 'commit'
fingerprint     JSON  — the §6 router profile
options         JSON  — pricing map, anchor policy, plan_map, comment-parse config
counts          JSON  — discovered / valid / created / skipped / failed / needs_reconfigure
raw_blob_path   text  — the captured router output, for reparsing without re-scanning
created_by, started_at, finished_at
```

**`ImportCandidate`** — one discovered subscriber, the staging row the operator reviews.
```
id, run_id (FK, NOT NULL)
kind            'pppoe' | 'hotspot' | 'static'
login, name, phone, email
password_encrypted        (Fernet, same as Customer.radius_password_encrypted)
profile_name, rate_limit_raw, remote_address, mac, disabled, comment, online
raw             JSON  — every field we read, verbatim
resolved_plan_id (FK, nullable), price_override, subscription_end
decision        'import' | 'skip' | 'update'      (operator-editable)
match_customer_id (FK, nullable)   — set when the login already exists
customer_id     (FK, nullable)     — set on successful commit → this is what revert walks
status          'new' | 'duplicate' | 'error' | 'created' | 'skipped'
messages        JSON
```

Provenance lives on `ImportCandidate.customer_id`, **not** a new column on `Customer`. `customers` is
the hottest table in the schema and adding a nullable FK there for a migration-time concern isn't
worth it; the candidate row already has to exist and gives revert everything it needs. Index
`(run_id, status)` and `(run_id, login)`.

**Revert a run** = for each candidate with `customer_id`, delete that customer. The cascade rules on
`Customer` already handle the RADIUS rows correctly — `radcheck_rows` / `radreply_rows` /
`radusergroup_rows` are `delete-orphan` ([models.py:199-203](backend/server/models.py#L199-L203)),
which is exactly the fix from commit `b71fa18`. Refuse to revert any customer that has since taken a
payment or been edited, and report those as skipped rather than silently destroying real history.

---

## 13. API surface

All admin-only, all ISP-scoped via the existing `_resolve_isp_for_user()` pattern.

```
POST   /api/import/router/scan            {device_id, transport}      → run_id (async)
POST   /api/import/router/scan/upload     multipart .rsc              → run_id
GET    /api/import/router/agent-script    ?device_id=                 → read-only .rsc + token
POST   /api/import/router/<token>/ingest  {seq, total, records[]}     → chunked agent upload
GET    /api/import/runs                                               → history
GET    /api/import/runs/<id>                                          → fingerprint + counts
GET    /api/import/runs/<id>/candidates   ?status=&page=              → paginated, NO passwords
PATCH  /api/import/runs/<id>/candidates   {ids[], decision, plan_id}  → bulk operator edits
POST   /api/import/runs/<id>/merge-csv    multipart                   → §11 reconciliation
POST   /api/import/runs/<id>/plan         {pricing[], anchor, …}      → §8/§10 decisions
POST   /api/import/runs/<id>/dry-run                                  → preview (no writes)
POST   /api/import/runs/<id>/commit                                   → create (async)
POST   /api/import/runs/<id>/revert                                   → undo
GET    /api/import/runs/<id>/errors.csv                               → downloadable failures
```

**`/commit` and `/scan` are asynchronous.** 400 customers × (insert + `ensure_account_number` +
password encrypt + 3–4 RADIUS rows + savepoint) is not an HTTP-request-shaped job. Follow the
existing `sync_device_async()` pattern
([mikrotik_sync.py:193](backend/server/services/mikrotik_sync.py#L193)): background thread with an
app context, progress written to `ImportRun.counts`, UI polls the run. Commit in batches of ~50 so
progress is visible and a crash doesn't lose everything.

**Passwords never appear in list responses.** Candidates expose `has_password: bool`. A separate
`GET /api/import/candidates/<id>/reveal` returns one, writes an `AuditLog` row, and is admin-only —
mirroring the existing per-customer reveal at
`GET /api/customers/<id>/radius-credentials` ([customers.py:912](backend/server/routes/customers.py#L912)).

**Service layout** (parser separate from transport, so it's unit-testable without a router):
```
services/router_scan/__init__.py     orchestration, ImportRun lifecycle
services/router_scan/commands.py     the read-only command allowlist + emitters (§4, §5)
services/router_scan/parser.py       output/.rsc → normalised records  ← pure, heavily tested
services/router_scan/fingerprint.py  §6
services/router_scan/profiles.py     rate-limit parsing, profile → ServicePlan (§8)
services/router_scan/comments.py     comment mining (§10)
services/router_scan/reconcile.py    matching, merge, diff (§11)
services/router_scan/commit.py       → delegates to customer_import.process_import()
```

The commit path **must** funnel into the existing `process_import()`
([customer_import.py:461](backend/server/services/customer_import.py#L461)) rather than growing a
parallel creation path. It already has savepoint-per-row isolation, plan resolution, status
normalisation, account-number assignment and the RADIUS provisioning call. Extending it to accept
pre-resolved candidate dicts is a much smaller change than reimplementing it, and it means one code
path to keep correct.

---

## 14. Cutover: additive provisioning, not re-provisioning

**The router must not be touched until the operator explicitly cuts over.** And when they do, the
existing script is the wrong tool.

`build_radius_script()` ([provisioning_scripts.py:142](backend/server/services/provisioning_scripts.py#L142))
assumes a greenfield router. On a live one it also: adds a blanket `srcnat masquerade` (breaks
policy routing / existing NAT layouts), sets `/ip dns allow-remote-requests=yes` (opens the router as
a resolver), rewrites SNMP communities, sets the timezone, and removes+recreates the management user.
`configure_services()` is worse for this purpose — it rebuilds bridges, pools and DHCP, which would
**renumber every subscriber**.

**Build `build_adoption_script(device)` — additive only:**

```
/radius add address=<infora> secret=<isp secret> service=ppp,hotspot timeout=3s \
    src-address=<tunnel ip> comment="infora-billing"     # ADD, never remove the incumbent
/radius incoming set accept=yes
/ppp aaa set use-radius=yes accounting=yes interim-update=5m
:do { /ip firewall filter remove [find action=fasttrack-connection] } on-error={}
```

That's it. No bridge, no pool, no DHCP, no NAT, no DNS, no SNMP, no user changes. The existing
`/radius` entry stays — RouterOS tries servers in list order, so the incumbent remains primary and
we're the fallback. Preserve the discovered pool and profile names on the run so the operator can
later choose to standardise, deliberately, as a separate act.

Two caveats to state in the UI:

- **FastTrack removal is required for accurate accounting** (a fast-tracked connection bypasses the
  rules RADIUS accounting depends on) **and it raises CPU** on a busy box. It is a real forwarding
  change. Show it as its own checkbox with its own explanation.
- **`interim-update` is the resolution of every usage figure in the product** — see the comment on
  `radius_interim_interval()` at
  [device_config_ops.py:57](backend/server/services/device_config_ops.py#L57). Default 5m; suggest 1m
  during the cutover window so the operator sees traffic while they're watching.

### The canary path (case A)

This is the payoff of RouterOS checking `/ppp secret` **before** RADIUS: after
`use-radius=yes`, **every existing client keeps authenticating locally and nothing changes.** Only
users absent from the local database reach Infora. So:

1. Apply the adoption script. **Zero subscriber impact** — verify by watching `/ppp active` stay flat.
2. Pick 3–5 volunteers. Disable (don't delete) their `/ppp secret`. On their next reconnect they
   authenticate against Infora. Watch the session appear in Online Users with the right rate-limit
   and accounting flowing.
3. Roll forward in batches — a profile at a time, or 50 at a time.
4. When `/ppp active` is fully served by Infora, disable the remaining secrets, then remove the
   incumbent `/radius` entry.

Rollback at any step is *re-enable the secret*. No customer is ever without a working path.

**Verify the local-first ordering on the target RouterOS version before relying on it** — build a
one-click "canary check" that disables one secret, waits for reauth, and reports which server
answered. Getting this wrong at step 1 instead of step 2 is a 400-client outage.

For case B (already RADIUS), the equivalent is ordering: add Infora *after* the incumbent, prove
auth works by moving one client's credentials, then promote Infora to first.

---

## 15. Pre-cutover verification

Before anything is touched, answer one question per client: **"would this subscriber authenticate
against us right now?"**

Send a real Access-Request to our own FreeRADIUS from the app container using each imported client's
stored credentials, and assert the reply carries the expected `Mikrotik-Rate-Limit` and
`Expiration`. This exercises the whole chain — `radcheck`, `radusergroup`, the `plan_<id>` group,
`radreply`, the ISP's shared secret — and it catches the failures that otherwise show up as 400
simultaneous auth rejects at 2am.

**Built 2026-08-24** as `services/router_scan/radius_probe.py` (a small pure-Python RADIUS client)
plus `verify.py`, `POST /api/import/runs/<id>/verify`, and Step 2 of the cutover page. Reports
`387 of 400 would authenticate` with every failure itemised and individually re-checkable.

Three things it does that a naive version would not:

- **MS-CHAPv2 for PPPoE, PAP for hotspot** — each subscriber is checked the way that subscriber
  actually dials. A broken `rlm_mschap` or a stray `Auth-Type := Accept` rejects (or hollowly
  accepts) every PPPoE dial while PAP hotspot logins keep working, so a PAP-only check would report
  green during exactly that outage. MD4 is implemented in-repo because OpenSSL 3 dropped it; single
  DES is `TripleDES(key*3)` from `cryptography.hazmat.decrepit`. Validated against the RFC 1320 and
  RFC 2759 §9.2 vectors, not against our own output.
- **An Accept without `MS-CHAP2-Success` is a FAILURE, not a pass** — that is the ~53-byte Accept an
  `Auth-Type := Accept` row produces: the server says yes and the CPE still reports a login failure
  (§7b). A healthy MS-CHAPv2 Accept is ~211 bytes with MS-CHAP2-Success plus MPPE keys.
- **`Message-Authenticator` is mandatory** (RFC 2869 §5.14). Since the BlastRADIUS mitigation
  (CVE-2024-3596) FreeRADIUS drops a request without it and answers *nothing* — indistinguishable
  from an unreachable server. The same is true of a wrong shared secret, so the timeout text names
  both causes.

Verified end to end against a real FreeRADIUS 3.2 built from `config/freeradius`: correct password →
Accept with the right `Mikrotik-Rate-Limit`; wrong password → Reject; a deliberately-deleted
`radcheck` row → the failure named with its cause; a password containing a space → authenticates
verbatim.

**Watch out for `@example.com`.** Stock `proxy.conf` ships a live `realm example.com` pointed at a
dead home server, so any login on that domain is proxied into a black hole and never reaches the SQL
lookup. Other domains fall through untouched (there is no `realm DEFAULT` and `default_fallback = no`),
so real email-style logins are fine — but test data on `example.com` will look like a total auth
outage.

Also worth having, and cheap:
- **Post-cutover watch** — **built** as `cutover.watch()` + `GET /api/import/runs/<id>/watch` and
  Step 4 of the page. Deliberately not "how many sessions exist" but **"which of the people I just
  moved have not come back?"**, named individually, beside the router's own `/ppp active` and
  remaining-enabled-secret counts. There is no `radpostauth` table in this schema, so the
  auth-failure feed is served by the per-client verification verdict instead, which is more direct.
- **Batch progress** — `ImportCandidate.cutover_at`, set when a batch script is generated. Before
  this, the batch query had no offset and no state, so every click of "Move this batch" handed back
  the *same* subscribers. `POST /cutover-reset` un-marks a batch that was generated but never
  pasted.
- **Keep the incumbent's export archived** and its server read-only for a soak week (§9 of the
  companion doc).

---

## 16. Scale: 400+ clients

- **The scan is a dozen commands, not 400 round-trips.** One SSH session, ~15 `print`s, maybe 200 KB
  of output. Well within `mikrotik_ssh(timeout=…)` if the timeout is raised for this call — use ~60s
  rather than the default 12, and hold the per-device flock for the whole scan so nothing competes.
- **Chunk the agent upload** (§3b) — RouterOS string building is slow and `http-data` is size-capped
  on v6.
- **Batch the commit.** Commit every ~50 rows, update `ImportRun.counts` as you go. Watch
  SQLAlchemy identity-map growth across 400 customers plus 1,600 RADIUS rows — `expunge_all()`
  between batches if memory climbs.
- **Pre-resolve plans once**, not per row. `_build_plan_indexes()` already does this; make sure the
  scan path doesn't re-query per candidate.
- **`ensure_account_number()` takes an atomic per-ISP counter** — 400 sequential bumps in one
  transaction is fine, but confirm it isn't doing a `SELECT max()` per call under load.
- **`sync_radius_clients_conf()`** should be called **once** after the run, not per customer.
- FreeRADIUS itself: 400 subscribers is nothing. The `plan_<id>` group indirection means a package
  change is one `radusergroup` update, not 400 `radreply` rewrites — that design already pays off
  here.

---

## 17. Security & privacy

- A scan produces **400 subscribers' cleartext passwords**. Encrypt on ingest with the same Fernet
  path as `set_customer_radius_password()` — the plaintext must never be written to
  `ImportCandidate` unencrypted, never logged, and never returned by a list endpoint.
- `raw_blob_path` holds a full router config dump including the incumbent's RADIUS shared secret and
  possibly the admin password. Encrypt at rest, set a retention window (default: purge 30 days after
  the run completes, reusing the `data_retention` service), and never expose it for download without
  an audit entry.
- **Admin-only**, every route. Scan, reveal, commit and revert each write an `AuditLog` row with the
  device and the record count.
- The agent script's token must be **single-purpose, short-lived and scoped to one run** — it is
  pasted into a terminal and will end up in someone's clipboard history.
- The scan command list must be an **explicit allowlist** validated at execution time, so no future
  edit can smuggle a `set` into the "read-only" path. That promise is the product here; enforce it
  mechanically.

---

## 18. Failure modes to design against

| Failure | Consequence | Mitigation |
|---|---|---|
| Scan user lacks `sensitive` policy | 400 blank passwords → generated → every CPE breaks | Detect empty-password roster, **block the import** (§4) |
| v7 `/export` without `show-sensitive` | Same | Detect and explain at upload |
| `print terse` on comments/passwords with spaces | Silent field corruption | Record emitter, never terse, for subscriber data (§4) |
| Upload/download inverted | Every package backwards | Show `↓/↑` explicitly + swap toggle (§8) |
| Stock `default` profile imported | 0-price junk package with real clients on it | Default to skip + flag (§8) |
| Bad date parse | Mass suspension at midnight | Expiry histogram + hard block on >5% past-dated (§10) |
| Fuzzy login match wrong | One client's password on another's account | Suggest-only, never automatic (§11) |
| Re-scan duplicates everyone | 800 customers | Match on `find_customer_by_login()`, diff not insert (§12) |
| `configure_services()` run on a live router | Every subscriber renumbered | Adoption script only; guard the wizard (§14) |
| FastTrack removed on a weak CPU box | Router saturates | Separate checkbox with the CPU warning (§14) |
| Local-first PPP ordering wrong on this ROS build | Cutover is instant, not gradual | Canary check before batch 1 (§14) |
| Commit dies at row 200 | Half-imported, unclear state | Savepoint per row + resumable run + revert (§12) |
| Static/queue clients imported as enforceable | Non-payers never disconnected | State the limit at import time (§9c) |

---

## 19. Delivery phases

Each phase is independently shippable and independently useful.

**Phase 0 — Import section.** Sidebar entry, `/import` landing, move the CSV wizard to
`/import/file`, `/clients/import` redirect, `ImportRun` history table (empty at first). Tighten to
`AdminRoute`. *No backend logic.* Small, and it establishes the surface everything else hangs off.

**Phase 1 — Read-only scan + fingerprint.** The parser (`router_scan/`), all three transports, the
Router profile screen (§6), a read-only candidate table. **Writes nothing anywhere** — not to the
router, not to `customers`. On its own this is already a useful "what is on this router" tool, and
it de-risks everything after it.

**Phase 2 — Profiles → Packages + commit.** Rate-limit parsing, the pricing step, the anchor step,
dry-run, commit into `process_import()`, revert. Includes the `generate_radius_attributes()`
asymmetric fix (§8) as a prerequisite. **This is the "400 clients in one sitting" milestone.**

**Phase 3 — Reconciliation.** CSV merge (§11), comment mining (§10), re-scan diff, per-candidate
operator edits. This is what makes it survive the second and third run.

**Phase 4 — Takeover cutover.** `build_adoption_script()`, the canary flow, `verify-import`,
post-cutover watch, rollback. **This is the "move off Centipede without downtime" milestone.**

**Phase 5 — Optional, only if demand appears.** RADIUS proxy-learn (§7.3), PAP harvest tooling
(§7.2), queue-managed enforcement for static clients (§9c). Each is a real project; none should
block Phases 1–4.

---

## 20. Production test results (2026-07-28) & the fixes they found

> **All five defects below are fixed**, along with the two pending design items
> (async scan/commit, scan-shaped fixtures). Test suite: 52 passing. The
> defect write-ups are kept as the record of *why* each guard exists — every one
> of them now has a named regression test.

All three transports plus commit/revert were exercised against the live Contabo
deployment (`billing.ruirufactorymabati.com`), including a real SSH scan of
**Kifaru** — a hEX lite (RB750r2) on RouterOS **7.23.2** over the management
tunnel. The database was returned to its exact pre-test baseline afterwards
(2 customers, 13 packages, 0 runs).

### What passed

| Check | Result |
|---|---|
| Transport 1 — `/export` upload | 3 subscribers, 3 packages, correct fingerprint |
| Transport 2 — agent ingest, incl. multi-chunk `seq` assembly | reassembled correctly |
| Transport 3 — live SSH scan of a real RouterOS 7.23.2 router | completed in **14.9 s** (~23 commands) |
| **Read-only guarantee on a live router** | `/export` body hash **identical** before/after; object counts unchanged. Only the volatile `# <timestamp> by RouterOS` header differed — confirmed by taking a second control read. |
| Agent script contains no menu writes | verified by regex over the rendered script |
| Passwords absent from list responses | verified — `has_password` only |
| Commit → customers + RADIUS | password `pw one!` preserved **verbatim including the space**; `5M/10M` and `10M/20M` emitted the right way round; static IP → `Framed-IP-Address`; disabled secret → `suspended` with **no** RADIUS rows |
| Revert | 3 created, 3 deleted, RADIUS rows cascaded away, baseline restored |

### Defect 1 — the agent transport is silently broken in production (**high**)

`POST /api/import/router/agent-script` builds its ingest URL from
`request.host_url`, which behind dan-proxy yields **`http://`**. Confirmed live:
that URL returns **301** to the https equivalent, which answers 200.

RouterOS `/tool fetch` is not expected to follow redirects, and every fetch in
the generated script is wrapped in `:do{...} on-error={}` — so the operator sees
`Infora scan uploaded.` and **no data ever arrives**. Silent failure is the worst
possible shape for this. Independently, the script would be shipping subscriber
passwords over plaintext http.

*Fix:* stop deriving the URL from the request. Reuse the existing
`resolve_provision_base_url()` pattern in
[provisioning_scripts.py](backend/server/services/provisioning_scripts.py#L22),
which already solves exactly this for the one-liner (`PUBLIC_BASE_URL` is set on
this server). Add an assertion that the built URL is `https://` — refuse to mint
an agent script otherwise. *Confirm on 7.23.2 whether `fetch` follows the 301;
the fix is required either way because of the plaintext exposure.*

### Defect 2 — RouterOS built-ins are imported as subscribers (**medium**)

The live scan returned one "subscriber": `default-trial`, RouterOS's built-in
counters/limits placeholder. Verified on the router:

```text
.id=*0;comment=counters and limits for trial users;default=true;dynamic=false;name=default-trial
```

`default=true` is a readable property, so the fix is clean: add `default` and
`dynamic` to the emitter field lists for `/ip hotspot user`, `/ppp secret`,
`/ppp profile` and `/queue simple`, and filter them in
[inventory.py](backend/server/services/router_scan/inventory.py). The existing
name-based `STOCK_PROFILE_NAMES` becomes a fallback for exports (an `/export`
omits built-ins anyway, which is why the fixture tests never caught this — a
gap worth closing with a scan-shaped fixture).

This also fixes the `auth_mode` misclassification below.

### Defect 3 — false "missing sensitive policy" alarm (**medium-high**)

Because the only roster entry was that built-in — which has **no** `password`
property at all — `password_readability()` concluded every password was empty and
raised the **blocking** message telling the operator to add the RouterOS
`sensitive` policy. That advice was wrong: the scan user `infora-mgmt` is in
group `full`, whose policy list already includes `sensitive` (verified on the
router). The router simply has zero subscribers.

A scary, blocking, incorrect message is worse than no message — it is exactly the
kind of thing that makes an operator distrust the whole tool.

*Fix:* (a) exclude built-ins from the roster before computing readability, and
return `no-roster` rather than `hidden` when nothing real remains; (b) make the
claim factual instead of inferred — read `/user group print` for the connecting
user's group and only name the `sensitive` policy when it is genuinely absent.
Add `/user` + `/user group` to the read-only allowlist for this.

### Defect 4 — self-contradicting findings text (**low**)

The card said *"authenticates 0 PPPoE subscribers from its own database"* and
*"1 subscribers found"* in consecutive sentences. The `local` branch hardcodes
"PPPoE" and uses `secret_count`, while the password roster also counts hotspot
users.

*Fix:* compose the sentence from the actual per-kind counts, and give the
zero-subscriber case its own wording ("no subscribers configured on this router").

### Defect 5 — `auth_mode` reported `local` on a router with no subscribers

Downstream of Defect 2: `has_local` was true only because of the built-in. Fixed
by the same filter; add a regression test asserting a router with zero real
subscribers classifies as `unknown`, not `local`.

### Still-pending design items this run reinforced

- **Async scan/commit (§13).** 14.9 s for a router with *zero* subscribers is
  fine; the same synchronous request against 400 secrets will be far longer and
  risks the gunicorn worker timeout. The background-job design is no longer
  optional — promote it ahead of new features.
- **Scan-shaped fixtures.** Every parser test feeds `/export` output. The three
  defects above all live in the *emitter* path that only a live scan exercises.
  Capture Kifaru's raw section output as a fixture and test against it.

### Suggested order

1. Defect 1 (broken transport, silent)
2. Defects 2/3/5 (one filter + honest messaging — they share a fix)
3. Defect 4 (wording)
4. Async scan/commit
5. Scan-shaped fixtures

---

## 21. Open questions

1. **Which RouterOS versions must this support?** v6 and v7 differ on `/export` sensitivity, User
   Manager, and some property names. v6.4x+ and v7.x is the assumption above — confirm against the
   actual fleet, and capture fixture output from one of each for the parser tests.
2. **Is the local-secrets-before-RADIUS ordering true on the target builds?** The entire canary
   cutover (§14) rests on it. Needs a lab check before Phase 4 is scoped.
3. **How do operators actually reach these routers?** If most are NAT'd with no tunnel, the
   export-upload and agent-script transports are the product and live SSH is a nice-to-have — which
   changes Phase 1's priorities.
4. **Do we support static/queue-billed clients as billable-but-unenforced (§9c), or refuse them?**
   Half-support is defensible but must be stated in the UI; silently importing them is not.
5. **Real names.** Router logins are often `acct_1042`. If neither a CSV nor a parseable comment
   exists, do we import with the login as the name and let the operator fix it later, or block?
   (Recommend: import, flag, and give a bulk-edit grid — blocking a migration on cosmetics is worse.)
6. **Multi-router ISPs.** One scan per device, or one run spanning several routers? Subscribers can
   appear on more than one NAS. Recommend per-device runs with cross-run duplicate detection on
   `radius_login`.
7. **What happens to the incumbent's accounting history?** Assume it stays behind (as in the
   companion doc §8) — FUP counters and usage graphs start fresh at cutover. Confirm that's
   acceptable, because it's a customer-visible discontinuity if FUP is enforced immediately.
