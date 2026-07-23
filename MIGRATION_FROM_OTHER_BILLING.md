# Migrating an ISP from another billing system onto Infora

**Status:** **implemented.** The identity change (§4) and the bulk CSV importer (§7) are now
built — model columns `radius_login` + `account_number`, the `radius_username()` switch, the
`POST /api/customers/import` endpoint with dry-run, and the **Import clients** wizard under
Clients. The rest of the document remains the operator runbook. See §12 for the as-built notes.

**Scenario.** An operator runs ~50 subscribers on another billing/RADIUS system (call it
**"Centipede"** — the mechanics generalise to Splynx, UISP/UCRM, Powercode, Radius Manager,
MikroTik User-Manager, daloRADIUS, freeside, etc.) and wants to move to Infora without
making every customer reconfigure their router or losing a day of uptime.

---

## 0. TL;DR

- **50 clients is small.** The whole move is: export a spreadsheet → create matching
  **plans** in Infora → **import the clients** → point the **MikroTik's RADIUS** at Infora →
  test a few → cut over. No API-to-API sync needed.
- **The one hard problem is identity.** Infora currently derives every subscriber's PPPoE
  login from their **email** (`radius_username()` = lowercased email). Most old systems use
  an arbitrary **username** (e.g. `john_kabete`) and store a **PPPoE password**. To migrate
  *without touching 50 routers*, Infora must let an imported client **keep their existing
  username + password**. That needs one schema addition (`radius_login`) — see §4 & §7.
- **The migration feature to build is a bulk CSV importer** with a dry-run preview (§7).
  Until it exists, the same result is achievable by scripted `POST /api/customers` calls or
  careful manual entry (feasible at 50).
- **Cut over at the router, not the client.** Because auth is centralised in RADIUS,
  flipping the MikroTik's `/radius` to Infora switches all subscribers at once — *provided
  their credentials already exist in Infora first.*

---

## 1. What actually has to move

| From the old system | Why it matters | Infora home |
|---|---|---|
| **Subscribers** (name, login, password, phone, plan, expiry, status, balance) | The core of it | `Customer` + RADIUS rows |
| **Tariffs / plans** (speed, price, cycle, data cap) | Clients reference them | `ServicePlan` |
| **Session credentials** (PPPoE user+pass, or hotspot MAC) | Keeps CPE working untouched | `radcheck` / `radreply` |
| **Expiry / next-due date** | So nobody is cut off mid-cycle | `Customer.subscription_end` → RADIUS `Expiration` |
| **Outstanding balance** | Money owed | `Customer.balance` (+ optional `Invoice`) |
| **Static IPs / MACs** | Fixed-IP or hotspot clients | `radreply` Framed-IP / `callingstationid` |
| **Payment history** *(optional)* | Reporting continuity | `Invoice` / `Payment` (usually skipped) |
| **KYC / ID docs** *(optional)* | Compliance | `Customer.id_number`, `kyc_status` |

Router/NAS config does **not** migrate — Infora re-provisions the MikroTik with its own
script (`build_radius_script`), which is part of the cutover, not the data import.

---

## 2. Getting the data out of the old system

Ranked by how clean the result is:

1. **Native export / report → CSV** (Splynx, UCRM, Powercode all have this). Best case.
2. **Direct DB dump** (Radius Manager, daloRADIUS, User-Manager are MySQL/SQLite). Query
   `radcheck`/`users`/`services` tables — you get **cleartext or recoverable PPPoE
   passwords**, which is the gold case (lets you preserve credentials).
3. **API pull** if the vendor has one. Overkill for 50.
4. **Manual transcription** into the CSV template (§7). Tolerable at this scale as a fallback.

**The critical question to answer first:** *can you export the subscribers' PPPoE
passwords in cleartext?*
- **Yes** → import them; **no customer touches their router**. Smoothest possible cutover.
- **No** (only bcrypt/MD5 hashes) → you must **re-issue** passwords in Infora and have each
  CPE re-entered. At 50 clients that's a scheduled-maintenance job, not a blocker, but it
  changes the plan — front-load customer comms.

