"""WireGuard MikroTik sync status on peers."""

from alembic import op
import sqlalchemy as sa


revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('wireguard_peers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('mikrotik_peer_name', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('mikrotik_synced_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('mikrotik_sync_error', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('wireguard_peers', schema=None) as batch_op:
        batch_op.drop_column('mikrotik_sync_error')
        batch_op.drop_column('mikrotik_synced_at')
        batch_op.drop_column('mikrotik_peer_name')
