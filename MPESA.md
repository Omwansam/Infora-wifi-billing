# M-Pesa (Safaricom Daraja) — Setup, Testing & Reference

Everything you need to register a **Daraja sandbox app**, wire it into this billing
system, and test the payment flow end-to-end (STK Push / Lipa na M-Pesa Online),
plus how it works internally and what to put in your `.env`.

This guide is specific to **this codebase** — the endpoints, env vars, and callback
shapes below match the real implementation in `backend/server`.

---

## 1. How it works (architecture)

Payments use **STK Push** (a.k.a. *Lipa na M-Pesa Online* / `mpesa/stkpush/v1/processrequest`):
the server pushes a PIN prompt to the customer's phone; the customer enters their
M-Pesa PIN; Safaricom then calls **back** to our webhook with the result.

```
                                  (1) STK push request (server → Daraja)
  Customer phone  ◄───────────────────────────────────────────  Billing backend
        │  (2) PIN prompt appears on phone                            │
        │  (3) customer enters M-Pesa PIN                             │
        ▼                                                             │
   Safaricom  ────(4) POST result to CallBackURL──────────────►  /api/payments/mpesa/callback
                                                                      │
                                                                      ▼
                                            payment marked COMPLETED, invoice PAID,
                                            customer RADIUS access activated, receipt stored
```

**Two credential layers (important):**

Credentials are resolved **per-ISP first, then global env fallback**
(`resolve_mpesa_config()` in `backend/server/services/mpesa_service.py`):

1. **Per-ISP** — `Settings → Payments` in the admin UI writes a `payment_settings`
   row (Daraja key/secret/passkey/shortcode/callback/env, encrypted at rest). Each
   tenant can collect into their own paybill/till.
2. **Global env fallback** — any field an ISP leaves blank falls back to the
   `MPESA_*` variables in the backend `.env`. A shared sandbox key therefore works
   out of the box for every ISP.

**Key source files**

| Concern | File |
|---|---|
| Daraja client (auth token, STK push, callback parse, phone normalize) | `backend/server/services/mpesa_service.py` |
| Post-payment business logic (invoice PAID, RADIUS activation, receipt) | `backend/server/services/payment_processor.py` |
| Admin payment endpoints (STK push / callback / status) | `backend/server/routes/payments.py` |
| Customer captive-portal payment endpoints | `backend/server/routes/portal.py` + `services/portal_service.py` |
| Per-ISP payment settings API | `backend/server/routes/settings.py` (`/api/settings/payments`) |
| Env defaults | `backend/server/config.py` (`MPESA_*`) |
| Per-ISP settings model | `backend/server/models.py` → `PaymentSettings` |

---

## 2. Register a sandbox app on Daraja

1. **Create a developer account** at <https://developer.safaricom.co.ke> and log in.
2. Go to **My Apps → Create App** (or **Add a New App**).
   - Give it a name (e.g. `infora-billing-sandbox`).
   - Tick the products: **Lipa Na M-Pesa Sandbox** (and *M-Pesa Sandbox* if shown).
   - Create the app.
3. Open the app → copy its **Consumer Key** and **Consumer Secret**.
   These are your `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET`.
4. **Sandbox test credentials** (provided by Safaricom for everyone — used for the
   STK Push simulator; find them under **APIs → Lipa Na M-Pesa Online → Simulate**):

   | Field | Sandbox test value |
   |---|---|
   | Base URL | `https://sandbox.safaricom.co.ke` |
   | Business ShortCode (Paybill) | `174379` |
   | Passkey | `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919` |
   | Transaction type | `CustomerPayBillOnline` |
   | Test MSISDN (phone) | `254708374149` |

   > The passkey above is Safaricom's **public sandbox passkey** — copy the current
   > one from the Daraja portal if it differs. In production you get a **different,
   > private passkey** tied to your real shortcode (see §7).

5. (Optional but recommended) Use the portal's **STK Push Simulator** once to confirm
   your consumer key/secret and shortcode work before wiring the app.

---

## 3. Environment variables