---

## 3. How the fields map into Infora (the real model)

Infora is multi-tenant: everything hangs off an **ISP** (`Customer.isp_id`), and RADIUS is
scoped per-ISP with its own shared secret (`resolve_isp_radius_secret`). So step zero is
"which ISP am I importing into." Then, per subscriber, creation writes the same rows
`provision_customer_radius()` writes today
([radius_provisioning.py](backend/server/services/radius_provisioning.py)):

- `Customer` row — `full_name`, `email`, `phone`, `connection_type` (`pppoe`/`hotspot`/
  `wireguard`), `service_plan_id`, `status`, `subscription_end`, `balance`.
- `radcheck` — `Cleartext-Password` = the subscriber's password.
- `radreply` — `Mikrotik-Rate-Limit` (from the plan), `Expiration` (from
  `subscription_end` via `format_radius_expiration`), optional `Framed-IP-Address` for static.
- `radusergroup` — ties them to the `plan_<id>` group.

**Plans first.** Create a `ServicePlan` per old tariff (name, `plan_type`, `speed` /
`bandwidth_limit`, `billing_cycle_days`, `price`, and FUP/data-cap in `features`). At ~a
handful of tariffs this is a few minutes in the Packages UI. The importer then maps each
client to a plan **by name**.

---

## 4. The identity problem (why a schema change is needed)

Today: `radius_username(customer)` returns `customer.email.strip().lower()`
([radius_provisioning.py](backend/server/services/radius_provisioning.py)), and the PPPoE
login **is** that email. This is fine for greenfield signups but wrong for migration because:

- Old PPPoE logins are usually **not emails** (`john_kabete`, `acct_1042`). Forcing them to
  become emails means **reconfiguring every CPE** — the thing we're trying to avoid.
- Some imported subscribers may **not have an email at all** (rural PPPoE), yet `Customer.email`
  is required and unique.

**Design decision (recommended):** add an optional **`radius_login`** column to `Customer`.
`radius_username()` returns `customer.radius_login or customer.email.lower()`. Then an
imported client keeps their exact original username, `radcheck` is written under that
username, the MikroTik keeps dialing the same credentials, and **nothing changes on the
customer side**. Email becomes optional/synthetic for logins that don't have one
(e.g. `login@imported.local`). This single change is what makes a zero-touch cutover
possible; it's also generally useful (operators often want a login ≠ email).

> Alternative if you don't add `radius_login`: re-issue every login as an email and accept
> mass CPE reconfiguration. Viable at 50 but a worse customer experience.

---

## 5. Cutover strategy

Two viable shapes; pick per risk tolerance.

**A. Parallel / soft cutover (recommended).**
1. Import all subscribers into Infora (old system still authoritative).
2. On the MikroTik, **add** Infora as a *second* RADIUS server (leave the old one primary),
   or point a **test router / one PPPoE profile** at Infora.
3. Move a handful of pilot clients, confirm auth + accounting + speed + expiry.
4. Flip the MikroTik's primary `/radius` to Infora (run Infora's provisioning script),
   drop the old RADIUS entry. All clients now authenticate against Infora at once.
5. Watch **Online Users** / **Accounting** fill up; keep the old box read-only for a week.

**B. Hard cutover.** Import everyone, then during a maintenance window run
`build_radius_script` on the router (repoints `/radius`, sets `use-radius=yes`, removes
FastTrack, adds NAT). Faster, less safe — only if the import is verified.

**Non-negotiable ordering:** subscribers must exist in Infora's `radcheck` **before** the
router points at Infora, or every session fails auth. Import → then repoint.

---

## 6. Migration runbook (operator-facing)

1. **Pick/confirm the ISP** in Infora; confirm its RADIUS secret and that the billing
   server is reachable (Settings → RADIUS, `flask verify-deployment`).
2. **Export** subscribers + tariffs from the old system (§2). Note whether passwords are
   cleartext.
