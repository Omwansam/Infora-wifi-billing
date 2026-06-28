"""device_backups table for stored RouterOS config exports."""

from alembic import op
import sqlalchemy as sa


revision = 'f8c9d0e1a2b3'
down_revision = 'f7b8c9d0e1a2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'device_backups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('device_id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=True),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('storage_path', sa.String(length=512), nullable=False),
        sa.Column('file_format', sa.String(length=10), nullable=True),
        sa.Column('size_bytes', sa.Integer(), nullable=True),
        sa.Column('sha256', sa.String(length=64), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp()),
        sa.ForeignKeyConstraint(['device_id'], ['mikrotik_devices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('device_backups', schema=None) as batch_op:
        batch_op.create_index('ix_device_backups_device_id', ['device_id'], unique=False)
        batch_op.create_index('ix_device_backups_isp_id', ['isp_id'], unique=False)


def downgrade():
    with op.batch_alter_table('device_backups', schema=None) as batch_op:
        batch_op.drop_index('ix_device_backups_isp_id')
        batch_op.drop_index('ix_device_backups_device_id')
    op.drop_table('device_backups')
