from datetime import datetime
from extensions import db
from enum import Enum

class CustomerStatus(Enum):
    ACTIVE = 'active'
    SUSPENDED = 'suspended'
    PENDING = 'pending'


class KycStatus(Enum):
    PENDING = 'pending'
    UNDER_REVIEW = 'under_review'
    VERIFIED = 'verified'
    REJECTED = 'rejected'


class InvoiceStatus(Enum):
    PENDING = 'pending'
    PAID = 'paid'
    OVERDUE = 'overdue'
    CANCELLED = 'cancelled'

class PaymentStatus(Enum):
    PENDING = 'pending'
    COMPLETED = 'completed'
    FAILED = 'failed'
    REFUNDED = 'refunded'

class VoucherStatus(Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    EXPIRED = 'expired'
    USED = 'used'

class DeviceStatus(Enum):
    ONLINE = 'online'
    OFFLINE = 'offline'
    MAINTENANCE = 'maintenance'
    DECOMMISSIONED = 'decommissioned'

class InfrastructureStatus(Enum):
    ACTIVE = 'active'
    OFFLINE = 'offline'
    MAINTENANCE = 'maintenance'
    DECOMMISSIONED = 'decommissioned'


class TicketStatus(Enum):
    OPEN = 'open'
    PENDING = 'pending'
    RESOLVED = 'resolved'
    CLOSED = 'closed'
    ON_HOLD = 'on_hold'
    IN_PROGRESS = 'in_progress'

class TicketPriority(Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    CRITICAL = 'critical'

class CustomerNoteType(Enum):
    GENERAL = 'general'
    BILLING = 'billing'
    TECHNICAL = 'technical'
    SUPPORT = 'support'

class NotificationPriority(Enum):
    LOW = 'low'
    MEDIUM = 'medium'
    HIGH = 'high'
    CRITICAL = 'critical'

# =========================
#   User Model
# =========================

class User(db.Model):
    """ User model for authentication and admin authorization """
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    role = db.Column(db.String(20), default='admin')
    is_active = db.Column(db.Boolean, default=True)
    # Two-factor authentication (TOTP). Secret is encrypted at rest; backup
    # codes stored as a JSON list of hashes. See routes/auth.py 2FA endpoints.
    two_factor_enabled = db.Column(db.Boolean, default=False, nullable=False)
    two_factor_secret = db.Column(db.Text, nullable=True)
    two_factor_backup_codes = db.Column(db.Text, nullable=True)
    # Contact verified during self-serve onboarding. The WhatsApp number is the
    # one that received the signup OTP, so it doubles as an account-recovery
    # channel; timestamps record *when* proof was obtained, not merely that it was.
    whatsapp_number = db.Column(db.String(20), nullable=True)
    whatsapp_verified_at = db.Column(db.DateTime, nullable=True)
    email_verified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    last_login = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    # Relationships mapping the user to multiple audit logs
    audit_logs = db.relationship('AuditLog', back_populates="user")
    # Relationships mapping the user to multiple system logs
    system_logs = db.relationship('SystemLog', back_populates="user")
    # Relationships mapping the user to multiple isps
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    isp = db.relationship('ISP', back_populates='users')

    def __repr__(self):
        return f"<User {self.first_name} {self.last_name} ({self.email})>"



# =========================
#   Customer Model
# =========================
class Customer(db.Model):
    """ Customer model for storing and managing customer information"""
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(50), nullable=False)
    # Email is optional: imported/rural PPPoE clients may not have one, and the
    # login is no longer derived from it (see radius_login). Still globally unique
    # when present (Postgres allows many NULLs under a UNIQUE constraint).
    email = db.Column(db.String(120), unique=True, nullable=True)
    # Operator-chosen connection login (PPPoE/hotspot). When set it — not the
    # email — is the RADIUS username, so imported clients keep their original
    # credentials and the CPE keeps dialing unchanged. Unique per ISP.
    radius_login = db.Column(db.String(120), nullable=True)
    # Human-facing, stable account number (e.g. "INF-100001"). Doubles as the
    # M-Pesa payment reference. Unique per ISP. Auto-generated at creation.
    account_number = db.Column(db.String(40), nullable=True)
    phone = db.Column(db.String(20), nullable=False)
    address = db.Column(db.String(255), nullable=True)
    # Premises pin (WGS84). Nullable — most subscribers predate the fiber map and
    # are placed later by hand, by geocoding `address`, or from the field app.
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    # How the pin was obtained, so a rough geocode is never mistaken for a
    # surveyed position: manual|geocode|import|gps
    geo_source = db.Column(db.String(20), nullable=True)
    geo_updated_at = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.Enum(CustomerStatus, name="customer_status"), default=CustomerStatus.ACTIVE, nullable=False)
    connection_type = db.Column(db.String(20), default='pppoe', nullable=False)  # hotspot | pppoe | wireguard
    join_date = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    balance = db.Column(db.Numeric(10, 2), default=0.00)
    package = db.Column(db.String(50), nullable=False)
    usage_percentage = db.Column(db.Integer, default=0)
    device_count = db.Column(db.Integer, default=0)
    last_payment_date = db.Column(db.DateTime, nullable=True)
    radius_password_encrypted = db.Column(db.Text, nullable=True)
    # True while the subscriber is provisioned at the plan's FUP throttled speed
    # (set/cleared by services.fup_enforcement).
    fup_throttled = db.Column(db.Boolean, default=False, nullable=False)
    # Operator override: skip FUP enforcement for this account until this moment.
    # Without it, "release from throttle" is undone by the next scheduler pass,
    # which makes the button a lie rather than a decision.
    fup_exempt_until = db.Column(db.DateTime, nullable=True)
    subscription_start = db.Column(db.DateTime, nullable=True)
    subscription_end = db.Column(db.DateTime, nullable=True)
    # Extra days after subscription_end before access is actually cut. 0/NULL
    # means the expiry is the cut-off. Set per account from the expiry dialog,
    # because a grace given to one subscriber is not a policy for all of them.
    grace_period_days = db.Column(db.Integer, default=0, nullable=True)
    id_number = db.Column(db.String(50), nullable=True)
    kyc_status = db.Column(
        db.Enum(KycStatus, name='kyc_status', values_callable=lambda enum: [item.value for item in enum]),
        default=KycStatus.PENDING,
        nullable=False,
    )
    kyc_verified_at = db.Column(db.DateTime, nullable=True)
    kyc_notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # --- Relationships ---------------------------------------------------
    # Every table with a FK to customers.id must be reachable from here, or
    # deleting a customer fails. SQLAlchemy's *default* cascade de-associates
    # children by setting their FK to NULL, which a NOT NULL column rejects
    # ("null value in column customer_id ... violates not-null constraint"),
    # and a child with no relationship at all is never touched, so Postgres
    # rejects the delete on the FK itself. Two deliberate behaviours below:
    #   delete-orphan -> the row only exists because the account does.
    #   default (NULL) -> financial/accounting history that must outlive the
    #                     account; the column is nullable for exactly that.

    # Relationships mapping the customer to multiple devices
    devices = db.relationship('CustomerDevice', back_populates="customer", cascade='all, delete-orphan')
    # Relationships mapping the customer to multiple invoices
    invoices = db.relationship('Invoice', back_populates="customer", cascade='all, delete-orphan')
    # Relationships mapping the customer to multiple payments
    payments = db.relationship('Payment', back_populates="customer", cascade='all, delete-orphan')
    # Relationships mapping the customer to multiple tickets
    tickets = db.relationship('Ticket', back_populates="customer", cascade='all, delete-orphan')
    # Relationships mapping the customer to multiple notes
    notes = db.relationship('CustomerNote', back_populates="customer", cascade='all, delete-orphan')
    # Account history. Dies with the account: an event about a deleted
    # subscriber names nobody, and the financial record lives in payments.
    events = db.relationship(
        'CustomerEvent',
        back_populates="customer",
        cascade='all, delete-orphan',
        order_by='CustomerEvent.created_at.desc()',
    )
    # Relationships mapping the customer to multiple documents
    documents = db.relationship('CustomerDocument', back_populates="customer", cascade='all, delete-orphan')
    # Foreign Key To store service plan id
    service_plan_id = db.Column(db.Integer, db.ForeignKey('service_plans.id'), nullable=True)
    # Relationships mapping the customer to multiple notifications
    notifications = db.relationship('Notification', back_populates="customer", cascade='all, delete-orphan')
    # Relationship mapping the customer to the related service plan
    service_plan = db.relationship('ServicePlan', back_populates="customers")
    # Relationships mapping the customer to multiple transactions
    transactions = db.relationship('Transaction', back_populates="customer", cascade='all, delete-orphan')
    # Revenue rows are kept (customer_id nulled) so revenue/expense reporting
    # totals don't change when an account is deleted.
    revenue_data = db.relationship('RevenueData', back_populates="customer")
    # Relationships mapping the customer to multiple radius sessions
    radius_sessions = db.relationship('RadiusSession', back_populates="customer", cascade='all, delete-orphan')
    # Relationships mapping the customer to multiple radius checks
    radius_checks = db.relationship('RadiusCheck', back_populates="customer", cascade='all, delete-orphan')
    # Relationships mapping the customer to multiple radius replies
    radius_replies = db.relationship('RadiusReply', back_populates="customer", cascade='all, delete-orphan')
    # Live FreeRADIUS credentials: they must die with the account, otherwise a
    # deleted subscriber's CPE keeps authenticating.
    radcheck_rows = db.relationship('RadCheck', back_populates="customer", cascade='all, delete-orphan')
    radreply_rows = db.relationship('RadReply', back_populates="customer", cascade='all, delete-orphan')
    radusergroup_rows = db.relationship('RadUserGroup', back_populates="customer", cascade='all, delete-orphan')
    # Accounting history and redeemed vouchers/codes survive the account with a
    # NULL customer_id — they are usage/audit records, not account data.
    radacct_rows = db.relationship('RadAcct', back_populates="customer")
    vouchers_used = db.relationship(
        'Voucher',
        foreign_keys='Voucher.used_by_customer_id',
        back_populates="used_by_customer",
    )
    hotspot_codes_used = db.relationship(
        'HotspotAccessCode',
        foreign_keys='HotspotAccessCode.used_by_customer_id',
        back_populates="used_by_customer",
    )
    # Relationships mapping the customer to multiple isps
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    isp = db.relationship('ISP', back_populates='customers')
    wireguard_peer = db.relationship(
        'WireGuardPeer',
        back_populates='customer',
        uselist=False,
        cascade='all, delete-orphan',
    )

    def __repr__(self):
        return f"<Customer {self.full_name} ({self.email})>"


# =========================
#   Service Model
# =========================

class ServicePlan(db.Model):
    """ Service plan model for internet packages"""
    __tablename__ = 'service_plans'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255), nullable=True)
    speed = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    features = db.Column(db.JSON, nullable=False)
    bandwidth_limit = db.Column(db.Integer, nullable=True)  # Mbps download cap for RADIUS
    data_limit = db.Column(db.Integer, nullable=True)  # GB monthly data cap
    static_ip = db.Column(db.String(45), nullable=True)
    session_timeout = db.Column(db.Integer, nullable=True)  # minutes
    idle_timeout = db.Column(db.Integer, nullable=True)  # minutes
    plan_type = db.Column(db.String(20), default='pppoe', nullable=False)  # pppoe | hotspot | trial | bundle | wireguard
    duration_hours = db.Column(db.Integer, nullable=True)  # hotspot access duration after payment
    billing_cycle_days = db.Column(db.Integer, default=30, nullable=True)  # pppoe renewal period
    wireguard_dns = db.Column(db.String(255), nullable=True)
    wireguard_allowed_ips = db.Column(db.String(255), nullable=True, default='0.0.0.0/0')
    wireguard_server_id = db.Column(db.Integer, db.ForeignKey('wireguard_servers.id'), nullable=True)
    popular = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationships mapping the service plan to multiple customers
    customers = db.relationship('Customer', back_populates="service_plan")
    # Relationships mapping the service plan to multiple isps
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    isp = db.relationship('ISP', back_populates='service_plans')

    def __repr__(self):
        return f"<ServicePlan {self.name} ({self.speed})>"

# =========================
#   Invoice Model
# =========================

class Invoice(db.Model):
    """ Invoice model for customer billing"""
    __tablename__ = 'invoices'

    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.Enum(InvoiceStatus, name="invoice_status"), default=InvoiceStatus.PENDING, nullable=False)
    due_date = db.Column(db.DateTime, nullable=False)
    paid_date = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store customer id
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    # Relationship mapping the invoice to the related customer
    customer = db.relationship('Customer', back_populates="invoices")
    # Relationships mapping the invoice to multiple invoice items
    invoice_items = db.relationship('InvoiceItem', back_populates="invoice", cascade='all, delete-orphan')
    # Relationships mapping the invoice to multiple payments
    payments = db.relationship('Payment', back_populates="invoice")
    # Relationships mapping the invoice to multiple discounts
    discounts = db.relationship('InvoiceDiscount', back_populates="invoice", cascade='all, delete-orphan')
    # Relationships mapping the invoice to multiple revenue data
    revenue_data = db.relationship('RevenueData', back_populates="invoice")
    # Relationships mapping the invoice to multiple isps
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    isp = db.relationship('ISP', back_populates='invoices')

    def __repr__(self):
        return f"<Invoice {self.invoice_number} ({self.amount})>"

