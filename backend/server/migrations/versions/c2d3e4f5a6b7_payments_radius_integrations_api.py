"""Settings expansion II: payment_settings, radius_config, radius_nas_clients,
integration_settings, api_keys and api_settings tables (Settings > Payments /
RADIUS / Integrations / API Keys).
"""

from alembic import op
import sqlalchemy as sa


revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'payment_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('collection_route', sa.String(length=20), nullable=False, server_default='paybill'),
        sa.Column('buygoods_till', sa.String(length=20), nullable=True),
        sa.Column('buygoods_store', sa.String(length=20), nullable=True),
        sa.Column('paybill_shortcode', sa.String(length=20), nullable=True),
        sa.Column('paybill_account', sa.String(length=60), nullable=True),
        sa.Column('bank_name', sa.String(length=120), nullable=True),
        sa.Column('bank_paybill', sa.String(length=20), nullable=True),
        sa.Column('bank_account', sa.String(length=60), nullable=True),
        sa.Column('daraja_env', sa.String(length=10), nullable=False, server_default='sandbox'),
        sa.Column('daraja_consumer_key', sa.String(length=255), nullable=True),
        sa.Column('daraja_consumer_secret', sa.Text(), nullable=True),
        sa.Column('daraja_passkey', sa.Text(), nullable=True),
        sa.Column('daraja_shortcode', sa.String(length=20), nullable=True),
        sa.Column('daraja_callback_url', sa.String(length=500), nullable=True),
        sa.Column('method_mpesa', sa.Boolean(), nullable=True),
        sa.Column('method_manual', sa.Boolean(), nullable=True),
        sa.Column('method_card', sa.Boolean(), nullable=True),
        sa.Column('method_cash', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('isp_id', name='uq_payment_settings_isp'),
    )
    op.create_index('ix_payment_settings_isp_id', 'payment_settings', ['isp_id'], unique=False)

    op.create_table(
        'radius_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=True),
        sa.Column('host', sa.String(length=255), nullable=True),
        sa.Column('auth_port', sa.Integer(), nullable=True),
        sa.Column('acct_port', sa.Integer(), nullable=True),
        sa.Column('shared_secret', sa.Text(), nullable=True),
        sa.Column('nas_identifier', sa.String(length=120), nullable=True),
        sa.Column('acct_interim', sa.Boolean(), nullable=True),
        sa.Column('coa_enabled', sa.Boolean(), nullable=True),
        sa.Column('data_usage_enforce', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('isp_id', name='uq_radius_config_isp'),
    )
    op.create_index('ix_radius_config_isp_id', 'radius_config', ['isp_id'], unique=False)

    op.create_table(
        'radius_nas_clients',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('ip_address', sa.String(length=64), nullable=False),
        sa.Column('shared_secret', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_radius_nas_clients_isp_id', 'radius_nas_clients', ['isp_id'], unique=False)

    op.create_table(
        'integration_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=60), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=True),
        sa.Column('config', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('isp_id', 'key', name='uq_integration_setting'),
    )
    op.create_index('ix_integration_settings_isp_id', 'integration_settings', ['isp_id'], unique=False)

    op.create_table(
        'api_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('token', sa.String(length=80), nullable=False),
        sa.Column('scopes', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token', name='uq_api_key_token'),
    )
    op.create_index('ix_api_keys_isp_id', 'api_keys', ['isp_id'], unique=False)
    op.create_index('ix_api_keys_token', 'api_keys', ['token'], unique=True)

    op.create_table(
        'api_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('webhook_secret', sa.String(length=120), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('isp_id', name='uq_api_settings_isp'),
    )
    op.create_index('ix_api_settings_isp_id', 'api_settings', ['isp_id'], unique=False)


def downgrade():
    op.drop_index('ix_api_settings_isp_id', table_name='api_settings')
    op.drop_table('api_settings')
    op.drop_index('ix_api_keys_token', table_name='api_keys')
    op.drop_index('ix_api_keys_isp_id', table_name='api_keys')
    op.drop_table('api_keys')
    op.drop_index('ix_integration_settings_isp_id', table_name='integration_settings')
    op.drop_table('integration_settings')
    op.drop_index('ix_radius_nas_clients_isp_id', table_name='radius_nas_clients')
    op.drop_table('radius_nas_clients')
    op.drop_index('ix_radius_config_isp_id', table_name='radius_config')
    op.drop_table('radius_config')
    op.drop_index('ix_payment_settings_isp_id', table_name='payment_settings')
    op.drop_table('payment_settings')
