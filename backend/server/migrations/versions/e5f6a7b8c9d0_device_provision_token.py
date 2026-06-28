"""One-line self-provisioning token fields on mikrotik_devices."""

from alembic import op
import sqlalchemy as sa


revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('provision_token', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('provision_token_expires_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('provision_last_fetched_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('provision_fetch_count', sa.Integer(), nullable=False, server_default='0'))
        batch_op.create_index('ix_mikrotik_devices_provision_token', ['provision_token'], unique=True)


def downgrade():
    with op.batch_alter_table('mikrotik_devices', schema=None) as batch_op:
        batch_op.drop_index('ix_mikrotik_devices_provision_token')
        batch_op.drop_column('provision_fetch_count')
        batch_op.drop_column('provision_last_fetched_at')
        batch_op.drop_column('provision_token_expires_at')
        batch_op.drop_column('provision_token')