# =========================
#   Invoice Item Model
# =========================

class InvoiceItem(db.Model):
    """ Invoice item model for detailed customer billing"""
    __tablename__ = 'invoice_items'

    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(255), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    total_price = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store invoice id
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    # Relationship mapping the invoice item to the related invoice
    invoice = db.relationship('Invoice', back_populates="invoice_items")

    def __repr__(self):
        return f"<InvoiceItem {self.description} ({self.quantity})>"


# =========================
#   Payment Model
# =========================

class Payment(db.Model):
    """ Payment model for customer payments"""
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    payment_method = db.Column(db.String(50), nullable=False)
    payment_status = db.Column(db.Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.PENDING, nullable=False)
    transaction_id = db.Column(db.String(50), nullable=True)
    mpesa_checkout_request_id = db.Column(db.String(100), nullable=True)
    mpesa_merchant_request_id = db.Column(db.String(100), nullable=True)
    mpesa_receipt_number = db.Column(db.String(50), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    payment_date = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store customer id
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    # Foreign Key To store invoice id
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=True)
    # Relationship mapping the payment to the related customer
    customer = db.relationship('Customer', back_populates="payments")
    # Relationship mapping the payment to the related invoice
    invoice = db.relationship('Invoice', back_populates="payments")
    # Relationships mapping the payment to multiple transactions
    transactions = db.relationship('Transaction', back_populates="payment")

    def __repr__(self):
        return f"<Payment {self.amount} ({self.payment_method})>"   



# =========================
#   Mikrotik Device Model
# =========================

class MikrotikDevice(db.Model):
    """ Mikrotik device model for managing router devices and network management"""
    __tablename__ = 'mikrotik_devices'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    password = db.Column(db.Text, nullable=False)  # Fernet-encrypted at rest
    api_key = db.Column(db.String(255), nullable=True)
    api_port = db.Column(db.Integer, default=8728)
    ssh_port = db.Column(db.Integer, default=22)
    connection_type = db.Column(db.String(10), default='api')  # api or ssh
    use_ssl = db.Column(db.Boolean, default=True)
    device_name = db.Column(db.String(50), nullable=False)
    device_ip = db.Column(db.String(50), nullable=False)
    device_model = db.Column(db.String(50), nullable=False)
    device_status = db.Column(db.Enum(DeviceStatus, name="device_status"), default=DeviceStatus.ONLINE, nullable=False)
    uptime = db.Column(db.Integer, default=0)
    client_count = db.Column(db.Integer, default=0)
    bandwidth_usage = db.Column(db.Integer, default=0)
    # Live resource usage, refreshed on each sync (see services/mikrotik_sync.py)
    cpu_load = db.Column(db.Float, nullable=True)          # percent
    mem_total = db.Column(db.BigInteger, nullable=True)    # bytes
    mem_free = db.Column(db.BigInteger, nullable=True)     # bytes
    hdd_total = db.Column(db.BigInteger, nullable=True)    # bytes
    hdd_free = db.Column(db.BigInteger, nullable=True)     # bytes
    location = db.Column(db.String(50), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    last_synced = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    management_wg_enabled = db.Column(db.Boolean, default=False, nullable=False)
    management_wg_ip = db.Column(db.String(50), nullable=True)
    management_wg_public_key = db.Column(db.String(64), nullable=True)
    management_wg_private_key_encrypted = db.Column(db.Text, nullable=True)
    # One-line self-provisioning (router fetches token-authenticated .rsc)
    provision_token = db.Column(db.String(64), unique=True, nullable=True, index=True)
    provision_token_expires_at = db.Column(db.DateTime, nullable=True)
    provision_last_fetched_at = db.Column(db.DateTime, nullable=True)
    provision_fetch_count = db.Column(db.Integer, default=0, nullable=False)
    # JSON blob of applied service config (pppoe/hotspot/bridge ports/subnet)
    service_config = db.Column(db.Text, nullable=True)
    # JSON blob of dual-WAN load-balancing / failover config (see services.load_balancing)
    wan_config = db.Column(db.Text, nullable=True)
    # JSON list of interface names the operator chose to monitor (wizard Ports step)
    monitored_interfaces = db.Column(db.Text, nullable=True)
    # Cached result of the last configuration self-check (JSON) + when it ran
    self_check_result = db.Column(db.Text, nullable=True)
    self_check_at = db.Column(db.DateTime, nullable=True)
    # Firmware / RouterOS version tracking (populated by sync + firmware check)
    os_version = db.Column(db.String(50), nullable=True)
    firmware_latest = db.Column(db.String(50), nullable=True)
    last_backup_at = db.Column(db.DateTime, nullable=True)
    # Captive-portal theme override for this router (Settings > Captive Portal)
    portal_theme = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store network zone id
    zone_id = db.Column(db.Integer, db.ForeignKey('network_zones.id'), nullable=True)
    # Relationship mapping the mikrotik device to the related network zone
    zone = db.relationship('NetworkZone', back_populates="mikrotik_devices")
    # Relationships mapping the mikrotik device to multiple radius sessions
    radius_sessions = db.relationship('RadiusSession', back_populates="mikrotik_device")
    # Relationships mapping the mikrotik device to multiple isps
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    isp = db.relationship('ISP', back_populates='mikrotik_devices')
    
    @staticmethod
    def generate_provision_token():
        """64-hex opaque token used in the one-line self-provisioning URL."""
        import secrets
        return secrets.token_hex(32)

    def provision_token_is_valid(self):
        """True if a token exists and has not expired."""
        if not self.provision_token:
            return False
        if self.provision_token_expires_at and self.provision_token_expires_at < datetime.now():
            return False
        return True

    def __repr__(self):
        return f"<MikrotikDevice {self.device_name} ({self.device_ip})>"


class DeviceBackup(db.Model):
    """A stored RouterOS configuration export for a MikroTik device."""
    __tablename__ = 'device_backups'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id', ondelete='CASCADE'), nullable=False, index=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True, index=True)
    filename = db.Column(db.String(255), nullable=False)
    storage_path = db.Column(db.String(512), nullable=False)
    file_format = db.Column(db.String(10), default='rsc')  # rsc (text export) or backup (binary)
    size_bytes = db.Column(db.Integer, default=0)
    sha256 = db.Column(db.String(64), nullable=True)
    status = db.Column(db.String(20), default='success')  # success | error
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    device = db.relationship('MikrotikDevice', backref=db.backref('backups', cascade='all, delete-orphan', passive_deletes=True))

    def __repr__(self):
        return f"<DeviceBackup {self.filename} device={self.device_id}>"


class Equipment(db.Model):
    """Physical network/IT asset inventory with procurement tracking."""
    __tablename__ = 'equipment'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    equipment_type = db.Column(db.String(50), default='Router')  # Router, Switch, Access Point, Server, Other
    serial_number = db.Column(db.String(120), nullable=True)
    vendor = db.Column(db.String(120), nullable=True)
    price = db.Column(db.Float, default=0)
    paid_amount = db.Column(db.Float, default=0)
    status = db.Column(db.String(20), default='pending')  # active | installment | pending | retired
    location = db.Column(db.String(120), nullable=True)
    purchase_date = db.Column(db.Date, nullable=True)
    warranty_until = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    # Optional link to a managed MikroTik device
    device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    isp = db.relationship('ISP')
    device = db.relationship('MikrotikDevice')

    @property
    def outstanding(self):
        return max((self.price or 0) - (self.paid_amount or 0), 0)

    def __repr__(self):
        return f"<Equipment {self.name} ({self.equipment_type})>"


# =========================
#   Customer Device Model
# =========================

class CustomerDevice(db.Model):
    """ Customer device model for managing customer devices and tracking connected devices"""
    __tablename__ = 'customer_devices'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    device_name = db.Column(db.String(50), nullable=False)
    device_mac_address = db.Column(db.String(50), unique=True, nullable=False)
    device_ip_address = db.Column(db.String(50), nullable=False)
    device_model = db.Column(db.String(50), nullable=False)
    device_type = db.Column(db.String(50), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    last_seen = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationship mapping the customer device to the related customer
    customer = db.relationship('Customer', back_populates="devices")

    def __repr__(self):
        return f"<CustomerDevice {self.device_name} ({self.device_mac_address})>"



# =========================
#   Voucher Model
# =========================

class Voucher(db.Model):
    """ Voucher model for customer discounts codes"""
    __tablename__ = 'vouchers'
    
    id = db.Column(db.Integer, primary_key=True)
    voucher_code = db.Column(db.String(50), unique=True, nullable=False)
    voucher_type = db.Column(db.String(50), nullable=False)
    voucher_value = db.Column(db.Numeric(10, 2), nullable=False)
    voucher_status = db.Column(db.Enum(VoucherStatus, name="voucher_status"), default=VoucherStatus.ACTIVE, nullable=False)
    used_by = db.Column(db.String(50), nullable=True)
    used_at = db.Column(db.DateTime, nullable=True)
    expiry_date = db.Column(db.DateTime, nullable=False)
    usage_count = db.Column(db.Integer, default=0)
    max_usage = db.Column(db.Integer, default=1)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store customer id (who used the voucher)
    used_by_customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    # Relationship mapping the voucher to the related customer who used it
    used_by_customer = db.relationship(
        'Customer',
        foreign_keys=[used_by_customer_id],
        back_populates="vouchers_used",
    )
    
    def __repr__(self):
        return f"<Voucher {self.voucher_code} ({self.voucher_type})>"


# =========================
#   Ticket Model
# =========================

class Ticket(db.Model):
    """ Ticket model for customer support tickets"""
    __tablename__ = 'tickets'

    id = db.Column(db.Integer, primary_key=True)
    ticket_number = db.Column(db.String(50), unique=True, nullable=False)
    ticket_subject = db.Column(db.String(255), nullable=False)
    ticket_description = db.Column(db.Text, nullable=False)
    ticket_status = db.Column(db.Enum(TicketStatus, name="ticket_status"), default=TicketStatus.OPEN, nullable=False)
    priority = db.Column(db.Enum(TicketPriority, name="ticket_priority"), default=TicketPriority.MEDIUM, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    resolved_by = db.Column(db.String(50), nullable=True)
    resolved_note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Foreign Key To store customer id
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    # Relationship mapping the ticket to the related customer
    customer = db.relationship('Customer', back_populates="tickets")
    # Relationships mapping the ticket to multiple messages
    messages = db.relationship('TicketMessage', back_populates="ticket", cascade='all, delete-orphan')

    def __repr__(self):
        return f"<Ticket {self.ticket_number} ({self.ticket_subject})>"

# =========================
#   Ticket Message Model
# =========================

class TicketMessage(db.Model):
    """ Ticket message model for customer support ticket messages"""
    __tablename__ = 'ticket_messages'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('tickets.id'), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_internal = db.Column(db.Boolean, default=False) # Internal message cannot be visible to the customer
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationship mapping the ticket message to the related ticket
    ticket = db.relationship('Ticket', back_populates="messages")

    def __repr__(self):
        return f"<TicketMessage {self.message} ({self.ticket_id})>"



# =========================
#   Transaction Model
# =========================

class Transaction(db.Model):
    """ Transaction model for general financial tracking"""
    __tablename__ = 'transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    transaction_number = db.Column(db.String(50), unique=True, nullable=False)
    transaction_type = db.Column(db.String(50), nullable=False)
    transaction_amount = db.Column(db.Numeric(10, 2), nullable=False)
    reference_id = db.Column(db.String(50), nullable=True)
    reference_type = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    # Foreign Key To store customer id
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    # Foreign Key To store payment id
    payment_id = db.Column(db.Integer, db.ForeignKey('payments.id'), nullable=True)
    # Relationship mapping the transaction to the related customer
    customer = db.relationship('Customer', back_populates="transactions")
    # Relationship mapping the transaction to the related payment
    payment = db.relationship('Payment', back_populates="transactions")

    def __repr__(self):
        return f"<Transaction {self.transaction_number} ({self.transaction_type})>"


# =========================
#   SystemLog Model
# =========================

class SystemLog(db.Model):
    """ System log model for tracking system events and activities"""
    __tablename__ = 'system_logs'

    id = db.Column(db.Integer, primary_key=True)
    log_type = db.Column(db.String(50), nullable=False)
    log_message = db.Column(db.Text, nullable=False)
    log_level = db.Column(db.String(50), nullable=False)
    log_timestamp = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store user id (who triggered the log)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    # Relationship mapping the system log to the related user
    user = db.relationship('User', back_populates="system_logs")

    def __repr__(self):
        return f"<SystemLog {self.log_type} ({self.log_message})>"


class SupportRequest(db.Model):
    """Operator-submitted support messages, bug reports, and feature requests.

    Distinct from customer `Ticket`s (which require a customer_id) — these are
    raised by admin/staff users from Settings → Contact Support / Bug Report.
    """
    __tablename__ = 'support_requests'

    id = db.Column(db.Integer, primary_key=True)
    request_type = db.Column(db.String(20), nullable=False, default='support')  # support | bug | feature
    subject = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    priority = db.Column(db.String(20), nullable=False, default='medium')  # low | medium | high | urgent
    status = db.Column(db.String(20), nullable=False, default='open')  # open | in_progress | resolved | closed
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    user = db.relationship('User')
    isp = db.relationship('ISP')

    def to_dict(self):
        submitter = None
        if self.user:
            submitter = f"{self.user.first_name} {self.user.last_name}".strip() or self.user.email
        return {
            'id': self.id,
            'type': self.request_type,
            'subject': self.subject,
            'message': self.message,
            'priority': self.priority,
            'status': self.status,
            'user_id': self.user_id,
            'submitted_by': submitter,
            'submitter_email': self.user.email if self.user else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<SupportRequest {self.request_type} ({self.subject})>"


# =========================
#   Revenue Data Model
# =========================

class RevenueData(db.Model):
    """ Revenue data model for tracking revenue and expenses"""
    __tablename__ = 'revenue_data'

    id = db.Column(db.Integer, primary_key=True)
    revenue_date = db.Column(db.DateTime, nullable=False) # it needs to return month and date
    revenue_amount = db.Column(db.Numeric(10, 2), nullable=False)
    revenue_type = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store customer id
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    # Foreign Key To store invoice id
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=True)
    # Relationship mapping the revenue data to the related customer
    customer = db.relationship('Customer', back_populates="revenue_data")
    # Relationship mapping the revenue data to the related invoice
    invoice = db.relationship('Invoice', back_populates="revenue_data")

    def __repr__(self):
        return f"<RevenueData {self.revenue_type} ({self.revenue_amount})>"

# FreeRadius Session Model


# =========================
#   Radius Session Model
# =========================

class RadiusSession(db.Model):
    """ RADIUS session model for tracking customer authentication sessions """
    __tablename__ = 'radius_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    mikrotik_device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id'), nullable=False)
    session_id = db.Column(db.String(100), unique=True, nullable=False)
    username = db.Column(db.String(100), nullable=False)
    ip_address = db.Column(db.String(45), nullable=False)
    mac_address = db.Column(db.String(17), nullable=False)
    session_start = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    session_end = db.Column(db.DateTime, nullable=True)
    bytes_in = db.Column(db.BigInteger, default=0)
    bytes_out = db.Column(db.BigInteger, default=0)
    packets_in = db.Column(db.BigInteger, default=0)
    packets_out = db.Column(db.BigInteger, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationships
    isp = db.relationship('ISP', back_populates='radius_sessions')
    customer = db.relationship('Customer', back_populates='radius_sessions')
    mikrotik_device = db.relationship('MikrotikDevice', back_populates='radius_sessions')
    
    def __repr__(self):
        return f"<RadiusSession {self.session_id} (Customer: {self.customer_id})>"
    
    def get_total_bytes(self):
        """Get total bytes transferred"""
        return self.bytes_in + self.bytes_out
    
    def get_session_duration(self):
        """Get session duration in seconds"""
        if self.session_end:
            return (self.session_end - self.session_start).total_seconds()
        return (db.func.current_timestamp() - self.session_start).total_seconds()


# =========================
#   Radius Check Model
# =========================

class RadiusCheck(db.Model):
    """ Radius check model for tracking radius checks"""
    __tablename__ = 'radius_checks'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False) # FreeRadius user-name
    attribute_name = db.Column(db.String(50), nullable=False) # FreeRadius Attribute-Name
    op = db.Column(db.String(50), nullable=False) # FreeRadius Operator
    value = db.Column(db.String(50), nullable=False) # FreeRadius Value
    
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store customer id
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    # Relationship mapping the radius check to the related customer
    customer = db.relationship('Customer', back_populates="radius_checks")

    def __repr__(self):
        return f"<RadiusCheck {self.username} ({self.attribute_name})>"


# =========================
#   Radius Reply Model
# =========================

class RadiusReply(db.Model):
    """ Radius reply model for tracking radius replies"""
    __tablename__ = 'radius_replies'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False) # FreeRadius user-name
    attribute = db.Column(db.String(50), nullable=False) # FreeRadius Attribute-Name
    op = db.Column(db.String(50), nullable=False) # FreeRadius Operator
    value = db.Column(db.String(50), nullable=False) # FreeRadius Value
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store customer id
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    # Relationship mapping the radius reply to the related customer
    customer = db.relationship('Customer', back_populates="radius_replies")
    
    def __repr__(self):
        return f"<RadiusReply {self.username} ({self.attribute})>"


