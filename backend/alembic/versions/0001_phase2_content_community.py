"""phase2 content community baseline migration

Revision ID: 0001_phase2
Revises: 
Create Date: 2026-08-28 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

# revision identifiers, used by Alembic.
revision = '0001_phase2'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Users Table
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('specialty', sa.String(100), nullable=True),
        sa.Column('bio', sa.String(500), nullable=True),
        sa.Column('role', sa.Enum('guest', 'user', 'doctor', 'moderator', 'admin', name='userrole'), nullable=False, server_default='user'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_users_id'), 'users', ['id'], unique=False)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # 2. Categories Table
    op.create_table(
        'categories',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('icon', sa.String(100), nullable=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_categories_id'), 'categories', ['id'], unique=False)
    op.create_index(op.f('ix_categories_name'), 'categories', ['name'], unique=True)
    op.create_index(op.f('ix_categories_slug'), 'categories', ['slug'], unique=True)

    # 3. Tags Table
    op.create_table(
        'tags',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('slug', sa.String(50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_tags_id'), 'tags', ['id'], unique=False)
    op.create_index(op.f('ix_tags_name'), 'tags', ['name'], unique=True)
    op.create_index(op.f('ix_tags_slug'), 'tags', ['slug'], unique=True)

    # 4. Posts Table
    op.create_table(
        'posts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('excerpt', sa.String(500), nullable=True),
        sa.Column('thumbnail', sa.String(500), nullable=True),
        sa.Column('post_type', sa.Enum('article', 'question', 'review', 'share', name='posttype'), nullable=False, server_default='article'),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('helpful_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('comment_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_published', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('author_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_id', UUID(as_uuid=True), sa.ForeignKey('categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_posts_id'), 'posts', ['id'], unique=False)
    op.create_index(op.f('ix_posts_slug'), 'posts', ['slug'], unique=True)
    op.create_index(op.f('ix_posts_author_id'), 'posts', ['author_id'], unique=False)
    op.create_index(op.f('ix_posts_category_id'), 'posts', ['category_id'], unique=False)
    op.create_index(op.f('ix_posts_created_at'), 'posts', ['created_at'], unique=False)
    op.create_index(op.f('ix_posts_post_type'), 'posts', ['post_type'], unique=False)

    # 5. Post Tags Association Table
    op.create_table(
        'post_tags',
        sa.Column('post_id', UUID(as_uuid=True), sa.ForeignKey('posts.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('tag_id', UUID(as_uuid=True), sa.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
    )

    # 6. Comments Table
    op.create_table(
        'comments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('post_id', UUID(as_uuid=True), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_id', UUID(as_uuid=True), sa.ForeignKey('comments.id', ondelete='CASCADE'), nullable=True),
        sa.Column('author_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('vote_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_comments_id'), 'comments', ['id'], unique=False)
    op.create_index(op.f('ix_comments_post_id'), 'comments', ['post_id'], unique=False)
    op.create_index(op.f('ix_comments_parent_id'), 'comments', ['parent_id'], unique=False)
    op.create_index(op.f('ix_comments_author_id'), 'comments', ['author_id'], unique=False)

    # 7. Reactions Table
    op.create_table(
        'reactions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('post_id', UUID(as_uuid=True), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('reaction_type', sa.Enum('helpful', 'like', 'informative', name='reactiontype'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'post_id', name='uq_user_post_reaction')
    )
    op.create_index(op.f('ix_reactions_id'), 'reactions', ['id'], unique=False)
    op.create_index(op.f('ix_reactions_user_id'), 'reactions', ['user_id'], unique=False)
    op.create_index(op.f('ix_reactions_post_id'), 'reactions', ['post_id'], unique=False)

    # 8. Bookmarks Table
    op.create_table(
        'bookmarks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('post_id', UUID(as_uuid=True), sa.ForeignKey('posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'post_id', name='uq_user_post_bookmark')
    )
    op.create_index(op.f('ix_bookmarks_id'), 'bookmarks', ['id'], unique=False)
    op.create_index(op.f('ix_bookmarks_user_id'), 'bookmarks', ['user_id'], unique=False)
    op.create_index(op.f('ix_bookmarks_post_id'), 'bookmarks', ['post_id'], unique=False)

    # Seed Default Categories
    categories_table = sa.table(
        'categories',
        sa.column('id', UUID(as_uuid=True)),
        sa.column('name', sa.String),
        sa.column('slug', sa.String),
        sa.column('icon', sa.String),
        sa.column('description', sa.String),
    )
    op.bulk_insert(
        categories_table,
        [
            {'id': uuid.uuid4(), 'name': 'Nhi khoa', 'slug': 'nhi-khoa', 'icon': 'Baby', 'description': 'Chăm sóc sức khỏe, sự phát triển và bệnh lý ở trẻ em'},
            {'id': uuid.uuid4(), 'name': 'Nội khoa', 'slug': 'noi-khoa', 'icon': 'HeartPulse', 'description': 'Chẩn đoán và điều trị không phẫu thuật các bệnh lý người lớn'},
            {'id': uuid.uuid4(), 'name': 'Ngoại khoa', 'slug': 'ngoai-khoa', 'icon': 'Scissors', 'description': 'Tư vấn và điều trị phẫu thuật các bệnh lý ngoại khoa'},
            {'id': uuid.uuid4(), 'name': 'Sản khoa', 'slug': 'san-khoa', 'icon': 'HeartHandshake', 'description': 'Sức khỏe sinh sản, thai kỳ, chăm sóc mẹ và bé'},
            {'id': uuid.uuid4(), 'name': 'Da liễu', 'slug': 'da-lieu', 'icon': 'Sparkles', 'description': 'Chăm sóc da, điều trị mụn, dị ứng và các bệnh lý về da'},
            {'id': uuid.uuid4(), 'name': 'Tim mạch', 'slug': 'tim-mach', 'icon': 'Activity', 'description': 'Huyết áp, bệnh tim, xơ vữa động mạch và tim mạch can thiệp'},
            {'id': uuid.uuid4(), 'name': 'Xương khớp', 'slug': 'xuong-khop', 'icon': 'Bone', 'description': 'Thoái hóa khớp, cột sống, đau nhức cơ xương khớp'},
            {'id': uuid.uuid4(), 'name': 'Dinh dưỡng', 'slug': 'dinh-duong', 'icon': 'Apple', 'description': 'Chế độ ăn uống lành mạnh, dinh dưỡng điều trị và đề kháng'},
            {'id': uuid.uuid4(), 'name': 'Hỏi bác sĩ', 'slug': 'hoi-bac-si', 'icon': 'HelpCircle', 'description': 'Giải đáp thắc mắc sức khỏe trực tiếp cùng các chuyên gia y tế'},
        ]
    )

    # Seed Default Tags
    tags_table = sa.table(
        'tags',
        sa.column('id', UUID(as_uuid=True)),
        sa.column('name', sa.String),
        sa.column('slug', sa.String),
    )
    op.bulk_insert(
        tags_table,
        [
            {'id': uuid.uuid4(), 'name': 'Sốt xuất huyết', 'slug': 'sot-xuat-huyet'},
            {'id': uuid.uuid4(), 'name': 'Covid-19', 'slug': 'covid-19'},
            {'id': uuid.uuid4(), 'name': 'Đau dạ dày', 'slug': 'dau-da-day'},
            {'id': uuid.uuid4(), 'name': 'Tiêm chủng', 'slug': 'tiem-chung'},
            {'id': uuid.uuid4(), 'name': 'Dinh dưỡng cho bé', 'slug': 'dinh-duong-cho-be'},
            {'id': uuid.uuid4(), 'name': 'Mất ngủ', 'slug': 'mat-ngu'},
            {'id': uuid.uuid4(), 'name': 'Kháng sinh', 'slug': 'khang-sinh'},
        ]
    )

def downgrade() -> None:
    op.drop_table('bookmarks')
    op.drop_table('reactions')
    op.drop_table('comments')
    op.drop_table('post_tags')
    op.drop_table('posts')
    op.drop_table('tags')
    op.drop_table('categories')
    op.drop_table('users')
    
    op.execute('DROP TYPE IF EXISTS reactiontype')
    op.execute('DROP TYPE IF EXISTS posttype')
    op.execute('DROP TYPE IF EXISTS userrole')
