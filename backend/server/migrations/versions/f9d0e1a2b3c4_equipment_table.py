"""equipment inventory table."""

from alembic import op
import sqlalchemy as sa


revision = 'f9d0e1a2b3c4'
down_revision = 'f8c9d0e1a2b3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'equipment',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('isp_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('equipment_type', sa.String(length=50), nullable=True),
        sa.Column('serial_number', sa.String(length=120), nullable=True),
        sa.Column('vendor', sa.String(length=120), nullable=True),
        sa.Column('price', sa.Float(), nullable=True),
        sa.Column('paid_amount', sa.Float(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('location', sa.String(length=120), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('warranty_until', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('device_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.current_timestamp()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.current_timestamp()),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.ForeignKeyConstraint(['device_id'], ['mikrotik_devices.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('equipment', schema=None) as batch_op:
        batch_op.create_index('ix_equipment_isp_id', ['isp_id'], unique=False)


def downgrade():
    with op.batch_alter_table('equipment', schema=None) as batch_op:
        batch_op.drop_index('ix_equipment_isp_id')
    op.drop_table('equipment')