# =========================
#   Radius Group Model
# =========================

class RadiusGroup(db.Model):
    """ Radius group model for tracking radius groups"""
    __tablename__ = 'radius_groups'
    
    id = db.Column(db.Integer, primary_key=True)
    group_name = db.Column(db.String(50), nullable=False) # FreeRadius Group-Name
    description = db.Column(db.String(255), nullable=True) # FreeRadius Description
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationships mapping the radius group to multiple user groups
    user_groups = db.relationship('RadiusUserGroup', back_populates="group")

    def __repr__(self):
        return f"<RadiusGroup {self.group_name} ({self.description})>"

# =========================
#   Radius User Model
# =========================

class RadiusUserGroup(db.Model):
    """ Radius user model for tracking radius users"""
    __tablename__ = 'radius_user_groups'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False) # FreeRadius user-name
    groupname = db.Column(db.String(50), nullable=False) # FreeRadius Group-Name
    priority = db.Column(db.Integer, default=1) # FreeRadius Priority

    # Foreign Key To store radius group id
    group_id = db.Column(db.Integer, db.ForeignKey('radius_groups.id'), nullable=False)
    # Relationship mapping the radius user group to the related radius group
    group = db.relationship('RadiusGroup', back_populates="user_groups")

    def __repr__(self):
        return f"<RadiusUserGroup {self.username} ({self.groupname})>"


# =========================
#   Network Infrastructure Model
# =========================

class NetworkInfrastructure(db.Model):
    """ Network infrastructure model for tracking network devices and equipment management"""
    __tablename__ = 'network_infrastructure'
    
    id = db.Column(db.Integer, primary_key=True)
    device_name = db.Column(db.String(50), nullable=False)
    device_type = db.Column(db.String(50), nullable=False) # Router, Switch, Access Point, etc.
    device_model = db.Column(db.String(50), nullable=False)
    device_serial_number = db.Column(db.String(50), unique=True, nullable=False)
    device_ip_address = db.Column(db.String(50), nullable=False)
    device_mac_address = db.Column(db.String(50), nullable=False)
    device_location = db.Column(db.String(50), nullable=False)
    device_status = db.Column(db.Enum(InfrastructureStatus, name="infrastructure_status"), default=InfrastructureStatus.ACTIVE, nullable=False)
    capacity = db.Column(db.Integer, nullable=False) # Bandwidth capacity 500MB
    purchase_date = db.Column(db.DateTime, nullable=True)
    warranty_expiry = db.Column(db.DateTime, nullable=True)
    last_maintenance = db.Column(db.DateTime, nullable=True)
    next_maintenance = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Foreign Key To store network zone id
    zone_id = db.Column(db.Integer, db.ForeignKey('network_zones.id'), nullable=True)
    # Relationship mapping the network infrastructure to the related network zone
    zone = db.relationship('NetworkZone', back_populates="infrastructure_devices")
    
    def __repr__(self):
        return f"<NetworkDevice {self.device_name} ({self.device_type})>"



# =========================
#   Network Zone Model
# =========================

class NetworkZone(db.Model):
    """ Network zone model for organizing devices by location/network """
    __tablename__ = 'network_zones'
    
    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    network_range = db.Column(db.String(50), nullable=True)  # e.g., "192.168.1.0/24"
    location = db.Column(db.String(200), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationships
    isp = db.relationship('ISP', back_populates='network_zones')
    mikrotik_devices = db.relationship('MikrotikDevice', back_populates='zone')
    infrastructure_devices = db.relationship('NetworkInfrastructure', back_populates='zone')
    
    def __repr__(self):
        return f"<NetworkZone {self.name} (ISP: {self.isp_id})>"


# =========================
#   Billing cycle model
# =========================

class BillingCycle(db.Model):
    """ Billing cycle model for tracking billing cycles"""
    __tablename__ = 'billing_cycles'
    
    id = db.Column(db.Integer, primary_key=True)
    cycle_name = db.Column(db.String(50), nullable=False)
    cycle_day = db.Column(db.Integer, nullable=False) # 1-31
    cycle_description = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    def __repr__(self):
        return f"<BillingCycle {self.cycle_name} ({self.cycle_day})>"




# =========================
#   Tax Rate Model
# =========================

class TaxRate(db.Model):
    """ Tax rate model for tracking tax rates"""
    __tablename__ = 'tax_rates'
    
    id = db.Column(db.Integer, primary_key=True)
    tax_name = db.Column(db.String(50), nullable=False)
    tax_rate = db.Column(db.Float, nullable=False)
    tax_description = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __repr__(self):
        return f"<TaxRate {self.tax_name} ({self.tax_rate})>"


# =========================
#   Discount Model
# =========================

class Discount(db.Model):
    """ Discount model for tracking discounts"""
    __tablename__ = 'discounts'     
    
    id = db.Column(db.Integer, primary_key=True)
    discount_name = db.Column(db.String(50), nullable=False)
    discount_rate = db.Column(db.Float, nullable=False)
    discount_type = db.Column(db.String(50), nullable=False) # percentage, fixed amount
    discount_value = db.Column(db.Float, nullable=False)
    discount_description = db.Column(db.String(255), nullable=True)
    start_date = db.Column(db.DateTime, nullable=True)  
    end_date = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationships mapping the discount to multiple invoice discounts
    invoice_discounts = db.relationship('InvoiceDiscount', back_populates="discount")

    def __repr__(self):
        return f"<Discount {self.discount_name} ({self.discount_rate})>"



# =========================
#   Invoice Discount Model
# =========================

class InvoiceDiscount(db.Model):
    """ Invoice discount model for tracking invoice discounts"""
    __tablename__ = 'invoice_discounts'
    
    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    discount_id = db.Column(db.Integer, db.ForeignKey('discounts.id'), nullable=False)
    discount_amount = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationship mapping the invoice discount to the related invoice
    invoice = db.relationship('Invoice', back_populates="discounts")
    # Relationship mapping the invoice discount to the related discount
    discount = db.relationship('Discount', back_populates="invoice_discounts")

    def __repr__(self):
        return f"<InvoiceDiscount {self.invoice_id} ({self.discount_id})>"




# =========================
#   Customer Note Model
# =========================

class CustomerNote(db.Model):
    """ Customer note model for tracking customer notes"""
    __tablename__ = 'customer_notes'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    note_type = db.Column(db.Enum(CustomerNoteType, name="customer_note_type"), default=CustomerNoteType.GENERAL, nullable=False)
    note_title = db.Column(db.String(255), nullable=True)
    note_content = db.Column(db.Text, nullable=False)
    is_private = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationship mapping the customer note to the related customer
    customer = db.relationship('Customer', back_populates="notes")

    def __repr__(self):
        return f"<CustomerNote {self.customer_id} ({self.note_type})>"



# =========================
#   CustomerDocument Model
# =========================

class CustomerDocument(db.Model):
    """ Customer document model for tracking customer documents"""
    __tablename__ = 'customer_documents'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    document_type = db.Column(db.String(50), nullable=False) # contract, agreement, invoice, etc.
    file_name = db.Column(db.String(255), nullable=False)
    original_file_name = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_path = db.Column(db.String(255), nullable=False)
    verification_status = db.Column(db.String(20), default='pending', nullable=False)
    notes = db.Column(db.Text, nullable=True)
    upload_date = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    expiry_date = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationship mapping the customer document to the related customer
    customer = db.relationship('Customer', back_populates="documents")
    
    def __repr__(self):
        return f"<CustomerDocument {self.customer_id} ({self.document_type})>"



# =========================
#   Notification Model
# =========================

class Notification(db.Model):
    """ Notification model for tracking notifications and alerts"""
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    notification_type = db.Column(db.String(50), nullable=False) # email, sms, push
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    priority = db.Column(db.Enum(NotificationPriority, name="notification_priority"), default=NotificationPriority.LOW, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    read_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationship mapping the notification to the related customer
    customer = db.relationship('Customer', back_populates="notifications")

    def __repr__(self):
        return f"<Notification {self.customer_id} ({self.notification_type})>"

# =========================
#   Audit Log Model
# =========================

class AuditLog(db.Model):
    """System audit trail for security and compliance"""
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    record_id = db.Column(db.Integer, nullable=False)
    old_value = db.Column(db.Text, nullable=True)
    new_value = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(50), nullable=False)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationship mapping the audit log to the related user
    user = db.relationship('User', back_populates="audit_logs")
    
    def __repr__(self):
        return f"<AuditLog {self.user_id} ({self.action})>"



# =========================
#   BackupSchedule Model
# =========================

class BackupSchedule(db.Model):
    """ Backup schedule model for tracking backup schedules"""
    __tablename__ = 'backup_schedules'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    frequency = db.Column(db.String(50), nullable=False) # daily, weekly, monthly
    time_of_day = db.Column(db.String(50), nullable=False) # 12:00 AM, 12:00 PM, etc.
    retention_days = db.Column(db.Integer, default=30)
    is_active = db.Column(db.Boolean, default=True)
    last_backup_date = db.Column(db.DateTime, nullable=True)
    next_backup_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __repr__(self):
        return f"<BackupSchedule {self.name} ({self.frequency})>"




# =========================
#   SystemSetting Model
# =========================

class SystemSetting(db.Model):
    """ System configuration settings"""
    __tablename__ = 'system_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(255), nullable=False)
    value = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(50), nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __repr__(self):
        return f"<SystemSetting {self.key} ({self.value})>" 


# =========================
#   Notification Settings
# =========================

class NotificationSetting(db.Model):
    """Per-ISP, per-event, per-channel notification preference + custom template.

    The catalogue of available events/channels lives in
    ``services.notification_events``; this table only stores overrides
    (enabled flag + optional custom message body) keyed by ``event_key`` +
    ``channel``. A missing row means "use the catalogue default".
    """
    __tablename__ = 'notification_settings'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    event_key = db.Column(db.String(80), nullable=False)
    channel = db.Column(db.String(20), nullable=False)  # sms | email
    enabled = db.Column(db.Boolean, default=False)
    template = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    isp = db.relationship('ISP', back_populates='notification_settings')

    __table_args__ = (
        db.UniqueConstraint('isp_id', 'event_key', 'channel', name='uq_notification_setting'),
    )

    def __repr__(self):
        return f"<NotificationSetting {self.event_key}/{self.channel} enabled={self.enabled}>"


# =========================
#   Portal Announcements
# =========================

class PortalAnnouncement(db.Model):
    """Banner shown to customers at the top of the captive portal page."""
    __tablename__ = 'portal_announcements'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(20), default='info')  # info | warning | success | error
    message = db.Column(db.Text, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    isp = db.relationship('ISP', back_populates='portal_announcements')

    def is_live(self):
        if not self.is_active:
            return False
        if self.expires_at and self.expires_at < datetime.utcnow():
            return False
        return True

    def __repr__(self):
        return f"<PortalAnnouncement {self.title!r} active={self.is_active}>"


# =========================
#   Hotspot Access Codes (WiFi vouchers)
# =========================

class HotspotAccessCode(db.Model):
    """Pre-generated WiFi access code redeemable on the captive portal."""
    __tablename__ = 'hotspot_access_codes'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('service_plans.id'), nullable=False)
    device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id'), nullable=True)
    code = db.Column(db.String(50), nullable=False, index=True)
    status = db.Column(db.String(20), default='unused')  # unused | used | expired
    max_uses = db.Column(db.Integer, default=1)
    use_count = db.Column(db.Integer, default=0)
    used_by_customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    used_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    isp = db.relationship('ISP', backref='hotspot_access_codes')
    plan = db.relationship('ServicePlan')
    device = db.relationship('MikrotikDevice')
    used_by_customer = db.relationship(
        'Customer',
        foreign_keys=[used_by_customer_id],
        back_populates="hotspot_codes_used",
    )

    __table_args__ = (
        db.UniqueConstraint('isp_id', 'code', name='uq_hotspot_access_code'),
    )

    def is_valid(self):
        if self.expires_at and self.expires_at.replace(tzinfo=None) < datetime.utcnow():
            return False
        if (self.use_count or 0) >= (self.max_uses or 1):
            return False
        return self.status != 'expired'

    def __repr__(self):
        return f"<HotspotAccessCode {self.code} ({self.status})>"


