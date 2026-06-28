"""WireGuard VPN servers, peers, and plan fields."""

from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'wireguard_servers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('endpoint', sa.String(length=255), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False, server_default='51820'),
        sa.Column('subnet', sa.String(length=50), nullable=False),
        sa.Column('server_address', sa.String(length=50), nullable=False),
        sa.Column('public_key', sa.String(length=255), nullable=False),
        sa.Column('private_key_encrypted', sa.Text(), nullable=False),
        sa.Column('dns_servers', sa.String(length=255), nullable=True),
        sa.Column('mtu', sa.Integer(), nullable=True, server_default='1420'),
        sa.Column('deployment_mode', sa.String(length=20), nullable=True, server_default='linux'),
        sa.Column('mikrotik_device_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.ForeignKeyConstraint(['mikrotik_device_id'], ['mikrotik_devices.id']),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'wireguard_peers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('server_id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('assigned_ip', sa.String(length=45), nullable=False),
        sa.Column('public_key', sa.String(length=255), nullable=False),
        sa.Column('private_key_encrypted', sa.Text(), nullable=False),
        sa.Column('preshared_key_encrypted', sa.Text(), nullable=True),
        sa.Column('allowed_ips', sa.String(length=255), nullable=True),
        sa.Column('last_handshake', sa.DateTime(), nullable=True),
        sa.Column('rx_bytes', sa.BigInteger(), nullable=True, server_default='0'),
        sa.Column('tx_bytes', sa.BigInteger(), nullable=True, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id']),
        sa.ForeignKeyConstraint(['server_id'], ['wireguard_servers.id']),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('customer_id'),
    )

    with op.batch_alter_table('service_plans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('wireguard_dns', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('wireguard_allowed_ips', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('wireguard_server_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_service_plans_wireguard_server',
            'wireguard_servers',
            ['wireguard_server_id'],
            ['id'],
        )


def downgrade():
    with op.batch_alter_table('service_plans', schema=None) as batch_op:
        batch_op.drop_constraint('fk_service_plans_wireguard_server', type_='foreignkey')
        batch_op.drop_column('wireguard_server_id')
        batch_op.drop_column('wireguard_allowed_ips')
        batch_op.drop_column('wireguard_dns')

    op.drop_table('wireguard_peers')
    op.drop_table('wireguard_servers')