3. **Create plans** in Packages to match each tariff (name them to match the export).
4. **Fill the import CSV** (§7 schema). Map each client's tariff to a plan name.
5. **Dry-run import** → review the report (creates / skips / errors: dup emails, unknown
   plan, bad dates). Fix the CSV. Repeat until clean.
6. **Commit import** → customers created + RADIUS provisioned, preserving login/password and
   `subscription_end`.
7. **Spot-check** in RADIUS Users / Client detail: login, plan group, rate-limit, expiry,
   revealed password (Reveal button) match the old system.
8. **Pilot** a few CPEs against Infora (strategy A).
9. **Cut over** the router(s) to Infora RADIUS; verify Online Users populates.
10. **Decommission** the old system after a soak period; keep its export archived.

---

## 7. Design to build later — the Bulk Client Importer

**Model change:** `Customer.radius_login` (nullable) + update `radius_username()` (§4);
add via migration + `ensure_schema_upgrades` (same pattern as `fup_throttled`).

**CSV schema** (one row per subscriber):

```csv
name,login,password,email,phone,plan,connection_type,status,subscription_end,balance,static_ip,mac
John Kabete,john_kabete,S3cret!,john@x.com,0712345678,Home 8M,pppoe,active,2026-08-15,0,,
Mary W,,,mary@x.com,0722000000,Hotspot Day,hotspot,active,2026-07-25,0,,AA:BB:CC:DD:EE:FF
```

- `login` blank → fall back to `email`. `password` blank → auto-generate (customer must
  reconfigure). `plan` matches a `ServicePlan.name` in the target ISP. `subscription_end`
  drives the RADIUS `Expiration`.

**Backend:** `services/customer_import.py` + `POST /api/customers/import`
(multipart CSV or JSON array, admin, ISP-scoped) with a `dry_run` flag.
- Parse → validate each row (plan resolves, email/login unique, valid date, valid
  connection_type/status).
- **Dry-run:** return `{would_create, skipped, errors[]}` — no writes.
- **Commit:** per row, create `Customer` (with `radius_login`), set `subscription_end`,
  and for active clients call the **existing** `provision_customer_radius()` so radcheck/
  radreply/radusergroup are written exactly like a normal signup — reuse, don't reinvent.
  Wrap in a transaction; report per-row success/failure.
- Reuse `set_customer_radius_password` so imported cleartext passwords are stored encrypted
  too (Reveal/reset keeps working).

**Frontend:** an **Import clients** wizard (under Clients, or Settings): download CSV
template → upload → column-map (if headers differ) → **dry-run preview** table (green
create / amber skip / red error) → confirm → results summary with a downloadable error CSV.

**Optional later:** a tariff/plan CSV importer (usually unnecessary — few plans); a
historical `Invoice`/`Payment` importer for reporting continuity (most operators skip it).

---

## 8. Edge cases & data quality

- **Duplicate / missing emails** — email is unique + required today. The `radius_login`
  change lets email be optional/synthetic; importer must dedupe and synthesise where needed.
- **Password recoverability** — the single biggest determinant of "zero-touch" vs
  "reconfigure everyone" (§2). Establish this on day one.
- **Plan name mismatches** — dry-run must fail loudly on an unmapped tariff rather than
  silently assigning a default.
- **Expiry semantics** — old "next due date" vs Infora `subscription_end`; import as the
  cut-off so no active client drops. FreeRADIUS enforces `Expiration`.
- **Hotspot vs PPPoE** — hotspot identity is the **MAC** (`callingstationid`), not a
  login/password; import MACs for hotspot rows. PPPoE is login/password.
- **Static IPs** — carry as `Framed-IP-Address` in `radreply`.
- **Accounting history resets** — live sessions/usage start fresh on Infora; FUP counters
  begin at cutover. Communicate this if FUP is enforced immediately.
- **Timezone** on expiry timestamps (old export may be local; Infora stores UTC).

## 9. Rollback