The backend reads these from the environment (see `backend/server/config.py`). They
are the **global fallback**; per-ISP values in `Settings → Payments` override them.

Add to your backend `.env` (docker-compose passes them through to `flask_app` — see
`docker-compose.prod.yml`):

```dotenv
# ---------------- M-Pesa / Daraja ----------------
# sandbox | production   (controls which Daraja base URL is used)
MPESA_ENVIRONMENT=sandbox

# From your Daraja app (My Apps → your app)
MPESA_CONSUMER_KEY=your_sandbox_consumer_key
MPESA_CONSUMER_SECRET=your_sandbox_consumer_secret

# Lipa na M-Pesa Online (STK) shortcode + passkey.
# Sandbox test values:
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919

# CustomerPayBillOnline (paybill) or CustomerBuyGoodsOnline (till).
# Leave default unless you use a Buy Goods till.
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline

# PUBLIC HTTPS URL Safaricom will POST the result to. MUST be reachable from
# the internet and end in this exact path. localhost will NOT work (see §4).
MPESA_CALLBACK_URL=https://<your-public-host>/api/payments/mpesa/callback
```

Notes:
- `MPESA_CALLBACK_URL` **default** in `config.py` is
  `http://localhost:5000/api/payments/mpesa/callback` — fine for reading code, but
  Safaricom cannot reach localhost, so callbacks silently never arrive. Always set a
  public URL when actually testing (§4).
- In production the example (`config/deployment/production.env.example`) uses
  `MPESA_ENVIRONMENT=production` and an HTTPS domain callback. Keep sandbox and
  production values in separate env files.
- Secrets belong only in `.env` (git-ignored). Never commit real keys.

Related public-URL vars already in this project (used elsewhere, handy to have set):
`PUBLIC_BASE_URL`, `PUBLIC_SERVER_HOST` — your HTTPS domain / server IP.

---

## 4. Make the callback reachable (sandbox)

Safaricom must POST to `MPESA_CALLBACK_URL` from the public internet. For local dev,
expose your backend with a tunnel and use the tunnel URL as the callback.

**Option A — Cloudflare Tunnel (no account needed):**
```bash
# backend running on :5000 (dev) or :5080 (docker prod mapping)
cloudflared tunnel --url http://localhost:5000
# → prints https://<random>.trycloudflare.com
```
Then set:
```dotenv
MPESA_CALLBACK_URL=https://<random>.trycloudflare.com/api/payments/mpesa/callback
```

**Option B — ngrok:**
```bash
ngrok http 5000
# → https://<random>.ngrok-free.app
MPESA_CALLBACK_URL=https://<random>.ngrok-free.app/api/payments/mpesa/callback
```

Restart the backend (or update `Settings → Payments → Callback URL`) after changing it.

> The callback endpoint (`/api/payments/mpesa/callback`) is **public / no JWT** — it
> must be, because Safaricom calls it. It always replies `{"ResultCode":0}` so
> Safaricom doesn't retry, and looks up the payment by `CheckoutRequestID`.

---

## 5. Configure the app (two ways)

**Way 1 — Global env only (simplest for testing):** set the `MPESA_*` vars in §3 and
restart. Every ISP with blank Daraja fields uses these.

**Way 2 — Per-ISP via the admin UI:** log in as admin → **Settings → Payments**:
- **Collection route**: `paybill` (→ `CustomerPayBillOnline`) or `buygoods` (till →
  `CustomerBuyGoodsOnline`) or `bank`.
- **Daraja env**: `sandbox` / `live`
- **Consumer key / secret**, **passkey**, **shortcode**, **callback URL**
  (secret + passkey are stored encrypted).

API equivalent (`routes/settings.py`):
```bash
# Read current settings
curl -s https://<host>/api/settings/payments -H "Authorization: Bearer $TOKEN"

# Update (per-ISP)
curl -s -X PUT https://<host>/api/settings/payments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "daraja_env": "sandbox",
    "collection_route": "paybill",
    "daraja_consumer_key": "xxx",
    "daraja_consumer_secret": "yyy",
    "daraja_shortcode": "174379",
    "daraja_passkey": "bfb279f9...c919",
    "daraja_callback_url": "https://<host>/api/payments/mpesa/callback"
  }'
```
Per-ISP values win; blanks fall back to env.

