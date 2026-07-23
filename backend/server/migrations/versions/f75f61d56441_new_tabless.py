"""new tabless (neutralised — see note)

Revision ID: f75f61d56441
Revises: b2c3d4e5f6a8
Create Date: 2026-07-23 18:04:23.141751

NOTE: this migration was produced by ``flask db migrate`` autogenerate and
captured **incidental drift**, not an intentional schema change. It has been
neutralised to a no-op because every delta it contained was wrong or unsafe to
apply:

  * It tried to DROP ``uq_customers_isp_account_number`` and
    ``uq_customers_isp_radius_login`` — the partial unique indexes created by
    ``app.ensure_schema_upgrades()`` (same idempotent-DDL pattern as
    ``fup_throttled``). Those indexes are intentional; dropping them would
    remove the per-ISP uniqueness for ``radius_login`` / ``account_number``.
  * It tried to RETYPE ``website_inquiries.source`` / ``.status`` to a renamed
    enum (``website_inquiry_source`` → ``websiteinquirysource``). That is a
    cosmetic type-name difference — Postgres can't auto-cast it (the crash that
    blocked ``flask db upgrade``), and it has no runtime effect because DML uses
    the column's existing type regardless of the model's declared enum name.
  * The unique-constraint → unique-index churn on api_keys / api_settings /
    payment_settings / radius_config is functionally equivalent to what the DB
    already enforces.

The columns and indexes the new code actually needs (``radius_login``,
``account_number``, their partial unique indexes, ``email`` nullable, ISP
account-number counter) are created idempotently by
``ensure_schema_upgrades()`` on app boot. If a clean Alembic representation of
those is wanted later, regenerate against a DB that has NOT yet run
``ensure_schema_upgrades`` so the two don't fight.
"""

# revision identifiers, used by Alembic.
revision = 'f75f61d56441'
down_revision = 'b2c3d4e5f6a8'
branch_labels = None
depends_on = None


def upgrade():
    # Intentionally a no-op — see module docstring.
    pass


def downgrade():
    # Intentionally a no-op — see module docstring.
    pass