Because it's a soft cutover, rollback = **repoint the MikroTik `/radius` back to the old
server** (or promote the old RADIUS entry). Infora data stays; no destructive step happens
on the customer side. Keep the old system live and the export archived until the soak passes.

## 10. Scale note

At **50 clients** this is comfortably a **CSV-import + one maintenance window** job, not a
project. The importer (§7) turns it into ~15 minutes of work plus verification; even without
it, scripted `POST /api/customers` over the export covers it. Reserve API-to-API sync and
historical-invoice migration for large (1000+) or accounting-critical moves.

## 11. Open questions for the operator

- Which system exactly, and **can it export cleartext PPPoE passwords**? (decides zero-touch)
- Keep original logins (needs `radius_login`) or re-issue email logins (mass CPE reconfig)?
- Migrate **billing history** (invoices/payments) or start balances clean?
- One ISP tenant or several? One router or many to repoint?
- Any **static-IP** or **hotspot-MAC** clients in the 50, or all dynamic PPPoE?

## 12. As-built notes (what shipped)

**Identity (§4).** `Customer.radius_login` (nullable) added; `radius_username()` now returns
`radius_login or email` (lowercased). `Customer.email` is now **optional** (nullable, still
globally unique when present). Every reverse login→customer lookup goes through the new
`find_customer_by_login()` (radius_login first, email fallback) — RADIUS auth, portal login,
usage reports, health check, and the live-sessions mapping. Editing a client's login rewrites
its RADIUS rows (old username purged, re-provisioned under the new one).

**Account number (§3, new).** `Customer.account_number` (unique per ISP) — format
`<PREFIX>-<seq>` e.g. `INF-100001`, from `ISP.account_number_prefix` (falls back to a 3-letter
slug of the ISP name) + an atomic per-ISP counter `ISP.account_number_seq`. Auto-assigned on
every create path via `ensure_account_number()`, operator-overridable, carried through on
import. It's the M-Pesa STK **AccountReference** for non-invoice payments. Existing customers
are backfilled on boot (`backfill_account_numbers()` in `app.py`).

**Password (§ new).** Create/reset already accepted an operator password; the Add-Client form
now exposes a generate-vs-manual toggle, and the importer honours a `password` column (blank →
generated, flagged as *needs reconfigure*).

**Importer (§7).** `services/customer_import.py` (`parse_csv` with header aliasing → clean →
validate → dry-run/commit, each committed row isolated in a SAVEPOINT, reusing
`provision_customer_radius`), `POST /api/customers/import` (JSON `{csv|rows, dry_run,
plan_map, create_plans, default_status}`) and `GET /api/customers/import/template`. Static IP
→ `Framed-IP-Address`; hotspot MAC → `Calling-Station-Id`. Frontend: **Import clients** wizard
at `/clients/import`. Uses stdlib date parsing (no `dateutil` dependency).

**Auto-cleaning (the "clean until it imports" layer).** Deterministic fixes are applied
automatically and reported, not surfaced as errors: **status synonyms** (`churned`/`expired`/
`disabled`→`suspended`, `enabled`/`online`→`active`, `new`/`trial`→`pending`; unknown →
`default_status`), phone normalisation, loose dates, casing. **Plans** are resolved by:
explicit operator `plan_map` → exact name → **unambiguous speed auto-match** (one existing plan
at that speed number, e.g. `20MBPS`→the sole 20M package) → **auto-create** (default:
`auto_create_plans=True`). So a package that matches nothing is **created automatically** as a
placeholder (speed derived from the name, price 0 — set pricing in Packages after), and the row
imports without blocking. The dry-run still lists these under `plan_resolutions` so the operator
can **override to map to an existing package** in the wizard's Resolve-packages step; genuinely
unmatched entries only occur when `auto_create_plans` is turned off.

**Schema.** All additions are idempotent in `ensure_schema_upgrades()` (columns, `email DROP
NOT NULL`, partial unique indexes on `(isp_id, lower(radius_login))` and
`(isp_id, account_number)`). No Alembic, matching the existing pattern.
