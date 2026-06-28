"""Hotspot access codes table for captive-portal voucher redeem."""
from alembic import op
import sqlalchemy as sa


revision = 'b1c2d3e4f5a6'
down_revision = 'a0b1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'hotspot_access_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('plan_id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=True),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('use_count', sa.Integer(), nullable=True),
        sa.Column('used_by_customer_id', sa.Integer(), nullable=True),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp(), nullable=True),
        sa.ForeignKeyConstraint(['device_id'], ['mikrotik_devices.id']),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.ForeignKeyConstraint(['plan_id'], ['service_plans.id']),
        sa.ForeignKeyConstraint(['used_by_customer_id'], ['customers.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('isp_id', 'code', name='uq_hotspot_access_code'),
    )
    op.create_index('ix_hotspot_access_codes_isp_id', 'hotspot_access_codes', ['isp_id'], unique=False)
    op.create_index('ix_hotspot_access_codes_code', 'hotspot_access_codes', ['code'], unique=False)


def downgrade():
    op.drop_index('ix_hotspot_access_codes_code', table_name='hotspot_access_codes')
    op.drop_index('ix_hotspot_access_codes_isp_id', table_name='hotspot_access_codes')
    op.drop_table('hotspot_access_codes')
