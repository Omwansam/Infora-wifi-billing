"""Applied service config blob on mikrotik_devices."""

from alembic import op
import sqlalchemy as sa


revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('service_config', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.drop_column('service_config')