---

## 6. Test the payment flow

### 6.1 Sanity-check credentials — get an OAuth token directly from Daraja
```bash
curl -s "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials" \
  -H "Authorization: Basic $(printf '%s:%s' "$MPESA_CONSUMER_KEY" "$MPESA_CONSUMER_SECRET" | base64)"
# → {"access_token":"...","expires_in":"3599"}
```
If you get a token, your key/secret + environment are correct. (`get_access_token()`
does exactly this internally.)

### 6.2 Log in to the billing API (for the app endpoints)
```bash
TOKEN=$(curl -s -X POST https://<host>/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}' | jq -r .access_token)
```

### 6.3 Trigger an STK push through the app

**Admin path** — pay an invoice or top up a customer (`routes/payments.py`):
```bash
curl -s -X POST https://<host>/api/payments/mpesa/stk-push \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"customer_id": 1, "phone": "254708374149", "amount": 1}'
# Optionally add "invoice_id": <id> to pay a specific invoice (amount is taken from it).
```
Success response:
```json
{ "ok": true, "message": "Success. Request accepted for processing",
  "data": { "payment_id": 12, "checkout_request_id": "ws_CO_...",
            "merchant_request_id": "..." } }
```
This creates a `Payment` row with status **PENDING** keyed by `CheckoutRequestID`.

**Customer captive-portal paths** (public, no JWT — `routes/portal.py`):
```bash
# Hotspot voucher purchase
curl -s -X POST https://<host>/api/portal/hotspot/purchase \
  -H "Content-Type: application/json" \
  -d '{"isp_id":1,"plan_id":5,"phone":"254708374149","full_name":"Test User"}'

# PPPoE package renewal
curl -s -X POST https://<host>/api/portal/pppoe/pay \
  -H "Content-Type: application/json" \
  -d '{"isp_id":1,"account":"john","phone":"254708374149","plan_id":5}'
```

### 6.4 The callback (result)

- **On a real phone** (your own number in sandbox), you'll get the PIN prompt; enter
  the PIN and Safaricom POSTs the result to your `MPESA_CALLBACK_URL`.
- **Sandbox test number `254708374149`** can't enter a PIN — so **simulate the
  callback** yourself to exercise the full success path (this is the same body
  Safaricom sends; parsed by `parse_callback_payload()`):

**Simulate SUCCESS** (use the `CheckoutRequestID` from step 6.3):
```bash
curl -s -X POST https://<host>/api/payments/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": { "stkCallback": {
      "MerchantRequestID": "xxx",
      "CheckoutRequestID": "ws_CO_PASTE_FROM_STEP_6.3",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": { "Item": [
        { "Name": "Amount", "Value": 1 },
        { "Name": "MpesaReceiptNumber", "Value": "TEST123456" },
        { "Name": "PhoneNumber", "Value": 254708374149 },
        { "Name": "TransactionDate", "Value": 20260722153000 }
      ] } } } }'
```
Effect (`complete_successful_payment()`): payment → **COMPLETED**, invoice → **PAID**,
receipt stored, a `Transaction` recorded, and the customer's RADIUS access is
activated (`activate_customer_after_payment`).

**Simulate FAILURE** (e.g. user cancelled — `ResultCode != 0`):
```bash
curl -s -X POST https://<host>/api/payments/mpesa/callback \
  -H "Content-Type: application/json" \
  -d '{ "Body": { "stkCallback": {
        "CheckoutRequestID": "ws_CO_PASTE_FROM_STEP_6.3",
        "ResultCode": 1032, "ResultDesc": "Request cancelled by user" } } }'
```
Effect: payment → **FAILED**.

