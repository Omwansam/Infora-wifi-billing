# Self-serve ISP onboarding

How a stranger becomes a provisioned tenant without an operator touching
anything: five wizard steps, a WhatsApp OTP, and a visible provisioning job.

Entry point: **`/signup`** (alias `/get-started`).

---

## 1. Why it exists

Before this, a tenant could only be created two ways and neither was a real
signup:

| Path | Problem |
|---|---|
| `POST /api/auth/register` | Creates a `User` with `role='support'` and **no `isp_id`**. Every console route resolves data through `current_user.isp_id`, so the account it produced could not use the product. |
| `POST /api/website/trial-signup` | Creates `ISP` + admin `User` correctly, but from a single unverified form — no proof of phone or email, no account address, no locale — and only from the marketing site. |

The old `/signup` page posted to the first of those. Anyone signing up through
the app landed in a broken, tenant-less state.

`website_trial_signup` still exists and still works; it is the marketing-site
path. Both now produce the same shape of tenant.

---

## 2. The flow

```
                        ┌──────── onboarding_signups row ────────┐
POST /start    step 1 → │ token issued, OTP hashed + sent        │
POST /verify   step 2 → │ whatsapp_verified_at set   ← the gate  │
POST /account  step 3 → │ slug reserved (advisory)               │
POST /profile  step 4 → │ country / timezone / currency          │
POST /complete step 5 → │ status=provisioning, thread started    │
GET  /status         → │ poll tasks[] until completed            │
                        └────────────────────────────────────────┘
                                        │
                                        ▼
                   1. create account address (ISP row, slug claimed)
                   2. create admin account   (User, role=admin, isp_id)
                   3. send welcome email     (non-fatal)
                   4. finalise               (onboarded_at, completed)
```

**The wizard's position lives on the server.** The client holds an opaque token
and echoes it back; every endpoint re-reads the row and re-checks what has
actually been proven. `POST /complete` with a hand-crafted token but no
`whatsapp_verified_at` returns 403 — that is what stops the OTP from being
decorative.

State is persisted rather than signed into a token because the OTP rate limits,
the attempt lockout and the resumable provisioning job all need somewhere to
count. Same reasoning as `ImportRun` (see `ROUTER_SCAN_IMPORT_AND_TAKEOVER.md`).

---

## 3. Endpoints

All public, all under `/api/onboarding`, all rate-limited.

| Method | Path | Step | Limit |
|---|---|---|---|
| `GET` | `/countries` | — | — |
| `GET` | `/locale` | 4 | 30/60s |
| `POST` | `/start` | 1 | 5/60s per IP **+ 3/hr per phone** |
| `POST` | `/resend` | 2 | 10/300s, 60s cooldown, 5 sends max |
| `POST` | `/change-number` | 2 | 5/300s |
| `POST` | `/verify` | 2 | 10/300s, **5-attempt lockout** |
| `GET` | `/slug-check` | 3 | 60/60s |
| `POST` | `/account` | 3 | 20/60s |
| `POST` | `/profile` | 4 | 20/60s |
| `POST` | `/complete` | 5 | 10/60s → `202` |
| `GET` | `/status` | 6 | 120/60s |
| `GET` | `/session` | — | 60/60s (resume after refresh) |

Rate limiting is per-process (`services/rate_limit.py`), so under multi-worker
gunicorn the effective limit is roughly `limit × workers`. Acceptable as a first
line of defence; move to Redis if that stops being true.

---

## 4. Security notes

- **Codes are stored hashed** (`generate_password_hash`), never in plaintext.
  A verified code is cleared immediately so the hash cannot be replayed.
- **The OTP is never in a response body** except when `WHATSAPP_PROVIDER=log`
  **and** `FLASK_ENV=development`. Both conditions are required — flipping one
  variable in production cannot expose it. See `whatsapp_otp.can_echo_code`.
- **Email enumeration is accepted, deliberately.** `/start` returns an explicit
  409 for an already-registered address, matching `trial-signup` and the
  sign-in page, which leak the same fact. The alternative — silently pretending
  to send a code — produces a flow people cannot complete.
- **Reserved slugs.** `services/tenant_slug.RESERVED_SLUGS` blocks platform
  names. `webfig*` is load-bearing rather than cosmetic: `app.py` dispatches
  `webfig-<id>.*` hostnames straight into a router's WebFig before any other
  routing, so a tenant holding that prefix would shadow a real device proxy.
- **Disposable inboxes are refused.** The signup email is the only recovery
  channel that survives losing the phone.
- **The slug race is settled by the database.** `/slug-check` and `/account` are
  advisory; the name is claimed atomically during provisioning, and the partial
  unique index `uq_isps_slug` is the arbiter. A lost race auto-suffixes rather
  than raising an IntegrityError at the user.

---

## 5. Configuration

### WhatsApp

```bash
WHATSAPP_PROVIDER=log        # log (default) | meta | twilio
WHATSAPP_ENABLED=false       # must be true before anything is actually sent
```

`log` writes the code to the server log and returns it in the response in
development. **The wizard works end to end on `log` with no vendor account** —
that is the point.

Setting a provider is not enough; `WHATSAPP_ENABLED=true` is the live switch.

**Meta WhatsApp Cloud API:**

