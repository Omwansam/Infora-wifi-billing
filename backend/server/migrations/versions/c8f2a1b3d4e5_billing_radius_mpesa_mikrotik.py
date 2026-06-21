"""Billing radius mpesa mikrotik enhancements

Revision ID: c8f2a1b3d4e5
Revises: 264b46e9514a
Create Date: 2026-06-19 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c8f2a1b3d4e5'
down_revision = '264b46e9514a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('radius_password_encrypted', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('subscription_start', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('subscription_end', sa.DateTime(), nullable=True))
        batch_op.alter_column('phone', existing_type=sa.String(length=15), type_=sa.String(length=20))

    with op.batch_alter_table('service_plans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('description', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('bandwidth_limit', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('data_limit', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('static_ip', sa.String(length=45), nullable=True))
        batch_op.add_column(sa.Column('session_timeout', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('idle_timeout', sa.Integer(), nullable=True))

    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.alter_column('password', existing_type=sa.String(length=50), type_=sa.Text())
        batch_op.alter_column('api_key', existing_type=sa.String(length=50), type_=sa.String(length=255), nullable=True)
        batch_op.add_column(sa.Column('ssh_port', sa.Integer(), server_default='22', nullable=True))
        batch_op.add_column(sa.Column('connection_type', sa.String(length=10), server_default='api', nullable=True))
        batch_op.add_column(sa.Column('use_ssl', sa.Boolean(), server_default='true', nullable=True))

    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('mpesa_checkout_request_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('mpesa_merchant_request_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('mpesa_receipt_number', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('phone_number', sa.String(length=20), nullable=True))


def downgrade():
    with op.batch_alter_table('payments', schema=None) as batch_op:
        batch_op.drop_column('phone_number')
        batch_op.drop_column('mpesa_receipt_number')
        batch_op.drop_column('mpesa_merchant_request_id')
        batch_op.drop_column('mpesa_checkout_request_id')

    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.drop_column('use_ssl')
        batch_op.drop_column('connection_type')
        batch_op.drop_column('ssh_port')
        batch_op.alter_column('api_key', existing_type=sa.String(length=255), type_=sa.String(length=50), nullable=False)
        batch_op.alter_column('password', existing_type=sa.Text(), type_=sa.String(length=50))

    with op.batch_alter_table('service_plans', schema=None) as batch_op:
        batch_op.drop_column('idle_timeout')
        batch_op.drop_column('session_timeout')
        batch_op.drop_column('static_ip')
        batch_op.drop_column('data_limit')
        batch_op.drop_column('bandwidth_limit')
        batch_op.drop_column('description')

    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.alter_column('phone', existing_type=sa.String(length=20), type_=sa.String(length=15))
        batch_op.drop_column('subscription_end')
        batch_op.drop_column('subscription_start')
        batch_op.drop_column('radius_password_encrypted')