# =========================
#   Payments / RADIUS / Integrations / API  (Settings tabs)
# =========================


class PaymentSettings(db.Model):
    """Per-ISP payment collection & M-Pesa Daraja configuration (Settings > Payments).

    One row per ISP. Secret values (consumer secret, passkey) are stored
    encrypted via ``services.encryption`` and decrypted on read for the form.
    """
    __tablename__ = 'payment_settings'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, unique=True, index=True)

    # Collection route: buygoods | paybill | bank
    collection_route = db.Column(db.String(20), nullable=False, default='paybill')

    buygoods_till = db.Column(db.String(20), nullable=True)
    buygoods_store = db.Column(db.String(20), nullable=True)

    paybill_shortcode = db.Column(db.String(20), nullable=True)
    paybill_account = db.Column(db.String(60), nullable=True)

    bank_name = db.Column(db.String(120), nullable=True)
    bank_paybill = db.Column(db.String(20), nullable=True)
    bank_account = db.Column(db.String(60), nullable=True)

    # Daraja API (secrets encrypted at rest)
    daraja_env = db.Column(db.String(10), nullable=False, default='sandbox')
    daraja_consumer_key = db.Column(db.String(255), nullable=True)
    daraja_consumer_secret = db.Column(db.Text, nullable=True)   # encrypted
    daraja_passkey = db.Column(db.Text, nullable=True)           # encrypted
    daraja_shortcode = db.Column(db.String(20), nullable=True)
    daraja_callback_url = db.Column(db.String(500), nullable=True)

    # Accepted methods
    method_mpesa = db.Column(db.Boolean, default=True)
    method_manual = db.Column(db.Boolean, default=True)
    method_card = db.Column(db.Boolean, default=False)
    method_cash = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    isp = db.relationship('ISP', back_populates='payment_settings')

    def __repr__(self):
        return f"<PaymentSettings isp={self.isp_id} route={self.collection_route}>"


class LoyaltySettings(db.Model):
    """Per-ISP loyalty scheme rules (Settings > Loyalty points). One row per ISP.

    Rules only; balances live in :class:`LoyaltyLedger` so a rule change can
    never silently rewrite what a subscriber has already earned.
    """
    __tablename__ = 'loyalty_settings'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, unique=True, index=True)

    enabled = db.Column(db.Boolean, default=False, nullable=False)
    # "points_earned points per earn_per of spend."
    points_earned = db.Column(db.Integer, default=1, nullable=False)
    earn_per = db.Column(db.Numeric(10, 2), default=10, nullable=False)
    # Rounding for a part-earned point: floor never over-awards.
    rounding = db.Column(db.String(10), default='floor', nullable=False)  # floor | nearest
    # What one point is worth as a renewal discount.
    point_value = db.Column(db.Numeric(10, 2), default=1, nullable=False)
    min_redeem = db.Column(db.Integer, default=50, nullable=False)
    expiry_months = db.Column(db.Integer, nullable=True)  # NULL = never expire

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    def __repr__(self):
        return f"<LoyaltySettings isp={self.isp_id} enabled={self.enabled}>"


class LoyaltyLedger(db.Model):
    """Append-only points movement for one subscriber.

    A ledger rather than a balance column on purpose: "why do I have 40 points"
    is the question subscribers actually ask, and a running total cannot answer
    it. The balance is the sum of these rows, and expiry is a row too, so
    nothing ever silently rewrites history.
    """
    __tablename__ = 'loyalty_ledger'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False, index=True)

    # Positive = earned, negative = redeemed or expired.
    points = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(30), nullable=False)  # payment | redemption | expiry | adjustment
    description = db.Column(db.String(200), nullable=True)

    payment_id = db.Column(db.Integer, db.ForeignKey('payments.id'), nullable=True)
    # When this batch of earned points lapses. NULL = never.
    expires_at = db.Column(db.DateTime, nullable=True)
    # Set on an earning row once its points have been consumed or expired, so
    # redemption can spend the oldest live batch first without re-deriving it.
    consumed_points = db.Column(db.Integer, default=0, nullable=False)

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), index=True)

    customer = db.relationship('Customer')

    __table_args__ = (
        db.Index('ix_loyalty_ledger_customer_created', 'customer_id', 'created_at'),
    )

    def __repr__(self):
        return f"<LoyaltyLedger c={self.customer_id} {self.points:+d} {self.reason}>"


class DeviceOutage(db.Model):
    """One period a router was unreachable, and what it cost subscribers.

    Written by the liveness monitor. ``compensated_at`` is what stops a
    recovering router from crediting the same downtime twice — the credit runs
    once, on the transition back to online, and the row records that it did.
    """
    __tablename__ = 'device_outages'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id'), nullable=False, index=True)

    started_at = db.Column(db.DateTime, nullable=False, index=True)
    ended_at = db.Column(db.DateTime, nullable=True)

    compensated_at = db.Column(db.DateTime, nullable=True)
    compensated_customers = db.Column(db.Integer, default=0, nullable=False)
    compensated_minutes = db.Column(db.Integer, default=0, nullable=False)

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    device = db.relationship('MikrotikDevice')

    @property
    def is_open(self):
        return self.ended_at is None

    def duration_minutes(self, now=None):
        end = self.ended_at or (now or datetime.utcnow())
        if not self.started_at:
            return 0
        return max(0, int((end - self.started_at).total_seconds() // 60))

    def __repr__(self):
        return f"<DeviceOutage device={self.device_id} {self.started_at} -> {self.ended_at}>"


class DeviceResourceSample(db.Model):
    """One reading of a router's vitals, kept so the detail page can draw a trend.

    The device row itself only ever holds the *latest* values, which answers
    "how is it now" and nothing about "was it like this an hour ago". A router
    that pins its CPU every evening at 8pm looks perfectly healthy in a
    snapshot; it only shows up in a series.

    Written by :mod:`services.device_resource_history` on every successful stat
    sync, throttled so a burst of page loads cannot flood the table. Rows are
    small and high-churn, so retention is enforced globally rather than per-ISP
    (see ``DEVICE_SAMPLE_RETENTION_DAYS``).

    Totals (``mem_total``/``hdd_total``) are stored alongside the free figures
    on purpose: a board can be upgraded, and a percentage recomputed later
    against today's total would silently rewrite last week's history.
    """
    __tablename__ = 'device_resource_samples'
    __table_args__ = (
        # Every read is "this device, this window, in time order".
        db.Index('ix_device_resource_samples_device_time', 'device_id', 'sampled_at'),
    )

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id'), nullable=False, index=True)

    sampled_at = db.Column(db.DateTime, nullable=False, index=True)

    cpu_load = db.Column(db.Float, nullable=True)          # percent
    mem_total = db.Column(db.BigInteger, nullable=True)    # bytes
    mem_free = db.Column(db.BigInteger, nullable=True)     # bytes
    hdd_total = db.Column(db.BigInteger, nullable=True)    # bytes
    hdd_free = db.Column(db.BigInteger, nullable=True)     # bytes
    client_count = db.Column(db.Integer, nullable=True)
    bandwidth_kbps = db.Column(db.Integer, nullable=True)  # rx+tx on the uplink
    uptime = db.Column(db.Integer, nullable=True)          # seconds, as reported

    device = db.relationship('MikrotikDevice')

    @staticmethod
    def _percent_used(total, free):
        if not total or free is None:
            return None
        used = max(0, int(total) - int(free))
        return round(used * 100.0 / int(total), 1)

    @property
    def memory_percent(self):
        return self._percent_used(self.mem_total, self.mem_free)

    @property
    def disk_percent(self):
        return self._percent_used(self.hdd_total, self.hdd_free)

    def __repr__(self):
        return f"<DeviceResourceSample device={self.device_id} at={self.sampled_at}>"


class PasswordResetToken(db.Model):
    """A single-use link that lets someone set a new password without the old one.

    Only the SHA-256 of the token is stored. The token is 32 random bytes, so a
    fast digest is the right primitive here — it is not a password and needs no
    stretching, and a digest is what lets the lookup be an indexed equality
    check rather than a scan-and-compare over every outstanding row.

    A read-only leak of this table therefore hands an attacker nothing usable:
    the digests cannot be reversed, and the plaintext only ever exists in the
    email that was sent.
    """
    __tablename__ = 'password_reset_tokens'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    token_hash = db.Column(db.String(64), nullable=False, unique=True, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    used_at = db.Column(db.DateTime, nullable=True)

    # Kept for the audit trail — a burst of requests for one account is the
    # signal worth being able to look back at.
    requested_ip = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), index=True)

    user = db.relationship('User')

    def is_usable(self, now=None):
        now = now or datetime.utcnow()
        return self.used_at is None and self.expires_at > now

    def __repr__(self):
        return f"<PasswordResetToken user={self.user_id} used={bool(self.used_at)}>"


class CopilotThread(db.Model):
    """One conversation with the network copilot.

    Scoped to a **user**, not just an ISP: a conversation is personal, and two
    operators sharing a tenant should not read each other's chats. ``isp_id`` is
    carried alongside so a thread can never outlive or leak across a tenant.

    The title is stored rather than derived on read — it comes from the first
    question, and recomputing it every list call would mean loading every
    thread's messages to render a sidebar.
    """
    __tablename__ = 'copilot_threads'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)

    title = db.Column(db.String(120), nullable=False, default='New chat')

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(),
                           onupdate=db.func.current_timestamp(), index=True)

    messages = db.relationship(
        'CopilotMessage', back_populates='thread', cascade='all, delete-orphan',
        order_by='CopilotMessage.id',
    )

    def __repr__(self):
        return f"<CopilotThread {self.id} user={self.user_id}>"


