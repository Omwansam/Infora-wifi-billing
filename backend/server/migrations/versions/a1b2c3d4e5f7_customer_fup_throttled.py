"""customers.fup_throttled: tracks whether a subscriber is currently
provisioned at the plan's FUP throttled speed (set/cleared by
services.fup_enforcement).

Idempotent: this project also builds schema via ``flask initdb`` (create_all)
and ``ensure_schema_upgrades`` on boot, so the column may already exist before
the migration runs. Guard the add so ``flask db upgrade`` succeeds either way.
"""

from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f7'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None


def _existing_columns(table):
    bind = op.get_bind()
    return {col['name'] for col in sa.inspect(bind).get_columns(table)}


def upgrade():
    if 'fup_throttled' not in _existing_columns('customers'):
        op.add_column(
            'customers',
            sa.Column('fup_throttled', sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade():
    if 'fup_throttled' in _existing_columns('customers'):
        op.drop_column('customers', 'fup_throttled')
