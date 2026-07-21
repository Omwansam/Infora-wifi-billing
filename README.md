# Infora WiFi Billing System

A comprehensive WiFi billing and network management system built with Flask (Python) backend and React (JavaScript) frontend. This system provides complete billing, customer management, and network infrastructure management for WiFi service providers.

## 🌟 Features

### Core Billing Features
- **Customer Management**: Complete customer profiles, billing history, and account management
- **Service Plans**: Flexible pricing plans with different speeds and billing cycles
- **Invoice Generation**: Automated invoice creation and management
- **Payment Processing**: Integration with M-Pesa for mobile payments (Kenya)
- **Voucher System**: Prepaid vouchers and promotional codes
- **Billing Cycles**: Support for monthly, quarterly, and annual billing

### Network Management
- **Mikrotik Integration**: Direct management of Mikrotik routers
- **FreeRADIUS**: Authentication and accounting for WiFi users
- **LDAP Integration**: Centralized user authentication
- **SNMP Monitoring**: Network device monitoring and management
- **VPN Management**: WireGuard VPN configuration and management
- **EAP Profiles**: Enterprise WiFi authentication profiles

### Administrative Features
- **Multi-role Access**: Admin, support, and billing team roles
- **Dashboard Analytics**: Revenue tracking and customer insights
- **Support Tickets**: Customer support ticket system
- **System Logs**: Comprehensive audit trails
- **Backup Management**: Automated database backups
- **Email/SMS Integration**: Customer communication tools

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │  Flask Backend  │    │   PostgreSQL    │
│   (Port 5173)   │◄──►│   (Port 5000)   │◄──►│   (Port 5432)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   FreeRADIUS    │
                       │   (Port 1812)   │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   OpenLDAP      │
                       │   (Port 389)    │
                       └─────────────────┘
```

## 🌐 Web surfaces (production)

One nginx container (`web`) serves three vhosts, all built by
`config/nginx/Dockerfile`:

| Host | Content |
|------|---------|
| `ruirufactorymabati.com` | Billing admin UI, captive portal, `/api` → Flask |
| `lumen.ruirufactorymabati.com` | Lumen marketing website (`LUMEN/lumen-website`) |
| `demo.ruirufactorymabati.com` | Interactive demo — the billing app built with `VITE_DEMO_MODE=true`; every `/api` call is answered in the browser from seeded sample data (`FRONTEND/infora_billing/src/demo/`), so it needs no backend and resets on reload |

Local dev equivalents (profile `dev`): billing app `:5173`, demo `:5174`, lumen site `:5175`.

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose** (Recommended)
- **Python 3.8+** (for local development)
- **Node.js 16+** (for local frontend development)
- **PostgreSQL 13+** (for local database)

### Option 1: Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/infora-wifi-billing.git
   cd infora-wifi-billing
   ```

2. **Create environment file**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start all services**
   ```bash
   docker-compose up -d
   ```

4. **Initialize the database**
   ```bash
   docker-compose exec flask_app flask db upgrade
   docker-compose exec flask_app flask initdb
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:5000
   - LDAP Admin: http://localhost:8080

### Option 2: Local Development Setup

#### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install Python dependencies**
   ```bash
   pip install pipenv
   pipenv install
   pipenv shell
   ```

3. **Set up environment variables**
   ```bash
   export FLASK_APP=server/app.py
   export FLASK_ENV=development
   export DATABASE_URL=postgresql://username:password@localhost/infora_billing
   export JWT_SECRET_KEY=your-secret-key
   ```

4. **Initialize database**
   ```bash
   flask db upgrade
   flask initdb
   ```

5. **Run the backend**
   ```bash
   python server/app.py
   ```

#### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend/infora_billing
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://infora_user:infora_password@localhost/infora_billing

# JWT
JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production

# RADIUS
RADIUS_SECRET=radius_secret_key

# LDAP
LDAP_BIND_PASSWORD=admin_password

# M-Pesa (Kenya Mobile Money)
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_ENVIRONMENT=sandbox

# Email
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your_email@gmail.com
MAIL_PASSWORD=your_app_password
MAIL_DEFAULT_SENDER=your_email@gmail.com
```

### Default Login Credentials

After running the seed script, you can login with:

- **Admin**: `admin1@infora.com` / `admin123`
- **Super Admin**: `superadmin@infora.com` / `superadmin123`
- **Support**: `support@infora.com` / `support123`
- **Billing**: `billing@infora.com` / `billing123`