class CopilotMessage(db.Model):
    """One turn in a copilot conversation.

    Errors are stored like any other assistant turn (``is_error``) so reloading
    a thread shows what actually happened rather than a transcript with the
    failures quietly edited out.
    """
    __tablename__ = 'copilot_messages'

    id = db.Column(db.Integer, primary_key=True)
    thread_id = db.Column(db.Integer, db.ForeignKey('copilot_threads.id'),
                          nullable=False, index=True)

    role = db.Column(db.String(12), nullable=False)   # user | assistant
    content = db.Column(db.Text, nullable=False)
    # Which model and whose key answered, shown under the bubble.
    meta = db.Column(db.String(120), nullable=True)
    is_error = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    thread = db.relationship('CopilotThread', back_populates='messages')

    def __repr__(self):
        return f"<CopilotMessage {self.id} {self.role}>"


class RadiusConfig(db.Model):
    """Per-ISP RADIUS server configuration (Settings > RADIUS). One row per ISP."""
    __tablename__ = 'radius_config'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, unique=True, index=True)

    enabled = db.Column(db.Boolean, default=False)
    host = db.Column(db.String(255), nullable=True)
    auth_port = db.Column(db.Integer, default=1812)
    acct_port = db.Column(db.Integer, default=1813)
    shared_secret = db.Column(db.Text, nullable=True)  # encrypted
    nas_identifier = db.Column(db.String(120), nullable=True)

    acct_interim = db.Column(db.Boolean, default=True)
    coa_enabled = db.Column(db.Boolean, default=True)
    data_usage_enforce = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    isp = db.relationship('ISP', back_populates='radius_config')

    def __repr__(self):
        return f"<RadiusConfig isp={self.isp_id} enabled={self.enabled}>"


class RadiusNasClient(db.Model):
    """A NAS device (router/AP) permitted to talk to the RADIUS server."""
    __tablename__ = 'radius_nas_clients'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    ip_address = db.Column(db.String(64), nullable=False)
    shared_secret = db.Column(db.Text, nullable=True)  # encrypted
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    isp = db.relationship('ISP', back_populates='radius_nas_clients')

    def __repr__(self):
        return f"<RadiusNasClient {self.name} ({self.ip_address})>"


class IntegrationSetting(db.Model):
    """Per-ISP third-party integration enable flag + optional JSON config.

    A missing row means "not connected". The display catalogue (icons,
    descriptions) lives in the frontend; this only stores state keyed by ``key``.
    """
    __tablename__ = 'integration_settings'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    key = db.Column(db.String(60), nullable=False)
    enabled = db.Column(db.Boolean, default=False)
    config = db.Column(db.Text, nullable=True)  # JSON blob
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    isp = db.relationship('ISP', back_populates='integration_settings')

    __table_args__ = (
        db.UniqueConstraint('isp_id', 'key', name='uq_integration_setting'),
    )

    def __repr__(self):
        return f"<IntegrationSetting {self.key} enabled={self.enabled}>"


class ApiKey(db.Model):
    """A REST API key issued to an ISP (Settings > API Keys).

    The full token is shown only once at creation; afterwards only a masked
    form (prefix + last 4) is returned.
    """
    __tablename__ = 'api_keys'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    token = db.Column(db.String(80), nullable=False, unique=True, index=True)
    scopes = db.Column(db.String(255), nullable=True)  # comma-separated
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    last_used_at = db.Column(db.DateTime, nullable=True)

    isp = db.relationship('ISP', back_populates='api_keys')

    @property
    def masked(self):
        t = self.token or ''
        if len(t) <= 12:
            return t
        return f"{t[:11]}{'•' * 8}{t[-4:]}"

    def __repr__(self):
        return f"<ApiKey {self.name} isp={self.isp_id}>"


class ApiSetting(db.Model):
    """Per-ISP developer/API settings (currently the webhook signing secret)."""
    __tablename__ = 'api_settings'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, unique=True, index=True)
    webhook_secret = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    isp = db.relationship('ISP', back_populates='api_setting')

    def __repr__(self):
        return f"<ApiSetting isp={self.isp_id}>"


# =========================
#   LDAP Server Model
# =========================

class LDAPServer(db.Model):
    """ LDAP server configuration model for authentication"""
    __tablename__ = 'ldap_servers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    host = db.Column(db.String(255), nullable=False)
    port = db.Column(db.Integer, default=389)
    use_ssl = db.Column(db.Boolean, default=False)
    use_tls = db.Column(db.Boolean, default=False)
    bind_dn = db.Column(db.String(255), nullable=False)
    bind_password = db.Column(db.String(255), nullable=False)
    base_dn = db.Column(db.String(255), nullable=False)
    user_search_base = db.Column(db.String(255), nullable=True)
    user_search_filter = db.Column(db.String(255), default="(uid={})")
    group_search_base = db.Column(db.String(255), nullable=True)
    group_search_filter = db.Column(db.String(255), default="(member={})")
    timeout = db.Column(db.Integer, default=10)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __repr__(self):
        return f"<LDAPServer {self.name} ({self.host}:{self.port})>"

# =========================
#   RADIUS Client Model
# =========================

class RadiusClient(db.Model):
    """ RADIUS client configuration model for FreeRADIUS integration"""
    __tablename__ = 'radius_clients'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    host = db.Column(db.String(255), nullable=False)
    secret = db.Column(db.String(255), nullable=False)
    auth_port = db.Column(db.Integer, default=1812)
    acct_port = db.Column(db.Integer, default=1813)
    nas_type = db.Column(db.String(50), default="other")
    shortname = db.Column(db.String(50), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __repr__(self):
        return f"<RadiusClient {self.name} ({self.host})>"

# =========================
#   SNMP Device Model
# =========================

class SnmpDevice(db.Model):
    """ SNMP device configuration model for network monitoring"""
    __tablename__ = 'snmp_devices'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    host = db.Column(db.String(255), nullable=False)
    port = db.Column(db.Integer, default=161)
    snmp_version = db.Column(db.String(10), default="3")  # 1, 2c, 3
    community = db.Column(db.String(255), nullable=True)  # For v1/v2c
    username = db.Column(db.String(100), nullable=True)   # For v3
    auth_protocol = db.Column(db.String(20), nullable=True)  # MD5, SHA, SHA224, SHA256, SHA384, SHA512
    auth_key = db.Column(db.String(255), nullable=True)
    priv_protocol = db.Column(db.String(20), nullable=True)  # DES, 3DES, AES, AES192, AES256
    priv_key = db.Column(db.String(255), nullable=True)
    context_name = db.Column(db.String(100), nullable=True)
    timeout = db.Column(db.Integer, default=3)
    retries = db.Column(db.Integer, default=3)
    is_active = db.Column(db.Boolean, default=True)
    last_poll = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __repr__(self):
        return f"<SnmpDevice {self.name} ({self.host})>"

# =========================
#   VPN Configuration Model
# =========================

class VPNConfig(db.Model):
    """ VPN configuration model for WireGuard, OpenVPN, and IPSec"""
    __tablename__ = 'vpn_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    vpn_type = db.Column(db.String(20), nullable=False)  # wireguard, openvpn, ipsec
    config_blob = db.Column(db.Text, nullable=False)
    server_public_key = db.Column(db.String(255), nullable=True)  # For WireGuard
    server_private_key = db.Column(db.String(255), nullable=True)  # For WireGuard
    server_endpoint = db.Column(db.String(255), nullable=True)
    server_port = db.Column(db.Integer, nullable=True)
    allowed_ips = db.Column(db.String(255), nullable=True)  # For WireGuard
    dns_servers = db.Column(db.String(255), nullable=True)
    mtu = db.Column(db.Integer, default=1420)  # For WireGuard
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __repr__(self):
        return f"<VPNConfig {self.name} ({self.vpn_type})>"

# =========================
#   VPN Client Model
# =========================

class VPNClient(db.Model):
    """ VPN client configuration model for individual client configs"""
    __tablename__ = 'vpn_clients'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    vpn_config_id = db.Column(db.Integer, db.ForeignKey('vpn_configs.id'), nullable=False)
    client_public_key = db.Column(db.String(255), nullable=True)  # For WireGuard
    client_private_key = db.Column(db.String(255), nullable=True)  # For WireGuard
    client_ip = db.Column(db.String(50), nullable=True)
    config_blob = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    last_connected = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationship mapping the VPN client to the related VPN config
    vpn_config = db.relationship('VPNConfig')
    
    def __repr__(self):
        return f"<VPNClient {self.name} ({self.vpn_config_id})>"


# =========================
#   WireGuard Server (per ISP / site)
# =========================

class WireGuardServer(db.Model):
    """WireGuard VPN server — one per ISP or router location."""
    __tablename__ = 'wireguard_servers'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    endpoint = db.Column(db.String(255), nullable=False)  # public IP or hostname
    port = db.Column(db.Integer, default=51820, nullable=False)
    subnet = db.Column(db.String(50), nullable=False)  # e.g. 10.200.200.0/24
    server_address = db.Column(db.String(50), nullable=False)  # e.g. 10.200.200.1/32
    public_key = db.Column(db.String(255), nullable=False)
    private_key_encrypted = db.Column(db.Text, nullable=False)
    dns_servers = db.Column(db.String(255), default='8.8.8.8,8.8.4.4')
    mtu = db.Column(db.Integer, default=1420)
    deployment_mode = db.Column(db.String(20), default='linux')  # linux | mikrotik
    mikrotik_device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(
        db.DateTime,
        server_default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )

    isp = db.relationship('ISP', back_populates='wireguard_servers')
    mikrotik_device = db.relationship('MikrotikDevice')
    peers = db.relationship('WireGuardPeer', back_populates='server', cascade='all, delete-orphan')

    def __repr__(self):
        return f"<WireGuardServer {self.name} ({self.endpoint}:{self.port})>"


# =========================
#   WireGuard Peer (customer VPN client)
# =========================

class WireGuardPeer(db.Model):
    """WireGuard peer linked to a billing customer."""
    __tablename__ = 'wireguard_peers'

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False, unique=True)
    server_id = db.Column(db.Integer, db.ForeignKey('wireguard_servers.id'), nullable=False)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    assigned_ip = db.Column(db.String(45), nullable=False)  # e.g. 10.200.200.2
    public_key = db.Column(db.String(255), nullable=False)
    private_key_encrypted = db.Column(db.Text, nullable=False)
    preshared_key_encrypted = db.Column(db.Text, nullable=True)
    allowed_ips = db.Column(db.String(255), default='0.0.0.0/0')  # client tunnel routes
    last_handshake = db.Column(db.DateTime, nullable=True)
    rx_bytes = db.Column(db.BigInteger, default=0)
    tx_bytes = db.Column(db.BigInteger, default=0)
    is_active = db.Column(db.Boolean, default=True)
    mikrotik_peer_name = db.Column(db.String(100), nullable=True)
    mikrotik_synced_at = db.Column(db.DateTime, nullable=True)
    mikrotik_sync_error = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(
        db.DateTime,
        server_default=db.func.current_timestamp(),
        onupdate=db.func.current_timestamp(),
    )

    customer = db.relationship('Customer', back_populates='wireguard_peer')
    server = db.relationship('WireGuardServer', back_populates='peers')
    isp = db.relationship('ISP')

    def __repr__(self):
        return f"<WireGuardPeer customer={self.customer_id} ip={self.assigned_ip}>"


# =========================
#   EAP Profile Model
# =========================

class EapProfile(db.Model):
    """ EAP profile model for RADIUS authentication methods"""
    __tablename__ = 'eap_profiles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    eap_method = db.Column(db.String(20), nullable=False)  # EAP-TLS, PEAP, EAP-TTLS, etc.
    ca_cert_path = db.Column(db.String(255), nullable=True)
    server_cert_path = db.Column(db.String(255), nullable=True)
    server_key_path = db.Column(db.String(255), nullable=True)
    client_cert_path = db.Column(db.String(255), nullable=True)
    client_key_path = db.Column(db.String(255), nullable=True)
    phase2_method = db.Column(db.String(20), nullable=True)  # MSCHAPv2, PAP, etc.
    inner_identity = db.Column(db.String(255), nullable=True)
    outer_identity = db.Column(db.String(255), nullable=True)
    config_blob = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __repr__(self):
        return f"<EapProfile {self.name} ({self.eap_method})>"

# =========================
#   SNMP Poll Result Model
# =========================

class SnmpPollResult(db.Model):
    """ SNMP poll result model for storing SNMP query results"""
    __tablename__ = 'snmp_poll_results'
    
    id = db.Column(db.Integer, primary_key=True)
    snmp_device_id = db.Column(db.Integer, db.ForeignKey('snmp_devices.id'), nullable=False)
    oid = db.Column(db.String(255), nullable=False)
    value = db.Column(db.Text, nullable=True)
    data_type = db.Column(db.String(20), nullable=True)  # INTEGER, STRING, COUNTER, etc.
    poll_time = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    response_time = db.Column(db.Float, nullable=True)  # Response time in seconds
    status = db.Column(db.String(20), default="success")  # success, timeout, error
    error_message = db.Column(db.Text, nullable=True)
    
    # Relationship mapping the SNMP poll result to the related SNMP device
    snmp_device = db.relationship('SnmpDevice')
    
    def __repr__(self):
        return f"<SnmpPollResult {self.oid} ({self.value})>" 

# =========================
#   FreeRADIUS SQL Models
# =========================

