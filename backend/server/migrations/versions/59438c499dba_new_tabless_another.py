"""new tabless another (neutralised — autogenerate drift)

Revision ID: 59438c499dba
Revises: f75f61d56441
Create Date: 2026-07-24 02:18:33.696497

NOTE: neutralised for the same reason as f75f61d56441 — this was produced by
``flask db migrate`` and captured **incidental drift**, not an intentional
change: dropping the ``uq_customers_isp_*`` partial unique indexes (managed by
``app.ensure_schema_upgrades``), churning settings-table unique constraints, and
an uncastable ``website_inquiries`` enum RETYPE (the crash).

Root causes are now fixed so this should stop recurring:
  * The ``website_inquiries`` enum name mismatch is fixed in models.py
    (``name='website_inquiry_source'`` / ``'website_inquiry_status'``).
  * ``migrations/env.py`` has an ``include_object`` filter that ignores the
    ``ensure_schema_upgrades``-managed partial indexes.

Schema evolution in this project is handled by ``ensure_schema_upgrades`` (boot),
not Alembic autogenerate — avoid ``flask db migrate`` against a DB that has run
it.
"""

# revision identifiers, used by Alembic.
revision = '59438c499dba'
down_revision = 'f75f61d56441'
branch_labels = None
depends_on = None


def upgrade():
    # Intentionally a no-op — see module docstring.
    pass


def downgrade():
    # Intentionally a no-op — see module docstring.
    pass