## 📁 Project Structure

```
infora-wifi-billing/
├── backend/                    # Flask backend
│   ├── server/
│   │   ├── app.py             # Main Flask application
│   │   ├── config.py          # Configuration settings
│   │   ├── models.py          # Database models
│   │   ├── seed.py            # Database seeder
│   │   └── routes/            # API routes
│   │       ├── auth.py        # Authentication routes
│   │       ├── billing.py     # Billing routes
│   │       ├── customers.py   # Customer management
│   │       ├── invoices.py    # Invoice management
│   │       └── ...
│   ├── Dockerfile
│   └── Pipfile
├── frontend/                   # React frontend
│   └── infora_billing/
│       ├── src/
│       │   ├── components/    # React components
│       │   ├── services/      # API services
│       │   └── contexts/      # React contexts
│       ├── package.json
│       └── vite.config.js
├── config/                     # Configuration files
│   ├── freeradius/            # FreeRADIUS config
│   └── ldap/                  # LDAP configuration
└── docker-compose.yml         # Docker orchestration
```

## 🛠️ Development

### Adding New Features

1. **Backend API Routes**
   - Add new routes in `backend/server/routes/`
   - Update models in `backend/server/models.py`
   - Run database migrations: `flask db migrate -m "Description"`

2. **Frontend Components**
   - Create components in `frontend/infora_billing/src/components/`
   - Add API services in `frontend/infora_billing/src/services/`
   - Update routing in main App component

### Database Migrations

```bash
# Create a new migration
flask db migrate -m "Add new table"

# Apply migrations
flask db upgrade

# Rollback migration
flask db downgrade
```

### Testing

```bash
# Backend tests
cd backend
pipenv run python -m pytest

# Frontend tests
cd frontend/infora_billing
npm test
```

## 🔌 API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### Customer Management

- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `GET /api/customers/<id>` - Get customer details
- `PUT /api/customers/<id>` - Update customer
- `DELETE /api/customers/<id>` - Delete customer

### Billing Endpoints

- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `GET /api/plans` - List service plans
- `POST /api/payments` - Process payment

## 🚀 Deployment

### Production Deployment

1. **Update environment variables for production**
2. **Set up SSL certificates**
3. **Configure reverse proxy (Nginx)**
4. **Set up database backups**
5. **Configure monitoring and logging**

### Docker Production Build

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and commit: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

### Code Style

- **Backend**: Follow PEP 8 Python style guide
- **Frontend**: Use ESLint and Prettier for code formatting
- **Database**: Use descriptive table and column names

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed documentation
- **Issues**: Report bugs and feature requests via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions and ideas

## 🗺️ Roadmap

- [ ] Mobile app for customer self-service
- [ ] Advanced analytics and reporting
- [ ] Multi-tenant support
- [ ] API rate limiting
- [ ] Webhook integrations
- [ ] Advanced network monitoring
- [ ] Customer portal enhancements

## 🙏 Acknowledgments

- Flask community for the excellent web framework
- React team for the frontend library
- FreeRADIUS project for authentication
- OpenLDAP project for directory services

---

**Note**: This is a development version. For production use, ensure all security configurations are properly set up and tested.


One caveat: I verified schema + credential-resolution logic, but I did not place a live STK call to Safaricom (needs real sandbox keys + a public callback URL). To confirm the full round-trip, drop sandbox creds into Settings → Payments (or .env) and trigger a portal payment.

####################################################################################################

Locked in: TOTP + recovery codes now, opt-in per user, with a clean seam to add SMS OTP later. Here's the finalized build plan tailored to your codebase.

Backend
Deps — add pyotp to requirements.txt (qrcode[pil] already there).

Schema (models.py + migration):

On User: twofa_secret (Text, encrypted), twofa_enabled (Bool), twofa_confirmed_at (DateTime), and twofa_method (String, default 'totp') — that last column is the SMS-later seam.
New user_recovery_codes table (user_id, code_hash, used_at) — hashed, single-use.
New services/twofa_service.py — the whole TOTP domain in one place, with a method-dispatch shape so 'sms' slots in later:

generate_secret(), provisioning_uri(user, secret), qr_png_base64(uri)
verify_code(user, code) → dispatches on twofa_method (today: TOTP via pyotp, valid_window=1)
generate_recovery_codes(), hash/verify/consume a recovery code
Endpoints in routes/auth.py:

Endpoint	Purpose
POST /api/auth/2fa/setup	make pending secret → return otpauth:// + QR PNG
POST /api/auth/2fa/enable	password + code → enable, return 10 recovery codes once
POST /api/auth/2fa/disable	password → wipe secret + codes
GET /api/auth/2fa/status	enabled? confirmed date? codes remaining
POST /api/auth/login (modified)	if 2FA on: return {requires_2fa, mfa_token} — no real tokens
POST /api/auth/login/2fa	mfa_token + code/recovery → create_user_tokens()
mfa_token = short-lived itsdangerous signed token (purpose "mfa", ~5 min) — deliberately not a JWT, so it can never satisfy @jwt_required.
@rate_limit + failure lockout on /login/2fa; AuditLog on enable/disable/failed verify.
Frontend
Rebuild TwoFactorAuthPage.jsx into a real enroll flow (QR → 6-digit verify → recovery-code display → disable), using the emerald ui.jsx kit.
Two-step login in login.jsx + AuthContext.jsx (handle requires_2fa).
Wire the AccountSettings "Coming soon" card → live status + link.
New endpoints in config/api.js + service methods.
Verification
pyotp enroll→verify round-trip; recovery-code single-use; mfa_token rejected by protected routes; schema on real Postgres (rolled back).
That's the complete, opt-in TOTP design with SMS kept as a future drop-in. Say the word and I'll build it — I'd start with the backend (schema + twofa_service + endpoints), verify, then do the enroll page and the two-step login.

One question worth settling before I code: should enabling 2FA immediately invalidate the user's other active sessions (forcing re-login with 2FA everywhere), or leave existing sessions alone until they expire? I'd recommend invalidating for a security feature — but it's your call.


Ready for review
Select text to add comments on the plan
Introduce WAN (multi-uplink) load balancing into router provisioning
Context
The user wants to introduce ISP WAN link load balancing — spreading customer internet traffic across multiple upstream links (e.g. ISP-A + ISP-B) on managed MikroTik routers, with automatic failover — driven from the billing platform.

The platform already generates idempotent RouterOS provisioning scripts (build_radius_script in services/provisioning_scripts.py), fetched by each router via a token one-liner. The gap: MikrotikDevice has no concept of uplinks — nothing records which interfaces are WANs, their gateways, capacity weights, or ISP labels. This feature adds per-device uplink modelling, generates a PCC (Per-Connection Classifier) + health-checked failover block, and adds a wizard step to configure it.

Outcome: an operator marks 2+ WANs on a router; the generated provisioning script load-balances customer traffic across them (weighted, per-connection) and fails over when a link dies. With <2 uplinks configured, script output is unchanged (safe by default).

First deliverable is documentation: save this design as a real repo file at docs/design/wan-load-balancing.md (new docs/design/ folder) so it lives in the project's folder structure, not only in the ephemeral plan file.

Key concept (primer captured in the doc)
Not link aggregation. Balancing two 10 Mbps links does not give one client 20 Mbps — a single TCP flow rides one uplink. You gain aggregate throughput across many connections + resilience.
PCC is the production method: mangle hashes each new connection into a weighted bucket and pins it to one WAN for its lifetime (avoids asymmetric routing and the "two IPs" session breakage). ECMP/nth are simpler but weaker; we generate PCC.
Failover is mandatory: check-gateway=ping on marked routes + /tool netwatch canary pinging through each link (detects "link up, internet down"), distance-tiered so the survivor absorbs traffic and rebalances on recovery.
Gotchas the generator must handle: per-connection (never per-packet), per-WAN masquerade, input-interface connection marking, weighted buckets for unequal links, router-originated + DNS traffic.
Approach
1. Data model — per-device uplinks
New DeviceUplink table (1-many → MikrotikDevice), one row per WAN:

id, device_id (FK, indexed), interface (RouterOS name e.g. ether1), gateway (next-hop IP), weight (int ≥1, capacity ratio, default 1), isp_label (e.g. "Safaricom"), enabled (bool default true), created_at.
Add uplinks = db.relationship('DeviceUplink', back_populates='device', cascade='all, delete-orphan') on MikrotikDevice (mirrors existing relationship style in models.py).
Alembic migration creating device_uplinks, chained from the current head — new table, so it's create_all-safe and migration-covered (same pattern used for the settings tables: payment_settings, radius_config, etc. in migrations/versions/c2d3e4f5a6b7_...py).
Reuse: interface names come from the existing deviceInterfaces endpoint (API_ENDPOINTS.deviceInterfaces → routes/devices.py), so the wizard offers a dropdown of real interfaces rather than free text.

