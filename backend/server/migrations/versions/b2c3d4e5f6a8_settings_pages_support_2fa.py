"""Settings pages backing store: support_requests table + users 2FA columns.

Idempotent guards (create_all / ensure_schema_upgrades may have already added
these on some databases) so `flask db upgrade` succeeds either way.
"""

from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a8'
down_revision = 'a1b2c3d4e5f7'
branch_labels = None
depends_on = None


def _has_table(name):
    bind = op.get_bind()
    return sa.inspect(bind).has_table(name)


def _columns(table):
    bind = op.get_bind()
    return {col['name'] for col in sa.inspect(bind).get_columns(table)}


USER_2FA_COLUMNS = (
    ('two_factor_enabled', sa.Boolean(), {'nullable': False, 'server_default': sa.false()}),
    ('two_factor_secret', sa.Text(), {'nullable': True}),
    ('two_factor_backup_codes', sa.Text(), {'nullable': True}),
)


def upgrade():
    if not _has_table('support_requests'):
        op.create_table(
            'support_requests',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('request_type', sa.String(length=20), nullable=False, server_default='support'),
            sa.Column('subject', sa.String(length=255), nullable=False),
            sa.Column('message', sa.Text(), nullable=False),
            sa.Column('priority', sa.String(length=20), nullable=False, server_default='medium'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp()),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('isp_id', sa.Integer(), sa.ForeignKey('isps.id'), nullable=True),
        )

    existing = _columns('users')
    for name, type_, kwargs in USER_2FA_COLUMNS:
        if name not in existing:
            op.add_column('users', sa.Column(name, type_, **kwargs))


def downgrade():
    existing = _columns('users')
    for name, _type, _kwargs in reversed(USER_2FA_COLUMNS):
        if name in existing:
            op.drop_column('users', name)
    if _has_table('support_requests'):
        op.drop_table('support_requests')
