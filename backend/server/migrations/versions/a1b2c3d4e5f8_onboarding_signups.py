"""Self-serve onboarding: onboarding_signups table + ISP slug/locale + user contact verification.

Idempotent guards throughout, because ``ensure_schema_upgrades()`` in app.py adds
the same columns on boot for deployments that ship without Alembic. Either order
must succeed.
"""

from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f8'
down_revision = '59438c499dba'
branch_labels = None
depends_on = None


def _has_table(name):
    bind = op.get_bind()
    return sa.inspect(bind).has_table(name)


def _columns(table):
    bind = op.get_bind()
    if not sa.inspect(bind).has_table(table):
        return set()
    return {col['name'] for col in sa.inspect(bind).get_columns(table)}


ISP_COLUMNS = (
    ('slug', sa.String(length=63), {'nullable': True}),
    ('country', sa.String(length=2), {'nullable': True}),
    ('timezone', sa.String(length=64), {'nullable': True}),
    ('referral_source', sa.String(length=60), {'nullable': True}),
    ('onboarded_at', sa.DateTime(), {'nullable': True}),
)

USER_COLUMNS = (
    ('whatsapp_number', sa.String(length=20), {'nullable': True}),
    ('whatsapp_verified_at', sa.DateTime(), {'nullable': True}),
    ('email_verified_at', sa.DateTime(), {'nullable': True}),
)


def upgrade():
    if not _has_table('onboarding_signups'):
        op.create_table(
            'onboarding_signups',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('token', sa.String(length=64), nullable=False),

            sa.Column('full_name', sa.String(length=120), nullable=False),
            sa.Column('email', sa.String(length=120), nullable=False),
            sa.Column('whatsapp_e164', sa.String(length=20), nullable=False),

            sa.Column('otp_hash', sa.Text(), nullable=True),
            sa.Column('otp_expires_at', sa.DateTime(), nullable=True),
            sa.Column('otp_attempts', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('otp_sent_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('otp_last_sent_at', sa.DateTime(), nullable=True),
            sa.Column('whatsapp_verified_at', sa.DateTime(), nullable=True),

            sa.Column('isp_name', sa.String(length=100), nullable=True),
            sa.Column('slug', sa.String(length=63), nullable=True),

            sa.Column('country', sa.String(length=2), nullable=True),
            sa.Column('timezone', sa.String(length=64), nullable=True),
            sa.Column('currency', sa.String(length=10), nullable=True),
            sa.Column('referral_source', sa.String(length=60), nullable=True),

            sa.Column('step', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('status', sa.String(length=16), nullable=False, server_default='pending'),
            sa.Column('tasks', sa.Text(), nullable=True),
            sa.Column('error', sa.Text(), nullable=True),

            sa.Column('isp_id', sa.Integer(), sa.ForeignKey('isps.id'), nullable=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),

            sa.Column('ip_address', sa.String(length=45), nullable=True),
            sa.Column('user_agent', sa.String(length=255), nullable=True),

            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp()),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.Column('provisioning_started_at', sa.DateTime(), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),

            sa.UniqueConstraint('token', name='uq_onboarding_signups_token'),
        )
        op.create_index('ix_onboarding_signups_token', 'onboarding_signups', ['token'])
        op.create_index('ix_onboarding_signups_email', 'onboarding_signups', ['email'])
        op.create_index('ix_onboarding_signups_whatsapp', 'onboarding_signups', ['whatsapp_e164'])
        op.create_index('ix_onboarding_signups_status', 'onboarding_signups', ['status'])
        op.create_index('ix_onboarding_signups_slug', 'onboarding_signups', ['slug'])

    existing_isp = _columns('isps')
    for name, type_, kwargs in ISP_COLUMNS:
        if name not in existing_isp:
            op.add_column('isps', sa.Column(name, type_, **kwargs))

    existing_user = _columns('users')
    for name, type_, kwargs in USER_COLUMNS:
        if name not in existing_user:
            op.add_column('users', sa.Column(name, type_, **kwargs))

    # Case-insensitive partial unique index: this is what settles two signups
    # racing for the same account address, so it must exist before real traffic.
    op.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS uq_isps_slug '
        'ON isps (lower(slug)) WHERE slug IS NOT NULL'
    )


def downgrade():
    op.execute('DROP INDEX IF EXISTS uq_isps_slug')

    existing_user = _columns('users')
    for name, _type, _kwargs in USER_COLUMNS:
        if name in existing_user:
            op.drop_column('users', name)

    existing_isp = _columns('isps')
    for name, _type, _kwargs in ISP_COLUMNS:
        if name in existing_isp:
            op.drop_column('isps', name)

    if _has_table('onboarding_signups'):
        op.drop_table('onboarding_signups')
