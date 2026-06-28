"""Firmware/version + last_backup tracking columns on mikrotik_devices."""

from alembic import op
import sqlalchemy as sa


revision = 'f7b8c9d0e1a2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('os_version', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('firmware_latest', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('last_backup_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.drop_column('last_backup_at')
        batch_op.drop_column('firmware_latest')
        batch_op.drop_column('os_version')
