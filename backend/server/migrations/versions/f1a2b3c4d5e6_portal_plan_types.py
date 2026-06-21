"""Portal plan types and connection type

Revision ID: f1a2b3c4d5e6
Revises: e7f8a9b0c1d2
Create Date: 2026-06-19 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f1a2b3c4d5e6'
down_revision = 'e7f8a9b0c1d2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('service_plans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('plan_type', sa.String(length=20), server_default='pppoe', nullable=False))
        batch_op.add_column(sa.Column('duration_hours', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('billing_cycle_days', sa.Integer(), server_default='30', nullable=True))

    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('connection_type', sa.String(length=20), server_default='pppoe', nullable=False))


def downgrade():
    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.drop_column('connection_type')

    with op.batch_alter_table('service_plans', schema=None) as batch_op:
        batch_op.drop_column('billing_cycle_days')
        batch_op.drop_column('duration_hours')
        batch_op.drop_column('plan_type')