```bash
WHATSAPP_PROVIDER=meta
WHATSAPP_ENABLED=true
WHATSAPP_META_TOKEN=<permanent access token>
WHATSAPP_META_PHONE_NUMBER_ID=<phone number id>
WHATSAPP_META_TEMPLATE=<approved AUTHENTICATION template name>
WHATSAPP_META_TEMPLATE_LANG=en_US
WHATSAPP_META_TEMPLATE_HAS_BUTTON=true   # copy-code button
WHATSAPP_META_API_VERSION=v21.0
```

Business-initiated messages **must** use a pre-approved template — free text
only reaches a user inside the 24-hour service window, which a new signup is
never in. `WHATSAPP_META_TEMPLATE` is a template *name*, not message copy.

**Twilio:**

```bash
WHATSAPP_PROVIDER=twilio
WHATSAPP_ENABLED=true
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155238886
```

Twilio's *sandbox* requires each recipient to message a join code first, which
is unusable for signup. Use a provisioned sender.

### Email

`services/mailer.py` wraps `smtplib` around the `MAIL_*` settings already in
`config.py`. With `MAIL_SERVER` unset it logs instead of sending, and
provisioning still completes — a bounced welcome email leaves a perfectly usable
account, so it is never fatal.

### Account address

```bash
TENANT_BASE_DOMAIN=lumenbilling.com   # optional
```

Unset, it derives from `BRAND_WEBSITE` in `services/brand_constants.py`, so the
address shown at signup is branded rather than blank. The slug is currently
**stored and reserved** — one app host still serves every tenant. Wildcard DNS,
wildcard TLS and per-tenant vhosts can land later without a schema change.

### Other

```bash
SIGNUP_EMAIL_MX_CHECK=false   # optional MX lookup; fails open
```

---

## 6. Schema

| Object | Notes |
|---|---|
| `onboarding_signups` | New table — the wizard state machine. |
| `isps.slug` | Permanent account address. Unique, case-insensitive, immutable. |
| `isps.country` / `.timezone` / `.referral_source` / `.onboarded_at` | Operating locale. `isps.currency` predates this and is reused. |
| `users.whatsapp_number` / `.whatsapp_verified_at` / `.email_verified_at` | Verified contact. |

Two rollout paths, because production ships without Alembic:

- **Dev:** `flask db upgrade` → `a1b2c3d4e5f8_onboarding_signups.py`
- **Prod:** `ensure_schema_upgrades()` in `app.py` adds the columns, creates the
  table with `checkfirst=True`, and creates `uq_isps_slug`.

Both are idempotent and either order succeeds. `backfill_isp_slugs()` gives
pre-onboarding ISPs an address derived from their name, so the column is never
NULL.

> Do **not** run `flask db migrate` against production — see the deploy notes.
> `ensure_schema_upgrades` is the production path.

---

## 7. Frontend

```
src/components/onboarding/
  OnboardingWizard.jsx     owns step + token; resumes from sessionStorage
  OnboardingLayout.jsx     constellation backdrop, card, theme toggle
  StepIndicator.jsx        the 1–5 pips
  Step1Identity.jsx        name, email, dial-code + number
  Step2Verify.jsx          6 code boxes, countdown, resend
  Step3Account.jsx         debounced live slug check
  Step4Locale.jsx          verified summary + country/tz/currency
  Step5Password.jsx        strength meter + terms
  ProvisioningScreen.jsx   polls /status, renders the 4 tasks
  passwordStrength.js      scoring (coaching only — server enforces length)
  onboarding.css           scoped tokens; not a global theme change
src/services/onboardingService.js
```

Two things worth knowing before editing:

- **`apiCall` never throws.** It returns `{success: false, error}`. Call sites
  elsewhere in this codebase check `if (response.success)` and silently drop the
  failure branch, which in a signup wizard reads as a dead button.
  `onboardingService.js` unwraps once and always returns `{ok, data, error}`;
  keep it that way.
- **`onboarding.css` is scoped to `.onb`** so the wizard can look nothing like
  the console without shifting existing screens. Input rules are written as
  `.onb .onb__input` on purpose: `index.css` carries a global
  `.dark input { @apply bg-slate-900 }` that otherwise outranks a single class
  and tints every field navy.

---

## 8. Verifying it

```bash
# 1. Backend (host Postgres owns 5432 — use the venv, not compose)
cd backend/server && FLASK_ENV=development WHATSAPP_PROVIDER=log \
  PYTHONPATH=. ../.venv/bin/python app.py

# 2. Tests
backend/.venv/bin/python -m pytest backend/server/tests -q

# 3. Frontend
cd FRONTEND/infora_billing && npm run dev
```

Walk `/signup`. The OTP prints to the backend terminal and is shown in a
development banner on step 2.

**The check that matters** — the old path failed exactly here:

```sql
select i.slug, i.name, i.country, i.currency, u.email, u.role, u.isp_id
from isps i join users u on u.isp_id = i.id
order by i.id desc limit 1;
```

`role` must be `admin` and `isp_id` must be non-NULL. Then sign in with the new
credentials and confirm the console loads.

**Negative paths worth re-checking after changes:**

| Input | Expected |
|---|---|
| Wrong OTP ×5 | locked out, new code required |
| Expired OTP | 410, "request a new one" |
| Resend within 60s | 429 with `resend_in` |
| `www`, `webfig1` | reserved |
| Existing slug | taken, with a suggestion |
| `x@mailinator.com` | disposable, refused |
| Duplicate email | 409, "sign in instead" |
| `/complete` without verification | 403 |
| `/complete` missing step 3 or 4 | 400 naming the missing piece |
