# Platform subscription — billing the tenant, and locking the console

This is the bill an **ISP pays us** for using the system. It is not the bill an
ISP sends its own subscribers — that is `Invoice` +
`services/subscription_expiry.py`, and the two never touch.

| | Subscriber subscription | Platform subscription |
|---|---|---|
| Who pays | The end customer | The tenant ISP |
| Tables | `invoices`, `payments` | `platform_invoices` |
| Expiry field | `customers.subscription_end` | `isps.subscription_expires_at` |
| Enforcement | RADIUS deprovision — they lose internet | Console 402 — they lose the dashboard |
| Service | `services/subscription_expiry.py` | `services/platform_subscription.py` |
| UI | Subscribers, Billing | `/subscription` |

---

## The one rule that shapes everything

**A lapsed tenant loses the console, never their network.**

RADIUS, the captive portal, provisioning and the TR-069 ACS keep serving
normally while a tenant is locked out. Knocking an ISP's paying subscribers
offline because the ISP is a day late on their own bill would punish the wrong
people and cause an outage the ISP cannot even log in to explain.

The lockout is a business lever, not an outage.

---

## Lifecycle

```
signup ──► trial (14d) ──► invoice issued (7d before expiry)
                                │
                    paid ◄──────┴──────► unpaid
                     │                      │
            expiry += 30d            expiry passes + grace
                     │                      │
                 console open         console LOCKED
```

- **Trial.** `tenant_provisioning._create_isp()` calls `start_trial()`, setting
  expiry to signup + `PLATFORM_TRIAL_DAYS`. Idempotent — it never shortens an
  expiry that already exists.
- **Invoicing.** `flask issue-subscription-invoices` (cron, daily) raises one
  invoice per tenant inside the lead window. A tenant with any pending invoice
  is skipped, so running it twice bills nobody twice.
- **Paying.** M-Pesa STK push to the *platform's* paybill — `initiate_stk_push(...,
  isp=None)` deliberately falls back to the env Daraja credentials rather than
  the tenant's own till. Nothing is paid until Safaricom calls back; the UI polls.
- **Renewal.** `mark_invoice_paid()` extends from `max(now, current expiry)`, so
  paying early adds a period instead of discarding the remainder, and paying
  late does not back-date the tenant straight into another lockout.

**Tenants with no expiry set are never locked.** Every ISP that predates this
feature has `subscription_expires_at IS NULL`, and a deploy must not shut them
all out. Set an expiry to start billing one.

---

## Enforcement, both halves

**Server (the real one)** — `app.enforce_platform_subscription`, a
`before_request` hook. Any `/api/` route, with a valid JWT, belonging to a
locked tenant, returns **402** with `code: subscription_expired` and the
subscription state in the body.

Exempt prefixes (`_PAYWALL_EXEMPT_PREFIXES` in `app.py`) — **anything added here
is reachable while locked, so add deliberately**:

| Prefix | Why |
|---|---|
| `/api/auth` | They could not sign in to see the paywall at all |
| `/api/platform` | It *is* the paywall |
| `/api/support` | Nobody should be trapped with a billing problem and no way to report it |
| `/api/health`, `/api/test` | Monitoring |
| `/api/onboarding` | Signup predates having a tenant |

Requests with no JWT pass straight through — that is device and subscriber
traffic, and it is never gated. The hook also swallows its own exceptions: a
broken paywall must not take the API down with it.

**Client** — `SubscriptionGate` (wrapped around every route by `ProtectedRoute`
and `RoleBasedRoute`, so new pages are covered without being remembered)
redirects to `/subscription`. `AppSidebar` renders every nav item as an inert
`LockedRow` — a disabled `div`, not a greyed anchor, so it cannot be clicked,
middle-clicked, or reached by keyboard.

The client half is fail-open by design: a failed fetch leaves `locked` false.
The server returns 402 regardless, so nothing is actually bypassed — it just
avoids locking someone out over a network blip.

Still reachable in the UI while locked: `/subscription`,
`/settings/contact-support`, `/settings/bug-report`.

---

## Settings

| Env | Default | Meaning |
|---|---|---|
| `PLATFORM_VENDOR_NAME` | `Lumen` | Name shown on the page and invoice |
| `PLATFORM_TRIAL_DAYS` | `14` | Free days from signup |
| `PLATFORM_BILLING_PERIOD_DAYS` | `30` | What one paid period buys |
| `PLATFORM_GRACE_DAYS` | `0` | Days after expiry before the console closes |
| `PLATFORM_ISSUE_LEAD_DAYS` | `7` | How early the next invoice is raised |

Prices live in `PLAN_PRICES` in `services/platform_subscription.py`
(basic 500 / pro 2 500 / enterprise 10 000). A tenant on a negotiated rate
carries `isps.subscription_amount`, which wins.

M-Pesa uses the same env Daraja config as everything else (see `MPESA.md`);
the platform's paybill is whatever `MPESA_SHORTCODE` resolves to with no ISP.

---

## Testing it

Unit tests for the lockout maths: `backend/server/tests/test_platform_subscription.py`.

To see the locked console by hand:

```bash
# lock a tenant
flask shell
>>> from models import ISP; from extensions import db
>>> from datetime import datetime, timedelta
>>> isp = ISP.query.filter_by(slug='acme').first()
>>> isp.subscription_expires_at = datetime.utcnow() - timedelta(days=1)
>>> db.session.commit()

# raise the invoice they now owe
flask issue-subscription-invoices

# ...and to let them back in
>>> isp.subscription_expires_at = datetime.utcnow() + timedelta(days=30)
```

Layout: `services/platform_subscription.py`, `routes/platform.py`
(`/api/platform`), model `PlatformInvoice`, pages
`components/billing/PlatformSubscriptionPage.jsx` +
`components/auth/SubscriptionGate.jsx`, state
`contexts/SubscriptionContext.jsx`. The `platform_invoices` table and the three
`isps` columns are created by `ensure_schema_upgrades()` on boot — **no Alembic
migration**, per house style.
