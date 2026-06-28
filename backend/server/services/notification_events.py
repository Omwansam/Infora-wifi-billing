"""Catalogue of customisable notification events for Settings > Notifications.

This is the single source of truth for *which* notifications exist, how they are
grouped in the UI, which channels (SMS/email) each supports, the default
enabled state, the placeholder variables an ISP may use, and the default
message body. Per-ISP overrides (enabled flag + custom template) are stored in
the ``notification_settings`` table and merged on top of this catalogue.

Keeping the catalogue in code (not the DB) means new notification types ship
with the app and every tenant immediately sees them with sensible defaults.
"""

# Common placeholders available to most templates.
_COMMON_VARS = ['{customer_name}', '{isp_name}']

GROUPS = [
    {
        'key': 'onboarding',
        'label': 'Client Onboarding',
        'description': 'Sent when a new user is created or reconnects to hotspot',
        'events': [
            {
                'key': 'welcome_sms',
                'label': 'Welcome SMS',
                'description': 'Username, password & portal link when a new client is created',
                'channel': 'sms',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{username}', '{password}', '{portal_url}'],
                'default_template': (
                    'Welcome to {isp_name}! Your login is {username} / {password}. '
                    'Manage your account at {portal_url}.'
                ),
            },
            {
                'key': 'welcome_email',
                'label': 'Welcome email',
                'description': 'Branded welcome email with login credentials',
                'channel': 'email',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{username}', '{password}', '{portal_url}'],
                'default_template': (
                    'Hi {customer_name},\n\nYour {isp_name} account is ready.\n'
                    'Username: {username}\nPassword: {password}\n\nPortal: {portal_url}'
                ),
            },
            {
                'key': 'hotspot_reconnect',
                'label': 'Hotspot reconnect',
                'description': 'Login credentials when a hotspot user is disconnected mid-session',
                'channel': 'sms',
                'default_enabled': True,
                'variables': _COMMON_VARS + ['{username}', '{password}'],
                'default_template': 'Reconnect to {isp_name} WiFi: {username} / {password}',
            },
        ],
    },
    {
        'key': 'payments',
        'label': 'Payments & Renewals',
        'description': 'Sent on payment confirmation, renewal, expiry, and account status changes',
        'events': [
            {
                'key': 'payment_received',
                'label': 'Payment received',
                'description': 'When a payment is confirmed',
                'channel': 'sms',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{amount}', '{plan}', '{expiry_date}'],
                'default_template': (
                    'Payment of {amount} received. Thank you! Your {plan} plan is active until {expiry_date}.'
                ),
            },
            {
                'key': 'payment_received',
                'label': 'Payment received',
                'description': 'Email when a payment is confirmed',
                'channel': 'email',
                'default_enabled': True,
                'variables': _COMMON_VARS + ['{amount}', '{plan}', '{expiry_date}'],
                'default_template': (
                    'Hi {customer_name}, we received your payment of {amount} for {plan}. '
                    'Active until {expiry_date}.'
                ),
            },
            {
                'key': 'subscription_renewed',
                'label': 'Subscription renewed',
                'description': 'When subscription is manually renewed',
                'channel': 'sms',
                'default_enabled': True,
                'variables': _COMMON_VARS + ['{plan}', '{expiry_date}'],
                'default_template': 'Your {isp_name} {plan} subscription is renewed until {expiry_date}.',
            },
            {
                'key': 'subscription_renewed',
                'label': 'Subscription renewed',
                'description': 'Email with new expiry after renewal',
                'channel': 'email',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{plan}', '{expiry_date}'],
                'default_template': 'Hi {customer_name}, your {plan} is renewed. New expiry: {expiry_date}.',
            },
            {
                'key': 'expiry_date_changed',
                'label': 'Expiry date changed',
                'description': 'When admin manually changes expiry or package',
                'channel': 'sms',
                'default_enabled': True,
                'variables': _COMMON_VARS + ['{plan}', '{expiry_date}'],
                'default_template': 'Your {isp_name} plan now expires on {expiry_date}.',
            },
            {
                'key': 'expiry_reminder',
                'label': 'Expiry reminder',
                'description': 'Sent BEFORE expiry (2 days, 1 day) to remind user to renew',
                'channel': 'sms',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{plan}', '{expiry_date}', '{days_left}'],
                'default_template': (
                    'Reminder: your {isp_name} plan expires in {days_left} day(s) on {expiry_date}. Renew to stay online.'
                ),
            },
            {
                'key': 'near_expiry_alert',
                'label': 'Near-expiry alert',
                'description': 'PPPoE only: alert when near expiry',
                'channel': 'sms',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{expiry_date}'],
                'default_template': 'Your {isp_name} internet is about to expire on {expiry_date}.',
            },
            {
                'key': 'expiry_reminder',
                'label': 'Expiry reminder',
                'description': 'Email BEFORE expiry to remind user to renew',
                'channel': 'email',
                'default_enabled': True,
                'variables': _COMMON_VARS + ['{plan}', '{expiry_date}', '{days_left}'],
                'default_template': (
                    'Hi {customer_name}, your {plan} expires in {days_left} day(s) on {expiry_date}.'
                ),
            },
            {
                'key': 'disconnected_expired',
                'label': 'Disconnected (subscription expired)',
                'description': 'Sent when a PPPoE/Hotspot user is auto-disconnected because their internet expired',
                'channel': 'sms',
                'default_enabled': True,
                'variables': _COMMON_VARS + ['{plan}', '{portal_url}'],
                'default_template': (
                    'Your {isp_name} internet has expired and is now disconnected. Renew at {portal_url}.'
                ),
            },
            {
                'key': 'disconnected_expired',
                'label': 'Disconnected (subscription expired)',
                'description': 'Email when a PPPoE/Hotspot user is auto-disconnected because their internet expired',
                'channel': 'email',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{plan}', '{portal_url}'],
                'default_template': 'Hi {customer_name}, your service has expired. Renew at {portal_url}.',
            },
            {
                'key': 'account_suspended',
                'label': 'Account suspended',
                'description': 'When a client account is suspended',
                'channel': 'sms',
                'default_enabled': False,
                'variables': _COMMON_VARS,
                'default_template': 'Your {isp_name} account has been suspended. Contact support for help.',
            },
            {
                'key': 'account_reactivated',
                'label': 'Account reactivated',
                'description': 'When a suspended account is restored',
                'channel': 'sms',
                'default_enabled': False,
                'variables': _COMMON_VARS,
                'default_template': 'Good news! Your {isp_name} account has been reactivated.',
            },
        ],
    },
    {
        'key': 'tickets',
        'label': 'Support Tickets',
        'description': 'Sent when customers submit or receive replies on support tickets',
        'events': [
            {
                'key': 'ticket_received',
                'label': 'Ticket received',
                'description': 'Confirm receipt of a support ticket',
                'channel': 'sms',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{ticket_id}'],
                'default_template': 'We received your support ticket #{ticket_id}. Our team will get back to you shortly.',
            },
            {
                'key': 'ticket_reply',
                'label': 'Ticket reply',
                'description': 'Notify client when a reply is posted',
                'channel': 'sms',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{ticket_id}'],
                'default_template': 'There is a new reply on your support ticket #{ticket_id}.',
            },
            {
                'key': 'ticket_reply',
                'label': 'Ticket reply',
                'description': 'Full reply email to client',
                'channel': 'email',
                'default_enabled': False,
                'variables': _COMMON_VARS + ['{ticket_id}', '{reply_body}'],
                'default_template': 'Hi {customer_name},\n\n{reply_body}\n\n— {isp_name} Support (ticket #{ticket_id})',
            },
        ],
    },
    {
        'key': 'resellers',
        'label': 'Resellers',
        'description': 'Sent to reseller accounts on creation and balance events',
        'events': [
            {
                'key': 'reseller_welcome',
                'label': 'Reseller welcome',
                'description': 'Login link + credentials to new reseller',
                'channel': 'sms',
                'default_enabled': False,
                'variables': ['{isp_name}', '{username}', '{password}', '{portal_url}'],
                'default_template': 'Welcome reseller! Login at {portal_url} with {username} / {password}.',
            },
            {
                'key': 'reseller_low_balance',
                'label': 'Low balance alert',
                'description': 'Alert reseller when wallet balance is critically low',
                'channel': 'sms',
                'default_enabled': False,
                'variables': ['{isp_name}', '{balance}'],
                'default_template': 'Your reseller wallet balance is low ({balance}). Top up to keep selling.',
            },
            {
                'key': 'reseller_daily_report',
                'label': 'Daily report',
                'description': 'Daily activity summary to ISP admin',
                'channel': 'email',
                'default_enabled': False,
                'variables': ['{isp_name}', '{date}', '{summary}'],
                'default_template': '{isp_name} daily summary for {date}:\n\n{summary}',
            },
        ],
    },
    {
        'key': 'router_health',
        'label': 'Router Health (sent to ISP admin)',
        'description': 'Alerts about your MikroTik routers — sent to your admin phone, not customers',
        'events': [
            {
                'key': 'router_offline',
                'label': 'Router went OFFLINE',
                'description': 'Immediate alert when a router stops responding to polls',
                'channel': 'sms',
                'default_enabled': True,
                'variables': ['{router_name}', '{router_ip}'],
                'default_template': 'ALERT: Router {router_name} ({router_ip}) is OFFLINE.',
            },
            {
                'key': 'router_still_offline',
                'label': 'Still-offline reminder',
                'description': 'Repeating reminder every 3 hours while the router is still down',
                'channel': 'sms',
                'default_enabled': True,
                'variables': ['{router_name}', '{router_ip}', '{downtime}'],
                'default_template': 'Router {router_name} is still OFFLINE (down {downtime}).',
            },
            {
                'key': 'router_back_online',
                'label': 'Router back ONLINE',
                'description': 'Sent when a previously offline router comes back online',
                'channel': 'sms',
                'default_enabled': True,
                'variables': ['{router_name}', '{router_ip}'],
                'default_template': 'Router {router_name} ({router_ip}) is back ONLINE.',
            },
        ],
    },
]


def iter_events():
    """Yield (group, event) for every catalogue event."""
    for group in GROUPS:
        for event in group['events']:
            yield group, event


def event_index():
    """Map (event_key, channel) -> event definition, for validation."""
    return {(e['key'], e['channel']): e for _, e in iter_events()}


def is_valid_event(event_key, channel):
    return (event_key, channel) in event_index()