### 6.5 Check payment status
```bash
# Admin
curl -s https://<host>/api/payments/mpesa/status/<checkout_request_id> \
  -H "Authorization: Bearer $TOKEN"
# Portal (public — used by the captive portal to poll)
curl -s https://<host>/api/portal/payment/status/<checkout_request_id>
# → { "ok": true, "data": { "status": "completed", "receipt": "TEST123456", ... } }
```

---

## 7. STK Push Query (optional — ask Daraja the real status)

Instead of waiting for the callback you can query Safaricom directly. This project
doesn't ship a helper for it, but it's the same auth + password:

```bash
TS=$(date +%Y%m%d%H%M%S)
PW=$(printf '%s%s%s' "$MPESA_SHORTCODE" "$MPESA_PASSKEY" "$TS" | base64 -w0)
curl -s -X POST https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query \
  -H "Authorization: Bearer $DARAJA_TOKEN" -H "Content-Type: application/json" \
  -d "{\"BusinessShortCode\":\"$MPESA_SHORTCODE\",\"Password\":\"$PW\",\"Timestamp\":\"$TS\",\"CheckoutRequestID\":\"ws_CO_...\"}"
```
The `Password` is `base64(Shortcode + Passkey + Timestamp)` — exactly what
`_generate_password()` builds for the push.

---

## 8. Going live (production)

1. Apply for **Go Live** on the Daraja portal; get your **production** app
   (consumer key/secret) and your **real shortcode + passkey** (Paybill/Till).
2. Set production env (separate file):
   ```dotenv
   MPESA_ENVIRONMENT=production
   MPESA_CONSUMER_KEY=<prod key>
   MPESA_CONSUMER_SECRET=<prod secret>
   MPESA_SHORTCODE=<your paybill/till>
   MPESA_PASSKEY=<your production passkey>
   MPESA_CALLBACK_URL=https://<your-domain>/api/payments/mpesa/callback
   ```
   `MPESA_ENVIRONMENT=production` flips the base URL to `https://api.safaricom.co.ke`
   (`_is_live()` accepts `live`/`production`/`prod`).
3. Callback URL **must be HTTPS** and whitelisted/registered on the portal. No
   self-signed certs, no IP, no port tricks — a clean public domain.
4. Buy Goods (till)? Set collection route to `buygoods` (per-ISP) so the transaction
   type becomes `CustomerBuyGoodsOnline`.
5. Verify a real small payment (e.g. KES 1) end-to-end before opening to customers.

---

## 9. Field & payload reference

**STK push payload the server builds** (`initiate_stk_push`):
`BusinessShortCode, Password, Timestamp, TransactionType, Amount, PartyA,
PartyB, PhoneNumber, CallBackURL, AccountReference, TransactionDesc`.
- `Amount` is integer-rounded (`int(round(amount))`) — no cents.
- `AccountReference` truncated to **12** chars; `TransactionDesc` to **13**.
- Phone is normalized to `2547XXXXXXXX` (`_normalize_phone`): `07…`→`2547…`,
  `7…`/`1…`→`254…`.

**Callback fields parsed** (`parse_callback_payload`): `MerchantRequestID`,
`CheckoutRequestID`, `ResultCode` (0 = success), `ResultDesc`, and from
`CallbackMetadata.Item`: `Amount`, `MpesaReceiptNumber`, `PhoneNumber`,
`TransactionDate`.