class RadCheck(db.Model):
    """ FreeRADIUS radcheck table for user authentication """
    __tablename__ = 'radcheck'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), nullable=False, index=True)
    attribute = db.Column(db.String(64), nullable=False, default='Cleartext-Password')
    op = db.Column(db.String(2), nullable=False, default='==')
    value = db.Column(db.String(253), nullable=False)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationships
    isp = db.relationship('ISP')
    customer = db.relationship('Customer', back_populates="radcheck_rows")
    
    def __repr__(self):
        return f"<RadCheck {self.username} ({self.attribute})>"

class RadReply(db.Model):
    """ FreeRADIUS radreply table for user reply attributes """
    __tablename__ = 'radreply'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), nullable=False, index=True)
    attribute = db.Column(db.String(64), nullable=False)
    op = db.Column(db.String(2), nullable=False, default='=')
    value = db.Column(db.String(253), nullable=False)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationships
    isp = db.relationship('ISP')
    customer = db.relationship('Customer', back_populates="radreply_rows")
    
    def __repr__(self):
        return f"<RadReply {self.username} ({self.attribute})>"

class RadAcct(db.Model):
    """ FreeRADIUS radacct table for accounting records """
    __tablename__ = 'radacct'
    
    radacctid = db.Column(db.BigInteger, primary_key=True)
    acctsessionid = db.Column(db.String(64), nullable=False, index=True)
    acctuniqueid = db.Column(db.String(32), nullable=False, index=True)
    username = db.Column(db.String(64), nullable=False, index=True)
    groupname = db.Column(db.String(64), nullable=True)
    realm = db.Column(db.String(64), nullable=True)
    nasipaddress = db.Column(db.String(15), nullable=False, index=True)
    nasportid = db.Column(db.String(15), nullable=True)
    nasporttype = db.Column(db.String(32), nullable=True)
    acctstarttime = db.Column(db.DateTime, nullable=True, index=True)
    acctupdatetime = db.Column(db.DateTime, nullable=True)
    acctstoptime = db.Column(db.DateTime, nullable=True, index=True)
    acctinterval = db.Column(db.Integer, nullable=True)
    acctsessiontime = db.Column(db.Integer, nullable=True, index=True)
    acctauthentic = db.Column(db.String(32), nullable=True)
    connectinfo_start = db.Column(db.String(50), nullable=True)
    connectinfo_stop = db.Column(db.String(50), nullable=True)
    acctinputoctets = db.Column(db.BigInteger, nullable=True)
    acctoutputoctets = db.Column(db.BigInteger, nullable=True)
    calledstationid = db.Column(db.String(50), nullable=True)
    callingstationid = db.Column(db.String(50), nullable=True)
    acctterminatecause = db.Column(db.String(32), nullable=True)
    servicetype = db.Column(db.String(32), nullable=True)
    framedprotocol = db.Column(db.String(32), nullable=True)
    framedipaddress = db.Column(db.String(15), nullable=True, index=True)
    framedipv6address = db.Column(db.String(45), nullable=True)
    framedipv6prefix = db.Column(db.String(45), nullable=True)
    framedinterfaceid = db.Column(db.String(44), nullable=True)
    delegatedipv6prefix = db.Column(db.String(45), nullable=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    mikrotik_device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id'), nullable=True)
    
    # Relationships
    isp = db.relationship('ISP')
    customer = db.relationship('Customer', back_populates="radacct_rows")
    mikrotik_device = db.relationship('MikrotikDevice')
    
    def __repr__(self):
        return f"<RadAcct {self.username} ({self.acctsessionid})>"

class RadGroupCheck(db.Model):
    """ FreeRADIUS radgroupcheck table for group authentication """
    __tablename__ = 'radgroupcheck'
    
    id = db.Column(db.Integer, primary_key=True)
    groupname = db.Column(db.String(64), nullable=False, index=True)
    attribute = db.Column(db.String(64), nullable=False)
    op = db.Column(db.String(2), nullable=False, default='==')
    value = db.Column(db.String(253), nullable=False)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationships
    isp = db.relationship('ISP')
    
    def __repr__(self):
        return f"<RadGroupCheck {self.groupname} ({self.attribute})>"

class RadGroupReply(db.Model):
    """ FreeRADIUS radgroupreply table for group reply attributes """
    __tablename__ = 'radgroupreply'
    
    id = db.Column(db.Integer, primary_key=True)
    groupname = db.Column(db.String(64), nullable=False, index=True)
    attribute = db.Column(db.String(64), nullable=False)
    op = db.Column(db.String(2), nullable=False, default='=')
    value = db.Column(db.String(253), nullable=False)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationships
    isp = db.relationship('ISP')
    
    def __repr__(self):
        return f"<RadGroupReply {self.groupname} ({self.attribute})>"

class RadUserGroup(db.Model):
    """ FreeRADIUS radusergroup table for user-group associations """
    __tablename__ = 'radusergroup'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), nullable=False, index=True)
    groupname = db.Column(db.String(64), nullable=False, index=True)
    priority = db.Column(db.Integer, nullable=False, default=1)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationships
    isp = db.relationship('ISP')
    customer = db.relationship('Customer', back_populates="radusergroup_rows")
    
    def __repr__(self):
        return f"<RadUserGroup {self.username} -> {self.groupname}>"

# =========================
#   ISP Model (Multi-tenant)
# =========================

class ISP(db.Model):
    """ ISP model for multi-tenant SaaS functionality """
    __tablename__ = 'isps'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    company_name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    # Permanent account address label, chosen at signup ("infora" in
    # infora.<app domain>). Immutable once issued — it is the tenant's public
    # identity. Nullable only so pre-onboarding rows survive the backfill.
    slug = db.Column(db.String(63), unique=True, nullable=True, index=True)
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.Text, nullable=True)
    website = db.Column(db.String(200), nullable=True)
    logo_url = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    subscription_plan = db.Column(db.String(50), default='basic')  # basic, pro, enterprise
    # --- Platform subscription (what this tenant pays *us*, not what their
    # subscribers pay them). Access to the operator console lapses at
    # subscription_expires_at + the configured grace; see
    # services/platform_subscription.py.
    subscription_expires_at = db.Column(db.DateTime, nullable=True)
    subscription_is_trial = db.Column(db.Boolean, default=True, nullable=True)
    # Overrides the plan's list price when a tenant is on a negotiated rate.
    subscription_amount = db.Column(db.Numeric(12, 2), nullable=True)
    max_devices = db.Column(db.Integer, default=10)
    max_customers = db.Column(db.Integer, default=100)
    api_key = db.Column(db.String(100), unique=True, nullable=False)
    radius_secret = db.Column(db.String(100), nullable=True)

    # --- Branding & general settings (Settings > General) ---
    hotspot_name = db.Column(db.String(120), nullable=True)
    support_phone = db.Column(db.String(30), nullable=True)
    theme_color = db.Column(db.String(20), nullable=True, default='#1BA449')
    currency = db.Column(db.String(10), nullable=True, default='KES')
    custom_domain = db.Column(db.String(255), nullable=True)
    data_retention_days = db.Column(db.Integer, nullable=True)
    hotspot_username_prefix = db.Column(db.String(30), nullable=True)
    hotspot_password_length = db.Column(db.Integer, nullable=True)
    # Prefix + running counter for customer account numbers (e.g. "INF-100001").
    # Prefix falls back to a slug of the ISP name when unset; the counter is
    # atomically incremented per issued number (see radius_provisioning).
    account_number_prefix = db.Column(db.String(12), nullable=True)
    account_number_seq = db.Column(db.Integer, default=100000, nullable=True)

    # --- Operator automation (Settings > Operator alerts) ---
    # Crediting downtime back to subscribers, and the revenue digest. Both are
    # scalars rather than their own table because they are per-ISP switches with
    # no history of their own — the history lives in device_outages.
    outage_compensation_enabled = db.Column(db.Boolean, default=False, nullable=True)
    # Outages shorter than this are ignored; a 30-second blip is not worth a
    # credit and would bury the real ones in noise.
    outage_min_minutes = db.Column(db.Integer, default=15, nullable=True)
    sales_digest_enabled = db.Column(db.Boolean, default=False, nullable=True)
    sales_digest_frequency = db.Column(db.String(10), default='daily', nullable=True)  # daily | weekly
    sales_digest_recipients = db.Column(db.Text, nullable=True)  # comma-separated
    sales_digest_last_sent_at = db.Column(db.DateTime, nullable=True)

    # --- AI assistant (Settings > AI Assistant) ---
    # `internal` runs on our account against the plan allowance; anything else
    # uses the tenant's own key from integration_settings['ai'].
    ai_enabled = db.Column(db.Boolean, default=False, nullable=True)
    ai_provider = db.Column(db.String(20), default='internal', nullable=True)
    ai_model = db.Column(db.String(60), nullable=True)

    # --- Messaging gateways (Settings > Communications / WhatsApp) ---
    # The provider id this tenant sends on; NULL means "use the platform's own
    # gateway". Credentials sit in integration_settings under the same id, so
    # switching provider keeps every other provider's saved credentials.
    sms_provider = db.Column(db.String(40), nullable=True)
    whatsapp_provider = db.Column(db.String(40), nullable=True)

    # --- Modules (Settings > Modules) ---
    pppoe_enabled = db.Column(db.Boolean, default=True)
    hotspot_enabled = db.Column(db.Boolean, default=True)
    reseller_enabled = db.Column(db.Boolean, default=False)

    # --- Captive portal (Settings > Captive Portal) ---
    default_portal_theme = db.Column(db.String(30), nullable=True, default='clean')
    after_login_redirect_url = db.Column(db.String(500), nullable=True)

    # --- Operating locale (captured at signup, editable in Settings) ---
    # `currency` above is the billing currency and predates onboarding — these
    # three sit alongside it rather than duplicating it.
    country = db.Column(db.String(2), nullable=True)          # ISO 3166-1 alpha-2
    timezone = db.Column(db.String(64), nullable=True)        # IANA, e.g. Africa/Nairobi
    referral_source = db.Column(db.String(60), nullable=True)  # "how did you hear about us"
    onboarded_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    # Relationships
    users = db.relationship('User', back_populates='isp')
    mikrotik_devices = db.relationship('MikrotikDevice', back_populates='isp')
    customers = db.relationship('Customer', back_populates='isp')
    invoices = db.relationship('Invoice', back_populates='isp')
    service_plans = db.relationship('ServicePlan', back_populates='isp')
    radius_sessions = db.relationship('RadiusSession', back_populates='isp')
    network_zones = db.relationship('NetworkZone', back_populates='isp')
    wireguard_servers = db.relationship('WireGuardServer', back_populates='isp')
    notification_settings = db.relationship('NotificationSetting', back_populates='isp', cascade='all, delete-orphan')
    portal_announcements = db.relationship('PortalAnnouncement', back_populates='isp', cascade='all, delete-orphan')
    payment_settings = db.relationship('PaymentSettings', back_populates='isp', uselist=False, cascade='all, delete-orphan')
    radius_config = db.relationship('RadiusConfig', back_populates='isp', uselist=False, cascade='all, delete-orphan')
    radius_nas_clients = db.relationship('RadiusNasClient', back_populates='isp', cascade='all, delete-orphan')
    integration_settings = db.relationship('IntegrationSetting', back_populates='isp', cascade='all, delete-orphan')
    api_keys = db.relationship('ApiKey', back_populates='isp', cascade='all, delete-orphan')
    api_setting = db.relationship('ApiSetting', back_populates='isp', uselist=False, cascade='all, delete-orphan')

    def __repr__(self):
        return f"<ISP {self.name} ({self.company_name})>"
    
    def generate_api_key(self):
        """Generate a unique API key for the ISP"""
        import secrets
        self.api_key = f"isp_{secrets.token_hex(16)}"
    
    def generate_radius_secret(self):
        """Generate a RADIUS secret for the ISP"""
        import secrets
        self.radius_secret = secrets.token_hex(16)


# =========================
#   Website / Marketing
# =========================

class WebsiteInquirySource(Enum):
    CONTACT = 'contact'
    AFFILIATE = 'affiliate'
    TRIAL = 'trial'


class WebsiteInquiryStatus(Enum):
    NEW = 'new'
    CONTACTED = 'contacted'
    CLOSED = 'closed'


