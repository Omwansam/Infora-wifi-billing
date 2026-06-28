"""Management WireGuard tunnel fields on mikrotik_devices."""

from alembic import op
import sqlalchemy as sa


revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('management_wg_enabled', sa.Boolean(), nullable=False, server_default='false'))
        batch_op.add_column(sa.Column('management_wg_ip', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('management_wg_public_key', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('management_wg_private_key_encrypted', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.drop_column('management_wg_private_key_encrypted')
        batch_op.drop_column('management_wg_public_key')
        batch_op.drop_column('management_wg_ip')
        batch_op.drop_column('management_wg_enabled')
