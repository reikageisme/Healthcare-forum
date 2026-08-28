"""phase3 admin moderation and reports migration

Revision ID: 0002_phase3_admin_moderation
Revises: 0001_phase2
Create Date: 2026-08-28 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

# revision identifiers, used by Alembic.
revision = '0002_phase3_admin_moderation'
down_revision = '0001_phase2'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Create Enums if postgres
    bind = op.get_bind()
    is_postgres = bind.dialect.name == 'postgresql'
    
    post_status_enum = sa.Enum('pending', 'approved', 'rejected', name='poststatus')
    report_status_enum = sa.Enum('open', 'resolved', 'dismissed', name='reportstatus')
    report_target_type_enum = sa.Enum('post', 'comment', 'user', name='reporttargettype')
    
    if is_postgres:
        post_status_enum.create(bind, checkfirst=True)

    # 2. Add columns to posts table
    op.add_column('posts', sa.Column('status', post_status_enum, nullable=False, server_default='approved'))
    op.add_column('posts', sa.Column('rejection_reason', sa.String(500), nullable=True))
    op.create_index(op.f('ix_posts_status'), 'posts', ['status'], unique=False)

    # 3. Create reports table
    op.create_table(
        'reports',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('reporter_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('target_type', report_target_type_enum, nullable=False),
        sa.Column('target_id', UUID(as_uuid=True), nullable=False),
        sa.Column('report_type', sa.String(50), nullable=False, server_default='spam'),
        sa.Column('reason', sa.String(255), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('status', report_status_enum, nullable=False, server_default='open'),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('resolved_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_reports_id'), 'reports', ['id'], unique=False)
    op.create_index(op.f('ix_reports_reporter_id'), 'reports', ['reporter_id'], unique=False)
    op.create_index(op.f('ix_reports_target_type'), 'reports', ['target_type'], unique=False)
    op.create_index(op.f('ix_reports_target_id'), 'reports', ['target_id'], unique=False)
    op.create_index(op.f('ix_reports_status'), 'reports', ['status'], unique=False)
    op.create_index(op.f('ix_reports_created_at'), 'reports', ['created_at'], unique=False)

def downgrade() -> None:
    op.drop_table('reports')
    op.drop_index(op.f('ix_posts_status'), table_name='posts')
    op.drop_column('posts', 'rejection_reason')
    op.drop_column('posts', 'status')
    
    op.execute('DROP TYPE IF EXISTS reporttargettype')
    op.execute('DROP TYPE IF EXISTS reportstatus')
    op.execute('DROP TYPE IF EXISTS poststatus')
