from datetime import datetime
from extensions import db
from enum import Enum

class CustomerStatus(Enum):
    ACTIVE = 'active'
    SUSPENDED = 'suspended'
    PENDING = 'pending'


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
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(15), nullable=False)
    address = db.Column(db.String(255), nullable=True)
    status = db.Column(db.Enum(CustomerStatus, name="customer_status"), default=CustomerStatus.ACTIVE, nullable=False)
    join_date = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    balance = db.Column(db.Numeric(10, 2), default=0.00)
    package = db.Column(db.String(50), nullable=False)
    usage_percentage = db.Column(db.Integer, default=0)
    device_count = db.Column(db.Integer, default=0)
    last_payment_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, server_default=db.func.current_timestamp())
    updated_at = db.Column(db.DateTime, server_default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    # Relationships mapping the customer to multiple devices
    devices = db.relationship('CustomerDevice', back_populates="customer", cascade='all, delete-orphan')
    # Relationships mapping the customer to multiple invoices
    invoices = db.relationship('Invoice', back_populates="customer")
    # Relationships mapping the customer to multiple payments
    payments = db.relationship('Payment', back_populates="customer")
    # Relationships mapping the customer to multiple tickets
    tickets = db.relationship('Ticket', back_populates="customer")
    # Relationships mapping the customer to multiple notes
    notes = db.relationship('CustomerNote', back_populates="customer", cascade='all, delete-orphan')
    # Relationships mapping the customer to multiple documents
    documents = db.relationship('CustomerDocument', back_populates="customer", cascade='all, delete-orphan')
    # Foreign Key To store service plan id
    service_plan_id = db.Column(db.Integer, db.ForeignKey('service_plans.id'), nullable=True)
    # Relationships mapping the customer to multiple notifications
    notifications = db.relationship('Notification', back_populates="customer", cascade='all, delete-orphan')
    # Relationship mapping the customer to the related service plan
    service_plan = db.relationship('ServicePlan', back_populates="customers")
    # Relationships mapping the customer to multiple transactions
    transactions = db.relationship('Transaction', back_populates="customer")
    # Relationships mapping the customer to multiple revenue data
    revenue_data = db.relationship('RevenueData', back_populates="customer")
    # Relationships mapping the customer to multiple radius sessions
    radius_sessions = db.relationship('RadiusSession', back_populates="customer")
    # Relationships mapping the customer to multiple radius checks
    radius_checks = db.relationship('RadiusCheck', back_populates="customer")
    # Relationships mapping the customer to multiple radius replies
    radius_replies = db.relationship('RadiusReply', back_populates="customer")
    # Relationships mapping the customer to multiple isps
    isp_id = db.Column(db.Integer, db.ForeignKey('isps.id'), nullable=False)
    isp = db.relationship('ISP', back_populates='customers')

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
    speed = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False)
    features = db.Column(db.JSON, nullable=False)
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
    password = db.Column(db.String(50), nullable=False)
    api_key = db.Column(db.String(50), nullable=False)
    api_port = db.Column(db.Integer, default=8728)
    device_name = db.Column(db.String(50), nullable=False)
    device_ip = db.Column(db.String(50), nullable=False)
    device_model = db.Column(db.String(50), nullable=False)
    device_status = db.Column(db.Enum(DeviceStatus, name="device_status"), default=DeviceStatus.ONLINE, nullable=False)
    uptime = db.Column(db.Integer, default=0)
    client_count = db.Column(db.Integer, default=0)
    bandwidth_usage = db.Column(db.Integer, default=0)
    location = db.Column(db.String(50), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    last_synced = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
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
    
    def __repr__(self):
        return f"<MikrotikDevice {self.device_name} ({self.device_ip})>"


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
    used_by_customer = db.relationship('Customer', foreign_keys=[used_by_customer_id])
    
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
    customer = db.relationship('Customer')
    
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
    customer = db.relationship('Customer')
    
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
    customer = db.relationship('Customer')
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
    customer = db.relationship('Customer')
    
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
    phone = db.Column(db.String(20), nullable=True)
    address = db.Column(db.Text, nullable=True)
    website = db.Column(db.String(200), nullable=True)
    logo_url = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    subscription_plan = db.Column(db.String(50), default='basic')  # basic, pro, enterprise
    max_devices = db.Column(db.Integer, default=10)
    max_customers = db.Column(db.Integer, default=100)
    api_key = db.Column(db.String(100), unique=True, nullable=False)
    radius_secret = db.Column(db.String(100), nullable=True)
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