class WebsiteInquiry(db.Model):
    """Inbound leads and contact messages from the public marketing website."""
    __tablename__ = 'website_inquiries'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    company = db.Column(db.String(200), nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    inquiry_type = db.Column(db.String(50), nullable=True)
    message = db.Column(db.Text, nullable=True)
    # name= must match the existing Postgres type names, otherwise Alembic
    # autogenerate keeps detecting a phantom type change (websiteinquirysource
    # vs website_inquiry_source) and emits an uncastable ALTER TYPE.
    source = db.Column(
        db.Enum(WebsiteInquirySource, name='website_inquiry_source',
                values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=WebsiteInquirySource.CONTACT,
    )
    status = db.Column(
        db.Enum(WebsiteInquiryStatus, name='website_inquiry_status',
                values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=WebsiteInquiryStatus.NEW,
    )
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    user = db.relationship('User', foreign_keys=[user_id])
    isp = db.relationship('ISP', foreign_keys=[isp_id])

    def __repr__(self):
        return f'<WebsiteInquiry {self.email} ({self.source.value})>'


# =========================
#   Router-scan import
# =========================

class ImportRun(db.Model):
    """One scan/import attempt against a router or a file.

    Persisting the run is what makes a 400-subscriber import survivable: it is
    reviewable before it writes, resumable if it dies halfway, diffable against a
    later re-scan, and revertible when it turns out to be wrong. See
    ROUTER_SCAN_IMPORT_AND_TAKEOVER.md §12.
    """
    __tablename__ = 'import_runs'

    id = db.Column(db.Integer, primary_key=True)
    # 'router-ssh' | 'router-agent' | 'router-export' | 'csv'
    source = db.Column(db.String(20), nullable=False, default='router-ssh')
    # 'scanning' | 'scanned' | 'importing' | 'completed' | 'failed' | 'reverted'
    status = db.Column(db.String(20), nullable=False, default='scanning')
    mode = db.Column(db.String(10), nullable=False, default='dry_run')
    # The §6 router-profile card, as JSON.
    fingerprint = db.Column(db.Text, nullable=True)
    # Operator decisions: pricing map, billing anchor, plan_map, comment options.
    options = db.Column(db.Text, nullable=True)
    # Rolling progress/result counters, polled by the UI during a commit.
    counts = db.Column(db.Text, nullable=True)
    # Captured router output, so the run can be re-parsed without re-scanning.
    # Holds the incumbent's RADIUS secret — encrypted at rest, purged on retention.
    raw_blob = db.Column(db.Text, nullable=True)
    error = db.Column(db.Text, nullable=True)
    # Opaque token for the agent transport; single-run, short-lived.
    ingest_token = db.Column(db.String(64), unique=True, nullable=True, index=True)
    ingest_token_expires_at = db.Column(db.DateTime, nullable=True)

    started_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    finished_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id'), nullable=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    isp = db.relationship('ISP', foreign_keys=[isp_id])
    device = db.relationship('MikrotikDevice', foreign_keys=[device_id])
    created_by = db.relationship('User', foreign_keys=[created_by_id])
    candidates = db.relationship(
        'ImportCandidate', back_populates='run', cascade='all, delete-orphan'
    )

    def __repr__(self):
        return f'<ImportRun {self.id} {self.source} {self.status}>'


class ImportCandidate(db.Model):
    """One discovered subscriber, staged for operator review before it is real.

    Provenance for a committed row lives here (``customer_id``) rather than as a
    new column on ``customers``: the candidate row has to exist anyway, and it
    gives "revert this run" everything it needs without widening the hottest
    table in the schema.
    """
    __tablename__ = 'import_candidates'

    id = db.Column(db.Integer, primary_key=True)
    run_id = db.Column(db.Integer, db.ForeignKey('import_runs.id'), nullable=False, index=True)

    kind = db.Column(db.String(10), nullable=False, default='pppoe')  # pppoe|hotspot|static
    login = db.Column(db.String(120), nullable=True, index=True)
    name = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    # Fernet-encrypted on ingest — the plaintext is never persisted, never
    # logged, and never returned by a list endpoint.
    password_encrypted = db.Column(db.Text, nullable=True)

    profile_name = db.Column(db.String(120), nullable=True)
    rate_limit_raw = db.Column(db.String(120), nullable=True)
    static_ip = db.Column(db.String(45), nullable=True)
    mac = db.Column(db.String(40), nullable=True)
    disabled = db.Column(db.Boolean, default=False, nullable=False)
    online = db.Column(db.Boolean, default=False, nullable=False)
    comment = db.Column(db.Text, nullable=True)
    raw = db.Column(db.Text, nullable=True)

    resolved_plan_id = db.Column(db.Integer, db.ForeignKey('service_plans.id'), nullable=True)
    subscription_end = db.Column(db.DateTime, nullable=True)
    # 'import' | 'skip' | 'update' — operator-editable in the review table.
    decision = db.Column(db.String(10), nullable=False, default='import')
    # 'new' | 'duplicate' | 'error' | 'created' | 'skipped'
    status = db.Column(db.String(12), nullable=False, default='new')
    messages = db.Column(db.Text, nullable=True)

    match_customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True)

    # --- Cutover state (ROUTER_SCAN_IMPORT_AND_TAKEOVER.md 14-15) ---
    # Set when a cutover script carrying this login is generated, so the next
    # batch is the *next* subscribers rather than the same ones again, and the
    # page can say "40 of 400 moved". Cleared by a rollback or a batch reset.
    cutover_at = db.Column(db.DateTime, nullable=True)
    # Result of the last pre-cutover RADIUS probe: 'pass' | 'warn' | 'fail'.
    # NULL means never checked, which the UI reports as pending rather than OK -
    # an unverified client is not a passing one.
    verify_state = db.Column(db.String(8), nullable=True)
    verify_detail = db.Column(db.Text, nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    run = db.relationship('ImportRun', back_populates='candidates')
    resolved_plan = db.relationship('ServicePlan', foreign_keys=[resolved_plan_id])
    match_customer = db.relationship('Customer', foreign_keys=[match_customer_id])
    customer = db.relationship('Customer', foreign_keys=[customer_id])

    def __repr__(self):
        return f'<ImportCandidate {self.login or self.mac} {self.status}>'


# =========================
#   Self-serve onboarding
# =========================

class OnboardingSignup(db.Model):
    """One in-progress ISP signup, from "send me a code" to a provisioned tenant.

    The wizard is a *server-side* state machine, not client-held state. The
    client is handed an opaque ``token`` at step 1 and carries it through every
    later call; each endpoint re-checks ``step``/``status`` before it acts, so a
    hand-crafted request cannot reach ``/complete`` without a verified WhatsApp
    number no matter what it claims.

    Persisting the attempt (rather than signing the wizard state into a JWT) is
    what makes the OTP rate limits, the attempt lockout and the resumable
    provisioning job possible — the same reasoning as ImportRun above.
    """
    __tablename__ = 'onboarding_signups'

    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(64), unique=True, nullable=False, index=True)

    # --- Step 1: who is signing up -------------------------------------
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False, index=True)
    whatsapp_e164 = db.Column(db.String(20), nullable=False, index=True)

    # --- Step 2: WhatsApp OTP ------------------------------------------
    # Hashed, never the plain code: a DB dump must not hand over live codes.
    otp_hash = db.Column(db.Text, nullable=True)
    otp_expires_at = db.Column(db.DateTime, nullable=True)
    otp_attempts = db.Column(db.Integer, default=0, nullable=False)
    otp_sent_count = db.Column(db.Integer, default=0, nullable=False)
    otp_last_sent_at = db.Column(db.DateTime, nullable=True)
    whatsapp_verified_at = db.Column(db.DateTime, nullable=True)

    # --- Step 3: account address ---------------------------------------
    isp_name = db.Column(db.String(100), nullable=True)
    slug = db.Column(db.String(63), nullable=True, index=True)

    # --- Step 4: where they operate ------------------------------------
    country = db.Column(db.String(2), nullable=True)
    timezone = db.Column(db.String(64), nullable=True)
    currency = db.Column(db.String(10), nullable=True)
    referral_source = db.Column(db.String(60), nullable=True)

    # --- Progress ------------------------------------------------------
    # Highest step the signup has *reached* (1-5). Guards step skipping.
    step = db.Column(db.Integer, default=1, nullable=False)
    # 'pending' | 'provisioning' | 'completed' | 'failed'
    status = db.Column(db.String(16), default='pending', nullable=False, index=True)
    # JSON list of {key,label,status,detail} — the rows the UI polls while the
    # provisioning job runs.
    tasks = db.Column(db.Text, nullable=True)
    error = db.Column(db.Text, nullable=True)

    # --- Result --------------------------------------------------------
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # --- Forensics -----------------------------------------------------
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)

    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(),
                           onupdate=db.func.current_timestamp())
    expires_at = db.Column(db.DateTime, nullable=True)
    provisioning_started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    isp = db.relationship('ISP', foreign_keys=[isp_id])
    user = db.relationship('User', foreign_keys=[user_id])

    def __repr__(self):
        return f'<OnboardingSignup {self.email} step={self.step} {self.status}>'


# =========================
#   TR-069 / CWMP Models
# =========================
#
# These describe *customer premises equipment* (GPON ONTs, vendor routers), not
# the MikroTik routers in `mikrotik_devices`. RouterOS has no CWMP client, so the
# two fleets never overlap: MikroTiks are managed over the API/SSH + WireGuard
# tunnel, CPE are managed by the ACS in `services/tr069`.


class CpeDevice(db.Model):
    """A TR-069 customer premises device known to the ACS.

    Identity is the CWMP DeviceId triplet (OUI + ProductClass + SerialNumber),
    flattened into ``serial_key`` because that is what every Inform carries and
    what the operator reads off the sticker.
    """
    __tablename__ = 'cpe_devices'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    # Nullable: a device informs before anyone has claimed it for a subscriber.
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='SET NULL'),
                            nullable=True, index=True)

    # --- CWMP identity (from Inform DeviceId) ---
    serial_key = db.Column(db.String(160), unique=True, nullable=False, index=True)
    oui = db.Column(db.String(12), nullable=True)
    serial_number = db.Column(db.String(80), nullable=True, index=True)
    product_class = db.Column(db.String(80), nullable=True)
    manufacturer = db.Column(db.String(80), nullable=True)
    # 'Device.' (TR-181) or 'InternetGatewayDevice.' (TR-098). Every parameter
    # path is relative to this, so the vendor profile cannot resolve without it.
    data_model_root = db.Column(db.String(32), nullable=True)
    software_version = db.Column(db.String(60), nullable=True)
    hardware_version = db.Column(db.String(60), nullable=True)
    # Which entry in services/tr069/profiles.py resolved this device.
    profile_key = db.Column(db.String(40), nullable=True)

    # 'pending'  — informed but not approved by an operator
    # 'active'   — managed
    # 'disabled' — ignored; informs are answered but no tasks are issued
    status = db.Column(db.String(12), default='pending', nullable=False, index=True)

    # --- Contact tracking ---
    last_inform_at = db.Column(db.DateTime, nullable=True, index=True)
    last_boot_at = db.Column(db.DateTime, nullable=True)
    last_inform_event = db.Column(db.String(60), nullable=True)
    inform_count = db.Column(db.Integer, default=0, nullable=False)
    # Source address of the last Inform — the CPE's public IP (or the CGNAT
    # egress), useful for correlating with a subscriber session.
    peer_ip = db.Column(db.String(45), nullable=True)

    # --- Connection Request (ACS -> CPE) ---
    # Only usable when the CPE is actually routable from us; behind CGNAT it is
    # not, and tasks wait for the next periodic Inform instead.
    connection_request_url = db.Column(db.String(255), nullable=True)
    connection_request_username = db.Column(db.String(80), nullable=True)
    connection_request_password_encrypted = db.Column(db.Text, nullable=True)

    # --- CPE -> ACS auth (the CPE presents these on every Inform) ---
    cwmp_username = db.Column(db.String(80), nullable=True, index=True)
    cwmp_password_encrypted = db.Column(db.Text, nullable=True)

    periodic_inform_interval = db.Column(db.Integer, default=300, nullable=False)

    # Full parameter snapshot as JSON. One row per parameter would mean 3000+
    # rows per ONT; nothing queries individual parameters, the UI reads the blob
    # and the few things worth filtering on are denormalised below.
    parameters = db.Column(db.Text, nullable=True)
    parameters_at = db.Column(db.DateTime, nullable=True)

    # --- Denormalised hot fields (indexed, drive the fleet list) ---
    wan_ip = db.Column(db.String(45), nullable=True)
    ssid = db.Column(db.String(64), nullable=True)
    pppoe_username = db.Column(db.String(120), nullable=True, index=True)
    uptime_seconds = db.Column(db.Integer, nullable=True)
    connected_clients = db.Column(db.Integer, nullable=True)
    # GPON optical receive power in dBm. Healthy -8..-25; below -27 the fibre or
    # a connector is failing. The single most diagnostic number an ONT reports.
    rx_power_dbm = db.Column(db.Float, nullable=True)
    tx_power_dbm = db.Column(db.Float, nullable=True)

    # ONT position — the leaf of the fiber tree, and what makes an optical
    # reading a point on the map rather than a row in a table.
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    # The ODB/splitter port this ONT hangs off. Set this and a dimming branch
    # localises to a segment instead of looking like unrelated slow customers.
    fiber_node_id = db.Column(db.Integer, db.ForeignKey('fiber_nodes.id', ondelete='SET NULL'),
                              nullable=True, index=True)
    tags = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(),
                           onupdate=db.func.current_timestamp())

    isp = db.relationship('ISP')
    customer = db.relationship('Customer', backref=db.backref('cpe_devices', passive_deletes=True))

    @staticmethod
    def build_serial_key(oui, product_class, serial_number):
        """Stable identity from the Inform DeviceId triplet."""
        return '-'.join(str(part or '').strip() for part in (oui, product_class, serial_number))

    def __repr__(self):
        return f'<CpeDevice {self.serial_key} ({self.status})>'


