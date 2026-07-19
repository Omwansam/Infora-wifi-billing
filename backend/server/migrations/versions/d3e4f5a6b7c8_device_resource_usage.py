"""Device resource usage: cpu_load + memory/storage byte counters on
mikrotik_devices (feeds the device detail page Resource Usage card).
"""

from alembic import op
import sqlalchemy as sa


revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cpu_load', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('mem_total', sa.BigInteger(), nullable=True))
        batch_op.add_column(sa.Column('mem_free', sa.BigInteger(), nullable=True))
        batch_op.add_column(sa.Column('hdd_total', sa.BigInteger(), nullable=True))
        batch_op.add_column(sa.Column('hdd_free', sa.BigInteger(), nullable=True))


def downgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.drop_column('hdd_free')
        batch_op.drop_column('hdd_total')
        batch_op.drop_column('mem_free')
        batch_op.drop_column('mem_total')
        batch_op.drop_column('cpu_load')
