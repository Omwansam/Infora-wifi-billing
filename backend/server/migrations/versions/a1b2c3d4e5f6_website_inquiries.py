"""Add website inquiries table for marketing site leads."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None

inquiry_source_enum = postgresql.ENUM(
    'contact', 'affiliate', 'trial', name='website_inquiry_source', create_type=False
)
inquiry_status_enum = postgresql.ENUM(
    'new', 'contacted', 'closed', name='website_inquiry_status', create_type=False
)


def upgrade():
    bind = op.get_bind()
    postgresql.ENUM('contact', 'affiliate', 'trial', name='website_inquiry_source').create(
        bind, checkfirst=True
    )
    postgresql.ENUM('new', 'contacted', 'closed', name='website_inquiry_status').create(
        bind, checkfirst=True
    )

    op.create_table(
        'website_inquiries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('company', sa.String(length=200), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('inquiry_type', sa.String(length=50), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('source', inquiry_source_enum, nullable=False),
        sa.Column('status', inquiry_status_enum, nullable=False, server_default='new'),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('isp_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.ForeignKeyConstraint(['isp_id'], ['isps.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('website_inquiries')
    bind = op.get_bind()
    postgresql.ENUM(name='website_inquiry_status').drop(bind, checkfirst=True)
    postgresql.ENUM(name='website_inquiry_source').drop(bind, checkfirst=True)
