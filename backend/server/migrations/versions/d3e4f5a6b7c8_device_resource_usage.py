"""Device resource usage: cpu_load + memory/storage byte counters on
mikrotik_devices (feeds the device detail page Resource Usage card).

Idempotent: this project also builds schema via ``flask initdb`` (create_all),
so on some databases these columns already exist before the migration runs.
Guard each add so ``flask db upgrade`` succeeds whether or not they're present
(otherwise boot crash-loops on DuplicateColumn).
"""

from alembic import op
import sqlalchemy as sa


revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


RESOURCE_COLUMNS = (
    ('cpu_load', sa.Float()),
    ('mem_total', sa.BigInteger()),
    ('mem_free', sa.BigInteger()),
    ('hdd_total', sa.BigInteger()),
    ('hdd_free', sa.BigInteger()),
)


def _existing_columns(table):
    bind = op.get_bind()
    return {col['name'] for col in sa.inspect(bind).get_columns(table)}


def upgrade():
    existing = _existing_columns('mikrotik_devices')
    for name, type_ in RESOURCE_COLUMNS:
        if name not in existing:
            op.add_column('mikrotik_devices', sa.Column(name, type_, nullable=True))


def downgrade():
    existing = _existing_columns('mikrotik_devices')
    for name, _type in reversed(RESOURCE_COLUMNS):
        if name in existing:
            op.drop_column('mikrotik_devices', name)