2. Script generation — the WAN balancing block
New build_wan_balancing_lines(device, uplinks) in backend/server/services/provisioning_scripts.py, emitting an idempotent block tagged comment="infora-wan", only when >=2 enabled uplinks exist:

Remove prior infora-wan mangle/route/nat rules first (idempotency), matching the existing :if ([:len [/... find comment="infora-..."]] > 0) do={ ... remove ... } pattern.
Per-WAN input marking: chain=prerouting in-interface=<wan> action=mark-connection new-connection-mark=wan<N>-conn (keeps replies on the entry WAN).
Weighted PCC split of new LAN connections: expand weight into buckets, e.g. weights {A:2, B:1} → 3 buckets per-connection-classifier=both-addresses-and-ports:3/0|3/1 → wanA, 3/2 → wanB.
Route marking per connection-mark → new-routing-mark=to-wan<N>.
Per-mark routes: /ip route add routing-mark=to-wan<N> gateway=<gw> check-gateway=ping.
Per-WAN masquerade: one srcnat/masquerade out-interface=<wan> each.
Failover + router/DNS traffic: distance-tiered default routes + optional /tool netwatch canary per uplink. Wire the call into build_radius_script right after the NAT/masquerade section (§4), guarded on uplinks. Single-WAN behaviour is untouched when <2 uplinks.
3. API — uplink CRUD
In backend/server/routes/devices.py: GET/PUT /api/devices/<id>/uplinks to read/replace a device's uplinks. Validate: interface belongs to the device's known interfaces, weight >= 1, gateway is a valid IP. Mirror existing device sub-resource endpoints (ISP access check via the same helper used by deviceInterfaces/deviceRadiusScript).

4. Frontend — wizard step + service
Add a "WAN / Load balancing" step to the device wizard (the same wizard that has the Ports step feeding monitored_interfaces): a small editable table — interface (dropdown from deviceInterfaces), gateway, weight, ISP label, enable — persisted via a new deviceService.saveUplinks + API_ENDPOINTS.deviceUplinks(id) in src/config/api.js.
Copy: "<2 uplinks = single WAN (no balancing); 2+ = weighted balancing with failover."
Critical files
backend/server/models.py — DeviceUplink model + MikrotikDevice.uplinks relationship.
backend/server/migrations/versions/<rev>_device_uplinks.py — new table (chain from head).
backend/server/services/provisioning_scripts.py — build_wan_balancing_lines + wire into build_radius_script.
backend/server/routes/devices.py — uplink CRUD endpoints.
FRONTEND/infora_billing/src/config/api.js + device service + device wizard component — uplink UI.
docs/design/wan-load-balancing.md — this design, committed to the repo.
Verification
Unit (script): call build_radius_script for a device with 2 weighted uplinks; assert the .rsc contains the PCC mangle rules (both buckets), per-mark routes with check-gateway=ping, per-WAN masquerade, and the infora-wan idempotency removes; assert no WAN block when <2 uplinks (single-WAN output unchanged).
Model smoke (Postgres, rolled back): create a MikrotikDevice + 2 DeviceUplink rows, verify the relationship + cascade, using the same throwaway-venv-against-real-Postgres approach used for the settings tables (create tables in a transaction, exercise, roll back — no side effects).
py_compile all changed backend files.
End-to-end (lab/real router): fetch the provisioning one-liner, apply, confirm both links carry connections (/ip firewall connection shows both routing-marks), then disable one uplink and confirm traffic shifts to the survivor and rebalances on restore.
Frontend: npm run build; drive the wizard step, confirm uplinks persist and appear in the generated script.
Rollout & safety
Safe by default: existing routers have 0 uplinks → generated script is byte-for-byte unchanged.
Disruptive to apply: the WAN block rewrites routing/mangle. Apply during a maintenance window; the script never touches the built-in admin user (the operator's console session stays alive).
Deploy path: same two-part flow as recent deploys — rebuild the flask_app image (backend) and rebuild + publish the admin static bundle (frontend), per the recipe in [[contabo-server-topology]] (memory).


Net: the device view is complete and faithful to the real system; the two deferred items are genuine backend features I'd want to build with a test router in the loop (each ~a focused task). Want me to (a) deploy the current state (backend image for the resource columns + frontend static), or (b) tackle Gap 3 or Gap 2 as a proper backend task next — ideally when you can point me at a reachable router to validate against?