**Endpoints**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/payments/mpesa/stk-push` | JWT | Admin: push for invoice / top-up |
| POST | `/api/payments/mpesa/callback` | public | Safaricom result webhook |
| GET | `/api/payments/mpesa/status/<checkoutRequestID>` | JWT | Admin: payment status |
| POST | `/api/portal/hotspot/purchase` | public | Customer: buy hotspot package |
| POST | `/api/portal/pppoe/pay` | public | Customer: renew PPPoE package |
| GET | `/api/portal/payment/status/<checkoutRequestID>` | public | Portal: poll status |
| GET/PUT | `/api/settings/payments` | JWT | Per-ISP Daraja config |

**DB tables:** `payments` (status: pending → completed/failed, `mpesa_checkout_request_id`,
`mpesa_receipt_number`), `payment_settings` (per-ISP Daraja config), `transactions`
(ledger entry on success), `invoices` (flipped to PAID).

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `M-Pesa consumer key/secret not configured` | `MPESA_CONSUMER_KEY`/`SECRET` empty in env **and** ISP settings. |
| `Invalid Access Token` / 401 from Daraja | Wrong key/secret, or key is for the other environment (sandbox key used against `api.safaricom.co.ke`). Check `MPESA_ENVIRONMENT`. |
| `Bad Request - Invalid Timestamp` | Server clock skew — sync time (NTP). Password/timestamp are generated together. |
| `Invalid PhoneNumber` | Use full `2547XXXXXXXX`; the app normalizes common formats but not garbage. |
| STK returns OK but **no callback ever arrives** | `MPESA_CALLBACK_URL` not publicly reachable (localhost / http / firewall). Use a tunnel (§4); simulate the callback (§6.4) to verify the handler. |
| Callback arrives but payment stays PENDING | `CheckoutRequestID` in the callback doesn't match any `Payment` row — you pushed with different creds/shortcode than expected, or posted a stale ID. |
| `M-Pesa shortcode or passkey not configured` | Set `MPESA_SHORTCODE` + `MPESA_PASSKEY` (sandbox: `174379` + public passkey). |
| Wrong transaction type for a till | Set the ISP `collection_route` to `buygoods` (→ `CustomerBuyGoodsOnline`). |
| Amount off by cents | Expected — Daraja STK amounts are whole shillings (`int(round(...))`). |

---

## 11. Quick-start checklist

- [ ] Create Daraja account + sandbox app; copy consumer key/secret.
- [ ] Put `MPESA_*` in backend `.env` (§3) with sandbox shortcode `174379` + passkey.
- [ ] Expose backend publicly and set `MPESA_CALLBACK_URL` (§4).
- [ ] Restart backend; confirm token works (§6.1).
- [ ] Push STK (§6.3) → note `CheckoutRequestID`.
- [ ] Complete on your phone, or simulate the callback (§6.4).
- [ ] Confirm status `completed`, invoice PAID, RADIUS activated (§6.5).
- [ ] For production: Go Live, swap to prod creds + HTTPS callback (§8).





## Where credentials live (.env vs settings )

Confirmed all the mechanics. Here's the deep explanation — no code changes, this is how the two layers actually behave in your system.

First, a terminology note that makes Q3 click: in this system there are two very different "customers":

the ISP/operator (tenant) — logs into the admin, enters Daraja credentials in Settings. This is who "inputs the details."
the end subscriber — the WiFi user who just gets the STK PIN prompt on their phone. They never see any credentials.
Your screenshot form is the tenant entering their Daraja keys.

## Q1 — Where do the details from the Settings form go?

They go into the database, not the .env file. Specifically:

The form does PUT /api/settings/payments → update_payments() in routes/settings.py.
It writes one row per ISP in the payment_settings table (models.py PaymentSettings, isp_id is unique).
Non-secret fields are stored as plain text: daraja_consumer_key, daraja_shortcode, daraja_callback_url, collection_route, daraja_env.
Secret fields are encrypted at rest before saving — daraja_consumer_secret and daraja_passkey go through encrypt_value() (Fernet, services/encryption.py). In the DB they're ciphertext; they're only decrypted when the form re-loads them or when a payment is made.
So: .env = a file on disk (global). Settings = a per-ISP row in the database (encrypted). Two separate stores.

## Q2 — Why put them in .env if Settings can do it?

Because they are a fallback chain, not duplicates. When a payment happens, resolve_mpesa_config(isp) in services/mpesa_service.py resolves each field like this:


consumer_key = isp_settings_value  OR  env_MPESA_CONSUMER_KEY
Settings (per-ISP) value wins if present.
.env (MPESA_*) is used only where the ISP left a field blank.
What each is for:

.env (MPESA_*)	Settings → Payments
One global default for the whole server	Per-tenant credentials
Great for single-tenant or a shared sandbox while testing	Each ISP collects into their own paybill/till
Plain text on disk (git-ignored)	Encrypted in the DB, editable in the UI, no redeploy
Works before anyone touches the UI	The real multi-tenant path
You do not need both. In your case (you put the same details in both), that's redundant — Settings wins, so the .env copy is just an unused fallback. Pick one:

Single deployment for yourself → the Settings UI is the cleaner choice (encrypted, no redeploy to change).
Quick testing / "just make it work" → .env is the fastest.
The reason my MPESA.md leans on .env is only that it's the quickest way to get a sandbox working without logging into the UI or touching the DB.

## Q3 — Live multi-tenant: an ISP saves their live details and it "just works." How?

This is the SaaS scenario, and it works because credentials are resolved dynamically, per payment, from the paying subscriber's ISP — nothing is hard-coded or baked into a deploy.

Step by step:

## 1.Tenant configures once.

 ISP "A" logs in, opens Settings → Payments, enters their own live consumer key/secret + their real paybill shortcode + their production passkey, sets env = live, and saves.

_current_isp() (routes/settings.py) scopes the write to their payment_settings row only — ISP "A" can never edit ISP "B"'s keys. Secrets encrypted on save.

## 2.A subscriber of ISP "A" pays. 

The payment route figures out which ISP owns that subscriber:

_resolve_isp(user, customer) / customer.isp_id (routes/payments.py).
It calls initiate_stk_push(..., isp=isp_A).

## 3. The right credentials are loaded at that instant. 

resolve_mpesa_config(isp_A) pulls ISP "A"'s row, decrypts their secret + passkey, and because daraja_env = live, _is_live() flips the base URL to https://api.safaricom.co.ke. The STK push uses A's shortcode/passkey → the money lands in A's paybill.

## 4. The callback completes it.

 Safaricom POSTs to /api/payments/mpesa/callback (global, no auth). It finds the payment by CheckoutRequestID, derives the ISP from payment → customer, marks it COMPLETED, invoice PAID, activates RADIUS. The same callback URL serves every tenant — matching is by transaction ID, so it doesn't matter which ISP it belongs to.

That's why a brand-new ISP can start transacting with zero redeploy and zero .env change — their keys live in their DB row and are picked up on the next payment.

## For live to actually work, these must be true (the caveats)

1. The ISP has completed Daraja Go-Live and has production consumer key/secret + a real shortcode + a production passkey (the sandbox 174379/public passkey will not move real money).

2. daraja_env = live in their Settings.

3. The callback URL is a public HTTPS URL Safaricom can reach — this is the one piece of shared infrastructure (points at this server's /api/payments/mpesa/callback). Same domain for all tenants is fine.

4. ENCRYPTION_KEY is set and stable in the server env. This is the important one for the Settings approach: the per-ISP secrets are encrypted with a key derived from ENCRYPTION_KEY (falls back to SECRET_KEY, encryption.py). If it's unset or changes after secrets are saved, those secrets can no longer be decrypted and payments break.

5. Server clock is time-synced (the STK Password/Timestamp are generated together; skew → "Invalid Timestamp").

## So — "why should I include it in .env?"

Precisely:


The Daraja MPESA_* creds in .env are optional — they're only a global default/fallback. Keep them if you want: (a) a single-tenant setup, (b) a platform-wide sandbox for testing, or (c) a default so a new ISP can transact before configuring their own. In a true multi-tenant live setup where each ISP brings their own paybill, you can leave the MPESA_* creds out of .env entirely and let each tenant use Settings.
What you should have in .env regardless of which approach you choose is the infrastructure, not the Daraja keys:
ENCRYPTION_KEY — required to encrypt/decrypt the per-ISP secrets stored via Settings.
MPESA_CALLBACK_URL / PUBLIC_BASE_URL — your public HTTPS callback base, if you want a platform default.
Bottom line for your setup: since you're entering the details in Settings, that DB row is the source of truth and the duplicate .env Daraja keys are unnecessary — but keep ENCRYPTION_KEY and a public callback URL in .env.
