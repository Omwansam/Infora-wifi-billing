"""Add KYC verification fields

Revision ID: e7f8a9b0c1d2
Revises: c8f2a1b3d4e5
Create Date: 2026-06-20 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'e7f8a9b0c1d2'
down_revision = 'c8f2a1b3d4e5'
branch_labels = None
depends_on = None

kyc_status_enum = sa.Enum(
    'pending', 'under_review', 'verified', 'rejected',
    name='kyc_status',
)


def upgrade():
    kyc_status_enum.create(op.get_bind(), checkfirst=True)

    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('id_number', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('kyc_status', kyc_status_enum, nullable=False, server_default='pending'))
        batch_op.add_column(sa.Column('kyc_verified_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('kyc_notes', sa.Text(), nullable=True))

    with op.batch_alter_table('customer_documents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('verification_status', sa.String(length=20), nullable=False, server_default='pending'))
        batch_op.add_column(sa.Column('notes', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('customer_documents', schema=None) as batch_op:
        batch_op.drop_column('notes')
        batch_op.drop_column('verification_status')

    with op.batch_alter_table('customers', schema=None) as batch_op:
        batch_op.drop_column('kyc_notes')
        batch_op.drop_column('kyc_verified_at')
        batch_op.drop_column('kyc_status')
        batch_op.drop_column('id_number')

    kyc_status_enum.drop(op.get_bind(), checkfirst=True)