class CpeTask(db.Model):
    """One queued CWMP RPC for a CPE.

    Tasks are queued rather than executed: a CPE behind CGNAT cannot be reached
    on demand, so work is handed over during the device's next session. The UI
    must show this honestly — 'queued' is a real state that can last minutes.
    """
    __tablename__ = 'cpe_tasks'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('cpe_devices.id', ondelete='CASCADE'),
                          nullable=False, index=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True, index=True)

    # get_parameter_values | set_parameter_values | get_parameter_names |
    # reboot | factory_reset | download | add_object | delete_object
    kind = db.Column(db.String(30), nullable=False)
    payload = db.Column(db.Text, nullable=True)   # JSON args for the RPC
    result = db.Column(db.Text, nullable=True)    # JSON response from the CPE

    # queued -> sent -> done | failed | expired
    status = db.Column(db.String(12), default='queued', nullable=False, index=True)
    attempts = db.Column(db.Integer, default=0, nullable=False)
    max_attempts = db.Column(db.Integer, default=3, nullable=False)
    fault_code = db.Column(db.String(20), nullable=True)
    fault_string = db.Column(db.Text, nullable=True)

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    delivered_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)

    device = db.relationship('CpeDevice', backref=db.backref(
        'tasks', cascade='all, delete-orphan', passive_deletes=True,
        order_by='CpeTask.created_at.desc()'))

    def __repr__(self):
        return f'<CpeTask {self.kind} device={self.device_id} {self.status}>'


class CpeSession(db.Model):
    """One CWMP session (Inform ... 204), kept for troubleshooting.

    High churn — every CPE opens one per periodic interval — so this is pruned
    by services/data_retention.py rather than kept forever.
    """
    __tablename__ = 'cpe_sessions'

    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.Integer, db.ForeignKey('cpe_devices.id', ondelete='CASCADE'),
                          nullable=True, index=True)
    session_token = db.Column(db.String(64), nullable=False, index=True)
    peer_ip = db.Column(db.String(45), nullable=True)
    events = db.Column(db.String(255), nullable=True)   # Inform EventCodes, comma-joined
    rpc_count = db.Column(db.Integer, default=0, nullable=False)
    fault_count = db.Column(db.Integer, default=0, nullable=False)
    started_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), index=True)
    ended_at = db.Column(db.DateTime, nullable=True)

    device = db.relationship('CpeDevice', backref=db.backref(
        'sessions', cascade='all, delete-orphan', passive_deletes=True))

    def __repr__(self):
        return f'<CpeSession {self.session_token} device={self.device_id}>'


class CpeFirmware(db.Model):
    """A firmware image the ACS can push with the CWMP Download RPC.

    The CPE fetches the file itself over HTTP from a token URL (same shape as
    routes/provision.py), so the image must be reachable from the subscriber
    network, not just from the server.
    """
    __tablename__ = 'cpe_firmware'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)
    name = db.Column(db.String(120), nullable=False)
    version = db.Column(db.String(60), nullable=True)
    # Targeting: only offered to CPE whose Inform matches these.
    manufacturer = db.Column(db.String(80), nullable=True)
    product_class = db.Column(db.String(80), nullable=True)

    filename = db.Column(db.String(255), nullable=False)
    storage_path = db.Column(db.String(512), nullable=False)
    size_bytes = db.Column(db.Integer, default=0)
    sha256 = db.Column(db.String(64), nullable=True)
    # Opaque token in the download URL handed to the CPE.
    download_token = db.Column(db.String(64), unique=True, nullable=True, index=True)

    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())

    isp = db.relationship('ISP')

    def __repr__(self):
        return f'<CpeFirmware {self.name} {self.version}>'


class PlatformInvoice(db.Model):
    """A bill the platform issues to a tenant ISP for using this system.

    Deliberately separate from ``Invoice``, which is what an ISP bills *its*
    subscribers. The two never mix: this one is denominated in the platform's
    terms, is never visible to end customers, and is the only thing that can
    lift a tenant's console lockout.
    """
    __tablename__ = 'platform_invoices'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)

    # Human reference, also the M-Pesa account number: INV-<slug>-<YYYYMMDD>.
    number = db.Column(db.String(60), unique=True, nullable=False, index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    currency = db.Column(db.String(10), default='KES')
    status = db.Column(db.String(20), default='pending', index=True)  # pending|paid|void

    period_start = db.Column(db.DateTime, nullable=True)
    period_end = db.Column(db.DateTime, nullable=True)
    issued_at = db.Column(db.DateTime, default=datetime.utcnow)
    due_at = db.Column(db.DateTime, nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)

    payment_method = db.Column(db.String(30), nullable=True)
    payment_reference = db.Column(db.String(80), nullable=True)  # M-Pesa receipt
    payer_phone = db.Column(db.String(30), nullable=True)
    # Set while an STK push is in flight; the Safaricom callback finds the
    # invoice by this, exactly as subscriber payments are matched.
    checkout_request_id = db.Column(db.String(80), nullable=True, index=True)
    merchant_request_id = db.Column(db.String(80), nullable=True)

    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    isp = db.relationship('ISP')

    def __repr__(self):
        return f'<PlatformInvoice {self.number} {self.status}>'


# =========================
#   Fiber plant (OSP)
# =========================

class FiberNode(db.Model):
    """A physical point in the outside fiber plant.

    One table for every node kind rather than a table per kind: OLTs, splitters
    and ODBs differ in what they *contain*, not in what a map or a trace needs
    from them (a position, a parent, a port count). Keeping them in one tree
    means "walk upstream from this ONT" is a single recursive query instead of
    a union across four tables.
    """
    __tablename__ = 'fiber_nodes'

    # Ordered head-end → premises. `level` is derived from this and drives the
    # map's z-order and icon size, so a new kind slots in without touching the UI.
    KINDS = ('olt', 'cabinet', 'splitter', 'odb', 'joint', 'pole', 'handhole', 'customer')

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)

    name = db.Column(db.String(120), nullable=False)
    code = db.Column(db.String(60), nullable=True, index=True)  # operator's own label
    kind = db.Column(db.String(20), nullable=False, default='odb', index=True)

    # WGS84. Nullable so a node can be created from a table and placed later —
    # an unplaced node is listed but not drawn.
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)

    # The upstream node. NULL for an OLT (the root of a tree).
    parent_id = db.Column(db.Integer, db.ForeignKey('fiber_nodes.id', ondelete='SET NULL'),
                          nullable=True, index=True)

    # Capacity. For a splitter, split_ratio is the '1:8'/'1:16' label and
    # port_count its output count; for an ODB, port_count is its tray size.
    port_count = db.Column(db.Integer, nullable=True)
    split_ratio = db.Column(db.String(10), nullable=True)
    # Manufacturer's insertion loss for this split, dB. Used by the loss budget.
    splitter_loss_db = db.Column(db.Float, nullable=True)

    status = db.Column(db.String(20), default='active')  # planned|active|fault|retired
    address = db.Column(db.String(255), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    zone_id = db.Column(db.Integer, db.ForeignKey('network_zones.id', ondelete='SET NULL'),
                        nullable=True)
    # An OLT is often a managed router/switch we already poll.
    device_id = db.Column(db.Integer, db.ForeignKey('mikrotik_devices.id', ondelete='SET NULL'),
                          nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    isp = db.relationship('ISP')
    parent = db.relationship('FiberNode', remote_side=[id], backref='children')
    zone = db.relationship('NetworkZone')
    device = db.relationship('MikrotikDevice')

    def __repr__(self):
        return f'<FiberNode {self.kind}:{self.name}>'


class FiberCable(db.Model):
    """A cable segment between two nodes, with its drawn route.

    ``path`` is a JSON array of [lat, lng] pairs — the geometry as surveyed or
    drawn, not a straight line between endpoints. That distinction is the whole
    point: cable is ordered and buried by route length, and a straight line
    underestimates it badly.
    """
    __tablename__ = 'fiber_cables'

    TYPES = ('feeder', 'distribution', 'drop', 'backbone')

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)

    name = db.Column(db.String(120), nullable=True)
    cable_type = db.Column(db.String(20), default='distribution', index=True)

    from_node_id = db.Column(db.Integer, db.ForeignKey('fiber_nodes.id', ondelete='CASCADE'),
                             nullable=False, index=True)
    to_node_id = db.Column(db.Integer, db.ForeignKey('fiber_nodes.id', ondelete='CASCADE'),
                           nullable=True, index=True)

    fiber_count = db.Column(db.Integer, nullable=True)   # strands in the sheath
    # Metres along `path`, computed server-side on save (see services/fiber_geo).
    length_m = db.Column(db.Float, nullable=True)
    # Operator's slack/coil allowance on top of the drawn route, metres.
    slack_m = db.Column(db.Float, nullable=True)

    path = db.Column(db.Text, nullable=True)  # JSON [[lat, lng], ...]

    installation = db.Column(db.String(20), default='aerial')  # aerial|buried|duct
    status = db.Column(db.String(20), default='active')        # planned|active|fault|retired
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    isp = db.relationship('ISP')
    from_node = db.relationship('FiberNode', foreign_keys=[from_node_id])
    to_node = db.relationship('FiberNode', foreign_keys=[to_node_id])

    def __repr__(self):
        return f'<FiberCable {self.name or self.id} {self.cable_type}>'


class FiberSplice(db.Model):
    """One strand's termination: which fibre lands on which port, and what is on it.

    This is the record that answers "port 6 of ODB-14 — what is it, and is it
    free?". Occupancy is derived from the presence of a row, never from a
    counter, so it cannot drift out of step with reality.
    """
    __tablename__ = 'fiber_splices'

    id = db.Column(db.Integer, primary_key=True)
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False, index=True)

    node_id = db.Column(db.Integer, db.ForeignKey('fiber_nodes.id', ondelete='CASCADE'),
                        nullable=False, index=True)
    port_number = db.Column(db.Integer, nullable=False)

    # The cable and strand arriving at this port.
    cable_id = db.Column(db.Integer, db.ForeignKey('fiber_cables.id', ondelete='SET NULL'),
                         nullable=True)
    # Strand identity as the tech reads it off the sheath.
    fiber_number = db.Column(db.Integer, nullable=True)
    tube_color = db.Column(db.String(20), nullable=True)
    fiber_color = db.Column(db.String(20), nullable=True)

    # What the port serves — a downstream node, or a subscriber's ONT.
    downstream_node_id = db.Column(db.Integer, db.ForeignKey('fiber_nodes.id', ondelete='SET NULL'),
                                   nullable=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id', ondelete='SET NULL'),
                            nullable=True, index=True)
    cpe_device_id = db.Column(db.Integer, db.ForeignKey('cpe_devices.id', ondelete='SET NULL'),
                              nullable=True)

    status = db.Column(db.String(20), default='in_use')  # in_use|reserved|faulty|spare
    # Measured loss across this splice, dB (OTDR/power-meter reading).
    loss_db = db.Column(db.Float, nullable=True)
    spliced_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    isp = db.relationship('ISP')
    node = db.relationship('FiberNode', foreign_keys=[node_id], backref='splices')
    downstream_node = db.relationship('FiberNode', foreign_keys=[downstream_node_id])
    cable = db.relationship('FiberCable')
    customer = db.relationship('Customer')
    cpe_device = db.relationship('CpeDevice')

    __table_args__ = (
        # One thing per port. This is the constraint that makes "is port 6
        # free?" answerable from the table alone.
        db.UniqueConstraint('node_id', 'port_number', name='uq_fiber_splice_node_port'),
    )

    def __repr__(self):
        return f'<FiberSplice node={self.node_id} port={self.port_number}>'


# =========================
#   CustomerEvent Model
# =========================

class CustomerEvent(db.Model):
    """One dated thing that happened to a subscriber account.

    The subscriber detail page has two tabs that are only answerable from a
    written record — "Subscription lifecycle" and "Package history" — and until
    this table existed the app kept no such record. `AuditLog` is declared but
    never written to, and `system_logs` is keyed by operator rather than by
    account, so neither can answer "what happened to *this* subscriber, in
    order". Events are append-only: an account's history must not change when
    the account does.

    `from_value`/`to_value` carry the before/after for the change kinds where
    the pair *is* the story (plan swapped, expiry moved, status flipped); they
    stay NULL for events that are simply facts (a payment, an SMS).
    """

    __tablename__ = 'customer_events'

    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(
        db.Integer, db.ForeignKey('customers.id', ondelete='CASCADE'), nullable=False, index=True
    )
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=True, index=True)

    # created | plan_changed | expiry_changed | payment | connected | disconnected
    # | suspended | activated | blocked | unblocked | password_reset | fup_throttled
    # | fup_released | compensated | invoice | note | sms | kyc
    event_type = db.Column(db.String(30), nullable=False, index=True)
    title = db.Column(db.String(160), nullable=False)
    detail = db.Column(db.Text, nullable=True)
    from_value = db.Column(db.String(160), nullable=True)
    to_value = db.Column(db.String(160), nullable=True)
    # Money attached to the event (payment, compensation credit, invoice total).
    amount = db.Column(db.Numeric(10, 2), nullable=True)

    # Who did it. NULL means the system did — a scheduler, a payment callback,
    # or the subscriber themselves through the portal.
    actor_user_id = db.Column(
        db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True
    )
    actor_name = db.Column(db.String(120), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)

    customer = db.relationship('Customer', back_populates='events')
    actor = db.relationship('User')

    def __repr__(self):
        return f'<CustomerEvent {self.customer_id} {self.event_type}>'
