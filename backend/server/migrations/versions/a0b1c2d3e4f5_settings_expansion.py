"""Settings expansion: ISP branding/modules/portal columns, device portal_theme,
notification_settings and portal_announcements tables.
"""

from alembic import op
import sqlalchemy as sa


revision = 'a0b1c2d3e4f5'
down_revision = 'f9d0e1a2b3c4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('isps', schema=None) as batch_op:
        batch_op.add_column(sa.Column('hotspot_name', sa.String(length=120), nullable=True))
        batch_op.add_column(sa.Column('support_phone', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('theme_color', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('currency', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('custom_domain', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('data_retention_days', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('hotspot_username_prefix', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('hotspot_password_length', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('pppoe_enabled', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('hotspot_enabled', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('reseller_enabled', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('default_portal_theme', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('after_login_redirect_url', sa.String(length=500), nullable=True))

    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('portal_theme', sa.String(length=30), nullable=True))

    op.create_table(
        'notification_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('event_key', sa.String(length=80), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=True),
        sa.Column('template', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('isp_id', 'event_key', 'channel', name='uq_notification_setting'),
    )
    op.create_index('ix_notification_settings_isp_id', 'notification_settings', ['isp_id'], unique=False)

    op.create_table(
        'portal_announcements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_portal_announcements_isp_id', 'portal_announcements', ['isp_id'], unique=False)


def downgrade():
    op.drop_index('ix_portal_announcements_isp_id', table_name='portal_announcements')
    op.drop_table('portal_announcements')
    op.drop_index('ix_notification_settings_isp_id', table_name='notification_settings')
    op.drop_table('notification_settings')

    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.drop_column('portal_theme')

    with op.batch_alter_table('isps', schema=None) as batch_op:
        batch_op.drop_column('after_login_redirect_url')
        batch_op.drop_column('default_portal_theme')
        batch_op.drop_column('reseller_enabled')
        batch_op.drop_column('hotspot_enabled')
        batch_op.drop_column('pppoe_enabled')
        batch_op.drop_column('hotspot_password_length')
        batch_op.drop_column('hotspot_username_prefix')
        batch_op.drop_column('data_retention_days')
        batch_op.drop_column('custom_domain')
        batch_op.drop_column('currency')
        batch_op.drop_column('theme_color')
        batch_op.drop_column('support_phone')
        batch_op.drop_column('hotspot_name')
